-- Ychat - current database repair and production baseline
-- Safe to run repeatedly in Supabase SQL Editor.

create extension if not exists "uuid-ossp";

-- ---------- USER PROFILE TRIGGER ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
begin
  base_username := lower(regexp_replace(
    coalesce(
      nullif(new.raw_user_meta_data->>'username', ''),
      nullif(new.raw_user_meta_data->>'preferred_username', ''),
      split_part(coalesce(new.email, new.id::text), '@', 1)
    ),
    '[^a-z0-9_]+', '_', 'g'
  ));

  if base_username is null or base_username = '' then
    base_username := 'user';
  end if;

  final_username := base_username;
  if exists (select 1 from public.profiles p where p.username = final_username and p.id <> new.id) then
    final_username := left(base_username, 22) || '_' || left(replace(new.id::text, '-', ''), 6);
  end if;

  insert into public.profiles (id, display_name, username, avatar_url, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, 'User'), '@', 1)
    ),
    final_username,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    'user'
  )
  on conflict (id) do update set
    display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

-- ---------- SAFE MEMBERSHIP HELPER ----------
create or replace function public.is_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

-- ---------- DIRECT CHAT RPC ----------
create or replace function public.start_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_conversation_id uuid;
  new_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if other_user_id is null then
    raise exception 'User is required';
  end if;

  if other_user_id = current_user_id then
    raise exception 'You cannot start a chat with yourself';
  end if;

  if not exists (select 1 from public.profiles where id = other_user_id) then
    raise exception 'User not found';
  end if;

  select c.id
    into existing_conversation_id
  from public.conversations c
  join public.conversation_members me
    on me.conversation_id = c.id and me.user_id = current_user_id
  join public.conversation_members them
    on them.conversation_id = c.id and them.user_id = other_user_id
  where c.type = 'direct'
    and (select count(*) from public.conversation_members x where x.conversation_id = c.id) = 2
  order by c.created_at asc
  limit 1;

  if existing_conversation_id is not null then
    return existing_conversation_id;
  end if;

  insert into public.conversations(type, title, created_by)
  values ('direct', null, current_user_id)
  returning id into new_conversation_id;

  insert into public.conversation_members(conversation_id, user_id, member_role)
  values
    (new_conversation_id, current_user_id, 'owner'),
    (new_conversation_id, other_user_id, 'member');

  return new_conversation_id;
end;
$$;

revoke all on function public.start_direct_conversation(uuid) from public;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

-- ---------- DROP ALL KNOWN LEGACY/DUPLICATE POLICIES ----------
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_authorized on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_admin_update_roles on public.profiles;

drop policy if exists conversations_select_member on public.conversations;
drop policy if exists conversations_insert_member on public.conversations;
drop policy if exists "Users can view their conversations" on public.conversations;
drop policy if exists "Authenticated users can create conversations" on public.conversations;
drop policy if exists conversations_read on public.conversations;
drop policy if exists conversations_create on public.conversations;

drop policy if exists conversation_members_select_member on public.conversation_members;
drop policy if exists conversation_members_insert_admin on public.conversation_members;
drop policy if exists "Authenticated users can view conversation membership" on public.conversation_members;
drop policy if exists conversation_members_read on public.conversation_members;

drop policy if exists messages_select_member on public.messages;
drop policy if exists messages_insert_member on public.messages;
drop policy if exists "Conversation members can view messages" on public.messages;
drop policy if exists "Conversation members can send messages" on public.messages;
drop policy if exists messages_read on public.messages;
drop policy if exists messages_create on public.messages;
drop policy if exists messages_update_own on public.messages;
drop policy if exists messages_delete_own on public.messages;

drop policy if exists attachments_select_member on public.attachments;
drop policy if exists attachments_insert_member on public.attachments;
drop policy if exists message_reads_select_member on public.message_reads;
drop policy if exists message_reads_insert_own on public.message_reads;
drop policy if exists message_reads_update_own on public.message_reads;

-- ---------- BASE RLS ----------
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;
alter table public.message_reads enable row level security;

-- Profiles are intentionally visible to authenticated users so People/New Chat works.
create policy profiles_read_authenticated
on public.profiles for select to authenticated
using (true);

create policy profiles_update_self
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = public.current_user_role());

create policy conversations_read
on public.conversations for select to authenticated
using (public.is_conversation_member(id));

create policy conversations_create
on public.conversations for insert to authenticated
with check (created_by = auth.uid());

create policy conversation_members_read
on public.conversation_members for select to authenticated
using (user_id = auth.uid() or public.is_conversation_member(conversation_id));

create policy messages_read
on public.messages for select to authenticated
using (public.is_conversation_member(conversation_id));

create policy messages_create
on public.messages for insert to authenticated
with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));

create policy messages_update_own
on public.messages for update to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

create policy messages_delete_own
on public.messages for delete to authenticated
using (sender_id = auth.uid());

create policy attachments_read
on public.attachments for select to authenticated
using (
  exists (
    select 1 from public.messages m
    where m.id = attachments.message_id
      and public.is_conversation_member(m.conversation_id)
  )
);

create policy attachments_create
on public.attachments for insert to authenticated
with check (
  uploader_id = auth.uid()
  and exists (
    select 1 from public.messages m
    where m.id = attachments.message_id
      and public.is_conversation_member(m.conversation_id)
  )
);

create policy message_reads_read
on public.message_reads for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.messages m
    where m.id = message_reads.message_id
      and public.is_conversation_member(m.conversation_id)
  )
);

create policy message_reads_create
on public.message_reads for insert to authenticated
with check (user_id = auth.uid());

create policy message_reads_update
on public.message_reads for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ---------- KEEP CONVERSATION SORT ORDER CURRENT ----------
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
after insert on public.messages
for each row execute function public.touch_conversation_on_message();

-- ---------- REALTIME ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ---------- PRIVATE ATTACHMENT BUCKET ----------
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do update set public = false;

-- ---------- VERIFICATION ----------
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles','conversations','conversation_members','messages')
order by tablename, policyname;

-- ============================================================
-- v0.1.2: GROUP CHAT + STORAGE ACCESS
-- ============================================================

create or replace function public.create_group_conversation(
  group_title text,
  member_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_conversation_id uuid;
  member_id uuid;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(group_title), '') is null then
    raise exception 'Group name is required';
  end if;

  insert into public.conversations(type, title, created_by)
  values ('group', trim(group_title), current_user_id)
  returning id into new_conversation_id;

  insert into public.conversation_members(conversation_id, user_id, member_role)
  values (new_conversation_id, current_user_id, 'owner');

  foreach member_id in array coalesce(member_ids, '{}'::uuid[])
  loop
    if member_id is distinct from current_user_id
       and exists (select 1 from public.profiles where id = member_id) then
      insert into public.conversation_members(conversation_id, user_id, member_role)
      values (new_conversation_id, member_id, 'member')
      on conflict (conversation_id, user_id) do nothing;
    end if;
  end loop;

  return new_conversation_id;
end;
$$;

revoke all on function public.create_group_conversation(text, uuid[]) from public;
grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;

-- The bucket stays private; authenticated app users may upload/read objects.
-- Database RLS on public.attachments still controls which attachment metadata appears.
drop policy if exists chat_attachments_storage_read on storage.objects;
drop policy if exists chat_attachments_storage_insert on storage.objects;
drop policy if exists chat_attachments_storage_delete_own on storage.objects;

create policy chat_attachments_storage_read
on storage.objects for select to authenticated
using (bucket_id = 'chat-attachments');

create policy chat_attachments_storage_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'chat-attachments');
