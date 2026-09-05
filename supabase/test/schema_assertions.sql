-- ---------------------------------------------------------------------------
-- Assertions run against the freshly migrated schema. Each failure aborts the
-- script, so a regression fails CI rather than reaching a project.
-- ---------------------------------------------------------------------------
\set ON_ERROR_STOP on

do $$
declare
  missing text;
  n integer;
begin
  -- Every public table has RLS enabled and at least one policy.
  select string_agg(c.relname, ', ')
  into missing
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if missing is not null then
    raise exception 'Tables without RLS enabled: %', missing;
  end if;

  select string_agg(t.tablename, ', ')
  into missing
  from pg_tables t
  where t.schemaname = 'public'
    and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename);
  if missing is not null then
    raise exception 'Tables without policies: %', missing;
  end if;

  -- Core entities from the specification all exist.
  foreach missing in array array[
    'profiles','user_roles','languages','language_variants','levels','courses','units','lessons',
    'lesson_activities','vocabulary_items','grammar_topics','culture_notes','conversation_scenarios',
    'user_languages','skill_profiles','skill_evidence','user_progress','activity_attempts',
    'user_vocabulary','user_mistakes','assessments','assessment_items','assessment_attempts',
    'level_readiness','ai_sessions','ai_messages','ai_usage_counters','teachers','teacher_applications',
    'teacher_verifications','teacher_availability','bookings','lesson_packages','package_purchases',
    'payments','payouts','refunds','subscriptions','subscription_plans','commission_tiers',
    'conversations','messages','reviews','community_posts','reports','notifications','referrals',
    'promotions','achievements','user_achievements','remote_config','feature_flags'
  ]
  loop
    if to_regclass('public.' || missing) is null then
      raise exception 'Missing table: %', missing;
    end if;
  end loop;

  -- Every foreign key column is indexed (avoids slow cascades and lock storms).
  select string_agg(format('%s.%s', conrelid::regclass, att.attname), ', ')
  into missing
  from pg_constraint con
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
  where con.contype = 'f'
    and connamespace = 'public'::regnamespace
    and array_length(con.conkey, 1) = 1
    and not exists (
      select 1 from pg_index i
      where i.indrelid = con.conrelid and i.indkey[0] = con.conkey[1]
    );
  if missing is not null then
    raise exception 'Foreign keys without a leading index: %', missing;
  end if;

  -- Money columns must be integers, never floating point.
  select string_agg(format('%s.%s', c.table_name, c.column_name), ', ')
  into missing
  from information_schema.columns c
  where c.table_schema = 'public'
    and (c.column_name like '%_cents' or c.column_name like '%_bps')
    and c.data_type not in ('integer', 'bigint', 'smallint');
  if missing is not null then
    raise exception 'Money columns with a non-integer type: %', missing;
  end if;

  select count(*) into n from public.subscription_plans;
  if n < 3 then raise exception 'Expected the three seeded subscription plans, found %', n; end if;

  select count(*) into n from public.commission_tiers where active;
  if n < 4 then raise exception 'Expected the four seeded commission tiers, found %', n; end if;
end $$;

-- --------------------------------------------------------------------------
-- Behavioural checks
-- --------------------------------------------------------------------------

-- A teacher cannot be double-booked, even by a direct insert.
do $$
declare
  v_user uuid := gen_random_uuid();
  v_teacher uuid := gen_random_uuid();
  v_language uuid;
  v_start timestamptz := now() + interval '3 days';
begin
  insert into auth.users (id, email) values (v_user, 'learner@test.invalid'), (v_teacher, 'teacher@test.invalid');
  insert into public.teachers (user_id) values (v_teacher);
  insert into public.languages (code, name, native_name, status)
  values ('zz', 'Testish', 'Testish', 'published') returning id into v_language;

  insert into public.bookings (learner_id, teacher_id, language_id, starts_at, duration_minutes,
                               status, price_cents, currency, commission_bps, teacher_earnings_cents)
  values (v_user, v_teacher, v_language, v_start, 60, 'confirmed', 2500, 'USD', 2000, 2000);

  begin
    insert into public.bookings (learner_id, teacher_id, language_id, starts_at, duration_minutes,
                                 status, price_cents, currency, commission_bps, teacher_earnings_cents)
    values (v_user, v_teacher, v_language, v_start + interval '30 minutes', 60, 'confirmed', 2500, 'USD', 2000, 2000);
    raise exception 'Overlapping booking was allowed';
  exception when exclusion_violation then
    null; -- expected
  end;

  -- A teacher may not be paid more than the learner was charged.
  begin
    insert into public.bookings (learner_id, teacher_id, language_id, starts_at, duration_minutes,
                                 status, price_cents, currency, commission_bps, teacher_earnings_cents)
    values (v_user, v_teacher, v_language, v_start + interval '5 days', 60, 'confirmed', 2500, 'USD', 2000, 9999);
    raise exception 'Earnings above the lesson price were allowed';
  exception when check_violation then
    null; -- expected
  end;
