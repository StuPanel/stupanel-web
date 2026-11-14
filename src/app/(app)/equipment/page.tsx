"use client";

/**
 * Equipment: all gear in one place — the studio's and every team member's — and who and what is free on a date.
 * Nothing is typed twice: who works and which gear is out comes from the programs' days and shifts.
 * One gear entry is one unit that goes out as a whole ("Camera" = camera with its lens).
 * Two tabs: "On a date" (people and gear: working / off / free, by shift) and "All gear" (the register with history).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Camera, CalendarDays, Check, ChevronLeft, ChevronRight, Lightbulb, Loader2, Mic, Move3d, Package, Plane,
  Plus, Trash2, UserRound, Users, Wrench,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { timeRange } from "@/lib/shifts";
import { askConfirm, notify } from "@/components/feedback";
import { CARD_SHADOW, EmptyState, MainButton, PageHeader, RowsSkeleton, SearchField, Tile, type TileColor } from "@/components/ui/apple";
import { Field, FormDrawer, FormGroup, MoreDetails, PillPicker, SwitchRow, inputCls } from "@/components/ui/form-kit";

type Kind = "camera" | "light" | "gimbal" | "drone" | "audio" | "other";
type State = "ok" | "service" | "out";
type Place = { bookingId: string; number: string; name: string; day: string; shift: string; start: string | null; end: string | null };
type Use = Place & { date: string; userId: string; usedBy: string };
type Unit = {
  key: string; ownerId: string; ownerName: string; itemId: string; name: string; kind: Kind; state: State; lend: boolean;
  inside: string; rents: Record<string, number> | null;
  brand: string | null; model: string | null; serialNumber: string | null; purchaseDate: string | null; purchasePrice: number | null; currentValue: number | null;
  timesOut: number; programs: number; outToday: boolean; next: Use | null; last: Use | null;
};
type Register = { today: string; kinds: { id: Kind; name: string; total: number; studio: number; members: number }[]; units: Unit[]; owners: { id: string; name: string }[] };
type Item = { key: string; name: string; owner: string; ownerId: string };
type Board = {
  date: string; today: string;
  people: { role: string; total: number; working: { id: string; name: string; as: string; where: Place[] }[]; off: { id: string; name: string; note: string }[]; free: { id: string; name: string }[] }[];
  gear: { kind: Kind; name: string; total: number; out: (Item & { usedBy: string; where: Place[] })[]; service: Item[]; withOwner: (Item & { ownerOut: boolean })[]; free: Item[]; broken: Item[] }[];
  clashes: { type: "person" | "gear"; id: string; name: string; date: string; a: Place; b: Place }[];
  programs: Place[];
  shifts: { id: string; name: string; start: string | null; end: string | null }[];
};
type History = { rent?: number; rows: (Place & { date: string; usedBy: string })[]; users: { name: string; times: number }[]; programs: number };

const KIND: Record<Kind, { name: string; icon: React.ElementType; color: TileColor }> = {
  camera: { name: "Camera", icon: Camera, color: "ink" }, light: { name: "Light setup", icon: Lightbulb, color: "orchid" },
  gimbal: { name: "Gimbal", icon: Move3d, color: "blue" }, drone: { name: "Drone", icon: Plane, color: "teal" },
  audio: { name: "Audio", icon: Mic, color: "violet" }, other: { name: "Other", icon: Package, color: "deep" },
};
const STATE: Record<State, { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-[#E9F5EF] text-[#1F8A5B]" },
  service: { label: "In service", cls: "bg-[#FFF3E0] text-[#7A4800]" },
  out: { label: "Out of use", cls: "bg-[#EEEDF2] text-[#4A4658]" },
};
const ROLE: Record<string, string> = { photographer: "Photographers", cinematographer: "Cinematographers", drone_pilot: "Drone pilots", assistant: "Assistants" };
const roleName = (r: string) => ROLE[r] ?? r.replace(/[_-]+/g, " ").replace(/^./, c => c.toUpperCase());
const err = async (r: Response) => { const d = await r.json().catch(() => ({})); return (Array.isArray(d.message) ? d.message[0] : d.message) || "Something went wrong"; };
const asDate = (d: string) => new Date(`${d}T12:00:00Z`);
const longDate = (d: string) => asDate(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const shortDate = (d: string) => asDate(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const addDays = (d: string, n: number) => { const x = asDate(d); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const placeText = (p: Place) => [p.number, p.name, p.day].filter(Boolean).join(" · ");
const shiftText = (p: { shift: string; start: string | null; end: string | null }) => [p.shift, timeRange(p.start, p.end)].filter(Boolean).join(" · ") || "Whole day";

export default function EquipmentPage() {
  const [tab, setTab] = useState<"date" | "all">("date");
  const [reg, setReg] = useState<Register | null>(null);
  const [form, setForm] = useState<{ unit?: Unit } | null>(null);
  /** Goes up after a change so the board for the date is read again. */
  const [ver, setVer] = useState(0);

  const loadReg = useCallback(async () => {
    const r = await apiFetch(`${API}/equipment/register`).catch(() => null);
    if (r?.ok) setReg(await r.json());
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadReg(); }, [loadReg]);

  const tabs = [{ id: "date" as const, label: "Free on a date", icon: CalendarDays }, { id: "all" as const, label: "All gear", icon: Wrench, n: reg?.units.filter(u => u.state !== "out").length }];

  return (
    <div>
      <PageHeader icon={Wrench} color="ink" title="Equipment" sub="Your gear and your team's in one place — and who and what is free on a date">
        <MainButton icon={Plus} onClick={() => setForm({})}>Add studio gear</MainButton>
      </PageHeader>

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 mb-4 [scrollbar-width:none]" role="tablist" aria-label="Equipment">
        {tabs.map(t => { const on = tab === t.id; return (
          <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.id)}
            className={cn("h-11 pl-3.5 pr-4 rounded-full text-[13.5px] font-bold whitespace-nowrap inline-flex items-center gap-2 transition-all flex-shrink-0",
              on ? "bg-[#7D5CEF] text-white shadow-[0_10px_22px_-12px_rgba(125,92,239,.9)]" : "bg-white text-[#4A4658] hover:bg-[#F5F3FA]")}>
            <t.icon className="w-4 h-4" />{t.label}
            {t.n != null && <span className={cn("h-5 min-w-5 px-1.5 rounded-full text-[11.5px] font-bold inline-flex items-center justify-center tabular-nums", on ? "bg-white/25" : "bg-[#F5F3FA] text-[#6B6680]")}>{t.n}</span>}
          </button>
        ); })}
      </div>

      {tab === "date" ? <DateBoard key={ver} /> : <AllGear reg={reg} onOpen={u => setForm({ unit: u })} onAdd={() => setForm({})} />}

      {form && <GearDrawer unit={form.unit} onClose={() => setForm(null)} onSaved={async text => { notify(text); setForm(null); setVer(v => v + 1); await loadReg(); }} />}
    </div>
  );
}

