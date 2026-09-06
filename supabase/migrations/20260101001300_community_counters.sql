-- Community post counters -----------------------------------------------
--
-- reply_count and reaction_count are denormalised for the feed list (avoiding
-- a count(*) subquery per post on every screen render), so they must be
-- maintained by the database rather than incremented by a client request —
-- the same reasoning as `app.recompute_teacher_rating` for teacher ratings.

create or replace function app.recompute_post_reply_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid := coalesce(new.post_id, old.post_id);
begin
  update public.community_posts p
  set reply_count = stats.total
  from (
    select count(*) as total
    from public.community_comments c
    where c.post_id = target and c.status = 'published'
  ) stats
  where p.id = target;
  return null;
end;
$$;

create trigger community_comments_recompute_reply_count
  after insert or update or delete on public.community_comments
  for each row execute function app.recompute_post_reply_count();

create or replace function app.recompute_post_reaction_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid := coalesce(new.post_id, old.post_id);
begin
  update public.community_posts p
  set reaction_count = stats.total
  from (
    select count(*) as total
    from public.post_reactions r
    where r.post_id = target
  ) stats
  where p.id = target;
  return null;
end;
$$;

create trigger post_reactions_recompute_reaction_count
  after insert or delete on public.post_reactions
  for each row execute function app.recompute_post_reaction_count();
