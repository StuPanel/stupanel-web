"use client";

/**
 * The Guests tab of a face gallery: who took a selfie, who left a number or an email, and who has been told that
 * their photos are ready.
 *
 * Free mode: guests with an email are emailed by StuPanel. Guests with only a WhatsApp number wait in the send queue:
 * the studio sends each one a ready message (with the guest's own link) from its own WhatsApp, one tap per guest.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CheckCheck, Clock, Copy, Download, Loader2, Mail, MailCheck, MessageCircle, RefreshCw, ScanFace, Send, SkipForward } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { CARD_SHADOW, EmptyState, Group } from "@/components/ui/apple";
import { dayTime, errText, num, type FaceGuest, type FaceGuestList, type FaceStatus } from "@/lib/face";

type Filter = "all" | "send" | "sent" | "opened" | "waiting" | "none";

/** What stage a guest is at, in one word the studio can act on. */
function stageOf(u: FaceGuest, autoMail = false): { id: Exclude<Filter, "all">; label: string; cls: string; icon: React.ElementType } {
  if (!u.registeredAt) return { id: "none", label: "No details", cls: "bg-[#F1EFF6] text-[#4A4658]", icon: ScanFace };
  // With an email (and emails going by themselves) the guest is told by email: nothing for the studio to send.
  if (u.due && u.email && (autoMail || !u.phone)) return { id: "send", label: autoMail ? "Email on its way" : "Email when you press", cls: "bg-[#E6EEF8] text-[#1F5C99]", icon: Mail };
  if (u.due) return { id: "send", label: u.linkSentAt ? "New photos to send" : "Send on WhatsApp", cls: "bg-[#FFF0D6] text-[#7A4A00]", icon: Send };
  if (u.opened) return { id: "opened", label: "Opened", cls: "bg-[#E2F4EA] text-[#176B47]", icon: CheckCheck };
  if (u.linkSentAt) return { id: "sent", label: u.email ? "Emailed" : "Sent", cls: "bg-[#E6EEF8] text-[#1F5C99]", icon: u.email ? MailCheck : Check };
  if (!u.matchCount) return { id: "waiting", label: "Waiting for photos", cls: "bg-[#F1EFF6] text-[#4A4658]", icon: Clock };
  // Found their photos on the page themselves: nothing to send.
  return { id: "opened", label: "Has their photos", cls: "bg-[#E2F4EA] text-[#176B47]", icon: CheckCheck };
}
const initials = (u: FaceGuest) => (u.name || "").trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?";
const waLink = (u: FaceGuest) => `https://wa.me/${(u.phone ?? "").replace(/\D/g, "")}${u.text ? `?text=${encodeURIComponent(u.text)}` : ""}`;

