"use client";

/**
 * Settings that live in companies.settings (GET/PATCH /companies/settings):
 * features, work types, shift templates, team pay and delivery rules.
 */
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { askConfirm } from "@/components/feedback";
import { Group, Row, Segmented, SoonRow, Switch, useSettings, useSynced, type ShiftTemplate, type WorkType } from "../_ui";

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
      <Group title="Client features" note="These features are being built. Your choice is saved now and used as soon as each one is ready. Each program will be able to change it too.">
        <Row id="f-photoSelection" label="Photo selection" hint="Clients tick the photos they want for their album, from the program's Drive folder">
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

// ─── Work types & shifts ──────────────────────────────────────────────────────
export function WorkTypesPane() {
  return <NeedStudio><WorkTypes /></NeedStudio>;
}
const newId = () => Math.random().toString(36).slice(2, 10);

function WorkTypes() {
  const { studio, patchStudio } = useSettings();
  const types = studio!.workTypes;
  const templates = studio!.shiftTemplates;
  const saveTypes = (next: WorkType[]) => patchStudio("workTypes", next);
  const saveTemplates = (next: ShiftTemplate[]) => patchStudio("shiftTemplates", next);
  const [adding, setAdding] = useState("");

  return (
    <>
      <Group title="Work types" note="Each new program picks one. Turn off the ones you don't do — old programs keep theirs.">
        <div id="set-workTypes" className="sp-set-row scroll-mt-28 divide-y divide-[#EEEBF4]">
          {types.map((t, i) => (
            <div key={t.id} className="px-4 sm:px-5 py-2.5 flex items-center gap-3">
              <NameInput label="Work type name" value={t.name} className="flex-1"
                onCommit={v => v && saveTypes(types.map((x, j) => j === i ? { ...x, name: v } : x))} />
              <Switch label={`${t.name} on`} on={t.active} onChange={v => saveTypes(types.map((x, j) => j === i ? { ...x, active: v } : x))} />
              <DeleteBtn label={`Remove ${t.name}`} onClick={async () => {
                if (await askConfirm({ title: `Remove "${t.name}"?`, message: "Old programs keep this work type. New programs can't pick it.", confirmLabel: "Remove", danger: true }))
                  saveTypes(types.filter((_, j) => j !== i));
              }} />
            </div>
          ))}
          <form className="px-4 sm:px-5 py-2.5 flex items-center gap-3"
            onSubmit={e => { e.preventDefault(); const n = adding.trim(); if (!n) return; saveTypes([...types, { id: newId(), name: n, active: true }]).then(ok => ok && setAdding("")); }}>
            <input aria-label="New work type" value={adding} onChange={e => setAdding(e.target.value)} placeholder="Add a work type, e.g. Birthday"
              maxLength={60} className="flex-1 h-10 rounded-full bg-[#F5F3FA] px-4 text-sm text-[#17151F] placeholder:text-[#9893A8] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/40" />
            <button type="submit" disabled={!adding.trim()}
              className="h-10 px-4 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>
        </div>
      </Group>

      <div id="set-shiftTemplates" className="sp-set-row scroll-mt-28 rounded-[20px]">
        <div className="px-1 mb-2 flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-bold text-[#4A4658]">Shift templates</h2>
          <button type="button" onClick={() => saveTemplates([...templates, { id: newId(), name: "New template", shifts: [{ id: newId(), name: "Shift 1" }] }])}
            className="h-8 px-3 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-xs font-semibold inline-flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> New template
          </button>
        </div>
        <p className="px-1 -mt-1 mb-3 text-xs text-[#6B6680]">Pick a template when you add a program and its shifts fill in. Team pay per shift uses these.</p>
        {templates.map((t, ti) => {
          const setT = (next: ShiftTemplate) => saveTemplates(templates.map((x, j) => j === ti ? next : x));
          return (
            <Group key={t.id}>
              <div className="px-4 sm:px-5 py-3 flex items-center gap-3 bg-[#FBFAFE]">
                <NameInput label="Template name" value={t.name} bold className="flex-1"
                  onCommit={v => v && setT({ ...t, name: v })} />
                <DeleteBtn label={`Remove ${t.name}`} onClick={async () => {
                  if (await askConfirm({ title: `Remove "${t.name}"?`, message: "Programs that already used it keep their shifts.", confirmLabel: "Remove", danger: true }))
                    saveTemplates(templates.filter((_, j) => j !== ti));
                }} />
              </div>
              {t.shifts.map((sh, si) => (
                <div key={sh.id} className="pl-8 sm:pl-10 pr-4 sm:pr-5 py-2 flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-xs font-bold flex items-center justify-center flex-shrink-0 tabular-nums">{si + 1}</span>
                  <NameInput label="Shift name" value={sh.name} className="flex-1"
                    onCommit={v => v && setT({ ...t, shifts: t.shifts.map((x, j) => j === si ? { ...x, name: v } : x) })} />
                  {t.shifts.length > 1 && (
                    <DeleteBtn label={`Remove ${sh.name}`} onClick={() => setT({ ...t, shifts: t.shifts.filter((_, j) => j !== si) })} />
                  )}
                </div>
              ))}
              {t.shifts.length < 12 && (
                <button type="button" onClick={() => setT({ ...t, shifts: [...t.shifts, { id: newId(), name: `Shift ${t.shifts.length + 1}` }] })}
                  className="w-full pl-8 sm:pl-10 pr-4 py-3 flex items-center gap-2 text-sm font-semibold text-[#5B3FD0] hover:bg-[#F7F4FE]">
                  <Plus className="w-4 h-4" /> Add shift
                </button>
              )}
            </Group>
          );
        })}
      </div>
    </>
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
    <Group title="Pay" note={mode === "per_shift"
      ? "Example: a photographer's rate is ৳3,000 a shift. A wedding with Holud + Wedding + Reception = ৳9,000."
      : "Example: a photographer's rate is ৳8,000 a program, however many shifts it has."}>
      <Row id="teamPay" label="Pay team by" hint="Rates are set on each team member's profile">
        <Segmented label="Pay team by" value={mode} onChange={v => patchStudio("teamPay", { mode: v })}
          options={[{ value: "per_shift", label: "Per shift" }, { value: "per_program", label: "Per program" }]} />
      </Row>
    </Group>
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
    <Group title="Payment" note="This will take effect with the new delivery screen. Your choice is saved now.">
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
