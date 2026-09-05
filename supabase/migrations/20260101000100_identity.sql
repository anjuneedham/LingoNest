-- ---------------------------------------------------------------------------
-- Identity: profiles, roles, devices, notification preferences.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 80),
  avatar_url text,
  country char(2),
  timezone text not null default 'UTC',
  ui_locale text not null default 'en',
  date_of_birth date,
  account_type account_type not null default 'adult',
  is_minor boolean not null default false,
  guardian_email text,
  guardian_consent_at timestamptz,
  bio text,
  onboarding_completed_at timestamptz,
  analytics_consent boolean not null default true,
  marketing_consent boolean not null default false,
  last_active_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.guardian_consent_at is
  'Set once a guardian has confirmed consent. Until then a minor account can learn but cannot use messaging or community — enforced by app.minor_can_socialise() in the RLS policies.';

create index profiles_last_active_idx on public.profiles (last_active_at desc);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role app_role not null,
  granted_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index user_roles_role_idx on public.user_roles (role);

-- Age is derived server-side; the client never asserts whether a user is a minor.
create or replace function app.derive_minor_status()
returns trigger
language plpgsql
as $$
begin
  if new.date_of_birth is not null then
    new.is_minor := new.date_of_birth > (current_date - interval '18 years');
    new.account_type := case
      when new.date_of_birth > (current_date - interval '13 years') then 'child'
      when new.date_of_birth > (current_date - interval '18 years') then 'teen'
      else 'adult'
    end;
  end if;
  return new;
end;
$$;

create trigger profiles_derive_minor
  before insert or update of date_of_birth on public.profiles
  for each row execute function app.derive_minor_status();

create trigger profiles_touch
  before update on public.profiles
  for each row execute function app.touch_updated_at();

-- A new auth user always gets a profile and the learner role.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, ui_locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'Learner'),
    coalesce(new.raw_user_meta_data ->> 'locale', 'en')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (new.id, 'learner')
  on conflict do nothing;

  insert into public.notification_preferences (user_id) values (new.id)
  on conflict do nothing;

  return new;
end;
$$;

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  review_reminders boolean not null default true,
  streak_reminders boolean not null default true,
  lesson_reminders boolean not null default true,
  booking_reminders boolean not null default true,
  messages boolean not null default true,
  marketing boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_touch
  before update on public.notification_preferences
  for each row execute function app.touch_updated_at();

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform billing_platform not null,
  app_version text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (token)
);

create index device_tokens_user_idx on public.device_tokens (user_id);

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

comment on column public.profiles.is_minor is
  'Derived by trigger from date_of_birth. Drives the minor-safety policies; never set by the client.';
