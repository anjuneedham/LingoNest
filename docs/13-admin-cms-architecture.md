# 13. Admin CMS Architecture

## 13.1 Surface

The CMS is the `(admin)` route group in the same Expo app, primarily used on web
(`expo start --web` / static export behind auth). Access requires the `admin` or
`content_editor` role; the router group is stripped for other roles and every table is
independently protected by RLS, so a leaked URL grants nothing.

## 13.2 Content workflow (§46, §47)

```
draft ──▶ in_review ──▶ approved ──▶ published ──▶ archived
   ▲          │             │
   └──────────┴─────────────┘  (send back with notes)
```

- Learners can only ever read `published` rows (RLS predicate, not a client filter).
- Transitions are recorded in `content_approvals` (entity, from, to, actor, notes, at).
- AI-generated content cannot reach `published` without a human approval row — enforced by
  a database trigger (see doc 9).
- Publishing a lesson runs the same validator as the content package: objective, CEFR,
  skill, answer key, explanation, difficulty and estimated duration must all be present,
  and multiple-choice options must be mutually exclusive (§87).

## 13.3 The activity builder (§85)

No coding required. The editor:

1. picks an activity type from the registry (which supplies the schema);
2. gets a form generated from that type's Zod schema — prompt, options/tokens/pairs,
   correct answer, acceptable answers, distractors, hints (ordered 1–5), explanation,
   audio and image pickers (which enforce the licence fields), CEFR, skill, difficulty,
   points, time limit;
3. sees a **live preview rendered by the real player component**, so what the author checks
   is exactly what the learner will get;
4. runs "Validate lesson", which reports ambiguity, missing answer keys, unreachable
   hints, CEFR drift and orphaned vocabulary references.

Bulk import accepts the same JSON the content package emits, so hand-authored curriculum
and CMS-authored curriculum are interchangeable.

## 13.4 Operational sections

| Section | Capabilities |
|---|---|
| Dashboard | DAU/WAU/MAU, retention, lesson completions, conversion, GMV, revenue, churn |
| Users | search, view, roles, suspend, erase (GDPR), impersonate-for-support (audited) |
| Teachers | list, verification queue, badges, suspend, commission tier override |
| Applications | review queue with evidence viewer, approve/reject with notes |
| Bookings | search, force-complete, mark no-show, resolve disputes |
| Payments / Subscriptions / Refunds / Payouts | inspect, refund, retry payout, reconcile |
| Moderation | reports queue, actions (warn/mute/suspend/remove), appeal log |
| Promotions / Referrals | create codes, caps, fraud review |
| Config | prices, commission tiers, AI limits, refund policy, ranking weights, feature flags |

Every mutating admin action writes an `audit.audit_log` row `{actor, action, entity,
before, after, ip, at}`. Admin sessions require a recent re-authentication for
money-moving actions.

## 13.5 Remote configuration

`remote_config(key, value jsonb, updated_by, updated_at)` + `feature_flags(key, rules)`.
The client fetches a signed config bundle on launch and caches it; `core/config` validates
it against a Zod schema and falls back to compiled defaults if the payload is invalid, so a
bad config edit degrades to defaults instead of breaking the app.
