import { createClient } from "@/lib/supabase/client";
import type { AttachmentRow, MessageRow, ProfileRow, StoryCommentRow, StoryRow } from "@/lib/supabase/types";

function isJwtFutureError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return message.toLowerCase().includes("jwt issued at future");
}

function errorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "";
  return "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
}

function isMissingSchemaFunction(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  return message.includes("schema cache") || message.includes("could not find the function");
}

async function pause(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryAfterJwtClockSkew<T>(
  operation: () => PromiseLike<T>,
  getError: (value: T) => unknown,
): Promise<T> {
  let result = await operation();
  if (!isJwtFutureError(getError(result))) return result;

  const supabase = createClient();
  await pause(1200);
  await supabase.auth.refreshSession();
  result = await operation();
  return result;
}

export async function getProfiles() {
  return retryAfterJwtClockSkew(
    () => {
      const supabase = createClient();
      return supabase.from("profiles").select("*").order("display_name", { ascending: true });
    },
    (result) => (result as { error?: unknown }).error,
  );
}

export async function getContactProfiles() {
  const result = await retryAfterJwtClockSkew(
    async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_contact_profiles");
      return { data: data as ProfileRow[] | null, error };
    },
    (result) => (result as { error?: unknown }).error,
  );

  if (!isMissingSchemaFunction(result.error)) return result;

  const fallback = await getProfiles();
  return {
    data: (fallback.data ?? []) as ProfileRow[],
    error: fallback.error,
  };
}

export async function addContactByLookup(lookup: string) {
  const clean = lookup.trim();
  if (!clean) throw new Error("Enter an email, username, or Ychat ID.");
  const supabase = createClient();
  const { data, error } = await supabase.rpc("add_contact_by_lookup", { lookup: clean });
  if (isMissingSchemaFunction(error)) {
    const { data: matches, error: searchError } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .ilike("username", clean)
      .limit(1);
    if (searchError) throw searchError;
    const match = matches?.[0] as { id?: string } | undefined;
    if (!match?.id) throw new Error("No Ychat user found for this ID or email. Ask them to share their Ychat ID from Settings.");
    return match.id;
  }
  if (error) throw error;
  return data as string;
}

export async function getConversations() {
  return retryAfterJwtClockSkew(
    () => {
      const supabase = createClient();
      return supabase
        .from("conversations")
        .select("*, conversation_members(user_id, member_role, joined_at)")
        .order("updated_at", { ascending: false });
    },
    (result) => (result as { error?: unknown }).error,
  );
}

export async function getMessages(conversationId: string) {
  return retryAfterJwtClockSkew(
    () => {
      const supabase = createClient();
      return supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
    },
    (result) => (result as { error?: unknown }).error,
  );
}

export async function sendMessage(input: {
  conversationId: string;
  body: string;
  messageType?: string;
  replyToId?: string | null;
}) {
  const body = input.body.trim();
  if (!body) throw new Error("Message cannot be empty.");

  const runInsert = async () => {
    const supabase = createClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const userId = sessionData.session?.user.id;
    if (!userId) throw new Error("You must be signed in.");

    return supabase
      .from("messages")
      .insert({
        conversation_id: input.conversationId,
        sender_id: userId,
        body,
        message_type: input.messageType ?? "text",
        reply_to_id: input.replyToId ?? null,
      })
      .select("*")
      .single();
  };

  return retryAfterJwtClockSkew(runInsert, (result) => (result as { error?: unknown }).error);
}

export async function startDirectConversation(otherUserId: string) {
  const operation = async () => {
    const supabase = createClient();
    return supabase.rpc("start_direct_conversation", { other_user_id: otherUserId });
  };

  const { data, error } = await retryAfterJwtClockSkew(
    operation,
    (result) => (result as { error?: unknown }).error,
  );

  if (error) throw error;
  if (!data || typeof data !== "string") throw new Error("Unable to create conversation.");
  return data;
}

export async function createGroupConversation(title: string, memberIds: string[]) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_group_conversation", {
    group_title: title.trim(),
    member_ids: memberIds,
  });
  if (error) throw error;
  if (!data || typeof data !== "string") throw new Error("Unable to create group.");
  return data;
}

export async function getAttachments() {
  const supabase = createClient();
  return supabase.from("attachments").select("*").order("created_at", { ascending: false });
}

async function currentUserId() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user.id;
  if (!userId) throw new Error("You must be signed in.");
  return userId;
}

async function createAttachmentMessage(input: {
  conversationId: string;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  fileSize: number;
  messageType: "file" | "voice";
  body: string;
}) {
  const supabase = createClient();
  const userId = await currentUserId();

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      sender_id: userId,
      body: input.body,
      message_type: input.messageType,
    })
    .select("*")
    .single();
  if (messageError) throw messageError;

  const { data: attachment, error: attachmentError } = await supabase
    .from("attachments")
    .insert({
      message_id: message.id,
      uploader_id: userId,
      file_name: input.fileName,
      file_path: input.filePath,
      mime_type: input.mimeType,
      file_size: input.fileSize,
    })
    .select("*")
    .single();
  if (attachmentError) throw attachmentError;

  return { message: message as MessageRow, attachment: attachment as AttachmentRow };
}

