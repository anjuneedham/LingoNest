# 1. System Architecture

## 1.1 Guiding constraints

| Constraint | Consequence in the architecture |
|---|---|
| Brand name is provisional | Every user-visible brand string resolves from `packages/core/src/brand/brand.config.ts` + i18n interpolation. No component hardcodes "LingoNest". |
| Content must not live in code | Curriculum is data (`packages/content` → seeded into Postgres → served by API → cached on device). Components render *activity types*, never specific lessons. |
| Adding a language must not need app code | A language is rows in `languages`, `language_variants`, `courses`, `units`, `lessons`, `lesson_activities`, `vocabulary_items`. The renderer is generic. |
| Secrets stay server-side | AI, Stripe and video-provider credentials only exist as Supabase Edge Function secrets. The client calls Edge Functions, never a third-party API directly. |
| Business logic must be testable without a device | All scoring, SRS, CEFR, pricing, commission and refund logic lives in `packages/core` — pure TypeScript, no React Native imports, unit-tested with Vitest. |
| No fake features | Where an external provider is required (payments, AI, video, TTS) we ship the *integration*, the interface, and the env-var contract. If the key is absent the feature reports "not configured" rather than pretending to work. |

## 1.2 Layer diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  CLIENT — apps/mobile (Expo / React Native / TypeScript)             │
│                                                                      │
│  screens (app/)  ──uses──▶  features/*  ──uses──▶  @lingonest/core   │
│      │                          │                    (pure logic)    │
│      │                          ▼                                    │
│      └───────────────▶  services/*  (supabase, api, audio, speech,   │
│                          storage, analytics, payments, video)        │
│                                   │                                  │
│                     store/* (zustand)  +  react-query cache          │
└───────────────────────────────────┼──────────────────────────────────┘
                                    │ HTTPS (JWT, RLS-enforced)
┌───────────────────────────────────▼──────────────────────────────────┐
│  BACKEND — Supabase                                                  │
│                                                                      │
│  PostgREST/GraphQL over Postgres   Realtime      Storage             │
│  Row Level Security on every table (messages,    (avatars, lesson    │
│  Postgres functions for            bookings)      audio, teacher     │
│  transactional writes                             intro videos)      │
│                                                                      │
│  Edge Functions (Deno) — the only place secrets exist:               │
│   ai-conversation · ai-evaluate · ai-coach · ai-content-assistant    │
│   stripe-checkout · stripe-webhook · stripe-connect · payouts        │
│   booking-create · booking-cancel · refund-process                   │
│   video-room · placement-score · analytics-ingest                    │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │ server-to-server, keys never leave
        ┌───────────────┬───────────┴──────────┬─────────────────┐
        ▼               ▼                      ▼                 ▼
   Anthropic API    Stripe (+Connect)     Video provider     TTS provider
   (AI tutor,       (subscriptions,       (Daily/LiveKit —   (lesson audio,
    evaluation)      marketplace,          swappable via      build-time
                     payouts)              VideoProvider)     pipeline)
```

## 1.3 Why these choices

**Expo + React Native + TypeScript.** One codebase for iOS/Android, plus a web target we reuse for the Admin CMS (`app/(admin)`), so admins do not need a second deployment. Expo Router gives file-based routing with typed routes and deep links, which the notification and share-card flows depend on.

**Supabase/Postgres.** The domain is deeply relational (learners → skills → attempts → mastery; teachers → availability → bookings → payments → payouts). Row Level Security lets us express "a teacher may read a student's skill profile only while an active booking relationship exists" as a database policy instead of trusting the client. Edge Functions give us a server-side surface without operating a separate service.

**Pure-TypeScript domain core.** Scoring a `fill_blank` answer, scheduling an SRS review, deciding whether a learner is "ready for A2", computing a 20 % marketplace commission and a partial refund are all decisions that must behave identically on device, in Edge Functions and in tests. They live in `@lingonest/core`, which imports nothing platform-specific and is consumed by both the app and the Deno functions.

**Content as data with a typed authoring DSL.** Authors write lessons in `packages/content` using typed builders (`mcq()`, `speak()`, `roleplay()`…). A build step emits validated JSON; a seed script upserts it into Postgres. The CMS edits the same rows. Code never contains a Spanish sentence.

## 1.4 Request paths that matter

**Completing an activity (offline-tolerant):**
```
Activity UI ──▶ evaluateAnswer() [core, deterministic]
   ├─ deterministic verdict ──▶ queue attempt locally ──▶ sync to activity_attempts
   └─ needs semantic judgement (free writing / speech) ──▶ Edge fn ai-evaluate
                                                   ──▶ verdict + rubric feedback
Then: applySrsResult() updates user_vocabulary; recomputeSkillEvidence() appends
evidence rows; progress recalculated server-side by a Postgres function.
```

**Booking a lesson (money never trusted from the client):**
```
Client picks slot ──▶ Edge fn booking-create
   ├─ re-derives the slot from teacher_availability in the teacher's tz
   ├─ takes an advisory lock on (teacher_id, starts_at) to prevent double-booking
   ├─ prices the lesson server-side from the teacher's current rate/package
   ├─ computes commission via core.commissionFor(lessonsTaught, tiers)
   └─ creates a Stripe PaymentIntent with application_fee + transfer_data
Stripe webhook (signature-verified) is the only thing that marks a booking paid.
```

## 1.5 Failure and degradation policy

- **AI unavailable** → conversation and AI evaluation surface a retry state; deterministic activities keep working; the lesson can still be completed with the non-AI activity set.
- **Offline** → downloaded lessons run from the local content cache; attempts queue in SQLite/AsyncStorage and sync with conflict resolution by `client_attempt_id` (idempotent upsert).
- **Payments unconfigured** → marketplace browse/apply still works; booking is blocked with an explicit "payments not configured" state rather than a fake success.
