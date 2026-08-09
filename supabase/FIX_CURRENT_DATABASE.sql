-- Ychat v1.0.0 - database/RLS/realtime/storage baseline
-- Safe to run repeatedly in Supabase SQL Editor.

create extension if not exists "uuid-ossp";

alter table public.profiles add column if not exists phone_number text;
alter table public.profiles add column if not exists email_address text;
alter table public.profiles add column if not exists contact_code text;

update public.profiles
set contact_code = lower(substr(replace(id::text, '-', ''), 1, 10))
where contact_code is null or contact_code = '';

update public.profiles p
set email_address = lower(u.email)
from auth.users u
where p.id = u.id
  and p.email_address is null
  and u.email is not null;

create unique index if not exists profiles_contact_code_key on public.profiles(contact_code);
create index if not exists profiles_email_address_idx on public.profiles(lower(email_address));
create index if not exists profiles_username_lookup_idx on public.profiles(lower(username));

alter table if exists public.messages drop constraint if exists messages_message_type_check;
alter table if exists public.messages
add constraint messages_message_type_check
check (message_type in ('text', 'code', 'image', 'video', 'file', 'voice', 'sticker'));

-- ============================================================
-- AUTH PROFILE TRIGGER
-- ============================================================
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
      split_part(coalesce(new.email, nullif(new.phone, ''), new.id::text), '@', 1)
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

  insert into public.profiles (id, display_name, username, avatar_url, phone_number, email_address, contact_code, role, status, last_seen)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, nullif(new.phone, ''), 'User'), '@', 1)
    ),
    final_username,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    new.phone,
    lower(new.email),
    lower(substr(replace(new.id::text, '-', ''), 1, 10)),
    'user',
    'offline',
    now()
  )
  on conflict (id) do update set
    display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    phone_number = coalesce(excluded.phone_number, public.profiles.phone_number),
    email_address = coalesce(excluded.email_address, public.profiles.email_address),
    contact_code = coalesce(public.profiles.contact_code, excluded.contact_code);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- SAFE HELPERS (SECURITY DEFINER AVOIDS RLS RECURSION)
-- ============================================================
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

-- ============================================================
-- DIRECT CHAT RPC
-- ============================================================
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
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if other_user_id is null then raise exception 'User is required'; end if;
  if other_user_id = current_user_id then raise exception 'You cannot start a chat with yourself'; end if;
  if not exists (select 1 from public.profiles where id = other_user_id) then raise exception 'User not found'; end if;

  select c.id into existing_conversation_id
  from public.conversations c
  join public.conversation_members me on me.conversation_id = c.id and me.user_id = current_user_id
  join public.conversation_members them on them.conversation_id = c.id and them.user_id = other_user_id
  where c.type = 'direct'
    and (select count(*) from public.conversation_members x where x.conversation_id = c.id) = 2
  order by c.created_at asc
  limit 1;

  if existing_conversation_id is not null then return existing_conversation_id; end if;

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

-- ============================================================
-- GROUP CHAT RPC
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
  if current_user_id is null then raise exception 'Not authenticated'; end if;
  if nullif(trim(group_title), '') is null then raise exception 'Group name is required'; end if;

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

create table if not exists public.contacts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, contact_id),
  check (owner_id <> contact_id)
);

-- ============================================================
-- CONTACT DISCOVERY RPCS
-- ============================================================
create or replace function public.get_contact_profiles()
returns setof public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.profiles p
  where p.id = auth.uid()
     or exists (
       select 1 from public.contacts c
       where c.owner_id = auth.uid()
         and c.contact_id = p.id
     )
  order by p.display_name;
$$;

revoke all on function public.get_contact_profiles() from public;
grant execute on function public.get_contact_profiles() to authenticated;

create or replace function public.add_contact_by_lookup(lookup text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text := lower(trim(lookup));
  target_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if clean = '' then
    raise exception 'Enter an email, username, or Ychat ID';
  end if;

  select p.id into target_id
  from public.profiles p
  where lower(coalesce(p.contact_code, '')) = clean
     or lower(coalesce(p.username, '')) = clean
     or lower(coalesce(p.email_address, '')) = clean
  limit 1;

  if target_id is null then
    raise exception 'No Ychat user found for this ID or email';
  end if;

  if target_id = auth.uid() then
    raise exception 'You cannot add yourself';
  end if;

  insert into public.contacts(owner_id, contact_id)
  values (auth.uid(), target_id)
  on conflict do nothing;

  insert into public.contacts(owner_id, contact_id)
  values (target_id, auth.uid())
  on conflict do nothing;

  return target_id;
end;
$$;

revoke all on function public.add_contact_by_lookup(text) from public;
grant execute on function public.add_contact_by_lookup(text) to authenticated;

-- ============================================================
-- STORIES / STATUS (24 HOURS)
-- ============================================================
create table if not exists public.stories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  story_type text not null,
  body text,
  media_path text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint stories_content_check check (
    (story_type = 'text' and nullif(trim(body), '') is not null)
    or (story_type in ('image', 'video') and media_path is not null)
  )
);


