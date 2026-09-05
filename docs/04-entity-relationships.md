# 4. Entity Relationships

## 4.1 Learning domain

```
                       ┌──────────────┐
                       │  languages   │
                       └──────┬───────┘
              ┌───────────────┼───────────────────────┐
              ▼               ▼                       ▼
    ┌──────────────────┐ ┌─────────┐        ┌───────────────────┐
    │ language_variants│ │ levels  │        │ vocabulary_items  │
    └──────────────────┘ └────┬────┘        └─────────┬─────────┘
                              ▼                       │
                       ┌────────────┐                 │
                       │  courses   │                 │
                       └─────┬──────┘                 │
                             ▼                        │
                       ┌────────────┐                 │
                       │   units    │                 │
                       └─────┬──────┘                 │
                             ▼                        │
                       ┌────────────┐   N:M           │
                       │  lessons   │◀────────────────┘  (lesson_vocabulary)
                       └─────┬──────┘   N:M ──▶ grammar_topics (lesson_grammar)
                             ▼
                    ┌──────────────────┐
                    │ lesson_activities│──▶ media_assets (audio/image + licence)
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
   users ──────────▶│ activity_attempts│
                    └────────┬─────────┘
                             │ feeds
        ┌────────────────────┼────────────────────┬──────────────┐
        ▼                    ▼                    ▼              ▼
 user_progress        skill_evidence        user_vocabulary  user_mistakes
        │                    ▼                    │              │
        │              skill_profiles             │              │
        └──────────────┬─────┴────────────────────┴──────────────┘
                       ▼
                level_readiness ──▶ "Ready for A2" recommendation (never certification)
```

**Cardinalities**
- `languages 1:N levels 1:N courses 1:N units 1:N lessons 1:N lesson_activities`
- `lessons N:M vocabulary_items` via `lesson_vocabulary`
- `lessons N:M grammar_topics` via `lesson_grammar`
- `users 1:N user_languages N:1 languages` (a learner may study several languages)
- `users 1:1 skill_profiles per language` (`unique(user_id, language_id)`)
- `skill_profiles 1:N skill_evidence` (append-only)
- `users N:M vocabulary_items` via `user_vocabulary` (carries the SRS state)

## 4.2 Marketplace domain

```
      users ──1:1──▶ teachers ──1:N──▶ teacher_verifications
        │                │  │
        │                │  ├─1:N──▶ teacher_availability (+ _exceptions)
        │                │  ├─1:N──▶ lesson_packages ──1:N──▶ package_purchases
        │                │  └─1:1──▶ teacher_balances ──1:N──▶ payouts
        │                │
        │                ▼
        └────1:N────▶ bookings ──1:1──▶ payments ──0:N──▶ refunds
                         │  │                └──▶ disputes
                         │  ├─1:1──▶ reviews  (only after status='completed')
                         │  ├─1:N──▶ booking_assignments  (teacher → learner homework)
                         │  └─1:1──▶ video room (provider-issued, stored by id only)
                         ▼
                    conversations ──1:N──▶ messages
```

**The teacher↔curriculum link (§33).** A teacher never gets blanket access to a learner.
`app.teacher_can_view_learner(teacher_uid, learner_uid)` returns true only when a booking
exists between them that is `confirmed`/`in_progress`/`completed` within the retention
window. Every policy on `skill_profiles`, `user_progress`, `user_mistakes` and
`user_vocabulary` consults that function. So the teacher dashboard's "suggested focus"
is a real join across the learner's `user_mistakes` + `skill_profiles`, scoped by a
relationship the database can prove.

## 4.3 Money flow

```
learner ──pays──▶ Stripe PaymentIntent (created server-side)
                        │  application_fee_amount = price × commission_bps
                        ▼
              payments row (status advanced ONLY by verified webhook)
                        │
        ┌───────────────┴────────────────┐
        ▼                                ▼
 platform revenue                teacher_balances.pending_cents
                                         │ after booking completes + hold period
                                         ▼
                                   available_cents ──▶ payouts (Stripe transfer)
```

Refunds walk backwards through the same rows: `refunds` references `payments`, reverses
the balance movement if the payout has not been executed, and records
`policy_applied` so a dispute review can see which rule fired.

## 4.4 Referential integrity choices

| Relationship | On delete | Why |
|---|---|---|
| `activity_attempts → lesson_activities` | `set null` (keeps `lesson_id`) | Deleting a CMS activity must not erase a learner's history. |
| `bookings → teachers` | `restrict` | A teacher with bookings cannot be deleted; they are suspended. |
| `payments → bookings` | `restrict` | Financial records are immutable. |
| `user_vocabulary → vocabulary_items` | `cascade` | Word removed from the catalogue ⇒ review row is meaningless. |
| `messages → conversations` | `cascade` | |
| `profiles → auth.users` | `cascade` | Account deletion path. |