end $$;

-- A review requires a completed booking.
do $$
declare
  v_learner uuid := gen_random_uuid();
  v_teacher uuid := gen_random_uuid();
  v_language uuid;
  v_booking uuid;
begin
  insert into auth.users (id, email) values (v_learner, 'l2@test.invalid'), (v_teacher, 't2@test.invalid');
  insert into public.teachers (user_id) values (v_teacher);
  select id into v_language from public.languages where code = 'zz';

  insert into public.bookings (learner_id, teacher_id, language_id, starts_at, duration_minutes,
                               status, price_cents, currency, commission_bps, teacher_earnings_cents)
  values (v_learner, v_teacher, v_language, now() + interval '20 days', 60, 'confirmed', 2500, 'USD', 2000, 2000)
  returning id into v_booking;

  begin
    insert into public.reviews (booking_id, learner_id, teacher_id, rating, body)
    values (v_booking, v_learner, v_teacher, 5, 'Great lesson');
    raise exception 'Review on a non-completed booking was allowed';
  exception when others then
    if sqlerrm not like '%review_requires_completed_booking%' then raise; end if;
  end;

  update public.bookings set status = 'completed' where id = v_booking;
  insert into public.reviews (booking_id, learner_id, teacher_id, rating, body)
  values (v_booking, v_learner, v_teacher, 5, 'Great lesson');

  -- The rating trigger recomputes the teacher's average.
  if (select rating_count from public.teachers where user_id = v_teacher) <> 1 then
    raise exception 'Teacher rating was not recomputed';
  end if;
end $$;

-- Minor status is derived server-side, never asserted by the client.
do $$
declare
  v_user uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (v_user, 'minor@test.invalid');
  update public.profiles set date_of_birth = current_date - interval '15 years', is_minor = false
  where id = v_user;
  if not (select is_minor from public.profiles where id = v_user) then
    raise exception 'is_minor was not derived from the date of birth';
  end if;
  if (select account_type from public.profiles where id = v_user) <> 'teen' then
    raise exception 'account_type was not derived from the date of birth';
  end if;
end $$;

-- A lesson cannot be published without the pieces that make it teachable.
do $$
declare
  v_language uuid;
  v_level uuid;
  v_course uuid;
  v_unit uuid;
  v_lesson uuid;
begin
  select id into v_language from public.languages where code = 'zz';
  insert into public.levels (language_id, cefr, ordinal, status) values (v_language, 'A1', 1, 'published')
  returning id into v_level;
  insert into public.courses (language_id, level_id, slug, title, status)
  values (v_language, v_level, 'zz-a1', 'Testish A1', 'published') returning id into v_course;
  insert into public.units (course_id, ordinal, slug, title, objective, cefr, status)
  values (v_course, 1, 'u1', 'Unit 1', 'Say hello', 'A1', 'published') returning id into v_unit;

  insert into public.lessons (unit_id, ordinal, slug, title, objective, can_do, cefr, skills, status)
  values (v_unit, 1, 'zz-a1-u1-l1', 'Hello', 'Greet someone', 'I can greet someone', 'A1',
          '{speaking,vocabulary}', 'draft')
  returning id into v_lesson;

  begin
    update public.lessons set status = 'published' where id = v_lesson;
    raise exception 'A lesson with no activities was publishable';
  exception when others then
    if sqlerrm not like '%three_activities%' then raise; end if;
  end;

  insert into public.lesson_activities (lesson_id, ordinal, type, stage, skill, cefr, prompt, correct_answer)
  values
    (v_lesson, 1, 'multiple_choice', 'practice', 'vocabulary', 'A1', '{"question":"?","options":[]}', '"a"'),
    (v_lesson, 2, 'fill_blank', 'practice', 'grammar', 'A1', '{"template":"{{blank}}"}', '["x"]'),
    (v_lesson, 3, 'sentence_order', 'build', 'grammar', 'A1', '{"instruction":"i","tokens":["a","b"]}', '["a","b"]');

  update public.lessons set status = 'published' where id = v_lesson;

  -- AI-drafted content still needs a recorded human approval.
  update public.lessons set status = 'draft', generated_by = 'ai' where id = v_lesson;
  begin
    update public.lessons set status = 'published' where id = v_lesson;
    raise exception 'AI-drafted content was published without human approval';
  exception when others then
    if sqlerrm not like '%ai_content_requires_human_approval%' then raise; end if;
  end;

  insert into public.content_approvals (entity_type, entity_id, to_status, approved_by)
  values ('lesson', v_lesson, 'approved', (select id from public.profiles limit 1));
  update public.lessons set status = 'published' where id = v_lesson;