-- Ensure upgraded projects accept video stories too.
alter table public.stories drop constraint if exists stories_story_type_check;
alter table public.stories drop constraint if exists stories_content_check;
alter table public.stories add constraint stories_story_type_check check (story_type in ('text', 'image', 'video'));
alter table public.stories add constraint stories_content_check check (
  (story_type = 'text' and nullif(trim(body), '') is not null)
  or (story_type in ('image', 'video') and media_path is not null)
);

create index if not exists stories_user_created_idx on public.stories(user_id, created_at desc);
create index if not exists stories_expires_idx on public.stories(expires_at);

create table if not exists public.story_comments (
  id uuid primary key default uuid_generate_v4(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists story_comments_story_created_idx on public.story_comments(story_id, created_at);

create table if not exists public.conversation_user_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  archived_at timestamptz,
  deleted_at timestamptz,
  muted_until timestamptz,
  pinned_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

create table if not exists public.call_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  title text not null,
  mode text not null check (mode in ('audio', 'video')),
  direction text not null check (direction in ('incoming', 'outgoing', 'missed')),
  created_at timestamptz not null default now()
);

create index if not exists conversation_user_settings_user_idx
on public.conversation_user_settings(user_id, updated_at desc);

create index if not exists call_logs_user_created_idx
on public.call_logs(user_id, created_at desc);

-- ============================================================
-- DROP LEGACY + CURRENT POLICIES SO THIS FILE IS IDEMPOTENT
-- ============================================================
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_authorized on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_admin_update_roles on public.profiles;
drop policy if exists profiles_read_authenticated on public.profiles;
drop policy if exists profiles_update_self on public.profiles;

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
drop policy if exists attachments_read on public.attachments;
drop policy if exists attachments_create on public.attachments;

drop policy if exists message_reads_select_member on public.message_reads;
drop policy if exists message_reads_insert_own on public.message_reads;
drop policy if exists message_reads_update_own on public.message_reads;
drop policy if exists message_reads_read on public.message_reads;
drop policy if exists message_reads_create on public.message_reads;
drop policy if exists message_reads_update on public.message_reads;

drop policy if exists stories_read_authenticated on public.stories;
drop policy if exists stories_create_own on public.stories;
drop policy if exists stories_delete_own on public.stories;
drop policy if exists stories_read_contacts on public.stories;

drop policy if exists contacts_read_own on public.contacts;
drop policy if exists contacts_create_own on public.contacts;
drop policy if exists contacts_delete_own on public.contacts;

drop policy if exists story_comments_read_contacts on public.story_comments;
drop policy if exists story_comments_create_contacts on public.story_comments;

drop policy if exists conversation_user_settings_own_read on public.conversation_user_settings;
drop policy if exists conversation_user_settings_own_write on public.conversation_user_settings;

drop policy if exists call_logs_own_read on public.call_logs;
drop policy if exists call_logs_own_insert on public.call_logs;
drop policy if exists call_logs_own_delete on public.call_logs;

-- ============================================================
-- RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.attachments enable row level security;
alter table public.message_reads enable row level security;
alter table public.stories enable row level security;
alter table public.contacts enable row level security;
alter table public.story_comments enable row level security;
alter table public.conversation_user_settings enable row level security;
alter table public.call_logs enable row level security;

create policy contacts_read_own
on public.contacts for select to authenticated
using (owner_id = auth.uid());

create policy contacts_create_own
on public.contacts for insert to authenticated
with check (owner_id = auth.uid());

create policy contacts_delete_own
on public.contacts for delete to authenticated
using (owner_id = auth.uid());

create policy profiles_read_contacts
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or exists (
    select 1 from public.contacts c
    where c.owner_id = auth.uid()
      and c.contact_id = profiles.id
  )
);

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

create policy stories_read_contacts
on public.stories for select to authenticated
using (
  expires_at > now()
  and (
    user_id = auth.uid()
    or exists (
      select 1 from public.contacts c
      where c.owner_id = auth.uid()
        and c.contact_id = stories.user_id
    )
  )
);

create policy stories_create_own
on public.stories for insert to authenticated
with check (user_id = auth.uid() and expires_at > now());

