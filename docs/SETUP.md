# Setup

## Prerequisites

- Node 20+
- npm 10+
- Supabase CLI (`npm i -g supabase`) for local DB + Edge Functions
- Expo Go (device) or an iOS/Android simulator
- Deno (installed by the Supabase CLI) for Edge Functions

## 1. Install

```bash
npm install
cp .env.example .env          # fill in as you provision services
```

## 2. Database

```bash
supabase start                       # local Postgres + auth + storage
supabase db reset                    # applies supabase/migrations in order
npm run content:build                # validates and emits content bundles
npm run db:seed                      # upserts languages + curriculum into Postgres
```

Against a hosted project instead:

```bash
supabase link --project-ref <ref>
supabase db push
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run db:seed
```

## 3. Edge Function secrets

Never put these in `.env` files that ship with the app.

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-…
supabase secrets set ANTHROPIC_MODEL=claude-sonnet-5
supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_…
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_…
supabase secrets set VIDEO_PROVIDER=daily DAILY_API_KEY=…
supabase functions deploy
```

Stripe webhook endpoint: `https://<ref>.functions.supabase.co/stripe-webhook`
Subscribe to: `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.payment_failed`,
`payment_intent.succeeded`, `payment_intent.payment_failed`,
`charge.dispute.created`, `account.updated`.

## 4. Mobile app

```bash
cd apps/mobile
cp ../../.env.example .env      # only EXPO_PUBLIC_* values are read by the app
npx expo start
```

Admin CMS (web target): `npx expo start --web` → sign in with an account that has the
`admin` role (`insert into user_roles (user_id, role) values ('<uuid>', 'admin')`).

## 5. What works without third-party keys

| Feature | Without keys |
|---|---|
| Auth, onboarding, placement | works (local Supabase) |
| Lessons, activities, SRS, progress | works fully — grading is deterministic |
| AI conversation / evaluation / coach | returns `ai_not_configured`; the UI says so |
| Subscriptions & booking payments | returns `payments_not_configured`; booking is blocked |
| Live video room | returns `video_not_configured`; chat + notes still available |

Nothing is simulated. A feature either runs against the real provider or reports that it
is unconfigured.

## 6. Useful commands

```bash
npm run typecheck        # all workspaces
npm test                 # core + content suites
npm run content:validate # curriculum semantic checks
npm run lint
```

## 7. Renaming the brand

Edit `packages/core/src/brand/brand.config.ts` (name, legal name, domain, support email,
deep-link scheme, tagline key) and the corresponding `brand.*` keys in
`apps/mobile/locales/*.json`. Then update `app.json`'s `slug`/`scheme`. No component,
service or database row hardcodes the product name.
