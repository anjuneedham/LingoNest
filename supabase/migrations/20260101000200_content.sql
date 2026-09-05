-- ---------------------------------------------------------------------------
-- Curriculum content. Every table carries the CMS workflow status; learners
-- only ever see `published` rows, enforced by RLS rather than a client filter.
-- ---------------------------------------------------------------------------

create table public.languages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z]{2,3}$'),
  name text not null,
  native_name text not null,
  writing_system text not null default 'latin',
  rtl boolean not null default false,
  requires_script_module boolean not null default false,
  space_separated boolean not null default true,
  -- Plus bands enabled for this language, e.g. '{A2_PLUS,B1_PLUS}'.
  plus_levels cefr_level[] not null default '{}',
  highest_level cefr_level not null default 'C2',
  status content_status not null default 'draft',
  ordinal integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.language_variants (
  id uuid primary key default gen_random_uuid(),
  language_id uuid not null references public.languages (id) on delete cascade,
  code text not null,
  label text not null,
  region text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (language_id, code)
);

-- Exactly one default variant per language.
create unique index language_variants_one_default
  on public.language_variants (language_id) where is_default;

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  language_id uuid not null references public.languages (id) on delete cascade,
  cefr cefr_level not null,
  ordinal integer not null,
  can_do jsonb not null default '{}'::jsonb,
  -- Mastery criteria overriding the defaults in @lingonest/core.
  criteria jsonb,
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (language_id, cefr)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  language_id uuid not null references public.languages (id) on delete cascade,
  level_id uuid not null references public.levels (id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null default '',
  ordinal integer not null default 0,
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (language_id, slug)
);

create index courses_level_idx on public.courses (level_id, ordinal);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  ordinal integer not null,
  slug text not null,
  title text not null,
  objective text not null,
  theme text,
  cefr cefr_level not null,
  real_world_task text,
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug)
);

create index units_course_idx on public.units (course_id, ordinal);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  ordinal integer not null,
  slug text not null unique,
  title text not null,
  objective text not null,
  can_do text not null,
  cefr cefr_level not null,
  skills skill_kind[] not null default '{}',
  estimated_minutes integer not null default 8 check (estimated_minutes between 1 and 120),
  is_review boolean not null default false,
  is_checkpoint boolean not null default false,
  status content_status not null default 'draft',
  generated_by text not null default 'human' check (generated_by in ('human', 'ai')),
  generation_meta jsonb,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unit_id, ordinal)
);

create index lessons_unit_idx on public.lessons (unit_id, ordinal);
create index lessons_status_idx on public.lessons (status) where status = 'published';

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  kind text not null check (kind in ('audio', 'image', 'video')),
  storage_path text not null,
  duration_ms integer,
  -- Licensing metadata is mandatory: a published activity may not reference an
  -- asset whose licence is unknown.
  source text not null,
  licence text not null,
  attribution text,
  voice text,
  speed text check (speed in ('slow', 'normal', 'natural')),
  variant_code text,
  language_id uuid references public.languages (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.lesson_activities (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  ordinal integer not null,
  type activity_kind not null,
  stage lesson_stage not null,
  skill skill_kind not null,
  cefr cefr_level not null,
  difficulty smallint not null default 2 check (difficulty between 1 and 5),
  prompt jsonb not null,
  correct_answer jsonb,
  acceptable_answers jsonb,
  hints jsonb not null default '[]'::jsonb,
  explanation text,
  media jsonb not null default '[]'::jsonb,
  rubric jsonb,
  points integer not null default 10 check (points >= 0),
  time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds > 0),
  tags text[] not null default '{}',
  variants text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, ordinal)
);

create index lesson_activities_lesson_idx on public.lesson_activities (lesson_id, ordinal);
create index lesson_activities_tags_idx on public.lesson_activities using gin (tags);

create table public.vocabulary_items (
  id uuid primary key default gen_random_uuid(),
  language_id uuid not null references public.languages (id) on delete cascade,
  key text not null,
  term text not null,
  translation text not null,
  part_of_speech text,
  gender text,
  pronunciation text,
  example_sentence text,
  example_translation text,
  audio_asset_key text,
  image_asset_key text,
  cefr cefr_level not null,
  difficulty smallint not null default 2 check (difficulty between 1 and 5),
  frequency_rank integer,
  variant_overrides jsonb not null default '{}'::jsonb,
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (language_id, key)
);

create index vocabulary_term_trgm on public.vocabulary_items using gin (term gin_trgm_ops);
create index vocabulary_language_cefr_idx on public.vocabulary_items (language_id, cefr);

create table public.vocabulary_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  ordinal integer not null default 0
);

create table public.vocabulary_item_categories (
  vocabulary_id uuid not null references public.vocabulary_items (id) on delete cascade,
  category_id uuid not null references public.vocabulary_categories (id) on delete cascade,
  primary key (vocabulary_id, category_id)
);

create table public.grammar_topics (
  id uuid primary key default gen_random_uuid(),
  language_id uuid not null references public.languages (id) on delete cascade,
  key text not null,
  title text not null,
  cefr cefr_level not null,
  summary text not null,
  explanation text not null,
  examples jsonb not null default '[]'::jsonb,
  common_mistakes jsonb not null default '[]'::jsonb,
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (language_id, key)
);

