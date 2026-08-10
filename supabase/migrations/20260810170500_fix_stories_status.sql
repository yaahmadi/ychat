-- Ychat v1.0.1 - make Stories/Status deployable through normal Supabase migrations.
-- Safe to run more than once on an upgraded project.

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  story_type text not null,
  body text,
  media_path text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table public.stories drop constraint if exists stories_story_type_check;
alter table public.stories drop constraint if exists stories_content_check;
alter table public.stories add constraint stories_story_type_check
  check (story_type in ('text', 'image', 'video'));
alter table public.stories add constraint stories_content_check check (
  (story_type = 'text' and nullif(trim(body), '') is not null)
  or (story_type in ('image', 'video') and media_path is not null)
);

create index if not exists stories_user_created_idx on public.stories(user_id, created_at desc);
create index if not exists stories_expires_idx on public.stories(expires_at);

alter table public.stories enable row level security;
drop policy if exists stories_read_authenticated on public.stories;
drop policy if exists stories_create_own on public.stories;
drop policy if exists stories_delete_own on public.stories;

create policy stories_read_authenticated
on public.stories for select to authenticated
using (expires_at > now());

create policy stories_create_own
on public.stories for insert to authenticated
with check (user_id = auth.uid() and expires_at > now());

create policy stories_delete_own
on public.stories for delete to authenticated
using (user_id = auth.uid());

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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'stories'
  ) then
    alter publication supabase_realtime add table public.stories;
  end if;
end $$;