/* ───────── On a date: who and what is working, off and free ───────── */

function Count({ n, label, tone }: { n: number; label: string; tone: "free" | "out" | "off" | "plain" }) {
  const cls = tone === "free" ? "text-[#1F8A5B]" : tone === "out" ? "text-[#1F5C99]" : tone === "off" ? "text-[#7A4800]" : "text-[#6B6680]";
  return <span className="inline-flex items-baseline gap-1"><b className={cn("text-[15px] tabular-nums", cls)}>{n}</b><span className="text-[12.5px] text-[#6B6680]">{label}</span></span>;
}
const Line = ({ title, sub, tone }: { title: React.ReactNode; sub?: React.ReactNode; tone: "free" | "out" | "off" | "plain" }) => (
  <li className="flex items-start gap-2.5 py-1.5">
    <span className={cn("mt-[7px] w-2 h-2 rounded-full flex-shrink-0", tone === "free" ? "bg-[#1F8A5B]" : tone === "out" ? "bg-[#1F5C99]" : tone === "off" ? "bg-[#E08A00]" : "bg-[#A29DB3]")} />
    <span className="min-w-0"><span className="block text-[14px] font-semibold text-[#17151F]">{title}</span>{sub && <span className="block text-[12.5px] text-[#6B6680] leading-snug">{sub}</span>}</span>
  </li>
);
const Part = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><p className="text-[11.5px] font-bold uppercase tracking-wide text-[#A29DB3] mt-3 mb-0.5">{label}</p><ul>{children}</ul></div>
);

