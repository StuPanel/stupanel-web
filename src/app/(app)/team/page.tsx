"use client";

import { createPortal } from "react-dom";

import { UserCog as HeaderIcon } from "lucide-react";
import { Chips, EmptyState, Group, MainButton, PageHeader, RowsSkeleton, SearchField, Tile, type TileColor } from "@/components/ui/apple";
import { Field, FormDrawer, FormGroup, MoreDetails, SwitchRow, inputCls } from "@/components/ui/form-kit";
import { notify } from "@/components/feedback";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, X, Loader2, AlertTriangle, Trash2, Edit3, MoreHorizontal, MessageCircle,
  Eye, EyeOff, Camera, Video, Image, Film, KeyRound, UserCheck,
  UserX, Shield, CheckCircle2, XCircle, Navigation, Briefcase, Tag, Search, Check, BadgeCheck, Zap, UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { ProfileDrawer } from "./_components/profile-drawer";
import { RateEditor, SetupEditor, firstLine, linesToRates, ratesToLines, uid, unitLabel, type RateLine, type SavedRate, type SetupItem } from "./_components/rate-card";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/context/auth-context";
import { AREAS } from "@/lib/access";


// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_ROLES = [
  { id: "photographer",    label: "Photographer",    icon: Camera,      color: "bg-[#E6F0FB] text-[#1F5C99]", tile: "blue" },
  { id: "cinematographer", label: "Cinematographer", icon: Video,       color: "bg-[#EEE8FD] text-[#5B3FD0]", tile: "deep" },
  { id: "photo_editor",    label: "Photo Editor",    icon: Image,       color: "bg-[#E9F5EF] text-[#1F8A5B]", tile: "green" },
  { id: "video_editor",    label: "Video Editor",    icon: Film,        color: "bg-[#FBF2FA] text-[#9E3A8C]", tile: "orchid" },
  { id: "drone_pilot",     label: "Drone Pilot",     icon: Navigation,  color: "bg-[#E0F2F1] text-[#126B66]", tile: "teal" },
  { id: "assistant",       label: "Assistant",       icon: Briefcase,   color: "bg-[#EEEDF2] text-[#4A4658]", tile: "ink" },
];

