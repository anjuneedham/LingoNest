# 3. Database Schema

Postgres (Supabase). The SQL in `supabase/migrations/` is the source of truth; this
document explains the shape and the decisions behind it.

## 3.1 Schema organisation

| Schema | Purpose |
|---|---|
| `public` | All application tables, exposed through PostgREST under RLS. |
| `app` | Internal helper functions (`app.current_role()`, `app.is_admin()`, …) and triggers. Not exposed. |
| `analytics` | Event table + reporting views (DAU/WAU/MAU, retention, funnel, GMV). |
| `audit` | Append-only audit log written by triggers; readable only by admins. |

## 3.2 Identity and roles

```
auth.users (Supabase-managed)
  └─1:1─ profiles          display_name, avatar, country, timezone, ui_locale,
                           date_of_birth, account_type(adult|teen|child), is_minor,
                           guardian_email, onboarding_state
  └─1:N─ user_roles        role ∈ (learner, teacher, admin, moderator, content_editor)
```

Roles are rows, not a column, so a user can be a learner *and* a teacher. Every RLS
policy calls `app.has_role(uid, 'x')`, which reads a `SECURITY DEFINER` function over
`user_roles`, keeping the check out of the client's hands. `is_minor` is derived from
`date_of_birth` by a trigger and drives the minor-safety policies (§65 of the brief).

## 3.3 Language and curriculum

```
languages(code, name, native_name, script, rtl, has_writing_system_module, status)
   └─ language_variants(language_id, code, label, region, is_default)      es-MX, pt-BR…
   └─ levels(language_id, cefr, plus_level bool, ordinal, can_do jsonb)     Pre-A1…C2, A2+…
        └─ courses(language_id, level_id, slug, title, description, status, ordinal)
             └─ units(course_id, ordinal, title, objective, theme, cefr, status)
                  └─ lessons(unit_id, ordinal, slug, title, objective, skills[],
                             estimated_minutes, cefr, status, is_review, is_checkpoint)
                       └─ lesson_activities(lesson_id, ordinal, type, stage, skill,
                                            difficulty, cefr, prompt jsonb, media jsonb,
                                            correct_answer jsonb, acceptable_answers jsonb,
                                            distractors jsonb, hints jsonb, explanation,
                                            rubric jsonb, points, time_limit_seconds)
```

`status` on every content table is the CMS workflow enum
`draft | in_review | approved | published | archived` (§47). Only `published` rows are
visible to learners — enforced by RLS, not by a client-side filter.

`lesson_activities.prompt/correct_answer/acceptable_answers` are `jsonb` because the 26
activity types have genuinely different shapes; the shape per type is validated by a
Zod schema in `@lingonest/core/activities` on write (CMS + seed) and on read (client).

Supporting content tables: `vocabulary_items`, `vocabulary_categories`,
`vocabulary_item_categories`, `grammar_topics`, `lesson_vocabulary`,
`lesson_grammar`, `culture_notes`, `conversation_scenarios`, `media_assets`
(audio/image with licence + attribution fields so we never ship unlicensed audio).

## 3.4 Learner state

```
user_languages(user_id, language_id, variant_id, is_active, goal, daily_goal_minutes,
               immersion_percent, started_at)

skill_profiles(user_id, language_id,
               overall_level, reading_level, writing_level, listening_level,
               speaking_level, vocabulary_level, grammar_level, pronunciation_level,
               interaction_level, mediation_level, updated_at)
skill_evidence(profile_id, skill, cefr, score, source, source_id, weight, created_at)
```

Two tables on purpose: `skill_profiles` is the fast read for UI; `skill_evidence` is the
append-only justification trail ("why does it say my writing is A2+?"). A level only
moves when `estimateSkillLevel()` in core sees enough recent, weighted evidence — never
from a single quiz.

```
user_progress(user_id, lesson_id, status, best_score, attempts, completed_at)
unit_progress / course_progress (materialised by trigger for cheap list rendering)
activity_attempts(user_id, activity_id, lesson_id, client_attempt_id UNIQUE,
                  answer jsonb, is_correct, score, hints_used, response_ms,
                  evaluation jsonb, created_at)
user_vocabulary(user_id, vocabulary_id, state(new|learning|review|mastered|leech),
                ease, interval_days, repetitions, lapses, due_at, last_reviewed_at,
                correct_count, incorrect_count, avg_response_ms)
user_mistakes(user_id, language_id, skill, tag, activity_id, count, last_seen_at)
streaks(user_id, current, longest, last_active_date, freezes_available)
xp_ledger(user_id, source, amount, created_at)        -- engagement only, never mastery
achievements / user_achievements
daily_goals(user_id, date, target_minutes, minutes_done, lessons_done, met)
```

`client_attempt_id` makes offline sync idempotent: the device generates a UUID per
attempt, so replaying a queued batch cannot double-count.

## 3.5 Assessment

```
assessments(language_id, kind(placement|checkpoint|diagnostic), cefr_from, cefr_to, config)
assessment_items(assessment_id, activity_id | inline jsonb, cefr, skill, discrimination)
assessment_attempts(user_id, assessment_id, state, started_at, finished_at,
                    responses jsonb, per_skill_scores jsonb, estimated_levels jsonb,
                    result_summary jsonb)
level_readiness(user_id, language_id, cefr, criteria jsonb, met bool, evaluated_at)
```

