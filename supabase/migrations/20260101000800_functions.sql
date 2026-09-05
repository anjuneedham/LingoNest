-- ---------------------------------------------------------------------------
-- Transactional application functions.
--
-- Anything that must be atomic, or must not be trusted from the client, lives
-- here rather than in the app: lesson completion, SRS writes, skill evidence,
-- teacher search, and the aggregate views the dashboards read.
-- ---------------------------------------------------------------------------

-- Record a batch of activity attempts and finish a lesson in one transaction.
-- Idempotent per attempt via `client_attempt_id`, so replaying a queued offline
-- batch cannot double-count.
create or replace function public.complete_lesson(
  p_lesson_id uuid,
  p_attempts jsonb,
  p_duration_ms bigint,
  p_local_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := app.uid();
  v_lesson public.lessons%rowtype;
  v_language_id uuid;
  v_profile_id uuid;
  v_accuracy numeric;
  v_total_points integer := 0;
  v_earned numeric := 0;
  v_xp integer := 0;
  v_inserted integer := 0;
  v_attempt jsonb;
  v_skill skill_kind;
  v_streak record;
  v_new_words integer := 0;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_lesson from public.lessons where id = p_lesson_id and status = 'published';
  if not found then
    raise exception 'lesson_not_found_or_unpublished';
  end if;

  select c.language_id into v_language_id
  from public.units u
  join public.courses c on c.id = u.course_id
  where u.id = v_lesson.unit_id;

  -- 1. Persist the attempts.
  for v_attempt in select * from jsonb_array_elements(coalesce(p_attempts, '[]'::jsonb))
  loop
    insert into public.activity_attempts (
      user_id, activity_id, lesson_id, activity_type, skill, cefr, client_attempt_id,
      answer, is_correct, score, points, hints_used, attempt_number, response_ms,
      evaluation, error_tags
    )
    values (
      v_user,
      nullif(v_attempt ->> 'activityId', '')::uuid,
      p_lesson_id,
      (v_attempt ->> 'activityType')::activity_kind,
      (v_attempt ->> 'skill')::skill_kind,
      coalesce((v_attempt ->> 'cefr')::cefr_level, v_lesson.cefr),
      (v_attempt ->> 'clientAttemptId')::uuid,
      v_attempt -> 'answer',
      coalesce((v_attempt ->> 'isCorrect')::boolean, false),
      coalesce((v_attempt ->> 'score')::numeric, 0),
      coalesce((v_attempt ->> 'points')::integer, 0),
      coalesce((v_attempt ->> 'hintsUsed')::smallint, 0),
      coalesce((v_attempt ->> 'attemptNumber')::smallint, 1),
      nullif(v_attempt ->> 'responseMs', '')::integer,
      v_attempt -> 'evaluation',
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(coalesce(v_attempt -> 'errorTags', '[]'::jsonb))),
        '{}'::text[]
      )
    )
    on conflict (user_id, client_attempt_id) do nothing;

    if found then
      v_inserted := v_inserted + 1;
    end if;

    v_total_points := v_total_points + coalesce((v_attempt ->> 'points')::integer, 0);
    v_earned := v_earned + coalesce((v_attempt ->> 'score')::numeric, 0) * coalesce((v_attempt ->> 'points')::integer, 0);
  end loop;

  v_accuracy := case when v_total_points > 0 then round(v_earned / v_total_points, 3) else 0 end;

  -- 2. Record mistakes for the adaptive engine.
  insert into public.user_mistakes (user_id, language_id, tag, label, skill, count, last_seen_at)
  select
    v_user,
    v_language_id,
    tag,
    tag,
    coalesce((a ->> 'skill')::skill_kind, 'grammar'),
    1,
    now()
  from jsonb_array_elements(coalesce(p_attempts, '[]'::jsonb)) a
  cross join lateral jsonb_array_elements_text(coalesce(a -> 'errorTags', '[]'::jsonb)) tag
  where coalesce((a ->> 'isCorrect')::boolean, false) = false
  on conflict (user_id, language_id, tag)
  do update set count = public.user_mistakes.count + 1, last_seen_at = now(), resolved_at = null;

  -- 3. Lesson progress.
  insert into public.user_progress (
    user_id, lesson_id, status, best_score, last_score, attempts, time_spent_ms, started_at, completed_at
  )
  values (v_user, p_lesson_id, 'completed', v_accuracy, v_accuracy, 1, p_duration_ms, now(), now())
  on conflict (user_id, lesson_id) do update
  set status = 'completed',
      best_score = greatest(public.user_progress.best_score, excluded.best_score),
      last_score = excluded.last_score,
      attempts = public.user_progress.attempts + 1,
      time_spent_ms = public.user_progress.time_spent_ms + excluded.time_spent_ms,
      completed_at = now();

  -- 4. Skill evidence, one row per skill exercised in this lesson.
  insert into public.skill_profiles (user_id, language_id)
  values (v_user, v_language_id)
  on conflict (user_id, language_id) do nothing;

  select id into v_profile_id from public.skill_profiles
  where user_id = v_user and language_id = v_language_id;

  for v_skill in
    select distinct (a ->> 'skill')::skill_kind
    from jsonb_array_elements(coalesce(p_attempts, '[]'::jsonb)) a
    where a ? 'skill'
  loop
    insert into public.skill_evidence (profile_id, skill, cefr, score, source, source_id, weight)
    select
      v_profile_id,
      v_skill,
      v_lesson.cefr,
      round(
        sum(coalesce((a ->> 'score')::numeric, 0) * coalesce((a ->> 'points')::integer, 1))
        / nullif(sum(coalesce((a ->> 'points')::integer, 1)), 0),
        3
      ),
      case when v_lesson.is_checkpoint then 'checkpoint' else 'lesson' end,
      p_lesson_id,
      greatest(1, count(*)::numeric / 4)
    from jsonb_array_elements(coalesce(p_attempts, '[]'::jsonb)) a
    where (a ->> 'skill')::skill_kind = v_skill
    having sum(coalesce((a ->> 'points')::integer, 1)) > 0;
  end loop;

  -- 5. XP (engagement) — deliberately separate from mastery.
  v_xp := 25 + (v_inserted * 2) + round(v_accuracy * 25);
  insert into public.xp_ledger (user_id, source, amount, reference_id)
  values (v_user, 'lesson_complete', v_xp, p_lesson_id);

  -- 6. Streak and daily goal, using the learner's own local date.
  insert into public.streaks (user_id, current, longest, last_active_date)
  values (v_user, 1, 1, p_local_date)
  on conflict (user_id) do update
  set current = case
        when public.streaks.last_active_date = p_local_date then public.streaks.current
        when public.streaks.last_active_date = p_local_date - 1 then public.streaks.current + 1
        else 1
      end,
      longest = greatest(
        public.streaks.longest,
        case
          when public.streaks.last_active_date = p_local_date then public.streaks.current
          when public.streaks.last_active_date = p_local_date - 1 then public.streaks.current + 1
          else 1
        end
      ),
      last_active_date = p_local_date
  returning * into v_streak;

  insert into public.daily_goals (user_id, local_date, target_minutes, minutes_done, lessons_done)
  values (
    v_user,
    p_local_date,
    coalesce((select daily_goal_minutes from public.user_languages
              where user_id = v_user and language_id = v_language_id), 15),
    ceil(p_duration_ms / 60000.0)::integer,
    1
  )
  on conflict (user_id, local_date) do update
  set minutes_done = public.daily_goals.minutes_done + excluded.minutes_done,
      lessons_done = public.daily_goals.lessons_done + 1,
      met = (public.daily_goals.minutes_done + excluded.minutes_done) >= public.daily_goals.target_minutes;

  -- 7. Seed SRS cards for this lesson's new vocabulary.
  insert into public.user_vocabulary (user_id, vocabulary_id)
  select v_user, lv.vocabulary_id
  from public.lesson_vocabulary lv
  where lv.lesson_id = p_lesson_id
  on conflict (user_id, vocabulary_id) do nothing;
  get diagnostics v_new_words = row_count;

  return jsonb_build_object(
    'accuracy', v_accuracy,
    'xp', v_xp,
    'attemptsRecorded', v_inserted,
    'streak', coalesce(v_streak.current, 1),
    'newWords', v_new_words
  );
