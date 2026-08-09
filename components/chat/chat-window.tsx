"use client";

import { useMemo } from "react";
import { CircleEllipsis, Copy, Paperclip, Phone, Recycle, Search, Smile, Sparkles, Video, SendHorizontal, Code2, MessageSquareReply } from "lucide-react";
import { demoMessages, demoUsers } from "@/lib/demo-data";

export function ChatWindow() {
  const currentUser = demoUsers[0];
  const messages = useMemo(() => demoMessages, []);

  return (
    <main className="flex min-h-screen flex-1 flex-col bg-[#06111f]">
      <header className="flex items-center justify-between border-b border-white/10 bg-[#081423]/90 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 p-2.5 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Madina</h2>
            <p className="text-sm text-cyan-400">Online • Secured exchange</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10">
            <Phone className="h-4 w-4" />
          </button>
          <button className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10">
            <Video className="h-4 w-4" />
          </button>
          <button className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10">
            <Search className="h-4 w-4" />
          </button>
        </div>
      </header>

      <section className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
        {messages.map((message) => {
          const sender = demoUsers.find((user) => user.id === message.senderId) ?? currentUser;
          const isOwn = sender.id === currentUser.id;

          return (
            <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-3xl border px-4 py-3 shadow-lg ${isOwn ? "border-cyan-500/30 bg-cyan-500/10" : "border-white/10 bg-[#0f1d33]"}`}>
                <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">{sender.name}</span>
                  <span>• {message.timestamp}</span>
                </div>
                {message.type === "code" ? (
                  <div className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-950/80">
                    <div className="flex items-center justify-between border-b border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[11px] uppercase tracking-[0.3em] text-cyan-300">
                      <span>{message.language ?? "code"}</span>
                      <button className="rounded-full p-1 text-cyan-300 transition hover:bg-cyan-500/20">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <pre className="overflow-x-auto p-3 text-sm text-slate-100">
                      <code>{message.content}</code>
                    </pre>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{message.content}</p>
                )}

                <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <button className="rounded-full p-1 hover:bg-white/10"><MessageSquareReply className="h-3.5 w-3.5" /></button>
                    <button className="rounded-full p-1 hover:bg-white/10"><Copy className="h-3.5 w-3.5" /></button>
                    <button className="rounded-full p-1 hover:bg-white/10"><Recycle className="h-3.5 w-3.5" /></button>
                  </div>
                  <span>{message.status ?? "sent"}</span>
                </div>
              </div>
            </div>
          );
        })}

        <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
          <div className="mb-2 flex items-center gap-2">
            <CircleEllipsis className="h-4 w-4" />
            <span className="font-semibold">Madina is typing…</span>
          </div>
          <div className="flex gap-1.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-400 [animation-delay:140ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-500 [animation-delay:280ms]" />
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#081423]/90 p-4">
        <div className="flex items-end gap-3 rounded-3xl border border-white/10 bg-[#0f1d33] p-3">
          <button className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10">
            <Smile className="h-4 w-4" />
          </button>
          <button className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10">
            <Paperclip className="h-4 w-4" />
          </button>
          <button className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10">
            <Code2 className="h-4 w-4" />
          </button>
          <textarea
            className="min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500"
            placeholder="Message securely to the team..."
            rows={2}
          />
          <button className="rounded-2xl bg-cyan-500 p-3 text-slate-950 transition hover:bg-cyan-400">
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </main>
  );
}