function roleConfig(id: string, customRoles: string[] = []) {
  const def = DEFAULT_ROLES.find(r => r.id === id);
  if (def) return def;
  if (customRoles.includes(id)) return { id, label: id, icon: Tag, color: "bg-[#EEE8FD] text-[#5B3FD0]", tile: "violet" };
  return { id, label: id, icon: Tag, color: "bg-[#EEEDF2] text-[#4A4658]", tile: "ink" };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Member {
  id: string; memberId: string; username: string | null;
  email: string; memberType?: string;
  firstName: string; lastName?: string; phone?: string;
  bio?: string; memberRoles: string[]; isActive: boolean;
  payRate?: number | null; payRateType?: string | null;
  roleRates?: { roleId: string; rate: number; rateType: string; withSetup?: number; workType?: string; label?: string; note?: string }[];
  setup?: { id: string; category: string; name: string; rent: number; rentUnit: string }[];
  role?: string;
  /** Manager only: parts of the studio they can use. */
  managerAreas?: string[];
  createdAt: string;
}


// ─── Member Drawer ─────────────────────────────────────────────────────────────
function MemberDrawer({ open, onClose, onSaved, editing, customRoles, onCustomRolesChange }: {
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
    setSetup(Array.isArray(editing?.setup) ? editing!.setup!.map(g => ({ id: g.id || uid(), category: g.category, name: g.name, rent: g.rent ? String(g.rent) : "", rentUnit: g.rentUnit || "per_shift" })) : []);
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
    if (setup.some(g => !g.name.trim() && g.rent)) return fail("Please write a name for each piece of gear.", "setup");
    if (!freelancer) {
      if (!form.username.trim()) return fail("Please choose a username for their login.", "login");
      if (unCheck.available === false) return fail("That username is taken — pick another.", "login");
      if (!isEdit && form.password.length < 6) return fail("Password must be at least 6 characters.", "login");
    }
    setError(""); setLoading(true);
    try {
      const payRateVal = form.payRate ? parseFloat(form.payRate) : undefined;
      const cleanRoleRates = linesToRates(lines, form.memberRoles);
      const cleanSetup = setup.filter(g => g.name.trim()).map(g => ({ id: g.id, category: g.category, name: g.name.trim(), rent: parseFloat(g.rent) || 0, rentUnit: g.rentUnit }));
      const base = {
        firstName: form.firstName, lastName: form.lastName || undefined,
        phone: form.phone || undefined, email: form.email || undefined,
        bio: form.bio || undefined, memberRoles: form.memberRoles,
        payRate: payRateVal, payRateType: payRateVal ? form.payRateType : undefined,
        roleRates: cleanRoleRates,
        setup: cleanSetup,
      };
      const body = isEdit
        ? { ...base, username: freelancer ? undefined : (form.username || undefined) }
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
            {id => <input id={id} className={inputCls} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={form.phone} onChange={set("phone")} />}
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
          ? <>Put a price in <strong>Work only</strong> (they use someone else&apos;s gear) and/or <strong>With own setup</strong>. Use &quot;All programs&quot; or pick a program type for a different price. <strong>Leave a box empty to use the studio price</strong> (shown in grey, set in Settings → Team &amp; Pay). These fill in by themselves when you put them on a program — you can still change them there.</>
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
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6680] text-sm">৳</span>
                    <input id={id} type="number" inputMode="numeric" min="0" step="500" value={form.payRate} onChange={set("payRate")}
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

function ResetPassDialog({ member, onClose, onDone }: { member: Member | null; onClose: () => void; onDone: () => void }) {
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
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Reset Password</h3>
              <p className="text-xs text-slate-400">{member.firstName} · @{member.username}</p>
            </div>
          </div>
          {error && <div className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">New Password</Label>
              <div className="relative">
                <Input type={showPass ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)}
                  placeholder="Min. 6 characters" className="pr-10 h-11 border-slate-200" autoFocus />
                <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" type="button" onClick={onClose} className="flex-1 h-11 border-slate-200">Cancel</Button>
              <Button type="submit" disabled={loading} className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 text-white gap-2">
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
function DeleteDialog({ member, onClose, onDeleted }: { member: Member | null; onClose: () => void; onDeleted: () => void }) {
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
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Remove Member?</h3>
          <p className="text-slate-500 text-sm mt-2"><span className="font-semibold text-slate-700">{member.firstName}</span> (@{member.username}) will be removed.</p>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200">Cancel</Button>
            <Button onClick={doDelete} disabled={loading} className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Remove
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Action Menu ───────────────────────────────────────────────────────────────
function ActionMenu({ member, onEdit, onReset, onToggle, onDelete }: {
  member: Member; onEdit: () => void; onReset: () => void; onToggle: () => void; onDelete: () => void;
}) {
  // The list card clips its content (rounded corners), so the menu is drawn on
  // top of the page at the button's spot, and opens upward if there's no room below.
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const isOwner = useAuth().user?.role === "owner";
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const open = !!pos;
  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) setPos(null);
    }
    const shut = () => setPos(null);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", shut, true);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", shut, true);
      window.removeEventListener("resize", shut);
    };
  }, [open]);
  function toggle() {
    if (open) { setPos(null); return; }
    const r = btn.current!.getBoundingClientRect();
    const MENU_H = 200, MENU_W = 200;
    const up = window.innerHeight - r.bottom < MENU_H + 12 && r.top > MENU_H + 12;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8)), up });
  }
  function act(fn: () => void) { fn(); setPos(null); }
  const item = "w-full flex items-center gap-2.5 px-3.5 h-10 rounded-[12px] text-sm text-left";
  return (
    <>
      <button ref={btn} onClick={toggle} aria-label="More" aria-haspopup="menu" aria-expanded={open} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#EEEBF4] text-[#6B6680]">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {pos && typeof document !== "undefined" && createPortal(
        <div ref={menu} role="menu" style={{ top: pos.top, left: pos.left, width: 200, transform: pos.up ? "translateY(-100%)" : undefined }}
          className="fixed z-[80] bg-white rounded-[16px] shadow-[0_2px_4px_rgba(22,18,40,.06),0_16px_32px_rgba(22,18,40,.14)] p-1">
          <button role="menuitem" onClick={() => act(onEdit)} className={cn(item, "text-[#17151F] hover:bg-[#F5F3FA]")}><Edit3 className="w-4 h-4 text-[#6B6680]" />Edit info</button>
          {isOwner && member.memberType !== "freelancer" && <button role="menuitem" onClick={() => act(onReset)} className={cn(item, "text-[#17151F] hover:bg-[#F5F3FA]")}><KeyRound className="w-4 h-4 text-[#6B6680]" />Reset password</button>}
          <button role="menuitem" onClick={() => act(onToggle)} className={cn(item, "hover:bg-[#F5F3FA]", member.isActive ? "text-[#B45309]" : "text-[#1F8A5B]")}>
            {member.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            {member.isActive ? "Deactivate" : "Activate"}
          </button>
          {isOwner && <>
            <div className="my-1 border-t border-[#EEEBF4]" />
            <button role="menuitem" onClick={() => act(onDelete)} className={cn(item, "text-[#C2304F] hover:bg-[#FDECEF]")}><Trash2 className="w-4 h-4" />Remove</button>
          </>}
        </div>,
        document.body,
      )}
    </>
  );
}

