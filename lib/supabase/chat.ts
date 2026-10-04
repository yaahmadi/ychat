      .eq("user_id", userId);
    if (error) throw error;
    return null;
  }

  const { data, error } = await supabase
    .from("message_reactions")
    .upsert(
      { message_id: messageId, user_id: userId, reaction: clean },
      { onConflict: "message_id,user_id" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as MessageReactionRow;
}

export function subscribeToMessageReactions(callback: (payload: unknown) => void) {
  const supabase = createClient();
  return supabase
    .channel(`message-reactions:${crypto.randomUUID()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "message_reactions" },
      callback,
    )
    .subscribe();
}

export async function markStoryViewed(storyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("record_story_view", { target_story_id: storyId });
  if (!error && data) return data as StoryViewRow;

  const userId = await currentUserId();
  const fallback = await supabase
    .from("story_views")
    .upsert(
      { story_id: storyId, user_id: userId, viewed_at: new Date().toISOString() },
      { onConflict: "story_id,user_id" },
    )
    .select("*")
    .single();
  if (fallback.error) throw fallback.error;
  return fallback.data as StoryViewRow;
}

export async function getStoryViews(storyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("story_views")
    .select("*")
    .eq("story_id", storyId)
    .order("viewed_at", { ascending: false });
  return { data: (data ?? []) as StoryViewRow[], error };
}

export async function getStoryReactions(storyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("story_reactions")
    .select("*")
    .eq("story_id", storyId)
    .order("created_at", { ascending: true });
  return { data: (data ?? []) as StoryReactionRow[], error };
}

export async function toggleStoryReaction(storyId: string, reaction: string) {
  const supabase = createClient();
  const userId = await currentUserId();
  const clean = reaction.trim();
  if (!clean) return null;
  const { data: existing, error: readError } = await supabase
    .from("story_reactions")
    .select("story_id,user_id,reaction")
    .eq("story_id", storyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;
  if (existing?.reaction === clean) {
    const { error } = await supabase.from("story_reactions").delete().eq("story_id", storyId).eq("user_id", userId);
    if (error) throw error;
    return null;