export async function uploadChatFile(conversationId: string, file: File) {
  const supabase = createClient();
  const userId = await currentUserId();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${conversationId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from("chat-attachments").upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (uploadError) throw uploadError;

  return createAttachmentMessage({
    conversationId,
    fileName: file.name,
    filePath: path,
    mimeType: file.type || null,
    fileSize: file.size,
    messageType: "file",
    body: file.name,
  });
}

export async function uploadVoiceMessage(conversationId: string, blob: Blob, durationMs: number) {
  const supabase = createClient();
  const userId = await currentUserId();
  const mimeType = blob.type || "audio/webm";
  const extension = mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
  const fileName = `voice-${Date.now()}.${extension}`;
  const path = `${userId}/${conversationId}/${crypto.randomUUID()}-${fileName}`;

  const { error: uploadError } = await supabase.storage.from("chat-attachments").upload(path, blob, {
    upsert: false,
    contentType: mimeType,
  });
  if (uploadError) throw uploadError;

  return createAttachmentMessage({
    conversationId,
    fileName,
    filePath: path,
    mimeType,
    fileSize: blob.size,
    messageType: "voice",
    body: `Voice message • ${Math.max(1, Math.round(durationMs / 1000))}s`,
  });
}

export async function getAttachmentDownloadUrl(filePath: string) {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("chat-attachments").createSignedUrl(filePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  return Notification.requestPermission();
}

export function subscribeToMessages(conversationId: string, callback: (payload: unknown) => void) {
  const supabase = createClient();
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      callback,
    )
    .subscribe();
}


export async function getStories() {
  const supabase = createClient();
  return supabase
    .from("stories")
    .select("*")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
}

export async function getStoryComments(storyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("story_comments")
    .select("*")
    .eq("story_id", storyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as StoryCommentRow[];
}

export async function createStoryComment(storyId: string, body: string) {
  const supabase = createClient();
  const userId = await currentUserId();
  const clean = body.trim();
  if (!clean) throw new Error("Comment cannot be empty.");
  const { data, error } = await supabase
    .from("story_comments")
    .insert({ story_id: storyId, user_id: userId, body: clean })
    .select("*")
    .single();
  if (error) throw error;
  return data as StoryCommentRow;
}

export async function createTextStory(body: string) {
  const supabase = createClient();
  const userId = await currentUserId();
  const clean = body.trim();
  if (!clean) throw new Error("Story cannot be empty.");
  const { data, error } = await supabase
    .from("stories")
    .insert({ user_id: userId, story_type: "text", body: clean })
    .select("*")
    .single();
  if (error) throw error;
  return data as StoryRow;
}

export async function uploadPhotoStory(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  return uploadStoryMedia(file);
}

export async function getStoryMediaUrl(filePath: string) {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("story-media").createSignedUrl(filePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteStory(storyId: string) {
  const supabase = createClient();
  const { data: story, error: readError } = await supabase
    .from("stories")
    .select("media_path")
    .eq("id", storyId)
    .single();
  if (readError) throw readError;
  const { error } = await supabase.from("stories").delete().eq("id", storyId);
  if (error) throw error;
  if (story?.media_path) await supabase.storage.from("story-media").remove([story.media_path]);
}

export function subscribeToStories(callback: (payload: unknown) => void) {
  const supabase = createClient();
  return supabase
    .channel("stories:all")
    .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, callback)
    .subscribe();
}

export async function updateMyProfile(input: {
  displayName: string;
  username?: string;
}) {
  const supabase = createClient();
  const userId = await currentUserId();
  const displayName = input.displayName.trim();
  const username = (input.username ?? "").trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
  if (!displayName) throw new Error("Display name is required.");

  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      username: username || null,
      last_seen: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function uploadProfileAvatar(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Profile photo must be smaller than 8 MB.");

  const supabase = createClient();
  const userId = await currentUserId();
  const extension = (file.name.split(".").pop() || "jpg").replace(/[^a-zA-Z0-9]/g, "") || "jpg";
  const path = `${userId}/avatar-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("profile-media").upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from("profile-media").getPublicUrl(path);
  const avatarUrl = publicUrlData.publicUrl;
  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl, last_seen: new Date().toISOString() })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function uploadStoryMedia(file: File) {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) throw new Error("Choose a photo or video file.");
  if (isImage && file.size > 15 * 1024 * 1024) throw new Error("Story photo must be smaller than 15 MB.");
  if (isVideo && file.size > 80 * 1024 * 1024) throw new Error("Story video must be smaller than 80 MB.");

  const supabase = createClient();
  const userId = await currentUserId();
  const extension = (file.name.split(".").pop() || (isVideo ? "mp4" : "jpg")).replace(/[^a-zA-Z0-9]/g, "");
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("story-media").upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (uploadError) throw uploadError;

  const storyType = isVideo ? "video" : "image";
  const { data, error } = await supabase
    .from("stories")
    .insert({ user_id: userId, story_type: storyType, media_path: path })
    .select("*")
    .single();
  if (error) {
    await supabase.storage.from("story-media").remove([path]);
    throw error;
  }
  return data as StoryRow;
}
