"use client";

/**
 * Studio data: proving it is the owner (password, or a 6-digit code from email),
 * downloading everything as Excel, and the steps to delete the studio.
 * Used by Settings → Your data and by the page a closed studio's owner sees.
 */
import { useState } from "react";
import { AlertTriangle, Check, Download, Loader2, Mail, Trash2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { FormDrawer, inputCls } from "@/components/ui/form-kit";

export type DataStatus = {
  studioName: string; ownerEmail: string; hasPassword: boolean;
  scheduledFor: string | null; requestedAt: string | null; requestedBy: string | null; daysLeft: number | null; deleteAfterDays: number;
  counts: Record<"clients" | "programs" | "team" | "invoices" | "payments" | "quotes" | "contracts" | "photoSelections" | "songs" | "gear", number>;
};
type Creds = { password?: string; code?: string };
const err = async (r: Response) => { const d = await r.json().catch(() => ({})); return (Array.isArray(d.message) ? d.message[0] : d.message) || "Something went wrong"; };
export const longDate = (d: string | Date) => new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Password, or a code sent to the owner's email (for Google sign-in, or a forgotten password). */
export function Prove({ purpose, status, value, onChange, danger }: {
  purpose: "export" | "delete" | "cancel"; status: DataStatus; value: Creds; onChange: (c: Creds) => void; danger?: boolean;
}) {
  const [mode, setMode] = useState<"password" | "code">(status.hasPassword ? "password" : "code");
  const [sent, setSent] = useState("");
  const [sending, setSending] = useState(false);
  async function send() {
    setSending(true);
    try {
      const r = await apiFetch(`${API}/studio-data/code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose }) });
      if (!r.ok) { notify(await err(r), { error: true }); return; }
      const d = await r.json(); setSent(d.to); notify(`Code sent to ${d.to}`);
    } finally { setSending(false); }
  }
  const ring = danger ? "focus:border-[#C2304F] focus:ring-[#C2304F]/15" : "";
  return mode === "password" ? (
    <div className="space-y-2">
      <label className="block text-[13px] font-semibold text-[#4A4658]" htmlFor={`pw-${purpose}`}>Your password</label>
      <input id={`pw-${purpose}`} type="password" autoComplete="current-password" value={value.password ?? ""} onChange={e => onChange({ password: e.target.value })} className={cn(inputCls, ring)} />
      <button type="button" onClick={() => { setMode("code"); onChange({}); }} className="text-[13px] font-semibold text-[#5B3FD0] hover:underline">Use a code from my email instead</button>
    </div>
  ) : (
    <div className="space-y-2">
      <p className="text-[13px] text-[#4A4658]">{status.hasPassword ? "We send a 6-digit code to" : "You sign in with Google, so we send a 6-digit code to"} <b>{status.ownerEmail}</b>.</p>
      <div className="flex gap-2">
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" aria-label="6-digit code" value={value.code ?? ""}
          onChange={e => onChange({ code: e.target.value.replace(/\D/g, "").slice(0, 6) })} className={cn(inputCls, ring, "tracking-[0.3em] font-semibold")} />
        <button type="button" onClick={send} disabled={sending} className="h-11 px-4 rounded-full bg-[#F5F3FA] text-[#17151F] text-[13px] font-semibold inline-flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}{sent ? "Send again" : "Send code"}
        </button>
      </div>
      {status.hasPassword && <button type="button" onClick={() => { setMode("password"); onChange({}); }} className="text-[13px] font-semibold text-[#5B3FD0] hover:underline">Use my password instead</button>}
    </div>
  );
}
const ready = (c: Creds) => !!c.password || (c.code ?? "").length === 6;

/** "Download all my data": proves it is the owner, then saves the Excel file. */
export function ExportDrawer({ status, onClose, onDone }: { status: DataStatus; onClose: () => void; onDone?: () => void }) {
  const [creds, setCreds] = useState<Creds>({});
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!ready(creds) || busy) return;
    setBusy(true);
    try {
      const r = await apiFetch(`${API}/studio-data/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(creds) });
      if (!r.ok) { notify(await err(r), { error: true }); return; }
      const blob = await r.blob();
      const name = /filename="([^"]+)"/.exec(r.headers.get("content-disposition") ?? "")?.[1] ?? "StuPanel-data.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      notify("Your data is downloading");
      onDone?.(); onClose();
    } catch { notify("Couldn't download — check your internet and try again", { error: true }); }
    finally { setBusy(false); }
  }
  return (
    <FormDrawer open onClose={onClose} icon={Download} color="green" title="Download all your data" sub="One Excel file with every sheet"
      footer={<>
        <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F5F3FA] text-[#17151F] text-sm font-semibold">Cancel</button>
        <button type="button" onClick={go} disabled={!ready(creds) || busy} className="flex-1 h-11 px-5 rounded-full bg-[#1F8A5B] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-45">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}{busy ? "Making the file…" : "Download Excel file"}
        </button>
      </>}>
      <div className="bg-white rounded-[20px] p-4 mb-4 text-[13.5px] text-[#4A4658] leading-relaxed">
        Clients, programs with every day and shift, team bills and payments, client payments, invoices, quotes, contracts, packages, team and their prices,
        gear, expenses, salary, leads, music, photo selections, deliveries, checklists, chats and your settings — each in its own sheet.
        <span className="block mt-2 text-[#6B6680]">Not in the file: passwords and sign-in keys. Photos and videos stay in your Google Drive; the file has their names and links.</span>
      </div>
      <div className="bg-white rounded-[20px] p-4"><Prove purpose="export" status={status} value={creds} onChange={setCreds} /></div>
      <p className="px-1 mt-3 text-xs text-[#6B6680]">For safety we email you each time all the data is downloaded.</p>
    </FormDrawer>
  );
}

