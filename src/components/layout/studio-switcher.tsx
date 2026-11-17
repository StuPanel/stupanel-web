"use client";

/**
 * The studio name and logo in the sidebar. For someone in several studios (or with an
 * invite waiting) it opens "Your studios": switch with one tap, accept or decline invites,
 * or create one more studio of your own (same login).
 */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronsUpDown, Loader2, Plus, X } from "lucide-react";
import { StudioLogo } from "@/components/studio-logo";
import { InviteList, StudioList } from "@/components/studio-list";
import { notify } from "@/components/feedback";
import { apiFetch, API_URL as API } from "@/lib/api";
import { enterSession, type Session, type StudioCard, type StudioInvite } from "@/lib/studio-session";
import { cn } from "@/lib/utils";

type Mine = { currentUserId: string; studios: StudioCard[]; invites: StudioInvite[] };

let cached: Promise<Mine | null> | null = null;
function loadMine(fresh = false) {
  if (!cached || fresh) {
    cached = apiFetch(`${API}/auth/studios`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  }
  return cached;
}

export function StudioSwitcher({ name, logo, sub, compact, onOpen }: {
  /** What the app already knows (shown at once, before the list loads). */
  name: string; logo?: string | null; sub?: string; compact?: boolean;
  /** e.g. close the phone menu */
  onOpen?: () => void;
}) {
  const [mine, setMine] = useState<Mine | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  /** "Create a new studio": closed, typing a name, or saving. */
  const [making, setMaking] = useState<"" | "form" | "saving">("");
  const [newName, setNewName] = useState("");

  useEffect(() => { loadMine().then(setMine); }, []);
  const refresh = useCallback(() => loadMine(true).then(setMine), []);

  const current = mine?.studios.find(s => s.userId === mine.currentUserId);
  const others = (mine?.studios.length ?? 1) > 1;
  const invites = mine?.invites.length ?? 0;
  // Everyone can open it: to switch, answer an invite, or create another studio.
  const canOpen = !!mine;
  const shownName = current?.name || name || "Your studio";
  const shownLogo = current?.logoUrl ?? logo;

  async function pick(s: StudioCard) {
    setBusy(s.userId);
    const r = await apiFetch(`${API}/auth/switch-studio`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: s.userId }),
    }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    if (!r?.ok) { setBusy(null); notify(d?.message || "Couldn't open that studio. Please try again.", { error: true }); return; }
    enterSession(d as Session);
  }

  async function answer(inv: StudioInvite, accept: boolean) {
    setBusy(inv.userId);
    const r = await apiFetch(`${API}/auth/my-invites/${inv.userId}/${accept ? "accept" : "decline"}`, { method: "POST" }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    setBusy(null);
    if (!r?.ok) { notify(d?.message || "Couldn't answer the invite.", { error: true }); refresh(); return; }
    notify(accept ? `You joined ${inv.name}. Tap it to open.` : `Invite from ${inv.name} declined`);
    refresh();
  }

  async function create() {
    const name = newName.trim();
    if (name.length < 2) { notify("Type your new studio's name.", { error: true }); return; }
    setMaking("saving");
    const r = await apiFetch(`${API}/auth/studios`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyName: name }),
    }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    if (!r?.ok) { setMaking("form"); notify(Array.isArray(d?.message) ? d.message[0] : d?.message || "Couldn't create the studio. Please try again.", { error: true }); return; }
    enterSession(d as Session);
  }

  const card = (
    <span className={cn("flex items-center rounded-xl bg-[#F7F5FB] border border-[#F1EFF6] text-left w-full",
      compact ? "p-1.5 justify-center" : "gap-2.5 p-2", canOpen && "hover:border-[#CFC2F8] transition-colors")}>
      <span className="relative">
        <StudioLogo url={shownLogo} name={shownName} size={32} className="rounded-lg" />
        {invites > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#7D5CEF] ring-2 ring-white" aria-hidden />}
      </span>
      {!compact && (
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-[#17151F] truncate leading-tight">{shownName}</span>
          <span className="block text-xs text-[#6B6680] leading-tight mt-0.5 truncate">
            {invites > 0 ? `${invites} invite${invites > 1 ? "s" : ""} waiting` : others ? "Switch studio" : sub || "Your studios"}
          </span>
        </span>
      )}
      {!compact && canOpen && <ChevronsUpDown className="w-4 h-4 text-[#8A8599] flex-shrink-0" />}
    </span>
  );

  if (!canOpen) return card;

  return (
    <>
      <button type="button" onClick={() => { onOpen?.(); setOpen(true); }} title={compact ? `${shownName} — switch studio` : undefined}
        aria-haspopup="dialog" aria-label={`${shownName}. Switch studio`} className="w-full rounded-xl">
        {card}
      </button>
      {open && mine && createPortal(
        <>
          <div className="sp-backdrop z-[80]" onClick={() => !busy && setOpen(false)} />
          <div className="fixed inset-0 z-[81] flex items-end sm:items-center justify-center sm:p-4 pointer-events-none">
            <div role="dialog" aria-modal="true" aria-labelledby="studios-title"
              className="sp-modal pointer-events-auto w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-5 sm:p-6 rounded-b-none sm:rounded-b-[28px] pb-[max(env(safe-area-inset-bottom),20px)]">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 id="studios-title" className="text-lg font-bold text-[#17151F]">Your studios</h2>
                  <p className="text-[13px] text-[#6B6680]">One login for all of them. Each studio sees only its own work.</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA] flex-shrink-0"><X className="w-4 h-4" /></button>
              </div>
              <StudioList studios={mine.studios} currentUserId={mine.currentUserId} busyId={busy} onPick={pick} />
              <InviteList invites={mine.invites} busyId={busy} onAnswer={answer} />
              <div className="mt-4 pt-4 border-t border-[#F1EFF6]">
                {making === "" ? (
                  <button type="button" onClick={() => setMaking("form")}
                    className="w-full h-12 rounded-2xl border-2 border-dashed border-[#DCD3F7] text-[#5B3FD0] text-[14px] font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#F7F4FE] transition-colors">
                    <Plus className="w-4 h-4" />Create a new studio
                  </button>
                ) : (
                  <form className="sp-pop-in" onSubmit={e => { e.preventDefault(); void create(); }}>
                    <label htmlFor="new-studio" className="block text-[13px] font-semibold text-[#17151F]">New studio name</label>
                    <p className="text-[12.5px] text-[#6B6680] mt-0.5">You are its owner. Same login and password; it starts empty with its own 14-day trial.</p>
                    <input id="new-studio" autoFocus value={newName} onChange={e => setNewName(e.target.value)} maxLength={120} placeholder="e.g. Studio name"
                      className="mt-2 w-full h-11 px-3.5 rounded-xl bg-[#F5F3FA] border border-transparent focus:bg-white focus:border-[#7D5CEF] outline-none text-[15px] text-[#17151F]" />
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => { setMaking(""); setNewName(""); }} disabled={making === "saving"}
                        className="h-11 px-4 rounded-full bg-[#F5F3FA] text-[#4A4658] text-[14px] font-semibold">Cancel</button>
                      <button type="submit" disabled={making === "saving" || newName.trim().length < 2}
                        className="flex-1 h-11 rounded-full bg-[#7D5CEF] text-white text-[14px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
                        {making === "saving" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Create studio
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
