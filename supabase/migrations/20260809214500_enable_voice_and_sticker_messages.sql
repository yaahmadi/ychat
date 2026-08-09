-- Allow the message types already used by the Ychat client.
-- Safe to run repeatedly.

do $$
declare
  constraint_name text;
begin
  select c.conname
    into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'messages'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%message_type%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.messages drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.messages
add constraint messages_message_type_check
check (message_type in ('text', 'code', 'image', 'video', 'file', 'voice', 'sticker'));
