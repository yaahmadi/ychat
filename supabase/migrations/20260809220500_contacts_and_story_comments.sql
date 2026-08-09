-- Contacts, private profile discovery, and story comments.
-- Safe to run repeatedly.

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

create table if not exists public.contacts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, contact_id),
  check (owner_id <> contact_id)
);

alter table public.contacts enable row level security;

drop policy if exists contacts_read_own on public.contacts;
drop policy if exists contacts_create_own on public.contacts;
drop policy if exists contacts_delete_own on public.contacts;

create policy contacts_read_own
on public.contacts for select to authenticated
using (owner_id = auth.uid());

create policy contacts_create_own
on public.contacts for insert to authenticated
with check (owner_id = auth.uid());

create policy contacts_delete_own
on public.contacts for delete to authenticated
using (owner_id = auth.uid());

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

drop policy if exists profiles_read_authenticated on public.profiles;
drop policy if exists profiles_select_authorized on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_read_contacts on public.profiles;

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

create table if not exists public.story_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists story_comments_story_created_idx on public.story_comments(story_id, created_at);

alter table public.story_comments enable row level security;

drop policy if exists story_comments_read_contacts on public.story_comments;
drop policy if exists story_comments_create_contacts on public.story_comments;

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

drop policy if exists stories_read_authenticated on public.stories;
drop policy if exists stories_read_contacts on public.stories;

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
