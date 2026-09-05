-- ---------------------------------------------------------------------------
-- Teacher marketplace: applications, verification, availability, packages,
-- bookings, assignments and reviews.
-- ---------------------------------------------------------------------------

create table public.teachers (
  user_id uuid primary key references public.profiles (id) on delete restrict,
  headline text not null default '',
  bio text not null default '',
  intro_video_asset text,
  country char(2),
  timezone text not null default 'UTC',
  -- [{languageCode, variantCode, isNative}]
  teaching_languages jsonb not null default '[]'::jsonb,
  -- [{languageCode, cefr}]
  speaks_languages jsonb not null default '[]'::jsonb,
  specialties text[] not null default '{}',
  hourly_rate_cents integer not null default 2500 check (hourly_rate_cents >= 0),
  trial_rate_cents integer check (trial_rate_cents is null or trial_rate_cents >= 0),
  currency char(3) not null default 'USD',
  lesson_minutes integer not null default 60 check (lesson_minutes in (25, 30, 45, 50, 60, 90)),
  status teacher_status not null default 'pending',
  rating_avg numeric(3, 2) not null default 0 check (rating_avg between 0 and 5),
  rating_count integer not null default 0,
  lessons_taught integer not null default 0,
  response_rate numeric(4, 3) not null default 1,
  reliability numeric(4, 3) not null default 1,
  commission_override_bps integer check (commission_override_bps is null or commission_override_bps between 0 and 10000),
  stripe_account_id text unique,
  payout_enabled boolean not null default false,
  teaches_minors boolean not null default false,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teachers_status_idx on public.teachers (status) where status = 'approved';
create index teachers_languages_idx on public.teachers using gin (teaching_languages);
create index teachers_specialties_idx on public.teachers using gin (specialties);

create table public.teacher_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  payload jsonb not null,
  status teacher_status not null default 'pending',
  reviewer_id uuid references public.profiles (id),
  review_notes text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teacher_applications_queue_idx on public.teacher_applications (status, submitted_at);

create table public.teacher_verifications (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (user_id) on delete cascade,
  kind verification_kind not null,
  status verification_status not null default 'pending',
  -- Private storage path; readable only by the owner and admins.
  evidence_path text,
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (teacher_id, kind)
);

create table public.teacher_availability (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (user_id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  -- Stored with the zone so a DST change does not silently move the teacher's
  -- working hours.
  timezone text not null,
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now()
);

create index teacher_availability_teacher_idx on public.teacher_availability (teacher_id, weekday);

create table public.teacher_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (user_id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('block', 'extra')),
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz not null default now()
);

create index teacher_availability_exceptions_idx on public.teacher_availability_exceptions (teacher_id, date);

create table public.lesson_packages (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (user_id) on delete cascade,
  name text not null,
  lesson_count integer not null check (lesson_count between 2 and 50),
  price_cents integer not null check (price_cents >= 0),
  currency char(3) not null default 'USD',
  expires_after_days integer not null default 180,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.package_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  package_id uuid not null references public.lesson_packages (id) on delete restrict,
  teacher_id uuid not null references public.teachers (user_id) on delete restrict,
  lessons_total integer not null,
  lessons_used integer not null default 0 check (lessons_used >= 0),
  price_cents integer not null,
  currency char(3) not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (lessons_used <= lessons_total)
);

create index package_purchases_user_idx on public.package_purchases (user_id, teacher_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles (id) on delete restrict,
  teacher_id uuid not null references public.teachers (user_id) on delete restrict,
  language_id uuid not null references public.languages (id) on delete restrict,
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 15 and 180),
  -- Maintained by a trigger rather than a generated column: adding an interval
  -- to a timestamptz is only STABLE, which generated columns and exclusion
  -- constraints both reject.
  ends_at timestamptz not null default now(),
  status booking_status not null default 'pending_payment',
  price_cents integer not null check (price_cents >= 0),
  currency char(3) not null default 'USD',
  commission_bps integer not null check (commission_bps between 0 and 10000),
  teacher_earnings_cents integer not null check (teacher_earnings_cents >= 0),
  package_purchase_id uuid references public.package_purchases (id) on delete set null,
  video_room_id text,
  learner_notes text,
  teacher_notes text,
  focus_areas jsonb not null default '[]'::jsonb,
  learner_joined_at timestamptz,
  teacher_joined_at timestamptz,
  cancellation_reason text,
  cancelled_by uuid references public.profiles (id),
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_earnings_within_price check (teacher_earnings_cents <= price_cents)
);