end $$;

-- Exactly one default variant per language, and one entitling subscription.
do $$
declare
  v_language uuid;
  v_user uuid := gen_random_uuid();
begin
  select id into v_language from public.languages where code = 'zz';
  insert into public.language_variants (language_id, code, label, is_default)
  values (v_language, 'zz-A', 'Variant A', true);
  begin
    insert into public.language_variants (language_id, code, label, is_default)
    values (v_language, 'zz-B', 'Variant B', true);
    raise exception 'Two default variants were allowed for one language';
  exception when unique_violation then
    null;
  end;

  insert into auth.users (id, email) values (v_user, 'sub@test.invalid');
  insert into public.subscriptions (user_id, plan_code, status, provider_ref)
  values (v_user, 'premium', 'active', 'sub_1');
  begin
    insert into public.subscriptions (user_id, plan_code, status, provider_ref)
    values (v_user, 'premium_plus', 'active', 'sub_2');
    raise exception 'A second entitling subscription was allowed';
  exception when unique_violation then
    null;
  end;
end $$;

-- Privileged actions are audited.
do $$
declare
  n integer;
begin
  select count(*) into n from audit.audit_log where entity_type = 'teachers';
  if n = 0 then
    raise exception 'Teacher changes were not audited';
  end if;
end $$;

-- complete_lesson is transactional and idempotent per client attempt id.
do $$
declare
  v_user uuid := gen_random_uuid();
  v_lesson uuid;
  v_attempt_id uuid := gen_random_uuid();
  v_attempts jsonb;
  v_result jsonb;
  v_rows integer;
begin
  insert into auth.users (id, email) values (v_user, 'complete@test.invalid');
  select id into v_lesson from public.lessons where status = 'published' limit 1;

  -- Impersonate the learner so the function's app.uid() resolves to them.
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user::text)::text,
    true
  );

  v_attempts := jsonb_build_array(
    jsonb_build_object(
      'clientAttemptId', v_attempt_id, 'activityType', 'multiple_choice', 'skill', 'vocabulary',
      'cefr', 'A1', 'isCorrect', true, 'score', 1, 'points', 10, 'hintsUsed', 0,
      'attemptNumber', 1, 'responseMs', 2400, 'errorTags', '[]'::jsonb
    ),
    jsonb_build_object(
      'clientAttemptId', gen_random_uuid(), 'activityType', 'fill_blank', 'skill', 'grammar',
      'cefr', 'A1', 'isCorrect', false, 'score', 0, 'points', 10, 'hintsUsed', 1,
      'attemptNumber', 1, 'responseMs', 8000, 'errorTags', '["grammar:zz-present"]'::jsonb
    )
  );

  v_result := public.complete_lesson(v_lesson, v_attempts, 300000, current_date);

  if (v_result ->> 'accuracy')::numeric <> 0.5 then
    raise exception 'Expected accuracy 0.5, got %', v_result ->> 'accuracy';
  end if;
  if (v_result ->> 'attemptsRecorded')::int <> 2 then
    raise exception 'Expected two attempts recorded, got %', v_result ->> 'attemptsRecorded';
  end if;

  -- The wrong answer produced a mistake row for the adaptive engine.
  select count(*) into v_rows from public.user_mistakes
  where user_id = v_user and tag = 'grammar:zz-present';
  if v_rows <> 1 then raise exception 'Mistake was not recorded'; end if;

  -- Skill evidence was appended for both skills exercised.
  select count(*) into v_rows
  from public.skill_evidence se
  join public.skill_profiles sp on sp.id = se.profile_id
  where sp.user_id = v_user;
  if v_rows <> 2 then raise exception 'Expected evidence for two skills, got %', v_rows; end if;

  -- Replaying the same batch (an offline sync retry) must not double-count.
  v_result := public.complete_lesson(v_lesson, v_attempts, 300000, current_date);
  select count(*) into v_rows from public.activity_attempts where user_id = v_user;
  if v_rows <> 2 then raise exception 'Replaying a queued batch double-counted attempts: %', v_rows; end if;

  -- Streak started at one day.
  if (select current from public.streaks where user_id = v_user) <> 1 then
    raise exception 'Streak was not started';
  end if;

  perform set_config('request.jwt.claims', '', true);
end $$;

-- A teacher cannot read a learner they have no booking relationship with.
do $$
declare
  v_teacher uuid;
  v_learner uuid;
begin
  select user_id into v_teacher from public.teachers limit 1;
  select id into v_learner from public.profiles where id <> v_teacher limit 1;
  if app.teacher_can_view_learner(v_teacher, gen_random_uuid()) then
    raise exception 'A teacher could view a learner they have never taught';
  end if;
end $$;

select 'schema assertions passed' as result;
