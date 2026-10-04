"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Archive,
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
  MessageSquareReply,
  Mic,
  MoreVertical,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Heart,
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
  archiveConversations,
  clearCallLogs as clearCallLogsFromDb,
  createGroupConversation,
  createCallLog,
  deleteCallLog as deleteCallLogFromDb,
  getAttachmentDownloadUrl,
  getAttachments,
  getCallLogs,
  getContactProfiles,
  getConversationUserStates,
  getConversations,
  getUnreadCounts,
  markConversationRead,
  setConversationFavorite,
  removeOwnMessages,
  getStories,
  getMessages,
  getMessageViews,
  markMessageViewed,
  getMessageReactions,
  hideConversations,
  requestNotificationPermission,
  sendMessage,
  startDirectConversation,
  subscribeToMessageReactions,
  toggleMessageReaction,
  subscribeToMessages,
  subscribeToStories,
  uploadChatFile,
  uploadProfileAvatar,
  updateMyProfile,
  uploadVoiceMessage,
  updateMessage,
} from "@/lib/supabase/chat";
import { createClient } from "@/lib/supabase/client";
import { useWebRtcCall, type CallMode } from "@/hooks/use-web-rtc-call";
import { ActiveCallOverlay, IncomingCallCard } from "@/components/chat/call-overlay";
import { StoriesPanel } from "@/components/chat/stories-panel";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import type {
  AttachmentRow,
  MessageReactionRow,
  ConversationRow,
  MessageRow,
  ProfileRow,
  StoryRow,
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
const APP_VERSION = "1.0.6";

type CallLogEntry = {
  id: string;
  title: string;
  mode: CallMode;