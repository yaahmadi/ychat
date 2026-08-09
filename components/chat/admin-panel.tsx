"use client";

import { ShieldCheck, Users2, UserPlus, Ban, KeyRound } from "lucide-react";

const adminActions = [
  { label: "Invite users", detail: "Create secure access links", icon: UserPlus },
  { label: "Disable users", detail: "Temporarily suspend access", icon: Ban },
  { label: "Manage roles", detail: "Owner, admin, member controls", icon: ShieldCheck },
  { label: "Manage access", detail: "Review policies and domains", icon: KeyRound },
];

export function AdminPanel() {
  return (
    <section className="mt-4 rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Users2 className="h-4 w-4 text-cyan-300" />
        <h3 className="text-sm font-semibold text-slate-100">Admin controls</h3>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {adminActions.map(({ label, detail, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-[#07111f]/80 p-3">
            <Icon className="mb-2 h-4 w-4 text-cyan-300" />
            <p className="text-sm font-medium text-slate-200">{label}</p>
            <p className="text-xs text-slate-400">{detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
