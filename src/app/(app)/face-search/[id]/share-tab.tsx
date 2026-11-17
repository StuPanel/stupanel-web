"use client";

/**
 * Share: three links, each with its own rules.
 *  - Guests: a selfie, then only the photos they are in.
 *  - All photos: the couple and family. Every photo, no selfie needed.
 *  - VIP guests: a selfie, own photos, and nobody asks for a name or number.
 * One link is picked at a time for the QR code and the poster.
 */
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Crown, Download, Images, MessageSquareText, QrCode, RefreshCw, Users } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { CARD_SHADOW, Group } from "@/components/ui/apple";
import { Switch } from "@/app/(app)/settings/_ui";
import { QrPoster } from "./qr-poster";
import type { FaceDetail, FaceSettings } from "@/lib/face";

type Kind = "guest" | "full" | "vip";
const NAME: Record<Kind, string> = { guest: "Guests", full: "All photos", vip: "VIP guests" };

/** The text that goes with a link, in the gallery's language. */
export function shareMessage(kind: Kind, title: string, link: string, code: string, lang: "en" | "bn" = "en") {
  if (lang === "bn") {
    const top = kind === "full" ? `${title}-এর সব ছবি এখানে:` : `${title}-এর ছবি নিন।\nএই লিংক খুলে একটি সেলফি তুলুন, আপনি যে যে ছবিতে আছেন সব দেখতে পাবেন:`;
    return `${top}\n${link}${code ? `\nকোড: ${code}` : ""}`;
  }
  const top = kind === "full" ? `All the photos from ${title} are here:` : `Get your photos from ${title}.\nOpen this link, take one selfie and see every photo you are in:`;
  return `${top}\n${link}${code ? `\nCode: ${code}` : ""}`;
}

