# 10. Teacher Marketplace Architecture

## 10.1 Teacher lifecycle

```
apply ──▶ pending ──▶ under_review ──▶ approved ──▶ (listed, bookable)
                          │                │
                          ├──▶ rejected     └──▶ suspended (unlisted, existing bookings honoured or refunded)
```

`teacher_applications` stores the submitted payload (name, country, languages and claimed
proficiency, experience, education, certificates, specialties, intro text, photo, video,
availability, desired rate). Approval creates the `teachers` row. A teacher becomes
**bookable** only when: `status='approved'` AND payout account onboarded
(`payout_enabled`) AND at least one availability rule exists.

## 10.2 Verification and badges (§84)

Badges are computed from `teacher_verifications`, never stored as a boolean on the
profile:

| Badge | Requires |
|---|---|
| Identity Verified | a `kind='identity'` row with `status='verified'`, unexpired |
| Certification Verified | a `kind='certification'` row verified by an admin with the evidence asset attached |
| Experienced Teacher | `lessons_taught >= threshold` AND `rating_avg >= threshold` (config, not hardcoded) |

`teacherBadges()` in `@lingonest/core/marketplace` is the single implementation used by
the card, the profile and the admin list, so a badge cannot appear in one place and not
another.

## 10.3 Search and ranking

Search is a Postgres function `public.search_teachers(filters jsonb, page)` returning a
ranked page. Filters: language, variant/region, price range, rating floor, availability
window (expanded server-side into the learner's timezone), specialties, native speaker,
certified, experience years, audience (children/adults), exam prep, business, travel.

Ranking blends: relevance to filters, rating (Bayesian-adjusted so a single 5★ does not
outrank 200 reviews at 4.8), response rate, completion rate, availability in the next 7
days, and a small new-teacher boost so supply can bootstrap. The weights live in
`remote_config` so ranking can be tuned without a release.

## 10.4 Teacher ↔ curriculum integration (§33, §82)

This is the product's differentiator, so it is a first-class data path, not a report:

```
teaching/students/[id]
  ├─ estimated level + 9-skill breakdown        ← skill_profiles (+ evidence)
  ├─ weak areas ranked                          ← user_mistakes aggregated by tag
  ├─ vocabulary in review / leeches             ← user_vocabulary
  ├─ recent lessons + accuracy                  ← user_progress, activity_attempts
  ├─ learner goals + daily target               ← user_languages
  └─ SUGGESTED FOCUS  ← core.suggestTeacherFocus(profile, mistakes, dueVocab)
```

The teacher can **assign** work (`booking_assignments`): a specific lesson, a review set,
a vocabulary list, a speaking task, a writing task or a conversation scenario. Assignments
appear on the learner's Home as "From your teacher, Ana", and completion flows back into
the same progress tables — closing the loop between self-study and human instruction.

Access is gated by `app.teacher_can_view_learner()` (an active or recent booking
relationship), so a teacher cannot browse strangers' progress.

## 10.5 Pricing, packages and commission

- Teachers set `hourly_rate_cents` (suggested band $10–$50+, enforced only as a soft
  warning) and may define `lesson_packages` (e.g. 5-pack, 10-pack) with their own
  discount.
- Commission is tiered by lifetime lessons taught and is **configuration**, not code:

```
commission_tiers:  0–10 → 2500 bps · 11–50 → 2000 · 51–150 → 1800 · 151+ → 1500
```

`commissionFor(lessonsTaught, tiers)` in core resolves the rate; the same function runs in
the Edge Function that creates the payment and in the teacher's earnings preview, so the
number the teacher sees before the lesson is the number they get.

## 10.6 Reviews and trust

A review row can only exist for a `completed` booking (enforced by constraint + policy),
one per booking. Reviews are moderated (`status`), and the teacher rating is recomputed by
a trigger. Teachers may reply once. Reports on reviews go to the same moderation queue as
community content.

## 10.7 Minor safety (§65)

If either participant is a minor: direct messaging is restricted to booking-scoped
conversations with content filtering, profile discovery of minors is disabled, teachers
working with minors require an additional verification kind, and guardian email consent is
recorded on the profile. Adult↔minor free messaging is not launched.
