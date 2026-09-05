-- ---------------------------------------------------------------------------
-- Row Level Security.
--
-- Every table in `public` has RLS enabled; a migration test at the bottom of
-- this file fails the build if any table is left unprotected. The anon key
-- shipped in the mobile bundle is only safe because of what follows.
-- ---------------------------------------------------------------------------

-- Helper: may this teacher see this learner's learning data?
-- True only while a real booking relationship exists or recently existed.
create or replace function app.teacher_can_view_learner(p_teacher uuid, p_learner uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.bookings b
    where b.teacher_id = p_teacher
      and b.learner_id = p_learner
      and b.status in ('confirmed', 'in_progress', 'completed')
      and b.starts_at > now() - interval '180 days'
  );
$$;

create or replace function app.is_conversation_participant(p_conversation uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = p_conversation and cp.user_id = p_user
  );
$$;

-- A minor may learn immediately, but may not message or post until a guardian
-- has confirmed consent. Adult<->minor free messaging is not launched at all
-- (brief §65): direct conversations involving a minor must be booking-scoped.
create or replace function app.minor_can_socialise(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select not p.is_minor or p.guardian_consent_at is not null
     from public.profiles p where p.id = p_user),
    false
  );
$$;

create or replace function app.has_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = p_a and blocked_id = p_b)
       or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('alter table public.%I force row level security', t.tablename);
  end loop;
end $$;

alter table analytics.events enable row level security;
alter table audit.audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create policy profiles_read_own on public.profiles
  for select using (id = app.uid() or app.is_admin());

-- A teacher may read the public fields of a learner they teach, and any user
-- may read the profile of an approved teacher (name and avatar for the card).
create policy profiles_read_related on public.profiles
  for select using (
    exists (select 1 from public.teachers t where t.user_id = profiles.id and t.status = 'approved')
    or app.teacher_can_view_learner(app.uid(), profiles.id)
    or exists (
      select 1 from public.bookings b
      where (b.learner_id = app.uid() and b.teacher_id = profiles.id)
         or (b.teacher_id = app.uid() and b.learner_id = profiles.id)
    )
  );

create policy profiles_update_own on public.profiles
  for update using (id = app.uid()) with check (id = app.uid());

create policy profiles_admin_write on public.profiles
  for all using (app.is_admin()) with check (app.is_admin());

create policy user_roles_read_own on public.user_roles
  for select using (user_id = app.uid() or app.is_admin());

-- Roles are granted by admins only; a user cannot promote themselves.
create policy user_roles_admin_write on public.user_roles
  for all using (app.is_admin()) with check (app.is_admin());

create policy notification_preferences_own on public.notification_preferences
  for all using (user_id = app.uid()) with check (user_id = app.uid());

create policy device_tokens_own on public.device_tokens
  for all using (user_id = app.uid()) with check (user_id = app.uid());

-- ---------------------------------------------------------------------------
-- Content: learners see published rows; editors see everything.
-- ---------------------------------------------------------------------------

create policy languages_read on public.languages
  for select using (status = 'published' or app.is_content_editor());
create policy languages_write on public.languages
  for all using (app.is_content_editor()) with check (app.is_content_editor());

create policy language_variants_read on public.language_variants
  for select using (true);
create policy language_variants_write on public.language_variants
  for all using (app.is_content_editor()) with check (app.is_content_editor());

create policy levels_read on public.levels
  for select using (status = 'published' or app.is_content_editor());
create policy levels_write on public.levels
  for all using (app.is_content_editor()) with check (app.is_content_editor());

create policy courses_read on public.courses
  for select using (status = 'published' or app.is_content_editor());
create policy courses_write on public.courses
  for all using (app.is_content_editor()) with check (app.is_content_editor());

create policy units_read on public.units
  for select using (status = 'published' or app.is_content_editor());
create policy units_write on public.units
  for all using (app.is_content_editor()) with check (app.is_content_editor());

create policy lessons_read on public.lessons
  for select using (status = 'published' or app.is_content_editor());
