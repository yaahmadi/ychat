-- YCHAT: STORY REACTIONS

create table if not exists public.story_reactions (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (length(trim(reaction)) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create index if not exists story_reactions_story_idx on public.story_reactions(story_id, created_at desc);
alter table public.story_reactions enable row level security;

drop policy if exists story_reactions_select_relevant on public.story_reactions;
create policy story_reactions_select_relevant on public.story_reactions for select using (
  user_id = auth.uid() or exists (
    select 1 from public.stories s where s.id = story_reactions.story_id and s.user_id = auth.uid()
  )
);

drop policy if exists story_reactions_insert_authenticated on public.story_reactions;
create policy story_reactions_insert_authenticated on public.story_reactions for insert with check (
  user_id = auth.uid() and exists (
    select 1 from public.stories s
    where s.id = story_reactions.story_id and s.expires_at > now() and s.user_id <> auth.uid()
  )
);

drop policy if exists story_reactions_update_own on public.story_reactions;
create policy story_reactions_update_own on public.story_reactions for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists story_reactions_delete_own on public.story_reactions;
create policy story_reactions_delete_own on public.story_reactions for delete using (user_id = auth.uid());

alter publication supabase_realtime add table public.story_reactions;
