-- Durable call history plus per-user chat archive/delete state.
-- Safe to run repeatedly.

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

alter table public.conversation_user_settings enable row level security;
alter table public.call_logs enable row level security;

drop policy if exists conversation_user_settings_own_read on public.conversation_user_settings;
drop policy if exists conversation_user_settings_own_write on public.conversation_user_settings;
drop policy if exists call_logs_own_read on public.call_logs;
drop policy if exists call_logs_own_insert on public.call_logs;
drop policy if exists call_logs_own_delete on public.call_logs;

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

do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array['conversation_user_settings', 'call_logs']
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