create policy lessons_write on public.lessons
  for all using (app.is_content_editor()) with check (app.is_content_editor());

-- An activity inherits its lesson's visibility. Note this does not hide the
-- answer key: activities are graded on the client for speed, so the answer key
-- reaches the device. That is an accepted trade-off for a learning app; the
-- assessment items used for placement and checkpoints are served through a
-- function that strips answers instead (see `public.next_assessment_item`).
create policy lesson_activities_read on public.lesson_activities
  for select using (
    exists (select 1 from public.lessons l where l.id = lesson_activities.lesson_id and l.status = 'published')
    or app.is_content_editor()
  );
create policy lesson_activities_write on public.lesson_activities
  for all using (app.is_content_editor()) with check (app.is_content_editor());

create policy vocabulary_read on public.vocabulary_items
  for select using (status = 'published' or app.is_content_editor());
create policy vocabulary_write on public.vocabulary_items
  for all using (app.is_content_editor()) with check (app.is_content_editor());

create policy vocabulary_categories_read on public.vocabulary_categories for select using (true);
create policy vocabulary_categories_write on public.vocabulary_categories
  for all using (app.is_content_editor()) with check (app.is_content_editor());

create policy vocabulary_item_categories_read on public.vocabulary_item_categories for select using (true);
create policy vocabulary_item_categories_write on public.vocabulary_item_categories
  for all using (app.is_content_editor()) with check (app.is_content_editor());

create policy grammar_read on public.grammar_topics
  for select using (status = 'published' or app.is_content_editor());
create policy grammar_write on public.grammar_topics
  for all using (app.is_content_editor()) with check (app.is_content_editor());

create policy culture_read on public.culture_notes
  for select using (status = 'published' or app.is_content_editor());
create policy culture_write on public.culture_notes
  for all using (app.is_content_editor()) with check (app.is_content_editor());

create policy scenarios_read on public.conversation_scenarios
  for select using (status = 'published' or app.is_content_editor());
create policy scenarios_write on public.conversation_scenarios
  for all using (app.is_content_editor()) with check (app.is_content_editor());

create policy media_read on public.media_assets for select using (true);
create policy media_write on public.media_assets
  for all using (app.is_content_editor()) with check (app.is_content_editor());

create policy lesson_vocabulary_read on public.lesson_vocabulary for select using (true);
create policy lesson_vocabulary_write on public.lesson_vocabulary
  for all using (app.is_content_editor()) with check (app.is_content_editor());
create policy lesson_grammar_read on public.lesson_grammar for select using (true);
create policy lesson_grammar_write on public.lesson_grammar
  for all using (app.is_content_editor()) with check (app.is_content_editor());
create policy lesson_culture_read on public.lesson_culture_notes for select using (true);
create policy lesson_culture_write on public.lesson_culture_notes
  for all using (app.is_content_editor()) with check (app.is_content_editor());

create policy content_approvals_read on public.content_approvals
  for select using (app.is_content_editor());
create policy content_approvals_write on public.content_approvals
  for insert with check (app.is_content_editor() and approved_by = app.uid());

create policy assessments_read on public.assessments
  for select using (status = 'published' or app.is_content_editor());
create policy assessments_write on public.assessments
  for all using (app.is_content_editor()) with check (app.is_content_editor());

-- Assessment items are never readable directly: they are served one at a time
-- by a function that withholds the answer key.
create policy assessment_items_editor_only on public.assessment_items
  for all using (app.is_content_editor()) with check (app.is_content_editor());

-- ---------------------------------------------------------------------------
-- Learner state
-- ---------------------------------------------------------------------------

create policy user_languages_own on public.user_languages
  for all using (user_id = app.uid()) with check (user_id = app.uid());
create policy user_languages_teacher_read on public.user_languages
  for select using (app.teacher_can_view_learner(app.uid(), user_id) or app.is_admin());

-- Skill profiles are computed server-side; the client may read but not write.
create policy skill_profiles_read on public.skill_profiles
  for select using (
    user_id = app.uid() or app.teacher_can_view_learner(app.uid(), user_id) or app.is_admin()
  );

