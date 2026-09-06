-- The publish-validation trigger's answer-key exemption list only covered
-- types that are graded by rubric (conversation, roleplay,
-- scenario_simulation) or have nothing to check (flashcard, review_challenge).
-- It never accounted for the other class the content package's own
-- authoring-time validator already recognises: activities whose answer lives
-- inside the prompt itself rather than in a stored correct_answer —
-- word_match (the pairs are the answer), pronunciation_repeat (graded
-- against the prompt's own reference text), and timed_challenge (graded
-- per-item against the prompt at runtime). Every real course had activities
-- of these types, so no lesson containing one could ever be published —
-- caught by actually running a seed against real content instead of an
-- empty schema.

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

  select count(*) into missing_answer_keys
  from public.lesson_activities a
  where a.lesson_id = new.id
    and a.correct_answer is null
    and a.rubric is null
    and a.type not in (
      'conversation', 'roleplay', 'scenario_simulation', 'flashcard', 'review_challenge',
      'word_match', 'pronunciation_repeat', 'timed_challenge'
    );
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