Placement is adaptive: `assessment_attempts.responses` records the ladder the learner
walked (item difficulty + correctness), and `estimatePlacement()` in core returns a
*range* plus per-skill estimates, not a single number from five questions (§30).

## 3.6 AI

```
ai_sessions(user_id, language_id, kind(conversation|coach|evaluation|roleplay),
            scenario_id, cefr, persona, difficulty, status, token_usage, cost_cents)
ai_messages(session_id, role(user|assistant|system), content, audio_asset_id,
            evaluation jsonb, created_at)
ai_usage_counters(user_id, period_start, kind, count)   -- plan limit enforcement
```

Limits are enforced in the Edge Function against `ai_usage_counters` + the caller's
subscription tier, so a modified client cannot buy unlimited AI.

## 3.7 Teacher marketplace

```
teachers(user_id PK, headline, bio, intro_video_asset, country, timezone,
         teaching_languages jsonb, specialties[], hourly_rate_cents, currency,
         trial_rate_cents, status(pending|under_review|approved|rejected|suspended),
         rating_avg, rating_count, lessons_taught, stripe_account_id, payout_enabled)
teacher_applications(user_id, payload jsonb, status, reviewer_id, review_notes, timestamps)
teacher_verifications(teacher_id, kind(identity|certification|education|language),
                      status, evidence_asset, verified_by, verified_at, expires_at)
teacher_availability(teacher_id, weekday, start_time, end_time, timezone, valid_from, valid_to)
teacher_availability_exceptions(teacher_id, date, kind(block|extra), start_time, end_time)
lesson_packages(teacher_id, name, lesson_count, price_cents, currency, active)
package_purchases(user_id, package_id, lessons_total, lessons_used, expires_at, payment_id)
bookings(learner_id, teacher_id, language_id, starts_at timestamptz, duration_minutes,
         status(pending_payment|confirmed|in_progress|completed|cancelled_by_learner|
                cancelled_by_teacher|no_show_learner|no_show_teacher|disputed),
         price_cents, currency, commission_bps, teacher_earnings_cents,
         package_purchase_id, video_room_id, learner_notes, teacher_notes,
         focus_areas jsonb, cancellation_reason, cancelled_at)
booking_assignments(booking_id, teacher_id, learner_id, kind(lesson|review|vocabulary|
                    speaking|writing|conversation), target_ref, due_at, status)
reviews(booking_id UNIQUE, learner_id, teacher_id, rating, body, status, published_at)
```

`bookings.starts_at` is `timestamptz` (UTC). The teacher's and learner's IANA zones are
stored on their profiles; all rendering converts at the edge. Availability is stored in
the *teacher's* zone with the zone recorded on the row, so a DST change does not silently
move a teacher's working hours.

Verification badges render only from `teacher_verifications` rows with
`status='verified'` and an unexpired `expires_at` (§84 — never invent verification).

## 3.8 Money

```
subscription_plans(code, name, tier, prices jsonb {currency: {month, year}},
                   entitlements jsonb, active)             -- remotely configurable (§37)
subscriptions(user_id, plan_code, tier, status, provider, provider_ref,
              current_period_end, cancel_at_period_end, platform(ios|android|web))
payments(user_id, kind(subscription|booking|package), amount_cents, currency,
         provider, provider_payment_intent, status, application_fee_cents,
         teacher_id, booking_id, package_purchase_id, raw jsonb)
payouts(teacher_id, amount_cents, currency, status, provider_transfer_id, period)
teacher_balances(teacher_id, pending_cents, available_cents, lifetime_cents, currency)
commission_tiers(min_lessons, max_lessons, bps, active)     -- configurable (§38)
refunds(payment_id, amount_cents, reason, policy_applied, status, resolved_by)
disputes(booking_id, opened_by, reason, state, resolution, resolved_by)
promotions / referrals(referrer_id, referee_id, code, status, reward jsonb, fraud_flags)
```

No table stores card data. Stripe holds the instruments; we store provider references.
`payments.status` is only ever advanced by the signature-verified webhook (§63).

## 3.9 Social and system

`conversations`, `conversation_participants`, `messages` (with `flagged`, `redacted`),
`community_groups`, `community_posts`, `community_comments`, `post_reactions`,
`reports`, `moderation_actions`, `blocks`, `mutes`, `notifications`,
`notification_preferences`, `device_tokens`, `remote_config`, `feature_flags`,
`audit.audit_log`, `analytics.events`.

## 3.10 Cross-cutting conventions

- Every table: `id uuid default gen_random_uuid()`, `created_at`, `updated_at` (trigger).
- Soft delete via `deleted_at` where user-recoverable; hard delete for GDPR erasure via
  `app.erase_user(uuid)`.
- Every foreign key indexed. Hot paths additionally indexed:
  `user_vocabulary(user_id, due_at)`, `bookings(teacher_id, starts_at)`,
  `activity_attempts(user_id, created_at desc)`, `messages(conversation_id, created_at)`.
- Money is always `integer` minor units + an ISO-4217 `currency` column. Never floats.
- Enums are Postgres enums where the set is closed and stable; text + check constraint
  where the CMS may extend it.
