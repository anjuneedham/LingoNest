-- ---------------------------------------------------------------------------
-- Analytics views. Definitions live here so "DAU" means one thing across the
-- admin dashboard, the exports and any future warehouse sync.
-- ---------------------------------------------------------------------------

create or replace view analytics.daily_active_users as
select
  date_trunc('day', ts)::date as day,
  count(distinct user_id) as dau
from analytics.events
where user_id is not null
group by 1;

create or replace view analytics.rolling_active_users as
select
  d.day,
  (select count(distinct e.user_id) from analytics.events e
   where e.ts >= d.day - interval '6 days' and e.ts < d.day + interval '1 day') as wau,
  (select count(distinct e.user_id) from analytics.events e
   where e.ts >= d.day - interval '29 days' and e.ts < d.day + interval '1 day') as mau
from (select distinct date_trunc('day', ts)::date as day from analytics.events) d;

-- Retention by signup cohort. "Returned" means any event on the target day.
create or replace view analytics.retention as
with cohort as (
  select
    p.id as user_id,
    date_trunc('day', p.created_at)::date as cohort_day
  from public.profiles p
),
activity as (
  select distinct user_id, date_trunc('day', ts)::date as active_day
  from analytics.events
  where user_id is not null
)
select
  c.cohort_day,
  count(distinct c.user_id) as cohort_size,
  count(distinct a1.user_id) filter (where a1.active_day = c.cohort_day + 1) as d1,
  count(distinct a1.user_id) filter (where a1.active_day = c.cohort_day + 7) as d7,
  count(distinct a1.user_id) filter (where a1.active_day = c.cohort_day + 30) as d30
from cohort c
left join activity a1 on a1.user_id = c.user_id
group by c.cohort_day;

-- The primary retention metric (brief §71): meaningful learning sessions, not
-- app opens. A session counts when the learner completed a lesson, attended a
-- tutor lesson, held a real AI conversation, or did sustained practice.
create or replace view analytics.meaningful_sessions as
select
  user_id,
  date_trunc('week', ts)::date as week,
  count(*) filter (where name = 'lesson_completed') as lessons,
  count(*) filter (where name = 'lesson_attended') as tutor_lessons,
  count(*) filter (where name = 'ai_practice_completed' and (props ->> 'turns')::int >= 6) as ai_sessions,
  count(*) filter (where name = 'review_session_completed' and (props ->> 'itemCount')::int >= 8) as review_sessions
from analytics.events
where user_id is not null
group by 1, 2;

create or replace view analytics.lesson_funnel as
select
  date_trunc('day', ts)::date as day,
  props ->> 'cefr' as cefr,
  count(*) filter (where name = 'lesson_started') as started,
  count(*) filter (where name = 'lesson_completed') as completed,
  round(
    count(*) filter (where name = 'lesson_completed')::numeric
    / nullif(count(*) filter (where name = 'lesson_started'), 0),
    3
  ) as completion_rate
from analytics.events
where name in ('lesson_started', 'lesson_completed')
group by 1, 2;

create or replace view analytics.marketplace_revenue as
select
  date_trunc('day', p.created_at)::date as day,
  p.currency,
  sum(p.amount_cents) filter (where p.kind in ('booking', 'package')) as gmv_cents,
  sum(p.application_fee_cents) filter (where p.kind in ('booking', 'package')) as platform_fee_cents,
  sum(p.amount_cents) filter (where p.kind = 'subscription') as subscription_cents,
  count(*) filter (where p.kind = 'booking') as bookings
from public.payments p
where p.status = 'succeeded'
group by 1, 2;

create or replace view analytics.subscription_health as
select
  date_trunc('day', s.created_at)::date as day,
  s.plan_code,
  s.platform,
  count(*) filter (where s.status in ('active', 'trialing')) as active,
  count(*) filter (where s.status = 'canceled') as cancelled,
  count(*) filter (where s.status = 'past_due') as past_due
from public.subscriptions s
group by 1, 2, 3;

create or replace view analytics.booking_health as
select
  date_trunc('week', b.starts_at)::date as week,
  count(*) as total,
  count(*) filter (where b.status = 'completed') as completed,
  count(*) filter (where b.status in ('cancelled_by_learner', 'cancelled_by_teacher')) as cancelled,
  count(*) filter (where b.status in ('no_show_learner', 'no_show_teacher')) as no_shows,
  count(distinct b.learner_id) as learners,
  count(distinct b.teacher_id) as teachers
from public.bookings b
group by 1;

-- Repeat booking rate: the health signal for the marketplace.
create or replace view analytics.repeat_bookings as
with per_learner as (
  select learner_id, count(*) as completed
  from public.bookings
  where status = 'completed'
  group by learner_id
)
select
  count(*) filter (where completed >= 1) as learners_with_one,
  count(*) filter (where completed >= 2) as learners_with_two,
  round(
    count(*) filter (where completed >= 2)::numeric / nullif(count(*) filter (where completed >= 1), 0),
    3
  ) as repeat_rate
from per_learner;

-- Admin dashboard reads through this function, which enforces the role check
-- (views alone do not carry RLS from the underlying analytics tables).
create or replace function public.admin_dashboard(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, analytics, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not app.is_admin() then
    raise exception 'forbidden';
  end if;

  select jsonb_build_object(
    'dau', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', dau) order by day),'[]'::jsonb)
            from analytics.daily_active_users where day > current_date - p_days),
    'retention', (select coalesce(jsonb_agg(to_jsonb(r) order by r.cohort_day desc), '[]'::jsonb)
                  from analytics.retention r where r.cohort_day > current_date - p_days),
    'lessonFunnel', (select coalesce(jsonb_agg(to_jsonb(f) order by f.day desc), '[]'::jsonb)
                     from analytics.lesson_funnel f where f.day > current_date - p_days),
    'revenue', (select coalesce(jsonb_agg(to_jsonb(m) order by m.day desc), '[]'::jsonb)
                from analytics.marketplace_revenue m where m.day > current_date - p_days),
    'subscriptions', (select coalesce(jsonb_agg(to_jsonb(s) order by s.day desc), '[]'::jsonb)
                      from analytics.subscription_health s where s.day > current_date - p_days),
    'bookings', (select coalesce(jsonb_agg(to_jsonb(b) order by b.week desc), '[]'::jsonb)
                 from analytics.booking_health b where b.week > current_date - p_days),
    'repeatBookings', (select to_jsonb(r) from analytics.repeat_bookings r),
    'counts', jsonb_build_object(
      'users', (select count(*) from public.profiles where deleted_at is null),
      'teachers', (select count(*) from public.teachers where status = 'approved'),
      'pendingApplications', (select count(*) from public.teacher_applications where status in ('pending','under_review')),
      'openReports', (select count(*) from public.reports where state = 'open'),
      'publishedLessons', (select count(*) from public.lessons where status = 'published')
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_dashboard(integer) from public;
grant execute on function public.admin_dashboard(integer) to authenticated;
