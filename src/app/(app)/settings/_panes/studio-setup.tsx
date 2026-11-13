"use client";

/**
 * Settings that live in companies.settings (GET/PATCH /companies/settings):
 * features, work types, shift templates, team pay and delivery rules.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Clock, Loader2, Plus, Star, Tag, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, API_URL as API } from "@/lib/api";
import { Tile, type TileColor } from "@/components/ui/apple";
import { RateEditor, TEAM_ROLES, firstLine, linesToRates, ratesToLines, type RateLine, type RoleInfo } from "../../team/_components/rate-card";
import { askConfirm } from "@/components/feedback";
import { Group, Row, Segmented, SoonRow, Switch, useSettings, useSynced, type WorkType } from "../_ui";
import { fmtMoney } from "@/lib/format";
import { DEFAULT_SHIFTS, type StudioShift } from "@/lib/shifts";

/** Shown while studio settings load (or if the server is older). */
function NeedStudio({ children }: { children: React.ReactNode }) {
  const { studio } = useSettings();
  if (!studio) return (
    <div className="bg-white rounded-[20px] p-8 flex flex-col items-center text-center shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]">
      <Loader2 className="w-5 h-5 animate-spin text-[#7D5CEF]" />
      <p className="text-sm text-[#6B6680] mt-3">Loading… If this doesn&apos;t finish, refresh the page.</p>
    </div>
  );
  return <>{children}</>;
}

// ─── Features ─────────────────────────────────────────────────────────────────
export function FeaturesPane() {
  return <NeedStudio><Features /></NeedStudio>;
}
function Features() {
  const { studio, patchStudio } = useSettings();
  const f = studio!.features;
  const set = (k: keyof typeof f, v: boolean) => patchStudio("features", { ...f, [k]: v });
  return (
    <>
      <Group title="Client features" note="Turn off what your studio doesn't use — it disappears from programs and the client portal. You can turn it back on any time.">
        <Row id="f-photoSelection" label="Photo selection" hint="Clients pick the photos for their albums in their portal — from the program's Drive files or your upload">
          <Switch label="Photo selection" on={f.photoSelection} onChange={v => set("photoSelection", v)} />
        </Row>
        <Row id="f-musicSelection" label="Music selection" hint="Clients choose songs for their video from your list or a YouTube link">
          <Switch label="Music selection" on={f.musicSelection} onChange={v => set("musicSelection", v)} />
        </Row>
      </Group>
      <Group title="Studio features">
        <Row id="f-albumTracking" label="Album tracking" hint="Follow each album from design to print to hand-over">
          <Switch label="Album tracking" on={f.albumTracking} onChange={v => set("albumTracking", v)} />
        </Row>
      </Group>
      <Group title="Coming soon">
        <SoonRow id="f-faceRecognition" label="Face recognition" hint="Guests take a selfie and see only their own photos" />
      </Group>
    </>
  );
}

// ─── Program types (and the parts each one has) ──────────────────────────────
export function WorkTypesPane() {
  return <NeedStudio><WorkTypes /></NeedStudio>;
}
const newId = () => Math.random().toString(36).slice(2, 10);

