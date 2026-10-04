-- YCHAT premium messaging state
-- Adds persistent unread/favorite state, message deletion/view-once state,
-- story presentation controls, and call duration.

alter table public.conversation_user_settings
  add column if not exists favorite_at timestamptz,
  add column if not exists last_read_at timestamptz;

alter table public.messages
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_for_everyone boolean not null default false,
  add column if not exists one_time_view boolean not null default false;

alter table public.call_logs
  add column if not exists duration_seconds integer;

alter table public.stories
  add column if not exists text_font_size integer not null default 30,
  add column if not exists text_background text not null default 'ocean',
  add column if not exists text_color text not null default '#ffffff';

create table if not exists public.message_views (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_views_message_idx
  on public.message_views(message_id, viewed_at desc);

alter table public.message_views enable row level security;

drop policy if exists message_views_select_member on public.message_views;
create policy message_views_select_member
on public.message_views for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.messages m
    join public.conversation_members cm on cm.conversation_id = m.conversation_id
    where m.id = message_views.message_id and cm.user_id = auth.uid()
  )
);

drop policy if exists message_views_insert_own on public.message_views;
create policy message_views_insert_own
on public.message_views for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.messages m
    join public.conversation_members cm on cm.conversation_id = m.conversation_id
    where m.id = message_views.message_id and cm.user_id = auth.uid()
  )
);

grant select, insert on public.message_views to authenticated;

create or replace function public.get_conversation_unread_counts()
returns table(conversation_id uuid, unread_count bigint)
language sql
security invoker
set search_path = public
as $$
  select c.id,
         count(m.id)::bigint
  from public.conversations c
  join public.conversation_members cm
    on cm.conversation_id = c.id
   and cm.user_id = auth.uid()
  left join public.conversation_user_settings cus
    on cus.conversation_id = c.id
   and cus.user_id = auth.uid()
  left join public.messages m
    on m.conversation_id = c.id
   and m.sender_id <> auth.uid()
   and m.deleted_at is null
   and m.created_at > coalesce(cus.last_read_at, 'epoch'::timestamptz)
  group by c.id;
$$;

revoke all on function public.get_conversation_unread_counts() from public, anon;
grant execute on function public.get_conversation_unread_counts() to authenticated;

create or replace function public.mark_conversation_read(target_conversation_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_conversation_member(target_conversation_id) then
    raise exception 'Not a conversation member';
  end if;

  insert into public.conversation_user_settings(
    user_id, conversation_id, last_read_at, updated_at
  )
  values(auth.uid(), target_conversation_id, now(), now())
  on conflict(user_id, conversation_id)
  do update set last_read_at = excluded.last_read_at,
                updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

alter table public.messages replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_views'
  ) then
    alter publication supabase_realtime add table public.message_views;
  end if;
end $$;