export function GuestsTab({ id, title, status, onSettings }: { id: string; title: string; status: FaceStatus; onSettings: () => void }) {
  const [data, setData] = useState<FaceGuestList | null>(null);
  const [only, setOnly] = useState<Filter>("all");
  const [checking, setChecking] = useState(false);
  /** Guests passed over in the queue for now (they stay "To send" in the list). */
  const [skipped, setSkipped] = useState<string[]>([]);

  const load = useCallback(async () => {
    const r = await apiFetch(`${API}/face-search/${id}/guests`).catch(() => null);
    setData(r?.ok ? await r.json() : { guests: [] });
  }, [id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load, status]);

  const list = useMemo(() => data?.guests ?? [], [data]);
  const registered = list.filter(u => u.registeredAt);
  /** Emails go by themselves in this gallery: a guest with an email needs no WhatsApp message from the studio. */
  const autoMail = data?.notifyEmail !== false && data?.notifyWhen !== "manual";
  const byMail = (u: FaceGuest) => !!u.email && (autoMail || !u.phone);
  const queue = registered.filter(u => u.due && u.phone && !byMail(u));
  const emailDue = registered.filter(u => u.due && byMail(u));
  const told = registered.filter(u => u.linkSentAt);
  const next = queue.find(u => !skipped.includes(u.id)) ?? queue[0];
  const counts: Record<Filter, number> = { all: list.length, send: 0, sent: 0, opened: 0, waiting: 0, none: 0 };
  for (const u of list) counts[stageOf(u, autoMail).id]++;
  const shown = only === "all" ? list : list.filter(u => stageOf(u, autoMail).id === only);

  /** Open WhatsApp with the ready message, and take the guest out of the queue. */
  async function send(u: FaceGuest) {
    window.open(waLink(u), "_blank", "noopener");
    setData(d => (d ? { ...d, guests: d.guests.map(x => (x.id === u.id ? { ...x, due: false, linkSentAt: new Date().toISOString(), notifiedCount: x.matchCount, opened: false } : x)) } : d));
    const r = await apiFetch(`${API}/face-search/${id}/guests/${u.id}/sent`, { method: "POST" }).catch(() => null);
    if (!r?.ok) { notify("Could not mark this guest as sent. Please try again.", { error: true }); void load(); }
  }
  /** Count everyone's photos again and email the guests who have new ones. */
  async function check() {
    setChecking(true);
    const r = await apiFetch(`${API}/face-search/${id}/notify`, { method: "POST" }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setChecking(false);
    if (!r?.ok) return notify(r?.status === 429 ? "Please wait a minute before checking again." : errText(d, "Could not check. Please try again."), { error: true });
    await load();
    notify(d.emailed || d.waiting ? `${d.emailed ? `${num(d.emailed)} emailed. ` : ""}${d.waiting ? `${num(d.waiting)} waiting for your WhatsApp message.` : ""}`.trim() : "Everyone is up to date.");
  }
  async function copyNumbers() {
    const phones = [...new Set(registered.map(u => u.phone).filter(Boolean))] as string[];
    try { await navigator.clipboard.writeText(phones.join("\n")); notify(`${num(phones.length)} number${phones.length === 1 ? "" : "s"} copied`); } catch { notify("Could not copy. Use Download list.", { error: true }); }
  }
  function download() {
    const esc = (v: string | number | null | undefined) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const rows = [["Name", "WhatsApp", "Email", "Photos found", "Status", "Message sent", "Downloads", "Last seen"],
      ...registered.map(u => [u.name, u.phone, u.email, u.matchCount, stageOf(u, autoMail).label, dayTime(u.linkSentAt), u.downloads, dayTime(u.lastSearchAt ?? u.createdAt)])];
    const url = URL.createObjectURL(new Blob(["﻿" + rows.map(r => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `${title.replace(/[^\w\- ]+/g, "").trim() || "gallery"} guests.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  if (data === null) return <div className="py-16 flex justify-center text-[#A29DB3]"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!list.length) return <EmptyState icon={ScanFace} title="No guests yet" text="Everyone who takes a selfie on the guest page shows up here. When you ask for a number or email in Settings, you can send them their photos from here." />;

  const sentOfQueue = told.filter(u => u.phone).length;
  const total = sentOfQueue + queue.length;

  return (
    <div className="space-y-4">
      {/* Before publishing: the guests who came early are waiting */}
      {status === "draft" && registered.length > 0 && (
        <div className="rounded-[18px] bg-[#FFF3E0] px-4 py-3.5 text-[14px] text-[#6B4100]">
          <b>{num(registered.length)} guest{registered.length === 1 ? " is" : "s are"} waiting.</b> When you publish, guests with an email are emailed by themselves, and guests with a WhatsApp number show up here for you to send.
        </div>
      )}

      {/* The send queue: one guest at a time, from the studio's own WhatsApp */}
      {next && (
        <section aria-label="Send queue" className={cn("rounded-[24px] bg-white overflow-hidden", CARD_SHADOW)}>
          <div className="px-5 sm:px-6 pt-5 pb-4 bg-[linear-gradient(135deg,#F3EEFF_0%,#FFFFFF_70%)]">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-[14px] bg-[#7D5CEF] text-white flex items-center justify-center flex-shrink-0"><Send className="w-5 h-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#17151F] [text-wrap:balance]">{num(queue.length)} guest{queue.length === 1 ? " is" : "s are"} waiting for their photos</h2>
                <p className="text-[13.5px] text-[#4A4658] mt-0.5">Press Send: your WhatsApp opens with the message and the guest&apos;s own link already written. Send it, come back, and the next guest is ready.</p>
              </div>
            </div>
            {total > 1 && (
              <div className="mt-4" aria-hidden>
                <div className="h-2 rounded-full bg-[#E6DFFB] overflow-hidden"><div className="h-full rounded-full bg-[#7D5CEF] transition-[width] duration-300" style={{ width: `${Math.round((sentOfQueue / total) * 100)}%` }} /></div>
                <p className="text-xs font-semibold text-[#4B32B8] mt-1.5 tabular-nums">{num(sentOfQueue)} of {num(total)} sent</p>
              </div>
            )}
          </div>
          <div className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3.5 border-t border-[#EEEBF4]">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="w-12 h-12 rounded-full bg-[#EEE8FD] text-[#4B32B8] text-[15px] font-bold flex items-center justify-center flex-shrink-0">{initials(next)}</span>
              <div className="min-w-0">
                <p className="text-[15.5px] font-bold text-[#17151F] truncate">{next.name || next.phone}</p>
                <p className="text-[13px] text-[#6B6680] truncate tabular-nums">{next.phone} · {num(next.matchCount)} photo{next.matchCount === 1 ? "" : "s"}{next.linkSentAt ? " · new since the last message" : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {queue.length > 1 && <button type="button" onClick={() => setSkipped(s => (s.length + 1 >= queue.length ? [] : [...s, next.id]))} className="h-12 px-4 rounded-full bg-[#F5F3FA] text-[14px] font-semibold text-[#17151F] inline-flex items-center gap-1.5"><SkipForward className="w-4 h-4" />Skip</button>}
              <button type="button" onClick={() => send(next)} className="flex-1 sm:flex-none h-12 px-6 rounded-full bg-[#1F8A5B] hover:bg-[#176B47] text-white text-[15px] font-bold inline-flex items-center justify-center gap-2 shadow-[0_10px_22px_-12px_rgba(31,138,91,.9)]">
                <MessageCircle className="w-[18px] h-[18px]" />Send on WhatsApp
              </button>
            </div>
          </div>
          {next.text && (
            <details className="px-5 sm:px-6 pb-4 group">
              <summary className="text-[13px] font-semibold text-[#4B32B8] cursor-pointer list-none inline-flex items-center gap-1 h-9">See the message</summary>
              <p className="mt-1 rounded-[16px] rounded-tl-[6px] bg-[#F1EFF6] px-4 py-3 text-[14px] leading-relaxed text-[#17151F] whitespace-pre-wrap [overflow-wrap:anywhere] max-w-[520px]">{next.text}</p>
              <button type="button" onClick={onSettings} className="mt-2 text-[13px] font-semibold text-[#4B32B8] hover:underline">Change the message in Settings</button>
            </details>
          )}
          {queue.length > 25 && <p className="px-5 sm:px-6 pb-4 text-xs text-[#6B6680]">Tip: send to about 30 guests, then take a short break. WhatsApp can limit a number that messages many new people at once.</p>}
        </section>
      )}

      {/* The numbers */}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: "Left their details", n: registered.length, sub: `${num(registered.filter(u => u.phone).length)} WhatsApp · ${num(registered.filter(u => u.email).length)} email` },
          { label: "To send on WhatsApp", n: queue.length, sub: emailDue.length ? `${num(emailDue.length)} more go by email` : "Guests who gave no email", warn: queue.length > 0 },
          { label: "Told", n: told.length, sub: "Message or email sent" },
          { label: "Opened", n: list.filter(u => u.opened).length, sub: told.length ? `${Math.round((list.filter(u => u.opened).length / told.length) * 100)}% of those told` : "After the message" },
        ].map(x => (
          <div key={x.label} className={cn("bg-white rounded-[18px] px-4 py-3.5", CARD_SHADOW)}>
            <dt className="text-[12.5px] font-semibold text-[#6B6680]">{x.label}</dt>
            <dd className={cn("text-[24px] font-extrabold tracking-[-0.02em] tabular-nums leading-tight mt-0.5", x.warn ? "text-[#7A4A00]" : "text-[#17151F]")}>{num(x.n)}</dd>
            <dd className="text-xs text-[#6B6680] truncate">{x.sub}</dd>
          </div>
        ))}
      </dl>

      {/* Filters and tools */}
      <div className={cn("bg-white rounded-[18px] p-2 flex flex-col lg:flex-row lg:items-center gap-2", CARD_SHADOW)}>
        <div role="group" aria-label="Show guests" className="flex gap-1 flex-1 min-w-0 overflow-x-auto [scrollbar-width:none]">
          {([["all", "All"], ["send", "To send"], ["sent", "Sent"], ["opened", "Opened"], ["waiting", "Waiting for photos"], ["none", "No details"]] as const).filter(([v]) => v === "all" || counts[v] > 0).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={only === v} onClick={() => setOnly(v)}
              className={cn("h-10 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 flex-shrink-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#7D5CEF]/40", only === v ? "bg-[#EEE8FD] text-[#4B32B8]" : "text-[#4A4658] hover:bg-[#F5F3FA]")}>
              {label}<span className={cn("text-[12px] tabular-nums", only === v ? "text-[#4B32B8]/80" : "text-[#6B6680]")}>{num(counts[v])}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {status === "published" && registered.length > 0 && (
            <button type="button" onClick={check} disabled={checking} title="Count everyone's photos again and email the guests who have new ones" className="h-10 px-4 rounded-full bg-[#EEE8FD] text-[13px] font-semibold text-[#4B32B8] inline-flex items-center gap-1.5 disabled:opacity-60">
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}{checking ? "Checking…" : "Check for new photos"}
            </button>
          )}
          {registered.some(u => u.phone) && <button type="button" onClick={copyNumbers} className="h-10 px-4 rounded-full bg-[#F5F3FA] text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-1.5"><Copy className="w-4 h-4" />Copy numbers</button>}
          {registered.length > 0 && <button type="button" onClick={download} className="h-10 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><Download className="w-4 h-4" />Download list</button>}
        </div>
      </div>

      {registered.length === 0 && (
        <p className="rounded-[18px] bg-white px-4 py-3.5 text-[14px] text-[#4A4658] border border-[#EEEBF4]">
          No guest has left a number or email yet. <button type="button" onClick={onSettings} className="font-semibold text-[#4B32B8] hover:underline">Ask for it in Settings → Access</button>, and you can send every guest their photos from here.
        </p>
      )}

      {/* Everyone */}
      {shown.length === 0 ? <p className="text-center text-sm text-[#6B6680] py-10">No guest here.</p> : (
        <Group>
          {shown.map(u => {
            const st = stageOf(u, autoMail);
            return (
              <div key={u.id} className="px-4 sm:px-5 py-3 flex items-center gap-3 min-h-[68px]">
                <span className="w-10 h-10 rounded-full bg-[#EEE8FD] text-[#4B32B8] flex items-center justify-center flex-shrink-0 text-[13px] font-bold">
                  {u.name ? initials(u) : u.channel === "email" ? <Mail className="w-4 h-4" /> : u.channel === "whatsapp" ? <MessageCircle className="w-4 h-4" /> : <ScanFace className="w-4 h-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#17151F] truncate">{u.name || u.phone || u.email || "Guest (no details)"}</p>
                  <p className="text-xs text-[#6B6680] truncate">{[u.name ? [u.phone, u.email].filter(Boolean).join(" · ") : u.phone && u.email ? u.email : "", u.linkSentAt ? `Told ${dayTime(u.linkSentAt)}` : `Came ${dayTime(u.lastSearchAt ?? u.createdAt)}`, u.downloads ? `${num(u.downloads)} downloads` : ""].filter(Boolean).join(" · ")}</p>
                  {/* Phones: the stage sits under the name, so the name keeps its room */}
                  <span className={cn("sm:hidden mt-1 inline-flex px-2 py-0.5 rounded-full text-[11.5px] font-bold whitespace-nowrap items-center gap-1", st.cls)}><st.icon className="w-3 h-3" aria-hidden />{st.label}{u.matchCount ? ` · ${num(u.matchCount)}` : ""}</span>
                </div>
                <span className={cn("hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap tabular-nums", u.matchCount ? "bg-[#F5F3FA] text-[#17151F]" : "bg-[#F5F3FA] text-[#6B6680]")}>{u.matchCount ? `${num(u.matchCount)} photo${u.matchCount === 1 ? "" : "s"}` : "No photos yet"}</span>
                <span className={cn("hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap items-center gap-1", st.cls)}><st.icon className="w-3.5 h-3.5" aria-hidden />{st.label}</span>
                {u.phone && u.registeredAt && status === "published" && u.matchCount > 0
                  ? <button type="button" onClick={() => send(u)} aria-label={`${u.linkSentAt && !u.due ? "Send again to" : "Send to"} ${u.name || u.phone} on WhatsApp`} title={u.linkSentAt && !u.due ? "Send again" : "Send on WhatsApp"}
                      className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", u.due ? "bg-[#1F8A5B] text-white" : "bg-[#E2F4EA] text-[#176B47]")}><MessageCircle className="w-4 h-4" /></button>
                  : u.email && u.linkSentAt ? <span title="Emailed" className="w-10 h-10 rounded-full bg-[#E6EEF8] text-[#1F5C99] flex items-center justify-center flex-shrink-0"><MailCheck className="w-4 h-4" /></span>
                  : <span className="w-10 flex-shrink-0" aria-hidden />}
              </div>
            );
          })}
        </Group>
      )}
    </div>
  );
}
