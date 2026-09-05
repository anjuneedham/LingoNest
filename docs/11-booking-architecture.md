# 11. Booking Architecture

## 11.1 Time model

- `bookings.starts_at` is `timestamptz`, always stored in UTC.
- Availability is stored in the **teacher's IANA timezone** with the zone on the row
  (`teacher_availability.timezone`), plus `valid_from`/`valid_to` so a teacher can change
  their schedule without rewriting history.
- Exceptions (`block` / `extra`) override the weekly pattern for a given date.
- The learner sees everything converted to their own profile timezone; the confirmation
  screen shows both zones explicitly.
- DST is handled by expanding local wall-clock rules into instants **per date** using the
  IANA database, never by adding fixed offsets.

## 11.2 Slot expansion

`core/booking/availability.ts`:

```ts
expandAvailability({
  rules, exceptions, existingBookings, slotMinutes, leadTimeMinutes,
  bufferMinutes, from, to, teacherTimezone, viewerTimezone,
}) → Slot[]   // {startsAtUtc, endsAtUtc, localLabelForViewer}
```

Rules applied: minimum lead time (default 2 h, configurable), buffer between lessons,
maximum bookings per day, blocked exceptions, and subtraction of conflicting bookings.
The same function runs client-side (to render a calendar quickly) **and** server-side (as
the authority) — the client's view is a hint, the server's expansion is the truth.

## 11.3 Creating a booking — no client-trusted money or time

`booking-create` Edge Function:

1. Validate the request (teacher, slot, single vs package, currency).
2. `SELECT … FOR UPDATE` on the teacher row + a `pg_advisory_xact_lock` on
   `hashtext(teacher_id || starts_at)` — makes double-booking impossible under concurrency.
3. Re-expand availability server-side and assert the requested slot is genuinely open.
4. Price the lesson from the teacher's current rate or from a package the learner already
   owns (decrementing `package_purchases.lessons_used`).
5. Compute `commission_bps` and `teacher_earnings_cents` via core.
6. Insert `bookings` with `status='pending_payment'` and a short reservation TTL.
7. Create a Stripe PaymentIntent with `application_fee_amount` + `transfer_data.destination`.
8. Return the client secret. **Only the webhook** flips the booking to `confirmed`.

An unpaid booking past its TTL is released by a scheduled job, so a dropped checkout does
not hold a teacher's slot.

## 11.4 Lifecycle

```
pending_payment ─paid─▶ confirmed ─(start)─▶ in_progress ─(end)─▶ completed ─▶ review prompt
        │                    │                                        │
     expired            cancelled_by_learner / cancelled_by_teacher    └─▶ payout after hold
                             │
                        no_show_learner / no_show_teacher ─▶ refund or credit ─▶ disputed
```

Attendance is recorded from the video room's join events, so a no-show claim has evidence
rather than being one party's word.

## 11.5 Cancellation and refunds (§69)

Policy is data, evaluated by `core/pricing/refund.ts`:

```ts
refundOutcome({ hoursBefore, cancelledBy, policy, priceCents })
→ { refundCents, teacherCompensationCents, reason, policyApplied }
```

Default (fully configurable per marketplace, and shown to the learner **before** paying):

| Situation | Learner refund | Teacher |
|---|---|---|
| Learner cancels > 24 h before | 100 % | 0 |
| Learner cancels 12–24 h | 50 % | 50 % of earnings |
| Learner cancels < 12 h | 0 % (policy-dependent) | full earnings |
| Teacher cancels (any time) | 100 % + goodwill credit | 0, reliability metric hit |
| Teacher no-show | 100 % or credit | 0 |
| Learner no-show | 0 % | full earnings |
| Technical failure (both sides) | 100 % | platform-funded goodwill, admin resolved |

Admins can override any outcome from `(admin)/refunds`, which records `resolved_by` and an
audit entry.

## 11.6 The live room (§35)

`video-room` issues a short-lived, single-use token for the booking's room, only to the two
participants, only within the join window. The app talks to a `VideoProvider` interface:

```ts
interface VideoProvider {
  createRoom(booking): Promise<{roomId, expiresAt}>;
  issueToken(roomId, userId, role): Promise<string>;
  Room: React.ComponentType<RoomProps>;   // provider-specific UI adapter
}
```

Swapping Daily for LiveKit/Twilio/Zoom means writing one adapter; no screen changes.
If no provider is configured the room shows an explicit "video provider not configured"
state and offers the chat + notes surface, rather than a fake call.

## 11.7 Reminders

Scheduled notifications at T-24 h, T-1 h and T-10 min, respecting
`notification_preferences` and the recipient's timezone and quiet hours.