export function ShareTab({ g, onSaved, onSettings }: { g: FaceDetail; onSaved: (g: FaceDetail) => void; onSettings: () => void }) {
  const s = g.settings;
  const [which, setWhich] = useState<Kind>("guest");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const qrBox = useRef<HTMLDivElement>(null);
  const latest = useRef(s);
  useEffect(() => { latest.current = g.settings; }, [g.settings]);

  const link: Record<Kind, string> = { guest: g.link, full: g.links?.full ?? "", vip: g.links?.vip ?? "" };
  // The code a guest is asked for on each link ("" = none).
  const code: Record<Kind, string> = { guest: s.pin, full: s.fullAskPin && s.fullPin ? s.fullPin : "", vip: s.vipAskPin && s.pin ? s.pin : "" };
  const shown = link[which] || g.link;

  useEffect(() => {
    let on = true;
    QRCode.toDataURL(shown, { margin: 2, width: 960, errorCorrectionLevel: "M", color: { dark: "#17151F", light: "#FFFFFF" } }).then(v => { if (on) setQr(v); }).catch(() => { if (on) setQr(""); });
    return () => { on = false; };
  }, [shown]);

  async function copy(text: string, done: string) {
    try { await navigator.clipboard.writeText(text); notify(done); } catch { notify("Could not copy. Press and hold the link to copy it.", { error: true }); }
  }
  async function save(patch: Partial<FaceSettings>) {
    const next = { ...latest.current, ...patch };
    latest.current = next; setBusy(true);
    const r = await apiFetch(`${API}/face-search/${g.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: next }) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return notify("Could not save. Please try again.", { error: true });
    onSaved(await r.json());
  }
  async function renew(kind: "full" | "vip") {
    if (!(await askConfirm({ title: `Make a new ${NAME[kind]} link?`, message: "The link you shared before stops working. People who already opened it keep their photos.", confirmLabel: "Make new link" }))) return;
    setBusy(true);
    const r = await apiFetch(`${API}/face-search/${g.id}/links/${kind}/reset`, { method: "POST" }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return notify("Could not make a new link. Please try again.", { error: true });
    onSaved(await r.json()); notify("New link made");
  }
  function showQr(kind: Kind) {
    setWhich(kind);
    // Phones: the QR sits below the cards, so bring it into view.
    if (window.matchMedia("(max-width: 1023px)").matches) setTimeout(() => qrBox.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  }

  const card = (kind: Kind, Icon: React.ElementType, tint: string, what: React.ReactNode, rows: React.ReactNode) => (
    <section aria-label={`${NAME[kind]} link`} className={cn("bg-white rounded-[20px] overflow-hidden mb-4 transition-shadow", CARD_SHADOW, which === kind && "ring-2 ring-[#7D5CEF]")}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className={cn("w-10 h-10 rounded-[13px] flex items-center justify-center flex-shrink-0", tint)} aria-hidden><Icon className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-bold text-[#17151F] flex items-center gap-2 flex-wrap">{NAME[kind]}
              {which === kind && <span className="text-[11px] font-bold text-[#5B3FD0] bg-[#EFEAFE] rounded-full px-2 py-0.5">On the QR and poster</span>}
            </h3>
            <p className="text-[13px] leading-snug text-[#6B6680] mt-0.5">{what}</p>
          </div>
        </div>
        <p className="mt-3.5 rounded-[14px] bg-[#F5F3FA] px-3.5 py-3 text-[13px] font-semibold text-[#17151F] break-all select-all">{link[kind] || "Making the link…"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!link[kind]} onClick={() => copy(link[kind], "Link copied")} className="h-11 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><Copy className="w-4 h-4" aria-hidden />Copy link</button>
          <button type="button" disabled={!link[kind]} onClick={() => copy(shareMessage(kind, g.title, link[kind], code[kind], s.language ?? "en"), "Message copied")} className="h-11 px-4 rounded-full bg-[#F5F3FA] text-[#17151F] text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><MessageSquareText className="w-4 h-4" aria-hidden />Copy with message</button>
          <button type="button" disabled={!link[kind]} aria-pressed={which === kind} onClick={() => showQr(kind)} className={cn("h-11 px-4 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50", which === kind ? "bg-[#EFEAFE] text-[#5B3FD0]" : "bg-[#F5F3FA] text-[#17151F]")}><QrCode className="w-4 h-4" aria-hidden />QR code</button>
        </div>
      </div>
      <div className="border-t border-[#EEEBF4] divide-y divide-[#EEEBF4]">{rows}</div>
    </section>
  );
  const row = (label: string, hint: React.ReactNode, end: React.ReactNode) => (
    <div className="px-4 sm:px-5 py-3 flex items-center gap-3 min-h-[56px]">
      <div className="min-w-0 flex-1"><p className="text-[14px] font-semibold text-[#17151F]">{label}</p><p className="text-[12.5px] leading-snug text-[#6B6680]">{hint}</p></div>
      <div className="flex-shrink-0">{end}</div>
    </div>
  );
  const toSettings = <button type="button" onClick={onSettings} className="h-10 px-3.5 rounded-full bg-[#F5F3FA] text-[13px] font-semibold text-[#17151F]">Settings</button>;
  const fresh = (kind: "full" | "vip") => row("New link", "Shared it with the wrong person? Make a new one. The old link stops working.",
    <button type="button" disabled={busy} onClick={() => renew(kind)} className="h-10 px-3.5 rounded-full bg-[#F5F3FA] text-[13px] font-semibold text-[#17151F] inline-flex items-center gap-1.5 disabled:opacity-50"><RefreshCw className="w-4 h-4" aria-hidden />Make new</button>);
  const asks = !!s.register && s.register !== "off";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-5 items-start">
      <div className="min-w-0">
        {g.status !== "published" && (
          <div className="rounded-[18px] bg-[#FFF3E0] p-4 text-[14px] text-[#6B4100] mb-4"><b>Not published yet.</b> {asks ? "Guests who open the Guests link now can leave a selfie and a number or email, and are told when you publish. The other two links open after you publish." : "The links open, but people are told the photos are not ready. Press Publish when the photos are in."}</div>
        )}
        <h2 className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">Share links</h2>

        {card("guest", Users, "bg-[#EFEAFE] text-[#5B3FD0]", "For everyone at the event. Each guest takes a selfie and sees only the photos they are in.", <>
          {row("Code", s.pin ? <>Guests type <b className="tabular-nums text-[#17151F]">{s.pin}</b> before the selfie.</> : "No code. Anyone with the link can take a selfie.", toSettings)}
          {row("Name and number", asks ? (s.register === "required" ? "Guests must give them before the photos open." : "Asked after the selfie. Guests can skip.") : "Not asked.", null)}
        </>)}

        {card("full", Images, "bg-[#E6F6EE] text-[#0B7A47]", "For the couple and family. Opens every photo at once, no selfie needed. They can still take a selfie to find their own.", <>
          {row("Ask for the all-photos code too", s.fullPin ? (s.fullAskPin ? <>On. They type <b className="tabular-nums text-[#17151F]">{s.fullPin}</b> after opening the link.</> : "Off. The link alone opens the photos.") : "Set an all-photos code in Settings first.",
            s.fullPin ? <Switch label="Ask for the all-photos code too" on={!!s.fullAskPin} disabled={busy} onChange={v => save({ fullAskPin: v })} /> : toSettings)}
          {row("Ask for name and number first", s.fullRegister ? "On. They fill it in before the photos open." : "Off. The photos open straight away.",
            <Switch label="Ask for name and number first" on={!!s.fullRegister} disabled={busy} onChange={v => save({ fullRegister: v })} />)}
          {fresh("full")}
        </>)}

        {card("vip", Crown, "bg-[#FFF3E0] text-[#8A5300]", "For special guests. A selfie, then their own photos. No name or number is asked, so they can't be told about photos added later.", <>
          {row("Ask for the guests' code too", s.pin ? (s.vipAskPin ? <>On. They type <b className="tabular-nums text-[#17151F]">{s.pin}</b> before the selfie.</> : "Off. The link alone is enough.") : "The gallery has no guests' code.",
            s.pin ? <Switch label="Ask for the guests' code too" on={!!s.vipAskPin} disabled={busy} onChange={v => save({ vipAskPin: v })} /> : null)}
          {fresh("vip")}
        </>)}

        <QrPoster key={which} link={shown} title={g.title} pin={code[which]} />
      </div>

      <div ref={qrBox} className="lg:sticky lg:top-4">
        <Group title={`QR code: ${NAME[which]}`} note="Print it on table cards or a standee. Press QR code on another link to switch.">
          <div className="p-5 flex flex-col items-center gap-4">
            <div className="w-[220px] h-[220px] rounded-[18px] bg-white ring-1 ring-[#EEEBF4] flex items-center justify-center overflow-hidden">
              {qr
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={qr} alt={`QR code for the ${NAME[which]} link of ${g.title}`} className="w-full h-full" />
                : <QrCode className="w-10 h-10 text-[#C9C2DA]" aria-hidden />}
            </div>
            <p className="text-[15px] font-bold text-[#17151F] text-center">{which === "full" ? "Scan to see all photos" : "Scan to get your photos"}</p>
            {qr && <a href={qr} download={`${g.title.replace(/[^\w\- ]+/g, "").trim() || "gallery"} ${NAME[which]} QR.png`} className="h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><Download className="w-4 h-4" aria-hidden />Download QR</a>}
          </div>
        </Group>
      </div>
    </div>
  );
}
