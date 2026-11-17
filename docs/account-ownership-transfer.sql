CREATE OR REPLACE FUNCTION public.transfer_deleted_user_groups(
    departing_user uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    group_record record;
    replacement_user uuid;
BEGIN
    FOR group_record IN
        SELECT c.id
        FROM public.conversations c
        WHERE c.type = 'group'
        AND c.created_by = departing_user
        FOR UPDATE
    LOOP
        SELECT cm.user_id
        INTO replacement_user
        FROM public.conversation_members cm
        WHERE cm.conversation_id = group_record.id
        AND cm.user_id <> departing_user
        ORDER BY cm.joined_at ASC, cm.user_id ASC
        LIMIT 1;

        IF replacement_user IS NOT NULL THEN
            UPDATE public.conversation_members
            SET member_role = 'owner'
            WHERE conversation_id = group_record.id
            AND user_id = replacement_user;

            UPDATE public.conversations
            SET created_by = replacement_user
            WHERE id = group_record.id;
        END IF;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION
public.transfer_deleted_user_groups(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.transfer_deleted_user_groups(uuid)
TO service_role;
