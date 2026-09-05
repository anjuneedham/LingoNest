-- ---------------------------------------------------------------------------
-- Money: plans, subscriptions, payments, payouts, refunds, disputes,
-- commission tiers, promotions and referrals.
--
-- No table stores card data. Amounts are always integer minor units plus an
-- ISO-4217 currency; never floats.
-- ---------------------------------------------------------------------------

create table public.subscription_plans (
  code text primary key,
  name_key text not null,
  description_key text not null,
  tier smallint not null default 0,
  -- {"USD": {"month": 999, "year": 7999}, ...}
  prices jsonb not null default '{}'::jsonb,
  entitlements jsonb not null default '{}'::jsonb,
  trial_days integer not null default 0,
  active boolean not null default true,
  stripe_price_ids jsonb not null default '{}'::jsonb,
  store_product_ids jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_code text not null references public.subscription_plans (code),
  status subscription_status not null default 'none',
  platform billing_platform not null default 'web',
  provider text not null default 'stripe',
  provider_ref text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_ref)
);

create index subscriptions_user_idx on public.subscriptions (user_id, status);

-- Only one entitling subscription per user at a time.
create unique index subscriptions_one_active
  on public.subscriptions (user_id)
  where status in ('active', 'trialing', 'past_due');

create table public.commission_tiers (
  id uuid primary key default gen_random_uuid(),
  min_lessons integer not null check (min_lessons >= 0),
  max_lessons integer check (max_lessons is null or max_lessons >= min_lessons),
  bps integer not null check (bps between 0 and 10000),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  kind payment_kind not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null,
  status payment_status not null default 'requires_payment',
  provider text not null default 'stripe',
  provider_payment_intent text unique,
  provider_charge_id text,
  application_fee_cents integer not null default 0 check (application_fee_cents >= 0),
  teacher_id uuid references public.teachers (user_id) on delete restrict,
  booking_id uuid references public.bookings (id) on delete restrict,
  package_purchase_id uuid references public.package_purchases (id) on delete restrict,
  subscription_id uuid references public.subscriptions (id) on delete restrict,
  -- Raw provider payload retained for reconciliation; never contains card data.
  raw jsonb,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (application_fee_cents <= amount_cents)
);

create index payments_user_idx on public.payments (user_id, created_at desc);
create index payments_teacher_idx on public.payments (teacher_id, created_at desc);
create index payments_booking_idx on public.payments (booking_id);

create table public.teacher_balances (
  teacher_id uuid primary key references public.teachers (user_id) on delete cascade,
  pending_cents bigint not null default 0,
  available_cents bigint not null default 0,
  lifetime_cents bigint not null default 0,
  currency char(3) not null default 'USD',
  updated_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (user_id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency char(3) not null,
  status payout_status not null default 'pending',
  provider text not null default 'stripe',
  provider_transfer_id text unique,
  period_start date,
  period_end date,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payouts_teacher_idx on public.payouts (teacher_id, created_at desc);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  booking_id uuid references public.bookings (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency char(3) not null,
  reason text not null,
  -- Which rule fired, so a dispute review can see the reasoning.
  policy_applied text not null,
  teacher_payout_cents integer not null default 0,
  learner_credit_cents integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  provider_refund_id text,
  resolved_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete restrict,
  payment_id uuid references public.payments (id) on delete restrict,
  opened_by uuid references public.profiles (id),
  reason text not null,
  state moderation_state not null default 'open',
  resolution text,
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  provider_dispute_id text,
  created_at timestamptz not null default now()
);

create table public.learner_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency char(3) not null,
  remaining_cents integer not null check (remaining_cents >= 0),
  reason text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  kind text not null check (kind in ('percent_off', 'amount_off', 'free_trial_days')),
  value integer not null,
  applies_to text not null check (applies_to in ('subscription', 'booking', 'package', 'any')),
  max_redemptions integer,
  redemptions integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referee_id uuid references public.profiles (id) on delete set null,
  code text not null,
  state text not null default 'created' check (state in ('created', 'signed_up', 'qualified', 'rewarded', 'rejected')),
  reward jsonb not null default '{}'::jsonb,
  fraud_flags text[] not null default '{}',
  qualified_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (referrer_id, referee_id)
);

create index referrals_code_idx on public.referrals (code);

create table public.remote_config (
  key text primary key,
  value jsonb not null,
  -- Public keys are readable by any authenticated client; the rest are admin-only.
  is_public boolean not null default false,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  rules jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create trigger payments_touch before update on public.payments for each row execute function app.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions for each row execute function app.touch_updated_at();
create trigger payouts_touch before update on public.payouts for each row execute function app.touch_updated_at();
create trigger teacher_balances_touch before update on public.teacher_balances for each row execute function app.touch_updated_at();

comment on table public.payments is
  'Payment state is advanced only by signature-verified webhooks or audited admin action. The client never asserts it.';
