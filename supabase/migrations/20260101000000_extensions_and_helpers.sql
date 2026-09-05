-- ---------------------------------------------------------------------------
-- Foundations: schemas, extensions, shared enums and helper functions.
--
-- `app` holds SECURITY DEFINER helpers used by RLS policies. Keeping the role
-- checks in the database means the client cannot assert its own permissions.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";       -- fuzzy teacher/vocabulary search
create extension if not exists "btree_gist";    -- exclusion constraint on booking times

create schema if not exists app;
create schema if not exists analytics;
create schema if not exists audit;

revoke all on schema app from public, anon, authenticated;
revoke all on schema audit from public, anon, authenticated;

-- --------------------------------------------------------------------------
-- Shared enums
-- --------------------------------------------------------------------------

create type app_role as enum ('learner', 'teacher', 'admin', 'moderator', 'content_editor');

create type cefr_level as enum (
  'PRE_A1', 'A1', 'A2', 'A2_PLUS', 'B1', 'B1_PLUS', 'B2', 'B2_PLUS', 'C1', 'C2'
);

create type skill_kind as enum (
  'reading', 'listening', 'speaking', 'writing',
  'vocabulary', 'grammar', 'pronunciation', 'interaction', 'mediation'
);

create type content_status as enum ('draft', 'in_review', 'approved', 'published', 'archived');

create type lesson_stage as enum (
  'introduce', 'discover', 'listen', 'understand', 'practice',
  'speak', 'build', 'converse', 'apply', 'review'
);

create type activity_kind as enum (
  'multiple_choice', 'multiple_answer', 'tap_translation', 'fill_blank', 'drag_drop',
  'sentence_order', 'word_match', 'image_match', 'audio_recognition',
  'listening_comprehension', 'pronunciation_repeat', 'speech_response',
  'written_response', 'translation', 'conversation', 'roleplay', 'flashcard',
  'dictation', 'spelling', 'grammar_correction', 'word_categorization',
  'story_completion', 'dialogue_completion', 'scenario_simulation',
  'timed_challenge', 'review_challenge'
);

create type srs_state as enum ('new', 'learning', 'review', 'mastered', 'leech');

create type teacher_status as enum ('pending', 'under_review', 'approved', 'rejected', 'suspended');

create type verification_kind as enum ('identity', 'certification', 'education', 'language', 'minors_clearance');
create type verification_status as enum ('pending', 'verified', 'rejected', 'expired');

create type booking_status as enum (
  'pending_payment', 'confirmed', 'in_progress', 'completed',
  'cancelled_by_learner', 'cancelled_by_teacher',
  'no_show_learner', 'no_show_teacher', 'expired', 'disputed'
);

create type payment_kind as enum ('subscription', 'booking', 'package');
create type payment_status as enum ('requires_payment', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded');
create type payout_status as enum ('pending', 'in_transit', 'paid', 'failed', 'reversed');

create type subscription_status as enum ('active', 'trialing', 'past_due', 'canceled', 'expired', 'paused', 'none');
create type billing_platform as enum ('ios', 'android', 'web');

create type account_type as enum ('adult', 'teen', 'child');

create type assignment_kind as enum ('lesson', 'review', 'vocabulary', 'speaking', 'writing', 'conversation');
create type assignment_status as enum ('assigned', 'in_progress', 'completed', 'skipped');

create type ai_session_kind as enum ('conversation', 'roleplay', 'coach', 'evaluation', 'content_assistant');

create type moderation_state as enum ('open', 'reviewing', 'actioned', 'dismissed');

-- --------------------------------------------------------------------------
-- Helper functions used by RLS policies
-- --------------------------------------------------------------------------

-- Current user id, or null for anonymous requests.
create or replace function app.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

-- plpgsql rather than sql so this can be defined before public.user_roles
-- exists; the body resolves at call time.
create or replace function app.has_role(p_user uuid, p_role app_role)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_exists boolean;
begin
  if p_user is null then
    return false;
  end if;
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user and ur.role = p_role
  ) into v_exists;
  return v_exists;
end;
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
as $$
  select app.has_role(app.uid(), 'admin');
$$;

create or replace function app.is_content_editor()
returns boolean
language sql
stable
as $$
  select app.has_role(app.uid(), 'admin') or app.has_role(app.uid(), 'content_editor');
$$;

create or replace function app.is_moderator()
returns boolean
language sql
stable
as $$
  select app.has_role(app.uid(), 'admin') or app.has_role(app.uid(), 'moderator');
$$;

-- Keeps `updated_at` honest without trusting the client.
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function app.has_role is
  'Role check used by every RLS policy. SECURITY DEFINER so a learner cannot read or spoof the role table.';