create table public.culture_notes (
  id uuid primary key default gen_random_uuid(),
  language_id uuid not null references public.languages (id) on delete cascade,
  key text not null,
  -- Culture is regional: a note declares which variants it applies to rather
  -- than presenting one country's usage as universal.
  variant_codes text[] not null default '{}',
  title text not null,
  body text not null,
  topic text,
  cefr cefr_level not null,
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  unique (language_id, key)
);

create table public.conversation_scenarios (
  id uuid primary key default gen_random_uuid(),
  language_id uuid not null references public.languages (id) on delete cascade,
  key text not null,
  title text not null,
  setting text not null,
  partner_role text not null,
  learner_role text not null,
  cefr cefr_level not null,
  goals text[] not null default '{}',
  complications text[] not null default '{}',
  opening_line text not null,
  vocabulary_keys text[] not null default '{}',
  status content_status not null default 'draft',
  created_at timestamptz not null default now(),
  unique (language_id, key)
);

-- Join tables ---------------------------------------------------------------

create table public.lesson_vocabulary (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  vocabulary_id uuid not null references public.vocabulary_items (id) on delete cascade,
  is_new boolean not null default true,
  primary key (lesson_id, vocabulary_id)
);

create table public.lesson_grammar (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  grammar_topic_id uuid not null references public.grammar_topics (id) on delete cascade,
  primary key (lesson_id, grammar_topic_id)
);

create table public.lesson_culture_notes (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  culture_note_id uuid not null references public.culture_notes (id) on delete cascade,
  primary key (lesson_id, culture_note_id)
);

-- CMS workflow --------------------------------------------------------------

create table public.content_approvals (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('course', 'unit', 'lesson', 'activity', 'vocabulary', 'grammar', 'scenario')),
  entity_id uuid not null,
  from_status content_status,
  to_status content_status not null,
  approved_by uuid references public.profiles (id),
  notes text,
  created_at timestamptz not null default now()
);

create index content_approvals_entity_idx on public.content_approvals (entity_type, entity_id, created_at desc);

-- AI-drafted curriculum may not be published without a recorded human
-- approval. This is a database invariant, not a UI convention.
create or replace function app.enforce_ai_content_review()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and coalesce(new.generated_by, 'human') = 'ai' then
    if not exists (
      select 1 from public.content_approvals ca
      where ca.entity_type = 'lesson'
        and ca.entity_id = new.id
        and ca.to_status in ('approved', 'published')
        and ca.approved_by is not null
    ) then
      raise exception 'ai_content_requires_human_approval'
        using hint = 'Record a content_approvals row with an approver before publishing AI-drafted content.';
    end if;
  end if;
  return new;
end;
$$;

create trigger lessons_ai_review_guard
  before insert or update of status on public.lessons
  for each row execute function app.enforce_ai_content_review();

-- A published lesson must be complete enough to teach with.
create or replace function app.validate_lesson_publish()
returns trigger
language plpgsql
as $$
declare
  activity_count integer;
  missing_answer_keys integer;
  unlicensed_media integer;
begin
  if new.status <> 'published' then
    return new;
  end if;

  if coalesce(new.objective, '') = '' or coalesce(new.can_do, '') = '' then
    raise exception 'lesson_requires_objective';
  end if;
  if array_length(new.skills, 1) is null then
    raise exception 'lesson_requires_skills';
  end if;

  select count(*) into activity_count
  from public.lesson_activities where lesson_id = new.id;
  if activity_count < 3 then
    raise exception 'lesson_requires_at_least_three_activities';
  end if;

  -- Every gradable activity needs an answer key; open production is graded by
  -- rubric instead.
  select count(*) into missing_answer_keys
  from public.lesson_activities a
  where a.lesson_id = new.id
    and a.correct_answer is null
    and a.rubric is null
    and a.type not in ('conversation', 'roleplay', 'scenario_simulation', 'flashcard', 'review_challenge');
  if missing_answer_keys > 0 then
    raise exception 'lesson_has_% activities_without_answer_key', missing_answer_keys;
  end if;

  select count(*) into unlicensed_media
  from public.lesson_activities a
  cross join lateral jsonb_array_elements(a.media) m
  left join public.media_assets ma on ma.key = (m ->> 'assetKey')
  where a.lesson_id = new.id
    and (ma.id is null or ma.licence is null or ma.licence in ('', 'unknown'));
  if unlicensed_media > 0 then
    raise exception 'lesson_references_unlicensed_media';
  end if;

  return new;
end;
$$;

create trigger lessons_publish_validation
  before insert or update of status on public.lessons
  for each row execute function app.validate_lesson_publish();

create trigger languages_touch before update on public.languages for each row execute function app.touch_updated_at();
create trigger levels_touch before update on public.levels for each row execute function app.touch_updated_at();
create trigger courses_touch before update on public.courses for each row execute function app.touch_updated_at();
create trigger units_touch before update on public.units for each row execute function app.touch_updated_at();
create trigger lessons_touch before update on public.lessons for each row execute function app.touch_updated_at();
create trigger lesson_activities_touch before update on public.lesson_activities for each row execute function app.touch_updated_at();
create trigger vocabulary_items_touch before update on public.vocabulary_items for each row execute function app.touch_updated_at();
create trigger grammar_topics_touch before update on public.grammar_topics for each row execute function app.touch_updated_at();
