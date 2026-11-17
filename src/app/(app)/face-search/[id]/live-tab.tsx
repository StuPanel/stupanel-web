"use client";

/**
 * A gallery's Live tab: StuPanel Live (the phone app). Get the app, see which phones are sending now,
 * stop one, and — when "Check before guests see them" is on — approve the photos that came in.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Ban, Check, CheckCheck, Copy, Download, EyeOff, Loader2, Smartphone, Trash2, Undo2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { askConfirm, notify } from "@/components/feedback";
import { CARD_SHADOW } from "@/components/ui/apple";
import { LIVE_APP_PAGE, facePhotoUrl, num, type FaceDetail, type FacePhoto, type LiveDevice, type LivePanel } from "@/lib/face";

const json = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const ago = (iso: string | null) => {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const STATE: Record<LiveDevice["state"], { label: string; cls: string }> = {
  sending: { label: "Sending now", cls: "bg-[#E7F5EE] text-[#176B47]" },
  idle: { label: "Quiet", cls: "bg-[#F1EFF6] text-[#4A4658]" },
  ended: { label: "Stopped Live", cls: "bg-[#F1EFF6] text-[#6B6680]" },
  stopped: { label: "Stopped by you", cls: "bg-[#FDECEF] text-[#A82743]" },
};

export function LiveTab({ g, onSettings, onChanged }: { g: FaceDetail; onSettings: () => void; onChanged: () => void }) {
  const [p, setP] = useState<LivePanel | null>(null);
  const [queue, setQueue] = useState<(FacePhoto & { hidden?: boolean })[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      apiFetch(`${API}/live/${g.id}/panel`).then(r => (r.ok ? r.json() : null)).catch(() => null),
      apiFetch(`${API}/face-search/${g.id}/photos?filter=review&take=120`).then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    if (a) setP(a);
    if (b) setQueue(b.photos ?? []);
  }, [g.id]);

  // Live means live: look again every 10 seconds while this tab is open.
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), 10_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  async function block(d: LiveDevice, blocked: boolean) {
    if (blocked && !(await askConfirm({ title: `Stop ${d.userName || "this phone"}?`, message: "Photos from this phone stop going to this event at once. You can allow it again any time.", confirmLabel: "Stop this phone", danger: true }))) return;
    setBusy(d.id);
    const r = await apiFetch(`${API}/live/${g.id}/devices/${d.id}`, json({ blocked })).catch(() => null);
    setBusy(null);
    if (!r?.ok) { notify("Could not change it. Please try again.", { error: true }); return; }
    notify(blocked ? "This phone is stopped for this event." : "This phone can send again.");
    void load();
  }

  async function approve(ids: string[]) {
    if (!ids.length) return;
    setBusy("approve");
    const r = await apiFetch(`${API}/face-search/${g.id}/photos`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, hidden: false }) }).catch(() => null);
    setBusy(null);
    if (!r?.ok) { notify("Could not approve. Please try again.", { error: true }); return; }
    notify(ids.length === 1 ? "Approved — guests can get it now." : `${num(ids.length)} photos approved — guests can get them now.`);
    void load(); onChanged();
  }

  async function remove(ids: string[]) {
    if (!(await askConfirm({ title: ids.length === 1 ? "Take this photo out?" : `Take ${ids.length} photos out?`, message: "It leaves the gallery; the file stays on your Drive. The credit is not given back.", confirmLabel: "Take out", danger: true }))) return;
    setBusy("remove");
    const r = await apiFetch(`${API}/face-search/${g.id}/photos/remove`, json({ ids })).catch(() => null);
    setBusy(null);
    if (!r?.ok) { notify("Could not take it out. Please try again.", { error: true }); return; }
    void load(); onChanged();
  }

  const appLink = typeof window === "undefined" ? LIVE_APP_PAGE : `${window.location.origin}${LIVE_APP_PAGE}`;
  const sending = p?.devices.filter(d => d.state === "sending").length ?? 0;

  return (
    <div className="space-y-5">
      {/* The app */}
      <div className={cn("bg-[#17151F] text-white rounded-[24px] p-5 sm:p-6 flex flex-col md:flex-row md:items-center gap-4")}>
        <span className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0"><Smartphone className="w-6 h-6" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-bold">StuPanel Live app</p>
          <p className="text-[13.5px] text-white/75 mt-0.5">Send photos from the camera while you shoot. Android. Install it on the phone each photographer carries, sign in, pick this event.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={LIVE_APP_PAGE} target="_blank" className="h-11 px-4 rounded-full bg-white text-[#17151F] text-[13.5px] font-semibold inline-flex items-center gap-1.5"><Download className="w-4 h-4" />Get the app</Link>
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(appLink); notify("Link copied — send it to your photographers."); } catch { notify("Could not copy.", { error: true }); } }}
            className="h-11 px-4 rounded-full bg-white/10 text-white text-[13.5px] font-semibold inline-flex items-center gap-1.5 hover:bg-white/15"><Copy className="w-4 h-4" />Copy link for the team</button>
        </div>
      </div>

      {/* Numbers */}
      <div className={cn("bg-white rounded-[20px] grid grid-cols-2 lg:grid-cols-4 overflow-hidden", CARD_SHADOW)}>
        <Num label="Phones sending now" value={p ? num(sending) : "…"} sub={p ? `${num(p.devices.length)} phone${p.devices.length === 1 ? "" : "s"} used for this event` : ""} good={sending > 0} />
        <Num label="Photos from the app" value={p ? num(p.totals.sent) : "…"} sub={p?.max ? `Limit ${num(p.max)}` : "No limit"} />
        <Num label="Waiting for you" value={p ? num(p.totals.waitingReview) : "…"} sub={p?.review ? "Check before guests see them" : "Guests see them at once"} />
        <Num label="Guests who got photos" value={p ? num(p.totals.guestsWithPhotos) : "…"} sub={`${num(p?.totals.creditsUsed ?? 0)} credits for app photos`} />
      </div>

      {/* Phones */}
      <section>
        <div className="flex items-end justify-between gap-3 px-1 mb-2">
          <h2 className="text-[13px] font-bold text-[#4A4658]">Phones</h2>
          <button type="button" onClick={onSettings} className="text-[13px] font-semibold text-[#5B3FD0]">Live settings</button>
        </div>
        <div className={cn("bg-white rounded-[20px] overflow-hidden", CARD_SHADOW)}>
          {!p ? <div className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#8A8599]" /></div>
            : !p.devices.length ? (
              <p className="p-6 text-[14px] text-[#6B6680] text-center">No phone has sent photos to this event yet. Open StuPanel Live on a phone, sign in and choose <b className="text-[#17151F]">{g.title}</b>.</p>
            ) : p.devices.map((d, i) => (
              <div key={d.id} className={cn("px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3", i > 0 && "border-t border-[#EEEBF4]")}>
                <div className="flex-1 min-w-0">
                  <p className="text-[14.5px] font-semibold text-[#17151F] truncate">{d.userName || "Team member"} <span className="font-normal text-[#6B6680]">· {d.deviceName || "Android phone"}</span></p>
                  <p className="text-[12.5px] text-[#6B6680]">{num(d.photos)} photo{d.photos === 1 ? "" : "s"} · last photo {ago(d.lastPhotoAt)} · seen {ago(d.lastSeenAt)}{d.appVersion ? ` · app ${d.appVersion}` : ""}</p>
                </div>
                <span className={cn("self-start sm:self-center h-7 px-2.5 rounded-full text-[12px] font-bold inline-flex items-center", STATE[d.state].cls)}>{STATE[d.state].label}</span>
                {d.blocked
                  ? <button type="button" disabled={busy === d.id} onClick={() => block(d, false)} className="h-10 px-4 rounded-full bg-[#F5F3FA] text-[#17151F] text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><Undo2 className="w-4 h-4" />Allow again</button>
                  : <button type="button" disabled={busy === d.id} onClick={() => block(d, true)} className="h-10 px-4 rounded-full bg-[#FDECEF] text-[#A82743] text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"><Ban className="w-4 h-4" />Stop this phone</button>}
              </div>
            ))}
        </div>
      </section>

      {/* Check first */}
      {(p?.review || queue.length > 0) && (
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3 px-1 mb-2">
            <h2 className="text-[13px] font-bold text-[#4A4658] inline-flex items-center gap-1.5"><EyeOff className="w-4 h-4" />Waiting for you{queue.length ? ` (${num(queue.length)})` : ""}</h2>
            {queue.length > 0 && (
              <button type="button" disabled={busy === "approve"} onClick={() => approve(queue.map(x => x.id))}
                className="h-10 px-4 rounded-full bg-[#1F8A5B] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
                {busy === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}Approve all
              </button>
            )}
          </div>
          {!queue.length ? (
            <div className={cn("bg-white rounded-[20px] p-6 text-center text-[14px] text-[#6B6680]", CARD_SHADOW)}>Nothing waiting. Photos from the app show up here first; guests get them after you approve.</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {queue.map(x => (
                <div key={x.id} className="relative aspect-square rounded-[14px] overflow-hidden bg-[#EEEBF4] group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={facePhotoUrl(x, 320)} alt={x.fileName} loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1.5">
                    <button type="button" onClick={() => approve([x.id])} aria-label={`Approve ${x.fileName}`} className="flex-1 h-9 rounded-full bg-[#1F8A5B] text-white inline-flex items-center justify-center shadow"><Check className="w-4 h-4" strokeWidth={3} /></button>
                    <button type="button" onClick={() => remove([x.id])} aria-label={`Take out ${x.fileName}`} className="w-9 h-9 rounded-full bg-white/95 text-[#A82743] inline-flex items-center justify-center shadow"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Num({ label, value, sub, good }: { label: string; value: string; sub: string; good?: boolean }) {
  return (
    <div className="px-4 py-3.5 border-b lg:border-b-0 border-r border-[#EEEBF4] last:border-r-0 min-w-0">
      <p className="text-xs font-semibold text-[#6B6680] truncate">{label}</p>
      <p className={cn("text-[24px] font-extrabold tracking-[-0.03em] tabular-nums leading-tight", good ? "text-[#176B47]" : "text-[#17151F]")}>{value}</p>
      <p className="text-xs text-[#6B6680] truncate">{sub}</p>
    </div>
  );
}
