"use client";
/**
 * Super Admin → Websites → a studio's own domain, for support. Shows what StuPanel asks for, whether each part
 * works (checked with Vercel each time it opens or "Check again" is pressed), what the public DNS shows right now,
 * and a plain diagnosis — so a domain ticket can be answered without the studio's login at its domain company.
 */
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { notify } from "@/components/feedback";

type Rec = { type: "A" | "CNAME" | "TXT"; name: string; value: string; why: string };
type Info = {
  companyId: string; studioName: string; slug: string; apex: string | null; domain: string | null; twin?: string | null;
  state: "pending" | "live" | null; error?: string | null; checkedAt?: string | null; records: Rec[];
  parts?: { name: string; ok: boolean }[]; seen: { name: string; a: string[]; cname: string[] }[];
};

const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` });
/** Vercel's addresses (any of them is fine for the A record). */
const isVercelIp = (ip: string) => /^(76\.76\.21\.|216\.198\.79\.|64\.29\.17\.|66\.33\.60\.)/.test(ip);
const isVercelCname = (c: string) => /vercel-dns(-\d+)?\.com\.?$/.test(c);

/** Plain words for what is wrong, from what the DNS shows now. */
function diagnose(info: Info): string[] {
  if (!info.domain) return [];
  const out: string[] = [];
  for (const s of info.seen) {
    const apex = s.name === info.apex;
    const label = apex ? info.domain === info.apex ? "The domain" : `${s.name}` : s.name;
    if (apex) {
      const ours = s.a.filter(isVercelIp), other = s.a.filter(ip => !isVercelIp(ip));
      if (!s.a.length) out.push(`${label}: no A record yet — ask them to add A @ → ${info.records.find(r => r.type === "A")?.value ?? "the IP shown"}.`);
      else if (ours.length && other.length) out.push(`${label}: two A records (${other.join(", ")} is extra, often a parking page) — ask them to delete it.`);
      else if (other.length) out.push(`${label}: points to ${other.join(", ")}, not StuPanel — ask them to change the A record to ${info.records.find(r => r.type === "A")?.value}.`);
    } else {
      if (s.cname.some(isVercelCname)) continue;
      if (s.cname.length) out.push(`${label}: CNAME points to ${s.cname.join(", ")} — ask them to change it to ${info.records.find(r => r.type === "CNAME")?.value}.`);
      else if (s.a.length && !s.a.every(isVercelIp)) out.push(`${label}: has an A record to ${s.a.join(", ")} — ask them to replace it with the CNAME shown.`);
      else if (!s.a.length) out.push(`${label}: no record yet — ask them to add the CNAME shown.`);
    }
  }
  if (info.records.some(r => r.type === "TXT")) out.push("Vercel wants the TXT record first (the domain is used on another Vercel account). Ask them to add it.");
  if (!out.length && info.state !== "live") out.push("DNS looks right. It may still be spreading — check again in a few minutes.");
  return out;
}

export function DomainPanel({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/admin/websites/${companyId}/domain`, { headers: authH() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify((Array.isArray(d.message) ? d.message[0] : d.message) || "Couldn't load", { error: true }); return; }
      setInfo(d);
    } finally { setBusy(false); }
  }, [companyId]);
  useEffect(() => {
    const id = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(id);
  }, [load]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const tips = info ? diagnose(info) : [];
  const recordsText = info ? info.records.map((r, i) => `${i + 1}) ${r.type} | ${r.name} | ${r.value}`).join("\n") : "";

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-label="Studio domain" className="fixed z-50 inset-y-0 right-0 w-full max-w-[560px] bg-slate-900 border-l border-slate-700 overflow-y-auto">
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-5 py-4 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">{info?.studioName ?? "Studio"} · {info ? `${info.slug}.stupanel.com` : ""}</p>
            <h2 className="text-lg font-bold text-white truncate">{info?.domain ?? (info ? "No own domain" : "Loading…")}</h2>
          </div>
          <button type="button" onClick={() => void load()} disabled={busy} className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-white inline-flex items-center gap-1.5 disabled:opacity-50">
            <RefreshCw className={cn("w-4 h-4", busy && "animate-spin")} />Check again
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-lg hover:bg-slate-800 text-slate-300 inline-flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>

        {!info ? <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
          : !info.domain ? <p className="p-5 text-sm text-slate-400">This studio hasn&apos;t connected its own domain.</p>
          : (
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-2 flex-wrap">
                {info.state === "live"
                  ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Working</span>
                  : <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-300 border-amber-500/30">Waiting for the records</span>}
                {info.twin && <span className="text-xs text-slate-400">+ {info.twin} (redirects)</span>}
                {info.state === "live" && <a href={`https://${info.domain}`} target="_blank" rel="noreferrer" className="ml-auto text-sm text-indigo-300 hover:text-white inline-flex items-center gap-1">Open<ExternalLink className="w-3.5 h-3.5" /></a>}
              </div>

              {tips.length > 0 && (
                <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                  <h3 className="text-sm font-semibold text-amber-200">What to tell them</h3>
                  <ul className="mt-1.5 space-y-1 text-sm text-amber-100/90 list-disc pl-5">{tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </section>
              )}

              <section>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">Records StuPanel asks for</h3>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(recordsText); notify("Records copied"); }} className="ml-auto text-xs text-indigo-300 hover:text-white inline-flex items-center gap-1"><Copy className="w-3.5 h-3.5" />Copy</button>
                </div>
                <div className="mt-2 rounded-xl border border-slate-700 divide-y divide-slate-700/70">
                  {info.records.map((r, i) => {
                    const host = r.name === "@" ? info.apex : `${r.name}.${info.apex}`;
                    const ok = info.parts?.find(p => p.name === host)?.ok;
                    return (
                      <div key={i} className="px-3 py-2.5 text-sm grid grid-cols-[64px_1fr] gap-x-3 gap-y-0.5">
                        <span className="font-semibold text-slate-200">{r.type}</span>
                        <span className="text-slate-300 break-all"><span className="font-mono">{r.name}</span> → <span className="font-mono">{r.value}</span>
                          {ok !== undefined && (ok ? <span className="ml-2 text-emerald-300 inline-flex items-center gap-0.5 text-xs"><Check className="w-3.5 h-3.5" />works</span> : <span className="ml-2 text-amber-300 text-xs">not seen yet</span>)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-white">What the internet sees now</h3>
                <p className="text-xs text-slate-500 mt-0.5">Public DNS (Cloudflare 1.1.1.1 / Google 8.8.8.8). No login at the domain company needed.</p>
                <div className="mt-2 rounded-xl border border-slate-700 divide-y divide-slate-700/70">
                  {info.seen.map(s => (
                    <div key={s.name} className="px-3 py-2.5 text-sm">
                      <p className="font-mono text-slate-200">{s.name}</p>
                      <p className="text-slate-400 text-xs mt-0.5 break-all">
                        {s.cname.length ? <>CNAME {s.cname.map(c => <span key={c} className={cn("font-mono", isVercelCname(c) ? "text-emerald-300" : "text-rose-300")}>{c} </span>)}</> : null}
                        {s.a.length ? <>A {s.a.map(ip => <span key={ip} className={cn("font-mono", isVercelIp(ip) ? "text-emerald-300" : "text-rose-300")}>{ip} </span>)}</> : null}
                        {!s.a.length && !s.cname.length && "Nothing yet"}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">Green = StuPanel (Vercel), red = somewhere else.</p>
              </section>

              {info.error && <p className="text-sm text-slate-400">Last check: {info.error}</p>}
            </div>
          )}
      </aside>
    </>
  );
}
