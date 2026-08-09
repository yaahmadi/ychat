"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Bell,
  Building2,
  Check,
  CircleDashed,
  ChevronLeft,
  Download,
  FileText,
  Files,
  Group,
  HardDriveUpload,
  LockKeyhole,
  LogOut,
  MessageCircle,
  MessageSquare,
  Mic,
  MoreVertical,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  Sparkles,
  Square,
  Trash2,
  Users,
  Video,
  Wifi,
  X,
} from "lucide-react";

import {
  addContactByLookup,
  createGroupConversation,
  getAttachmentDownloadUrl,
  getAttachments,
  getContactProfiles,
  getConversations,
  getMessages,
  requestNotificationPermission,
  sendMessage,
  startDirectConversation,
  subscribeToMessages,
  uploadChatFile,
  uploadProfileAvatar,
  updateMyProfile,
  uploadVoiceMessage,
} from "@/lib/supabase/chat";
import { createClient } from "@/lib/supabase/client";
import { useWebRtcCall, type CallMode } from "@/hooks/use-web-rtc-call";
import { ActiveCallOverlay, IncomingCallCard } from "@/components/chat/call-overlay";
import { StoriesPanel } from "@/components/chat/stories-panel";
import type {
  AttachmentRow,
  ConversationRow,
  MessageRow,
  ProfileRow,
} from "@/lib/supabase/types";

type ViewName = "stories" | "calls" | "chats" | "people" | "groups" | "files" | "admin" | "settings";

const navItems: Array<{ id: ViewName; label: string; icon: typeof MessageSquare }> = [
  { id: "stories", label: "Story", icon: CircleDashed },
  { id: "calls", label: "Calls", icon: Phone },
  { id: "chats", label: "Chats", icon: MessageSquare },
  { id: "people", label: "Contacts", icon: Users },
  { id: "groups", label: "Group", icon: Group },
  { id: "files", label: "Files", icon: Files },
  { id: "admin", label: "Admin", icon: LockKeyhole },
  { id: "settings", label: "Settings", icon: Settings },
];

const mobileNavItems = navItems.filter(({ id }) => ["stories", "calls", "chats", "people", "groups", "settings"].includes(id));

const EMOJIS = [
  "😀", "😂", "😊", "😍", "🥰", "😎", "🤔", "😅", "😭", "😡", "👍", "👎",
  "👏", "🙏", "🤝", "💪", "✅", "❌", "❤️", "💙", "🔥", "🎉", "🚀", "💯",
  "📌", "📎", "💻", "📱", "☕", "🫡", "👋", "✨", "🔐", "⚡", "🎯", "📞",
];

const STICKERS = ["👍", "❤️", "😂", "🎉", "🔥", "🚀", "💯", "👏", "🤝", "🫡", "✅", "☕"];

type CallLogEntry = {
  id: string;
  title: string;
  mode: CallMode;
  direction: "incoming" | "outgoing" | "missed";
  createdAt: string;
};

function initials(name?: string | null) {
  return (name?.trim()?.slice(0, 1) || "U").toUpperCase();
}

