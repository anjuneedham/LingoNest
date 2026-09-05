# 14. Analytics Architecture

## 14.1 Event contract

Event names and payloads are typed once in `@lingonest/core/analytics`:

```ts
export type AnalyticsEvent =
  | { name: 'signup_completed';      props: { method: AuthMethod } }
  | { name: 'onboarding_completed';  props: { languageCode: string; variantCode?: string } }
  | { name: 'language_selected';     props: { languageCode: string } }
  | { name: 'placement_started';     props: { languageCode: string } }
  | { name: 'placement_completed';   props: { languageCode: string; estimatedCefr: Cefr; itemCount: number } }
  | { name: 'lesson_started';        props: { lessonId: string; cefr: Cefr; unitId: string } }
  | { name: 'lesson_completed';      props: { lessonId: string; accuracy: number; durationMs: number; xp: number } }
  | { name: 'activity_completed';    props: { activityType: ActivityType; skill: Skill; correct: boolean; hintsUsed: number; responseMs: number } }
  | { name: 'level_completed';       props: { languageCode: string; cefr: Cefr } }
  | { name: 'ai_practice_started' | 'ai_practice_completed'; props: { kind: AiKind; cefr: Cefr; turns?: number } }
  | { name: 'teacher_search';        props: { filters: string[]; resultCount: number } }
  | { name: 'teacher_view';          props: { teacherId: string; source: 'search' | 'recommended' | 'deeplink' } }
  | { name: 'booking_started' | 'booking_completed'; props: { teacherId: string; priceCents: number; currency: Currency; isPackage: boolean } }
  | { name: 'lesson_attended';       props: { bookingId: string; minutes: number } }
  | { name: 'subscription_started' | 'subscription_cancelled'; props: { plan: PlanCode; interval: 'month' | 'year'; platform: Platform } }
  | { name: 'review_submitted';      props: { rating: number } }
  | { name: 'referral_created' | 'referral_converted'; props: { code: string } };
```

`track()` accepts only this union, so a typo is a compile error and the schema of every
event is documented by its type. No free-form `Record<string, any>` events.

## 14.2 Pipeline

```
app  ──track()──▶ buffer (batched, offline-safe, capped)
                     │
                     ▼  POST /functions/v1/analytics-ingest  (JWT)
             validate against the event schema
                     │
                     ▼
       analytics.events(user_id, name, props jsonb, ts, session_id, app_version, platform)
                     │
      ┌──────────────┴───────────────┐
      ▼                              ▼
 materialised views             optional export to a warehouse
 (DAU/WAU/MAU, retention,       (Segment/BigQuery via ANALYTICS_WRITE_KEY;
  funnels, GMV, churn)           the app never talks to a vendor directly)
```

## 14.3 Metrics defined precisely

| Metric | Definition |
|---|---|
| DAU / WAU / MAU | distinct `user_id` with ≥1 event in the trailing 1 / 7 / 30 days |
| D1 / D7 / D30 retention | cohort by signup date; returned on day *n* (event of any kind) |
| **Meaningful learning session** (primary retention metric, §71) | ≥5 minutes of activity *and* ≥8 scored activity attempts, or a completed lesson, or a ≥6-turn AI conversation, or an attended tutor lesson |
| Lesson completion rate | `lesson_completed / lesson_started` per level |
| Subscription conversion | subscribers / activated learners (activated = completed ≥1 lesson) |
| Tutor booking rate | learners with ≥1 completed booking / MAU |
| Repeat booking rate | learners with ≥2 completed bookings / learners with ≥1 |
| GMV | sum of marketplace `payments.amount_cents` (succeeded) |
| Platform revenue | subscription revenue + sum of `application_fee_cents` |
| Churn | subscriptions ending without renewal in the period / active at period start |

Views live in the `analytics` schema; the admin dashboard reads them through a
`SECURITY DEFINER` function restricted to admins.

## 14.4 Privacy posture (§70, §64)

- No lesson text, message bodies, essay content or audio in analytics payloads.
- No email, phone, precise location or device identifiers in `props`.
- `user_id` is the internal uuid; events are deletable via `app.erase_user()`.
- Analytics consent is a profile setting; when off, only aggregate counters are kept.
