-- Privileged chat helpers must never be callable before authentication.
-- Trigger-only functions are not exposed as client RPC endpoints.
revoke execute on function public.add_contact_by_lookup(text) from public, anon;
revoke execute on function public.create_group_conversation(text, uuid[]) from public, anon;
revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.get_contact_profiles() from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_conversation_member(uuid) from public, anon;
revoke execute on function public.start_direct_conversation(uuid) from public, anon;
revoke execute on function public.touch_conversation_on_message() from public, anon, authenticated;

grant execute on function public.add_contact_by_lookup(text) to authenticated;
grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.get_contact_profiles() to authenticated;
grant execute on function public.is_conversation_member(uuid) to authenticated;
grant execute on function public.start_direct_conversation(uuid) to authenticated;