create policy skill_evidence_read on public.skill_evidence
  for select using (
    exists (
      select 1 from public.skill_profiles sp
      where sp.id = skill_evidence.profile_id
        and (sp.user_id = app.uid() or app.teacher_can_view_learner(app.uid(), sp.user_id) or app.is_admin())
    )
  );

create policy user_progress_read on public.user_progress
  for select using (
    user_id = app.uid() or app.teacher_can_view_learner(app.uid(), user_id) or app.is_admin()
  );
create policy user_progress_write_own on public.user_progress
  for all using (user_id = app.uid()) with check (user_id = app.uid());

-- Attempts are insert-only from the client: a learner may record what they did
-- but may not rewrite their own history.
create policy activity_attempts_insert_own on public.activity_attempts
  for insert with check (user_id = app.uid());
create policy activity_attempts_read on public.activity_attempts
  for select using (
    user_id = app.uid() or app.teacher_can_view_learner(app.uid(), user_id) or app.is_admin()
  );

create policy user_vocabulary_own on public.user_vocabulary
  for all using (user_id = app.uid()) with check (user_id = app.uid());
create policy user_vocabulary_teacher_read on public.user_vocabulary
  for select using (app.teacher_can_view_learner(app.uid(), user_id) or app.is_admin());

create policy user_mistakes_own on public.user_mistakes
  for all using (user_id = app.uid()) with check (user_id = app.uid());
create policy user_mistakes_teacher_read on public.user_mistakes
  for select using (app.teacher_can_view_learner(app.uid(), user_id) or app.is_admin());

create policy streaks_own on public.streaks
  for all using (user_id = app.uid()) with check (user_id = app.uid());

create policy xp_ledger_read_own on public.xp_ledger
  for select using (user_id = app.uid() or app.is_admin());
create policy xp_ledger_insert_own on public.xp_ledger
  for insert with check (user_id = app.uid());

create policy daily_goals_own on public.daily_goals
  for all using (user_id = app.uid()) with check (user_id = app.uid());

create policy achievements_read on public.achievements for select using (true);
create policy achievements_write on public.achievements
  for all using (app.is_admin()) with check (app.is_admin());

create policy user_achievements_read on public.user_achievements
  for select using (user_id = app.uid() or app.is_admin());
create policy user_achievements_insert on public.user_achievements
  for insert with check (user_id = app.uid());

create policy assessment_attempts_own on public.assessment_attempts
  for all using (user_id = app.uid()) with check (user_id = app.uid());
create policy assessment_attempts_teacher_read on public.assessment_attempts
  for select using (app.teacher_can_view_learner(app.uid(), user_id) or app.is_admin());

