# 16. MVP Roadmap

## Phase map (§92) → what "done" means

| Phase | Scope | Done when |
|---|---|---|
| 1. Architecture | docs, monorepo, core package skeleton, CI | `npm run typecheck && npm test` green |
| 2. Authentication | sign-up/in, verification, roles, secure token storage | a new account reaches Home with RLS enforced |
| 3. Onboarding | language, variant, reason, goal, notifications | `user_languages` + `profiles` populated |
| 4. Language system | languages, variants, content seeding | Spanish/English/French/Japanese seeded from content package |
| 5. CEFR progression | levels, courses, units, level readiness | Learn tree renders the real ladder with lock reasons |
| 6. Lesson engine | 26 activity types, stage machine, hints, correction | a learner can complete Spanish A1 U1 L1–L5 end to end |
| 7. Vocabulary + SRS | catalogue, review queue, scheduler | due counts drive Home and Practice |
| 8. Progress | attempts → evidence → skill profiles → mastery | nine-skill breakdown backed by evidence rows |
| 9. AI practice | conversation, evaluation, coach | roleplay at level with structured feedback; limits enforced |
| 10. Marketplace | teacher profiles, application, verification, search | approved teacher discoverable with real badges |
| 11. Booking | availability, slots, timezone, lifecycle | double-booking impossible under concurrency test |
| 12. Payments | subscriptions, marketplace charges, commission, refunds, payouts | webhook-driven state only; refund policy applied by core |
| 13. Teacher dashboard | schedule, students, earnings, assignments | teacher sees a real learner skill breakdown and assigns work |
| 14. Messaging | conversations, moderation, notifications | booking-scoped chat with report/block |
| 15. Admin CMS | content tree, activity builder, workflow, config | a non-engineer publishes a lesson with live preview |
| 16. Analytics | typed events, ingest, views, dashboard | DAU/retention/GMV visible to admin |
| 17. Testing | core suites, content validation, flows | CI enforces; edge cases covered |
| 18. Performance | caching, lazy loading, pagination, media | mid-range Android lesson start < 1 s from cache |
| 19. Production | store builds, monitoring, runbooks | signed builds + rollback plan |

## MVP scope (§93) — in and out

**In:** auth · onboarding · language selection · adaptive placement · CEFR progression ·
interactive lessons across all six skills · vocabulary + SRS · grammar · reading ·
listening · speaking · writing · progress + streaks · AI conversation · teacher profiles ·
teacher applications · teacher search · availability · booking · payments · subscriptions ·
reviews · notifications · admin content management.

**Deliberately out of MVP:** C2 depth for all four languages (architected, content added
progressively) · community groups beyond a read-only feed · offline downloads beyond
lesson text + vocabulary · leaderboards · web learner app (web build serves admin only).

## Sequencing rationale

The marketplace is worthless without learners who have a *reason* to book, so phases 4–9
(a curriculum a learner can actually progress through, and evidence of their weaknesses)
come before 10–13. The teacher-facing differentiator — a tutor who can see exactly which
grammar point a learner keeps failing — only exists once the progress data is real.

## Launch content targets

| Language | At MVP |
|---|---|
| Spanish | Pre-A1 complete, A1 complete (10 units × 5 lessons), A2 units 1–5 |
| English | Pre-A1 complete, A1 units 1–5 |
| French | Pre-A1 complete, A1 units 1–4 |
| Japanese | Pre-A1 complete (kana + sounds), A1 units 1–4 |

Then B1/B2/C1 depth per language on a rolling schedule, with C2 last. Every unit ships
only after passing the content validator and human review.

## Key risks and mitigations

| Risk | Mitigation |
|---|---|
| Content depth is the real cost | Typed DSL + CMS + AI drafting with mandatory human review; validator prevents thin lessons from publishing |
| AI cost per active learner | Per-plan limits enforced server-side, token accounting per session, cheaper model tier for evaluation vs conversation |
| Marketplace cold start | Launch with 5 languages of teacher supply, new-teacher ranking boost, tutor discounts for Premium Plus |
| Store IAP rules | Subscriptions via IAP on native, marketplace via Stripe (real-world services); entitlement unified server-side |
| Pronunciation feedback overclaiming | Framed as guidance in copy and in the rubric; no clinical claims |
| CEFR overclaiming | "Estimated level" language enforced through i18n keys and a lint rule |
