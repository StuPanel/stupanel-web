"use client";

import { useState } from "react";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { pfetch } from "@/lib/platform-api";
import { Btn, Panel, inp } from "../_components/staff-kit";

export interface Role { id: string; key: string; name: string; description?: string | null; permissions: string[]; isSystem: boolean; members?: number }

/** What each permission means, grouped for the role editor. */
export const PERMISSION_GROUPS: { title: string; items: { key: string; label: string }[] }[] = [
  { title: "Studios", items: [
    { key: "dashboard.view", label: "See the dashboard" },
    { key: "studios.view", label: "See studios" },
    { key: "studios.edit", label: "Change studios (trial, plan, storage)" },
    { key: "studios.suspend", label: "Suspend / turn back on" },
    { key: "studios.delete", label: "Archive / delete studios" },
    { key: "studios.impersonate", label: "Log in as a studio" },
    { key: "users.view", label: "See studio users" },
    { key: "users.edit", label: "Change studio users" },
    { key: "personal_data.view", label: "See full emails & phone numbers" },
  ] },
  { title: "Money", items: [
    { key: "billing.view", label: "See payments & revenue" },
    { key: "billing.approve", label: "Confirm / reject plan payments" },
    { key: "billing.refund", label: "Refunds" },
    { key: "plans.manage", label: "Change plans & prices" },
    { key: "coupons.manage", label: "Coupons" },
  ] },
  { title: "Support & messages", items: [
    { key: "support.view", label: "See support tickets" },
    { key: "support.reply", label: "Answer & assign tickets" },
    { key: "communication.send", label: "Send broadcasts" },
    { key: "content.manage", label: "See broadcasts / content" },
  ] },
  { title: "Reports & system", items: [
    { key: "reports.view", label: "Growth, storage & email reports" },
    { key: "audit.view", label: "Activity log" },
    { key: "settings.manage", label: "Platform settings & system health" },
    { key: "security.manage", label: "Security page" },
    { key: "team.manage", label: "Manage the team & roles" },
  ] },
];

export function RolesPanel({ roles, ask, onChange }: { roles: Role[]; ask: (title: string, run: (code: string) => Promise<void>) => void; onChange: (ok: string) => void }) {
  const [edit, setEdit] = useState<{ id?: string; name: string; description: string; permissions: string[] } | null>(null);

  function toggle(k: string) {
    if (!edit) return;
    setEdit({ ...edit, permissions: edit.permissions.includes(k) ? edit.permissions.filter(x => x !== k) : [...edit.permissions, k] });
  }

  function save() {
    if (!edit) return;
    const body = { name: edit.name.trim(), description: edit.description.trim() || undefined, permissions: edit.permissions };
    ask(edit.id ? `Save role "${body.name}"` : `Create role "${body.name}"`, async code => {
      await pfetch(edit.id ? `/roles/${edit.id}` : "/roles", { method: edit.id ? "PATCH" : "POST", json: { ...body, code } });
      setEdit(null); onChange(edit.id ? "Role saved. It applies right away." : "Role created. You can now invite people with it.");
    });
  }

  return (
    <Panel title="Roles" sub="Built-in roles stay as they are. Make your own when you need a different mix.">
      <div className="space-y-2">
        {roles.map(r => (
          <div key={r.id} className="rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2.5 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-semibold flex items-center gap-1.5">
                {r.name}{r.isSystem && <span className="text-[10px] font-normal text-slate-500 inline-flex items-center gap-0.5"><Lock className="w-3 h-3" />built-in</span>}
                <span className="text-[11px] font-normal text-slate-500">· {r.members ?? 0} {r.members === 1 ? "person" : "people"}</span>
              </p>
              <p className="text-xs text-slate-400">{r.description || (r.permissions.includes("*") ? "Everything" : `${r.permissions.length} permissions`)}</p>
            </div>
            {!r.isSystem && (
              <div className="flex gap-1">
                <button aria-label={`Edit ${r.name}`} onClick={() => setEdit({ id: r.id, name: r.name, description: r.description ?? "", permissions: r.permissions })} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                <button aria-label={`Delete ${r.name}`} onClick={() => ask(`Delete role "${r.name}"`, async code => { await pfetch(`/roles/${r.id}/delete`, { method: "POST", json: { code } }); onChange("Role deleted."); })} className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-slate-700"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        ))}
      </div>

      {!edit ? (
        <Btn variant="ghost" className="mt-3" onClick={() => setEdit({ name: "", description: "", permissions: ["dashboard.view", "studios.view"] })}><Plus className="w-3.5 h-3.5" />New role</Btn>
      ) : (
        <div className="mt-4 rounded-xl border border-indigo-800/60 bg-indigo-950/20 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1"><span className="text-xs text-slate-400">Role name</span>
              <input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Sales" className={inp} /></label>
            <label className="space-y-1"><span className="text-xs text-slate-400">What it is for (optional)</span>
              <input value={edit.description} onChange={e => setEdit({ ...edit, description: e.target.value })} placeholder="e.g. Talks to new studios" className={inp} /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {PERMISSION_GROUPS.map(g => (
              <div key={g.title}>
                <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">{g.title}</p>
                <div className="space-y-1">
                  {g.items.map(it => (
                    <label key={it.key} className={cn("flex items-center gap-2 text-sm cursor-pointer", edit.permissions.includes(it.key) ? "text-white" : "text-slate-400")}>
                      <input type="checkbox" checked={edit.permissions.includes(it.key)} onChange={() => toggle(it.key)} className="accent-indigo-500" />
                      {it.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {(edit.permissions.includes("team.manage") || edit.permissions.includes("security.manage")) && (
            <p className="text-xs text-amber-300">Careful: this role can manage the team or security. Only Owners can change other Owners.</p>
          )}
          <div className="flex gap-2">
            <Btn disabled={edit.name.trim().length < 2 || !edit.permissions.length} onClick={save}>{edit.id ? "Save role" : "Create role"}</Btn>
            <Btn variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn>
          </div>
        </div>
      )}
    </Panel>
  );
}