// ─── Member row (Apple style) ──────────────────────────────────────────────────
function rateLine(m: Member, customRoles: string[]) {
  const parts: string[] = [];
  if (m.payRateType === "monthly" && m.payRate) parts.push(`Salary ${formatCurrency(Number(m.payRate))}/month`);
  const rates = (m.roleRates ?? []).filter(r => (r.rate || r.withSetup) && !r.workType);
  for (const r of rates.slice(0, 2)) {
    const lbl = roleConfig(r.roleId, customRoles).label;
    const price = r.rate ? formatCurrency(Number(r.rate)) : formatCurrency(Number(r.withSetup));
    parts.push(`${lbl} ${price}${r.withSetup && r.rate ? ` (${formatCurrency(Number(r.withSetup))} with setup)` : r.withSetup && !r.rate ? " with setup" : ""} ${unitLabel(r.roleId, r.rateType, r.label).toLowerCase()}`);
  }
  const more = (m.roleRates ?? []).filter(r => r.rate || r.withSetup).length - Math.min(rates.length, 2);
  if (more > 0) parts.push(`+${more} more`);
  if (!parts.length && m.payRate) parts.push(`${formatCurrency(Number(m.payRate))}/${m.payRateType === "per_day" ? "day" : "program"}`);
  return parts.length ? parts.join(" · ") : null;
}

