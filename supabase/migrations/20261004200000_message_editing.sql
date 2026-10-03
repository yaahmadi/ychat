-- YCHAT: ALLOW USERS TO EDIT THEIR OWN MESSAGES
-- Text messages can be edited after sending. Ownership is enforced by RLS.

drop policy if exists messages_update_own on public.messages;
create policy messages_update_own
  on public.messages
  for update
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());
