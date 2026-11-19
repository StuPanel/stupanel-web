"use client";

/**
 * Program → Editing → "Changes from the client".
 * The owner switches it on or off for this program (default: the package, then Settings → Delivery),
 * sets how many times per video / photo set, and sees every request with where it stands.
 * A request the studio can't do is answered here ("Can't do this"), and the client sees the reason.
 */
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, MessageSquareReply, PenLine, XCircle } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { notify } from "@/components/feedback";
import { Tile } from "@/components/ui/apple";
import { cn } from "@/lib/utils";
import { fmtDate } from "./constants";

type Rule = { enabled: boolean; limit: number; from: "program" | "package" | "studio" };
type Req = { id: string; type: string; label: string; note: string; status: "open" | "done" | "declined"; reply: string | null; createdAt: string; resolvedAt: string | null };
type Data = { rule: Rule; package: string | null; requests: Req[] };

const LIMITS = [1, 2, 3, 5, 0];
const STATUS = {
  open: { label: "Editors are on it", cls: "bg-[#FFF3E0] text-[#7A4800]", Icon: Clock },
  done: { label: "Done", cls: "bg-[#E7F5EE] text-[#14613F]", Icon: CheckCircle2 },
  declined: { label: "Not done", cls: "bg-[#F1EFF6] text-[#4A4658]", Icon: XCircle },
} as const;