create policy level_readiness_read on public.level_readiness
  for select using (
    user_id = app.uid() or app.teacher_can_view_learner(app.uid(), user_id) or app.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Marketplace
-- ---------------------------------------------------------------------------

create policy teachers_read_public on public.teachers
  for select using (status = 'approved' or user_id = app.uid() or app.is_admin());

-- A teacher may edit their own profile but not their own status, commission
-- override, payout flag or lesson count.
create policy teachers_update_own on public.teachers
  for update using (user_id = app.uid())
  with check (user_id = app.uid());

create policy teachers_admin_write on public.teachers
  for all using (app.is_admin()) with check (app.is_admin());

-- Server-side callers (Edge Functions using the service key, and admins) may
-- change these fields; a teacher editing their own profile may not. Detected by
-- the absence of an end-user JWT rather than by trusting a request header.
create or replace function app.is_server_context()
returns boolean
language sql
stable
as $$
  select app.uid() is null or current_role in ('service_role', 'postgres');
$$;

create or replace function app.protect_teacher_privileged_fields()
returns trigger
language plpgsql
as $$
begin
  if app.is_admin() or app.is_server_context() then
    return new;
  end if;
  new.status := old.status;
  new.commission_override_bps := old.commission_override_bps;
  new.payout_enabled := old.payout_enabled;
  new.lessons_taught := old.lessons_taught;
  new.rating_avg := old.rating_avg;
  new.rating_count := old.rating_count;
  new.stripe_account_id := old.stripe_account_id;
  return new;
end;
$$;

create trigger teachers_protect_fields
  before update on public.teachers
  for each row execute function app.protect_teacher_privileged_fields();

create policy teacher_applications_own on public.teacher_applications
  for select using (user_id = app.uid() or app.is_admin());
create policy teacher_applications_insert_own on public.teacher_applications
  for insert with check (user_id = app.uid());
create policy teacher_applications_update_own on public.teacher_applications
  for update using (user_id = app.uid() and status = 'pending')
  with check (user_id = app.uid());
create policy teacher_applications_admin on public.teacher_applications
  for all using (app.is_admin()) with check (app.is_admin());

-- Verification evidence is private; only the owner and admins may read it, and
-- only admins may mark anything verified.
create policy teacher_verifications_read on public.teacher_verifications
  for select using (teacher_id = app.uid() or app.is_admin());
create policy teacher_verifications_insert_own on public.teacher_verifications
  for insert with check (teacher_id = app.uid() and status = 'pending');
create policy teacher_verifications_admin on public.teacher_verifications
  for all using (app.is_admin()) with check (app.is_admin());

create policy teacher_availability_read on public.teacher_availability for select using (true);
create policy teacher_availability_own on public.teacher_availability
  for all using (teacher_id = app.uid()) with check (teacher_id = app.uid());

create policy teacher_availability_exceptions_read on public.teacher_availability_exceptions
  for select using (true);
create policy teacher_availability_exceptions_own on public.teacher_availability_exceptions
  for all using (teacher_id = app.uid()) with check (teacher_id = app.uid());

create policy lesson_packages_read on public.lesson_packages
  for select using (active or teacher_id = app.uid() or app.is_admin());
create policy lesson_packages_own on public.lesson_packages
  for all using (teacher_id = app.uid()) with check (teacher_id = app.uid());

create policy package_purchases_read on public.package_purchases
  for select using (user_id = app.uid() or teacher_id = app.uid() or app.is_admin());

create policy bookings_read_participant on public.bookings
  for select using (learner_id = app.uid() or teacher_id = app.uid() or app.is_admin());

-- Learners never create bookings directly: `booking-create` prices the lesson
-- and re-derives availability server-side. Participants may update only the
-- notes and join timestamps (enforced by the trigger below).
create policy bookings_update_participant on public.bookings
  for update using (learner_id = app.uid() or teacher_id = app.uid())
  with check (learner_id = app.uid() or teacher_id = app.uid());

create or replace function app.protect_booking_fields()
returns trigger
language plpgsql
as $$
begin
  if app.is_admin() or app.is_server_context() then
    return new;
  end if;
  new.status := old.status;
  new.price_cents := old.price_cents;
  new.currency := old.currency;
  new.commission_bps := old.commission_bps;
  new.teacher_earnings_cents := old.teacher_earnings_cents;
  new.starts_at := old.starts_at;
  new.duration_minutes := old.duration_minutes;
  new.package_purchase_id := old.package_purchase_id;
  new.video_room_id := old.video_room_id;
  return new;
end;
$$;

create trigger bookings_protect_fields
  before update on public.bookings
  for each row execute function app.protect_booking_fields();

create policy booking_assignments_read on public.booking_assignments
  for select using (learner_id = app.uid() or teacher_id = app.uid() or app.is_admin());
create policy booking_assignments_teacher_write on public.booking_assignments
  for insert with check (
    teacher_id = app.uid() and app.teacher_can_view_learner(app.uid(), learner_id)
  );
create policy booking_assignments_update on public.booking_assignments
  for update using (learner_id = app.uid() or teacher_id = app.uid())
  with check (learner_id = app.uid() or teacher_id = app.uid());

create policy reviews_read_published on public.reviews
  for select using (status = 'published' or learner_id = app.uid() or teacher_id = app.uid() or app.is_moderator());
create policy reviews_insert_own on public.reviews
  for insert with check (learner_id = app.uid());
create policy reviews_update_author on public.reviews
  for update using (learner_id = app.uid()) with check (learner_id = app.uid());
create policy reviews_moderate on public.reviews
  for all using (app.is_moderator()) with check (app.is_moderator());

-- ---------------------------------------------------------------------------
-- Money: readable by the parties involved, writable only by service functions.
-- ---------------------------------------------------------------------------

create policy subscription_plans_read on public.subscription_plans
  for select using (active or app.is_admin());
create policy subscription_plans_admin on public.subscription_plans
  for all using (app.is_admin()) with check (app.is_admin());

create policy subscriptions_read_own on public.subscriptions
  for select using (user_id = app.uid() or app.is_admin());

create policy commission_tiers_read on public.commission_tiers
  for select using (active or app.is_admin());
create policy commission_tiers_admin on public.commission_tiers
  for all using (app.is_admin()) with check (app.is_admin());

create policy payments_read on public.payments
  for select using (user_id = app.uid() or teacher_id = app.uid() or app.is_admin());

create policy teacher_balances_read on public.teacher_balances
  for select using (teacher_id = app.uid() or app.is_admin());

create policy payouts_read on public.payouts
  for select using (teacher_id = app.uid() or app.is_admin());

create policy refunds_read on public.refunds
  for select using (
    app.is_admin()
    or exists (select 1 from public.payments p where p.id = refunds.payment_id and p.user_id = app.uid())
  );

create policy disputes_read on public.disputes
  for select using (opened_by = app.uid() or app.is_admin());
create policy disputes_insert on public.disputes
  for insert with check (opened_by = app.uid());
create policy disputes_admin on public.disputes
  for all using (app.is_admin()) with check (app.is_admin());

create policy learner_credits_read on public.learner_credits
  for select using (user_id = app.uid() or app.is_admin());

create policy promotions_read on public.promotions
  for select using (active or app.is_admin());
create policy promotions_admin on public.promotions
  for all using (app.is_admin()) with check (app.is_admin());

create policy referrals_read on public.referrals
  for select using (referrer_id = app.uid() or referee_id = app.uid() or app.is_admin());
create policy referrals_insert on public.referrals
  for insert with check (referrer_id = app.uid());
create policy referrals_admin on public.referrals
  for all using (app.is_admin()) with check (app.is_admin());

create policy remote_config_read on public.remote_config
  for select using (is_public or app.is_admin());
create policy remote_config_admin on public.remote_config
  for all using (app.is_admin()) with check (app.is_admin());

create policy feature_flags_read on public.feature_flags for select using (true);
create policy feature_flags_admin on public.feature_flags
  for all using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- AI
-- ---------------------------------------------------------------------------

create policy ai_sessions_own on public.ai_sessions
  for select using (user_id = app.uid() or app.is_admin());

create policy ai_messages_own on public.ai_messages
  for select using (
    exists (select 1 from public.ai_sessions s where s.id = ai_messages.session_id and s.user_id = app.uid())
    or app.is_admin()
  );

-- Usage counters are the basis of plan enforcement: readable, never writable.
create policy ai_usage_counters_read on public.ai_usage_counters
  for select using (user_id = app.uid() or app.is_admin());

-- ---------------------------------------------------------------------------
-- Messaging and community
-- ---------------------------------------------------------------------------

create policy conversations_participant on public.conversations
  for select using (app.is_conversation_participant(id, app.uid()) or app.is_admin());

create policy conversation_participants_read on public.conversation_participants
  for select using (app.is_conversation_participant(conversation_id, app.uid()) or app.is_admin());
create policy conversation_participants_update_own on public.conversation_participants
  for update using (user_id = app.uid()) with check (user_id = app.uid());

create policy messages_read on public.messages
  for select using (
    (app.is_conversation_participant(conversation_id, app.uid()) and not redacted)
    or app.is_moderator()
  );

create policy messages_insert on public.messages
  for insert with check (
    sender_id = app.uid()
    and app.is_conversation_participant(conversation_id, app.uid())
    and app.minor_can_socialise(app.uid())
    -- A conversation involving a minor must be attached to a booking, so a
    -- teacher and a young learner can talk about the lesson and nothing else
    -- is open by default.
    and (
      not exists (
        select 1 from public.conversation_participants cp
        join public.profiles p on p.id = cp.user_id
        where cp.conversation_id = messages.conversation_id and p.is_minor
      )
      or exists (
        select 1 from public.conversations c
        where c.id = messages.conversation_id and c.kind in ('booking', 'support')
      )
    )
    -- A blocked pair cannot exchange messages.
    and not exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id <> app.uid()
        and app.has_blocked(app.uid(), cp.user_id)
    )
  );

