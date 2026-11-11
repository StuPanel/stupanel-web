"use client";


import { Tile, type TileColor } from "@/components/ui/apple";
import { Field, FormDrawer, FormGroup, MoreDetails, SwitchRow, inputCls } from "@/components/ui/form-kit";
import { notify } from "@/components/feedback";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useRef } from "react";
import { Plus, X, Loader2, AlertTriangle, Trash2, Eye, EyeOff, Camera, Video, Image, Film, KeyRound, CheckCircle2, XCircle, Navigation, Briefcase, Tag, Check, BadgeCheck, Zap, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { RateEditor, SetupEditor, firstLine, gearHasRent, itemsToSetup, linesToRates, ratesToLines, setupToItems, type RateLine, type SavedGear, type SavedRate, type SetupItem } from "./rate-card";
import { currencySymbol, currencyPad } from "@/lib/format";
import { useAuth } from "@/context/auth-context";
import { AREAS } from "@/lib/access";


// ─── Constants ────────────────────────────────────────────────────────────────
export const DEFAULT_ROLES = [
  { id: "photographer",    label: "Photographer",    icon: Camera,      color: "bg-[#E6F0FB] text-[#1F5C99]", tile: "blue" },
  { id: "cinematographer", label: "Cinematographer", icon: Video,       color: "bg-[#EEE8FD] text-[#5B3FD0]", tile: "deep" },
  { id: "photo_editor",    label: "Photo Editor",    icon: Image,       color: "bg-[#E9F5EF] text-[#1F8A5B]", tile: "green" },
  { id: "video_editor",    label: "Video Editor",    icon: Film,        color: "bg-[#FBF2FA] text-[#9E3A8C]", tile: "orchid" },
  { id: "drone_pilot",     label: "Drone Pilot",     icon: Navigation,  color: "bg-[#E0F2F1] text-[#126B66]", tile: "teal" },
  { id: "assistant",       label: "Assistant",       icon: Briefcase,   color: "bg-[#EEEDF2] text-[#4A4658]", tile: "ink" },
];

export function roleConfig(id: string, customRoles: string[] = []) {
  const def = DEFAULT_ROLES.find(r => r.id === id);
  if (def) return def;
  if (customRoles.includes(id)) return { id, label: id, icon: Tag, color: "bg-[#EEE8FD] text-[#5B3FD0]", tile: "violet" };
  return { id, label: id, icon: Tag, color: "bg-[#EEEDF2] text-[#4A4658]", tile: "ink" };
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Member {
  id: string; memberId: string; username: string | null;
  email: string; memberType?: string;
  firstName: string; lastName?: string; phone?: string;
  bio?: string; memberRoles: string[]; isActive: boolean;
  /** The member's own photo (they add it in their panel). */
  avatarUrl?: string | null;
  payRate?: number | null; payRateType?: string | null;
  roleRates?: { roleId: string; rate: number; rateType: string; withSetup?: number; workType?: string; label?: string; note?: string }[];
  setup?: SavedGear[];
  role?: string;
  /** Manager only: parts of the studio they can use. */
  managerAreas?: string[];
  createdAt: string;
}


// ─── Member Drawer ─────────────────────────────────────────────────────────────
export function MemberDrawer({ open, onClose, onSaved, editing, customRoles, onCustomRolesChange }: {
  open: boolean; onClose: () => void; onSaved: () => void; editing?: Member | null;
  customRoles: string[]; onCustomRolesChange: (roles: string[]) => void;
}) {
  const isEdit = !!editing;
  const blank = { firstName: "", lastName: "", phone: "", email: "", username: "", password: "", bio: "", memberRoles: [] as string[], payRate: "", payRateType: "per_program" };
  const [form, setForm] = useState(blank);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unCheck, setUnCheck] = useState<{ checking: boolean; available: boolean | null; suggestions: string[] }>({ checking: false, available: null, suggestions: [] });
  const unTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [newRoleInput, setNewRoleInput] = useState("");
  const [addingRole, setAddingRole] = useState(false);
  const [showRoleInput, setShowRoleInput] = useState(false);
  const [memberType, setMemberType] = useState<"staff" | "freelancer">("staff");
  const [userTouched, setUserTouched] = useState(false);
  const [defaultUnit, setDefaultUnit] = useState("per_program");
  const [workTypes, setWorkTypes] = useState<{ id: string; name: string }[]>([]);
  const [studioRates, setStudioRates] = useState<SavedRate[]>([]);
  const [lines, setLines] = useState<RateLine[]>([]);
  const [setup, setSetup] = useState<SetupItem[]>([]);
  const [tab, setTab] = useState<"who" | "pay" | "setup" | "login">("who");
  const { user: me } = useAuth();
  const isOwner = me?.role === "owner";
  const [access, setAccess] = useState<{ manager: boolean; areas: string[] }>({ manager: false, areas: [] });

  // Rates follow Settings → Team & Pay (per shift or per program); program types from Settings → Work types
  useEffect(() => {
    if (!open) return;
    apiFetch(`${API}/companies/settings`).then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.teamPay?.mode) setDefaultUnit(d.teamPay.mode);
        if (Array.isArray(d?.workTypes)) setWorkTypes(d.workTypes.filter((w: { active?: boolean }) => w.active !== false));
        if (Array.isArray(d?.studioRates)) setStudioRates(d.studioRates);
      }).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setUnCheck({ checking: false, available: null, suggestions: [] });
    setShowRoleInput(false);
    setNewRoleInput("");
    setMemberType(editing?.memberType === "freelancer" ? "freelancer" : "staff");
    setUserTouched(false);
    setTab("who");
    setAccess({ manager: editing?.role === "manager", areas: editing?.managerAreas ?? [] });
    setLines(ratesToLines(editing?.roleRates));
    setSetup(setupToItems(editing?.setup));
    if (editing) {
      const realEmail = editing.email?.includes(".internal") ? "" : (editing.email ?? "");
      setForm({ firstName: editing.firstName, lastName: editing.lastName ?? "",
        phone: editing.phone ?? "", email: realEmail, username: editing.username ?? "",
        password: "", bio: editing.bio ?? "", memberRoles: editing.memberRoles,
        payRate: editing.payRate ? String(editing.payRate) : "",
        payRateType: editing.payRateType ?? "per_program" });
    } else {
      setForm(blank);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  async function handleAddCustomRole() {
    const name = newRoleInput.trim();
    if (!name) return;
    setAddingRole(true);
    try {
      const r = await apiFetch(`${API}/team/custom-roles`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message || "Failed to add role"); return; }
      onCustomRolesChange(d);
      setNewRoleInput("");
      setShowRoleInput(false);
    } catch { setError("Something went wrong."); }
    finally { setAddingRole(false); }
  }

  function handleUsernameChange(val: string) {
    setForm(p => ({ ...p, username: val }));
    clearTimeout(unTimer.current);
    if (!val.trim() || (isEdit && val === editing?.username)) {
      setUnCheck({ checking: false, available: null, suggestions: [] });
      return;
    }
    setUnCheck(p => ({ ...p, checking: true, available: null }));
    unTimer.current = setTimeout(async () => {
      try {
        const qs = isEdit ? `?username=${encodeURIComponent(val)}&excludeId=${editing!.id}` : `?username=${encodeURIComponent(val)}`;
        const r = await apiFetch(`${API}/team/check-username${qs}`, { headers: { "Content-Type": "application/json" } });
        const d = await r.json();
        setUnCheck({ checking: false, available: d.available, suggestions: d.suggestions ?? [] });
      } catch { setUnCheck({ checking: false, available: null, suggestions: [] }); }
    }, 500);
  }

  function set(k: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));
  }

  function toggleRole(rid: string) {
    const hasRole = form.memberRoles.includes(rid);
    setForm(p => ({ ...p, memberRoles: hasRole ? p.memberRoles.filter(r => r !== rid) : [...p.memberRoles, rid] }));
    setLines(ls => hasRole ? ls.filter(l => l.roleId !== rid) : ls.some(l => l.roleId === rid) ? ls : [...ls, firstLine(rid, defaultUnit)]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const freelancer = memberType === "freelancer";
    const fail = (msg: string, t: typeof tab) => { setError(msg); setTab(t); };
    if (!form.firstName.trim()) return fail("Please write their name.", "who");
    if (freelancer && !form.phone.trim()) return fail("A freelancer needs a phone number — it's their ID.", "who");
    if (lines.some(l => l.unit === "custom" && !l.label.trim() && (l.rate || l.withSetup))) return fail("Please name each \"Other\" price.", "pay");
    if (setup.some(g => !g.name.trim() && gearHasRent(g))) return fail("Please write a name for each piece of gear.", "setup");
    if (!freelancer) {
      if (!form.username.trim()) return fail("Please choose a username for their login.", "login");
      if (unCheck.available === false) return fail("That username is taken — pick another.", "login");
      if (!isEdit && form.password.length < 6) return fail("Password must be at least 6 characters.", "login");
    }
    setError(""); setLoading(true);
    try {
      const payRateVal = form.payRate ? parseFloat(form.payRate) : undefined;
      const cleanRoleRates = linesToRates(lines, form.memberRoles);
      const cleanSetup = itemsToSetup(setup);
      const base = {
        firstName: form.firstName, lastName: form.lastName || undefined,
        phone: form.phone || undefined, email: form.email || undefined,
        bio: form.bio || undefined, memberRoles: form.memberRoles,
        payRate: payRateVal, payRateType: payRateVal ? form.payRateType : undefined,
        roleRates: cleanRoleRates,
        setup: cleanSetup,
      };
      const body = isEdit
        ? { ...base, username: freelancer ? undefined : (form.username || undefined),
            // The member edits their own gear too — tell the server what we loaded, so their changes since are kept.
            setupSeen: (editing?.setup ?? []).map(g => g.id).filter(Boolean) }
        : freelancer
          ? { ...base, memberType: "freelancer" }
          : { ...base, memberType: "staff", username: form.username, password: form.password };
      const url = isEdit ? `${API}/team/${editing!.id}` : `${API}/team`;
      const r = await apiFetch(url, { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { const msg = d.message; setError(Array.isArray(msg) ? msg[0] : (msg || "Failed to save.")); return; }
      // Manager on/off + areas (owner only, staff with a login only)
      const wasManager = editing?.role === "manager";
      const areasChanged = JSON.stringify([...(editing?.managerAreas ?? [])].sort()) !== JSON.stringify([...access.areas].sort());
      if (isOwner && !freelancer && (access.manager !== wasManager || (access.manager && areasChanged))) {
        const ar = await apiFetch(`${API}/team/${isEdit ? editing!.id : d.id}/access`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manager: access.manager, areas: access.manager ? access.areas : [] }),
        });
        if (!ar.ok) { const ad = await ar.json().catch(() => ({})); setError(Array.isArray(ad.message) ? ad.message[0] : ad.message || "Saved, but couldn't change manager access."); onSaved(); return; }
      }
      notify(isEdit ? "Saved" : freelancer ? `${form.firstName} added as a freelancer` : `${form.firstName} added to the team`);
      onSaved(); onClose();
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  }

  const allRoles = [...DEFAULT_ROLES, ...customRoles.filter(cr => !DEFAULT_ROLES.some(d => d.id === cr)).map(cr => roleConfig(cr, customRoles))];
  const isStaff = memberType === "staff";
  const pickedRoles = form.memberRoles.map(rid => { const rc = roleConfig(rid, customRoles); return { id: rid, label: rc.label, icon: rc.icon, tile: rc.tile }; });
  const priced = lines.filter(l => form.memberRoles.includes(l.roleId) && (l.rate || l.withSetup)).length;
  const gearCount = setup.filter(g => g.name.trim()).length;
  const TABS = [
    { v: "who" as const, l: "Who" },
    { v: "pay" as const, l: "Rates", n: priced },
    { v: "setup" as const, l: "Setup", n: gearCount },
    ...(isStaff ? [{ v: "login" as const, l: isOwner ? "Login & access" : "Login" }] : []),
  ];

  return (
    <FormDrawer open={open} onClose={onClose} icon={UserCog} color="blue"
      title={isEdit ? "Edit team member" : "New team member"}
      sub={isEdit ? `${editing!.firstName} ${editing!.lastName ?? ""}`.trim() : "Photographers, editors, drone — permanent or freelance."}
      footer={<>
        <button type="button" onClick={onClose} className="flex-1 h-12 rounded-full bg-[#EEEBF4] text-[15px] font-semibold text-[#17151F] hover:bg-[#E4E0EC]">Cancel</button>
        <button type="submit" form="member-form" disabled={loading}
          className="flex-[1.4] h-12 rounded-full bg-[#7D5CEF] hover:bg-[#6C4BE0] disabled:opacity-60 text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : isEdit ? "Save changes" : "Add to team"}
        </button>
      </>}>
      <form id="member-form" onSubmit={submit} noValidate>
        {error && <div role="alert" className="mb-4 px-4 py-3 rounded-[14px] bg-[#FDECEF] text-[#8A2340] text-sm font-medium">{error}</div>}

        {!isEdit && (
          <div role="radiogroup" aria-label="Type of member" className="grid grid-cols-2 gap-3 mb-5">
            {([
              { v: "staff", icon: BadgeCheck, title: "Team staff", text: "Works with you regularly. Can log in to see their programs." },
              { v: "freelancer", icon: Zap, title: "Freelancer", text: "Hired per program. No login — phone number is their ID." },
            ] as const).map(o => {
              const on = memberType === o.v;
              return (
                <button key={o.v} type="button" role="radio" aria-checked={on} onClick={() => setMemberType(o.v)}
                  className={cn("text-left p-4 rounded-[20px] bg-white transition-all shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]",
                    on ? "ring-2 ring-[#7D5CEF]" : "hover:ring-1 hover:ring-[#E4E0EC]")}>
                  <div className="flex items-center justify-between">
                    <Tile icon={o.icon} color={o.v === "staff" ? "blue" : "orchid"} size={32} />
                    <span className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center", on ? "border-[#7D5CEF] bg-[#7D5CEF]" : "border-[#D8D3E3]")}>
                      {on && <Check className="w-3 h-3 text-white" />}
                    </span>
                  </div>
                  <p className="mt-3 text-[15px] font-bold text-[#17151F]">{o.title}</p>
                  <p className="mt-0.5 text-xs text-[#6B6680] leading-snug">{o.text}</p>
                </button>
              );
            })}
          </div>
        )}

        <div role="tablist" aria-label="Sections" className="sticky top-0 z-10 -mx-1 px-1 pt-1 pb-3 bg-[#F5F3FA]">
          <div className="grid gap-1 p-1 rounded-[14px] bg-[#E9E6F0]" style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}>
            {TABS.map(t => (
              <button key={t.v} type="button" role="tab" aria-selected={tab === t.v} onClick={() => setTab(t.v)}
                className={cn("h-9 rounded-[11px] text-[13px] font-semibold whitespace-nowrap transition-all inline-flex items-center justify-center gap-1.5",
                  tab === t.v ? "bg-white text-[#17151F] shadow-[0_1px_3px_rgba(22,18,40,.12)]" : "text-[#6B6680] hover:text-[#17151F]")}>
                {t.l}{"n" in t && t.n ? <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#7D5CEF] text-white text-[11px] font-bold inline-flex items-center justify-center">{t.n}</span> : null}
              </button>
            ))}
          </div>
        </div>

        {tab === "who" && <>
        <FormGroup title="Who">
          <Field label="Name" required>
            {id => (
              <div className="grid grid-cols-2 gap-2">
                <input id={id} className={inputCls} placeholder="First name" value={form.firstName} autoFocus={!isEdit} aria-label="First name"
                  onChange={e => {
                    const v = e.target.value;
                    setForm(p => ({ ...p, firstName: v }));
                    if (!isEdit && !userTouched) handleUsernameChange(v.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
                  }} />
                <input className={inputCls} placeholder="Last name" value={form.lastName} onChange={set("lastName")} aria-label="Last name" />
              </div>
            )}
          </Field>
          <Field label="Phone / WhatsApp" required={!isStaff} hint={!isStaff ? "Used to send them program details on WhatsApp." : undefined}>
            {id => <input id={id} className={inputCls} type="tel" inputMode="tel" placeholder="Phone number" value={form.phone} onChange={set("phone")} />}
          </Field>
          <Field label="Email" hint="Optional — they get program reminder emails here.">
            {id => <input id={id} className={inputCls} type="email" inputMode="email" placeholder="name@email.com" value={form.email} onChange={set("email")} />}
          </Field>
        </FormGroup>

        <FormGroup title="What they do" note={form.memberRoles.length ? <>Set a price for each in <button type="button" onClick={() => setTab("pay")} className="font-semibold text-[#5B3FD0]">Rates</button>.</> : "Pick every kind of work they can do."}>
          <div className="px-4 py-3.5">
            <div className="flex flex-wrap gap-2">
              {allRoles.map(r => {
                const on = form.memberRoles.includes(r.id);
                const Icon = r.icon;
                return (
                  <button key={r.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggleRole(r.id)}
                    className={cn("inline-flex items-center gap-2 h-10 pl-1.5 pr-3.5 rounded-full text-[13px] font-semibold transition-all",
                      on ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]")}>
                    <Tile icon={Icon} color={r.tile as TileColor} size={28} />{r.label}
                  </button>
                );
              })}
              {showRoleInput ? (
                <div className="flex items-center gap-1.5 w-full mt-1">
                  <input autoFocus value={newRoleInput} onChange={e => setNewRoleInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddCustomRole(); } }}
                    placeholder="e.g. Makeup artist" className={inputCls + " h-10"} />
                  <button type="button" onClick={handleAddCustomRole} disabled={addingRole || !newRoleInput.trim()}
                    className="h-10 px-4 rounded-full bg-[#17151F] text-white text-[13px] font-semibold disabled:opacity-50 flex-shrink-0">
                    {addingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                  </button>
                  <button type="button" aria-label="Cancel" onClick={() => { setShowRoleInput(false); setNewRoleInput(""); }}
                    className="w-10 h-10 rounded-full bg-[#F5F3FA] text-[#6B6680] flex items-center justify-center flex-shrink-0"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowRoleInput(true)}
                  className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full border border-dashed border-[#D8D3E3] text-[13px] font-semibold text-[#5B3FD0] hover:bg-[#F5F3FA]">
                  <Plus className="w-3.5 h-3.5" />Other work
                </button>
              )}
            </div>
          </div>
        </FormGroup>

        <MoreDetails sub={form.bio ? "1 filled" : "Note about this person"} defaultOpen={!!form.bio}>
          <FormGroup>
            <Field label="Note" hint="Only you and managers see this.">
              {id => <textarea id={id} rows={3} value={form.bio} onChange={set("bio")} placeholder="Best at, availability, anything to remember…"
                className={inputCls + " h-auto py-2.5 resize-none"} />}
            </Field>
          </FormGroup>
        </MoreDetails>
        </>}

        {tab === "pay" && <>
        <FormGroup title="Prices" note={form.memberRoles.length
          ? <>Pick <strong>what the price is for</strong> (shift, day, program…) and the <strong>program type</strong> — each pair keeps its own price. <strong>Leave a box empty to use the studio price</strong> (shown in grey, set in Settings → Team &amp; Pay). Prices fill in by themselves when you put them on a program — you can still change them there.</>
          : undefined}>
          <RateEditor roles={pickedRoles} lines={lines} onChange={setLines} workTypes={workTypes} fallback={studioRates} />
          {!form.memberRoles.length && (
            <div className="px-4 pb-4"><button type="button" onClick={() => setTab("who")} className="text-[13px] font-semibold text-[#5B3FD0]">← Pick what they do</button></div>
          )}
        </FormGroup>
        {isStaff && (
          <FormGroup title="Monthly salary">
            <SwitchRow label="Pays a monthly salary" hint="On top of, or instead of, the prices above"
              on={form.payRateType === "monthly"} onChange={v => setForm(p => ({ ...p, payRateType: v ? "monthly" : "per_program", payRate: v ? p.payRate : "" }))} />
            {form.payRateType === "monthly" && (
              <Field label="Salary per month">
                {id => (
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6680] text-sm">{currencySymbol().trim()}</span>
                    <input style={{ paddingLeft: currencyPad() }} id={id} type="number" inputMode="numeric" min="0" step="500" value={form.payRate} onChange={set("payRate")}
                      placeholder="0" className={inputCls + " pl-8 tabular-nums"} />
                  </div>
                )}
              </Field>
            )}
          </FormGroup>
        )}
        </>}

        {tab === "setup" && <SetupEditor items={setup} onChange={setSetup} />}

        {tab === "login" && isStaff && (
          <FormGroup title="App login" note={isEdit ? "To change the password, use Reset password in the member menu." : "Share these with them — they can log in at app.stupanel.com."}>
            <Field label="Username" required>
              {id => (
                <>
                  <div className="relative">
                    <input id={id} className={cn(inputCls, "pr-10", unCheck.available === false && "border-[#C2304F] bg-[#FDECEF]")}
                      value={form.username} onChange={e => { setUserTouched(true); handleUsernameChange(e.target.value.toLowerCase().replace(/\s+/g, "_")); }} placeholder="rakib_photo" autoComplete="off" />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {unCheck.checking && <Loader2 className="w-4 h-4 animate-spin text-[#A29DB3]" />}
                      {!unCheck.checking && unCheck.available === true && <CheckCircle2 className="w-4 h-4 text-[#1F8A5B]" />}
                      {!unCheck.checking && unCheck.available === false && <XCircle className="w-4 h-4 text-[#C2304F]" />}
                    </span>
                  </div>
                  {!unCheck.checking && unCheck.available === false && (
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-[#C2304F]">Taken. Try:</span>
                      {unCheck.suggestions.map(sg => (
                        <button key={sg} type="button" onClick={() => handleUsernameChange(sg)}
                          className="h-7 px-2.5 rounded-full bg-[#EEE8FD] text-xs font-semibold text-[#5B3FD0]">{sg}</button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Field>
            {!isEdit && (
              <Field label="Password" required hint="At least 6 characters.">
                {id => (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input id={id} type={showPass ? "text" : "password"} value={form.password} onChange={set("password")}
                        placeholder="Min. 6 characters" className={inputCls + " pr-10"} autoComplete="new-password" />
                      <button type="button" aria-label={showPass ? "Hide password" : "Show password"} onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6680]">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button type="button" onClick={() => { setForm(p => ({ ...p, password: makePassword() })); setShowPass(true); }}
                      className="h-11 px-4 rounded-[12px] bg-[#EEE8FD] text-[13px] font-semibold text-[#5B3FD0] flex-shrink-0">Make one</button>
                  </div>
                )}
              </Field>
            )}
          </FormGroup>
        )}

        {tab === "login" && isStaff && isOwner && (
          <FormGroup title="Manager" note={access.manager ? "They log in to the studio app and see only what you tick. Billing and Settings stay yours." : "Turn on to let them help run the studio."}>
            <SwitchRow label="Make manager" hint="Gives access to parts of the studio app" on={access.manager}
              onChange={v => setAccess(a => ({ manager: v, areas: v && !a.areas.length ? ["programs", "clients"] : a.areas }))} />
            {access.manager && (
              <div className="px-2 pb-2">
                {AREAS.map(ar => {
                  const on = access.areas.includes(ar.key);
                  return (
                    <button key={ar.key} type="button" role="checkbox" aria-checked={on}
                      onClick={() => setAccess(a => ({ ...a, areas: on ? a.areas.filter(x => x !== ar.key) : [...a.areas, ar.key] }))}
                      className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-[12px] hover:bg-[#F5F3FA] text-left">
                      <span className={cn("w-5 h-5 rounded-[6px] border-2 flex items-center justify-center flex-shrink-0", on ? "bg-[#7D5CEF] border-[#7D5CEF]" : "border-[#D8D3E3]")}>
                        {on && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-medium text-[#17151F]">{ar.label}</span>
                        <span className="block text-xs text-[#6B6680]">{ar.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </FormGroup>
        )}

      </form>
    </FormDrawer>
  );
}

/** Easy-to-read temporary password: word + 4 digits. */
function makePassword() {
  const words = ["studio", "camera", "frame", "lens", "photo", "shoot", "light"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}${n}`;
}

export function ResetPassDialog({ member, onClose, onDone }: { member: Member | null; onClose: () => void; onDone: () => void }) {
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (member) { setPass(""); setError(""); } }, [member]);

  if (!member) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pass.length < 6) { setError("Minimum 6 characters."); return; }
    setError(""); setLoading(true);
    const r = await apiFetch(`${API}/team/${member!.id}/reset-password`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: pass }),
    });
    const d = await r.json();
    if (!r.ok) { setError(d.message || "Failed."); setLoading(false); return; }
    onDone(); onClose(); setLoading(false);
  }

  return (
    <>
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="sp-modal w-full max-w-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-[#FFF3E0] flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-[#B36B00]" />
            </div>
            <div>
              <h3 className="font-bold text-[#17151F]">Reset Password</h3>
              <p className="text-xs text-[#8A8599]">{member.firstName} · @{member.username}</p>
            </div>
          </div>
          {error && <div className="mb-3 text-sm text-[#C2304F] bg-[#FEF5F7] px-3 py-2 rounded-lg">{error}</div>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-[#4A4658]">New Password</Label>
              <div className="relative">
                <Input type={showPass ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)}
                  placeholder="Min. 6 characters" className="pr-10 h-11 border-[#E4E0EC]" autoFocus />
                <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8599]">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" type="button" onClick={onClose} className="flex-1 h-11 border-[#E4E0EC]">Cancel</Button>
              <Button type="submit" disabled={loading} className="flex-1 h-11 bg-[#D88A12] hover:bg-[#B36B00] text-white gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}Reset
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── Delete Dialog ─────────────────────────────────────────────────────────────
export function DeleteDialog({ member, onClose, onDeleted }: { member: Member | null; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false);
  if (!member) return null;
  async function doDelete() {
    setLoading(true);
    await apiFetch(`${API}/team/${member!.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } }).catch(() => {});
    onDeleted(); onClose(); setLoading(false);
  }
  return (
    <>
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="sp-modal w-full max-w-sm p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-[#FDECEF] flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-[#C2304F]" />
          </div>
          <h3 className="font-bold text-[#17151F] text-lg">Remove Member?</h3>
          <p className="text-[#6B6680] text-sm mt-2"><span className="font-semibold text-[#33303F]">{member.firstName}</span> (@{member.username}) will be removed.</p>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-[#E4E0EC]">Cancel</Button>
            <Button onClick={doDelete} disabled={loading} className="flex-1 h-11 bg-[#C2304F] hover:bg-[#C2304F] text-white gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Remove
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