function WorkTypes() {
  const { studio, patchStudio } = useSettings();
  const types = studio!.workTypes;
  const saveTypes = (next: WorkType[]) => patchStudio("workTypes", next);
  const [adding, setAdding] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <Group title="Program types" note="Pick a type when you add a program (or a package) and its parts fill in as days — e.g. Wedding → Ceremony, Wedding, Reception. A type with no parts gets one day. Turn off the ones you don't do; old programs keep theirs.">
        <div id="set-workTypes" className="sp-set-row scroll-mt-28 divide-y divide-[#EEEBF4]">
          {types.map((t, i) => (
            <TypeCard key={t.id} type={t} open={open === t.id} onToggle={() => setOpen(o => o === t.id ? null : t.id)}
              onChange={next => saveTypes(types.map((x, j) => j === i ? next : x))}
              onRemove={async () => {
                if (await askConfirm({ title: `Remove "${t.name}"?`, message: "Old programs keep this type and their days. New programs can't pick it.", confirmLabel: "Remove", danger: true }))
                  saveTypes(types.filter((_, j) => j !== i));
              }} />
          ))}
          <form className="px-4 sm:px-5 py-3 flex items-center gap-3"
            onSubmit={e => {
              e.preventDefault(); const n = adding.trim(); if (!n) return;
              const t = { id: newId(), name: n, active: true, events: [] };
              saveTypes([...types, t]).then(ok => { if (ok) { setAdding(""); setOpen(t.id); } });
            }}>
            <input aria-label="New program type" value={adding} onChange={e => setAdding(e.target.value)} placeholder="Add a program type, e.g. Corporate, Akika"
              maxLength={60} className="flex-1 h-10 rounded-full bg-[#F5F3FA] px-4 text-sm text-[#17151F] placeholder:text-[#9893A8] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40" />
            <button type="submit" disabled={!adding.trim()}
              className="h-10 px-4 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
              <Plus className="w-4 h-4" /> Add type
            </button>
          </form>
        </div>
      </Group>
    </>
  );
}

