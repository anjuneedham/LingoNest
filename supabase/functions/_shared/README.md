# Edge Functions

Every third-party credential in this product exists here and nowhere else. The
mobile bundle ships only `EXPO_PUBLIC_*` values (Supabase URL, anon key, Stripe
publishable key); the anon key is safe precisely because the database is covered
by Row Level Security.

## The rules these functions exist to enforce

| Rule | Where |
|---|---|
| The client never asserts payment state | `stripe-webhook` is the only writer of `payments.status` and `subscriptions.status`, and it rejects an unsigned request before reading it |
| The client never sets a price | `booking-create` reads the teacher's rate and computes commission from `commission_tiers` |
| The client never picks a slot the teacher has not offered | `booking-create` re-expands availability server-side before charging |
| The client never grants itself AI usage | `ai-*` check `ai_usage_counters` against the plan's entitlements before calling the model |
| The client never writes the system prompt | `_shared/prompts.ts` assembles it from database rows |
| The AI never marks everything correct | `ai-evaluate` guards the verdict: empty answers, wrong language, no content overlap, unmet rubric requirements |
| AI-drafted curriculum never reaches a learner unreviewed | `ai-content-assistant` writes `status='draft'`; a database trigger blocks publishing without a human approval row |

## Deployment

```bash
supabase functions deploy                       # all functions
supabase functions deploy stripe-webhook --no-verify-jwt   # Stripe has no user JWT
```

`payouts-run` is called on a schedule and authenticates with the service role
key rather than a user token.

## Behaviour without keys

Each function reports a specific, honest state rather than pretending:

- no `ANTHROPIC_API_KEY` → `503 ai_not_configured`
- no `STRIPE_SECRET_KEY` → `503 payments_not_configured`, and booking is blocked
- no video provider → `503 video_not_configured`, and the room falls back to
  chat and shared notes

Nothing is simulated.