create policy stories_delete_own
on public.stories for delete to authenticated
using (user_id = auth.uid());

create policy story_comments_read_contacts
on public.story_comments for select to authenticated
using (
  exists (
    select 1
    from public.stories s
    where s.id = story_comments.story_id
      and (
        s.user_id = auth.uid()
        or exists (
          select 1 from public.contacts c
          where c.owner_id = auth.uid()
            and c.contact_id = s.user_id
        )
      )
  )
);

create policy story_comments_create_contacts
on public.story_comments for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.stories s
    where s.id = story_comments.story_id
      and (
        s.user_id = auth.uid()
        or exists (
          select 1 from public.contacts c
          where c.owner_id = auth.uid()
            and c.contact_id = s.user_id
        )
      )
  )
);

create policy conversation_user_settings_own_read
on public.conversation_user_settings for select to authenticated
using (user_id = auth.uid());

create policy conversation_user_settings_own_write
on public.conversation_user_settings for all to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_conversation_member(conversation_id)
);

create policy call_logs_own_read
on public.call_logs for select to authenticated
using (user_id = auth.uid());

create policy call_logs_own_insert
on public.call_logs for insert to authenticated
with check (
  user_id = auth.uid()
  and (conversation_id is null or public.is_conversation_member(conversation_id))
);

create policy call_logs_own_delete
on public.call_logs for delete to authenticated
using (user_id = auth.uid());

-- ============================================================
-- KEEP CONVERSATION SORT ORDER CURRENT
-- ============================================================
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

-- ============================================================
-- REALTIME
-- ============================================================
do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array['messages', 'conversations', 'conversation_members', 'profiles', 'attachments', 'stories', 'contacts', 'story_comments', 'conversation_user_settings', 'call_logs']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', realtime_table);
    end if;
  end loop;
end $$;

-- ============================================================
-- PRIVATE CHAT ATTACHMENT STORAGE
-- ============================================================
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do update set public = false;

drop policy if exists chat_attachments_storage_read on storage.objects;
drop policy if exists chat_attachments_storage_insert on storage.objects;
drop policy if exists chat_attachments_storage_delete_own on storage.objects;
drop policy if exists chat_attachments_storage_select on storage.objects;

create policy chat_attachments_storage_read
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-attachments'
  and exists (
    select 1
    from public.attachments a
    join public.messages m on m.id = a.message_id
    where a.file_path = name
      and public.is_conversation_member(m.conversation_id)
  )
);

create policy chat_attachments_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy chat_attachments_storage_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-attachments'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- ============================================================
-- STORY PHOTO / VIDEO STORAGE
-- ============================================================
insert into storage.buckets (id, name, public)
values ('story-media', 'story-media', false)
on conflict (id) do update set public = false;

drop policy if exists story_media_read on storage.objects;
drop policy if exists story_media_insert on storage.objects;
drop policy if exists story_media_delete_own on storage.objects;

create policy story_media_read
on storage.objects for select to authenticated
using (bucket_id = 'story-media');

create policy story_media_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'story-media' and split_part(name, '/', 1) = auth.uid()::text);

create policy story_media_delete_own
on storage.objects for delete to authenticated
using (bucket_id = 'story-media' and split_part(name, '/', 1) = auth.uid()::text);


-- ============================================================
-- PROFILE AVATAR STORAGE
-- ============================================================
insert into storage.buckets (id, name, public)
values ('profile-media', 'profile-media', true)
on conflict (id) do update set public = true;

drop policy if exists profile_media_insert on storage.objects;
drop policy if exists profile_media_read on storage.objects;
drop policy if exists profile_media_update_own on storage.objects;
drop policy if exists profile_media_delete_own on storage.objects;

create policy profile_media_read
on storage.objects for select
using (bucket_id = 'profile-media');

create policy profile_media_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'profile-media' and split_part(name, '/', 1) = auth.uid()::text);

create policy profile_media_update_own
on storage.objects for update to authenticated
using (bucket_id = 'profile-media' and split_part(name, '/', 1) = auth.uid()::text)
with check (bucket_id = 'profile-media' and split_part(name, '/', 1) = auth.uid()::text);

create policy profile_media_delete_own
on storage.objects for delete to authenticated
using (bucket_id = 'profile-media' and split_part(name, '/', 1) = auth.uid()::text);

-- ============================================================
-- VERIFICATION
-- ============================================================
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles','conversations','conversation_members','messages','attachments','message_reads','stories','contacts','story_comments','conversation_user_settings','call_logs')
order by tablename, policyname;

select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('get_contact_profiles', 'add_contact_by_lookup', 'start_direct_conversation', 'create_group_conversation')
order by routine_name;