function MemberRow({ m, customRoles, onView, onEdit, onReset, onToggle, onDelete }: {
  m: Member; customRoles: string[];
  onView: () => void; onEdit: () => void; onReset: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const main = roleConfig(m.memberRoles[0] ?? "assistant", customRoles);
  const rates = rateLine(m, customRoles);
  const wa = m.phone ? `https://wa.me/${(d => d.startsWith("0") ? "88" + d : d)(m.phone.replace(/\D/g, ""))}` : null;
  return (
    <div role="button" tabIndex={0} onClick={onView} onKeyDown={e => { if (e.key === "Enter") onView(); }}
      className={cn("flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[72px] cursor-pointer hover:bg-[#F7F5FB] transition-colors focus:outline-none focus-visible:bg-[#F7F5FB]", !m.isActive && "opacity-60")}>
      <Tile icon={main.icon} color={main.tile} size={40} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#17151F] truncate flex items-center gap-2">
          {m.firstName} {m.lastName ?? ""}
          {m.memberType === "freelancer" && <span className="text-[11px] font-bold text-[#9E3A8C] bg-[#FBF2FA] px-1.5 py-0.5 rounded-full">Freelancer</span>}
          {m.role === "manager" && <span className="text-[11px] font-bold text-[#5B3FD0] bg-[#EEE8FD] px-1.5 py-0.5 rounded-full">Manager</span>}
          {!m.isActive && <span className="text-[11px] font-bold text-[#6B6680] bg-[#EEEDF2] px-1.5 py-0.5 rounded-full">Inactive</span>}
        </p>
        <p className="text-xs text-[#6B6680] truncate mt-0.5">
          {m.memberRoles.map(r => roleConfig(r, customRoles).label).join(", ") || "No role yet"}
          <span className="text-[#9893A8]"> · {m.memberId}</span>
        </p>
        {rates && <p className="text-xs font-semibold text-[#1F8A5B] truncate mt-0.5">{rates}</p>}
      </div>
      {m.phone && <span className="hidden lg:block text-xs text-[#6B6680] tabular-nums flex-shrink-0">{m.phone}</span>}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} aria-label={`WhatsApp ${m.firstName}`}
          className="w-9 h-9 rounded-full flex items-center justify-center text-[#1F8A5B] hover:bg-[#E9F5EF] flex-shrink-0">
          <MessageCircle className="w-4 h-4" />
        </a>
      )}
      <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} className="flex-shrink-0">
        <ActionMenu member={m} onEdit={onEdit} onReset={onReset} onToggle={onToggle} onDelete={onDelete} />
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [resetTarget, setResetTarget] = useState<Member | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [profileTarget, setProfileTarget] = useState<Member | null>(null);
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, crRes] = await Promise.all([
        apiFetch(`${API}/team`),
        apiFetch(`${API}/team/custom-roles`),
      ]);
      if (mRes.ok) setMembers(await mRes.json());
      if (crRes.ok) setCustomRoles(await crRes.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  async function toggleStatus(m: Member) {
    await apiFetch(`${API}/team/${m.id}/toggle-status`, { method: "PATCH", headers: { "Content-Type": "application/json" } }).catch(() => {});
    fetchMembers();
  }

  function openAdd() { setEditTarget(null); setDrawer(true); }
  function openEdit(m: Member) { setEditTarget(m); setDrawer(true); }

  const allRoles = [
    ...DEFAULT_ROLES,
    ...customRoles.map(cr => ({ id: cr, label: cr, icon: Tag, color: "bg-indigo-100 text-indigo-700" })),
  ];
  const roleStats = allRoles.map(r => ({
    ...r,
    count: members.filter(m => m.memberRoles.includes(r.id) && m.isActive).length,
  }));

  const filteredMembers = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      `${m.firstName} ${m.lastName ?? ""}`.toLowerCase().includes(q) ||
      (m.username ?? "").toLowerCase().includes(q) ||
      (m.phone ?? "").includes(q) ||
      m.memberId.toLowerCase().includes(q);
    const matchRole = roleFilter === "all" || m.memberRoles.includes(roleFilter);
    return matchSearch && matchRole;
  });

  return (
    <div>
      <PageHeader icon={HeaderIcon} color="blue" title="Team" sub={<>{members.filter(m => m.isActive).length} active · {members.length} total</>}>
        {members.length > 0 && <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={search} onChange={setSearch} placeholder="Search name, username, phone" />}
        <MainButton icon={Plus} onClick={openAdd}>Add member</MainButton>
      </PageHeader>

      {members.length > 0 && (
        <Chips label="Filter by role" value={roleFilter} onChange={setRoleFilter}
          options={[{ value: "all", label: "Everyone", count: members.length },
            ...roleStats.filter(r => r.count > 0).map(r => ({ value: r.id, label: r.label, count: r.count }))]} />
      )}

      {loading ? (
        <RowsSkeleton n={6} />
      ) : members.length === 0 ? (
        <EmptyState icon={Shield} title="No team members yet" text="Add photographers, editors and cinematographers."
          action={<MainButton icon={Plus} onClick={openAdd}>Add member</MainButton>} />
      ) : filteredMembers.length === 0 ? (
        <EmptyState icon={Search} title="No one matches" text="Try another name or role."
          action={<button onClick={() => { setSearch(""); setRoleFilter("all"); }} className="text-sm font-semibold text-[#5B3FD0]">Clear filters</button>} />
      ) : (
        <Group>
          {filteredMembers.map(m => (
            <MemberRow key={m.id} m={m} customRoles={customRoles}
              onView={() => setProfileTarget(m)}
              onEdit={() => openEdit(m)}
              onReset={() => setResetTarget(m)}
              onToggle={() => toggleStatus(m)}
              onDelete={() => setDeleteTarget(m)} />
          ))}
        </Group>
      )}

      <MemberDrawer open={drawer} onClose={() => { setDrawer(false); setEditTarget(null); }} onSaved={fetchMembers} editing={editTarget} customRoles={customRoles} onCustomRolesChange={setCustomRoles} />
      <ResetPassDialog member={resetTarget} onClose={() => setResetTarget(null)} onDone={fetchMembers} />
      <DeleteDialog member={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={fetchMembers} />
      <ProfileDrawer
        member={profileTarget}
        onClose={() => setProfileTarget(null)}
        customRoles={customRoles}
        onEdit={m => { setProfileTarget(null); openEdit(m); }}
        onReset={m => { setResetTarget(m); }}
        onToggle={m => { toggleStatus(m); setProfileTarget(null); }}
      />
    </div>
  );
}
