"use client";

/**
 * New / edit program — one organised page.
 * 1 Client · 2 Program (type, name, package) · 3 Days & team (shifts, who, setup) ·
 * 4 Money · 5 Team pay (built from prices, editable) · 6 Other costs & notes.
 * A live summary (money, team cost, profit) sits on the right on wide screens.
 *
 * Saves the same booking fields as before; the team bill is written to costEntries
 * (with itemised lines), so profile / salary / reports / profit all stay in sync.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRight, Calendar, Camera, Check, ChevronDown, Loader2, MapPin, Minus, Plus,
  Search, Store, Trash2, UserPlus, Users, Wallet, X, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, API_URL as API } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { notify } from "@/components/feedback";
import { CARD_SHADOW, TILE, Tile, type TileColor } from "@/components/ui/apple";
import { Field, FormDrawer, FormGroup, inputCls, phoneKey } from "@/components/ui/form-kit";
import { ClientFormFields, blankClientForm, type ClientFormData } from "@/components/client-form-fields";
import { TEAM_ROLES } from "../../team/_components/rate-card";
import { EVENT_TYPES, fmtDate, uid } from "./constants";
import { buildBill, findRate, ROLE_NAME, type Rate } from "./pricing";
import type { BillLine, Booking, Client, CostEntry, EditorDraft, EventDay, Package, ShiftAssignment, SetupMode, TeamMember } from "./types";

type WorkType = { id: string; name: string; active: boolean };
type ShiftTemplate = { id: string; name: string; shifts: { id: string; name: string }[] };
type StudioSetup = { workTypes: WorkType[]; shiftTemplates: ShiftTemplate[]; studioRates: Rate[]; payMode: string };

const SHIFT_PRESETS = ["Day", "Evening", "Night", "Full day"];
const METHODS = [{ v: "cash", l: "Cash" }, { v: "mobile_banking", l: "bKash / Nagad" }, { v: "bank_transfer", l: "Bank" }, { v: "other", l: "Other" }];
const role = (id: string) => TEAM_ROLES.find(r => r.id === id) ?? { id, label: id.replace(/_/g, " "), icon: Camera, tile: "violet" };
const fullName = (m?: { firstName: string; lastName?: string | null }) => m ? `${m.firstName} ${m.lastName ?? ""}`.trim() : "";
const num = (v: string) => parseFloat(v) || 0;

/** Old bookings stored member ids in shift.memberIds. */
function normalizeDays(days: EventDay[] | undefined | null): EventDay[] {
  return (days ?? []).map(d => ({ ...d, shifts: (d.shifts ?? []).map(s => ({ ...s, assignments: s.assignments ?? (s as unknown as { memberIds?: ShiftAssignment[] }).memberIds ?? [] })) }));
}

