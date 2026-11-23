"use client";
/**
 * Super Admin → Account recovery: "I lost my email" requests. Each shows which studio matched and which proofs
 * matched what StuPanel knows. Approve moves the owner login to the new email; reject sends the reason.
 * Before approving with weak proof: call the studio's phone number.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Phone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { Btn, Msg, Page, Panel, inp, fmtWhen } from "../_components/staff-kit";

const authH = (json = false) => ({ Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}`, ...(json ? { "Content-Type": "application/json" } : {}) });
type Checks = { studio: "email" | "name" | "address" | null; ownerEmail: string | null; phone: boolean; payment: boolean; sender: boolean; program: boolean; score: number };
type Req = {
  id: string; companyId: string | null; studioName: string; oldEmail: string | null; newEmail: string; name: string; phone: string;
  trxId: string | null; senderNumber: string | null; programNumber: string | null; note: string | null; checks: Checks;
  status: string; adminNote: string | null; decidedBy: string | null; decidedAt: string | null; createdAt: string;
  studio: { id: string; name: string; phone: string | null } | null;
};

function Mark({ ok, label, value }: { ok: boolean; label: string; value?: string | null }) {
  if (!value) return <p className="text-xs text-slate-500">{label}: not given</p>;
  return <p className={cn("text-xs inline-flex items-center gap-1.5", ok ? "text-emerald-300" : "text-red-300")}>{ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}{label}: {value} {ok ? "— matches" : "— does not match"}</p>;
}

export default function RecoveryPage() {
  const [status, setStatus] = useState("pending");
  const [list, setList] = useState<Req[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    fetch(`${API}/admin/recovery?status=${status}`, { headers: authH() }).then(r => (r.ok ? r.json() : Promise.reject())).then(setList).catch(() => setErr("Couldn't load the requests."));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  return (
    <Page title="Account recovery" sub="Studio owners who lost the email they sign in with. Check the proofs; call the studio's phone when in doubt. Approving moves the owner login to the new email and signs every device out.">
      <div className="inline-flex rounded-lg bg-slate-800 p-1 self-start">
        {[["pending", "Waiting"], ["approved", "Approved"], ["rejected", "Rejected"], ["all", "All"]].map(([v, l]) => (
          <button key={v} type="button" onClick={() => { setList(null); setStatus(v); }} aria-pressed={status === v} className={cn("h-8 px-3 rounded-md text-sm font-semibold", status === v ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-700")}>{l}</button>
        ))}
      </div>
      {err && <Msg error={err} />}
      {!list ? <Loader2 className="w-5 h-5 animate-spin text-slate-500" /> : !list.length ? <p className="text-sm text-slate-400">No requests here.</p> : list.map(r => <Item key={r.id} r={r} onDone={load} />)}
    </Page>
  );
}

function Item({ r, onDone }: { r: Req; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const c = r.checks;
  const strong = c.score >= 2;
  async function act(what: "approve" | "reject") {
    if (what === "reject" && !note.trim()) return setMsg({ error: "Write the reason (it is emailed to them)." });
    setBusy(what); setMsg({});
    const res = await fetch(`${API}/admin/recovery/${r.id}/${what}`, { method: "POST", headers: authH(true), body: JSON.stringify(what === "approve" ? { note } : { reason: note }) }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    setBusy("");
    if (!res?.ok) return setMsg({ error: (Array.isArray(d?.message) ? d.message[0] : d?.message) || "Failed" });
    onDone();
  }
  return (
    <Panel title={`${r.studioName} → ${r.newEmail}`} sub={`${r.name} · ${fmtWhen(r.createdAt)}${r.status !== "pending" ? ` · ${r.status} by ${r.decidedBy ?? "—"}` : ""}`}>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-1.5 text-sm">
          {r.studio
            ? <p className="text-white">Matched studio: <Link href={`/admin/studios/${r.studio.id}`} className="font-semibold text-indigo-300 hover:text-white">{r.studio.name}</Link> <span className="text-slate-400">(by {c.studio})</span></p>
            : <p className="text-red-300">No studio matched — find it in Studios first, or reject.</p>}
          {c.ownerEmail && <p className="text-slate-300">Owner email now: {c.ownerEmail}{r.oldEmail && r.oldEmail !== c.ownerEmail ? <span className="text-amber-300"> (they wrote {r.oldEmail})</span> : null}</p>}
          <p className="text-slate-300 inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{r.phone} {r.studio?.phone && <span className="text-slate-500">· studio phone on file: {r.studio.phone}</span>}</p>
          <div className="pt-1 space-y-1">
            <Mark ok={c.phone} label="Phone" value={r.phone} />
            <Mark ok={c.payment} label="Payment TrxID" value={r.trxId} />
            <Mark ok={c.sender} label="Paid from number" value={r.senderNumber} />
            <Mark ok={c.program} label="Program number" value={r.programNumber} />
          </div>
          {r.note && <p className="text-slate-300 pt-1">“{r.note}”</p>}
          <p className={cn("pt-1 text-xs font-semibold", strong ? "text-emerald-300" : "text-amber-300")}>{c.score} of 4 proofs match{strong ? "" : " — call the studio's phone before approving"}</p>
        </div>
        {r.status === "pending" ? (
          <div className="space-y-2">
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Note (approve) or the reason they get (reject)" className={cn(inp, "h-auto py-2")} />
            <div className="flex flex-wrap gap-2">
              <Btn loading={busy === "approve"} disabled={!r.companyId} onClick={() => void act("approve")}><Check className="w-4 h-4" />Approve — move to {r.newEmail}</Btn>
              <Btn variant="danger" loading={busy === "reject"} onClick={() => void act("reject")}><X className="w-4 h-4" />Reject</Btn>
            </div>
            <Msg {...msg} />
          </div>
        ) : r.adminNote ? <p className="text-sm text-slate-400">Note: {r.adminNote}</p> : null}
      </div>
    </Panel>
  );
}
