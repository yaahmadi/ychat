"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Camera, Image as ImageIcon, Plus, Send, Trash2, Type, Video, X } from "lucide-react";
import {
  createTextStory,
  createStoryComment,
  deleteStory,
  getStoryComments,
  getStoryViews,
  getStoryReactions,
  getStories,
  getStoryMediaUrl,
  markStoryViewed,
  subscribeToStoryReactions,
  subscribeToStories,
  subscribeToStoryViews,
  toggleStoryReaction,
  uploadStoryMedia,
} from "@/lib/supabase/chat";
import type { ProfileRow, StoryCommentRow, StoryReactionRow, StoryRow } from "@/lib/supabase/types";

function initials(name?: string | null) {
  return (name?.trim()?.slice(0, 1) || "U").toUpperCase();
}

function timeLeft(expiresAt: string) {
  const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h` : `${minutes}m`;
}

function StoryMedia({ story, className = "", onEnded }: { story: StoryRow; className?: string; onEnded?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!story.media_path) return;
    let mounted = true;
    void getStoryMediaUrl(story.media_path)
      .then((next) => {
        if (mounted) setUrl(next);
      })
      .catch(() => {
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, [story.media_path]);

  if (failed) return <div className={`flex items-center justify-center bg-white/5 text-xs text-white/60 ${className}`}>Media unavailable</div>;
  if (!url) return <div className={`animate-pulse bg-white/5 ${className}`} />;
  if (story.story_type === "video") {
    return <video className={className} src={url} controls playsInline preload="metadata" onEnded={onEnded} />;
  }
  return <div className={`bg-cover bg-center ${className}`} style={{ backgroundImage: `url(${url})` }} />;
}

export function StoriesPanel({ profiles, userId }: { profiles: ProfileRow[]; userId: string | null }) {
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [composer, setComposer] = useState<"text" | null>(null);
  const [text, setText] = useState("");
  const [textFontSize, setTextFontSize] = useState(30);
  const [textBackground, setTextBackground] = useState("ocean");
  const [textColor, setTextColor] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerStory, setViewerStory] = useState<StoryRow | null>(null);
  const [comments, setComments] = useState<StoryCommentRow[]>([]);
  const [commentText, setCommentText] = useState("");
  const [storyViewers, setStoryViewers] = useState<ProfileRow[]>([]);
  const [viewCount, setViewCount] = useState(0);
  const [storyReactions, setStoryReactions] = useState<StoryReactionRow[]>([]);

  const refresh = useCallback(async () => {
    const { data, error: storyError } = await getStories();
    if (storyError) {
      setError(storyError.message);
      return;
    }
    setStories((data ?? []) as StoryRow[]);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    const channel = subscribeToStories(() => void refresh());
    return () => {
      window.clearTimeout(initialLoad);
      void channel.unsubscribe();
    };
  }, [refresh]);

  const grouped = useMemo(() => {
    const map = new Map<string, StoryRow[]>();
    const validStories = stories.filter((item) => {
      if (!item?.id || !item.user_id || !item.expires_at) return false;
      if (item.story_type === "text") return typeof item.body === "string" && item.body.trim().length > 0;
      return (item.story_type === "image" || item.story_type === "video") && typeof item.media_path === "string" && item.media_path.length > 0;
    });
    for (const story of validStories) {
      const current = map.get(story.user_id) ?? [];
      current.push(story);
      map.set(story.user_id, current);
    }
    return Array.from(map.entries()).map(([profileId, items]) => ({
      profileId,
      profile: profiles.find((profile) => profile.id === profileId) ?? null,
      items: items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    }));
  }, [profiles, stories]);

  async function publishText() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createTextStory(text, {
        fontSize: textFontSize,
        background: textBackground,
        color: textColor,
      });
      setText("");
      setComposer(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to publish story.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMedia(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      await uploadStoryMedia(file);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to publish story media.");
    } finally {
      setBusy(false);
    }
  }

  async function openStory(story: StoryRow) {
    setError(null);
    setComments([]);
    setCommentText("");
    setViewerStory(story);

    try {
      if (userId && story.user_id !== userId) {
        await markStoryViewed(story.id);
      }
      const [viewsResult, reactionsResult] = await Promise.all([
        getStoryViews(story.id),
        getStoryReactions(story.id),
      ]);
      const viewRows = viewsResult.data ?? [];
      setViewCount(viewRows.length);
      setStoryViewers(viewRows.map((view) => profiles.find((profile) => profile.id === view.user_id)).filter(Boolean) as ProfileRow[]);
      setStoryReactions(reactionsResult.data ?? []);
      if (viewsResult.error) setError(viewsResult.error.message);
      if (reactionsResult.error) setError(reactionsResult.error.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load story activity.");
    }
  }

  async function reactToStory(reaction: string) {
    if (!viewerStory || !userId || viewerStory.user_id === userId) return;
    try {
      await toggleStoryReaction(viewerStory.id, reaction);
      const result = await getStoryReactions(viewerStory.id);
      if (result.error) throw result.error;
      setStoryReactions(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to react to story.");
    }
  }

  async function removeStory(storyId: string) {
    try {
      await deleteStory(storyId);
      setViewerStory(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete story.");
    }
  }

  const viewerProfile = viewerStory ? profiles.find((profile) => profile.id === viewerStory.user_id) : null;
  const viewerStories = useMemo(
    () => viewerStory ? (grouped.find((group) => group.profileId === viewerStory.user_id)?.items ?? []) : [],
    [grouped, viewerStory],
  );
  const viewerIndex = viewerStory ? viewerStories.findIndex((story) => story.id === viewerStory.id) : -1;

  const showAdjacentStory = useCallback((direction: -1 | 1) => {
    if (!viewerStory || viewerIndex < 0) return;
    const next = viewerStories[viewerIndex + direction];
    if (next) {
      setComments([]);
      setCommentText("");
      void openStory(next);
    }
    else if (direction === 1) closeViewer();
  }, [viewerIndex, viewerStories, viewerStory]);

  useEffect(() => {
    if (!viewerStory) return;
    const duration = viewerStory.story_type === "video" ? null : 15_000;
    if (duration === null) return;
    const timer = window.setTimeout(() => showAdjacentStory(1), duration);
    return () => window.clearTimeout(timer);
  }, [showAdjacentStory, viewerStory]);

  useEffect(() => {
    if (!viewerStory) return;
    let cancelled = false;
    void getStoryComments(viewerStory.id)
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load story comments."));
    return () => {
      cancelled = true;
    };
  }, [viewerStory]);

  useEffect(() => {
    if (!viewerStory) return;
    const channel = subscribeToStoryViews((payload) => {
      const event = payload as { eventType?: string; new?: { story_id?: string }; old?: { story_id?: string } };
      const row = event.new ?? event.old;
      if (row?.story_id === viewerStory.id) {
        void getStoryViews(viewerStory.id).then((result) => {
          if (!result.error) setViewCount(result.data?.length ?? 0);
        });
      }
    });
    return () => {
      void channel.unsubscribe();
    };
  }, [viewerStory]);

  useEffect(() => {
    if (!viewerStory) return;
    const channel = subscribeToStoryReactions((payload) => {
      const event = payload as { eventType?: string; new?: StoryReactionRow; old?: StoryReactionRow };
      const row = event.new ?? event.old;
      if (!row || row.story_id !== viewerStory.id) return;
      if (event.eventType === "DELETE") {
        setStoryReactions((current) => current.filter((item) => !(item.story_id === row.story_id && item.user_id === row.user_id)));
      } else {
        setStoryReactions((current) => [
          ...current.filter((item) => !(item.story_id === row.story_id && item.user_id === row.user_id)),
          row,
        ]);
      }
    });
    return () => {
      void channel.unsubscribe();
    };
  }, [viewerStory]);

  async function sendComment() {
    if (!viewerStory || !commentText.trim()) return;
    try {
      const comment = await createStoryComment(viewerStory.id, commentText);
      setComments((current) => [...current, comment]);
      setCommentText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send story comment.");
    }
  }

  function closeViewer() {
    setViewerStory(null);
    setComments([]);
    setCommentText("");
    setStoryReactions([]);
    setStoryViewers([]);
    setViewCount(0);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#06101d] p-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Stories</h1>
            <p className="mt-1 text-sm text-slate-500">Share text, photos or videos for 24 hours.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setComposer("text")} className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0a1b2d] px-4 py-2.5 text-sm hover:border-cyan-400/25"><Type className="h-4 w-4" /> Text</button>
            <button type="button" onClick={() => mediaInputRef.current?.click()} className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"><Camera className="h-4 w-4" /> Photo / video</button>
            <input ref={mediaInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMedia} />
          </div>
        </div>

        {error && <div className="mb-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}

        <div className="flex gap-5 overflow-x-auto pb-4 ychat-scrollbar">
          <button type="button" onClick={() => setComposer("text")} className="group flex w-20 shrink-0 flex-col items-center gap-2 text-center">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-cyan-400/50 bg-[#0a1b2d] text-cyan-300"><Plus className="h-6 w-6" /></div>
            <span className="text-xs text-slate-300">Add story</span>
          </button>

          {grouped.map(({ profileId, profile, items }) => {
            const latest = items[0];
            if (!latest) return null;
            return (
              <button key={profileId} type="button" onClick={() => void openStory(latest)} className="flex w-20 shrink-0 flex-col items-center gap-2 text-center">
                <div className="rounded-full bg-gradient-to-tr from-cyan-400 via-blue-500 to-teal-300 p-[2px]">
                  <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-[#06101d] bg-[#0a1b2d] text-lg font-semibold text-cyan-200">
                    {latest.story_type === "text" ? initials(profile?.display_name) : <StoryMedia key={latest.id} story={latest} className="h-full w-full object-cover" />}
                    {latest.story_type === "video" && <span className="absolute bottom-1 right-1 rounded-full bg-black/60 p-1"><Video className="h-3 w-3 text-white" /></span>}
                  </div>
                </div>
                <span className="w-full truncate text-xs text-slate-300">{profileId === userId ? "Your story" : profile?.display_name || "User"}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {grouped.map(({ profileId, profile, items }) => {
            const latest = items[0];
            if (!latest) return null;
            return (
              <button key={profileId} type="button" onClick={() => setViewerStory(latest)} className="overflow-hidden rounded-3xl border border-white/10 bg-[#0a1b2d] text-left transition hover:border-cyan-400/25">
                <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-[#0c2840] via-[#0b3650] to-[#075e72]">
                  {latest.story_type === "text" ? (
                    <div className="flex h-full items-center justify-center p-8 text-center text-2xl font-semibold leading-9 text-white">{latest.body}</div>
                  ) : (
                    <StoryMedia key={latest.id} story={latest} className="h-full w-full object-cover" />
                  )}
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/65 to-transparent p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-semibold text-cyan-100">{initials(profile?.display_name)}</div>
                    <div><p className="text-sm font-medium text-white">{profileId === userId ? "Your story" : profile?.display_name || "User"}</p><p className="text-[11px] text-white/60">{items.length} {items.length === 1 ? "story" : "stories"} · expires in {timeLeft(latest.expires_at)}</p></div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {stories.length === 0 && (
          <div className="mt-10 rounded-3xl border border-dashed border-white/10 p-10 text-center text-slate-500"><ImageIcon className="mx-auto h-10 w-10 text-cyan-300" /><p className="mt-4 font-medium text-slate-300">No stories yet</p><p className="mt-1 text-sm">Publish text, a photo or a video. It disappears automatically after 24 hours.</p></div>
        )}
      </div>

      {composer === "text" && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#071827] p-5 shadow-2xl">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Text story</h2><p className="text-xs text-slate-500">Visible for 24 hours</p></div><button type="button" onClick={() => setComposer(null)} className="rounded-full p-2 text-slate-400 hover:bg-white/5"><X className="h-5 w-5" /></button></div>
            <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-inner">
              <div className={`flex min-h-72 items-center justify-center p-8 text-center ${textBackground === "ocean" ? "bg-gradient-to-br from-[#0b2f49] via-[#0a4b61] to-[#075e72]" : textBackground === "sunset" ? "bg-gradient-to-br from-[#7c2d12] via-[#be123c] to-[#7c3aed]" : textBackground === "midnight" ? "bg-gradient-to-br from-[#020617] via-[#172554] to-[#312e81]" : "bg-white"}`}>
                <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={400} placeholder="Type your story…" style={{ color: textColor, fontSize: `${textFontSize}px` }} className="min-h-44 w-full resize-none bg-transparent text-center font-semibold leading-tight outline-none placeholder:opacity-40" />
              </div>
              <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
                <label className="text-xs font-medium text-slate-600">Text size
                  <select value={textFontSize} onChange={(event) => setTextFontSize(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                    {[22,26,30,36,44].map((size) => <option key={size} value={size}>{size}px</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">Background
                  <select value={textBackground} onChange={(event) => setTextBackground(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                    <option value="ocean">Ocean</option><option value="sunset">Sunset</option><option value="midnight">Midnight</option><option value="clean">Clean white</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">Text color
                  <input type="color" value={textColor} onChange={(event) => setTextColor(event.target.value)} className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white p-1" />
                </label>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between"><span className="text-xs text-slate-500">{text.length}/400</span><button type="button" disabled={!text.trim() || busy} onClick={() => void publishText()} className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40"><Send className="h-4 w-4" /> {busy ? "Publishing…" : "Publish"}</button></div>
          </div>
        </div>
      )}

      {viewerStory && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/95 p-3 sm:p-6">
          <div className="relative flex h-[min(90vh,820px)] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b2f49] via-[#0a4b61] to-[#075e72] shadow-2xl">
            <div className="relative min-h-0 flex-1">
            <div className="absolute inset-x-3 top-2 z-20 flex gap-1" aria-label={`Story ${viewerIndex + 1} of ${viewerStories.length}`}>
              {viewerStories.map((story, index) => <span key={story.id} className={`h-1 flex-1 rounded-full ${index <= viewerIndex ? "bg-white" : "bg-white/30"}`} />)}
            </div>
            {viewerStory.story_type === "text" ? <div
  className={`flex h-full w-full items-center justify-center p-10 text-center font-semibold leading-tight ${
    viewerStory.text_background === "sunset" ? "bg-gradient-to-br from-[#7c2d12] via-[#be123c] to-[#7c3aed]" :
    viewerStory.text_background === "midnight" ? "bg-gradient-to-br from-[#020617] via-[#172554] to-[#312e81]" :
    viewerStory.text_background === "clean" ? "bg-white" :
    "bg-gradient-to-br from-[#0b2f49] via-[#0a4b61] to-[#075e72]"
  }`}
  style={{ fontSize: `${viewerStory.text_font_size || 30}px`, color: viewerStory.text_color || "#ffffff" }}
>{viewerStory.body}</div> : <StoryMedia key={viewerStory.id} story={viewerStory} className="h-full w-full object-contain" onEnded={() => showAdjacentStory(1)} />}
            <button type="button" aria-label="Previous story" onClick={() => showAdjacentStory(-1)} disabled={viewerIndex <= 0} className="absolute bottom-0 left-0 top-16 z-10 w-1/3 disabled:pointer-events-none" />
            <button type="button" aria-label="Next story" onClick={() => showAdjacentStory(1)} className="absolute bottom-0 right-0 top-16 z-10 w-1/3" />
            <div className="absolute inset-x-0 top-0 z-30 mt-2 flex items-center gap-3 bg-gradient-to-b from-black/75 to-transparent p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">{initials(viewerProfile?.display_name)}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{viewerProfile?.display_name || "User"}</p><p className="text-[11px] text-white/60">expires in {timeLeft(viewerStory.expires_at)}</p></div>
              {viewerStory.user_id === userId && <button type="button" onClick={() => void removeStory(viewerStory.id)} className="rounded-full bg-black/25 p-2 text-white/80 hover:bg-rose-500/40"><Trash2 className="h-4 w-4" /></button>}
              <button type="button" onClick={closeViewer} className="rounded-full bg-black/25 p-2 text-white/80"><X className="h-4 w-4" /></button>
            </div>
            </div>
            {viewerStory.user_id === userId && <div className="border-t border-white/10 bg-black/20 px-3 py-2"><p className="text-xs font-semibold text-white/80">{viewCount} {viewCount === 1 ? "view" : "views"}</p><div className="mt-1 flex flex-wrap gap-2">{storyViewers.slice(0, 12).map((profile) => <span key={profile.id} className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-white/75">{profile.display_name}</span>)}</div></div>}
            <div className="border-t border-white/10 bg-black/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">{storyReactions.length} {storyReactions.length === 1 ? "reaction" : "reactions"}</span>
                <div className="ml-auto flex gap-1">
                  {["❤️","👍","😂","😮","😢","🔥","👏","🎉"].map((emoji) => {
                    const selected = storyReactions.some((item) => item.user_id === userId && item.reaction === emoji);
                    return (
                      <button
                        key={emoji}
                        type="button"
                        disabled={!userId || viewerStory.user_id === userId}
                        onClick={() => void reactToStory(emoji)}
                        className={`rounded-full px-1.5 py-1 text-base transition ${selected ? "bg-white/20 ring-1 ring-cyan-300/50" : "hover:bg-white/10"} disabled:opacity-40`}
                        aria-label={`React with ${emoji}`}
                      >{emoji}</button>
                    );
                  })}
                </div>
              </div>
              {storyReactions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {Array.from(new Set(storyReactions.map((item) => item.reaction))).map((emoji) => (
                    <span key={emoji} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/75">{emoji} {storyReactions.filter((item) => item.reaction === emoji).length}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-white/10 bg-black/30 p-3">
              <div className="max-h-28 space-y-2 overflow-y-auto ychat-scrollbar">
                {comments.map((comment) => {
                  const author = profiles.find((profile) => profile.id === comment.user_id);
                  return <div key={comment.id} className="text-xs text-white/85"><span className="font-semibold text-cyan-200">{author?.display_name || "User"}: </span>{comment.body}</div>;
                })}
                {comments.length === 0 && <p className="text-xs text-white/45">No comments yet.</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <input value={commentText} onChange={(event) => setCommentText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendComment(); }} placeholder={userId ? "Comment on story" : "Sign in to comment"} disabled={!userId} className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white outline-none placeholder:text-white/45 disabled:opacity-50" />
                <button type="button" onClick={() => void sendComment()} disabled={!userId || !commentText.trim()} className="rounded-full bg-cyan-500 px-4 text-sm font-semibold text-slate-950 disabled:opacity-40">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