// ─── Section shell ────────────────────────────────────────────────────────────
function Section({ n, title, sub, done, children, right }: { n: number; title: string; sub?: React.ReactNode; done?: boolean; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2.5 px-1 mb-2.5">
        <span className={cn("w-6 h-6 rounded-full text-[12px] font-bold flex items-center justify-center flex-shrink-0",
          done ? "bg-[#1F8A5B] text-white" : "bg-[#17151F] text-white")}>{done ? <Check className="w-3.5 h-3.5" /> : n}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold text-[#17151F] leading-tight">{title}</h3>
          {sub && <p className="text-xs text-[#6B6680] mt-0.5">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}
const Card = ({ children, className }: { children: React.ReactNode; className?: string }) =>
  <div className={cn("bg-white rounded-[20px]", CARD_SHADOW, className)}>{children}</div>;

function Money({ value, onChange, label, big, readOnly, placeholder }: { value: string; onChange?: (v: string) => void; label: string; big?: boolean; readOnly?: boolean; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B6680] text-sm">৳</span>
      <input type="number" inputMode="numeric" min="0" step="100" aria-label={label} value={value} readOnly={readOnly}
        onChange={e => onChange?.(e.target.value)} placeholder={placeholder ?? "0"}
        className={cn(inputCls, "pl-8 tabular-nums", big && "h-12 text-lg font-bold", readOnly && "opacity-70 cursor-not-allowed")} />
    </div>
  );
}

// ─── Client picker ────────────────────────────────────────────────────────────
function ClientPicker({ client, onPick, mode, setMode, newClient, setNewClient }: {
  client: Client | null; onPick: (c: Client | null) => void;
  mode: "search" | "new"; setMode: (m: "search" | "new") => void;
  newClient: ClientFormData; setNewClient: (c: ClientFormData) => void;
}) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Client[]>([]);
  const [busy, setBusy] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (client || mode !== "search") return;
    clearTimeout(t.current);
    t.current = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await apiFetch(`${API}/clients?${q.trim() ? `search=${encodeURIComponent(q.trim())}&` : ""}limit=8`);
        if (r.ok) { const d = await r.json(); setList(d.data ?? []); }
      } finally { setBusy(false); }
    }, q.trim() ? 250 : 0);
    return () => clearTimeout(t.current);
  }, [q, client, mode]);

  if (client) return (
    <Card className="flex items-center gap-3 p-4">
      <span className="w-11 h-11 rounded-full bg-[#1F5C99] text-white font-extrabold flex items-center justify-center">{client.firstName[0]?.toUpperCase()}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-bold text-[#17151F] truncate">{fullName(client)}</p>
        <p className="text-xs text-[#6B6680]">{client.phone ?? "No phone"}</p>
      </div>
      <button type="button" onClick={() => onPick(null)} className="h-9 px-3.5 rounded-full bg-[#F5F3FA] text-[13px] font-semibold text-[#5B3FD0] hover:bg-[#EEEBF4]">Change</button>
    </Card>
  );

  if (mode === "new") return (
    <div>
      <ClientFormFields value={newClient} onChange={u => setNewClient({ ...newClient, ...u })} autoFocus
        existingAction={{ label: "Use this client", onPick: c => { onPick(c as Client); setMode("search"); } }} />
      <button type="button" onClick={() => setMode("search")} className="text-[13px] font-semibold text-[#5B3FD0] px-1">← Pick an existing client instead</button>
    </div>
  );

  return (
    <Card className="p-3">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6680]" />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or phone…" aria-label="Search clients" className={cn(inputCls, "pl-10")} />
        {busy && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#A29DB3]" />}
      </div>
      <div className="mt-2 max-h-64 overflow-y-auto">
        {list.map(c => (
          <button key={c.id} type="button" onClick={() => onPick(c)}
            className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-[12px] hover:bg-[#F5F3FA] text-left">
            <span className="w-8 h-8 rounded-full bg-[#E6F0FB] text-[#1F5C99] text-[13px] font-bold flex items-center justify-center">{c.firstName[0]?.toUpperCase()}</span>
            <span className="flex-1 min-w-0"><span className="block text-sm font-semibold text-[#17151F] truncate">{fullName(c)}</span><span className="block text-xs text-[#6B6680]">{c.phone}</span></span>
            <ArrowRight className="w-4 h-4 text-[#A29DB3]" />
          </button>
        ))}
        {!busy && list.length === 0 && <p className="px-2.5 py-3 text-sm text-[#A29DB3]">{q.trim() ? "No client found." : "No clients yet."}</p>}
      </div>
      <button type="button" onClick={() => { setMode("new"); const d = q.replace(/\D/g, ""); setNewClient({ ...blankClientForm, ...(d.length >= 6 ? { phone: q.trim() } : { firstName: q.trim() }) }); }}
        className="mt-1 w-full h-11 rounded-[12px] bg-[#EEE8FD] text-[#5B3FD0] text-sm font-semibold inline-flex items-center justify-center gap-2">
        <UserPlus className="w-4 h-4" />{q.trim() ? `Add "${q.trim()}" as a new client` : "New client"}
      </button>
    </Card>
  );
}

// ─── Add / edit a person on a shift ───────────────────────────────────────────
type SlotRef = { dayId: string; shiftId: string };
function AssignDrawer({ open, onClose, days, start, team, studio, editing, busyIds, onSave, onNewFreelancer }: {
  open: boolean; onClose: () => void; days: EventDay[]; start: SlotRef | null; team: TeamMember[]; studio: StudioSetup;
  editing: { slot: SlotRef; a: ShiftAssignment } | null; busyIds: Set<string>;
  onSave: (a: ShiftAssignment, slots: SlotRef[], replace?: { slot: SlotRef; a: ShiftAssignment }) => void;
  onNewFreelancer: (m: TeamMember) => void;
}) {
  const [memberId, setMemberId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [setup, setSetup] = useState<SetupMode>("own");
  const [gear, setGear] = useState<{ ownerId: string; itemId?: string; name: string }[]>([]);
  const [studioGear, setStudioGear] = useState("");
  const [rental, setRental] = useState({ vendor: "", item: "", amount: "", paidBy: "studio" as "studio" | "member" });
  const [slots, setSlots] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [fl, setFl] = useState<{ open: boolean; name: string; phone: string; saving: boolean; err: string }>({ open: false, name: "", phone: "", saving: false, err: "" });

  useEffect(() => {
    if (!open) return;
    const a = editing?.a;
    setMemberId(a?.id ?? ""); setRoleId(a?.role ?? ""); setSetup(a?.setup ?? "own");
    setGear((a?.gear ?? []).filter(g => g.ownerId !== "studio"));
    setStudioGear((a?.gear ?? []).find(g => g.ownerId === "studio")?.name ?? "");
    setRental(a?.rental ? { ...a.rental, amount: String(a.rental.amount || "") } : { vendor: "", item: "", amount: "", paidBy: "studio" });
    const s = editing?.slot ?? start;
    setSlots(s ? [`${s.dayId}|${s.shiftId}`] : []);
    setQ(""); setFl({ open: false, name: "", phone: "", saving: false, err: "" });
  }, [open, editing, start]);

  const member = team.find(m => m.id === memberId);
  const roles = member?.memberRoles.filter(r => r !== "photo_editor" && r !== "video_editor").length
    ? member.memberRoles.filter(r => r !== "photo_editor" && r !== "video_editor")
    : ["photographer", "cinematographer", "drone_pilot", "assistant"];
  useEffect(() => { if (member && !roleId) setRoleId(roles[0] ?? "photographer"); }, [memberId]); // eslint-disable-line react-hooks/exhaustive-deps

  const type = days[0]?.programType ?? "";
  const rate = member && roleId ? (["per_shift", "per_day", "per_program"].map(u => findRate(member.roleRates as Rate[], studio.studioRates, roleId, u, type)).find(Boolean)) : undefined;
  const otherGear = team.filter(m => m.id !== memberId && (m.setup?.length ?? 0) > 0);
  const shown = team.filter(m => m.isActive !== false && (!q.trim() || fullName(m).toLowerCase().includes(q.toLowerCase()) || (m.phone ?? "").includes(q)))
    .sort((a, b) => Number(busyIds.has(a.id)) - Number(busyIds.has(b.id)));

  async function addFreelancer() {
    if (!fl.name.trim() || !fl.phone.trim()) { setFl(f => ({ ...f, err: "Name and phone please." })); return; }
    setFl(f => ({ ...f, saving: true, err: "" }));
    try {
      const existing = team.find(m => phoneKey(m.phone) === phoneKey(fl.phone));
      if (existing) { setMemberId(existing.id); setFl(f => ({ ...f, open: false, saving: false })); return; }
      const [first, ...rest] = fl.name.trim().split(/\s+/);
      const r = await apiFetch(`${API}/team`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberType: "freelancer", firstName: first, lastName: rest.join(" ") || undefined, phone: fl.phone.trim(), memberRoles: ["photographer"] }) });
      const d = await r.json();
      if (!r.ok) { setFl(f => ({ ...f, saving: false, err: Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't add." })); return; }
      onNewFreelancer(d); setMemberId(d.id); setRoleId("photographer");
      setFl({ open: false, name: "", phone: "", saving: false, err: "" });
      notify(`${first} added as a freelancer`);
    } catch { setFl(f => ({ ...f, saving: false, err: "Something went wrong." })); }
  }

  function save() {
    if (!memberId || !roleId || !slots.length) return;
    const a: ShiftAssignment = { id: memberId, role: roleId, setup };
    if (setup === "other") a.gear = [...gear, ...(studioGear.trim() ? [{ ownerId: "studio", name: studioGear.trim() }] : [])];
    if (setup === "rented") a.rental = { vendor: rental.vendor.trim(), item: rental.item.trim(), amount: num(rental.amount), paidBy: rental.paidBy };
    onSave(a, slots.map(s => { const [dayId, shiftId] = s.split("|"); return { dayId, shiftId }; }), editing ?? undefined);
    onClose();
  }

  const allSlots = days.flatMap(d => d.shifts.map(s => ({ key: `${d.id}|${s.id}`, label: `${d.eventType || "Day"}${d.date ? ` · ${fmtDate(d.date)}` : ""} · ${s.label}` })));

  return (
    <FormDrawer open={open} onTop onClose={onClose} icon={Users} color="blue" title={editing ? "Edit person" : "Add a person"}
      sub="Who, what work, and whose gear"
      footer={<>
        <button type="button" onClick={onClose} className="flex-1 h-12 rounded-full bg-[#EEEBF4] text-[15px] font-semibold text-[#17151F]">Cancel</button>
        <button type="button" onClick={save} disabled={!memberId || !roleId || !slots.length}
          className="flex-[1.4] h-12 rounded-full bg-[#7D5CEF] hover:bg-[#6C4BE0] disabled:opacity-50 text-white text-[15px] font-semibold">{editing ? "Save" : "Add"}</button>
      </>}>
      {!member ? (
        <FormGroup title="Who">
          <div className="p-3">
            <div className="relative mb-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6680]" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search team…" aria-label="Search team" className={cn(inputCls, "pl-10")} />
            </div>
            <div className="max-h-[46vh] overflow-y-auto">
              {shown.map(m => {
                const busy = busyIds.has(m.id);
                const r0 = role(m.memberRoles[0] ?? "");
                return (
                  <button key={m.id} type="button" onClick={() => { setMemberId(m.id); setRoleId(""); }}
                    className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-[12px] hover:bg-[#F5F3FA] text-left">
                    <Tile icon={r0.icon} color={r0.tile as TileColor} size={32} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-[#17151F] truncate">{fullName(m)}{m.memberType === "freelancer" && <span className="ml-1.5 text-[11px] font-bold text-[#9E3A8C]">Freelancer</span>}</span>
                      <span className="block text-xs text-[#6B6680] truncate">{m.memberRoles.map(r => role(r).label).join(", ") || "No work set"}</span>
                    </span>
                    {busy && <span className="text-[11px] font-bold text-[#C2304F] bg-[#FDECEF] px-2 py-0.5 rounded-full inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Busy</span>}
                  </button>
                );
              })}
              {shown.length === 0 && <p className="px-2.5 py-3 text-sm text-[#A29DB3]">No one found.</p>}
            </div>
            {fl.open ? (
              <div className="mt-2 p-3 rounded-[14px] bg-[#FBF2FA] space-y-2">
                <p className="text-[13px] font-bold text-[#9E3A8C]">New freelancer</p>
                <input value={fl.name} onChange={e => setFl(f => ({ ...f, name: e.target.value }))} placeholder="Name" aria-label="Freelancer name" className={cn(inputCls, "bg-white")} />
                <input value={fl.phone} onChange={e => setFl(f => ({ ...f, phone: e.target.value }))} placeholder="Phone / WhatsApp" type="tel" aria-label="Freelancer phone" className={cn(inputCls, "bg-white")} />
                {fl.err && <p className="text-xs text-[#C2304F]">{fl.err}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => setFl(f => ({ ...f, open: false }))} className="flex-1 h-10 rounded-full bg-white text-sm font-semibold text-[#17151F]">Cancel</button>
                  <button type="button" onClick={addFreelancer} disabled={fl.saving} className="flex-1 h-10 rounded-full bg-[#9E3A8C] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5">
                    {fl.saving && <Loader2 className="w-4 h-4 animate-spin" />}Add</button>
                </div>
                <p className="text-[11px] text-[#6B6680]">Saved to your team (no login). Set their prices later in Team.</p>
              </div>
            ) : (
              <button type="button" onClick={() => setFl(f => ({ ...f, open: true, name: q }))} className="mt-2 w-full h-11 rounded-[12px] bg-[#FBF2FA] text-[#9E3A8C] text-sm font-semibold inline-flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" />New freelancer
              </button>
            )}
          </div>
        </FormGroup>
      ) : (
        <>
          <Card className="flex items-center gap-3 p-4 mb-5">
            <span className="w-11 h-11 rounded-full text-white font-extrabold flex items-center justify-center" style={{ background: TILE[role(member.memberRoles[0] ?? "").tile as TileColor] ?? "#7D5CEF" }}>{member.firstName[0]?.toUpperCase()}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-[#17151F] truncate">{fullName(member)}</p>
              <p className="text-xs text-[#6B6680]">{member.memberType === "freelancer" ? "Freelancer" : "Team staff"}{busyIds.has(member.id) ? " · busy on another program that day" : ""}</p>
            </div>
            {!editing && <button type="button" onClick={() => setMemberId("")} className="h-9 px-3.5 rounded-full bg-[#F5F3FA] text-[13px] font-semibold text-[#5B3FD0]">Change</button>}
          </Card>

          <FormGroup title="Work">
            <div className="p-3 flex flex-wrap gap-2">
              {[...new Set([...roles, ...(roleId && !roles.includes(roleId) ? [roleId] : [])])].map(r => {
                const rc = role(r); const on = roleId === r;
                return (
                  <button key={r} type="button" role="radio" aria-checked={on} onClick={() => setRoleId(r)}
                    className={cn("inline-flex items-center gap-2 h-10 pl-1.5 pr-3.5 rounded-full text-[13px] font-semibold", on ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658]")}>
                    <Tile icon={rc.icon} color={rc.tile as TileColor} size={28} />{rc.label}
                  </button>
                );
              })}
            </div>
          </FormGroup>

          <FormGroup title="Whose gear?" note={rate ? <>Price: <strong>{formatCurrency(rate.rate)}</strong> work only{rate.withSetup != null && <> · <strong>{formatCurrency(rate.withSetup)}</strong> with own setup</>} ({rate.rateType.replace(/^per_/, "per ").replace("_", " ")})</> : "No price set for this work yet — you can type the amount in Team pay."}>
            <div className="p-3 grid grid-cols-3 gap-2">
              {([
                { v: "own", l: "Own setup", d: "Brings their gear", icon: Camera },
                { v: "other", l: "Someone else's", d: "Studio or a member", icon: Users },
                { v: "rented", l: "Rented", d: "From a shop", icon: Store },
              ] as const).map(o => {
                const on = setup === o.v; const Icon = o.icon;
                return (
                  <button key={o.v} type="button" role="radio" aria-checked={on} onClick={() => setSetup(o.v)}
                    className={cn("p-3 rounded-[14px] text-left transition-all", on ? "bg-[#EEE8FD] ring-2 ring-[#7D5CEF]" : "bg-[#F5F3FA] hover:bg-[#EEEBF4]")}>
                    <Icon className={cn("w-4 h-4", on ? "text-[#5B3FD0]" : "text-[#6B6680]")} />
                    <p className="mt-1.5 text-[13px] font-bold text-[#17151F] leading-tight">{o.l}</p>
                    <p className="text-[11px] text-[#6B6680] leading-tight mt-0.5">{o.d}</p>
                  </button>
                );
              })}
            </div>
            {setup === "other" && (
              <div className="px-4 pb-4 space-y-3">
                {otherGear.map(owner => (
                  <div key={owner.id}>
                    <p className="text-[12px] font-bold text-[#4A4658] mb-1.5">{fullName(owner)}&apos;s gear <span className="font-medium text-[#6B6680]">— rent goes to them</span></p>
                    <div className="flex flex-wrap gap-1.5">
                      {owner.setup!.map(g => {
                        const on = gear.some(x => x.ownerId === owner.id && x.itemId === g.id);
                        return (
                          <button key={g.id} type="button" role="checkbox" aria-checked={on}
                            onClick={() => setGear(on ? gear.filter(x => !(x.ownerId === owner.id && x.itemId === g.id)) : [...gear, { ownerId: owner.id, itemId: g.id, name: g.name }])}
                            className={cn("h-8 px-3 rounded-full text-[12px] font-semibold inline-flex items-center gap-1.5", on ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658]")}>
                            {on && <Check className="w-3 h-3" />}{g.name} · {formatCurrency(g.rent)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div>
                  <p className="text-[12px] font-bold text-[#4A4658] mb-1.5">Studio gear <span className="font-medium text-[#6B6680]">— no rent</span></p>
                  <input value={studioGear} onChange={e => setStudioGear(e.target.value)} placeholder="e.g. Studio Sony A7 III + gimbal" aria-label="Studio gear" className={inputCls} />
                </div>
              </div>
            )}
            {setup === "rented" && (
              <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                <input value={rental.vendor} onChange={e => setRental(r => ({ ...r, vendor: e.target.value }))} placeholder="Shop / person" aria-label="Rented from" className={inputCls} />
                <input value={rental.item} onChange={e => setRental(r => ({ ...r, item: e.target.value }))} placeholder="Item, e.g. Sony FX3" aria-label="Rented item" className={inputCls} />
                <Money value={rental.amount} onChange={v => setRental(r => ({ ...r, amount: v }))} label="Rent amount" placeholder="Rent this time" />
                <select value={rental.paidBy} onChange={e => setRental(r => ({ ...r, paidBy: e.target.value as "studio" | "member" }))} aria-label="Who paid the rent" className={cn(inputCls, "cursor-pointer")}>
                  <option value="studio">Studio pays the shop</option>
                  <option value="member">{member.firstName} paid — refund</option>
                </select>
                <p className="col-span-2 text-[11px] text-[#6B6680]">Rent changes every time, so type it for this program. {rental.paidBy === "studio" ? "It goes to the program's equipment rent." : `It's added to ${member.firstName}'s bill as a refund.`}</p>
              </div>
            )}
          </FormGroup>

          {allSlots.length > 1 && (
            <FormGroup title="Which shifts" note="Tick every shift they work — the price counts each one.">
              <div className="p-3 space-y-1">
                {allSlots.map(s => {
                  const on = slots.includes(s.key);
                  return (
                    <button key={s.key} type="button" role="checkbox" aria-checked={on}
                      onClick={() => setSlots(on ? slots.filter(x => x !== s.key) : [...slots, s.key])}
                      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-[12px] hover:bg-[#F5F3FA] text-left">
                      <span className={cn("w-5 h-5 rounded-[6px] border-2 flex items-center justify-center flex-shrink-0", on ? "bg-[#7D5CEF] border-[#7D5CEF]" : "border-[#D8D3E3]")}>{on && <Check className="w-3 h-3 text-white" />}</span>
                      <span className="text-sm text-[#17151F]">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </FormGroup>
          )}
        </>
      )}
    </FormDrawer>
  );
}

// ─── The drawer ───────────────────────────────────────────────────────────────
export function ProgramDrawer({ open, onClose, onSaved, packages, teamMembers, initialBooking, initialClient }: {
  open: boolean; onClose: () => void; onSaved: () => void;
  packages: Package[]; teamMembers: TeamMember[];
  initialBooking?: Booking | null;
  /** Start a new program for this client. */
  initialClient?: Client | null;
}) {
  const isEdit = !!initialBooking;
  const [client, setClient] = useState<Client | null>(null);
  const [clientMode, setClientMode] = useState<"search" | "new">("search");
  const [newClient, setNewClient] = useState<ClientFormData>(blankClientForm);
  const [programType, setProgramType] = useState("");
  const [eventName, setEventName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [packageId, setPackageId] = useState("");
  const [days, setDays] = useState<EventDay[]>([]);
  const [money, setMoney] = useState({ total: "", discount: "", advance: "", method: "cash", transport: "", album: "", equipExtra: "", other: "" });
  const [notes, setNotes] = useState("");
  const [kept, setKept] = useState<CostEntry[]>([]);
  const [editors, setEditors] = useState<EditorDraft[]>([]);
  const [studio, setStudio] = useState<StudioSetup>({ workTypes: [], shiftTemplates: [], studioRates: [], payMode: "per_shift" });
  const [team, setTeam] = useState<TeamMember[]>(teamMembers);
  const [busy, setBusy] = useState<Record<string, string[]>>({});
  const [assign, setAssign] = useState<{ open: boolean; start: SlotRef | null; editing: { slot: SlotRef; a: ShiftAssignment } | null }>({ open: false, start: null, editing: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openBill, setOpenBill] = useState<string | null>(null);

  useEffect(() => { setTeam(teamMembers); }, [teamMembers]);

  // Fresh team (with prices + gear) and studio settings each time it opens
  useEffect(() => {
    if (!open) return;
    apiFetch(`${API}/companies/settings`).then(r => r.ok ? r.json() : null).then(d => d && setStudio({
      workTypes: (d.workTypes ?? []).filter((w: WorkType) => w.active), shiftTemplates: d.shiftTemplates ?? [],
      studioRates: d.studioRates ?? [], payMode: d.teamPay?.mode ?? "per_shift",
    })).catch(() => {});
    apiFetch(`${API}/team`).then(r => r.ok ? r.json() : null).then(d => Array.isArray(d) && setTeam(d)).catch(() => {});
  }, [open]);

  // Fill the form
  useEffect(() => {
    if (!open) return;
    setError(""); setClientMode("search"); setNewClient(blankClientForm); setOpenBill(null);
    if (isEdit && initialBooking) {
      const b = initialBooking;
      const d = normalizeDays(b.eventDays);
      setClient(b.client as Client); setEventName(b.eventName ?? ""); setNameTouched(true);
      setProgramType(d[0]?.programType ?? ""); setPackageId(b.program?.id ?? ""); setDays(d);
      setKept((b.costEntries ?? []) as CostEntry[]);
      // Rent from rented gear is added again from the shifts, so only keep the rest as "extra"
      let rented = 0;
      for (const day of d) for (const s of day.shifts) for (const a of s.assignments) if (a.setup === "rented" && a.rental?.paidBy !== "member") rented += a.rental?.amount ?? 0;
      setMoney({
        total: String(Number(b.totalAmount) || ""), discount: String(Number(b.discountAmount) || ""), advance: String(Number(b.advanceAmount) || ""),
        method: "cash", transport: String(Number(b.transportCost) || ""), album: String(Number(b.albumCost) || ""),
        equipExtra: String(Math.max(0, Number(b.equipCost) - rented) || ""), other: String(Number(b.otherCost) || ""),
      });
      setNotes(b.internalNotes ?? "");
      apiFetch(`${API}/bookings/${b.id}/editors`).then(r => r.ok ? r.json() : []).then((rows: EditorDraft[]) => setEditors(rows.map(r => ({ userId: r.userId, role: r.role })))).catch(() => {});
    } else {
      setClient(initialClient ?? null); setEventName(""); setNameTouched(false); setProgramType(""); setPackageId("");
      setDays([]); setKept([]); setEditors([]); setNotes("");
      setMoney({ total: "", discount: "", advance: "", method: "cash", transport: "", album: "", equipExtra: "", other: "" });
    }
  }, [open, initialBooking, initialClient]); // eslint-disable-line react-hooks/exhaustive-deps

  // Who is busy on each date
  useEffect(() => {
    if (!open) return;
    for (const d of days) {
      if (!d.date || busy[d.date]) continue;
      const qs = new URLSearchParams({ date: d.date }); if (initialBooking) qs.set("excludeBookingId", initialBooking.id);
      apiFetch(`${API}/bookings/busy-members?${qs}`).then(r => r.ok ? r.json() : null).then(x => x && setBusy(b => ({ ...b, [d.date]: x.busyMemberIds ?? [] }))).catch(() => {});
    }
  }, [days, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Program type on every day; bill from shifts + prices
  const typedDays = useMemo(() => days.map(d => ({ ...d, programType: programType || undefined })), [days, programType]);
  const bill = useMemo(() => buildBill({ days: typedDays, team, studioRates: studio.studioRates, payMode: studio.payMode, keep: kept, editors }),
    [typedDays, team, studio, kept, editors]);

  const typeName = studio.workTypes.find(w => w.id === programType)?.name ?? "";
  const clientName = client ? fullName(client) : fullName({ firstName: newClient.firstName, lastName: newClient.lastName });
  // Suggest a name until the user types one
  useEffect(() => {
    if (nameTouched) return;
    const first = clientName.split(" ")[0];
    setEventName(first && typeName ? `${first}'s ${typeName.replace(/^(Muslim|Sanatani|Hindu) /, "")}` : first ? `${first}'s program` : "");
  }, [clientName, typeName, nameTouched]);

  const template = studio.shiftTemplates.find(t => t.id === programType || t.name.toLowerCase() === typeName.toLowerCase());

  // ── days & shifts ──
  const setDay = (id: string, p: Partial<EventDay>) => setDays(ds => ds.map(d => d.id === id ? { ...d, ...p } : d));
  const addDay = (eventType = "") => setDays(ds => [...ds, { id: uid(), eventType, date: "", location: ds[ds.length - 1]?.location ?? "", shifts: [{ id: uid(), label: studio.payMode === "per_shift" ? "Day" : "Full day", assignments: [] }] }]);
  const addTemplate = () => template && setDays(ds => [...ds, ...template.shifts.map(s => ({ id: uid(), eventType: s.name, date: "", location: "", shifts: [{ id: uid(), label: "Day", assignments: [] }] }))]);
  const addShift = (dayId: string, label: string) => setDays(ds => ds.map(d => d.id === dayId && !d.shifts.some(s => s.label === label) ? { ...d, shifts: [...d.shifts, { id: uid(), label, assignments: [] }] } : d));
  const removeShift = (dayId: string, shiftId: string) => setDays(ds => ds.map(d => d.id === dayId ? { ...d, shifts: d.shifts.filter(s => s.id !== shiftId) } : d));
  const removePerson = (slot: SlotRef, a: ShiftAssignment) => setDays(ds => ds.map(d => d.id !== slot.dayId ? d : { ...d, shifts: d.shifts.map(s => s.id !== slot.shiftId ? s : { ...s, assignments: s.assignments.filter(x => !(x.id === a.id && x.role === a.role)) }) }));
  function savePerson(a: ShiftAssignment, slots: SlotRef[], replace?: { slot: SlotRef; a: ShiftAssignment }) {
    setDays(ds => ds.map(d => ({ ...d, shifts: d.shifts.map(s => {
      let list = s.assignments;
      if (replace && replace.slot.dayId === d.id && replace.slot.shiftId === s.id) list = list.filter(x => !(x.id === replace.a.id && x.role === replace.a.role));
      if (slots.some(sl => sl.dayId === d.id && sl.shiftId === s.id)) list = [...list.filter(x => !(x.id === a.id && x.role === a.role)), a];
      return { ...s, assignments: list };
    }) })));
  }

  // ── bill edits (stored as kept entries; buildBill merges them back) ──
  function patchEntry(memberId: string, fn: (lines: BillLine[]) => BillLine[]) {
    const e = bill.entries.find(x => x.memberId === memberId);
    if (!e) return;
    setKept(k => [...k.filter(x => x.memberId !== memberId), { ...e, lines: fn(e.lines ?? []) }]);
  }
  const editLine = (mid: string, lid: string, amount: number) => patchEntry(mid, ls => ls.map(l => l.id === lid ? { ...l, amount, edited: l.auto ? true : l.edited } : l));
  const renameLine = (mid: string, lid: string, label: string) => patchEntry(mid, ls => ls.map(l => l.id === lid ? { ...l, label } : l));
  const removeLine = (mid: string, lid: string) => patchEntry(mid, ls => ls.filter(l => l.id !== lid));
  const addLine = (mid: string, kind: "extra" | "deduction") => patchEntry(mid, ls => [...ls, { id: uid(), kind, label: kind === "extra" ? "Extra (bonus, transport, food…)" : "Cut (advance taken…)", amount: 0 }]);

  // ── totals ──
  const total = num(money.total), discount = num(money.discount), advance = num(money.advance);
  const net = total - discount;
  const paidSoFar = isEdit ? Number(initialBooking?.paidAmount ?? 0) : advance;
  const due = net - paidSoFar;
  const teamCost = bill.entries.reduce((s, e) => s + e.totalBill, 0);
  const equip = bill.rentedFromOutside + num(money.equipExtra);
  const otherCosts = num(money.transport) + num(money.album) + equip + num(money.other);
  const profit = net - teamCost - otherCosts;
  const people = new Set(days.flatMap(d => d.shifts.flatMap(s => s.assignments.map(a => a.id)))).size;
  const datedDays = days.filter(d => d.date).sort((a, b) => a.date.localeCompare(b.date));

  const step1 = !!client || (clientMode === "new" && !!newClient.firstName.trim() && !!newClient.phone.trim());
  const step2 = !!eventName.trim();
  const step3 = days.length > 0 && days.every(d => d.date);
  const step4 = total > 0;

  async function submit() {
    setError("");
    if (!step1) { setError("Pick a client, or add a new one with name and phone."); return; }
    if (!step2) { setError("Give the program a name."); return; }
    if (!days.length) { setError("Add at least one day."); return; }
    if (!step3) { setError("Every day needs a date."); return; }
    if (!step4) { setError("Write the contract amount."); return; }
    if (!isEdit && advance > net) { setError("Advance can't be more than the total."); return; }
    setSaving(true);
    try {
      let clientId = client?.id;
      if (!clientId) {
        const nc = newClient;
        const r = await apiFetch(`${API}/clients`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          firstName: nc.firstName.trim(), lastName: nc.lastName.trim() || undefined, phone: nc.phone.trim(), email: nc.email.trim() || undefined,
          phoneSecondary: nc.phoneSecondary.trim() || undefined, facebookProfile: nc.facebookProfile.trim() || undefined, city: nc.city.trim() || undefined,
          source: nc.source || undefined, referredByClientId: nc.source === "referral" && nc.referredByClientId ? nc.referredByClientId : undefined,
          referredByName: nc.source === "referral" && !nc.referredByClientId && nc.referredByName.trim() ? nc.referredByName.trim() : undefined,
          address: nc.address.trim() || undefined, occupation: nc.occupation.trim() || undefined, companyName: nc.companyName.trim() || undefined,
          vipStatus: nc.vipStatus, notes: nc.notes.trim() || undefined, internalNotes: nc.internalNotes.trim() || undefined,
        }) });
        const d = await r.json();
        if (!r.ok) { setError(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't save the client."); return; }
        clientId = d.id;
      }
      const sorted = [...typedDays].sort((a, b) => a.date.localeCompare(b.date));
      const body = {
        clientId, programId: packageId || undefined, eventName: eventName.trim(),
        eventDate: sorted[0]?.date || undefined, eventLocation: sorted[0]?.location || undefined, currency: "BDT",
        totalAmount: total, discountAmount: discount,
        advanceAmount: isEdit ? undefined : advance, advanceMethod: isEdit || !(advance > 0) ? undefined : money.method,
        transportCost: num(money.transport), otherCost: num(money.other), albumCost: num(money.album), equipCost: equip,
        internalNotes: notes || undefined, eventDays: typedDays,
        costEntries: bill.entries.filter(e => e.memberName || e.totalBill),
        ...(isEdit ? {} : { status: "confirmed" }),
      };
      const url = isEdit ? `${API}/bookings/${initialBooking!.id}` : `${API}/bookings`;
      const r = await apiFetch(url, { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setError(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't save the program."); return; }
      const id = isEdit ? initialBooking!.id : d.id;
      if (id) await apiFetch(`${API}/bookings/${id}/editors`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ editors }) }).catch(() => {});
      notify(isEdit ? "Program saved" : "Program created");
      onSaved(); onClose();
    } catch { setError("Something went wrong. Please try again."); }
    finally { setSaving(false); }
  }

  if (!open) return null;
  const editorPeople = team.filter(m => m.memberRoles.includes("photo_editor") || m.memberRoles.includes("video_editor"));
  const assignDay = days.find(d => d.id === (assign.editing?.slot.dayId ?? assign.start?.dayId));

  const summary = (
    <Card className="p-5">
      <p className="text-[13px] font-bold text-[#6B6680]">Summary</p>
      <p className="mt-1 text-[17px] font-extrabold text-[#17151F] leading-tight truncate">{eventName || "New program"}</p>
      <p className="text-xs text-[#6B6680] truncate">{[clientName, typeName].filter(Boolean).join(" · ") || "—"}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="h-6 px-2.5 rounded-full bg-[#F5F3FA] text-[12px] font-semibold text-[#4A4658] inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{days.length} day{days.length === 1 ? "" : "s"}</span>
        <span className="h-6 px-2.5 rounded-full bg-[#F5F3FA] text-[12px] font-semibold text-[#4A4658] inline-flex items-center gap-1"><Users className="w-3 h-3" />{people} {people === 1 ? "person" : "people"}</span>
        {datedDays[0] && <span className="h-6 px-2.5 rounded-full bg-[#FDECEF] text-[12px] font-semibold text-[#C2304F] inline-flex items-center">{fmtDate(datedDays[0].date)}{datedDays.length > 1 ? ` – ${fmtDate(datedDays[datedDays.length - 1].date)}` : ""}</span>}
      </div>
      <div className="mt-4 space-y-1.5 text-sm">
        <Row l="Contract" v={formatCurrency(total)} />
        {discount > 0 && <Row l="Discount" v={`− ${formatCurrency(discount)}`} />}
        <Row l={isEdit ? "Paid so far" : "Advance"} v={formatCurrency(paidSoFar)} />
        <Row l="Client still owes" v={formatCurrency(Math.max(0, due))} strong tone={due > 0 ? "red" : "green"} />
      </div>
      <div className="mt-4 pt-3 border-t border-[#EEEBF4] space-y-1.5 text-sm">
        <Row l="Team pay" v={`− ${formatCurrency(teamCost)}`} />
        {equip > 0 && <Row l="Equipment rent" v={`− ${formatCurrency(equip)}`} />}
        {otherCosts - equip > 0 && <Row l="Other costs" v={`− ${formatCurrency(otherCosts - equip)}`} />}
        <Row l="Profit" v={formatCurrency(profit)} strong tone={profit >= 0 ? "green" : "red"} sub={net > 0 ? `${Math.round((profit / net) * 100)}%` : undefined} />
      </div>
    </Card>
  );

  return (
    <>
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={isEdit ? "Edit program" : "New program"} className="sp-drawer z-50 sm:max-w-[1100px] flex flex-col bg-[#F5F3FA]">
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <Tile icon={Camera} color="deep" size={40} />
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">{isEdit ? "Edit program" : "New program"}</h2>
            <p className="text-[13px] text-[#6B6680] truncate">{isEdit ? initialBooking?.bookingNumber : "Fill top to bottom — everything adds up on the right."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-[#EEEBF4] text-[#6B6680]"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-6">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
            <div className="min-w-0">
              {error && <div role="alert" className="mb-4 px-4 py-3 rounded-[14px] bg-[#FDECEF] text-[#8A2340] text-sm font-medium">{error}</div>}

              <Section n={1} title="Client" done={step1}>
                <ClientPicker client={client} onPick={c => setClient(c)} mode={clientMode} setMode={setClientMode} newClient={newClient} setNewClient={setNewClient} />
              </Section>

              <Section n={2} title="Program" sub="The type picks the right prices and the usual days" done={step2}>
                <Card>
                  <div className="p-4">
                    <p className="text-[13px] font-semibold text-[#4A4658] mb-2">Type</p>
                    <div role="radiogroup" aria-label="Program type" className="flex flex-wrap gap-2">
                      {studio.workTypes.map(w => (
                        <button key={w.id} type="button" role="radio" aria-checked={programType === w.id} onClick={() => setProgramType(programType === w.id ? "" : w.id)}
                          className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold", programType === w.id ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]")}>{w.name}</button>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-[#EEEBF4] grid sm:grid-cols-[1fr_240px]">
                    <Field label="Name" required>{id => <input id={id} value={eventName} onChange={e => { setEventName(e.target.value); setNameTouched(true); }} placeholder="e.g. Arif & Nusrat Wedding" className={inputCls} />}</Field>
                    <Field label="Package">{id => (
                      <select id={id} value={packageId} onChange={e => { const p = packages.find(x => x.id === e.target.value); setPackageId(e.target.value); if (p?.basePrice) setMoney(m => ({ ...m, total: String(p.basePrice) })); }}
                        className={cn(inputCls, "cursor-pointer")}>
                        <option value="">No package</option>
                        {packages.map(p => <option key={p.id} value={p.id}>{p.name}{p.basePrice ? ` — ${formatCurrency(p.basePrice)}` : ""}</option>)}
                      </select>
                    )}</Field>
                  </div>
                </Card>
              </Section>

              <Section n={3} title="Days & team" sub="Each day, its shifts, and who works them" done={step3 && people > 0}
                right={days.length > 0 ? <button type="button" onClick={() => addDay()} className="h-9 px-3.5 rounded-full bg-white text-[13px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1.5 shadow-[0_1px_2px_rgba(22,18,40,.06)]"><Plus className="w-3.5 h-3.5" />Day</button> : undefined}>
                {days.length === 0 && (
                  <Card className="p-5 text-center">
                    <Calendar className="w-7 h-7 text-[#A29DB3] mx-auto" />
                    <p className="mt-2 text-sm font-semibold text-[#17151F]">No days yet</p>
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      {template && <button type="button" onClick={addTemplate} className="h-10 px-4 rounded-full bg-[#7D5CEF] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />Add {template.shifts.map(s => s.name).join(", ")}</button>}
                      <button type="button" onClick={() => addDay()} className="h-10 px-4 rounded-full bg-[#F5F3FA] text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />Add a day</button>
                    </div>
                  </Card>
                )}
                <div className="space-y-3">
                  {days.map((d, i) => {
                    const busyHere = new Set(d.date ? busy[d.date] ?? [] : []);
                    return (
                      <Card key={d.id}>
                        <div className="p-3 grid grid-cols-[28px_1fr_36px] sm:grid-cols-[28px_1fr_160px_1fr_36px] gap-2 items-center border-b border-[#EEEBF4]">
                          <span className="w-7 h-7 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[12px] font-bold flex items-center justify-center">{i + 1}</span>
                          <input list="sp-day-names" value={d.eventType} onChange={e => setDay(d.id, { eventType: e.target.value })} placeholder="Day name — Holud, Wedding…" aria-label={`Day ${i + 1} name`} className={cn(inputCls, "h-10 text-sm font-semibold")} />
                          <button type="button" onClick={() => setDays(ds => ds.filter(x => x.id !== d.id))} aria-label="Remove day" className="sm:order-last w-9 h-9 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F]"><Trash2 className="w-4 h-4" /></button>
                          <input type="date" value={d.date} onChange={e => setDay(d.id, { date: e.target.value })} aria-label={`Day ${i + 1} date`} className={cn(inputCls, "h-10 text-sm col-start-2 sm:col-start-auto", !d.date && "ring-1 ring-[#C2304F]/30")} />
                          <div className="relative col-start-2 sm:col-start-auto">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B6680]" />
                            <input value={d.location} onChange={e => setDay(d.id, { location: e.target.value })} placeholder="Venue" aria-label={`Day ${i + 1} venue`} className={cn(inputCls, "h-10 text-sm pl-8")} />
                          </div>
                        </div>
                        <div className="divide-y divide-[#EEEBF4]">
                          {d.shifts.map(s => (
                            <div key={s.id} className="px-3 py-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[13px] font-bold text-[#4A4658]">{s.label}</span>
                                <span className="text-xs text-[#9893A8]">{s.assignments.length ? `${s.assignments.length} on this shift` : "nobody yet"}</span>
                                <span className="flex-1" />
                                {d.shifts.length > 1 && <button type="button" onClick={() => removeShift(d.id, s.id)} aria-label={`Remove ${s.label} shift`} className="w-7 h-7 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F]"><Minus className="w-3.5 h-3.5" /></button>}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {s.assignments.map(a => {
                                  const m = team.find(t => t.id === a.id); const rc = role(a.role);
                                  const setupLabel = a.setup === "rented" ? `Rented${a.rental?.amount ? ` ৳${a.rental.amount}` : ""}` : a.setup === "other" ? (a.gear?.length ? `${a.gear[0].name}${a.gear.length > 1 ? ` +${a.gear.length - 1}` : ""}` : "Others' gear") : "Own setup";
                                  return (
                                    <div key={`${a.id}-${a.role}`} className="inline-flex items-center gap-2 h-11 pl-1.5 pr-1 rounded-full bg-[#F5F3FA]">
                                      <button type="button" onClick={() => setAssign({ open: true, start: null, editing: { slot: { dayId: d.id, shiftId: s.id }, a } })} className="inline-flex items-center gap-2 text-left">
                                        <Tile icon={rc.icon} color={rc.tile as TileColor} size={30} />
                                        <span className="leading-tight">
                                          <span className="block text-[13px] font-semibold text-[#17151F]">{m ? fullName(m) : a.name ?? "Unknown"}{busyHere.has(a.id) && <AlertTriangle className="inline w-3 h-3 ml-1 text-[#C2304F]" aria-label="Busy on another program" />}</span>
                                          <span className="block text-[11px] text-[#6B6680]">{rc.label} · <span className={cn(a.setup === "rented" ? "text-[#9E3A8C]" : a.setup === "other" ? "text-[#1F5C99]" : "text-[#1F8A5B]")}>{setupLabel}</span></span>
                                        </span>
                                      </button>
                                      <button type="button" onClick={() => removePerson({ dayId: d.id, shiftId: s.id }, a)} aria-label="Remove from shift" className="w-7 h-7 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-white hover:text-[#C2304F]"><X className="w-3.5 h-3.5" /></button>
                                    </div>
                                  );
                                })}
                                <button type="button" onClick={() => setAssign({ open: true, start: { dayId: d.id, shiftId: s.id }, editing: null })}
                                  className="h-11 px-4 rounded-full border border-dashed border-[#C9C2DA] text-[13px] font-semibold text-[#5B3FD0] inline-flex items-center gap-1.5 hover:bg-[#F5F3FA]">
                                  <Plus className="w-4 h-4" />Add person
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="px-3 py-2.5 flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] text-[#6B6680] mr-1">Add shift:</span>
                            {SHIFT_PRESETS.filter(p => !d.shifts.some(s => s.label === p)).map(p => (
                              <button key={p} type="button" onClick={() => addShift(d.id, p)} className="h-7 px-2.5 rounded-full bg-[#F5F3FA] text-[12px] font-semibold text-[#4A4658] hover:bg-[#EEEBF4] inline-flex items-center gap-1"><Plus className="w-3 h-3" />{p}</button>
                            ))}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
                <datalist id="sp-day-names">{[...new Set([...(template?.shifts.map(s => s.name) ?? []), ...EVENT_TYPES])].map(n => <option key={n} value={n} />)}</datalist>

                {editorPeople.length > 0 && (
                  <Card className="mt-3 p-4">
                    <p className="text-[13px] font-bold text-[#4A4658]">Editing <span className="font-medium text-[#6B6680]">— optional, can be set later</span></p>
                    <div className="mt-2 space-y-2">
                      {editorPeople.map(m => (
                        <div key={m.id} className="flex items-center gap-2 flex-wrap">
                          <span className="flex-1 min-w-[120px] text-sm text-[#17151F]">{fullName(m)}</span>
                          {(["photo_editor", "video_editor"] as const).filter(r => m.memberRoles.includes(r)).map(r => {
                            const on = editors.some(e => e.userId === m.id && e.role === r);
                            return (
                              <button key={r} type="button" role="checkbox" aria-checked={on}
                                onClick={() => setEditors(on ? editors.filter(e => !(e.userId === m.id && e.role === r)) : [...editors, { userId: m.id, role: r }])}
                                className={cn("h-8 px-3 rounded-full text-[12px] font-semibold inline-flex items-center gap-1", on ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658]")}>
                                {on && <Check className="w-3 h-3" />}{ROLE_NAME[r]}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </Section>

              <Section n={4} title="Money from the client" done={step4}>
                <Card>
                  <div className="grid sm:grid-cols-2">
                    <Field label="Contract amount" required>{() => <Money value={money.total} onChange={v => setMoney(m => ({ ...m, total: v }))} label="Contract amount" big />}</Field>
                    <Field label="Discount">{() => <Money value={money.discount} onChange={v => setMoney(m => ({ ...m, discount: v }))} label="Discount" />}</Field>
                  </div>
                  <div className="border-t border-[#EEEBF4] grid sm:grid-cols-2">
                    <Field label={isEdit ? "Advance (use Record payment for more)" : "Advance received now"}>{() => <Money value={money.advance} onChange={v => setMoney(m => ({ ...m, advance: v }))} label="Advance" readOnly={isEdit} />}</Field>
                    {!isEdit && advance > 0 ? (
                      <Field label="Paid by">{() => (
                        <div className="flex flex-wrap gap-1.5">
                          {METHODS.map(o => <button key={o.v} type="button" onClick={() => setMoney(m => ({ ...m, method: o.v }))}
                            className={cn("h-9 px-3 rounded-full text-[12px] font-semibold", money.method === o.v ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658]")}>{o.l}</button>)}
                        </div>
                      )}</Field>
                    ) : (
                      <div className="px-4 py-3.5 flex flex-col justify-center">
                        <p className="text-[13px] font-semibold text-[#4A4658]">Still owes</p>
                        <p className={cn("text-xl font-extrabold tabular-nums", due > 0 ? "text-[#C2304F]" : "text-[#1F8A5B]")}>{formatCurrency(Math.max(0, due))}</p>
                      </div>
                    )}
                  </div>
                </Card>
              </Section>

              <Section n={5} title="Team pay" sub="Built from each person's prices — change any amount" done={bill.entries.length > 0}>
                {bill.entries.length === 0 ? (
                  <Card className="p-4 text-sm text-[#A29DB3]">Add people to shifts above — their pay shows here.</Card>
                ) : (
                  <Card className="divide-y divide-[#EEEBF4]">
                    {bill.entries.map(e => {
                      const m = team.find(t => t.id === e.memberId);
                      const r0 = role((e.role || "").split(", ")[0] || m?.memberRoles[0] || "");
                      const isOpen = openBill === e.id;
                      const missing = (e.lines ?? []).some(l => l.auto && !l.amount);
                      return (
                        <div key={e.id}>
                          <button type="button" onClick={() => setOpenBill(isOpen ? null : e.id)} aria-expanded={isOpen} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F7F5FB]">
                            <Tile icon={r0.icon} color={r0.tile as TileColor} size={32} />
                            <span className="flex-1 min-w-0">
                              <span className="block text-[15px] font-semibold text-[#17151F] truncate">{e.memberName}</span>
                              <span className="block text-xs text-[#6B6680] truncate">{(e.lines ?? []).map(l => l.label).join(" · ") || e.role}</span>
                            </span>
                            {missing && <span className="text-[11px] font-bold text-[#C2304F] bg-[#FDECEF] px-2 py-0.5 rounded-full">Price missing</span>}
                            <span className="text-[15px] font-bold text-[#17151F] tabular-nums">{formatCurrency(e.totalBill)}</span>
                            <ChevronDown className={cn("w-4 h-4 text-[#6B6680] transition-transform", isOpen && "rotate-180")} />
                          </button>
                          {isOpen && e.memberId && (
                            <div className="px-4 pb-4 space-y-2">
                              {(e.lines ?? []).map(l => (
                                <div key={l.id} className="flex items-center gap-2 rounded-[12px] bg-[#FAF9FC] border border-[#EEEBF4] px-3 py-2">
                                  <div className="flex-1 min-w-0">
                                    {l.auto ? <p className="text-[13px] font-semibold text-[#17151F] truncate">{l.label}</p>
                                      : <input value={l.label} onChange={ev => renameLine(e.memberId!, l.id, ev.target.value)} aria-label="Line name" className="w-full bg-transparent text-[13px] font-semibold text-[#17151F] outline-none" />}
                                    <p className="text-[11px] text-[#6B6680] truncate">
                                      {l.kind === "deduction" ? "Taken off the bill" : [l.unitPrice ? `${l.qty} × ${formatCurrency(l.unitPrice)}` : "", l.note, l.edited ? "changed by you" : ""].filter(Boolean).join(" · ")}
                                    </p>
                                  </div>
                                  <div className="w-[120px]"><Money value={String(l.amount || "")} onChange={v => editLine(e.memberId!, l.id, num(v))} label={`${l.label} amount`} /></div>
                                  {!l.auto && <button type="button" onClick={() => removeLine(e.memberId!, l.id)} aria-label="Remove line" className="w-8 h-8 rounded-full flex items-center justify-center text-[#A29DB3] hover:text-[#C2304F]"><Trash2 className="w-4 h-4" /></button>}
                                </div>
                              ))}
                              <div className="flex flex-wrap gap-2 pt-1">
                                <button type="button" onClick={() => addLine(e.memberId!, "extra")} className="h-8 px-3 rounded-full bg-[#E9F5EF] text-[#1F8A5B] text-[12px] font-semibold inline-flex items-center gap-1"><Plus className="w-3 h-3" />Extra</button>
                                <button type="button" onClick={() => addLine(e.memberId!, "deduction")} className="h-8 px-3 rounded-full bg-[#FDECEF] text-[#C2304F] text-[12px] font-semibold inline-flex items-center gap-1"><Minus className="w-3 h-3" />Cut</button>
                                {(e.paidAmount ?? 0) > 0 && <span className="ml-auto text-xs text-[#6B6680] self-center">Paid {formatCurrency(e.paidAmount ?? 0)} · owes {formatCurrency(Math.max(0, e.totalBill - (e.paidAmount ?? 0)))}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between px-4 py-3 bg-[#FAF9FC] rounded-b-[20px]">
                      <span className="text-[13px] font-bold text-[#4A4658]">Team total</span>
                      <span className="text-[15px] font-extrabold text-[#17151F] tabular-nums">{formatCurrency(teamCost)}</span>
                    </div>
                  </Card>
                )}
              </Section>

              <Section n={6} title="Other costs & notes">
                <Card>
                  <div className="grid grid-cols-2">
                    <Field label="Transport">{() => <Money value={money.transport} onChange={v => setMoney(m => ({ ...m, transport: v }))} label="Transport" />}</Field>
                    <Field label="Album / print">{() => <Money value={money.album} onChange={v => setMoney(m => ({ ...m, album: v }))} label="Album / print" />}</Field>
                    <Field label="Equipment rent" hint={bill.rentedFromOutside > 0 ? `+ ${formatCurrency(bill.rentedFromOutside)} from rented gear on shifts` : undefined}>{() => <Money value={money.equipExtra} onChange={v => setMoney(m => ({ ...m, equipExtra: v }))} label="Equipment rent" />}</Field>
                    <Field label="Other">{() => <Money value={money.other} onChange={v => setMoney(m => ({ ...m, other: v }))} label="Other cost" />}</Field>
                  </div>
                  <div className="border-t border-[#EEEBF4]">
                    <Field label="Private notes" hint="Only your team sees these.">{id => <textarea id={id} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special instructions, reminders…" className={cn(inputCls, "h-auto py-2.5 resize-none")} />}</Field>
                  </div>
                </Card>
              </Section>

              <div className="lg:hidden">{summary}</div>
            </div>
            <aside className="hidden lg:block"><div className="sticky top-0">{summary}</div></aside>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-4 bg-white/80 backdrop-blur border-t border-[#EEEBF4] flex items-center gap-3">
          <div className="hidden sm:block flex-1 min-w-0">
            <p className="text-xs text-[#6B6680]">Client owes <strong className="text-[#17151F]">{formatCurrency(Math.max(0, due))}</strong> · Profit <strong className={profit >= 0 ? "text-[#1F8A5B]" : "text-[#C2304F]"}>{formatCurrency(profit)}</strong></p>
          </div>
          <button type="button" onClick={onClose} className="flex-1 sm:flex-none sm:w-32 h-12 rounded-full bg-[#EEEBF4] text-[15px] font-semibold text-[#17151F]">Cancel</button>
          <button type="button" onClick={submit} disabled={saving}
            className="flex-[1.4] sm:flex-none sm:w-52 h-12 rounded-full bg-[#7D5CEF] hover:bg-[#6C4BE0] disabled:opacity-60 text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><Wallet className="w-4 h-4" />{isEdit ? "Save changes" : "Create program"}</>}
          </button>
        </div>
      </div>

      <AssignDrawer open={assign.open} onClose={() => setAssign({ open: false, start: null, editing: null })} days={typedDays}
        start={assign.start} editing={assign.editing} team={team} studio={studio}
        busyIds={new Set(assignDay?.date ? busy[assignDay.date] ?? [] : [])}
        onSave={savePerson} onNewFreelancer={m => setTeam(t => [...t, m])} />
    </>
  );
}

function Row({ l, v, strong, tone, sub }: { l: string; v: string; strong?: boolean; tone?: "red" | "green"; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn("text-[#6B6680]", strong && "font-semibold text-[#17151F]")}>{l}</span>
      <span className={cn("tabular-nums", strong ? "text-[16px] font-extrabold" : "font-semibold text-[#17151F]", tone === "red" && "text-[#C2304F]", tone === "green" && "text-[#1F8A5B]")}>
        {v}{sub && <span className="ml-1 text-xs font-semibold text-[#6B6680]">{sub}</span>}
      </span>
    </div>
  );
}