end;
$$;

revoke all on function public.complete_lesson(uuid, jsonb, bigint, date) from public;
grant execute on function public.complete_lesson(uuid, jsonb, bigint, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Vocabulary review: write back the scheduler's decision computed on device.
-- The interval arithmetic itself lives in @lingonest/core so it behaves
-- identically offline; this function persists the outcome atomically.
-- ---------------------------------------------------------------------------
create or replace function public.record_reviews(p_reviews jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := app.uid();
  v_count integer := 0;
  r jsonb;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_reviews, '[]'::jsonb))
  loop
    update public.user_vocabulary uv
    set state = (r ->> 'state')::srs_state,
        ease = (r ->> 'ease')::numeric,
        interval_days = (r ->> 'intervalDays')::numeric,
        repetitions = (r ->> 'repetitions')::integer,
        lapses = (r ->> 'lapses')::integer,
        step = coalesce((r ->> 'step')::smallint, 0),
        due_at = to_timestamp((r ->> 'dueAt')::bigint / 1000.0),
        last_reviewed_at = now(),
        correct_count = uv.correct_count + case when (r ->> 'correct')::boolean then 1 else 0 end,
        incorrect_count = uv.incorrect_count + case when (r ->> 'correct')::boolean then 0 else 1 end,
        avg_response_ms = case
          when r ? 'responseMs' then
            coalesce((uv.avg_response_ms * (uv.correct_count + uv.incorrect_count) + (r ->> 'responseMs')::integer)
                     / nullif(uv.correct_count + uv.incorrect_count + 1, 0), (r ->> 'responseMs')::integer)
          else uv.avg_response_ms
        end
    where uv.user_id = v_user and uv.vocabulary_id = (r ->> 'vocabularyId')::uuid;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.record_reviews(jsonb) from public;
