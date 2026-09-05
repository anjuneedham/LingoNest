# 15. Security Architecture

## 15.1 Authentication

Supabase Auth: email+password with verification, magic link, Apple and Google sign-in.
Tokens are stored with `expo-secure-store` (Keychain / Keystore), never in AsyncStorage.
Refresh is handled by the Supabase client; sign-out revokes the refresh token.
Re-authentication is required for: changing email/password, payout account changes and
admin money-moving actions.

## 15.2 Authorisation

Two enforcement points, both mandatory:

1. **RLS on every table.** `alter table … enable row level security` is asserted by a
   migration test that fails if any table in `public` lacks a policy.
2. **Server-side checks in Edge Functions** for anything RLS cannot express (plan limits,
   pricing, slot availability, webhook state transitions).

Representative policies:

| Table | Read | Write |
|---|---|---|
| `lessons`, `lesson_activities` | `status='published'` for any authenticated user; any status for `content_editor`/`admin` | editors/admins only |
| `activity_attempts` | own rows; teacher via `app.teacher_can_view_learner()` | own rows only, insert-only |
| `skill_profiles` | own; teacher with an active booking relationship; admin | service role only (written by functions) |
| `bookings` | participant or admin | learner may create via function; status changes are function/webhook only |
| `payments`, `payouts`, `refunds` | own (learner/teacher) or admin | service role only |
| `messages` | conversation participants who have not been blocked | participants; edit window then immutable |
| `teachers` | public for `approved`; own; admin | own limited fields; status by admin only |
| `remote_config` | authenticated read of the public subset | admin only |
| `audit.audit_log` | admin only | trigger/service only, no update or delete |

## 15.3 Secrets

- Client bundle contains only `EXPO_PUBLIC_*` values (Supabase URL, anon key, Stripe
  publishable key). The anon key is safe precisely because RLS is comprehensive.
- `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `SUPABASE_SERVICE_ROLE_KEY`, video and TTS keys exist **only** as Edge Function secrets.
- CI includes a secret-scan step and a grep guard that fails the build if a non-public key
  pattern appears under `apps/`.

## 15.4 Input validation

Every Edge Function parses its body with Zod before touching the database; every content
write validates against the activity schema registry; Postgres has check constraints as
the last line (ratings 1–5, non-negative money, valid enum values, `starts_at` in the
future on insert).

## 15.5 Rate limiting and abuse

Per-user and per-IP token buckets in the shared Edge middleware, tighter on `ai-*`,
`auth`-adjacent and `booking-create`. Referral rewards require qualification activity.
Community posting has velocity limits and new-account restrictions. Reports feed a
moderation queue with `blocks`/`mutes` honoured at query time.

## 15.6 Payments

Webhook signature verification is mandatory and unskippable; unverified webhooks are
rejected with 400 and logged. Payment state is never accepted from the client. Amounts are
recomputed server-side from database rows on every charge. Idempotency keys on every
Stripe call prevent double-charging on retry.

## 15.7 Data protection and privacy

TLS everywhere; Postgres encryption at rest via the platform. Minimal collection: no
precise location, no contacts, no advertising identifiers. Learner audio is processed for
evaluation and discarded unless the learner opts into keeping recordings. Storage buckets
are private with short-lived signed URLs; teacher documents live in a bucket only admins
and the owner can read. `app.erase_user()` implements deletion, and an export function
implements portability.

## 15.8 Minors

Date of birth collected at signup; `is_minor` derived by trigger. For minors: guardian
email consent recorded, community and DM restrictions, no public profile discovery, no
adult↔minor free messaging, stricter content filtering, and teacher accounts serving
minors require an additional verification. Age-gating decisions are server-side.

## 15.9 Auditing and monitoring

`audit.audit_log` captures every privileged action. Structured logs from Edge Functions
(no PII, no secrets). Alerting on: webhook signature failures, payout errors, AI error
rate, RLS-denied spikes, and auth anomalies.
