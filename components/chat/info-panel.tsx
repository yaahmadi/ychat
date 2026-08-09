"use client";

import { FileText, Layers3, ShieldCheck, Users2 } from "lucide-react";
import { demoUsers } from "@/lib/demo-data";

const sharedFiles = [
  { name: "release-checklist.pdf", size: "2.4 MB" },
  { name: "ops-runbook.docx", size: "860 KB" },
  { name: "migration-notes.zip", size: "1.1 MB" },
];

const sharedMedia = [
  { label: "Architecture", icon: Layers3 },
  { label: "Security Review", icon: ShieldCheck },
  { label: "Team Snapshot", icon: Users2 },
];

export function InfoPanel() {
  return (
    <aside className="hidden h-full w-[320px] flex-col border-l border-white/10 bg-[#07111f]/95 p-4 xl:flex">
      <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-semibold text-white">
            MD
          </div>
          <div>
            <h3 className="font-semibold text-slate-100">Madina</h3>
            <p className="text-sm text-cyan-300">Admin • Available</p>
          </div>
        </div>
        <p className="text-sm text-slate-400">
          Leadership coordination and secure release planning across multiple departments.
        </p>
      </div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-200">People</h4>
          <span className="text-xs text-slate-500">4 members</span>
        </div>
        <div className="space-y-2">
          {demoUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between rounded-2xl bg-[#0d1728] px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-100">
                  {user.initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{user.name}</p>
                  <p className="text-[11px] text-slate-500">{user.role}</p>
                </div>
              </div>
              <span className={`h-2.5 w-2.5 rounded-full ${user.status === "online" ? "bg-emerald-400" : user.status === "away" ? "bg-amber-400" : "bg-slate-500"}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <h4 className="mb-3 text-sm font-semibold text-slate-200">Shared files</h4>
        <div className="space-y-2">
          {sharedFiles.map((file) => (
            <div key={file.name} className="flex items-center gap-3 rounded-2xl bg-[#0d1728] px-3 py-2">
              <div className="rounded-xl bg-cyan-500/15 p-2 text-cyan-300">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm text-slate-200">{file.name}</p>
                <p className="text-xs text-slate-500">{file.size}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <h4 className="mb-3 text-sm font-semibold text-slate-200">Shared media</h4>
        <div className="grid grid-cols-2 gap-2">
          {sharedMedia.map(({ label, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-[#0d1728] p-3 text-center text-xs text-slate-400">
              <Icon className="mx-auto mb-2 h-4 w-4 text-cyan-300" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