/** One program type: tap to open its parts (smooth open/close). */
function TypeCard({ type: t, open, onToggle, onChange, onRemove }: {
  type: WorkType; open: boolean; onToggle: () => void; onChange: (t: WorkType) => void; onRemove: () => void;
}) {
  const [part, setPart] = useState("");
  const events = t.events ?? [];
  const setEvents = (ev: WorkType["events"]) => onChange({ ...t, events: ev });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= events.length) return;
    const n = [...events]; [n[i], n[j]] = [n[j], n[i]]; setEvents(n);
  };
  return (
    <div className={cn("transition-colors", open && "bg-[#FBFAFE]")}>
      <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2">
        <button type="button" onClick={onToggle} aria-expanded={open} aria-label={open ? `Close ${t.name}` : `Open ${t.name}`}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F0EDF6]">
          <ChevronRight className={cn("w-4 h-4 transition-transform duration-300", open && "rotate-90")} />
        </button>
        <NameInput label="Program type name" value={t.name} bold className="flex-1"
          onCommit={v => v && onChange({ ...t, name: v })} />
        <button type="button" onClick={onToggle}
          className={cn("hidden sm:inline-flex h-7 px-2.5 rounded-full text-[11px] font-semibold items-center whitespace-nowrap",
            events.length ? "bg-[#EEE8FD] text-[#5B3FD0]" : "bg-[#F5F3FA] text-[#6B6680]")}>
          {events.length ? `${events.length} part${events.length === 1 ? "" : "s"}` : "1 day"}
        </button>
        <Switch label={`${t.name} on`} on={t.active} onChange={v => onChange({ ...t, active: v })} />
        <DeleteBtn label={`Remove ${t.name}`} onClick={onRemove} />
      </div>

      {/* grid-rows 0fr → 1fr gives a smooth height animation */}
      <div className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden">
          <div className="pl-12 sm:pl-14 pr-4 sm:pr-5 pb-3">
            {events.length === 0 && (
              <p className="text-xs text-[#6B6680] py-2">No parts — a program of this type gets one day named &quot;{t.name}&quot;. Add parts if it usually has more (e.g. Seminar, Award night).</p>
            )}
            <ol className="space-y-1.5">
              {events.map((e, i) => (
                <li key={e.id} className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <span className="w-6 h-6 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-xs font-bold flex items-center justify-center flex-shrink-0 tabular-nums">{i + 1}</span>
                  <NameInput label="Part name" value={e.name} className="flex-1"
                    onCommit={v => v && setEvents(events.map((x, j) => j === i ? { ...x, name: v } : x))} />
                  <div className="flex flex-col">
                    <button type="button" aria-label={`Move ${e.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="w-7 h-4 flex items-center justify-center text-[#6B6680] disabled:opacity-25"><ArrowUp className="w-3 h-3" /></button>
                    <button type="button" aria-label={`Move ${e.name} down`} disabled={i === events.length - 1} onClick={() => move(i, 1)} className="w-7 h-4 flex items-center justify-center text-[#6B6680] disabled:opacity-25"><ArrowDown className="w-3 h-3" /></button>
                  </div>
                  <DeleteBtn label={`Remove ${e.name}`} onClick={() => setEvents(events.filter((_, j) => j !== i))} />
                </li>
              ))}
            </ol>
            {events.length < 12 && (
              <form className="mt-2 flex items-center gap-2"
                onSubmit={ev => {
                  ev.preventDefault(); const n = part.trim(); if (!n) return;
                  if (events.some(x => x.name.toLowerCase() === n.toLowerCase())) return;
                  setEvents([...events, { id: newId(), name: n }]); setPart("");
                }}>
                <input aria-label={`New part for ${t.name}`} value={part} onChange={e => setPart(e.target.value)} placeholder="Add a part, e.g. Engagement"
                  maxLength={60} className="flex-1 h-9 rounded-full bg-white border border-[#E6E2EE] px-4 text-sm placeholder:text-[#9893A8] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40" />
                <button type="submit" disabled={!part.trim()} className="h-9 px-3.5 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center gap-1 disabled:opacity-50">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NameInput({ value, onCommit, label, className, bold }: {
  value: string; onCommit: (v: string) => void; label: string; className?: string; bold?: boolean;
}) {
  const [v, setV] = useSynced(value);
  return (
    <input aria-label={label} value={v} maxLength={60} onChange={e => setV(e.target.value)}
      onBlur={() => { const n = v.trim(); if (!n) setV(value); else if (n !== value) onCommit(n); }}
      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setV(value); }}
      className={`min-w-0 h-10 rounded-full bg-transparent hover:bg-[#F5F3FA] focus:bg-[#F5F3FA] px-3 -ml-3 text-sm text-[#17151F] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40 transition-colors ${bold ? "font-bold" : "font-medium"} ${className ?? ""}`} />
  );
}

function DeleteBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#FDECEF] hover:text-[#C2304F] flex-shrink-0">
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

// ─── Team & pay ───────────────────────────────────────────────────────────────
export function TeamPayPane() {
  return <NeedStudio><TeamPay /></NeedStudio>;
}
function TeamPay() {
  const { studio, patchStudio } = useSettings();
  const mode = studio!.teamPay.mode;
  return (
    <>
      <Group title="Pay" note={mode === "per_shift"
        ? `Example: a photographer's rate is ${fmtMoney(3000)} a shift. A wedding with three parts (ceremony, wedding, reception) = ${fmtMoney(9000)}.`
        : `Example: a photographer's rate is ${fmtMoney(8000)} a program, however many shifts it has.`}>
        <Row id="teamPay" label="Pay team by" hint="New prices start with this unit — you can pick another for each price">
          <Segmented label="Pay team by" value={mode} onChange={v => patchStudio("teamPay", { mode: v })}
            options={[{ value: "per_shift", label: "Per shift" }, { value: "per_program", label: "Per program" }]} />
        </Row>
      </Group>
      <StudioRates />
    </>
  );
}

/** Studio-wide prices: used for any member who has no price of their own for that work. */
function StudioRates() {
  const { studio, patchStudio } = useSettings();
  const [lines, setLines] = useState<RateLine[]>(() => ratesToLines(studio!.studioRates));
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const workTypes = studio!.workTypes.filter(w => w.active);

  useEffect(() => {
    apiFetch(`${API}/team/custom-roles`).then(r => r.ok ? r.json() : []).then(d => setCustomRoles(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  function change(next: RateLine[]) {
    setLines(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => patchStudio("studioRates", linesToRates(next)), 900);
  }

  const roles: RoleInfo[] = [...TEAM_ROLES, ...customRoles.map(c => ({ id: c, label: c, icon: Tag, tile: "violet" }))];
  const withLines = roles.filter(r => lines.some(l => l.roleId === r.id));
  const without = roles.filter(r => !lines.some(l => l.roleId === r.id));

  return (
    <>
      <Group title="Studio prices" note={<>One price list for the whole studio. A member uses these unless their own profile has a different price. <strong>Work only</strong> = they use someone else&apos;s gear; <strong>With own setup</strong> = they bring their own. Saved by itself.</>}>
        <RateEditor roles={withLines} lines={lines} onChange={change} workTypes={workTypes}
          emptyText="No studio prices yet — add the kinds of work below." />
      </Group>
      {without.length > 0 && (
        <div className="-mt-4 mb-8">
          <p className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">Add prices for</p>
          <div className="flex flex-wrap gap-2">
            {without.map(r => {
              const Icon = r.icon;
              return (
                <button key={r.id} type="button" onClick={() => change([...lines, firstLine(r.id, studio!.teamPay.mode)])}
                  className="inline-flex items-center gap-2 h-10 pl-1.5 pr-3.5 rounded-full bg-white text-[13px] font-semibold text-[#4A4658] hover:bg-[#EEEBF4] shadow-[0_1px_2px_rgba(22,18,40,.06)]">
                  <Tile icon={Icon} color={r.tile as TileColor} size={28} /><Plus className="w-3 h-3 -mr-1" />{r.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Delivery ─────────────────────────────────────────────────────────────────
export function DeliveryRulesPane() {
  return <NeedStudio><DeliveryRules /></NeedStudio>;
}
function DeliveryRules() {
  const { studio, patchStudio } = useSettings();
  const d = studio!.delivery;
  return (
    <Group title="Payment" note="When locked, the client sees what is ready but opens it only after paying in full.">
      <Row id="d-lockWhenDue" label="Lock delivery while money is due" hint="Clients can't download their photos and videos until the program is fully paid">
        <Switch label="Lock delivery while money is due" on={d.lockWhenDue} onChange={v => patchStudio("delivery", { ...d, lockWhenDue: v })} />
      </Row>
      <Row id="d-managerCanUnlock" label="Managers can unlock" hint="A manager can open delivery for one program, for example when the client promised to pay" disabled={!d.lockWhenDue}>
        <Switch label="Managers can unlock" on={d.managerCanUnlock} disabled={!d.lockWhenDue}
          onChange={v => patchStudio("delivery", { ...d, managerCanUnlock: v })} />
      </Row>
    </Group>
  );
}

// ─── Pieces used inside other panes ───────────────────────────────────────────
/** Programs pane: the studio's shifts — name and usual time, and which ones a new day starts with. */
export function ShiftsGroup() {
  const { studio, patchStudio } = useSettings();
  const saved = studio?.shifts ?? DEFAULT_SHIFTS;
  const [rows, setRows] = useSynced<StudioShift[]>(saved);
  const [adding, setAdding] = useState("");
  if (!studio) return null;

  const save = async (next: StudioShift[]) => {
    setRows(next);
    if (!(await patchStudio("shifts", next))) setRows(saved);
  };
  const edit = (i: number, p: Partial<StudioShift>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const commit = () => { if (JSON.stringify(rows) !== JSON.stringify(saved)) save(rows); };
  const timeCls = "h-10 w-[112px] rounded-full bg-[#F5F3FA] px-3 text-sm text-[#17151F] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40";

  return (
    <Group title="Shifts" note={<>Your shifts and their usual time. When you add a program day you pick its shifts, and the time is filled in (you can change it for that program). The team sees the time on their program. <Star className="inline w-3 h-3 -mt-0.5 fill-[#E8A33D] text-[#E8A33D]" /> = a new day starts with this shift.</>}>
      <div id="set-shifts" className="sp-set-row scroll-mt-28 divide-y divide-[#EEEBF4]">
        {rows.map((r, i) => (
          <div key={r.id} className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2">
            <input aria-label="Shift name" value={r.name} maxLength={30} onChange={e => edit(i, { name: e.target.value })} onBlur={commit}
              className="flex-1 min-w-[140px] h-10 rounded-full bg-[#F5F3FA] px-4 text-sm font-semibold text-[#17151F] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40" />
            <span className="inline-flex items-center gap-1.5">
              <input type="time" aria-label={`${r.name} starts`} value={r.start ?? ""} onChange={e => edit(i, { start: e.target.value || null })} onBlur={commit} className={timeCls} />
              <span className="text-[#9893A8] text-sm">–</span>
              <input type="time" aria-label={`${r.name} ends`} value={r.end ?? ""} onChange={e => edit(i, { end: e.target.value || null })} onBlur={commit} className={timeCls} />
            </span>
            <button type="button" aria-pressed={r.isDefault} title={r.isDefault ? "New days start with this shift" : "Start new days with this shift"}
              aria-label={`${r.name}: start new days with this shift`}
              onClick={() => save(rows.map((x, j) => (j === i ? { ...x, isDefault: !x.isDefault } : x)))}
              className={cn("w-10 h-10 rounded-full flex items-center justify-center", r.isDefault ? "bg-[#FFF4E0]" : "hover:bg-[#F5F3FA]")}>
              <Star className={cn("w-4 h-4", r.isDefault ? "fill-[#E8A33D] text-[#E8A33D]" : "text-[#A29DB3]")} />
            </button>
            <button type="button" aria-label={`Remove ${r.name}`} disabled={rows.length < 2}
              onClick={async () => {
                if (await askConfirm({ title: `Remove "${r.name}"?`, message: "Programs that already have this shift keep it.", confirmLabel: "Remove", danger: true }))
                  save(rows.filter((_, j) => j !== i));
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[#A29DB3] hover:bg-[#FDECEF] hover:text-[#C2304F] disabled:opacity-30">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <form className="px-4 sm:px-5 py-3 flex items-center gap-3"
          onSubmit={e => {
            e.preventDefault(); const n = adding.trim(); if (!n) return;
            save([...rows, { id: newId(), name: n, start: null, end: null, isDefault: false }]).then(() => setAdding(""));
          }}>
          <input aria-label="New shift" value={adding} onChange={e => setAdding(e.target.value)} placeholder="Add a shift, e.g. Morning, Gaye Holud night" maxLength={30}
            className="flex-1 h-10 rounded-full bg-[#F5F3FA] px-4 text-sm text-[#17151F] placeholder:text-[#9893A8] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40" />
          <button type="submit" disabled={!adding.trim() || rows.length >= 12}
            className="h-10 px-4 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
            <Plus className="w-4 h-4" /> Add shift
          </button>
        </form>
      </div>
      {rows.every(r => !r.isDefault) && (
        <p className="px-4 sm:px-5 py-3 text-xs text-[#6B6680] flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />No ★ shift: a new day starts empty and you choose its shifts.</p>
      )}
    </Group>
  );
}

/** Programs pane: double-booking warning + confirm question. */
export function ProgramRulesGroup() {
  const { studio, patchStudio } = useSettings();
  if (!studio) return null;
  const b = studio.booking;
  return (
    <Group title="Rules">
      <Row id="b-warnDoubleBooking" label="Warn about double booking" hint="Show a warning when a new program is on a date that already has one">
        <Switch label="Warn about double booking" on={b.warnDoubleBooking} onChange={v => patchStudio("booking", { ...b, warnDoubleBooking: v })} />
      </Row>
      <Row id="b-askBeforeConfirm" label="Ask before confirming" hint="Show an &quot;Are you sure?&quot; step before a program is marked Confirmed">
        <Switch label="Ask before confirming" on={b.askBeforeConfirm} onChange={v => patchStudio("booking", { ...b, askBeforeConfirm: v })} />
      </Row>
    </Group>
  );
}

/** General pane: app language. */
export function LanguageGroup() {
  const { studio, patchStudio } = useSettings();
  if (!studio) return null;
  return (
    <Group title="Language" note={studio.language.ui === "bn-smart"
      ? "Smart Bangla: menus and buttons in Bangla, while names, money and dates stay easy to read. Coming soon — your choice is saved. Client pages always stay in English."
      : "Client pages (portal, invoices, messages) are always in English."}>
      <Row id="language" label="App language" hint="For you and your team">
        <Segmented label="App language" value={studio.language.ui} onChange={v => patchStudio("language", { ui: v })}
          options={[{ value: "en", label: "English" }, { value: "bn-smart", label: "Smart Bangla" }]} />
      </Row>
    </Group>
  );
}
