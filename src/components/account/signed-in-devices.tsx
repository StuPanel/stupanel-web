"use client";
/**
 * Where you are signed in (My profile), and where everyone in the studio is signed in (Settings → Security, owner).
 * Signing a device out works at once: its next click asks for the password again.
 */
import { useCallback, useEffect, useState } from "react";
import { Laptop, Loader2, LogOut, Smartphone, Tablet, AppWindow, Crown } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { askConfirm, notify } from "@/components/feedback";
import { cn } from "@/lib/utils";
import { CARD_SHADOW } from "@/components/ui/apple";

export type Device = {
  id: string; device: string; type: "phone" | "tablet" | "computer" | "app"; ip: string | null; country: string | null;
  lastUsedAt: string; signedInAt: string; current: boolean; studio?: string;
};
type Person = { userId: string; name: string; email: string; isOwner: boolean; isMe: boolean; avatarUrl: string | null; devices: Device[] };

const ICON = { phone: Smartphone, tablet: Tablet, computer: Laptop, app: AppWindow } as const;
const card = cn("bg-white rounded-[20px]", CARD_SHADOW);

/** "Active now", "5 minutes ago", "3 days ago". */
export function when(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60_000);
  if (m < 6) return "Active now";
  if (m < 60) return `${m} minutes ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? "1 hour ago" : `${h} hours ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}
const since = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function DeviceRow({ d, showStudio, onSignOut, busy }: { d: Device; showStudio?: boolean; onSignOut?: () => void; busy?: boolean }) {
  const Icon = ICON[d.type] ?? Laptop;
  return (
    <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
      <span className={cn("w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0", d.current ? "bg-[#E9F5EF] text-[#1F8A5B]" : "bg-[#F5F3FA] text-[#5B3FD0]")}><Icon className="w-5 h-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold text-[#17151F] flex items-center gap-2 flex-wrap">
          {d.device}{d.current && <span className="h-5 px-2 rounded-full bg-[#E9F5EF] text-[#1F6B47] text-[11.5px] font-bold inline-flex items-center">This device</span>}
        </p>
        <p className="text-[12.5px] text-[#6B6680] truncate">
          {d.current ? "You are using it now" : when(d.lastUsedAt)} · signed in {since(d.signedInAt)}{d.country ? ` · ${d.country}` : ""}{showStudio && d.studio ? ` · ${d.studio}` : ""}
        </p>
      </div>
      {onSignOut && !d.current && (
        <button type="button" onClick={onSignOut} disabled={busy} aria-label={`Sign out ${d.device}`}
          className="h-9 px-3 rounded-full border border-[#E3DFEC] text-[13px] font-semibold text-[#C2304F] hover:bg-[#FDECEF] inline-flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}<span className="hidden sm:inline">Sign out</span>
        </button>
      )}
    </div>
  );
}