create policy messages_moderate on public.messages
  for update using (app.is_moderator()) with check (app.is_moderator());

create policy blocks_own on public.blocks
  for all using (blocker_id = app.uid()) with check (blocker_id = app.uid());
create policy mutes_own on public.mutes
  for all using (user_id = app.uid()) with check (user_id = app.uid());

create policy community_groups_read on public.community_groups
  for select using (
    is_public
    and (minors_allowed or not exists (
      select 1 from public.profiles p where p.id = app.uid() and p.is_minor
    ))
  );
create policy community_groups_admin on public.community_groups
  for all using (app.is_admin()) with check (app.is_admin());

create policy community_posts_read on public.community_posts
  for select using (
    status = 'published'
    and not exists (select 1 from public.blocks b where b.blocker_id = app.uid() and b.blocked_id = community_posts.author_id)
    or author_id = app.uid()
    or app.is_moderator()
  );
create policy community_posts_insert on public.community_posts
  for insert with check (author_id = app.uid() and app.minor_can_socialise(app.uid()));
create policy community_posts_update_own on public.community_posts
  for update using (author_id = app.uid() or app.is_moderator())
  with check (author_id = app.uid() or app.is_moderator());

create policy community_comments_read on public.community_comments
  for select using (status = 'published' or author_id = app.uid() or app.is_moderator());
