-- YCHAT: MESSAGE REACTIONS + STORY VIEWS + CONTACT LOOKUP

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (length(trim(reaction)) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_reactions_message_idx on public.message_reactions(message_id);
alter table public.message_reactions enable row level security;

drop policy if exists message_reactions_select_member on public.message_reactions;
create policy message_reactions_select_member on public.message_reactions for select using (
  exists (select 1 from public.messages m join public.conversation_members cm on cm.conversation_id=m.conversation_id where m.id=message_reactions.message_id and cm.user_id=auth.uid())
);

drop policy if exists message_reactions_insert_member on public.message_reactions;
create policy message_reactions_insert_member on public.message_reactions for insert with check (
  user_id=auth.uid() and exists (select 1 from public.messages m join public.conversation_members cm on cm.conversation_id=m.conversation_id where m.id=message_reactions.message_id and cm.user_id=auth.uid())
);

drop policy if exists message_reactions_update_own on public.message_reactions;
create policy message_reactions_update_own on public.message_reactions for update using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists message_reactions_delete_own on public.message_reactions;
create policy message_reactions_delete_own on public.message_reactions for delete using(user_id=auth.uid());

create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key(story_id,user_id)
);

create index if not exists story_views_story_idx on public.story_views(story_id,viewed_at desc);
alter table public.story_views enable row level security;

drop policy if exists story_views_insert_authenticated on public.story_views;
create policy story_views_insert_authenticated on public.story_views for insert with check (
  user_id=auth.uid() and exists(select 1 from public.stories s where s.id=story_views.story_id and s.expires_at>now())
);

drop policy if exists story_views_select_relevant on public.story_views;
create policy story_views_select_relevant on public.story_views for select using (
  user_id=auth.uid() or exists(select 1 from public.stories s where s.id=story_views.story_id and s.user_id=auth.uid())
);

create index if not exists profiles_phone_number_idx on public.profiles(phone_number);

create or replace function public.add_contact_by_lookup(lookup text)
returns uuid language plpgsql security definer set search_path=public as $$
declare clean text:=lower(trim(lookup)); normalized_phone text; target_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if clean='' then raise exception 'Enter a phone number, email, username, or Ychat ID'; end if;
  normalized_phone:=regexp_replace(clean,'[^0-9+]','','g');
  select p.id into target_id from public.profiles p
  where lower(coalesce(p.contact_code,''))=clean
     or lower(coalesce(p.username,''))=clean
     or lower(coalesce(p.email_address,''))=clean
     or regexp_replace(coalesce(p.phone_number,''),'[^0-9+]','','g')=normalized_phone
  limit 1;
  if target_id is null then raise exception 'No Ychat user found for this phone number, ID, username, or email'; end if;
  if target_id=auth.uid() then raise exception 'You cannot add yourself'; end if;
  insert into public.contacts(owner_id,contact_id) values(auth.uid(),target_id) on conflict do nothing;
  insert into public.contacts(owner_id,contact_id) values(target_id,auth.uid()) on conflict do nothing;
  return target_id;
end; $$;

revoke all on function public.add_contact_by_lookup(text) from public;
grant execute on function public.add_contact_by_lookup(text) to authenticated;