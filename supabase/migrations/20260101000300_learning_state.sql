-- ---------------------------------------------------------------------------
-- Learner state: language enrolment, skills, progress, attempts, SRS,
-- mistakes, gamification and assessments.
-- ---------------------------------------------------------------------------

create table public.user_languages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  language_id uuid not null references public.languages (id) on delete cascade,
  variant_id uuid references public.language_variants (id) on delete set null,
  is_active boolean not null default true,
  goal text not null default 'curiosity',
  daily_goal_minutes integer not null default 15 check (daily_goal_minutes between 5 and 240),
  immersion_percent smallint not null default 0 check (immersion_percent in (0, 25, 50, 75, 100)),
  reminder_time time,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, language_id)
);

create index user_languages_active_idx on public.user_languages (user_id) where is_active;

-- Fast read for the UI …
create table public.skill_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  language_id uuid not null references public.languages (id) on delete cascade,
  overall_level cefr_level,
  reading_level cefr_level,
  writing_level cefr_level,
  listening_level cefr_level,
  speaking_level cefr_level,
  vocabulary_level cefr_level,
  grammar_level cefr_level,
  pronunciation_level cefr_level,
  interaction_level cefr_level,
  mediation_level cefr_level,
  confidence numeric(4, 3) not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, language_id)
);

-- … and the append-only trail that justifies it ("why does it say A2+?").
create table public.skill_evidence (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.skill_profiles (id) on delete cascade,
  skill skill_kind not null,
  cefr cefr_level not null,
  score numeric(4, 3) not null check (score between 0 and 1),
  source text not null check (source in ('placement', 'checkpoint', 'lesson', 'activity', 'review', 'ai_evaluation', 'teacher')),
  source_id uuid,
  weight numeric(5, 2) not null default 1,
  created_at timestamptz not null default now()
);

create index skill_evidence_profile_idx on public.skill_evidence (profile_id, skill, created_at desc);

create table public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  best_score numeric(4, 3) not null default 0,
  last_score numeric(4, 3),
  attempts integer not null default 0,
  activity_index integer not null default 0,
  time_spent_ms bigint not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create index user_progress_user_idx on public.user_progress (user_id, updated_at desc);
create index user_progress_completed_idx on public.user_progress (user_id) where status = 'completed';

create table public.activity_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Deleting a CMS activity must not erase a learner's history.
  activity_id uuid references public.lesson_activities (id) on delete set null,
  lesson_id uuid references public.lessons (id) on delete set null,
  activity_type activity_kind not null,
  skill skill_kind not null,
  cefr cefr_level not null,
  -- Minted on the device so replaying a queued offline batch is idempotent.
  client_attempt_id uuid not null,
  answer jsonb,
  is_correct boolean not null,
  score numeric(4, 3) not null default 0,
  points integer not null default 0,
  hints_used smallint not null default 0,
  attempt_number smallint not null default 1,
  response_ms integer,
  evaluation jsonb,
  error_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, client_attempt_id)
);

create index activity_attempts_user_idx on public.activity_attempts (user_id, created_at desc);
create index activity_attempts_lesson_idx on public.activity_attempts (lesson_id);
create index activity_attempts_tags_idx on public.activity_attempts using gin (error_tags);

create table public.user_vocabulary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  vocabulary_id uuid not null references public.vocabulary_items (id) on delete cascade,
  state srs_state not null default 'new',
  ease numeric(4, 2) not null default 2.5,
  interval_days numeric(7, 2) not null default 0,
  repetitions integer not null default 0,
  lapses integer not null default 0,
  step smallint not null default 0,
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  avg_response_ms integer,
  created_at timestamptz not null default now(),
  unique (user_id, vocabulary_id)
);

-- The hot path: "what is due for this learner right now?"
create index user_vocabulary_due_idx on public.user_vocabulary (user_id, due_at);
create index user_vocabulary_state_idx on public.user_vocabulary (user_id, state);

create table public.user_mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  language_id uuid not null references public.languages (id) on delete cascade,
  tag text not null,
  label text not null,
  skill skill_kind not null,
  count integer not null default 1,
  last_activity_id uuid references public.lesson_activities (id) on delete set null,
  target_kind text,
  target_id text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (user_id, language_id, tag)
);

create index user_mistakes_recent_idx on public.user_mistakes (user_id, last_seen_at desc) where resolved_at is null;

create table public.streaks (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  current integer not null default 0,
  longest integer not null default 0,
  last_active_date date,
  freezes_available smallint not null default 1,
  updated_at timestamptz not null default now()
);

create table public.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null,
  amount integer not null check (amount >= 0),
  reference_id uuid,
  created_at timestamptz not null default now()
);

create index xp_ledger_user_idx on public.xp_ledger (user_id, created_at desc);

create table public.daily_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Calendar date in the learner's own timezone, written by the client's
  -- local date so a late-night session counts for the right day.
  local_date date not null,
  target_minutes integer not null,
  minutes_done integer not null default 0,
  lessons_done integer not null default 0,
  reviews_done integer not null default 0,
  met boolean not null default false,
  unique (user_id, local_date)
);

create table public.achievements (
  code text primary key,
  label_key text not null,
  description_key text not null,
  icon text,
  ordinal integer not null default 0
);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_code text not null references public.achievements (code) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_code)
);

-- Assessments ---------------------------------------------------------------

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  language_id uuid not null references public.languages (id) on delete cascade,
  kind text not null check (kind in ('placement', 'checkpoint', 'diagnostic')),
  cefr_from cefr_level,
  cefr_to cefr_level,
  title text not null,
  config jsonb not null default '{}'::jsonb,
  status content_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table public.assessment_items (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  activity_id uuid references public.lesson_activities (id) on delete set null,
  inline_activity jsonb,
  cefr cefr_level not null,
  skill skill_kind not null,
  discrimination numeric(3, 2) not null default 0.5 check (discrimination between 0 and 1),
  ordinal integer not null default 0,
  check (activity_id is not null or inline_activity is not null)
);

create index assessment_items_assessment_idx on public.assessment_items (assessment_id, cefr, skill);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  state text not null default 'in_progress' check (state in ('in_progress', 'completed', 'abandoned')),
  responses jsonb not null default '[]'::jsonb,
  per_skill_scores jsonb,
  estimated_levels jsonb,
  result_summary jsonb,
  score numeric(4, 3),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index assessment_attempts_user_idx on public.assessment_attempts (user_id, started_at desc);

create table public.level_readiness (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  language_id uuid not null references public.languages (id) on delete cascade,
  cefr cefr_level not null,
  criteria jsonb not null,
  unmet jsonb not null default '[]'::jsonb,
  progress numeric(4, 3) not null default 0,
  met boolean not null default false,
  evaluated_at timestamptz not null default now(),
  unique (user_id, language_id, cefr)
);

create trigger user_languages_touch before update on public.user_languages for each row execute function app.touch_updated_at();
create trigger user_progress_touch before update on public.user_progress for each row execute function app.touch_updated_at();
create trigger skill_profiles_touch before update on public.skill_profiles for each row execute function app.touch_updated_at();
create trigger streaks_touch before update on public.streaks for each row execute function app.touch_updated_at();

comment on column public.activity_attempts.client_attempt_id is
  'Device-minted id. Makes offline sync idempotent: replaying a queued batch cannot double-count an answer.';