create index bookings_teacher_idx on public.bookings (teacher_id, starts_at);
create index bookings_learner_idx on public.bookings (learner_id, starts_at desc);
create index bookings_upcoming_idx on public.bookings (starts_at) where status in ('pending_payment', 'confirmed');

create or replace function app.set_booking_ends_at()
returns trigger
language plpgsql
as $$
begin
  new.ends_at := new.starts_at + make_interval(mins => new.duration_minutes);
  return new;
end;
$$;

create trigger bookings_set_ends_at
  before insert or update of starts_at, duration_minutes on public.bookings
  for each row execute function app.set_booking_ends_at();

-- A teacher physically cannot be in two lessons at once. The exclusion
-- constraint makes double-booking impossible even under concurrent requests,
-- without the application needing to hold a lock correctly.
alter table public.bookings
  add constraint bookings_no_teacher_overlap
  exclude using gist (
    teacher_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
  where (status in ('pending_payment', 'confirmed', 'in_progress', 'completed'));

create table public.booking_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  teacher_id uuid not null references public.teachers (user_id) on delete cascade,
  learner_id uuid not null references public.profiles (id) on delete cascade,
  kind assignment_kind not null,
  target_ref text,
  title text not null,
  instructions text,
  due_at timestamptz,
  status assignment_status not null default 'assigned',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index booking_assignments_learner_idx on public.booking_assignments (learner_id, status);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  learner_id uuid not null references public.profiles (id) on delete cascade,
  teacher_id uuid not null references public.teachers (user_id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text,
  teacher_reply text,
  teacher_replied_at timestamptz,
  status text not null default 'published' check (status in ('published', 'hidden', 'flagged', 'removed')),
  created_at timestamptz not null default now()
);

create index reviews_teacher_idx on public.reviews (teacher_id, created_at desc) where status = 'published';

-- A review may only exist for a lesson that actually happened.
create or replace function app.enforce_review_after_completion()
returns trigger
language plpgsql
as $$
declare
  booking_status_value booking_status;
  booking_learner uuid;
begin
  select status, learner_id into booking_status_value, booking_learner
  from public.bookings where id = new.booking_id;

  if booking_status_value is distinct from 'completed' then
    raise exception 'review_requires_completed_booking';
  end if;
  if booking_learner is distinct from new.learner_id then
    raise exception 'review_author_must_be_the_learner';
  end if;
  return new;
end;
$$;

create trigger reviews_require_completed_booking
  before insert on public.reviews
  for each row execute function app.enforce_review_after_completion();

-- Ratings are recomputed by the database, never written by a client.
create or replace function app.recompute_teacher_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid := coalesce(new.teacher_id, old.teacher_id);
begin
  update public.teachers t
  set rating_avg = coalesce(stats.avg_rating, 0),
      rating_count = coalesce(stats.total, 0)
  from (
    select avg(rating)::numeric(3, 2) as avg_rating, count(*) as total
    from public.reviews
    where teacher_id = target and status = 'published'
  ) stats
  where t.user_id = target;
  return null;
end;
$$;

create trigger reviews_recompute_rating
  after insert or update or delete on public.reviews
  for each row execute function app.recompute_teacher_rating();

create trigger teachers_touch before update on public.teachers for each row execute function app.touch_updated_at();
create trigger teacher_applications_touch before update on public.teacher_applications for each row execute function app.touch_updated_at();
create trigger bookings_touch before update on public.bookings for each row execute function app.touch_updated_at();
create trigger lesson_packages_touch before update on public.lesson_packages for each row execute function app.touch_updated_at();

comment on constraint bookings_no_teacher_overlap on public.bookings is
  'Makes double-booking a teacher impossible at the database level, regardless of application concurrency.';
