export type User = {
  id: string;
  name: string;
  role: "Owner" | "Admin" | "Member";
  status: "online" | "away" | "offline";
  lastSeen: string;
  avatar: string;
  initials: string;
  isAdmin?: boolean;
  location?: string;
};

export type Message = {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  type: "text" | "image" | "file" | "code";
  status?: "sent" | "delivered" | "read";
  replyTo?: string;
  language?: string;
};

export type Conversation = {
  id: string;
  title: string;
  type: "direct" | "group";
  participants: string[];
  isPinned?: boolean;
  unreadCount: number;
  lastMessage: string;
  lastMessageTime: string;
  accent: string;
};

export const demoUsers: User[] = [
  {
    id: "yama",
    name: "Yama",
    role: "Owner",
    status: "online",
    lastSeen: "Active now",
    avatar: "/avatars/yama.svg",
    initials: "YM",
    isAdmin: true,
    location: "San Francisco",
  },
  {
    id: "madina",
    name: "Madina",
    role: "Admin",
    status: "online",
    lastSeen: "Active now",
    avatar: "/avatars/madina.svg",
    initials: "MD",
    isAdmin: true,
    location: "Dubai",
  },
  {
    id: "amin",
    name: "Amin",
    role: "Member",
    status: "away",
    lastSeen: "12 min ago",
    avatar: "/avatars/amin.svg",
    initials: "AM",
    location: "Berlin",
  },
  {
    id: "mobin",
    name: "Mobin",
    role: "Member",
    status: "offline",
    lastSeen: "1 hr ago",
    avatar: "/avatars/mobin.svg",
    initials: "MB",
    location: "Toronto",
  },
];

export const demoConversations: Conversation[] = [
  {
    id: "conv-1",
    title: "Madina",
    type: "direct",
    participants: ["yama", "madina"],
    unreadCount: 2,
    lastMessage: "The release checklist is ready",
    lastMessageTime: "09:41",
    accent: "from-cyan-500 to-sky-600",
    isPinned: true,
  },
  {
    id: "conv-2",
    title: "Platform Ops",
    type: "group",
    participants: ["yama", "madina", "amin", "mobin"],
    unreadCount: 5,
    lastMessage: "Reviewing deployment notes",
    lastMessageTime: "08:22",
    accent: "from-violet-500 to-fuchsia-600",
  },
  {
    id: "conv-3",
    title: "Amin",
    type: "direct",
    participants: ["yama", "amin"],
    unreadCount: 0,
    lastMessage: "Shared the API schema update",
    lastMessageTime: "Yesterday",
    accent: "from-emerald-500 to-teal-600",
  },
  {
    id: "conv-4",
    title: "Mobin",
    type: "direct",
    participants: ["yama", "mobin"],
    unreadCount: 1,
    lastMessage: "Can you review the new docs?",
    lastMessageTime: "Mon",
    accent: "from-amber-500 to-orange-600",
  },
];

export const demoMessages: Message[] = [
  {
    id: "m1",
    senderId: "madina",
    content: "Good morning. I’ve prepared the release checklist for the client handover.",
    timestamp: "09:18",
    type: "text",
    status: "read",
  },
  {
    id: "m2",
    senderId: "yama",
    content: "Perfect. Please share the final review links before we lock the sprint.",
    timestamp: "09:24",
    type: "text",
    status: "read",
    replyTo: "m1",
  },
  {
    id: "m3",
    senderId: "madina",
    content: "```ts\nconst deployment = {\n  env: 'production',\n  region: 'eu-west-1',\n};\n```",
    timestamp: "09:31",
    type: "code",
    language: "ts",
    status: "read",
  },
  {
    id: "m4",
    senderId: "amin",
    content: "I’ve attached the recent audit report and the migration notes.",
    timestamp: "09:34",
    type: "file",
    status: "delivered",
  },
  {
    id: "m5",
    senderId: "yama",
    content: "Excellent work. I’ll review the ZIP package and confirm the rollout window.",
    timestamp: "09:41",
    type: "text",
    status: "read",
  },
];

export const adminUsers: User[] = [
  ...demoUsers,
  {
    id: "guest",
    name: "Aisha",
    role: "Member",
    status: "offline",
    lastSeen: "2 days ago",
    avatar: "/avatars/aisha.svg",
    initials: "AI",
    location: "Lagos",
  },
];
