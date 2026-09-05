-- ---------------------------------------------------------------------------
-- AI sessions, messaging, community, moderation, notifications, audit.
-- ---------------------------------------------------------------------------

create table public.ai_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  language_id uuid references public.languages (id) on delete set null,
  kind ai_session_kind not null,
  scenario_id uuid references public.conversation_scenarios (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  cefr cefr_level,
  persona text,
  difficulty text,
  goals text[] not null default '{}',
  goals_achieved text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned', 'error')),
  turns integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  -- Micros, not cents: a single AI turn costs a fraction of a cent, and money
  -- stays integer everywhere in this schema.
  cost_micros bigint not null default 0,
  model text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index ai_sessions_user_idx on public.ai_sessions (user_id, started_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  translation text,
  audio_asset_key text,
  evaluation jsonb,
  created_at timestamptz not null default now()
);

create index ai_messages_session_idx on public.ai_messages (session_id, created_at);

-- Plan limits are enforced against this table server-side, so a modified
-- client cannot grant itself unlimited AI practice.
create table public.ai_usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  period_start date not null,
  kind ai_session_kind not null,
  count integer not null default 0,
  unique (user_id, period_start, kind)
);

-- Messaging ------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct', 'booking', 'support')),
  booking_id uuid references public.bookings (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  muted boolean not null default false,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  attachment_path text,
  flagged boolean not null default false,
  redacted boolean not null default false,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.mutes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  muted_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, muted_id)
);

-- Community ------------------------------------------------------------------

create table public.community_groups (
  id uuid primary key default gen_random_uuid(),
  language_id uuid references public.languages (id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text,
  is_public boolean not null default true,
  minors_allowed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.community_groups (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  body text not null,
  kind text not null default 'discussion' check (kind in ('discussion', 'question', 'progress', 'challenge')),
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  reply_count integer not null default 0,
  reaction_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index community_posts_group_idx on public.community_posts (group_id, created_at desc) where status = 'published';

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now()
);

create table public.post_reactions (
  post_id uuid not null references public.community_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'like',
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Moderation -----------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  entity_type text not null check (entity_type in ('user', 'message', 'post', 'comment', 'review', 'teacher')),
  entity_id uuid not null,
  reason text not null,
  detail text,
  state moderation_state not null default 'open',
  created_at timestamptz not null default now()
);

create index reports_queue_idx on public.reports (state, created_at) where state = 'open';

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports (id) on delete set null,
  moderator_id uuid not null references public.profiles (id),
  target_user_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('warn', 'mute', 'suspend', 'remove_content', 'ban', 'dismiss')),
  reason text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Notifications ---------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title_key text not null,
  body_key text not null,
  params jsonb not null default '{}'::jsonb,
  deep_link text,
  read_at timestamptz,
  sent_at timestamptz,
  scheduled_for timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_pending_idx on public.notifications (scheduled_for) where sent_at is null;

-- Analytics and audit ----------------------------------------------------------

create table analytics.events (
  id bigserial primary key,
  user_id uuid references public.profiles (id) on delete set null,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  session_id text,
  app_version text,
  platform text,
  ts timestamptz not null default now()
);

create index analytics_events_name_ts_idx on analytics.events (name, ts desc);
create index analytics_events_user_ts_idx on analytics.events (user_id, ts desc);

create table audit.audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on audit.audit_log (entity_type, entity_id, created_at desc);
create index audit_log_actor_idx on audit.audit_log (actor_id, created_at desc);

-- Generic audit trigger attached to the tables where privileged changes matter.
create or replace function app.write_audit()
returns trigger
language plpgsql
security definer
set search_path = public, audit, pg_temp
as $$
begin
  insert into audit.audit_log (actor_id, action, entity_type, entity_id, before, after)
  values (
    app.uid(),
    tg_op,
    tg_table_name,
    case when tg_op = 'DELETE' then (to_jsonb(old) ->> 'id')::uuid else (to_jsonb(new) ->> 'id')::uuid end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger teachers_audit after insert or update or delete on public.teachers
  for each row execute function app.write_audit();
create trigger payments_audit after insert or update or delete on public.payments
  for each row execute function app.write_audit();
create trigger refunds_audit after insert or update or delete on public.refunds
  for each row execute function app.write_audit();
create trigger payouts_audit after insert or update or delete on public.payouts
  for each row execute function app.write_audit();
create trigger user_roles_audit after insert or update or delete on public.user_roles
  for each row execute function app.write_audit();
create trigger remote_config_audit after insert or update or delete on public.remote_config
  for each row execute function app.write_audit();
create trigger commission_tiers_audit after insert or update or delete on public.commission_tiers
  for each row execute function app.write_audit();

create trigger community_posts_touch before update on public.community_posts
  for each row execute function app.touch_updated_at();
