"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus, X, Loader2, Search, Check, AlertTriangle,
  User, CalendarDays, DollarSign, BarChart2,
  ChevronRight, Clock, Tag, ArrowRight, Users,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ClientFormFields, blankClientForm, type ClientFormData } from "@/components/client-form-fields";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { EVENT_TYPES, ROLE_ICONS, fmtDate, uid } from "./constants";
import type { Client, Package, TeamMember, EventDay, CostEntry, Booking } from "./types";

// ─── Wizard State ─────────────────────────────────────────────────────────────
export function blankWizard() {
  return {
    clientMode: "search" as "search" | "new",
    selectedClient: null as Client | null,
    newClient: blankClientForm as ClientFormData,
    eventDays: [] as EventDay[],
    eventName: "",
    packageId: "", currency: "BDT",
    totalAmount: "", discountAmount: "", advanceAmount: "",
    costEntries: [] as CostEntry[],
    transportCost: "", otherCost: "", albumCost: "", equipCost: "",
    internalNotes: "",
  };
}

export function bookingToWizard(b: Booking): ReturnType<typeof blankWizard> {
  return {
    clientMode: "search",
    selectedClient: b.client as Client,
    newClient: blankClientForm,
    eventDays: (b.eventDays as EventDay[]) ?? [],
    eventName: b.eventName ?? "",
    packageId: b.program?.id ?? "",
    currency: b.currency ?? "BDT",
    totalAmount: String(Number(b.totalAmount) || ""),
    discountAmount: String(Number(b.discountAmount) || ""),
    advanceAmount: String(Number(b.advanceAmount) || ""),
    costEntries: (b.costEntries as CostEntry[]) ?? [],
    transportCost: String(Number(b.transportCost) || ""),
    otherCost: String(Number(b.otherCost) || ""),
    albumCost: String(Number(b.albumCost) || ""),
    equipCost: String(Number(b.equipCost) || ""),
    internalNotes: b.internalNotes ?? "",
  };
}

interface BusyInfo {
  busyMemberIds: string[];
  busyDetails: Record<string, { bookingNumber: string; eventName?: string; shiftLabel: string }>;
}