function formatBytes(value?: number | null) {
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function isProfileOnline(profile?: ProfileRow | null) {
  if (!profile?.last_seen) return profile?.status === "online";
  return Date.now() - new Date(profile.last_seen).getTime() < 90_000;
}

function Avatar({ profile, size = "md" }: { profile?: ProfileRow | null; size?: "sm" | "md" | "lg" }) {
  const classes = size === "sm" ? "h-9 w-9 text-xs" : size === "lg" ? "h-14 w-14 text-lg" : "h-11 w-11 text-sm";
  if (profile?.avatar_url) {
    return (
      <div className={`${classes} relative shrink-0 overflow-hidden rounded-full bg-slate-800`}>
        {/* Remote OAuth avatars are intentionally rendered as CSS backgrounds to avoid hostname config coupling. */}
        <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${profile.avatar_url})` }} />
      </div>
    );
  }
  return (
    <div className={`${classes} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/25 to-blue-500/20 font-semibold text-cyan-200`}>
      {initials(profile?.display_name)}
    </div>
  );
}

function AttachmentPlayer({ attachment, compact = false }: { attachment: AttachmentRow; compact?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = attachment.mime_type?.startsWith("image/") ?? false;
  const isVideo = attachment.mime_type?.startsWith("video/") ?? false;
  const isAudio = attachment.mime_type?.startsWith("audio/") ?? false;
  const isMedia = isImage || isVideo || isAudio;
  const [loading, setLoading] = useState(isMedia);

  async function loadUrl() {
    if (url || loading) return url;
    setLoading(true);
    try {
      const next = await getAttachmentDownloadUrl(attachment.file_path);
      setUrl(next);
      return next;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isMedia) return;
    let cancelled = false;
    void getAttachmentDownloadUrl(attachment.file_path)
      .then((next) => {
        if (!cancelled) setUrl(next);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.file_path, isMedia]);

  if (isAudio) {
    return (
      <div className="min-w-[220px] max-w-[320px]">
        {url ? <audio controls preload="metadata" src={url} className="h-10 w-full max-w-[310px]" /> : <div className="flex items-center gap-2 text-xs opacity-70"><Mic className="h-4 w-4" /> Loading voice…</div>}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="max-w-[360px] overflow-hidden rounded-xl bg-black/30">
        {url ? <video controls playsInline preload="metadata" src={url} className="max-h-[420px] w-full rounded-xl object-contain" /> : <div className="flex h-40 items-center justify-center text-xs text-slate-400">Loading video…</div>}
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] opacity-70"><span className="truncate">{attachment.file_name}</span><span>{formatBytes(attachment.file_size)}</span></div>
      </div>
    );
  }

  if (isImage) {
    return (
      <button type="button" onClick={() => void loadUrl().then((downloadUrl) => downloadUrl && window.open(downloadUrl, "_blank", "noopener,noreferrer"))} className="block max-w-[360px] overflow-hidden rounded-xl bg-black/20 text-left">
        {url ? <div className="h-64 w-[min(360px,70vw)] bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${url})` }} /> : <div className="flex h-40 w-[min(360px,70vw)] items-center justify-center text-xs text-slate-400">Loading photo…</div>}
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] opacity-70"><span className="truncate">{attachment.file_name}</span><span>{formatBytes(attachment.file_size)}</span></div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void loadUrl().then((downloadUrl) => downloadUrl && window.open(downloadUrl, "_blank", "noopener,noreferrer"))}
      className={`flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 text-left transition hover:bg-black/20 ${compact ? "p-2" : "p-3"}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200"><FileText className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{attachment.file_name}</p><p className="text-[11px] opacity-60">{formatBytes(attachment.file_size)}</p></div>
      <Download className="h-4 w-4 opacity-60" />
    </button>
  );
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#071827] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function WorkspaceShell() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const contactLookupRef = useRef<HTMLInputElement | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const recordingConversationIdRef = useRef<string | null>(null);
  const recordingStartedRef = useRef<number>(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [view, setView] = useState<ViewName>("chats");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [creatingChat, setCreatingChat] = useState<string | null>(null);
  const [contactLookup, setContactLookup] = useState("");
  const [addingContact, setAddingContact] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [installReady, setInstallReady] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<string>("default");
  const [profileName, setProfileName] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = window.localStorage.getItem("ychat:call-logs");
      return saved ? (JSON.parse(saved) as CallLogEntry[]) : [];
    } catch {
      return [];
    }
  });
  const [callFilter, setCallFilter] = useState<"recent" | "missed">("recent");

  async function refreshConversations(preferredId?: string) {
    const { data, error: conversationsError } = await getConversations();
    if (conversationsError) {
      setError(conversationsError.message);
      return;
    }
    const rows = (data ?? []) as ConversationRow[];
    setConversations(rows);
    if (preferredId) setActiveConversationId(preferredId);
    else if (!activeConversationId && rows[0]?.id) setActiveConversationId(rows[0].id);
  }

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);

      const currentUserId = sessionData.session?.user.id ?? null;
      setUserId(currentUserId);

      const [profilesResult, conversationsResult, attachmentsResult] = await Promise.all([
        getContactProfiles(),
        getConversations(),
        getAttachments(),
      ]);
      if (!mounted) return;

      if (profilesResult.error) setError(profilesResult.error.message);
      if (conversationsResult.error) setError(conversationsResult.error.message);
      if (attachmentsResult.error) setError(attachmentsResult.error.message);

      setProfiles((profilesResult.data ?? []) as ProfileRow[]);
      const rows = (conversationsResult.data ?? []) as ConversationRow[];
      setConversations(rows);
      setAttachments((attachmentsResult.data ?? []) as AttachmentRow[]);
      if (rows[0]?.id) setActiveConversationId(rows[0].id);
      setLoading(false);
    }

    void load();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null));

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const touchPresence = () => {
      void supabase.from("profiles").update({ status: "online", last_seen: new Date().toISOString() }).eq("id", userId);
    };
    touchPresence();
    const timer = window.setInterval(touchPresence, 45_000);
    const onVisibility = () => {
      if (!document.hidden) touchPresence();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const scheduleWorkspaceRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void (async () => {
          const [profilesResult, conversationsResult, attachmentsResult] = await Promise.all([
            getContactProfiles(), getConversations(), getAttachments(),
          ]);
          if (disposed) return;
          if (profilesResult.error) setError(profilesResult.error.message);
          if (conversationsResult.error) setError(conversationsResult.error.message);
          if (attachmentsResult.error) setError(attachmentsResult.error.message);
          setProfiles((profilesResult.data ?? []) as ProfileRow[]);
          setConversations((conversationsResult.data ?? []) as ConversationRow[]);
          setAttachments((attachmentsResult.data ?? []) as AttachmentRow[]);
        })();
      }, 120);
    };

    const workspaceSubscription = supabase
      .channel(`workspace:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members", filter: `user_id=eq.${userId}` }, scheduleWorkspaceRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, scheduleWorkspaceRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, scheduleWorkspaceRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "attachments" }, scheduleWorkspaceRefresh)
      .subscribe();

    return () => {
      disposed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(workspaceSubscription);
    };
  }, [userId]);

  useEffect(() => {
    if (!activeConversationId) return;
    const conversationId: string = activeConversationId;
    let cancelled = false;

    async function loadMessages() {
      const { data, error: messagesError } = await getMessages(conversationId);
      if (cancelled) return;
      if (messagesError) {
        setError(messagesError.message);
        return;
      }
      setMessages((data ?? []) as MessageRow[]);
    }

    void loadMessages();
    const subscription = subscribeToMessages(conversationId, (payload) => {
      const newMessage = (payload as { new?: MessageRow }).new;
      if (!newMessage) return;
      setMessages((current) => current.some((message) => message.id === newMessage.id) ? current : [...current, newMessage]);

      if (newMessage.sender_id !== userId && "Notification" in window && Notification.permission === "granted" && document.hidden) {
        const sender = profiles.find((profile) => profile.id === newMessage.sender_id)?.display_name || "New message";
        new Notification(sender, { body: newMessage.message_type === "text" ? newMessage.body : `Sent a ${newMessage.message_type}`, icon: "/icon-192.png" });
      }
    });

    return () => {
      cancelled = true;
      void subscription.unsubscribe();
    };
  }, [activeConversationId, profiles, userId]);

  useEffect(() => {
    const scroller = messagesScrollRef.current;
    if (!scroller) return;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  }, [messages.length, activeConversationId]);

  useEffect(() => {
    const onReady = () => setInstallReady(true);
    window.addEventListener("yama:pwa-install-ready", onReady);
    queueMicrotask(() => {
      setInstallReady(Boolean(window.__yamaInstallPrompt));
      if ("Notification" in window) setNotificationPermission(Notification.permission);
    });
    return () => window.removeEventListener("yama:pwa-install-ready", onReady);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("ychat:call-logs", JSON.stringify(callLogs.slice(0, 80)));
  }, [callLogs]);

  const currentProfile = useMemo(() => profiles.find((profile) => profile.id === userId) ?? null, [profiles, userId]);

  const otherProfiles = useMemo(() => profiles.filter((profile) => profile.id !== userId), [profiles, userId]);
  const shareCode = currentProfile?.contact_code || currentProfile?.username || userId || "";
  const shareText = `Add me on Ychat with this ID: ${shareCode}`;

  function navigateView(nextView: ViewName) {
    if (nextView === "settings" && currentProfile) {
      setProfileName(currentProfile.display_name || "");
      setProfileUsername(currentProfile.username || "");
    }
    setView(nextView);
    if (nextView !== "chats") setActiveConversationId(null);
  }
  const activeConversation = useMemo(() => conversations.find((conversation) => conversation.id === activeConversationId) ?? null, [conversations, activeConversationId]);
  const groupConversations = useMemo(() => conversations.filter((conversation) => conversation.type === "group"), [conversations]);

  function getConversationName(conversation: ConversationRow) {
    if (conversation.title?.trim()) return conversation.title;
    if (conversation.type === "group") return "Group chat";
    const otherMember = conversation.conversation_members?.find((member) => member.user_id !== userId);
    const otherProfile = otherMember ? profiles.find((profile) => profile.id === otherMember.user_id) : null;
    return otherProfile?.display_name || otherProfile?.username || "Private conversation";
  }

  function getConversationProfile(conversation: ConversationRow) {
    if (conversation.type === "group") return null;
    const otherMember = conversation.conversation_members?.find((member) => member.user_id !== userId);
    return otherMember ? profiles.find((profile) => profile.id === otherMember.user_id) ?? null : null;
  }

  function getSenderName(senderId: string) {
    const profile = profiles.find((item) => item.id === senderId);
    return profile?.display_name || profile?.username || "User";
  }

  const searchQuery = search.trim().toLowerCase();
  const filteredConversations = searchQuery
    ? conversations.filter((conversation) => getConversationName(conversation).toLowerCase().includes(searchQuery))
    : conversations;

  const activeMembers = useMemo(() => {
    if (!activeConversation) return [];
    return (activeConversation.conversation_members ?? []).map((member) => profiles.find((profile) => profile.id === member.user_id)).filter(Boolean) as ProfileRow[];
  }, [activeConversation, profiles]);

  const call = useWebRtcCall(userId, currentProfile?.display_name || "User");

  function logCall(entry: Omit<CallLogEntry, "id" | "createdAt">) {
    setCallLogs((current) => [
      { ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ...current,
    ].slice(0, 80));
  }

  async function beginCall(mode: CallMode) {
    if (!activeConversation) return;
    const title = getConversationName(activeConversation);
    try {
      await call.startCall({
        conversationId: activeConversation.id,
        conversationTitle: title,
        mode,
        memberIds: activeConversation.conversation_members?.map((member) => member.user_id) ?? [],
      });
      logCall({ title, mode, direction: "outgoing" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start call.");
    }
  }

  async function acceptIncomingCall() {
    if (call.incomingCall) {
      logCall({ title: call.incomingCall.conversationTitle, mode: call.incomingCall.mode, direction: "incoming" });
    }
    await call.acceptCall();
  }

  function declineIncomingCall() {
    if (call.incomingCall) {
      logCall({ title: call.incomingCall.conversationTitle, mode: call.incomingCall.mode, direction: "missed" });
    }
    void call.declineCall();
  }

  function selectConversation(conversationId: string) {
    setMessages([]);
    setError(null);
    setActiveConversationId(conversationId);
    setView("chats");
    setEmojiOpen(false);
    setStickerOpen(false);
    setPlusOpen(false);
  }

  async function handleSend(messageType: string = "text", overrideBody?: string) {
    const body = (overrideBody ?? draft).trim();
    if (!body || !activeConversationId || sending) return;
    setSending(true);
    setError(null);
    try {
      let { data, error: sendError } = await sendMessage({ conversationId: activeConversationId, body, messageType });
      if (sendError && messageType === "sticker") {
        const retry = await sendMessage({ conversationId: activeConversationId, body, messageType: "text" });
        data = retry.data;
        sendError = retry.error;
      }
      if (sendError) throw sendError;
      if (data) {
        const sent = data as MessageRow;
        setMessages((current) => current.some((message) => message.id === sent.id) ? current : [...current, sent]);
      }
      if (!overrideBody) setDraft("");
      setStickerOpen(false);
      setPlusOpen(false);
      await refreshConversations(activeConversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  async function handleStartChat(profileId: string) {
    setCreatingChat(profileId);
    setError(null);
    try {
      const conversationId = await startDirectConversation(profileId);
      setMessages([]);
      await refreshConversations(conversationId);
      setPeopleOpen(false);
      setView("chats");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create conversation.");
    } finally {
      setCreatingChat(null);
    }
  }

  async function handleAddContact() {
    if (addingContact) return;
    setAddingContact(true);
    setError(null);
    try {
      const contactId = await addContactByLookup(contactLookup);
      setContactLookup("");
      const profilesResult = await getContactProfiles();
      if (profilesResult.error) throw profilesResult.error;
      setProfiles((profilesResult.data ?? []) as ProfileRow[]);
      await handleStartChat(contactId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add contact.");
    } finally {
      setAddingContact(false);
    }
  }

  async function handlePickPhoneContact() {
    type ContactPicker = {
      select: (
        properties: Array<"name" | "email" | "tel">,
        options?: { multiple?: boolean },
      ) => Promise<Array<{ name?: string[]; email?: string[]; tel?: string[] }>>;
    };
    const contacts = (navigator as Navigator & { contacts?: ContactPicker }).contacts;
    if (!contacts?.select) {
      setError("Phonebook contact picker is only available in supported mobile browsers. You can still add by email, username, or Ychat ID.");
      return;
    }
    try {
      const picked = await contacts.select(["name", "email", "tel"], { multiple: false });
      const contact = picked[0];
      const lookup = contact?.email?.[0] || contact?.tel?.[0] || contact?.name?.[0] || "";
      if (lookup) setContactLookup(lookup);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unable to read phonebook contact.");
    }
  }

  async function handleCreateGroup() {
    if (!groupTitle.trim()) {
      setError("Enter a group name.");
      return;
    }
    if (groupMembers.length === 0) {
      setError("Select at least one group member.");
      return;
    }
    setError(null);
    try {
      const conversationId = await createGroupConversation(groupTitle, groupMembers);
      setGroupTitle("");
      setGroupMembers([]);
      setGroupOpen(false);
      setMessages([]);
      await refreshConversations(conversationId);
      setView("chats");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create group.");
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !activeConversationId || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadChatFile(activeConversationId, file);
      setMessages((current) => current.some((message) => message.id === result.message.id) ? current : [...current, result.message]);
      setAttachments((current) => [result.attachment, ...current]);
      await refreshConversations(activeConversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload file.");
    } finally {
      setUploading(false);
    }
  }

  async function startVoiceRecording() {
    if (!activeConversationId || recording) return;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Voice recording requires a modern browser, HTTPS, and microphone permission.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      voiceStreamRef.current = stream;
      recordingConversationIdRef.current = activeConversationId;
      const supportedMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4;codecs=mp4a.40.2",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const preferred = supportedMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      voiceChunksRef.current = [];
      recordingStartedRef.current = Date.now();
      setRecordingSeconds(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const conversationId = recordingConversationIdRef.current;
        const duration = Date.now() - recordingStartedRef.current;
        const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        voiceChunksRef.current = [];
        recordingConversationIdRef.current = null;
        voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
        voiceStreamRef.current = null;
        setRecording(false);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;

        if (!conversationId || blob.size === 0) return;
        setUploading(true);
        void uploadVoiceMessage(conversationId, blob, duration)
          .then((result) => {
            setMessages((current) => current.some((message) => message.id === result.message.id) ? current : [...current, result.message]);
            setAttachments((current) => [result.attachment, ...current]);
            return refreshConversations(conversationId);
          })
          .catch((err) => setError(err instanceof Error ? err.message : "Unable to send voice message."))
          .finally(() => setUploading(false));
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(Math.floor((Date.now() - recordingStartedRef.current) / 1000)), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone is not available.");
    }
  }

  function stopVoiceRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") {
      recorder.requestData();
      recorder.stop();
    }
  }

  async function installPwa() {
    const prompt = window.__yamaInstallPrompt;
    if (!prompt) {
      setError("Install is available from your browser menu: Add to Home Screen / Install app.");
      return;
    }
    await prompt.prompt();
    await prompt.userChoice;
    window.__yamaInstallPrompt = undefined;
    setInstallReady(false);
  }

  async function enableNotifications() {
    const result = await requestNotificationPermission();
    setNotificationPermission(result);
  }

  async function saveProfile() {
    if (profileSaving) return;
    setProfileSaving(true);
    setError(null);
    try {
      const updated = await updateMyProfile({ displayName: profileName, username: profileUsername });
      setProfiles((current) => current.map((profile) => profile.id === updated.id ? updated as ProfileRow : profile));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || profileSaving) return;
    setProfileSaving(true);
    setError(null);
    try {
      const updated = await uploadProfileAvatar(file);
      setProfiles((current) => current.map((profile) => profile.id === updated.id ? updated as ProfileRow : profile));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update profile photo.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    const { error: logoutError } = await supabase.auth.signOut();
    if (logoutError) {
      setError(logoutError.message);
      return;
    }
    router.replace("/auth/login");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="relative flex min-h-screen min-h-dvh items-center justify-center overflow-hidden bg-[#030712] text-slate-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(34,211,238,0.18),_transparent_42%),linear-gradient(135deg,_#020617,_#071827,_#03111f)]" />
        <div className="relative rounded-3xl border border-cyan-400/20 bg-[#04111f]/80 px-8 py-7 text-center backdrop-blur-xl">
          <Image src="/icon-192.png" alt="Ychat" width={72} height={72} className="mx-auto rounded-2xl" priority />
          <p className="mt-4 text-sm font-semibold">Ychat</p>
          <div className="mx-auto mt-4 h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        </div>
      </div>
    );
  }

  const attachmentByMessage = new Map(attachments.map((attachment) => [attachment.message_id, attachment]));

  return (
    <div className="ychat-app-shell bg-[#030712] text-slate-100">
      {call.incomingCall && !call.activeCall && (
        <IncomingCallCard
          invite={call.incomingCall}
          onDecline={declineIncomingCall}
          onAccept={() => void acceptIncomingCall().catch((err) => setError(err instanceof Error ? err.message : "Unable to accept call."))}
        />
      )}
      {call.activeCall && (
        <ActiveCallOverlay
          call={call.activeCall}
          localStream={call.localStream}
          remoteStreams={call.remoteStreams}
          profiles={profiles}
          muted={call.muted}
          cameraOff={call.cameraOff}
          onToggleMute={call.toggleMute}
          onToggleCamera={call.toggleCamera}
          onHangUp={() => void call.hangUp()}
        />
      )}

      {groupOpen && (
        <Modal onClose={() => setGroupOpen(false)}>
          <div className="flex items-center justify-between border-b border-white/10 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">New group</p>
              <h2 className="mt-1 text-xl font-semibold">Create group chat</h2>
            </div>
            <button type="button" onClick={() => setGroupOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-white/5"><X className="h-5 w-5" /></button>
          </div>
          <div className="space-y-4 p-5">
            <input value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} placeholder="Group name" className="w-full rounded-2xl border border-white/10 bg-[#0b1c2f] px-4 py-3 outline-none focus:border-cyan-500/50" />
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Select members</p>
              <div className="max-h-72 space-y-1 overflow-y-auto ychat-scrollbar">
                {otherProfiles.map((profile) => {
                  const selected = groupMembers.includes(profile.id);
                  return (
                    <button key={profile.id} type="button" onClick={() => setGroupMembers((current) => selected ? current.filter((id) => id !== profile.id) : [...current, profile.id])} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-white/5">
                      <Avatar profile={profile} size="sm" />
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{profile.display_name}</p><p className="truncate text-xs text-slate-500">@{profile.username || "user"}</p></div>
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? "border-cyan-400 bg-cyan-500 text-slate-950" : "border-white/15"}`}>{selected && <Check className="h-4 w-4" />}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <button type="button" onClick={() => void handleCreateGroup()} className="w-full rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-400">Create group</button>
          </div>
        </Modal>
      )}

      <div className="mx-auto flex h-full max-w-[1800px]">
        <aside className="hidden w-[88px] shrink-0 flex-col justify-between border-r border-white/10 bg-[#07111f] p-3 lg:flex">
          <div>
            <button type="button" onClick={() => navigateView("chats")} className="mb-4 flex w-full items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2.5">
              <Image src="/icon-192.png" alt="Ychat" width={44} height={44} className="rounded-xl" />
            </button>
            <nav className="space-y-1.5">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => navigateView(id)} className={`flex w-full flex-col items-center rounded-2xl px-2 py-2.5 text-[10px] transition ${view === id ? "bg-cyan-500/15 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,.18)]" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                  <Icon className="mb-1 h-5 w-5" />{label}
                </button>
              ))}
            </nav>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-center text-[10px] text-slate-500"><ShieldCheck className="mx-auto mb-1 h-4 w-4 text-cyan-300" />Secure</div>
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col bg-[#06101d]">
          {error && (
            <div className="absolute inset-x-3 top-[calc(.75rem+env(safe-area-inset-top))] z-50 flex items-start justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-950/95 px-3 py-2 text-xs leading-5 text-rose-100 shadow-lg backdrop-blur">
              <span className="line-clamp-2">{error}</span><button type="button" onClick={() => setError(null)} className="shrink-0 pt-0.5"><X className="h-4 w-4" /></button>
            </div>
          )}

          {view === "calls" && (
            <Page title="Calls" subtitle="Missed and recent Ychat calls." action={callLogs.length > 0 ? <button type="button" onClick={() => setCallLogs([])} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:border-rose-400/40 hover:text-rose-200">Clear all</button> : undefined}>
              <div className="mb-4 grid grid-cols-2 rounded-2xl border border-white/10 bg-[#0a1b2d] p-1">
                {(["recent", "missed"] as const).map((filter) => (
                  <button key={filter} type="button" onClick={() => setCallFilter(filter)} className={`rounded-xl px-4 py-2.5 text-sm font-semibold capitalize ${callFilter === filter ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"}`}>{filter}</button>
                ))}
              </div>
              <div className="space-y-2">
                {callLogs.filter((item) => callFilter === "recent" || item.direction === "missed").map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0a1b2d] p-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${item.direction === "missed" ? "bg-rose-500/15 text-rose-300" : "bg-cyan-500/15 text-cyan-200"}`}>
                      {item.mode === "video" ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      <p className={`mt-0.5 text-xs ${item.direction === "missed" ? "text-rose-300" : "text-slate-500"}`}>{item.direction === "outgoing" ? "Outgoing" : item.direction === "incoming" ? "Incoming" : "Missed"} {item.mode} call · {formatTime(item.createdAt)}</p>
                    </div>
                    <button type="button" onClick={() => setCallLogs((current) => current.filter((log) => log.id !== item.id))} className="rounded-full p-2 text-slate-500 hover:bg-white/5 hover:text-rose-200" title="Delete call"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              {callLogs.filter((item) => callFilter === "recent" || item.direction === "missed").length === 0 && <Empty icon={<Phone className="h-8 w-8" />} title={callFilter === "missed" ? "No missed calls" : "No calls yet"} text="Voice and video calls will appear here as recent and missed calls." />}
            </Page>
          )}

          {view === "chats" && (
            <div className="flex min-h-0 flex-1">
              <aside className={`${activeConversationId ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-white/10 bg-[#071827] md:w-[360px] lg:w-[390px]`}>
                <div className="border-b border-white/10 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
                  <div className="flex items-center gap-3">
                    <Image src="/brand/yama-logo.png" alt="Yama Ahmadi Services Informatiques" width={150} height={54} className="h-10 w-auto object-contain object-left" priority />
                    <div className="ml-auto flex gap-1">
                      <button type="button" onClick={() => setGroupOpen(true)} title="New group" className="rounded-full p-2.5 text-slate-400 hover:bg-white/5 hover:text-cyan-200"><Users className="h-5 w-5" /></button>
                      <button type="button" onClick={() => setPeopleOpen((current) => !current)} title="New chat" className="rounded-full p-2.5 text-slate-400 hover:bg-white/5 hover:text-cyan-200"><MessageCircle className="h-5 w-5" /></button>
                      <button type="button" title="Menu" className="rounded-full p-2.5 text-slate-500 hover:bg-white/5"><MoreVertical className="h-5 w-5" /></button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#102438] px-3 py-2.5 text-slate-400">
                    <Search className="h-4 w-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search or start new chat" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
                  </div>
                </div>

                {peopleOpen && (
                  <div className="border-b border-white/10 bg-[#0a1b2d] p-3">
                    <div className="mb-2 flex items-center justify-between px-1"><p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">New chat</p><button type="button" onClick={() => setPeopleOpen(false)}><X className="h-4 w-4 text-slate-500" /></button></div>
                    <div className="mb-3 flex gap-2">
                      <input value={contactLookup} onChange={(event) => setContactLookup(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleAddContact(); }} placeholder="Email, username or Ychat ID" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#102438] px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-500/30" />
                      <button type="button" onClick={() => void handleAddContact()} disabled={!contactLookup.trim() || addingContact} className="rounded-xl bg-cyan-500 px-3 text-sm font-semibold text-slate-950 disabled:opacity-40">Add</button>
                    </div>
                    <button type="button" onClick={() => void handlePickPhoneContact()} className="mb-3 w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 hover:border-cyan-400/30 hover:text-cyan-200">Choose from phonebook</button>
                    <div className="max-h-56 space-y-1 overflow-y-auto ychat-scrollbar">
                      {otherProfiles.map((profile) => (
                        <button key={profile.id} type="button" disabled={creatingChat === profile.id} onClick={() => void handleStartChat(profile.id)} className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-white/5 disabled:opacity-50">
                          <div className="relative"><Avatar profile={profile} size="sm" />{isProfileOnline(profile) && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0a1b2d] bg-emerald-400" />}</div>
                          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{profile.display_name}</p><p className="truncate text-xs text-slate-500">{isProfileOnline(profile) ? "online" : `@${profile.username || "user"}`}</p></div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto ychat-scrollbar">
                  {filteredConversations.length === 0 ? (
                    <div className="p-8 text-center text-slate-500"><MessageSquare className="mx-auto h-10 w-10 opacity-30" /><p className="mt-4 text-sm">No conversations yet</p><button type="button" onClick={() => setPeopleOpen(true)} className="mt-3 text-sm text-cyan-400">Start a new chat</button></div>
                  ) : filteredConversations.map((conversation) => {
                    const profile = getConversationProfile(conversation);
                    return (
                      <button key={conversation.id} type="button" onClick={() => selectConversation(conversation.id)} className={`flex w-full items-center gap-3 border-b border-white/[0.045] px-4 py-3 text-left transition hover:bg-white/[0.035] ${activeConversationId === conversation.id ? "bg-[#102438]" : ""}`}>
                        {conversation.type === "group" ? <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-200"><Users className="h-5 w-5" /></div> : <div className="relative"><Avatar profile={profile} />{isProfileOnline(profile) && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#071827] bg-emerald-400" />}</div>}
                        <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-[15px] font-medium">{getConversationName(conversation)}</p><span className="text-[11px] text-slate-500">{formatTime(conversation.updated_at)}</span></div><p className="mt-1 truncate text-xs text-slate-500">{conversation.type === "group" ? `${conversation.conversation_members?.length ?? 0} members` : isProfileOnline(profile) ? "online" : "Tap to open conversation"}</p></div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 border-t border-white/10 p-3">
                  <Avatar profile={currentProfile} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{currentProfile?.display_name || "User"}</p><p className="text-[11px] text-emerald-400">online</p></div><button type="button" onClick={() => navigateView("settings")} className="rounded-full p-2 text-slate-500 hover:bg-white/5"><Settings className="h-4 w-4" /></button>
                </div>
              </aside>

              <section className={`${activeConversationId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-[#06101d]`}>
                {activeConversation ? (
                  <>
                    <header className="flex min-h-[68px] shrink-0 items-center gap-3 border-b border-white/10 bg-[#091a2b] px-3 pb-2 pt-[max(.5rem,env(safe-area-inset-top))] sm:px-4">
                      <button type="button" onClick={() => setActiveConversationId(null)} className="rounded-full p-2 text-slate-400 md:hidden"><ChevronLeft className="h-5 w-5" /></button>
                      {activeConversation.type === "group" ? <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-200"><Users className="h-5 w-5" /></div> : <Avatar profile={getConversationProfile(activeConversation)} size="sm" />}
                      <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-semibold">{getConversationName(activeConversation)}</p><p className="truncate text-xs text-slate-500">{activeConversation.type === "group" ? activeMembers.map((member) => member.display_name).join(", ") : isProfileOnline(getConversationProfile(activeConversation)) ? "online" : "secure conversation"}</p></div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => void beginCall("audio")} title="Voice call" className="rounded-full p-2.5 text-slate-300 hover:bg-white/5 hover:text-cyan-300"><Phone className="h-5 w-5" /></button>
                        <button type="button" onClick={() => void beginCall("video")} title="Video call" className="rounded-full p-2.5 text-slate-300 hover:bg-white/5 hover:text-cyan-300"><Video className="h-5 w-5" /></button>
                        <button type="button" title="Conversation options" className="rounded-full p-2.5 text-slate-500 hover:bg-white/5"><MoreVertical className="h-5 w-5" /></button>
                      </div>
                    </header>

                    <div ref={messagesScrollRef} className="ychat-chat-wallpaper ychat-scrollbar min-h-0 flex-1 overscroll-contain overflow-y-auto px-3 py-5 sm:px-6">
                      <div className="mx-auto max-w-4xl space-y-2">
                        <div className="mx-auto mb-5 w-fit rounded-lg bg-[#102438]/90 px-3 py-1.5 text-center text-[11px] text-slate-400 shadow">Messages are stored securely in your Ychat workspace.</div>
                        {messages.length === 0 && <div className="py-16 text-center text-sm text-slate-500">No messages yet. Send the first one.</div>}
                        {messages.map((message) => {
                          const mine = message.sender_id === userId;
                          const attachment = attachmentByMessage.get(message.id);
                          return (
                            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                              <div className={`relative max-w-[88%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[72%] ${mine ? "rounded-br-md bg-[#075e72] text-white" : "rounded-bl-md border border-white/[0.055] bg-[#102438] text-slate-100"}`}>
                                {!mine && activeConversation.type === "group" && <p className="mb-1 text-[11px] font-semibold text-cyan-300">{getSenderName(message.sender_id)}</p>}
                                {message.message_type === "sticker" || STICKERS.includes(message.body) ? <div className="px-2 py-1 text-5xl leading-none">{message.body}</div> : message.message_type === "voice" && attachment ? <AttachmentPlayer attachment={attachment} /> : message.message_type === "file" && attachment ? <AttachmentPlayer attachment={attachment} compact /> : <p className="whitespace-pre-wrap break-words text-[14px] leading-5">{message.body}</p>}
                                <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/55"><span>{formatTime(message.created_at)}</span>{mine && <span className="text-cyan-200">✓✓</span>}</div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    </div>

                    <div className="relative shrink-0 border-t border-white/10 bg-[#091a2b] px-2 py-2 sm:px-3">
                      {plusOpen && (
                        <div className="absolute bottom-[72px] left-3 z-30 w-[280px] max-w-[calc(100vw-24px)] rounded-2xl border border-white/10 bg-[#0b1c2f] p-2 shadow-2xl">
                          <button type="button" onClick={() => { fileInputRef.current?.click(); setPlusOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-200 hover:bg-white/5"><Plus className="h-5 w-5 text-cyan-300" /> Photo, video or file</button>
                          <button type="button" onClick={() => { setPlusOpen(false); void startVoiceRecording(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-200 hover:bg-white/5"><Mic className="h-5 w-5 text-cyan-300" /> Voice message</button>
                          <button type="button" onClick={() => { setStickerOpen(true); setEmojiOpen(false); setPlusOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-200 hover:bg-white/5"><Sparkles className="h-5 w-5 text-cyan-300" /> Stickers</button>
                          <button type="button" onClick={() => { setEmojiOpen(true); setStickerOpen(false); setPlusOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-200 hover:bg-white/5"><Smile className="h-5 w-5 text-cyan-300" /> Emoji</button>
                        </div>
                      )}
                      {emojiOpen && (
                        <div className="absolute bottom-[72px] left-3 z-30 w-[310px] max-w-[calc(100vw-24px)] rounded-2xl border border-white/10 bg-[#0b1c2f] p-3 shadow-2xl">
                          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-slate-400">Emoji</span><button type="button" onClick={() => setEmojiOpen(false)}><X className="h-4 w-4 text-slate-500" /></button></div>
                          <div className="grid grid-cols-8 gap-1">{EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => setDraft((current) => current + emoji)} className="rounded-lg p-1.5 text-xl hover:bg-white/5">{emoji}</button>)}</div>
                        </div>
                      )}
                      {stickerOpen && (
                        <div className="absolute bottom-[72px] left-12 z-30 w-[280px] max-w-[calc(100vw-24px)] rounded-2xl border border-white/10 bg-[#0b1c2f] p-3 shadow-2xl">
                          <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-slate-400">Stickers</span><button type="button" onClick={() => setStickerOpen(false)}><X className="h-4 w-4 text-slate-500" /></button></div>
                          <div className="grid grid-cols-4 gap-2">{STICKERS.map((sticker) => <button key={sticker} type="button" onClick={() => void handleSend("sticker", sticker)} className="rounded-xl bg-white/[0.035] p-3 text-4xl hover:bg-white/[0.08]">{sticker}</button>)}</div>
                        </div>
                      )}

                      <div className="mx-auto flex max-w-5xl items-end gap-1.5">
                        <button type="button" onClick={() => { setPlusOpen((current) => !current); setEmojiOpen(false); setStickerOpen(false); }} disabled={uploading} className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-white/5 hover:text-cyan-200 disabled:opacity-40" title="Add attachment or sticker"><Plus className="h-5 w-5" /></button>
                        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt" className="hidden" onChange={handleFileChange} />

                        {recording ? (
                          <div className="flex min-h-[46px] flex-1 items-center gap-3 rounded-3xl border border-rose-500/25 bg-rose-500/10 px-4"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-400" /><span className="text-sm text-rose-200">Recording {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}</span><span className="ml-auto text-xs text-slate-500">Tap stop to send</span></div>
                        ) : (
                          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void handleSend(); } }} rows={1} placeholder="Message" className="max-h-32 min-h-[46px] flex-1 resize-none rounded-3xl border border-white/10 bg-[#102438] px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-500/30" />
                        )}

                        {recording ? (
                          <button type="button" onClick={stopVoiceRecording} className="mb-0.5 flex h-11 w-11 items-center justify-center rounded-full bg-rose-500 text-white" title="Stop and send voice message"><Square className="h-4 w-4 fill-current" /></button>
                        ) : draft.trim() ? (
                          <button type="button" onClick={() => void handleSend()} disabled={sending} className="mb-0.5 flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500 text-slate-950 hover:bg-cyan-400 disabled:opacity-40"><Send className="h-5 w-5" /></button>
                        ) : (
                          <button type="button" onClick={() => void startVoiceRecording()} className="mb-0.5 flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500 text-slate-950 hover:bg-cyan-400" title="Record voice message"><Mic className="h-5 w-5" /></button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="relative flex h-full flex-1 items-center justify-center overflow-hidden bg-[#06101d]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(34,211,238,0.08),_transparent_45%)]" />
                    <div className="relative max-w-lg px-8 text-center"><Image src="/icon-192.png" alt="Ychat" width={96} height={96} className="mx-auto rounded-3xl shadow-2xl" /><h1 className="mt-6 text-3xl font-semibold">Ychat</h1><p className="mt-3 text-sm leading-6 text-slate-500">Realtime text, voice messages, files, group chats, voice calls and video calls in one secure workspace.</p><div className="mx-auto mt-6 flex w-fit items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 text-xs text-emerald-300"><Wifi className="h-3.5 w-3.5" /> Realtime connected</div></div>
                  </div>
                )}
              </section>
            </div>
          )}

          {view === "stories" && (
            <StoriesPanel profiles={profiles} userId={userId} />
          )}

          {view === "groups" && (
            <Page title="Groups" subtitle="Create team and family group chats with group voice/video calling." action={<button type="button" onClick={() => setGroupOpen(true)} className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950"><Plus className="h-4 w-4" /> New group</button>}>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{groupConversations.map((conversation) => <button type="button" key={conversation.id} onClick={() => selectConversation(conversation.id)} className="rounded-2xl border border-white/10 bg-[#0a1b2d] p-5 text-left hover:border-cyan-400/25"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-200"><Users className="h-5 w-5" /></div><p className="mt-4 font-semibold">{getConversationName(conversation)}</p><p className="mt-1 text-sm text-slate-500">{conversation.conversation_members?.length ?? 0} members</p><div className="mt-4 flex gap-2 text-xs text-slate-400"><span className="rounded-full bg-white/5 px-2 py-1">Text</span><span className="rounded-full bg-white/5 px-2 py-1">Voice</span><span className="rounded-full bg-white/5 px-2 py-1">Video</span></div></button>)}</div>
              {groupConversations.length === 0 && <Empty icon={<Users className="h-8 w-8" />} title="No groups yet" text="Create a group and add multiple members." />}
            </Page>
          )}

          {view === "people" && (
            <Page title="Contacts" subtitle={`${otherProfiles.length} Ychat contacts`} action={<button type="button" onClick={() => contactLookupRef.current?.focus()} className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950"><Plus className="h-4 w-4" /> Add contact</button>}>
              <div className="mb-5 rounded-2xl border border-white/10 bg-[#0a1b2d] p-4">
                <p className="text-sm font-semibold">Add a contact</p>
                <p className="mt-1 text-xs text-slate-500">Search by email, username, Ychat ID, or pick from your phonebook. Only people using Ychat are shown.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input ref={contactLookupRef} value={contactLookup} onChange={(event) => setContactLookup(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleAddContact(); }} placeholder="Email, username or Ychat ID" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#102438] px-3 py-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-500/30" />
                  <button type="button" onClick={() => void handlePickPhoneContact()} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:border-cyan-400/30 hover:text-cyan-200">Phonebook</button>
                  <button type="button" onClick={() => void handleAddContact()} disabled={!contactLookup.trim() || addingContact} className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40">{addingContact ? "Adding..." : "Add contact"}</button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{otherProfiles.map((profile) => <button type="button" key={profile.id} onClick={() => void handleStartChat(profile.id)} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0a1b2d] p-4 text-left hover:border-cyan-400/25"><div className="relative"><Avatar profile={profile} size="lg" />{isProfileOnline(profile) && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#0a1b2d] bg-emerald-400" />}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{profile.display_name}</p><p className="truncate text-sm text-slate-500">@{profile.username || "user"}</p><p className={`mt-1 text-xs ${isProfileOnline(profile) ? "text-emerald-400" : "text-slate-600"}`}>{isProfileOnline(profile) ? "online" : "offline"}</p></div><MessageCircle className="h-5 w-5 text-cyan-300" /></button>)}</div>
              {otherProfiles.length === 0 && <Empty icon={<Users className="h-8 w-8" />} title="No contacts yet" text="Share your Ychat ID or add someone by email, username, or ID." />}
            </Page>
          )}

          {view === "files" && (
            <Page title="Files" subtitle="Shared files and voice recordings from your conversations.">
              <div className="space-y-2">{attachments.map((attachment) => <div key={attachment.id} className="rounded-2xl border border-white/10 bg-[#0a1b2d] p-2"><AttachmentPlayer attachment={attachment} /></div>)}</div>
              {attachments.length === 0 && <Empty icon={<Files className="h-8 w-8" />} title="No shared files" text="Files and voice recordings shared in chats will appear here." />}
            </Page>
          )}

          {view === "admin" && (
            <Page title="Admin" subtitle="Workspace overview and operating status.">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat icon={<Users className="h-5 w-5" />} label="Users" value={profiles.length} /><Stat icon={<MessageSquare className="h-5 w-5" />} label="Conversations" value={conversations.length} /><Stat icon={<Group className="h-5 w-5" />} label="Groups" value={groupConversations.length} /><Stat icon={<HardDriveUpload className="h-5 w-5" />} label="Files" value={attachments.length} /></div>
              <div className="mt-6 rounded-2xl border border-white/10 bg-[#0a1b2d] p-5"><div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-emerald-300" /><div><p className="font-semibold">Realtime workspace operational</p><p className="text-sm text-slate-500">Supabase authentication, database, storage and realtime channels are connected.</p></div></div></div>
            </Page>
          )}

          {view === "settings" && (
            <Page title="Settings" subtitle="App, notifications and account controls.">
              <div className="mx-auto max-w-3xl space-y-4">
                <div className="rounded-2xl border border-white/10 bg-[#0a1b2d] p-5">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <button type="button" onClick={() => avatarInputRef.current?.click()} className="group relative w-fit rounded-full" title="Change profile photo">
                      <Avatar profile={currentProfile} size="lg" />
                      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-[10px] font-semibold text-white opacity-0 transition group-hover:bg-black/55 group-hover:opacity-100">PHOTO</span>
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                      <label className="text-xs text-slate-400"><span className="mb-1.5 block">Display name</span><input value={profileName} onChange={(event) => setProfileName(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#102438] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/40" /></label>
                      <label className="text-xs text-slate-400"><span className="mb-1.5 block">Username</span><input value={profileUsername} onChange={(event) => setProfileUsername(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#102438] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500/40" placeholder="username" /></label>
                    </div>
                    <div className="flex flex-col gap-2 sm:w-auto">
                      <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={profileSaving} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-200 disabled:opacity-40">Change photo</button>
                      <button type="button" onClick={() => void saveProfile()} disabled={profileSaving || !profileName.trim()} className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-40">{profileSaving ? "Saving…" : "Save profile"}</button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Tap your avatar to change your profile picture. Your name and photo update across chats and groups.</p>
                </div>
                <SettingRow icon={<Building2 className="h-5 w-5" />} title="Install Ychat" text="Install this PWA on Android, iPhone/iPad or desktop for an app-like experience." action={<button type="button" onClick={() => void installPwa()} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">{installReady ? "Install" : "How to install"}</button>} />
                <div className="rounded-2xl border border-white/10 bg-[#0a1b2d] p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200"><MessageCircle className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">Your Ychat ID</p>
                      <p className="mt-1 break-all font-mono text-sm text-cyan-200">{currentProfile?.contact_code || currentProfile?.username || "Loading..."}</p>
                      <p className="mt-1 text-sm leading-5 text-slate-500">Share this QR code, ID, or email link so people can add you privately.</p>
                    </div>
                    <div className="rounded-2xl bg-white p-2 text-slate-950">
                      <QRCodeSVG value={shareCode || "Ychat"} size={104} marginSize={1} />
                    </div>
                    <a href={`mailto:?subject=Add me on Ychat&body=${encodeURIComponent(shareText)}`} className="rounded-xl border border-white/10 px-4 py-2 text-center text-sm">Share by email</a>
                  </div>
                </div>
                <SettingRow icon={<Bell className="h-5 w-5" />} title="Message and call notifications" text={`Browser permission: ${notificationPermission}`} action={<button type="button" onClick={() => void enableNotifications()} className="rounded-xl border border-white/10 px-4 py-2 text-sm">Enable</button>} />
                <SettingRow icon={<Video className="h-5 w-5" />} title="Calling" text="Voice/video calls use encrypted browser WebRTC media with Supabase realtime signaling. HTTPS is required outside localhost." />
                <SettingRow icon={<LogOut className="h-5 w-5" />} title="Sign out" text="End this browser session." action={<button type="button" onClick={() => void handleLogout()} className="rounded-xl bg-rose-500/15 px-4 py-2 text-sm font-medium text-rose-300">Logout</button>} />
              </div>
            </Page>
          )}

          <nav className="grid h-[calc(64px+env(safe-area-inset-bottom))] grid-cols-6 shrink-0 border-t border-white/10 bg-[#07111f] pb-[env(safe-area-inset-bottom)] lg:hidden">
            {mobileNavItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => navigateView(id)} className={`flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[9px] leading-tight ${view === id ? "text-cyan-300" : "text-slate-500"}`}><Icon className="h-5 w-5" /><span className="max-w-full truncate">{label}</span></button>)}
          </nav>
        </main>
      </div>
    </div>
  );
}

function Page({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto bg-[#06101d] p-4 pb-24 sm:p-6 lg:p-8"><div className="mx-auto max-w-6xl"><div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row"><div className="min-w-0"><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>{action}</div>{children}</div></div>;
}

function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="mt-10 rounded-3xl border border-dashed border-white/10 p-10 text-center text-slate-500"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-cyan-300">{icon}</div><p className="mt-4 font-medium text-slate-300">{title}</p><p className="mt-1 text-sm">{text}</p></div>;
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return <div className="rounded-2xl border border-white/10 bg-[#0a1b2d] p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200">{icon}</div><p className="mt-5 text-3xl font-semibold">{value}</p><p className="mt-1 text-sm text-slate-500">{label}</p></div>;
}

function SettingRow({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0a1b2d] p-5 sm:flex-row sm:items-center"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200">{icon}</div><div className="min-w-0 flex-1"><p className="font-medium">{title}</p><p className="mt-1 text-sm leading-5 text-slate-500">{text}</p></div>{action}</div>;
}