function DateBoard() {
  const [date, setDate] = useState("");
  const [shift, setShift] = useState("");
  const [b, setB] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const s = b?.shifts.find(x => x.id === shift);
    const qs = new URLSearchParams({ ...(date ? { date } : {}), ...(s ? { label: s.name, ...(s.start && s.end ? { start: s.start, end: s.end } : {}) } : {}) });
    apiFetch(`${API}/equipment/board?${qs}`).then(r => (r.ok ? r.json() : null)).then((d: Board | null) => { if (live && d) { setB(d); if (!date) setDate(d.date); } }).catch(() => {}).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // The list of shifts comes with the first answer; choosing one asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, shift]);

  if (!b) return loading ? <RowsSkeleton n={5} /> : <EmptyState icon={CalendarDays} title="Couldn't load this" text="Check your connection and open the page again." />;
  const day = date || b.date;
  const chip = (on: boolean) => cn("h-10 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 flex-shrink-0 transition-colors", on ? "bg-[#17151F] text-white" : "bg-white text-[#4A4658] hover:bg-[#F5F3FA]");
  const anyGear = b.gear.length > 0;

  return (
    <div className={cn("transition-opacity", loading && "opacity-60")}>
      {/* The date and the shift */}
      <div className={cn("bg-white rounded-[20px] p-3 sm:p-4 mb-3", CARD_SHADOW)}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setDate(addDays(day, -1))} aria-label="The day before" className="w-11 h-11 rounded-full bg-[#F5F3FA] text-[#17151F] inline-flex items-center justify-center flex-shrink-0"><ChevronLeft className="w-5 h-5" /></button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[16px] sm:text-[18px] font-bold text-[#17151F] truncate">{longDate(day)}</p>
            <p className="text-[12.5px] text-[#6B6680]">{day === b.today ? "Today" : day === addDays(b.today, 1) ? "Tomorrow" : day < b.today ? "In the past" : `In ${Math.round((asDate(day).getTime() - asDate(b.today).getTime()) / 86400000)} days`}</p>
          </div>
          <button type="button" onClick={() => setDate(addDays(day, 1))} aria-label="The day after" className="w-11 h-11 rounded-full bg-[#F5F3FA] text-[#17151F] inline-flex items-center justify-center flex-shrink-0"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <input type="date" value={day} onChange={e => e.target.value && setDate(e.target.value)} aria-label="Choose a date" className={cn(inputCls, "flex-1 min-w-0")} />
          {day !== b.today && <button type="button" onClick={() => setDate(b.today)} className="h-11 px-4 rounded-full bg-[#F5F3FA] text-[#17151F] text-[13px] font-semibold flex-shrink-0">Today</button>}
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 mb-4 [scrollbar-width:none]" role="tablist" aria-label="Shift">
        <button type="button" role="tab" aria-selected={!shift} onClick={() => setShift("")} className={chip(!shift)}>Any time that day</button>
        {b.shifts.map(s => (
          <button key={s.id} type="button" role="tab" aria-selected={shift === s.id} onClick={() => setShift(shift === s.id ? "" : s.id)} className={chip(shift === s.id)}>
            {s.name}{s.start && s.end && <span className={cn("text-[12px] font-medium", shift === s.id ? "text-white/70" : "text-[#A29DB3]")}>{timeRange(s.start, s.end)}</span>}
          </button>
        ))}
      </div>

      {/* The same person or gear on two programs at the same time */}
      {b.clashes.length > 0 && (
        <div className="rounded-[20px] bg-[#FDECEF] p-4 mb-4" role="alert">
          <p className="text-[14px] font-bold text-[#C2304F] inline-flex items-center gap-2"><AlertTriangle className="w-4 h-4" />On two programs at the same time</p>
          <ul className="mt-2 space-y-1.5">
            {b.clashes.map((c, i) => (
              <li key={i} className="text-[13.5px] text-[#17151F]"><b>{c.name}</b> — {placeText(c.a)} ({shiftText(c.a)}) and {placeText(c.b)} ({shiftText(c.b)})</li>
            ))}
          </ul>
        </div>
      )}

      {/* Programs on this date */}
      <p className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">Programs on this date</p>
      <div className={cn("bg-white rounded-[20px] mb-6 divide-y divide-[#EEEBF4] overflow-hidden", CARD_SHADOW)}>
        {b.programs.length === 0 ? <p className="px-4 py-4 text-[14px] text-[#6B6680]">No program has a shift on this date — everyone and everything is free.</p> : b.programs.map((p, i) => (
          <Link key={i} href={`/programs/${p.bookingId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#F7F5FB]">
            <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-[#17151F] truncate">{p.name || p.number}{p.day ? ` · ${p.day}` : ""}</span><span className="block text-[12.5px] text-[#6B6680] truncate">{p.number} · {shiftText(p)}</span></span>
            <ChevronRight className="w-4 h-4 text-[#A29DB3] flex-shrink-0" />
          </Link>
        ))}
      </div>

      {/* People */}
      <p className="px-1 mb-2 text-[13px] font-bold text-[#4A4658] inline-flex items-center gap-1.5"><Users className="w-4 h-4" />People</p>
      {b.people.length === 0 ? <div className="mb-6"><EmptyState icon={Users} title="No team members yet" text="Add your photographers and cinematographers in Team — they show here with who is free." /></div> : (
        <div className="grid gap-3 md:grid-cols-2 mb-6">
          {b.people.map(p => (
            <section key={p.role} className={cn("bg-white rounded-[20px] p-4", CARD_SHADOW)} aria-label={roleName(p.role)}>
              <div className="flex items-center gap-3">
                <Tile icon={UserRound} color="violet" size={40} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-bold text-[#17151F] truncate">{roleName(p.role)}</h3>
                  <p className="text-[13px] text-[#6B6680]"><b className="text-[#1F8A5B] text-[15px] tabular-nums">{p.free.length}</b> free of {p.total}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-[#EEEBF4]">
                <Count n={p.free.length} label="free" tone="free" /><Count n={p.working.length} label="working" tone="out" /><Count n={p.off.length} label="day off" tone="off" />
              </div>
              {p.free.length > 0 && <Part label="Free">{p.free.map(x => <Line key={x.id} tone="free" title={x.name} />)}</Part>}
              {p.working.length > 0 && <Part label="Working">{p.working.map(x => <Line key={x.id} tone="out" title={x.name} sub={x.where.map(w => `${placeText(w)} — ${shiftText(w)}`).join("; ")} />)}</Part>}
              {p.off.length > 0 && <Part label="Day off">{p.off.map(x => <Line key={x.id} tone="off" title={x.name} sub={x.note || undefined} />)}</Part>}
            </section>
          ))}
        </div>
      )}

      {/* Gear */}
      <p className="px-1 mb-2 text-[13px] font-bold text-[#4A4658] inline-flex items-center gap-1.5"><Wrench className="w-4 h-4" />Gear</p>
      {!anyGear ? <EmptyState icon={Wrench} title="No gear in the list yet" text="Add the studio's gear here, and each member's own gear in their profile. Then this shows how many are free." /> : (
        <div className="grid gap-3 md:grid-cols-2 mb-3">
          {b.gear.map(g => { const k = KIND[g.kind]; return (
            <section key={g.kind} className={cn("bg-white rounded-[20px] p-4", CARD_SHADOW)} aria-label={k.name}>
              <div className="flex items-center gap-3">
                <Tile icon={k.icon} color={k.color} size={40} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-bold text-[#17151F] truncate">{k.name}</h3>
                  <p className="text-[13px] text-[#6B6680]"><b className="text-[#1F8A5B] text-[15px] tabular-nums">{g.free.length}</b> free of {g.total}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-[#EEEBF4]">
                <Count n={g.free.length} label="free" tone="free" /><Count n={g.out.length} label="out" tone="out" />
                {g.service.length > 0 && <Count n={g.service.length} label="in service" tone="off" />}
                {g.withOwner.length > 0 && <Count n={g.withOwner.length} label="only with its owner" tone="plain" />}
              </div>
              {g.free.length > 0 && <Part label="Free">{g.free.map(x => <Line key={x.key} tone="free" title={x.name} sub={x.owner === "Studio" ? "Studio" : `${x.owner}'s — others can use it`} />)}</Part>}
              {g.out.length > 0 && <Part label="Out">{g.out.map(x => <Line key={x.key} tone="out" title={x.name} sub={<>{x.owner === "Studio" ? "Studio" : `${x.owner}'s`} · used by {x.usedBy}<br />{x.where.map(w => `${placeText(w)} — ${shiftText(w)}`).join("; ")}</>} />)}</Part>}
              {g.service.length > 0 && <Part label="In service">{g.service.map(x => <Line key={x.key} tone="off" title={x.name} sub={x.owner === "Studio" ? "Studio" : `${x.owner}'s`} />)}</Part>}
              {g.withOwner.length > 0 && <Part label="Only with its owner">{g.withOwner.map(x => <Line key={x.key} tone="plain" title={x.name} sub={`${x.owner}'s — comes when ${x.owner} works${x.ownerOut ? " (out now with other gear)" : ""}`} />)}</Part>}
            </section>
          ); })}
        </div>
      )}
      {anyGear && <p className="px-1 text-xs text-[#6B6680] leading-relaxed mb-6">Counted from the shifts of your programs. A person who works with their own setup takes all of their own gear. Gear rented from a shop is not counted. A member&apos;s gear is free for others only when “Others can use it” is on.</p>}
    </div>
  );
}

