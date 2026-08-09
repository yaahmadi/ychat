"use client";

import {
  Building2,
  Files,
  Group,
  LockKeyhole,
  MessageSquare,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

const navItems = [
  { label: "Chats", icon: MessageSquare, active: true },
  { label: "Groups", icon: Group },
  { label: "People", icon: Users },
  { label: "Files", icon: Files },
  { label: "Admin", icon: LockKeyhole },
  { label: "Settings", icon: Settings },
];

export function SidebarNav() {
  return (
    <aside className="hidden h-screen w-24 shrink-0 flex-col justify-between border-r border-white/10 bg-[#07111f]/95 p-4 lg:flex">
      <div className="space-y-4">
        <div className="flex items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-cyan-300">
          <Building2 className="h-6 w-6" />
        </div>
        <nav className="space-y-2">
          {navItems.map(({ label, icon: Icon, active }) => (
            <button
              type="button"
              key={label}
              className={`flex w-full flex-col items-center rounded-2xl px-2 py-3 text-[11px] font-medium transition ${
                active
                  ? "bg-cyan-500/15 text-cyan-200 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              <Icon className="mb-1 h-5 w-5" />
              {label}
            </button>
          ))}
        </nav>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center text-[11px] text-slate-400">
        <Sparkles className="mx-auto mb-2 h-4 w-4 text-cyan-300" />
        Secure by design
      </div>
    </aside>
  );
}
