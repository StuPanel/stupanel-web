"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Download, Loader2, Mail, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";

function authH() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` };
}
function day(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

type Waiting = {
  id: string; name: string; slug: string;
  ownerName: string | null; ownerEmail: string | null; requestedBy: string | null;
  requestedAt: string | null; deletesOn: string; daysLeft: number; remindersSent: number;
  dataDownloadedAt: string | null; subscriptionStatus: string;
  counts: { users: number; bookings: number; clients: number };
};
type Done = { id: string; name: string; requestedAt: string | null; deletedAt: string };

/**
 * Admin → Studios → "Being deleted": studios whose owner asked to delete them
 * (Settings → Your data). They are locked for 15 days, then deleted by the hourly job.
 */
export function StudioDeletionsTab({ onCount }: { onCount?: (n: number) => void }) {
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const [done, setDone] = useState<Done[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<Waiting | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/admin/studios/deletions`, { headers: authH() });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.message || "Could not load."); return; }
      setWaiting(d.waiting ?? []);
      setDone(d.deleted ?? []);
      onCount?.((d.waiting ?? []).length);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>;
  if (error) return <div className="text-center py-16 text-red-400 bg-slate-800 border border-slate-700 rounded-xl text-sm">{error}</div>;

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-400 max-w-2xl">
        The owner asked to delete these studios from Settings → Your data and confirmed by email. They are closed now
        (the team cannot sign in, client links are off) and are deleted for good on the date shown. Only StuPanel&apos;s own billing is kept.
      </p>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />Waiting to be deleted
          <span className="text-xs font-normal text-slate-500">{waiting.length}</span>
        </h2>
        {waiting.length === 0 ? (
          <div className="text-center py-10 text-slate-500 bg-slate-800 border border-slate-700 rounded-xl text-sm">No studio is waiting to be deleted</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {waiting.map((s) => (
              <div key={s.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/studios/${s.id}`} className="font-semibold text-white hover:text-indigo-300 hover:underline break-words">{s.name}</Link>
                    <p className="text-xs text-slate-500 truncate">{s.ownerName ?? "No owner"}{s.ownerEmail ? ` · ${s.ownerEmail}` : ""}</p>
                  </div>
                  <span className={cn("shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border",
                    s.daysLeft <= 3 ? "bg-red-900/40 text-red-300 border-red-700" : "bg-amber-900/30 text-amber-300 border-amber-700/60")}>
                    {s.daysLeft === 0 ? "Today" : `${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left`}
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-slate-500">Asked on</dt><dd className="text-slate-200">{day(s.requestedAt)}</dd>
                  <dt className="text-slate-500">Deleted on</dt><dd className="text-red-300 font-medium">{day(s.deletesOn)}</dd>
                  <dt className="text-slate-500">Asked by</dt><dd className="text-slate-200 truncate">{s.requestedBy ?? "—"}</dd>
                  <dt className="text-slate-500">Data</dt><dd className="text-slate-200">{s.counts.clients} clients · {s.counts.bookings} programs · {s.counts.users} people</dd>
                  <dt className="text-slate-500">Downloaded data</dt>
                  <dd className={s.dataDownloadedAt ? "text-emerald-300" : "text-slate-400"}>
                    {s.dataDownloadedAt ? <span className="inline-flex items-center gap-1"><Download className="w-3 h-3" />{day(s.dataDownloadedAt)}</span> : "No"}
                  </dd>
                  <dt className="text-slate-500">Reminders sent</dt>
                  <dd className="text-slate-200 inline-flex items-center gap-1"><Mail className="w-3 h-3 text-slate-500" />{s.remindersSent} of 2</dd>
                </dl>

                <div className="flex justify-end pt-1">
                  <Button size="sm" variant="ghost" onClick={() => setTarget(s)}
                    className="h-8 px-3 text-emerald-400 hover:bg-emerald-900/20 gap-1.5 text-xs">
                    <RotateCcw className="w-3.5 h-3.5" />Stop the deletion
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-slate-400" />Deleted
          <span className="text-xs font-normal text-slate-500">{done.length}</span>
        </h2>
        {done.length === 0 ? (
          <div className="text-center py-8 text-slate-500 bg-slate-800 border border-slate-700 rounded-xl text-sm">No studio deleted yet</div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl divide-y divide-slate-700/60">
            {done.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="text-slate-200 truncate">{s.name}</p>
                  <p className="text-xs text-slate-500">Asked {day(s.requestedAt)}</p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 text-xs text-slate-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />Deleted {day(s.deletedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500">Their data is gone; only billing records and the studio name are kept. They cannot be restored.</p>
      </section>

      {target && <StopModal studio={target} onClose={() => setTarget(null)} onStopped={() => { setTarget(null); load(); }} />}
    </div>
  );
}

function StopModal({ studio, onClose, onStopped }: { studio: Waiting; onClose: () => void; onStopped: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function stop() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/admin/studios/${studio.id}/stop-deletion`, {
        method: "POST",
        headers: { ...authH(), "X-Reason": reason.trim().slice(0, 500) },
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.message || "Could not stop it."); return; }
      onStopped();
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-sm">Stop the deletion?</p>
              <p className="text-xs text-slate-400 truncate">{studio.name}</p>
            </div>
          </div>
          <p className="text-xs text-amber-200 bg-amber-900/20 border border-amber-800/40 px-3 py-2 rounded-lg flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            Do this only when the owner asked for it (for example they cannot sign in). The studio opens again for the team and clients, and the owner gets an email.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400" htmlFor="stop-reason">Why (saved in the admin log)</label>
            <textarea id="stop-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
              placeholder="Owner asked on support ticket #…"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 text-sm text-white px-3 py-2 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1 h-10 border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
            <Button onClick={stop} disabled={busy || reason.trim().length < 3}
              className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}Stop it
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
