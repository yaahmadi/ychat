-- Make auth profile creation safe for Google, email, and phone-only users.
-- Safe to run repeatedly in Supabase SQL Editor or through migrations.

alter table public.profiles add column if not exists phone_number text;

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

  insert into public.profiles (id, display_name, username, avatar_url, phone_number, role, status, last_seen)
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
    'user',
    'offline',
    now()
  )
  on conflict (id) do update set
    display_name = coalesce(nullif(excluded.display_name, ''), public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    phone_number = coalesce(excluded.phone_number, public.profiles.phone_number);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
