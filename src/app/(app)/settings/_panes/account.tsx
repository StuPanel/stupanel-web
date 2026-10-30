"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, HardDrive, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { askConfirm, notify } from "@/components/feedback";
import { cn } from "@/lib/utils";
import { Group, Row, Select, SoonRow, TextField, useSettings } from "../_ui";

// ─── Security ─────────────────────────────────────────────────────────────────
const SESSION = [
  { value: 30, label: "30 minutes" }, { value: 60, label: "1 hour" }, { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" }, { value: 480, label: "8 hours (recommended)" }, { value: 1440, label: "1 day" },
  { value: 10080, label: "1 week" },
];

export function SecurityPane() {
  const { data, patch } = useSettings();
  return (
    <>
      <Group title="Sign-in" note="The sign-out time applies to everyone in your team.">
        <Row id="resetEmail" label="Password reset email" hint="Gets a note when a team member resets their password">
          <TextField label="Password reset email" type="email" value={data.resetEmail ?? data.email ?? ""} placeholder="admin@yourstudio.com"
            onCommit={v => patch({ resetEmail: v })} />
        </Row>
        <Row id="sessionTimeoutMinutes" label="Sign out after inactivity">
          <Select label="Sign out after inactivity" value={Number(data.sessionTimeoutMinutes ?? 480)} options={SESSION}
            onChange={v => patch({ sessionTimeoutMinutes: v })} />
        </Row>
      </Group>
      <Group title="Coming soon">
        <SoonRow id="loginActivity" label="Sign-in activity" hint="See who signed in, when and from which device" />
        <SoonRow id="twoFactor" label="Two-step sign-in (2FA)" hint="A code on sign-in for extra safety" />
      </Group>
    </>
  );
}

// ─── Google Drive ─────────────────────────────────────────────────────────────
type Acc = { id: string; googleEmail: string; isPrimary: boolean; totalStorageGb: number; usedStorageGb: number; usedPercent: number; rootFolderUrl: string | null; connectedAt: string };

export function IntegrationsPane() {
  const [accounts, setAccounts] = useState<Acc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try { const r = await apiFetch(`${API}/google-drive/accounts`); if (r.ok) setAccounts(await r.json()); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    load();
    // Back from Google sign-in
    const p = new URLSearchParams(window.location.search);
    if (p.get("drive") === "connected") notify("Google Drive connected");
    else if (p.get("drive") === "error") notify(decodeURIComponent(p.get("msg") || "Couldn't connect Google Drive"), { error: true });
    if (p.has("drive")) window.history.replaceState({}, "", `${window.location.pathname}?pane=integrations`);
  }, []);

  async function setPrimary(id: string) {
    setBusy(id);
    try { const r = await apiFetch(`${API}/google-drive/accounts/${id}/primary`, { method: "PATCH" }); if (r.ok) { notify("Main account changed"); load(); } }
    finally { setBusy(null); }
  }
  async function disconnect(a: Acc) {
    if (!(await askConfirm({ title: `Disconnect ${a.googleEmail}?`, message: "Files already in Drive stay there. New deliveries won't use this account.", confirmLabel: "Disconnect", danger: true }))) return;
    setBusy(a.id);
    try { const r = await apiFetch(`${API}/google-drive/accounts/${a.id}`, { method: "DELETE" }); if (r.ok) { notify("Account disconnected"); load(); } }
    finally { setBusy(null); }
  }
  async function connect() {
    try {
      const r = await apiFetch(`${API}/google-drive/connect-url`);
      if (!r.ok) throw new Error();
      window.location.href = (await r.json()).url;
    } catch { notify("Couldn't start Google sign-in. Please try again.", { error: true }); }
  }

  return (
    <>
      <Group title="Accounts" note="The main account is used for new program folders. Switch it when a Drive gets full. Clients don't need a Google account to open their photos.">
        <div id="set-drive-accounts" className="sp-set-row scroll-mt-28 divide-y divide-[#EEEBF4]">
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#7D5CEF]" /></div>
          ) : accounts.length === 0 ? (
            <div className="py-10 text-center px-4">
              <HardDrive className="sp-empty-icon" />
              <p className="text-sm font-semibold text-[#17151F]">No Google Drive connected</p>
              <p className="text-xs text-[#6B6680] mt-1">Connect one to deliver photos and videos straight to Drive.</p>
            </div>
          ) : accounts.map(a => (
            <div key={a.id} className="px-4 sm:px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#17151F] truncate flex items-center gap-2">
                    {a.googleEmail}
                    {a.isPrimary && <span className="text-[11px] font-bold text-[#5B3FD0] bg-[#EEE8FD] px-2 py-0.5 rounded-full inline-flex items-center gap-1"><Star className="w-3 h-3 fill-current" />Main</span>}
                  </p>
                  <p className="text-xs text-[#6B6680] mt-0.5 tabular-nums">{a.usedStorageGb} GB of {a.totalStorageGb} GB used</p>
                  <div className="mt-2 h-1.5 bg-[#EEEBF4] rounded-full overflow-hidden max-w-xs">
                    <div className={cn("h-full rounded-full", a.usedPercent > 85 ? "bg-[#C2304F]" : a.usedPercent > 65 ? "bg-[#9E3A8C]" : "bg-[#7D5CEF]")}
                      style={{ width: `${Math.min(a.usedPercent, 100)}%` }} />
                  </div>
                  {a.usedPercent > 85 && <p className="text-xs text-[#C2304F] mt-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Almost full — add another account</p>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {!a.isPrimary && (
                  <button onClick={() => setPrimary(a.id)} disabled={busy === a.id}
                    className="h-9 px-3.5 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#E2D9FC]">
                    {busy === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}Make main
                  </button>
                )}
                {a.rootFolderUrl && (
                  <a href={a.rootFolderUrl} target="_blank" rel="noopener noreferrer"
                    className="h-9 px-3.5 rounded-full bg-[#F5F3FA] text-[#17151F] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#EEEBF4]">
                    <ExternalLink className="w-3.5 h-3.5" />Open Drive
                  </a>
                )}
                <button onClick={() => disconnect(a)} disabled={busy === a.id}
                  className="h-9 px-3.5 rounded-full bg-[#FDECEF] text-[#C2304F] text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-90">
                  <Trash2 className="w-3.5 h-3.5" />Disconnect
                </button>
              </div>
            </div>
          ))}
          <button id="set-drive-add" onClick={connect}
            className="sp-set-row w-full px-4 sm:px-5 py-3.5 flex items-center gap-2 text-sm font-semibold text-[#5B3FD0] hover:bg-[#F7F4FE] scroll-mt-28">
            <Plus className="w-4 h-4" /> Add Google Drive account
          </button>
        </div>
      </Group>
    </>
  );
}