create policy community_comments_insert on public.community_comments
  for insert with check (author_id = app.uid() and app.minor_can_socialise(app.uid()));
create policy community_comments_update on public.community_comments
  for update using (author_id = app.uid() or app.is_moderator())
  with check (author_id = app.uid() or app.is_moderator());

create policy post_reactions_own on public.post_reactions
  for all using (user_id = app.uid()) with check (user_id = app.uid());

create policy reports_insert on public.reports
  for insert with check (reporter_id = app.uid());
create policy reports_read on public.reports
  for select using (reporter_id = app.uid() or app.is_moderator());
create policy reports_moderate on public.reports
  for all using (app.is_moderator()) with check (app.is_moderator());

create policy moderation_actions_read on public.moderation_actions
  for select using (app.is_moderator());
create policy moderation_actions_write on public.moderation_actions
  for insert with check (app.is_moderator() and moderator_id = app.uid());

create policy notifications_own on public.notifications
  for select using (user_id = app.uid());
create policy notifications_update_own on public.notifications
  for update using (user_id = app.uid()) with check (user_id = app.uid());

-- ---------------------------------------------------------------------------
-- Analytics and audit
-- ---------------------------------------------------------------------------

-- Events are written by the ingest function (service role) and read only in
-- aggregate by admins through the analytics views.
create policy analytics_events_admin_read on analytics.events
  for select using (app.is_admin());

-- The audit log is append-only and admin-readable. No update or delete policy
-- exists, so those operations are impossible for every non-service role.
create policy audit_log_admin_read on audit.audit_log
  for select using (app.is_admin());

-- ---------------------------------------------------------------------------
-- Guard: fail the migration if any public table lacks a policy
-- ---------------------------------------------------------------------------
do $$
declare
  unprotected text;
begin
  select string_agg(t.tablename, ', ')
  into unprotected
  from pg_tables t
  where t.schemaname = 'public'
    and not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = t.tablename
    );

  if unprotected is not null then
    raise exception 'Tables without RLS policies: %', unprotected;
  end if;
end $$;
