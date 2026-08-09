-- Restrict private attachment objects to members of the conversation encoded
-- in the app path: <uploader-user-id>/<conversation-id>/<random-file-name>.

drop policy if exists chat_attachments_storage_read on storage.objects;
drop policy if exists chat_attachments_storage_insert on storage.objects;
drop policy if exists chat_attachments_storage_delete_own on storage.objects;

create policy chat_attachments_storage_read
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-attachments'
  and case
    when coalesce((storage.foldername(name))[2], '') ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    then public.is_conversation_member((storage.foldername(name))[2]::uuid)
    else false
  end
);

create policy chat_attachments_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
  and case
    when coalesce((storage.foldername(name))[2], '') ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    then public.is_conversation_member((storage.foldername(name))[2]::uuid)
    else false
  end
);

create policy chat_attachments_storage_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);
