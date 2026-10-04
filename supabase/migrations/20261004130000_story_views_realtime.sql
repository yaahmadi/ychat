-- YCHAT: reliable story-view recording + realtime updates

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'story_views'
  ) then
    alter publication supabase_realtime add table public.story_views;
  end if;
end $$;

create or replace function public.record_story_view(target_story_id uuid)
returns public.story_views
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.story_views;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.stories
    where id = target_story_id
      and expires_at > now()
  ) then
    raise exception 'Story is unavailable';
  end if;

  insert into public.story_views(story_id, user_id, viewed_at)
  values (target_story_id, auth.uid(), now())
  on conflict (story_id, user_id)
  do update set viewed_at = excluded.viewed_at
  returning * into result;

  return result;
end;
$$;

revoke all on function public.record_story_view(uuid) from public, anon;
grant execute on function public.record_story_view(uuid) to authenticated;
