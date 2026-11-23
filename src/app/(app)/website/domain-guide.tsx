"use client";
/**
 * Website → Settings → Your own domain, while the domain still waits for its DNS records.
 * Written for studio owners, not developers: pick where the domain was bought → that company's own clicks;
 * each record as its own card with big copy buttons and what it does; the usual mistakes; a ✓ per record;
 * and a ready-made message to send to whoever can do it for them.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, LifeBuoy, Loader2, MessageCircle, Send } from "lucide-react";
import { API_URL as API, apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";

type Rec = { type: "A" | "CNAME" | "TXT"; name: string; value: string; why: string };
type Info = { domain: string | null; records: Rec[]; parts?: { name: string; ok: boolean }[]; error?: string | null };

const PROVIDERS: { id: string; name: string; steps: string[]; host: string; value: string; note?: string }[] = [
  { id: "namecheap", name: "Namecheap", host: "Host", value: "Value", steps: ["Sign in to Namecheap.", "Open Domain List and press Manage next to {d}.", "Open the Advanced DNS tab.", "Press Add New Record for each record below."] },
  { id: "godaddy", name: "GoDaddy", host: "Name", value: "Value", steps: ["Sign in to GoDaddy.", "Go to My Products → Domains and press {d}.", "Open DNS (DNS Records).", "Press Add New Record for each record below."] },
  { id: "hostinger", name: "Hostinger", host: "Name", value: "Points to", steps: ["Sign in to Hostinger (hPanel).", "Go to Domains → {d} → DNS / Nameservers.", "Under Manage DNS records, add each record below."] },
  { id: "cloudflare", name: "Cloudflare", host: "Name", value: "IPv4 address / Target", note: "Turn the orange cloud OFF for these records, so it says “DNS only”.", steps: ["Sign in to Cloudflare.", "Press {d}, then DNS → Records.", "Press Add record for each record below."] },
  { id: "porkbun", name: "Porkbun", host: "Host", value: "Answer", steps: ["Sign in to Porkbun.", "Open Domain Management and press DNS next to {d}.", "Add each record below."] },
  { id: "bd", name: "A Bangladeshi company", host: "Name / Host", value: "Value / Address", steps: ["Sign in to the company's client area (or cPanel).", "Find “Manage DNS”, “DNS Management” or “Zone Editor” for {d}.", "Add each record below.", "Can't find DNS? Use “Ask someone to do it” at the bottom and send the message to their support."] },
  { id: "other", name: "Somewhere else", host: "Name / Host", value: "Value", steps: ["Sign in where you bought {d}.", "Look for “DNS”, “DNS settings”, “Manage DNS” or “Zone”.", "Add each record below."] },
];

const plain = (r: Rec, d: string) =>
  r.type === "TXT" ? "Proves the domain is yours" : r.type === "A" ? `Connects ${d} to your website` : `Makes ${r.name}.${d.replace(/^www\./, "")} work too`;

function CopyField({ label, value, mono = true, hint }: { label: string; value: string; mono?: boolean; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8A8499]">{label}</div>
      <div className="mt-1 flex items-stretch gap-1.5">
        <div className={cn("flex-1 min-w-0 rounded-[10px] bg-[#F7F5FB] border border-[#EEEBF4] px-3 py-2 text-[14px] text-[#17151F] break-all", mono && "font-mono")}>{value}</div>
        <button type="button" onClick={() => { navigator.clipboard.writeText(value); notify(`${label} copied`); }} aria-label={`Copy ${label}`}
          className="flex-shrink-0 w-11 rounded-[10px] bg-[#F1EEF8] hover:bg-[#E6E0F6] text-[#5B3FD0] inline-flex items-center justify-center"><Copy className="w-4 h-4" /></button>
      </div>
      {hint && <p className="text-[11.5px] text-[#8A8499] mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

export function DomainGuide({ dom, studioName, address, busy, onCheck }: { dom: Info & { domain: string }; studioName: string; address: string; busy: boolean; onCheck: () => void }) {
  const d = dom.domain;
  const key = `site-dom-provider:${d}`;
  const [prov, setProv] = useState<string>("");
  useEffect(() => {
    let v: string | null = null;
    try { v = localStorage.getItem(key); } catch { /* storage off */ }
    if (!v) return;
    const id = setTimeout(() => setProv(v as string), 0);
    return () => clearTimeout(id);
  }, [key]);
  const pick = (id: string) => { setProv(id); try { localStorage.setItem(key, id); } catch { /* storage off */ } };
  const P = PROVIDERS.find(p => p.id === prov);
  const okFor = (r: Rec) => {
    const host = r.name === "@" ? d.replace(/^www\./, "") : `${r.name}.${d.replace(/^www\./, "")}`;
    return dom.parts?.find(p => p.name === host)?.ok;
  };

  // StuPanel support: one press files a ticket with everything our team needs (kept per domain for a day).
  const tKey = `site-dom-ticket:${d}`;
  const [sent, setSent] = useState<{ id: string; number: string; at: number } | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => {
    let v: string | null = null;
    try { v = localStorage.getItem(tKey); } catch { /* storage off */ }
    if (!v) return;
    try {
      const t = JSON.parse(v) as { id: string; number: string; at: number };
      if (Date.now() - t.at > 86_400_000) return;
      const id = setTimeout(() => setSent(t), 0);
      return () => clearTimeout(id);
    } catch { /* old value */ }
  }, [tKey]);
  const askSupport = async () => {
    setSending(true);
    try {
      const content = [
        `Please help me connect my own domain to my StuPanel website.`,
        ``,
        `Studio: ${studioName}`,
        `Website now: ${address}`,
        `Domain: ${d}`,
        `Bought from: ${P?.name ?? "not chosen"}`,
        ``,
        `Records StuPanel asks for:`,
        ...dom.records.map((r, i) => {
          const ok = okFor(r);
          return `${i + 1}) ${r.type} | ${r.name} | ${r.value}${ok === undefined ? "" : ok ? "  ✓ working" : "  — not seen yet"}`;
        }),
        ...(dom.error ? [``, `Last check: ${dom.error}`] : []),
        ...(note.trim() ? [``, `My note: ${note.trim()}`] : []),
      ].join("\n");
      const res = await apiFetch(`${API}/support/tickets`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: `Help connecting my domain ${d}`, content, priority: "high", category: "website" }),
      });
      const t = await res.json().catch(() => ({}));
      if (!res.ok) { notify(Array.isArray(t.message) ? t.message[0] : t.message || "Could not send", { error: true }); return; }
      const v = { id: t.id, number: t.ticketNumber, at: Date.now() };
      setSent(v); setNote("");
      try { localStorage.setItem(tKey, JSON.stringify(v)); } catch { /* storage off */ }
      notify(`Sent to StuPanel support (${t.ticketNumber})`);
    } finally { setSending(false); }
  };

  const message = [
    `Hello, please add these DNS records for the domain ${d}, so it opens our website (${studioName}, made with StuPanel):`,
    "",
    ...dom.records.map((r, i) => `${i + 1}) Type: ${r.type} | Name/Host: ${r.name} | Value: ${r.value} | TTL: Automatic`),
    "",
    "If there is already an A record for @ (for example a parking page), please delete it or replace it with the one above. If www already has a record, replace it with the one above.",
    "Thank you!",
  ].join("\n");

  return (
    <div className="mt-3 space-y-4">
      {/* 1 — where the domain was bought */}
      <section>
        <h4 className="text-[14px] font-bold text-[#17151F] flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-[#7D5CEF] text-white text-[12px] inline-flex items-center justify-center">1</span>Where did you buy {d}?</h4>
        <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Where the domain was bought">
          {PROVIDERS.map(p => (
            <button key={p.id} type="button" role="radio" aria-checked={prov === p.id} onClick={() => pick(p.id)}
              className={cn("h-9 px-3 rounded-full text-[13px] font-semibold border transition-colors", prov === p.id ? "bg-[#17151F] text-white border-[#17151F]" : "bg-white text-[#4A4658] border-[#E1DCEC] hover:border-[#C9C1DE]")}>{p.name}</button>
          ))}
        </div>
        {P && (
          <ol className="mt-3 rounded-[12px] bg-[#F7F5FB] px-4 py-3 space-y-1.5 text-[13.5px] text-[#4A4658] list-decimal pl-8">
            {P.steps.map((s, i) => <li key={i}>{s.replace("{d}", d)}</li>)}
            {P.note && <li className="font-semibold text-[#B45309]">{P.note}</li>}
          </ol>
        )}
      </section>

      {/* 2 — the records */}
      <section>
        <h4 className="text-[14px] font-bold text-[#17151F] flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-[#7D5CEF] text-white text-[12px] inline-flex items-center justify-center">2</span>Add {dom.records.length === 1 ? "this record" : `these ${dom.records.length} records`}</h4>
        <p className="text-[12.5px] text-[#6B6680] mt-1">Copy each box into the same box on the domain company&apos;s page.</p>
        <div className="mt-2 space-y-2.5">
          {dom.records.map((r, i) => {
            const ok = okFor(r);
            return (
              <div key={i} className="rounded-[14px] border border-[#EEEBF4] bg-white p-3.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-bold text-[#17151F]">Record {i + 1}</span>
                  <span className="text-[12.5px] text-[#6B6680]">— {plain(r, d)}</span>
                  {ok !== undefined && (ok
                    ? <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-semibold px-2 py-0.5 rounded-full bg-[#E7F6EC] text-[#1F8A4C]"><Check className="w-3.5 h-3.5" />Working</span>
                    : <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-semibold px-2 py-0.5 rounded-full bg-[#FFF4E5] text-[#B45309]">Not seen yet</span>)}
                </div>
                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[150px_1fr_2fr]">
                  <CopyField label="Type" value={r.type} />
                  <CopyField label={P?.host ?? "Name / Host"} value={r.name} hint={r.name === "@" ? "@ means the domain itself. If the box won't take @, leave it empty." : undefined} />
                  <CopyField label={P?.value ?? "Value"} value={r.value} />
                </div>
                <p className="text-[11.5px] text-[#8A8499] mt-2">TTL (if asked): Automatic, or the smallest choice.</p>
                {r.type === "A" && <p className="mt-2 text-[12.5px] text-[#B45309] bg-[#FFF8EC] rounded-[10px] px-3 py-2">Already an <b>A</b> record with name <b>@</b> (often a “parking page”)? Delete it or change it to the value above. Two A records stop the website from opening.</p>}
                {r.type === "CNAME" && <p className="mt-2 text-[12.5px] text-[#6B6680]">Already a record named <b>{r.name}</b>? Edit it instead of adding a new one.</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3 — check */}
      <section>
        <h4 className="text-[14px] font-bold text-[#17151F] flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-[#7D5CEF] text-white text-[12px] inline-flex items-center justify-center">3</span>Save, then check</h4>
        <p className="text-[13px] text-[#4A4658] mt-1">It usually works in 5–30 minutes, sometimes up to a day. We keep checking by ourselves and switch your website on as soon as it works.</p>
        {dom.error && <p className="mt-1.5 text-[12.5px] text-[#B45309]">{dom.error}</p>}
        <button type="button" disabled={busy} onClick={onCheck} className="mt-2.5 h-11 px-5 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] disabled:opacity-50 text-white text-[14px] font-semibold inline-flex items-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />}Check now</button>
      </section>

      {/* StuPanel support */}
      <section className="rounded-[14px] border border-[#DCD3F7] bg-[#F7F4FF] p-3.5">
        <h4 className="text-[13.5px] font-bold text-[#17151F] flex items-center gap-1.5"><LifeBuoy className="w-4 h-4 text-[#7D5CEF]" />Let StuPanel help</h4>
        {sent ? (
          <>
            <p className="text-[12.5px] text-[#4A4658] mt-1">Sent to StuPanel support as <b>{sent.number}</b>. Our team will reply there — you also get an email.</p>
            <div className="mt-2.5 flex gap-2 flex-wrap">
              <Link href={`/support?ticket=${sent.id}`} className="h-10 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-[13px] font-semibold inline-flex items-center">Open the ticket</Link>
              <button type="button" onClick={() => { setSent(null); try { localStorage.removeItem(tKey); } catch { /* storage off */ } }} className="h-10 px-4 rounded-full text-[13px] font-semibold text-[#5B3FD0] hover:bg-[#EDE8FB]">Send again</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[12.5px] text-[#4A4658] mt-1">Stuck? Send this to StuPanel support in one press — your domain, where you bought it and the records go with it.</p>
            <label htmlFor="dom-note" className="sr-only">A note for StuPanel support (optional)</label>
            <textarea id="dom-note" value={note} onChange={e => setNote(e.target.value.slice(0, 1000))} rows={2} placeholder="Anything we should know? (optional)"
              className="mt-2.5 w-full rounded-[12px] border border-[#E1DCEC] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[#7D5CEF] resize-y" />
            <p className="text-[11.5px] text-[#8A8499] mt-1">Never write a password here. If we need to sign in to your domain company, we&apos;ll tell you the safe way.</p>
            <button type="button" disabled={sending} onClick={askSupport} className="mt-2.5 h-10 px-4 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] disabled:opacity-50 text-white text-[13px] font-semibold inline-flex items-center gap-2">{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LifeBuoy className="w-4 h-4" />}Send to StuPanel support</button>
          </>
        )}
      </section>

      {/* someone else can do it */}
      <section className="rounded-[14px] bg-[#F7F5FB] p-3.5">
        <h4 className="text-[13.5px] font-bold text-[#17151F]">Ask someone to do it</h4>
        <p className="text-[12.5px] text-[#6B6680] mt-0.5">Send this message to the company you bought the domain from, or to anyone who manages it for you.</p>
        <div className="mt-2.5 flex gap-2 flex-wrap">
          <button type="button" onClick={() => { navigator.clipboard.writeText(message); notify("Message copied"); }} className="h-10 px-4 rounded-full bg-white border border-[#E1DCEC] hover:border-[#C9C1DE] text-[13px] font-semibold inline-flex items-center gap-1.5"><Copy className="w-4 h-4" />Copy message</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className="h-10 px-4 rounded-full bg-[#1FA855] hover:bg-[#178A45] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><MessageCircle className="w-4 h-4" />Send on WhatsApp</a>
          <a href={`mailto:?subject=${encodeURIComponent(`DNS records for ${d}`)}&body=${encodeURIComponent(message)}`} className="h-10 px-4 rounded-full bg-white border border-[#E1DCEC] hover:border-[#C9C1DE] text-[13px] font-semibold inline-flex items-center gap-1.5"><Send className="w-4 h-4" />Email</a>
        </div>
      </section>
    </div>
  );
}