export function ClientChanges({ bookingId, onChanged, refresh = 0 }: { bookingId: string; onChanged: () => void;
  /** Changes when the editors' list changed (a version was approved), so the requests are read again. */
  refresh?: number }) {
  const [d, setD] = useState<Data | null>(null);
  const [saving, setSaving] = useState(false);
  const [declineFor, setDeclineFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch(`${API}/bookings/${bookingId}/corrections`).then(r => (r.ok ? r.json() : null)).then(v => v && setD(v)).catch(() => {});
  }, [bookingId]);
  useEffect(() => { load(); }, [load, refresh]);

  async function save(body: { enabled?: boolean | null; limit?: number | null }) {
    setSaving(true);
    try {
      const r = await apiFetch(`${API}/bookings/${bookingId}/corrections`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const v = await r.json().catch(() => ({}));
      if (!r.ok) { notify(v?.message || "Couldn't save", { error: true }); return; }
      setD(v);
    } finally { setSaving(false); }
  }

  async function decline(id: string) {
    if (reason.trim().length < 3) return;
    setBusy(true);
    try {
      const r = await apiFetch(`${API}/bookings/${bookingId}/corrections/${id}/decline`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }) });
      const v = await r.json().catch(() => ({}));
      if (!r.ok) { notify(v?.message || "Couldn't send", { error: true }); return; }
      setD(v); setDeclineFor(null); setReason("");
      notify("Answer sent to the client");
      onChanged();
    } finally { setBusy(false); }
  }

  if (!d) return null;
  const { rule } = d;
  const open = d.requests.filter(r => r.status === "open").length;
  const source = rule.from === "program" ? "Set for this program"
    : rule.from === "package" ? `From the package${d.package ? ` “${d.package}”` : ""}`
    : "From Settings → Delivery";
  const sub = rule.enabled
    ? `${rule.limit > 0 ? `Up to ${rule.limit} per video or photo set` : "No limit"}${open ? ` · ${open} open` : ""}`
    : "The client can't ask for changes on this program";

  return (
    <div className="rounded-2xl border border-[#E6E2EE] overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <Tile icon={PenLine} color="orchid" size={36} />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-[#17151F]">Changes from the client</p>
          <p className="text-[12.5px] text-[#6B6680] truncate">{sub}</p>
        </div>
        {saving && <Loader2 className="w-4 h-4 animate-spin text-[#8A8599]" />}
        <button type="button" role="switch" aria-checked={rule.enabled} aria-label="Client can ask for changes" disabled={saving}
          onClick={() => save({ enabled: !rule.enabled })}
          className={cn("relative w-[51px] h-[31px] rounded-full transition-colors flex-shrink-0", rule.enabled ? "bg-[#7D5CEF]" : "bg-[#E4E0EC]")}>
          <span className={cn("absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,.18)] transition-transform", rule.enabled && "translate-x-[20px]")} />
        </button>
      </div>

      <div className="px-4 py-3 border-t border-[#EEEBF4] space-y-3">
        {rule.enabled && (
          <div>
            <p className="text-[13px] font-semibold text-[#4A4658] mb-1.5">How many times for each video or photo set?</p>
            <div role="group" aria-label="Changes allowed" className="flex flex-wrap gap-1.5">
              {LIMITS.map(n => (
                <button key={n} type="button" aria-pressed={rule.limit === n} disabled={saving} onClick={() => save({ limit: n })}
                  className={cn("h-9 min-w-[44px] px-3.5 rounded-full text-[13px] font-semibold border transition-colors",
                    rule.limit === n ? "bg-[#17151F] text-white border-[#17151F]" : "bg-white text-[#4A4658] border-[#E6E2EE] hover:border-[#CFC8DD]")}>
                  {n === 0 ? "No limit" : n}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="text-[12.5px] text-[#6B6680] leading-relaxed">
          {rule.enabled
            ? "On the client's page each delivered video or photo set gets an “Ask for a change” button. Their note goes to the editors who made it and to you; the editors can then send a new version, and you approve it as usual."
            : "Switch on to give the client an “Ask for a change” button on their page for each delivered video or photo set."}
          {" "}<span className="text-[#8A8599]">{source}.</span>
          {rule.from === "program" && (
            <button type="button" disabled={saving} onClick={() => save({ enabled: null, limit: null })} className="ml-1 font-semibold text-[#5B3FD0] hover:underline">Use the default again</button>
          )}
        </p>
      </div>

      {d.requests.length > 0 && (
        <div className="divide-y divide-[#F1EFF6] border-t border-[#EEEBF4]">
          {d.requests.map(r => {
            const st = STATUS[r.status] ?? STATUS.open;
            return (
              <div key={r.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-semibold text-[#17151F]">{r.label}</span>
                  <span className={cn("h-6 px-2.5 rounded-full text-[12px] font-bold inline-flex items-center gap-1.5", st.cls)}><st.Icon className="w-3.5 h-3.5" />{st.label}</span>
                  <span className="ml-auto text-[12px] text-[#8A8599]">Asked {fmtDate(r.createdAt)}{r.resolvedAt ? ` · closed ${fmtDate(r.resolvedAt)}` : ""}</span>
                </div>
                <p className="text-[14px] text-[#17151F] bg-[#FFF8EC] rounded-xl px-3 py-2.5 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]"><b>Client:</b> {r.note}</p>
                {r.status === "declined" && r.reply && (
                  <p className="text-[13.5px] text-[#4A4658] bg-[#F7F5FB] rounded-xl px-3 py-2 leading-relaxed whitespace-pre-wrap"><b className="text-[#17151F]">Your answer:</b> {r.reply}</p>
                )}
                {r.status === "open" && (declineFor === r.id ? (
                  <div className="space-y-2">
                    <label htmlFor={`why-${r.id}`} className="block text-[13px] font-semibold text-[#4A4658]">Why can&apos;t this be done? The client reads this.</label>
                    <textarea id={`why-${r.id}`} autoFocus value={reason} onChange={e => setReason(e.target.value)} rows={3}
                      className="w-full px-3 py-2 rounded-xl bg-[#F5F3FA] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40" />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => { setDeclineFor(null); setReason(""); }} className="h-9 px-3.5 rounded-full bg-[#F1EFF6] text-[13px] font-semibold text-[#17151F]">Cancel</button>
                      <button type="button" disabled={busy || reason.trim().length < 3} onClick={() => decline(r.id)}
                        className="h-9 px-3.5 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
                        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Send answer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[12.5px] text-[#6B6680] flex-1 min-w-[200px]">The editors were told and can send a new version. It closes when you approve that version above.</p>
                    <button type="button" onClick={() => { setDeclineFor(r.id); setReason(""); }}
                      className="h-9 px-3.5 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-1.5">
                      <MessageSquareReply className="w-3.5 h-3.5" />Can&apos;t do this
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
