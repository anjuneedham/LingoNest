# LingoNest

*Learn. Practice. Connect.*

A CEFR-structured language-learning ecosystem: interactive lessons across all six skills,
adaptive placement and spaced repetition, AI conversation practice, and a human teacher
marketplace with live tutoring. "LingoNest" is a working name — see [Renaming the
brand](#renaming-the-brand).

This is not a vocabulary flashcard app. It combines structured courses, deterministic
grading, a nine-skill progress model, and a real marketplace with Stripe Connect payouts —
see [`docs/`](docs/) for the full architecture set (16 documents, `01`–`16`).

## Monorepo layout

```
packages/core/      pure TypeScript domain logic — CEFR, grading, SRS, pricing, booking.
                     No React Native, no DOM. Unit-tested with Vitest.
packages/content/    curriculum as data — a typed authoring DSL, the launch-language
                     curricula, and the validator/build scripts that seed Postgres.
apps/mobile/         the Expo Router app: learner screens, the teacher marketplace, the
                     admin CMS (web target), all built on @lingonest/core and
                     @lingonest/content.
supabase/            Postgres schema (RLS everywhere), transactional SQL functions, and
                     Deno Edge Functions that hold every third-party credential.
docs/                the 16-document architecture set — read this before making a
                     structural change.
scripts/              seeding and migration-verification tooling.
```

See [`docs/02-folder-structure.md`](docs/02-folder-structure.md) for the full tree.

## Quick start

```bash
npm install
npm run typecheck   # all workspaces
npm test            # core + content Vitest suites
npm run lint
npm run content:validate
bash scripts/verify-migrations.sh   # applies every migration to a throwaway Postgres
```

Full provisioning (Supabase project, Edge Function secrets, running the app) is in
[`docs/SETUP.md`](docs/SETUP.md).

## What's real vs. what's config-gated

Nothing in this codebase fakes an integration. Where a feature needs a third-party
provider — AI conversation and grading, Stripe subscriptions and marketplace payments,
live video — the Edge Function returns a specific `*_not_configured` code and the app
renders an honest state, rather than simulating the feature. Provisioning any of them is
just setting the corresponding secret (`docs/SETUP.md` §3); no code changes are required.

## Principles the architecture enforces, not just documents

- **Curriculum is data.** No lesson, activity, or vocabulary item is hardcoded into a
  component — it is a row in Postgres, authored through `packages/content`'s typed DSL,
  and rendered by a generic activity-type registry.
- **Grading is deterministic first.** AI is the fallback for free production (writing,
  speech), never the arbiter for anything with a real answer key, and every AI verdict is
  guarded against marking an empty, off-language, or unrelated answer as correct.
- **A level is nine skills, evidence-weighted, never a five-question quiz.** Placement and
  re-assessment run an adaptive ladder and report a range and a confidence, not a single
  number from a handful of questions.
- **Content review is a database invariant.** AI-drafted curriculum cannot reach
  `published` without a recorded human approval — enforced by a trigger, not a UI
  convention.
- **RLS is the security boundary.** Every table has a row-level security policy (a
  migration-time check fails the build if one is missing); the app's own role checks are
  a convenience for hiding routes, never the actual gate.
- **Secrets never reach the client.** AI, Stripe, and video-provider credentials exist only
  as Supabase Edge Function secrets; the app calls Edge Functions, never a third-party API
  directly, and no payment state is ever trusted from the client — only the Stripe webhook
  writes it.

## Renaming the brand

Edit `packages/core/src/brand/brand.config.ts` and the `brand.*` locale keys in
`apps/mobile/locales/*.json`, then update `app.json`'s `slug`/`scheme`. See
[`docs/SETUP.md` §7](docs/SETUP.md#7-renaming-the-brand).

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs typecheck, lint, the core and
content test suites, curriculum validation, and a full migration-and-schema-assertion pass
against a throwaway Postgres cluster on every push and pull request.
