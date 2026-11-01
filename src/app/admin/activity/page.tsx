"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, History, Search } from "lucide-react";
import { pfetch } from "@/lib/platform-api";
import { Btn, Page, Panel, fmtWhen, inp } from "../_components/staff-kit";

interface Row {
  id: string; actorEmail?: string | null; action: string; entityType?: string | null; entityId?: string | null;
  before?: unknown; after?: unknown; reason?: string | null; ipAddress?: string | null; createdAt: string;
}

const LABEL: Record<string, string> = {
  "auth.login": "Signed in", "auth.logout": "Signed out", "auth.password_failed": "Wrong password",
  "auth.2fa_failed": "Wrong 2FA code", "auth.google_rejected": "Google sign-in refused", "auth.backup_code_used": "Used a backup code",
  "auth.reset_requested": "Password reset link sent", "account.password_reset": "Reset password", "account.password_changed": "Changed password",
  "account.2fa_enabled": "Turned on 2FA", "account.backup_codes_renewed": "New backup codes", "account.sessions_ended": "Signed out devices",
  "account.profile_updated": "Updated profile", "account.google_linked": "Linked Google",
  "team.invited": "Invited someone", "team.invite_accepted": "Joined the team", "team.invite_revoked": "Cancelled an invite",
  "team.member_updated": "Changed a team member", "team.member_removed": "Removed a team member", "team.2fa_reset": "Reset someone's 2FA",
  "platform.bootstrap": "Started team sign-in",
};
const tone = (a: string) => a.includes("failed") || a.includes("rejected") || a.includes("removed") ? "text-red-300 bg-red-950/50"
  : a.startsWith("admin.") ? "text-indigo-300 bg-indigo-950/50" : a.startsWith("team.") ? "text-amber-300 bg-amber-950/40" : "text-slate-300 bg-slate-700/60";

export default function ActivityPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async (p: number, action: string) => {
    const qs = new URLSearchParams({ page: String(p), limit: "30" });
    if (action) qs.set("action", action);
    const d = await pfetch<{ data: Row[]; meta: { total: number; totalPages: number } }>(`/audit?${qs}`);
    setRows(d.data); setPages(d.meta.totalPages); setTotal(d.meta.total); setPage(p);
  }, []);
  useEffect(() => { load(1, "").catch(() => {}); }, [load]);

  return (
    <Page title="Activity log" sub={`${total} things the StuPanel team did — sign-ins, team changes and every change in the admin panel`}>
      <form onSubmit={e => { e.preventDefault(); load(1, q.trim()).catch(() => {}); }} className="flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter, e.g. studios or login" className={`${inp} pl-9`} />
        </div>
        <Btn variant="ghost">Filter</Btn>
      </form>
      <Panel>
        {rows.length === 0 ? (
          <div className="text-center py-12"><History className="w-8 h-8 text-slate-600 mx-auto mb-2" /><p className="text-slate-500 text-sm">Nothing here yet</p></div>
        ) : (
          <div className="-m-5 divide-y divide-slate-700/60">
            {rows.map(r => (
              <div key={r.id}>
                <button onClick={() => setOpen(open === r.id ? null : r.id)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-slate-700/30">
                  <span className="text-xs text-slate-500 w-36 flex-shrink-0">{fmtWhen(r.createdAt)}</span>
                  <span className="text-xs text-slate-300 w-48 truncate flex-shrink-0">{r.actorEmail ?? "System"}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium truncate ${tone(r.action)}`}>{LABEL[r.action] ?? r.action}</span>
                  <span className="ml-auto text-[11px] text-slate-600 font-mono hidden md:block">{r.ipAddress ?? ""}</span>
                </button>
                {open === r.id && (
                  <pre className="mx-5 mb-3 rounded-lg bg-slate-900 border border-slate-700 p-3 text-[11px] text-slate-300 overflow-x-auto">
{JSON.stringify({ action: r.action, entity: r.entityType ? `${r.entityType} ${r.entityId ?? ""}` : r.entityId, reason: r.reason, before: r.before, after: r.after }, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <Btn variant="ghost" disabled={page <= 1} onClick={() => load(page - 1, q.trim())}><ChevronLeft className="w-3.5 h-3.5" />Prev</Btn>
            <Btn variant="ghost" disabled={page >= pages} onClick={() => load(page + 1, q.trim())}>Next<ChevronRight className="w-3.5 h-3.5" /></Btn>
          </div>
        </div>
      )}
    </Page>
  );
}