/** My profile → Signed-in devices. */
export function SignedInDevices() {
  const [list, setList] = useState<Device[] | null>(null);
  const [busy, setBusy] = useState("");
  const load = useCallback(() => {
    apiFetch(`${API}/account/sessions`).then(r => (r.ok ? r.json() : [])).then(setList).catch(() => setList([]));
  }, []);
  useEffect(() => { load(); }, [load]);
  const studios = new Set((list ?? []).map(d => d.studio)).size > 1;
  const others = (list ?? []).filter(d => !d.current);

  async function out(d: Device) {
    setBusy(d.id);
    const r = await apiFetch(`${API}/account/sessions/${d.id}/sign-out`, { method: "POST" }).catch(() => null);
    setBusy("");
    if (!r?.ok) return notify("Couldn't sign it out. Try again.", { error: true });
    notify(`${d.device} is signed out`);
    load();
  }
  async function outOthers() {
    if (!(await askConfirm({ title: "Sign out every other device?", message: `${others.length} other device${others.length === 1 ? "" : "s"} will need your password to get back in. This one stays signed in.`, confirmLabel: "Sign them out", danger: true }))) return;
    setBusy("all");
    const r = await apiFetch(`${API}/account/sessions/sign-out-others`, { method: "POST" }).catch(() => null);
    setBusy("");
    if (!r?.ok) return notify("Couldn't sign them out. Try again.", { error: true });
    notify("Every other device is signed out");
    load();
  }

  return (
    <section>
      <div className="px-1 mb-2 flex items-end gap-2">
        <h2 className="text-[13px] font-bold text-[#4A4658] flex-1">Signed-in devices</h2>
        {others.length > 0 && (
          <button type="button" onClick={() => void outOthers()} disabled={busy === "all"} className="text-[13px] font-semibold text-[#C2304F] hover:underline inline-flex items-center gap-1.5 disabled:opacity-50">
            {busy === "all" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Sign out all other devices
          </button>
        )}
      </div>
      <div className={cn(card, "divide-y divide-[#EEEBF4] overflow-hidden")}>
        {!list ? <div className="p-5"><Loader2 className="w-5 h-5 animate-spin text-[#7D5CEF]" /></div>
          : !list.length ? <p className="p-5 text-[13.5px] text-[#6B6680]">Only this device. Devices you sign in on from now are listed here.</p>
          : list.map(d => <DeviceRow key={d.id} d={d} showStudio={studios} busy={busy === d.id} onSignOut={() => void out(d)} />)}
      </div>
      <p className="px-1 mt-2 text-[12px] text-[#6B6680]">Don&apos;t know a device? Sign it out and change your password. Changing the password signs out every other device too.</p>
    </section>
  );
}

/** Settings → Security → Who is signed in (owner): everyone in the studio, by person. */
export function StudioSessions() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(() => {
    apiFetch(`${API}/account/studio-sessions`).then(async r => (r.ok ? setPeople(await r.json()) : setErr("Only the studio owner can see this."))).catch(() => setErr("Couldn't load. Try again."));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function outDevice(p: Person, d: Device) {
    setBusy(d.id);
    const r = await apiFetch(`${API}/account/studio-sessions/${d.id}/sign-out`, { method: "POST" }).catch(() => null);
    setBusy("");
    if (!r?.ok) return notify("Couldn't sign it out. Try again.", { error: true });
    notify(`${p.name}: ${d.device} is signed out`);
    load();
  }
  async function outPerson(p: Person) {
    if (!(await askConfirm({ title: `Sign ${p.name} out everywhere?`, message: `${p.name} will need to sign in again on every device. Their work and data stay as they are.`, confirmLabel: "Sign out everywhere", danger: true }))) return;
    setBusy(p.userId);
    const r = await apiFetch(`${API}/account/studio-sessions/person/${p.userId}/sign-out`, { method: "POST" }).catch(() => null);
    setBusy("");
    if (!r?.ok) return notify("Couldn't sign them out. Try again.", { error: true });
    notify(`${p.name} is signed out everywhere`);
    load();
  }

  if (err) return <p className="px-4 sm:px-5 py-4 text-[13.5px] text-[#6B6680]">{err}</p>;
  if (!people) return <div className="px-4 sm:px-5 py-4"><Loader2 className="w-5 h-5 animate-spin text-[#7D5CEF]" /></div>;
  if (!people.length) return <p className="px-4 sm:px-5 py-4 text-[13.5px] text-[#6B6680]">Nobody else is signed in right now.</p>;
  return (
    <>
      {people.map(p => (
        <div key={p.userId}>
          <div className="flex items-center gap-3 px-4 sm:px-5 pt-4 pb-1">
            <p className="text-[14px] font-bold text-[#17151F] flex-1 min-w-0 truncate inline-flex items-center gap-1.5">
              {p.name}{p.isOwner && <Crown className="w-3.5 h-3.5 text-[#5B3FD0]" />}{p.isMe && <span className="text-[12px] font-semibold text-[#6B6680]">(you)</span>}
              <span className="text-[12.5px] font-normal text-[#6B6680] ml-1">{p.devices.length} device{p.devices.length === 1 ? "" : "s"}</span>
            </p>
            {!p.isMe && (
              <button type="button" onClick={() => void outPerson(p)} disabled={busy === p.userId} className="text-[12.5px] font-semibold text-[#C2304F] hover:underline inline-flex items-center gap-1 disabled:opacity-50">
                {busy === p.userId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Sign out everywhere
              </button>
            )}
          </div>
          {p.devices.map(d => <DeviceRow key={d.id} d={d} busy={busy === d.id} onSignOut={() => void outDevice(p, d)} />)}
        </div>
      ))}
    </>
  );
}
