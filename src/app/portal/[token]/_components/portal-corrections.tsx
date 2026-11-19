"use client";

/**
 * "Want something changed?" — on a program's Files tab, when the studio allows it.
 * One row for each delivered video or photo set: ask for a change (a note), see that the team
 * is on it, see the answer. The note goes to the editors who made it and to the studio.
 */
import { useState } from "react";
import { CheckCircle2, Clock, Loader2, MessageCircle, PenLine, Send } from "lucide-react";
import { API_URL as API } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { portalHeaders, waLink } from "@/lib/portal-session";
import { Field, FormDrawer, FormGroup, inputCls } from "@/components/ui/form-kit";
import { CARD } from "./portal-todo";
import { programName, type CorrectionItem, type PortalBooking, type Studio } from "./portal-data";

const MIN = 10;

export function Corrections({ b, token, studio }: { b: PortalBooking; token: string; studio: Studio }) {
  const c = b.corrections!;
  // What was just sent shows at once; the next full load brings the same from the server.
  const [items, setItems] = useState<CorrectionItem[]>(c.items);
  const [askFor, setAskFor] = useState<CorrectionItem | null>(null);
  const wa = waLink(studio.phone, `Hi ${studio.name}, I'd like another change for ${programName(b)}.`);
  const limitLine = !c.enabled ? "New changes can't be asked for here any more. Message the studio if you need something."
    : c.limit > 0 ? `You can ask for up to ${c.limit} change${c.limit > 1 ? "s" : ""} to each one. Your note goes straight to the people who made it.`
    : "Your note goes straight to the people who made it.";

  return (
    <section aria-labelledby="corr-title">
      <div className="px-1 mb-2">
        <h2 id="corr-title" className="text-[15px] font-bold text-[#17151F]">Want something changed?</h2>
        <p className="text-[13px] text-[#6B6680] leading-relaxed">{limitLine}</p>
      </div>
      <div className={cn(CARD, "divide-y divide-[#F0EEF3]")}>
        {items.map(it => <Row key={it.type} it={it} enabled={c.enabled} onAsk={() => setAskFor(it)} wa={wa} />)}
      </div>
      {askFor && (
        <AskDrawer item={askFor} token={token} bookingId={b.id} onClose={() => setAskFor(null)}
          onSent={note => {
            setItems(list => list.map(x => x.type === askFor.type
              ? { ...x, state: "open", used: x.used + 1, left: x.left == null ? null : Math.max(0, x.left - 1), open: { id: "new", note, at: new Date().toISOString() } }
              : x));
            setAskFor(null);
          }} />
      )}
    </section>
  );
}

function Row({ it, enabled, onAsk, wa }: { it: CorrectionItem; enabled: boolean; onAsk: () => void; wa: string | null }) {
  // "Left" only means something while changes can still be asked for.
  const leftText = !enabled || it.left == null ? null : it.left === 0 ? "No changes left" : `${it.left} change${it.left > 1 ? "s" : ""} left`;
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <div className="min-w-[150px] flex-1">
          <p className="text-[15px] font-semibold text-[#17151F]">{it.label}</p>
          {it.state === "open" ? (
            <span className="mt-1 h-6 px-2.5 rounded-full text-[12px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap bg-[#FFF3E0] text-[#7A4800]"><Clock className="w-3.5 h-3.5" />Being changed</span>
          ) : it.last?.status === "done" ? (
            <span className="mt-1 h-6 px-2.5 rounded-full text-[12px] font-bold inline-flex items-center gap-1.5 whitespace-nowrap bg-[#E7F5EE] text-[#14613F]"><CheckCircle2 className="w-3.5 h-3.5" />Updated{it.last.at ? ` ${fmtDate(it.last.at)}` : ""}</span>
          ) : null}
          {it.state !== "open" && leftText && <p className="mt-0.5 text-[13px] text-[#6B6680]">{leftText}</p>}
        </div>
        {it.state === "can_ask" && enabled && (
          <button type="button" onClick={onAsk}
            className="h-11 px-4 rounded-full bg-[#17151F] hover:bg-[#2A2733] text-white text-[14px] font-semibold inline-flex items-center gap-2 flex-shrink-0">
            <PenLine className="w-4 h-4" />Ask for a change
          </button>
        )}
        {it.state === "used_up" && wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer"
            className="h-11 px-4 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-[#17151F] text-[14px] font-semibold inline-flex items-center gap-2 flex-shrink-0">
            <MessageCircle className="w-4 h-4" />Message studio
          </a>
        )}
      </div>
      {it.state === "open" && it.open && (
        <div className="mt-3 rounded-[14px] bg-[#FAF8F3] px-3.5 py-3">
          <p className="text-[12.5px] font-semibold text-[#6B6680]">You asked{it.open.at ? ` on ${fmtDate(it.open.at)}` : ""}</p>
          <p className="mt-0.5 text-[14px] text-[#17151F] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{it.open.note}</p>
          <p className="mt-1.5 text-[12.5px] text-[#6B6680]">The team is working on it. The new one will replace this when it is ready.</p>
        </div>
      )}
      {it.state !== "open" && it.last?.status === "declined" && (
        <div className="mt-3 rounded-[14px] bg-[#FEF5F7] px-3.5 py-3">
          <p className="text-[12.5px] font-semibold text-[#9C2340]">The studio could not make your last change</p>
          {it.last.reply && <p className="mt-0.5 text-[14px] text-[#17151F] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{it.last.reply}</p>}
        </div>
      )}
    </div>
  );
}

function AskDrawer({ item, token, bookingId, onClose, onSent }: {
  item: CorrectionItem; token: string; bookingId: string; onClose: () => void; onSent: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const text = note.trim();

  async function send() {
    if (text.length < MIN) { setErr("Please say what to change, in a few words."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API}/public/portal/${token}/bookings/${bookingId}/corrections`, {
        method: "POST", headers: portalHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify({ type: item.type, note: text }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr((Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't send. Please try again."); return; }
      notify("Sent — the team will make the change");
      onSent(text);
    } catch { setErr("No connection. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <FormDrawer open onClose={onClose} icon={PenLine} color="violet" title={`Change to ${item.label}`}
      sub={item.left != null ? `${item.left} change${item.left > 1 ? "s" : ""} left for this` : "Tell the team what to change"}
      footer={<>
        <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-sm font-semibold text-[#17151F]">Close</button>
        <button type="button" onClick={send} disabled={busy}
          className="flex-1 h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6B4AE0] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Send to the team
        </button>
      </>}>
      <FormGroup note="Put everything in one note: it counts as one change. For a video, say where — for example “at 1:20, remove this part”.">
        <Field label="What should be changed?" required>{id => (
          <>
            <textarea id={id} value={note} onChange={e => { setNote(e.target.value); setErr(""); }} rows={7} maxLength={4000} autoFocus
              placeholder="Write the changes one under another…" aria-invalid={!!err}
              className={cn(inputCls, "h-auto py-3 resize-none leading-relaxed")} />
            {err && <p role="alert" className="mt-1.5 text-[13px] font-semibold text-[#C2304F]">{err}</p>}
          </>
        )}</Field>
      </FormGroup>
    </FormDrawer>
  );
}
