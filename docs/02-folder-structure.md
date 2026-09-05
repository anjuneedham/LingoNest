# 2. Folder Structure

```
lingonest/
├── docs/                          # this architecture set
├── packages/
│   ├── core/                      # @lingonest/core — pure TS domain logic (no RN, no DOM)
│   │   ├── src/
│   │   │   ├── brand/             # brand.config.ts — the ONLY place the product name lives
│   │   │   ├── types/             # shared domain + database types
│   │   │   ├── cefr/              # levels, plus-levels, can-do descriptors, ordering
│   │   │   ├── skills/            # per-skill profiles, evidence, level estimation
│   │   │   ├── activities/        # activity type registry + schemas
│   │   │   ├── evaluation/        # deterministic answer grading + normalisation
│   │   │   ├── srs/               # spaced repetition scheduler
│   │   │   ├── progress/          # mastery, level readiness, XP, streaks, goals
│   │   │   ├── adaptive/          # weakness detection + recommendation engine
│   │   │   ├── pricing/           # plans, currency, commission tiers, refunds, packages
│   │   │   ├── booking/           # availability expansion, timezone, slot conflicts
│   │   │   ├── analytics/         # typed event names + payload schemas
│   │   │   ├── config/            # remote config schema + defaults
│   │   │   └── utils/
│   │   └── test/                  # Vitest suites
│   └── content/                   # @lingonest/content — curriculum as data
│       ├── src/
│       │   ├── dsl/               # typed authoring builders + validator
│       │   ├── languages/         # language + variant definitions
│       │   ├── curricula/
│       │   │   ├── es/            # Spanish: pre-a1, a1 (10 units), a2 …
│       │   │   ├── en/            # English
│       │   │   ├── fr/            # French
│       │   │   └── ja/            # Japanese
│       │   └── index.ts
│       └── scripts/build.ts       # emits validated JSON bundles for seeding/offline
├── apps/
│   └── mobile/                    # @lingonest/mobile — Expo app (iOS, Android, web-admin)
│       ├── app/                   # Expo Router routes (file-based)
│       │   ├── (auth)/            # sign-in, sign-up, reset, verify
│       │   ├── (onboarding)/      # goals, language, variant, placement
│       │   ├── (tabs)/            # home, learn, practice, teachers, profile
│       │   ├── lesson/[id]/       # lesson player
│       │   ├── practice/          # ai conversation, review, speaking, writing…
│       │   ├── teacher/           # public profile, booking flow
│       │   ├── teaching/          # teacher-side dashboard, students, earnings
│       │   ├── room/[bookingId]/  # live lesson room
│       │   ├── community/
│       │   └── (admin)/           # CMS — web target, role-gated
│       ├── src/
│       │   ├── components/        # design-system primitives (Button, Card, …)
│       │   ├── features/          # feature modules: lesson, vocab, ai, marketplace…
│       │   │   └── lesson/activities/  # one renderer per activity type
│       │   ├── services/          # supabase, api clients, audio, speech, payments…
│       │   ├── hooks/
│       │   ├── store/             # zustand slices
│       │   ├── theme/             # tokens, typography, dark mode, a11y sizes
│       │   ├── i18n/              # i18next setup
│       │   └── utils/
│       ├── locales/               # en.json (+ scaffolding for es, fr, pt, de, ja, ko, zh)
│       └── assets/
├── supabase/
│   ├── migrations/                # ordered SQL: schema → RLS → functions → seed data
│   ├── functions/                 # Deno Edge Functions (all secrets live here)
│   │   ├── _shared/               # auth, cors, config, anthropic + stripe clients
│   │   ├── ai-conversation/  ai-evaluate/  ai-coach/  ai-content-assistant/
│   │   ├── stripe-checkout/  stripe-webhook/  stripe-connect/  payouts-run/
│   │   ├── booking-create/   booking-cancel/  refund-process/
│   │   └── video-room/  placement-score/  analytics-ingest/
│   └── seed/                      # generated content bundles + demo fixtures
├── scripts/                       # seeding + tooling
└── .github/workflows/ci.yml
```

## Rules the structure enforces

1. `packages/core` may not import from `apps/` or from React/React Native. CI typechecks it in a Node-only project.
2. `apps/mobile/src/features/**` may import `@lingonest/core` and `services/**`; `services/**` may not import features (one-way dependency).
3. Anything under `app/` is routing + composition only. Screens delegate to a feature module.
4. No file under `apps/` contains curriculum strings in a target language. Content comes from the API/content bundle.
5. No file outside `supabase/functions/**` reads a secret key.