// ─── Step 1: Client ───────────────────────────────────────────────────────────
function Step1Client({ data, onChange }: { data: ReturnType<typeof blankWizard>; onChange: (u: Partial<ReturnType<typeof blankWizard>>) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (data.clientMode !== "search") { setResults([]); return; }
    setSearching(true);
    clearTimeout(timer.current);
    const delay = query.trim() ? 300 : 0;
    timer.current = setTimeout(async () => {
      try {
        const url = query.trim()
          ? `${API}/clients?search=${encodeURIComponent(query)}&limit=100`
          : `${API}/clients?limit=200`;
        const r = await apiFetch(url, { headers: { "Content-Type": "application/json" } });
        if (r.ok) { const d = await r.json(); setResults(d.data ?? []); }
      } finally { setSearching(false); }
    }, delay);
  }, [query, data.clientMode]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={() => onChange({ clientMode: "search", selectedClient: null })}
          className={cn("flex-1 h-10 rounded-xl border text-sm font-medium transition-all",
            data.clientMode === "search" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300")}>
          Search Existing
        </button>
        <button onClick={() => onChange({ clientMode: "new", selectedClient: null })}
          className={cn("flex-1 h-10 rounded-xl border text-sm font-medium transition-all",
            data.clientMode === "new" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300")}>
          + New Client
        </button>
      </div>

      {data.clientMode === "search" ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or phone..." className="pl-9 h-11 border-slate-200" autoFocus />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
          </div>
          {data.selectedClient ? (
            <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
              <div>
                <p className="font-semibold text-indigo-900 text-sm">{data.selectedClient.firstName} {data.selectedClient.lastName ?? ""}</p>
                <p className="text-xs text-indigo-500">{data.selectedClient.phone}</p>
              </div>
              <button onClick={() => onChange({ selectedClient: null })} className="text-indigo-400 hover:text-indigo-600"><X className="w-4 h-4" /></button>
            </div>
          ) : results.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {results.map(c => (
                <button key={c.id} onClick={() => { onChange({ selectedClient: c }); setQuery(""); }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{c.firstName} {c.lastName ?? ""}</p>
                    <p className="text-xs text-slate-400">{c.phone}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
              ))}
            </div>
          ) : !searching && results.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-4">
              {query.trim() ? <>No clients found — <button className="text-indigo-500 underline" onClick={() => onChange({ clientMode: "new" })}>create new</button></> : "No clients yet"}
            </p>
          ) : null}
        </div>
      ) : (
        <ClientFormFields
          value={data.newClient}
          onChange={updates => onChange({ newClient: { ...data.newClient, ...updates } })}
          autoFocus
        />
      )}
    </div>
  );
}

// ─── Step 2: Event Days ───────────────────────────────────────────────────────
function Step2EventDays({ data, onChange, teamMembers, editingBookingId }: {
  data: ReturnType<typeof blankWizard>;
  onChange: (u: Partial<ReturnType<typeof blankWizard>>) => void;
  teamMembers: TeamMember[];
  editingBookingId?: string;
}) {
  const [busyMap, setBusyMap] = useState<Record<string, BusyInfo>>({});

  async function fetchBusy(dayId: string, date: string) {
    if (!date) { setBusyMap(m => { const n = { ...m }; delete n[dayId]; return n; }); return; }
    try {
      const params = new URLSearchParams({ date });
      if (editingBookingId) params.set("excludeBookingId", editingBookingId);
      const r = await apiFetch(`${API}/bookings/busy-members?${params}`, { headers: { "Content-Type": "application/json" } });
      if (r.ok) { const d = await r.json(); setBusyMap(m => ({ ...m, [dayId]: d })); }
    } catch { /* silent */ }
  }

  function addDay() {
    onChange({ eventDays: [...data.eventDays, { id: uid(), eventType: "Wedding", date: "", location: "", shifts: [] }] });
  }
  function removeDay(dayId: string) {
    onChange({ eventDays: data.eventDays.filter(d => d.id !== dayId) });
    setBusyMap(m => { const n = { ...m }; delete n[dayId]; return n; });
  }
  function updateDay(dayId: string, updates: Partial<EventDay>) {
    if (updates.date !== undefined) fetchBusy(dayId, updates.date);
    onChange({ eventDays: data.eventDays.map(d => d.id === dayId ? { ...d, ...updates } : d) });
  }
  function addShift(dayId: string, label: string) {
    const day = data.eventDays.find(d => d.id === dayId);
    if (!day || day.shifts.find(s => s.label === label)) return;
    updateDay(dayId, { shifts: [...day.shifts, { id: uid(), label, memberIds: [] }] });
  }
  function removeShift(dayId: string, shiftId: string) {
    const day = data.eventDays.find(d => d.id === dayId)!;
    updateDay(dayId, { shifts: day.shifts.filter(s => s.id !== shiftId) });
  }
  function toggleMember(dayId: string, shiftId: string, memberId: string) {
    const day = data.eventDays.find(d => d.id === dayId)!;
    updateDay(dayId, {
      shifts: day.shifts.map(s => s.id === shiftId ? {
        ...s,
        memberIds: s.memberIds.includes(memberId) ? s.memberIds.filter(id => id !== memberId) : [...s.memberIds, memberId],
      } : s),
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Program Name *</Label>
        <Input value={data.eventName} onChange={e => onChange({ eventName: e.target.value })}
          placeholder="e.g. James & Emma Wedding" className="h-11 border-slate-200" autoFocus />
      </div>

      {data.eventDays.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
          <CalendarDays className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No event days added</p>
          <p className="text-slate-300 text-xs mt-1">Add each day of the event (Holud, Wedding, Reception...)</p>
          <button onClick={addDay} className="mt-3 flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 text-sm font-medium mx-auto">
            <Plus className="w-4 h-4" />Add First Day
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {data.eventDays.map((day, idx) => {
            const busy = busyMap[day.id];
            const busyCount = busy?.busyMemberIds?.length ?? 0;

            return (
              <div key={day.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</div>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <select value={day.eventType} onChange={e => updateDay(day.id, { eventType: e.target.value })}
                      className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400 text-slate-700">
                      {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <Input type="date" value={day.date} onChange={e => updateDay(day.id, { date: e.target.value })} className="h-9 border-slate-200 text-sm" />
                  </div>
                  <button onClick={() => removeDay(day.id)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {busyCount > 0 && (
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <p className="text-xs text-amber-700 font-medium">
                      {busyCount} member{busyCount > 1 ? "s are" : " is"} already booked on {fmtDate(day.date)} — shown in orange
                    </p>
                  </div>
                )}

                <div className="px-4 pb-4 pt-3 space-y-3">
                  <Input value={day.location} onChange={e => updateDay(day.id, { location: e.target.value })}
                    placeholder="Venue / Location" className="h-9 border-slate-200 text-sm" />

                  <div className="space-y-2">
                    {day.shifts.map(shift => (
                      <div key={shift.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs font-semibold text-slate-700">{shift.label}</span>
                            {shift.memberIds.length > 0 && (
                              <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">{shift.memberIds.length} assigned</span>
                            )}
                          </div>
                          <button onClick={() => removeShift(day.id, shift.id)} className="text-slate-300 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                        </div>
                        {teamMembers.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {teamMembers.map(m => {
                              const selected = shift.memberIds.includes(m.id);
                              const isBusy = !selected && (busy?.busyMemberIds?.includes(m.id) ?? false);
                              const busyDetail = busy?.busyDetails?.[m.id];
                              const RoleIcon = ROLE_ICONS[m.memberRoles[0]]?.icon ?? Tag;
                              return (
                                <div key={m.id} className="relative group">
                                  <button type="button" onClick={() => toggleMember(day.id, shift.id, m.id)}
                                    title={isBusy ? `Busy: ${busyDetail?.bookingNumber ?? ""} — ${busyDetail?.shiftLabel ?? ""}` : undefined}
                                    className={cn("flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-medium transition-all",
                                      selected
                                        ? "bg-indigo-600 text-white border-indigo-600"
                                        : isBusy
                                        ? "bg-amber-50 text-amber-700 border-amber-300 hover:border-amber-500"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300")}>
                                    <RoleIcon className="w-3 h-3" />
                                    {m.firstName} {m.lastName ?? ""}
                                    {selected && <Check className="w-3 h-3" />}
                                    {isBusy && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                                  </button>
                                  {isBusy && busyDetail && (
                                    <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover:flex flex-col bg-slate-900 text-white text-[10px] rounded-lg px-2.5 py-1.5 whitespace-nowrap z-10 shadow-xl">
                                      <span className="font-semibold">{busyDetail.bookingNumber}</span>
                                      {busyDetail.eventName && <span className="text-slate-300">{busyDetail.eventName}</span>}
                                      <span className="text-amber-300">{busyDetail.shiftLabel}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400">No team members — add them in the Team section first</p>
                        )}
                      </div>
                    ))}

                    <div className="flex gap-2 flex-wrap">
                      {["Day Shift", "Night Shift", "Morning", "Evening"].map(label => (
                        !day.shifts.find(s => s.label === label) && (
                          <button key={label} onClick={() => addShift(day.id, label)}
                            className="flex items-center gap-1 h-7 px-2.5 rounded-full border border-dashed border-slate-300 text-xs text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                            <Plus className="w-3 h-3" />{label}
                          </button>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <button onClick={addDay} className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
            <Plus className="w-4 h-4" />Add Another Day
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Package & Financial ─────────────────────────────────────────────
function Step3Financial({ data, onChange, packages, isEdit }: {
  data: ReturnType<typeof blankWizard>;
  onChange: (u: Partial<ReturnType<typeof blankWizard>>) => void;
  packages: Package[];
  isEdit?: boolean;
}) {
  const total = parseFloat(data.totalAmount) || 0;
  const disc = parseFloat(data.discountAmount) || 0;
  const adv = parseFloat(data.advanceAmount) || 0;
  const net = total - disc;
  const due = net - adv;
  const sym = data.currency === "BDT" ? "৳" : "$";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Package</Label>
        <select value={data.packageId} onChange={e => {
          const pkg = packages.find(p => p.id === e.target.value);
          onChange({ packageId: e.target.value, totalAmount: pkg?.basePrice ? String(pkg.basePrice) : data.totalAmount });
        }} className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400 text-slate-700">
          <option value="">No package selected</option>
          {packages.map(p => <option key={p.id} value={p.id}>{p.name}{p.basePrice ? ` — ${sym}${p.basePrice.toLocaleString()}` : ""}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Currency</Label>
        <select value={data.currency} onChange={e => onChange({ currency: e.target.value })}
          className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400 text-slate-700">
          <option value="BDT">BDT (৳)</option>
          <option value="USD">USD ($)</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Contract Amount *</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{sym}</span>
          <Input type="number" min="0" value={data.totalAmount} onChange={e => onChange({ totalAmount: e.target.value })}
            placeholder="0" className="pl-7 h-11 border-slate-200 text-base font-semibold" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Discount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{sym}</span>
            <Input type="number" min="0" value={data.discountAmount} onChange={e => onChange({ discountAmount: e.target.value })}
              placeholder="0" className="pl-7 h-11 border-slate-200" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Net Amount</Label>
          <div className="h-11 px-3 flex items-center bg-slate-50 rounded-lg border border-slate-200 text-sm font-bold text-slate-800">
            {sym}{net.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">
            Advance{isEdit && <span className="text-slate-400 font-normal ml-1">(use Record Payment to add more)</span>}
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{sym}</span>
            <Input type="number" min="0" value={data.advanceAmount}
              onChange={e => !isEdit && onChange({ advanceAmount: e.target.value })}
              readOnly={isEdit}
              placeholder="0" className={cn("pl-7 h-11 border-slate-200", isEdit && "bg-slate-50 cursor-not-allowed")} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Due Amount</Label>
          <div className={cn("h-11 px-3 flex items-center rounded-lg border text-sm font-bold",
            due > 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700")}>
            {sym}{due.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Cost Entries + Profit ───────────────────────────────────────────
function Step4Costs({ data, onChange, teamMembers }: {
  data: ReturnType<typeof blankWizard>;
  onChange: (u: Partial<ReturnType<typeof blankWizard>>) => void;
  teamMembers: TeamMember[];
}) {
  const sym = data.currency === "BDT" ? "৳" : "$";
  const net = (parseFloat(data.totalAmount) || 0) - (parseFloat(data.discountAmount) || 0);
  const teamBill = data.costEntries.reduce((s, e) => s + (parseFloat(String(e.totalBill)) || 0), 0);
  const transport = parseFloat(data.transportCost) || 0;
  const other = parseFloat(data.otherCost) || 0;
  const album = parseFloat(data.albumCost) || 0;
  const equip = parseFloat(data.equipCost) || 0;
  const totalCost = teamBill + transport + other + album + equip;
  const profit = net - totalCost;
  const margin = net > 0 ? Math.round((profit / net) * 100) : 0;

  function addEntry() {
    onChange({ costEntries: [...data.costEntries, { id: uid(), role: "", memberId: "", memberName: "", totalBill: 0, note: "" }] });
  }
  function removeEntry(id: string) {
    onChange({ costEntries: data.costEntries.filter(e => e.id !== id) });
  }
  function updateEntry(id: string, field: string, value: string | number) {
    onChange({ costEntries: data.costEntries.map(e => e.id === id ? { ...e, [field]: value } : e) });
  }
  function pickMember(entryId: string, member: TeamMember) {
    const entry = data.costEntries.find(e => e.id === entryId)!;
    const role = member.memberRoles[0] ?? "";
    const rateEntry = member.roleRates?.find(r => r.roleId === role);
    updateEntry(entryId, "memberId", member.id);
    updateEntry(entryId, "memberName", `${member.firstName} ${member.lastName ?? ""}`.trim());
    updateEntry(entryId, "role", role);
    if (rateEntry?.rate) updateEntry(entryId, "totalBill", rateEntry.rate);
    void entry;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-slate-600">Team Cost Entries</Label>
          <button onClick={addEntry} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
            <Plus className="w-3.5 h-3.5" />Add Entry
          </button>
        </div>

        {data.costEntries.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
            <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No cost entries — add team member bills</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.costEntries.map(entry => (
              <div key={entry.id} className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={entry.memberId ?? ""}
                    onChange={e => {
                      const m = teamMembers.find(t => t.id === e.target.value);
                      if (m) pickMember(entry.id, m); else updateEntry(entry.id, "memberId", e.target.value);
                    }}
                    className="flex-1 h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-indigo-400">
                    <option value="">Select member...</option>
                    {teamMembers.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName ?? ""} ({m.memberId})</option>)}
                    <option value="__custom__">Other / Freelancer</option>
                  </select>
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{sym}</span>
                    <input type="number" min="0" value={entry.totalBill || ""}
                      onChange={e => updateEntry(entry.id, "totalBill", parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full h-9 pl-5 pr-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400" />
                  </div>
                  <button onClick={() => removeEntry(entry.id)} className="text-slate-300 hover:text-red-400 flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {(!entry.memberId || entry.memberId === "__custom__") && (
                  <input value={entry.memberName} onChange={e => updateEntry(entry.id, "memberName", e.target.value)}
                    placeholder="Name / Role (e.g. Freelance Photographer)"
                    className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-indigo-400" />
                )}
                <input value={entry.note ?? ""} onChange={e => updateEntry(entry.id, "note", e.target.value)}
                  placeholder="Note (e.g. with setup, 2 days coverage...)"
                  className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-indigo-400 placeholder:text-slate-400" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Transport", key: "transportCost" },
          { label: "Equipment Rental", key: "equipCost" },
          { label: "Album / Print", key: "albumCost" },
          { label: "Other", key: "otherCost" },
        ].map(({ label, key }) => (
          <div key={key} className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">{label}</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{sym}</span>
              <input type="number" min="0"
                value={(data as any)[key] || ""}
                onChange={e => onChange({ [key]: e.target.value } as any)}
                placeholder="0"
                className="w-full h-10 pl-6 pr-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-2.5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Profit Summary</p>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Revenue</span><span className="font-semibold">{sym}{net.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Team Cost</span><span className="text-red-400">− {sym}{teamBill.toLocaleString()}</span></div>
          {transport > 0 && <div className="flex justify-between"><span className="text-slate-400">Transport</span><span className="text-red-400">− {sym}{transport.toLocaleString()}</span></div>}
          {equip > 0 && <div className="flex justify-between"><span className="text-slate-400">Equipment</span><span className="text-red-400">− {sym}{equip.toLocaleString()}</span></div>}
          {album > 0 && <div className="flex justify-between"><span className="text-slate-400">Album</span><span className="text-red-400">− {sym}{album.toLocaleString()}</span></div>}
          {other > 0 && <div className="flex justify-between"><span className="text-slate-400">Other</span><span className="text-red-400">− {sym}{other.toLocaleString()}</span></div>}
        </div>
        <div className="border-t border-slate-700 pt-2.5 flex justify-between items-center">
          <span className="font-bold text-base">Net Profit</span>
          <div className="text-right">
            <span className={cn("font-extrabold text-xl", profit >= 0 ? "text-emerald-400" : "text-red-400")}>{sym}{profit.toLocaleString()}</span>
            <span className={cn("ml-2 text-xs px-1.5 py-0.5 rounded-full font-medium", profit >= 0 ? "bg-emerald-900 text-emerald-300" : "bg-red-900 text-red-300")}>{margin}%</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Internal Notes</Label>
        <textarea value={data.internalNotes} onChange={e => onChange({ internalNotes: e.target.value })} rows={2}
          placeholder="Special instructions, reminders..."
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 resize-none" />
      </div>
    </div>
  );
}

// ─── Program Drawer (create + edit) ──────────────────────────────────────────
const STEPS = [
  { icon: User,        label: "Client" },
  { icon: CalendarDays,label: "Event Days" },
  { icon: DollarSign,  label: "Financial" },
  { icon: BarChart2,   label: "Costs" },
];

export function ProgramDrawer({ open, onClose, onSaved, packages, teamMembers, initialBooking }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  packages: Package[];
  teamMembers: TeamMember[];
  initialBooking?: Booking | null;
}) {
  const isEdit = !!initialBooking;
  const [step, setStep] = useState(0);
  const [data, setData] = useState(blankWizard());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setStep(0); setError("");
      setData(isEdit && initialBooking ? bookingToWizard(initialBooking) : blankWizard());
    }
  }, [open, initialBooking]); // eslint-disable-line react-hooks/exhaustive-deps

  function onChange(u: Partial<ReturnType<typeof blankWizard>>) { setData(p => ({ ...p, ...u })); }

  function canNext() {
    if (step === 0) {
      if (data.clientMode === "search") return !!data.selectedClient;
      return !!data.newClient.firstName.trim() && !!data.newClient.phone.trim();
    }
    if (step === 1) return !!data.eventName.trim() && data.eventDays.length > 0 && data.eventDays.every(d => d.date);
    if (step === 2) return !!(parseFloat(data.totalAmount) > 0);
    return true;
  }

  async function submit() {
    setError(""); setLoading(true);
    try {
      let clientId = data.selectedClient?.id;
      if (!clientId) {
        const cr = await apiFetch(`${API}/clients`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: data.newClient.firstName.trim(),
            lastName: data.newClient.lastName.trim() || undefined,
            phone: data.newClient.phone.trim(),
            phoneSecondary: data.newClient.phoneSecondary.trim() || undefined,
            email: data.newClient.email.trim() || undefined,
            facebookProfile: data.newClient.facebookProfile.trim() || undefined,
            city: data.newClient.city.trim() || undefined,
            source: data.newClient.source || undefined,
            address: data.newClient.address.trim() || undefined,
            occupation: data.newClient.occupation.trim() || undefined,
            companyName: data.newClient.companyName.trim() || undefined,
            vipStatus: data.newClient.vipStatus,
            notes: data.newClient.notes.trim() || undefined,
            internalNotes: data.newClient.internalNotes.trim() || undefined,
          }),
        });
        const cd = await cr.json();
        if (!cr.ok) { setError(cd.message || "Failed to create client."); return; }
        clientId = cd.id;
      }

      const firstDay = data.eventDays[0];
      const body = {
        clientId,
        programId: data.packageId || undefined,
        eventName: data.eventName,
        eventDate: firstDay?.date || undefined,
        eventLocation: firstDay?.location || undefined,
        currency: data.currency,
        totalAmount: parseFloat(data.totalAmount) || 0,
        discountAmount: parseFloat(data.discountAmount) || 0,
        advanceAmount: isEdit ? undefined : (parseFloat(data.advanceAmount) || 0),
        transportCost: parseFloat(data.transportCost) || 0,
        otherCost: parseFloat(data.otherCost) || 0,
        albumCost: parseFloat(data.albumCost) || 0,
        equipCost: parseFloat(data.equipCost) || 0,
        internalNotes: data.internalNotes || undefined,
        eventDays: data.eventDays,
        costEntries: data.costEntries.filter(e => e.memberName || e.totalBill > 0),
        ...(isEdit ? {} : { status: "confirmed" }),
      };

      const url = isEdit ? `${API}/bookings/${initialBooking!.id}` : `${API}/bookings`;
      const r = await apiFetch(url, { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setError(d.message || "Failed to save program."); return; }
      onSaved(); onClose();
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  }

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">{isEdit ? "Edit Program" : "New Program"}</h2>
            {isEdit && <p className="text-xs text-slate-400 font-mono mt-0.5">{initialBooking?.bookingNumber}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < step;
              const active = i === step;
              return (
                <div key={i} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      done ? "bg-indigo-600" : active ? "bg-indigo-600 ring-4 ring-indigo-100" : "bg-slate-100")}>
                      {done ? <Check className="w-4 h-4 text-white" /> : <Icon className={cn("w-4 h-4", active ? "text-white" : "text-slate-400")} />}
                    </div>
                    <span className={cn("text-[10px] mt-1 font-medium", active ? "text-indigo-600" : done ? "text-slate-500" : "text-slate-300")}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={cn("flex-1 h-0.5 mx-2 mb-4", i < step ? "bg-indigo-600" : "bg-slate-200")} />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          {step === 0 && <Step1Client data={data} onChange={onChange} />}
          {step === 1 && <Step2EventDays data={data} onChange={onChange} teamMembers={teamMembers} editingBookingId={initialBooking?.id} />}
          {step === 2 && <Step3Financial data={data} onChange={onChange} packages={packages} isEdit={isEdit} />}
          {step === 3 && <Step4Costs data={data} onChange={onChange} teamMembers={teamMembers} />}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex gap-3">
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1 h-11 border-slate-200">← Back</Button>
          ) : (
            <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200">Cancel</Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white gap-1">
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={loading} className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : isEdit ? "Save Changes" : "Create Program"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
