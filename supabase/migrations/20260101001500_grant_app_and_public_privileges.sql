-- RLS policies across the schema call app.uid(), app.is_admin(), etc., but no
-- role was ever granted USAGE on the app schema. PostgreSQL denies name
-- resolution for a schema-qualified call before it even checks function-level
-- EXECUTE grants, so every policy referencing app.* raised
-- "permission denied for schema app" for anon and authenticated alike --
-- silently, since PostgREST/postgrest-js callers see this as an empty/failed
-- query rather than a surfaced error. This blocked all authenticated reads
-- (e.g. the profile fetch that gates the post-login redirect) and anonymous
-- reads of published content alike.
grant usage on schema app to anon, authenticated, service_role;

-- Every table in public has RLS policies written to gate access per-row via
-- app.uid() etc., but the base table-level GRANTs that PostgreSQL checks
-- *before* evaluating any RLS policy were never issued to anon/authenticated.
-- Supabase's Studio does this automatically when tables are created there,
-- but these tables were created via migrations applied directly, which
-- skipped it. The result: every query from the real anon/authenticated API
-- roles failed at the privilege check, before RLS ever ran -- blocking
-- all real client reads/writes (login profile fetch, public curriculum
-- browsing, everything) while direct/superuser access from tooling worked
-- fine and masked the problem.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated, anon;

-- Cover tables/sequences added by future migrations the same way, so this
-- class of bug can't recur silently.
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant usage, select on sequences to authenticated, anon;
