-- ---------------------------------------------------------------------------
-- Analytics ingest RPC.
--
-- The `analytics` schema is not exposed through PostgREST, so the ingest
-- function writes through this SECURITY DEFINER wrapper. It re-applies the two
-- rules the Edge Function applies, because a function that can be called
-- directly must not rely on its caller having been careful.
-- ---------------------------------------------------------------------------

create or replace function public.ingest_analytics_events(p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = public, analytics, pg_temp
as $$
declare
  v_user uuid := app.uid();
  v_consent boolean;
  v_inserted integer := 0;
  v_event jsonb;
  v_props jsonb;
  v_forbidden text[] := array[
    'email','phone','password','name','fullName','address','latitude','longitude',
    'ip','deviceId','advertisingId','text','transcript','message','answer','essay'
  ];
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  select analytics_consent into v_consent from public.profiles where id = v_user;
  if v_consent is false then
    return 0;
  end if;

  for v_event in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
  loop
    v_props := coalesce(v_event -> 'props', '{}'::jsonb);

    -- Drop any event carrying a forbidden key rather than storing it.
    continue when exists (
      select 1 from jsonb_object_keys(v_props) k where k = any(v_forbidden)
    );

    insert into analytics.events (user_id, name, props, session_id, app_version, platform, ts)
    values (
      v_user,
      v_event ->> 'name',
      v_props,
      v_event ->> 'session_id',
      v_event ->> 'app_version',
      v_event ->> 'platform',
      coalesce((v_event ->> 'ts')::timestamptz, now())
    );
    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function public.ingest_analytics_events(jsonb) from public;
grant execute on function public.ingest_analytics_events(jsonb) to authenticated;

comment on function public.ingest_analytics_events is
  'Writes analytics events, honouring the caller''s consent flag and refusing any payload containing personal data.';