/* ───────── All gear ───────── */

function AllGear({ reg, onOpen, onAdd }: { reg: Register | null; onOpen: (u: Unit) => void; onAdd: () => void }) {
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState<"all" | "studio" | "team">("all");
  const [kind, setKind] = useState<Kind | "">("");
  const list = useMemo(() => {
    const w = q.trim().toLowerCase();
    return (reg?.units ?? []).filter(u => (owner === "all" || (owner === "studio") === (u.ownerId === "studio")) && (!kind || u.kind === kind)
      && (!w || `${u.name} ${u.ownerName} ${u.inside} ${u.brand ?? ""} ${u.model ?? ""} ${u.serialNumber ?? ""} ${KIND[u.kind].name}`.toLowerCase().includes(w)));
  }, [reg, q, owner, kind]);
  if (!reg) return <RowsSkeleton n={6} />;
  if (reg.units.length === 0) return (
    <EmptyState icon={Wrench} title="No gear in the list yet" text="Add the studio's cameras, light setups, gimbals and drones here. Each team member's own gear is added in their profile (Team) and shows here too."
      action={<MainButton icon={Plus} onClick={onAdd}>Add studio gear</MainButton>} />
  );
  const chip = (on: boolean) => cn("h-10 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 flex-shrink-0 transition-colors", on ? "bg-[#17151F] text-white" : "bg-white text-[#4A4658] hover:bg-[#F5F3FA]");
  const kinds = reg.kinds.filter(k => k.total > 0);
  return (
    <div>
      {/* How many of each kind */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {kinds.map(k => { const c = KIND[k.id]; const on = kind === k.id; return (
          <button key={k.id} type="button" aria-pressed={on} onClick={() => setKind(on ? "" : k.id)} className={cn("text-left bg-white rounded-[20px] p-3.5 transition-shadow", CARD_SHADOW, on && "ring-2 ring-[#7D5CEF]")}>
            <span className="flex items-center gap-2.5"><Tile icon={c.icon} color={c.color} size={34} /><span className="text-[22px] font-bold text-[#17151F] tabular-nums leading-none">{k.total}</span></span>
            <span className="block text-[13.5px] font-bold text-[#17151F] mt-2">{c.name}</span>
            <span className="block text-[12px] text-[#6B6680]">Studio {k.studio} · Team {k.members}</span>
          </button>
        ); })}
      </div>
      <SearchField className="mb-3" value={q} onChange={setQ} placeholder="Search gear, owner or serial number" />
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 mb-4 [scrollbar-width:none]" role="tablist" aria-label="Whose gear">
        {([["all", "All"], ["studio", "Studio's"], ["team", "Team's"]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={owner === id} onClick={() => setOwner(id)} className={chip(owner === id)}>{label}</button>
        ))}
      </div>
      {list.length === 0 ? <EmptyState icon={Wrench} title="Nothing matches" text="Try another word, or show all gear." /> : (
        <div className={cn("bg-white rounded-[20px] divide-y divide-[#EEEBF4] overflow-hidden mb-6", CARD_SHADOW)}>
          {list.map(u => { const c = KIND[u.kind]; return (
            <button key={u.key} type="button" onClick={() => onOpen(u)} className="w-full text-left flex items-center gap-3 px-4 py-3 min-h-[68px] hover:bg-[#F7F5FB]">
              <Tile icon={c.icon} color={c.color} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold text-[#17151F] truncate">{u.name}</span>
                <span className="block text-[12.5px] text-[#6B6680] truncate">{c.name} · {u.ownerId === "studio" ? "Studio" : `${u.ownerName}'s${u.lend ? " · others can use it" : ""}`}</span>
                <span className={cn("block text-[12.5px] truncate mt-0.5", u.outToday ? "font-semibold text-[#1F5C99]" : "text-[#6B6680]")}>
                  {u.outToday && u.next ? `Out today — ${u.next.usedBy}, ${u.next.name || u.next.number}` : u.next ? `Next: ${shortDate(u.next.date)} — ${u.next.usedBy}, ${u.next.name || u.next.number}` : u.timesOut ? `Went out ${u.timesOut} time${u.timesOut === 1 ? "" : "s"} · nothing coming up` : "Not used on a program yet"}
                </span>
              </span>
              {u.state !== "ok" && <span className={cn("text-[11.5px] font-bold px-2.5 py-1 rounded-full flex-shrink-0", STATE[u.state].cls)}>{STATE[u.state].label}</span>}
              <ChevronRight className="w-4 h-4 text-[#A29DB3] flex-shrink-0" />
            </button>
          ); })}
        </div>
      )}
    </div>
  );
}

/* ───────── One unit: add / change, and where it went ───────── */

function GearDrawer({ unit, onClose, onSaved }: { unit?: Unit; onClose: () => void; onSaved: (text: string) => void }) {
  const studio = !unit || unit.ownerId === "studio";
  const [name, setName] = useState(unit?.name ?? "");
  const [kind, setKind] = useState<Kind>(unit?.kind ?? "camera");
  const [state, setState] = useState<State>(unit?.state ?? "ok");
  const [inside, setInside] = useState(unit?.inside ?? "");
  const [lend, setLend] = useState(unit?.lend ?? false);
  const [more, setMore] = useState({ brand: unit?.brand ?? "", model: unit?.model ?? "", serialNumber: unit?.serialNumber ?? "", purchaseDate: unit?.purchaseDate?.slice(0, 10) ?? "", purchasePrice: unit?.purchasePrice != null ? String(unit.purchasePrice) : "", currentValue: unit?.currentValue != null ? String(unit.currentValue) : "" });
  const [saving, setSaving] = useState(false);
  const [hist, setHist] = useState<History | null>(null);

  useEffect(() => {
    if (!unit) return;
    apiFetch(`${API}/equipment/history?key=${encodeURIComponent(unit.key)}`).then(r => (r.ok ? r.json() : null)).then(d => d && setHist(d)).catch(() => {});
  }, [unit]);

  async function save() {
    if (saving) return;
    if (studio && name.trim().length < 2) { notify("Write the name of the gear", { error: true }); return; }
    setSaving(true);
    try {
      let r: Response;
      if (studio) {
        const num = (v: string) => (v.trim() === "" ? null : Number(v));
        const body = {
          name: name.trim(), category: kind, status: state === "service" ? "maintenance" : state === "out" ? "retired" : "available", notes: inside.trim() || null,
          brand: more.brand.trim() || null, model: more.model.trim() || null, serialNumber: more.serialNumber.trim() || null,
          purchaseDate: more.purchaseDate || undefined, purchasePrice: num(more.purchasePrice), currentValue: num(more.currentValue),
        };
        r = await apiFetch(unit ? `${API}/equipment/${unit.itemId}` : `${API}/equipment`, { method: unit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        r = await apiFetch(`${API}/equipment/member-gear`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId: unit!.ownerId, itemId: unit!.itemId, lend, state, inside: inside.trim() }) });
      }
      if (!r.ok) { notify(await err(r), { error: true }); return; }
      onSaved(unit ? "Saved" : "Added to your gear");
    } finally { setSaving(false); }
  }
  async function remove() {
    if (!unit || !studio) return;
    if (!(await askConfirm({ message: `Remove “${unit.name}” from your gear? Programs that already used it keep their record.`, danger: true }))) return;
    const r = await apiFetch(`${API}/equipment/${unit.itemId}`, { method: "DELETE" });
    if (!r.ok) { notify(await err(r), { error: true }); return; }
    onSaved("Removed");
  }

  const c = KIND[kind];
  const rent = unit?.rents ? Object.entries(unit.rents).filter(([, v]) => v > 0).map(([u, v]) => `${formatCurrency(v)} ${u.replace("per_", "a ")}`).join(" · ") : "";
  return (
    <FormDrawer open onClose={onClose} icon={c.icon} color={c.color} title={unit ? unit.name : "Add studio gear"}
      sub={unit ? (studio ? "Studio gear" : `${unit.ownerName}'s own gear`) : "One entry is one unit that goes out as a whole"}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F5F3FA] text-[#17151F] text-sm font-semibold">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="flex-1 h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-45">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{unit ? "Save" : "Add gear"}
          </button>
        </>
      }>
      {studio ? (
        <FormGroup title="The gear">
          <Field label="Name" required hint="Your own name for it. A camera goes with its lens — no need to list lenses separately.">
            {id => <input id={id} value={name} onChange={e => setName(e.target.value)} maxLength={200} placeholder={kind === "camera" ? "e.g. Sony A7 IV with 24-70" : kind === "light" ? "e.g. Godox light setup 1" : "e.g. DJI RS 3"} className={inputCls} />}
          </Field>
          <Field label="Kind">{() => <PillPicker label="Kind" value={kind} onChange={v => setKind(v)} options={(Object.keys(KIND) as Kind[]).map(k => ({ value: k, label: KIND[k].name, icon: KIND[k].icon }))} />}</Field>
          <Field label="What is inside (optional)" hint="For your own reference — it is not counted">
            {id => <textarea id={id} value={inside} onChange={e => setInside(e.target.value)} rows={2} maxLength={500} placeholder="e.g. body, 24-70 lens, 2 batteries, charger, bag" className={cn(inputCls, "h-auto py-2.5 resize-none")} />}
          </Field>
        </FormGroup>
      ) : (
        <FormGroup title="The gear" note={<>The name, kind and rent are changed in <Link href={`/team/${unit!.ownerId}`} className="font-semibold text-[#5B3FD0] hover:underline">{unit!.ownerName}&apos;s profile</Link>.</>}>
          <div className="px-4 py-3.5">
            <p className="text-[15px] font-semibold text-[#17151F]">{unit!.name}</p>
            <p className="text-[13px] text-[#6B6680] mt-0.5">{KIND[unit!.kind].name}{rent ? ` · Rent ${rent}` : " · No rent set"}</p>
          </div>
          <SwitchRow label="Others can use it" hint={`On: counted as free for the studio when ${unit!.ownerName} is not out with it. Off: it only comes when ${unit!.ownerName} works.`} on={lend} onChange={setLend} />
          <Field label="What is inside (optional)">
            {id => <textarea id={id} value={inside} onChange={e => setInside(e.target.value)} rows={2} maxLength={200} placeholder="e.g. body, 24-70 lens, 2 batteries" className={cn(inputCls, "h-auto py-2.5 resize-none")} />}
          </Field>
        </FormGroup>
      )}

      <FormGroup title="State" note="In service and Out of use are not counted as free. Whether it is out on a program comes from the programs — you never set that by hand.">
        <Field label="State">{() => <PillPicker label="State" value={state} onChange={v => setState(v)} options={(Object.keys(STATE) as State[]).map(s => ({ value: s, label: STATE[s].label }))} />}</Field>
      </FormGroup>

      {studio && (
        <MoreDetails title="Purchase details" sub="Brand, serial number, price">
          <FormGroup>
            <Field label="Brand">{id => <input id={id} value={more.brand} onChange={e => setMore(m => ({ ...m, brand: e.target.value }))} maxLength={100} className={inputCls} />}</Field>
            <Field label="Model">{id => <input id={id} value={more.model} onChange={e => setMore(m => ({ ...m, model: e.target.value }))} maxLength={100} className={inputCls} />}</Field>
            <Field label="Serial number">{id => <input id={id} value={more.serialNumber} onChange={e => setMore(m => ({ ...m, serialNumber: e.target.value }))} maxLength={100} className={inputCls} />}</Field>
            <Field label="Bought on">{id => <input id={id} type="date" value={more.purchaseDate} onChange={e => setMore(m => ({ ...m, purchaseDate: e.target.value }))} className={inputCls} />}</Field>
            <Field label="Price paid">{id => <input id={id} inputMode="decimal" value={more.purchasePrice} onChange={e => setMore(m => ({ ...m, purchasePrice: e.target.value.replace(/[^\d.]/g, "") }))} className={inputCls} />}</Field>
            <Field label="Worth now">{id => <input id={id} inputMode="decimal" value={more.currentValue} onChange={e => setMore(m => ({ ...m, currentValue: e.target.value.replace(/[^\d.]/g, "") }))} className={inputCls} />}</Field>
          </FormGroup>
        </MoreDetails>
      )}

      {unit && (
        <FormGroup title="Where it went" note={hist && hist.rows.length > 0 ? `${hist.rows.length} time${hist.rows.length === 1 ? "" : "s"} on ${hist.programs} program${hist.programs === 1 ? "" : "s"}${hist.users.length ? ` · most used by ${hist.users[0].name}` : ""}${hist.rent ? ` · rent earned ${formatCurrency(hist.rent)}` : ""}` : undefined}>
          {!hist ? <div className="px-4 py-5 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#A29DB3]" /></div>
            : hist.rows.length === 0 ? <p className="px-4 py-4 text-[14px] text-[#6B6680]">Not used on a program yet. It shows here as soon as someone is put on a shift with it.</p>
            : hist.rows.slice(0, 40).map((r, i) => (
              <Link key={i} href={`/programs/${r.bookingId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#F7F5FB]">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-[#17151F] truncate">{shortDate(r.date)} · {r.name || r.number}{r.day ? ` · ${r.day}` : ""}</span>
                  <span className="block text-[12.5px] text-[#6B6680] truncate">{r.usedBy} · {shiftText(r)}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-[#A29DB3] flex-shrink-0" />
              </Link>
            ))}
        </FormGroup>
      )}

      {unit && studio && (
        <button type="button" onClick={remove} className="mx-auto mb-2 h-11 px-5 rounded-full text-[#C2304F] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#FDECEF]"><Trash2 className="w-4 h-4" />Remove this gear</button>
      )}
    </FormDrawer>
  );
}