grant execute on function public.record_reviews(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- What is due for review, with everything the session needs to render.
-- ---------------------------------------------------------------------------
create or replace function public.due_reviews(p_language_code text, p_limit integer default 30)
returns table (
  vocabulary_id uuid,
  term text,
  translation text,
  example_sentence text,
  audio_asset_key text,
  cefr cefr_level,
  state srs_state,
  ease numeric,
  interval_days numeric,
  repetitions integer,
  lapses integer,
  step smallint,
  due_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    v.id, v.term, v.translation, v.example_sentence, v.audio_asset_key, v.cefr,
    uv.state, uv.ease, uv.interval_days, uv.repetitions, uv.lapses, uv.step, uv.due_at
  from public.user_vocabulary uv
  join public.vocabulary_items v on v.id = uv.vocabulary_id
  join public.languages l on l.id = v.language_id
  where uv.user_id = app.uid()
    and l.code = p_language_code
    and uv.due_at <= now()
  -- Leeches first while the learner is fresh, then most overdue.
  order by (uv.state = 'leech') desc, uv.due_at asc
  limit greatest(1, least(p_limit, 200));
$$;

grant execute on function public.due_reviews(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Teacher search. Filtering and ranking run in the database so the client
-- never downloads the whole marketplace.
-- ---------------------------------------------------------------------------
create or replace function public.search_teachers(
  p_language_code text default null,
  p_max_price_cents integer default null,
  p_min_rating numeric default null,
  p_specialties text[] default null,
  p_native_only boolean default false,
  p_certified_only boolean default false,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  headline text,
  country char(2),
  hourly_rate_cents integer,
  currency char(3),
  rating_avg numeric,
  rating_count integer,
  lessons_taught integer,
  specialties text[],
  teaching_languages jsonb,
  identity_verified boolean,
  certification_verified boolean,
  slots_next_7_days integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with candidate as (
    select t.*, p.display_name, p.avatar_url
    from public.teachers t
    join public.profiles p on p.id = t.user_id
    where t.status = 'approved'
      and t.payout_enabled
      and (p_language_code is null or exists (
        select 1 from jsonb_array_elements(t.teaching_languages) tl
        where tl ->> 'languageCode' = p_language_code
          and (not p_native_only or coalesce((tl ->> 'isNative')::boolean, false))
      ))
      and (p_max_price_cents is null or t.hourly_rate_cents <= p_max_price_cents)
      and (p_min_rating is null or t.rating_avg >= p_min_rating)
      and (p_specialties is null or t.specialties && p_specialties)
  ),
  verified as (
    select
      c.*,
      exists (
        select 1 from public.teacher_verifications v
        where v.teacher_id = c.user_id and v.kind = 'identity' and v.status = 'verified'
          and (v.expires_at is null or v.expires_at > now())
      ) as identity_verified,
      exists (
        select 1 from public.teacher_verifications v
        where v.teacher_id = c.user_id and v.kind = 'certification' and v.status = 'verified'
          and (v.expires_at is null or v.expires_at > now())
      ) as certification_verified,
      (
        select count(*)::integer from public.teacher_availability ta
        where ta.teacher_id = c.user_id
          and (ta.valid_to is null or ta.valid_to >= current_date)
      ) * 3 as slots_next_7_days
    from candidate c
  )
  select
    v.user_id, v.display_name, v.avatar_url, v.headline, v.country,
    v.hourly_rate_cents, v.currency, v.rating_avg, v.rating_count, v.lessons_taught,
    v.specialties, v.teaching_languages, v.identity_verified, v.certification_verified,
    v.slots_next_7_days
  from verified v
  where (not p_certified_only or v.certification_verified)
  order by
    -- Bayesian rating so one five-star review cannot outrank a long record.
    ((v.rating_avg * v.rating_count + 4.5 * 12) / (v.rating_count + 12)) * 0.4
    + v.reliability * 0.2
    + v.response_rate * 0.15
    + least(1, v.slots_next_7_days / 20.0) * 0.2
    + case when v.lessons_taught < 10 and v.created_at > now() - interval '45 days' then 0.05 else 0 end
    desc
  limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
$$;

grant execute on function public.search_teachers(text, integer, numeric, text[], boolean, boolean, integer, integer) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- What a teacher sees about a learner they teach. The relationship check is in
-- the function, so there is no way to ask for a stranger's data.
-- ---------------------------------------------------------------------------
create or replace function public.learner_snapshot_for_teacher(p_learner uuid, p_language_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_teacher uuid := app.uid();
  v_result jsonb;
begin
  if not app.teacher_can_view_learner(v_teacher, p_learner) and not app.is_admin() then
    raise exception 'no_teaching_relationship';
  end if;

  select jsonb_build_object(
    'skills', (
      select to_jsonb(sp) - 'id' - 'user_id'
      from public.skill_profiles sp
      join public.languages l on l.id = sp.language_id
      where sp.user_id = p_learner and l.code = p_language_code
    ),
    'weakAreas', (
      select coalesce(jsonb_agg(jsonb_build_object('tag', m.tag, 'label', m.label, 'skill', m.skill, 'count', m.count)
             order by m.count desc), '[]'::jsonb)
      from public.user_mistakes m
      join public.languages l on l.id = m.language_id
      where m.user_id = p_learner and l.code = p_language_code
        and m.resolved_at is null and m.last_seen_at > now() - interval '60 days'
      limit 10
    ),
    'recentLessons', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'lessonId', up.lesson_id, 'title', ls.title, 'score', up.best_score, 'completedAt', up.completed_at
      ) order by up.completed_at desc), '[]'::jsonb)
      from public.user_progress up
      join public.lessons ls on ls.id = up.lesson_id
      where up.user_id = p_learner and up.status = 'completed'
      limit 10
    ),
    'vocabulary', (
      select jsonb_build_object(
        'due', count(*) filter (where uv.due_at <= now()),
        'learning', count(*) filter (where uv.state = 'learning'),
        'mastered', count(*) filter (where uv.state = 'mastered'),
        'leeches', count(*) filter (where uv.state = 'leech')
      )
      from public.user_vocabulary uv
      where uv.user_id = p_learner
    ),
    'goal', (
      select jsonb_build_object('goal', ul.goal, 'dailyMinutes', ul.daily_goal_minutes)
      from public.user_languages ul
      join public.languages l on l.id = ul.language_id
      where ul.user_id = p_learner and l.code = p_language_code
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.learner_snapshot_for_teacher(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Serve one assessment item without its answer key.
-- ---------------------------------------------------------------------------
create or replace function public.next_assessment_item(p_attempt uuid, p_cefr cefr_level, p_seen uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'itemId', ai.id,
    'cefr', ai.cefr,
    'skill', ai.skill,
    'activity', coalesce(
      ai.inline_activity - 'correctAnswer' - 'acceptableAnswers',
      jsonb_build_object(
        'id', la.id,
        'type', la.type,
        'stage', la.stage,
        'skill', la.skill,
        'cefr', la.cefr,
        'difficulty', la.difficulty,
        'prompt', la.prompt,
        'media', la.media,
        'points', la.points,
        'timeLimitSeconds', la.time_limit_seconds
      )
    )
  )
  from public.assessment_items ai
  join public.assessment_attempts aa on aa.assessment_id = ai.assessment_id
  left join public.lesson_activities la on la.id = ai.activity_id
  where aa.id = p_attempt
    and aa.user_id = app.uid()
    and ai.cefr = p_cefr
    and not (ai.id = any(coalesce(p_seen, '{}'::uuid[])))
  order by random()
  limit 1;
$$;

grant execute on function public.next_assessment_item(uuid, cefr_level, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- GDPR erasure. Financial records are retained (legal obligation) but
-- de-identified.
-- ---------------------------------------------------------------------------
create or replace function public.erase_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public, analytics, pg_temp
as $$
begin
  if not app.is_admin() and app.uid() <> p_user then
    raise exception 'forbidden';
  end if;

  delete from analytics.events where user_id = p_user;
  delete from public.ai_messages where session_id in (select id from public.ai_sessions where user_id = p_user);
  delete from public.messages where sender_id = p_user;
  update public.reviews set body = null, learner_id = learner_id where learner_id = p_user;
  update public.profiles
  set display_name = 'Deleted user',
      avatar_url = null,
      bio = null,
      country = null,
      date_of_birth = null,
      guardian_email = null,
      deleted_at = now()
  where id = p_user;

  -- auth.users deletion cascades the rest; payments keep their user_id for
  -- accounting but the profile behind it is now anonymous.
  delete from auth.users where id = p_user;
end;
$$;

revoke all on function public.erase_user(uuid) from public;
grant execute on function public.erase_user(uuid) to authenticated;