const TICKS: [string, string][] = [
  ["all_data", "All clients, programs, payments, invoices, quotes, contracts, team, gear, music and photo selections of this studio will be deleted."],
  ["team_out", "My team can no longer sign in to this studio — from the moment I confirm."],
  ["client_links", "Every client link (portal, quotes, invoices, photo and music selection) stops working."],
  ["subscription", "The subscription ends. Money for the time left is not refunded."],
  ["no_undo", "After the waiting days nothing can be brought back — not even by StuPanel."],
];

/** Deleting the studio: what goes → read and tick → name + password → a confirmation link by email. */
export function DeleteDrawer({ status, onClose }: { status: DataStatus; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [exported, setExported] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [ticks, setTicks] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [creds, setCreds] = useState<Creds>({});
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const all = [...TICKS.map(t => t[0]), ...(exported ? [] : ["no_export"])];
  const ticked = all.every(k => ticks.includes(k));
  const nameOk = name.trim().replace(/\s+/g, " ").toLowerCase() === status.studioName.trim().replace(/\s+/g, " ").toLowerCase();
  const c = status.counts;
  const lines = ([["clients", "clients"], ["programs", "programs"], ["payments", "client payments"], ["invoices", "invoices"], ["quotes", "quotes"], ["contracts", "agreements"], ["team", "team members"], ["photoSelections", "photo selections"], ["songs", "songs"], ["gear", "studio gear"]] as const)
    .filter(([k]) => c[k] > 0).map(([k, l]) => `${c[k]} ${l}`);

  async function send() {
    if (!ticked || !nameOk || !ready(creds) || busy) return;
    setBusy(true);
    try {
      const r = await apiFetch(`${API}/studio-data/delete/request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...creds, studioName: name, confirmations: ticks, exported }) });
      if (!r.ok) { notify(await err(r), { error: true }); return; }
      setSentTo((await r.json()).to); setStep(4);
    } finally { setBusy(false); }
  }

  const red = "flex-1 h-11 px-5 rounded-full bg-[#C2304F] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40";
  const back = <button type="button" onClick={() => (step > 1 && step < 4 ? setStep(step - 1) : onClose())} className="h-11 px-5 rounded-full bg-[#F5F3FA] text-[#17151F] text-sm font-semibold">{step > 1 && step < 4 ? "Back" : step === 4 ? "Close" : "Cancel"}</button>;
  return (
    <>
      <FormDrawer open onClose={onClose} icon={Trash2} color="red" title={`Delete ${status.studioName}`} sub={step < 4 ? `Step ${step} of 3` : "Check your email"}
        footer={step === 1 ? <>{back}<button type="button" onClick={() => setStep(2)} className={red}>Continue</button></>
          : step === 2 ? <>{back}<button type="button" onClick={() => setStep(3)} disabled={!ticked} className={red}>Continue</button></>
          : step === 3 ? <>{back}<button type="button" onClick={send} disabled={!ticked || !nameOk || !ready(creds) || busy} className={red}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}Send me the confirmation email</button></>
          : <>{back}</>}>
        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-[20px] bg-[#FDECEF] p-4 text-[#7A1F33]">
              <p className="font-bold text-[15px] inline-flex items-center gap-2"><AlertTriangle className="w-4 h-4" />This deletes the whole studio</p>
              <p className="text-[13.5px] mt-1.5 leading-relaxed">Everything below is removed from StuPanel. The studio closes as soon as you confirm, and is deleted for good after {status.deleteAfterDays} days. Until then you can stop it.</p>
            </div>
            <div className="bg-white rounded-[20px] p-4">
              <p className="text-[13px] font-bold text-[#4A4658] mb-2">What will be deleted</p>
              {lines.length ? <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[14px] text-[#17151F]">{lines.map(l => <li key={l} className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#C2304F]" />{l}</li>)}</ul>
                : <p className="text-[14px] text-[#6B6680]">The studio and its settings.</p>}
              <p className="text-[12.5px] text-[#6B6680] mt-3">Plus settings, team prices, expenses, salary slips, leads, deliveries and chats. Files in your own Google Drive are not touched.</p>
            </div>
            <div className={cn("rounded-[20px] p-4", exported ? "bg-[#E9F5EF]" : "bg-white")}>
              <p className="text-[14px] font-bold text-[#17151F]">{exported ? "Your data is downloaded" : "Download your data first"}</p>
              <p className="text-[13px] text-[#6B6680] mt-1">{exported ? "Keep the Excel file safe — after deletion it is the only copy." : "We strongly advise it. After deletion StuPanel cannot give you anything back."}</p>
              {!exported && <button type="button" onClick={() => setExporting(true)} className="mt-3 h-11 px-4 rounded-full bg-[#1F8A5B] text-white text-sm font-semibold inline-flex items-center gap-1.5"><Download className="w-4 h-4" />Download all my data</button>}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="bg-white rounded-[20px] divide-y divide-[#EEEBF4] overflow-hidden">
            {[...TICKS, ...(exported ? [] : [["no_export", "I did not download my data and I do not need it."] as [string, string]])].map(([k, t]) => {
              const on = ticks.includes(k);
              return (
                <button key={k} type="button" role="checkbox" aria-checked={on} onClick={() => setTicks(on ? ticks.filter(x => x !== k) : [...ticks, k])}
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-[#FBF7F8]">
                  <span className={cn("mt-0.5 w-5 h-5 rounded-[6px] flex-shrink-0 inline-flex items-center justify-center border-2", on ? "bg-[#C2304F] border-[#C2304F] text-white" : "border-[#CFC8DC]")}>{on && <Check className="w-3.5 h-3.5" />}</span>
                  <span className={cn("text-[14px] leading-snug", k === "no_export" ? "text-[#C2304F] font-semibold" : "text-[#17151F]")}>{t}</span>
                </button>
              );
            })}
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-white rounded-[20px] p-4 space-y-2">
              <label htmlFor="del-name" className="block text-[13px] font-semibold text-[#4A4658]">Type the studio name: <b className="text-[#17151F]">{status.studioName}</b></label>
              <input id="del-name" value={name} onChange={e => setName(e.target.value)} autoComplete="off" className={cn(inputCls, "focus:border-[#C2304F] focus:ring-[#C2304F]/15")} />
              {name && !nameOk && <p className="text-[12.5px] text-[#C2304F]">Not the same yet.</p>}
            </div>
            <div className="bg-white rounded-[20px] p-4"><Prove purpose="delete" status={status} value={creds} onChange={setCreds} danger /></div>
            <p className="px-1 text-[12.5px] text-[#6B6680] leading-relaxed">Nothing happens yet. We email a link to <b>{status.ownerEmail}</b>. The studio closes only when you press the button in that email (it works for 1 hour).</p>
          </div>
        )}
        {step === 4 && (
          <div className="bg-white rounded-[20px] p-6 text-center">
            <span className="w-14 h-14 rounded-full bg-[#FDECEF] text-[#C2304F] inline-flex items-center justify-center"><Mail className="w-6 h-6" /></span>
            <p className="mt-3 text-[17px] font-bold text-[#17151F]">Check your email</p>
            <p className="mt-1.5 text-[14px] text-[#4A4658] leading-relaxed">We sent a link to <b>{sentTo}</b>. Open it and press <b>Yes, delete my studio</b>. The link works for 1 hour. Until then nothing changes.</p>
          </div>
        )}
      </FormDrawer>
      {exporting && <ExportDrawer status={status} onClose={() => setExporting(false)} onDone={() => setExported(true)} />}
    </>
  );
}
