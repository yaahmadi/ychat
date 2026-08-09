-- Profile avatars plus reliable voice/sticker message types.
-- Safe to run repeatedly.

alter table if exists public.messages drop constraint if exists messages_message_type_check;
alter table if exists public.messages
add constraint messages_message_type_check
check (message_type in ('text', 'code', 'image', 'video', 'file', 'voice', 'sticker'));

insert into storage.buckets (id, name, public)
values ('profile-media', 'profile-media', true)
on conflict (id) do update set public = true;

drop policy if exists profile_media_read on storage.objects;
drop policy if exists profile_media_insert on storage.objects;
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
