"use client";

import { Search, Plus } from "lucide-react";
import { demoConversations, demoUsers } from "@/lib/demo-data";

export function ConversationList() {
  return (
    <section className="flex h-full flex-col border-r border-white/10 bg-[#0b1627]/90 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-400/80">Workspace</p>
          <h2 className="text-lg font-semibold text-slate-100">Conversations</h2>
        </div>
        <button className="rounded-full border border-cyan-400/30 bg-cyan-500/10 p-2 text-cyan-200 transition hover:bg-cyan-500/20">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <label className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#111d31] px-3 py-2 text-sm text-slate-400">
        <Search className="h-4 w-4" />
        <input
          className="w-full bg-transparent outline-none placeholder:text-slate-500"
          placeholder="Search conversations"
        />
      </label>

      <div className="space-y-2 overflow-y-auto">
        {demoConversations.map((conversation) => {
          const participant = demoUsers.find((user) => user.id === conversation.participants[1]) ?? demoUsers[0];
          return (
            <button
              key={conversation.id}
              className={`w-full rounded-3xl border p-3 text-left transition ${
                conversation.unreadCount > 0
                  ? "border-cyan-500/30 bg-cyan-500/10"
                  : "border-white/5 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`rounded-2xl bg-gradient-to-br ${conversation.accent} px-2 py-2 text-xs font-semibold text-white`}>
                    {conversation.title.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{conversation.title}</p>
                    <p className="text-xs text-slate-400">{conversation.type === "group" ? "Group" : "Direct"}</p>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400">{conversation.lastMessageTime}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm text-slate-400">{conversation.lastMessage}</p>
                {conversation.unreadCount > 0 ? (
                  <span className="rounded-full bg-cyan-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950">
                    {conversation.unreadCount}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {participant.name} • Active now
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
