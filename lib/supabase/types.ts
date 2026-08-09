export type ProfileRow = {
  id: string;
  display_name: string;
  username?: string | null;
  avatar_url?: string | null;
  status?: string | null;
  last_seen?: string | null;
  role?: string | null;
  created_at?: string | null;
  phone_number?: string | null;
  email_address?: string | null;
  contact_code?: string | null;
};

export type ConversationMemberRow = {
  user_id: string;
  member_role?: string | null;
  joined_at?: string | null;
};

export type ConversationRow = {
  id: string;
  type: "direct" | "group";
  title?: string | null;
  created_by: string;
  created_at?: string | null;
  updated_at?: string | null;
  conversation_members?: ConversationMemberRow[];
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  message_type: string;
  reply_to_id?: string | null;
  edited_at?: string | null;
  created_at?: string | null;
};

export type AttachmentRow = {
  id: string;
  message_id: string;
  uploader_id: string;
  file_name: string;
  file_path: string;
  mime_type?: string | null;
  file_size?: number | null;
  created_at?: string | null;
};

export type StoryCommentRow = {
  id: string;
  story_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export type StoryRow = {
  id: string;
  user_id: string;
  story_type: "text" | "image" | "video";
  body?: string | null;
  media_path?: string | null;
  created_at: string;
  expires_at: string;
};

export type CallLogRow = {
  id: string;
  user_id: string;
  conversation_id?: string | null;
  title: string;
  mode: "audio" | "video";
  direction: "incoming" | "outgoing" | "missed";
  created_at: string;
};

export type ConversationUserStateRow = {
  user_id: string;
  conversation_id: string;
  archived_at?: string | null;
  deleted_at?: string | null;
  muted_until?: string | null;
  pinned_at?: string | null;
  updated_at?: string | null;
};
