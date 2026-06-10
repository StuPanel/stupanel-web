"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, X, Loader2, Search, MoreVertical, Edit3, Trash2, Eye,
  CalendarDays, MapPin, ChevronRight, ChevronDown, ChevronUp,
  Users, DollarSign, BarChart2, User, Check, AlertTriangle,
  Camera, Video, Image, Film, Navigation, Briefcase, Tag,
  Clock, Layers, TrendingUp, ArrowRight, MessageCircle, Send, FileText,
  HardDrive, Link2, ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ClientFormFields, blankClientForm, type ClientFormData } from "@/components/client-form-fields";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function fmtDate(d: string | Date | undefined | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dd}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const EVENT_TYPES = ["Wedding", "Holud", "Reception", "Engagement", "Akd", "Birthday", "Corporate", "Party", "Naming Ceremony", "Other"];
const STATUS_CFG: Record<string, { label: string; badge: string; dot: string }> = {
  inquiry:            { label: "Inquiry",       badge: "bg-slate-100 text-slate-600",     dot: "bg-slate-400" },
  quote_sent:         { label: "Quote Sent",     badge: "bg-blue-100 text-blue-700",       dot: "bg-blue-400" },
  confirmed:          { label: "Confirmed",      badge: "bg-indigo-100 text-indigo-700",   dot: "bg-indigo-500" },
  advance_received:   { label: "Advance Rcvd",   badge: "bg-violet-100 text-violet-700",   dot: "bg-violet-500" },
  in_progress:        { label: "Shooting",       badge: "bg-amber-100 text-amber-700",     dot: "bg-amber-500" },
  editing:            { label: "Editing",        badge: "bg-orange-100 text-orange-700",   dot: "bg-orange-400" },
  ready_for_delivery: { label: "Ready",          badge: "bg-cyan-100 text-cyan-700",       dot: "bg-cyan-500" },
  delivered:          { label: "Delivered",      badge: "bg-teal-100 text-teal-700",       dot: "bg-teal-500" },
  completed:          { label: "Completed",      badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  cancelled:          { label: "Cancelled",      badge: "bg-red-100 text-red-600",         dot: "bg-red-400" },
  refunded:           { label: "Refunded",       badge: "bg-rose-100 text-rose-600",       dot: "bg-rose-400" },
};
const ROLE_ICONS: Record<string, { icon: typeof Camera; color: string }> = {
  photographer:    { icon: Camera,      color: "text-blue-600" },
  cinematographer: { icon: Video,       color: "text-violet-600" },
  photo_editor:   { icon: Image,       color: "text-emerald-600" },
  video_editor:   { icon: Film,        color: "text-orange-600" },
  drone_pilot:    { icon: Navigation,  color: "text-sky-600" },
  assistant:      { icon: Briefcase,   color: "text-slate-600" },
};

function uid() { return Math.random().toString(36).slice(2, 9); }

// ─── Types ────────────────────────────────────────────────────────────────────
interface Client { id: string; firstName: string; lastName?: string; phone?: string; facebookProfile?: string; address?: string; referralSource?: string; }
interface Package { id: string; name: string; basePrice?: number; }
interface TeamMember { id: string; memberId: string; firstName: string; lastName?: string; memberRoles: string[]; roleRates?: { roleId: string; rate: number; rateType: string; note?: string }[]; }
interface Shift { id: string; label: string; memberIds: string[]; }
interface EventDay { id: string; eventType: string; date: string; location: string; shifts: Shift[]; }
interface CostEntry { id: string; role: string; memberId?: string; memberName: string; totalBill: number; note?: string; }
interface Booking {
  id: string; bookingNumber: string; eventName?: string; eventDate?: string; eventEndDate?: string;
  eventLocation?: string; status: string; currency: string;
  grandTotal: number; paidAmount: number; totalAmount: number; discountAmount: number;
  advanceAmount: number; transportCost: number; otherCost: number; albumCost: number;
  equipCost: number; teamBillTotal: number; profitAmount: number;
  internalNotes?: string;
  deliveryMethod?: string; deliveryLink?: string; deliveryNote?: string; deliveryDate?: string;
  driveFolderUrl?: string; driveDeliveredAt?: string;
  eventDays: EventDay[]; costEntries: CostEntry[];
  client: { id: string; firstName: string; lastName?: string; phone?: string };
  program?: { id: string; name: string };
  team: { userId: string; roleInBooking?: string; agreedRate?: number; agreedNote?: string }[];
  payments: { id: string; amount: number }[];
}

// ─── Wizard State ─────────────────────────────────────────────────────────────
function blankWizard() {
  return {
    // Step 1 — Client
    clientMode: "search" as "search" | "new",
    selectedClient: null as Client | null,
    newClient: blankClientForm as ClientFormData,
    // Step 2 — Event Days
    eventDays: [] as EventDay[],
    eventName: "",
    // Step 3 — Package & Financial
    packageId: "", currency: "BDT",
    totalAmount: "", discountAmount: "", advanceAmount: "",
    // Step 4 — Cost Entries
    costEntries: [] as CostEntry[],
    transportCost: "", otherCost: "", albumCost: "", equipCost: "",
    internalNotes: "",
  };
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
interface BusyInfo { busyMemberIds: string[]; busyDetails: Record<string, { bookingNumber: string; eventName?: string; shiftLabel: string }> }

function Step2EventDays({ data, onChange, teamMembers, editingBookingId }: {
  data: ReturnType<typeof blankWizard>;
  onChange: (u: Partial<ReturnType<typeof blankWizard>>) => void;
  teamMembers: TeamMember[];
  editingBookingId?: string;
}) {
  // dayId → busy info for that date
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
                {/* Day Header */}
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

                {/* Busy warning banner */}
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

                  {/* Shifts */}
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
  packages: Package[]; isEdit?: boolean;
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
  }

  return (
    <div className="space-y-5">
      {/* Cost entries table */}
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
                  {/* Member picker */}
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
                  {/* Bill */}
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
                {/* Custom name if not from team */}
                {(!entry.memberId || entry.memberId === "__custom__") && (
                  <input value={entry.memberName} onChange={e => updateEntry(entry.id, "memberName", e.target.value)}
                    placeholder="Name / Role (e.g. Freelance Photographer)"
                    className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-indigo-400" />
                )}
                {/* Note */}
                <input value={entry.note ?? ""} onChange={e => updateEntry(entry.id, "note", e.target.value)}
                  placeholder="Note (e.g. with setup, 2 days coverage...)"
                  className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-indigo-400 placeholder:text-slate-400" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Other costs */}
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

      {/* Profit summary */}
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

      {/* Internal notes */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-slate-600">Internal Notes</Label>
        <textarea value={data.internalNotes} onChange={e => onChange({ internalNotes: e.target.value })} rows={2}
          placeholder="Special instructions, reminders..."
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 resize-none" />
      </div>
    </div>
  );
}

// ─── New Program Drawer ───────────────────────────────────────────────────────
const STEPS = [
  { icon: User,        label: "Client" },
  { icon: CalendarDays,label: "Event Days" },
  { icon: DollarSign,  label: "Financial" },
  { icon: BarChart2,   label: "Costs" },
];

// ─── Booking → Wizard converter ──────────────────────────────────────────────
function bookingToWizard(b: Booking): ReturnType<typeof blankWizard> {
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

// ─── Program Drawer (create + edit) ──────────────────────────────────────────
function ProgramDrawer({ open, onClose, onSaved, packages, teamMembers, initialBooking }: {
  open: boolean; onClose: () => void; onSaved: () => void;
  packages: Package[]; teamMembers: TeamMember[]; initialBooking?: Booking | null;
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

// ─── Program Card ─────────────────────────────────────────────────────────────
function ProgramCard({ b, onView, onEdit, onDelete }: { b: Booking; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const sc = STATUS_CFG[b.status] ?? STATUS_CFG.inquiry;
  const sym = b.currency === "BDT" ? "৳" : "$";
  const due = Number(b.grandTotal) - Number(b.paidAmount);
  const days = b.eventDays?.length ?? 0;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", sc.badge)}>{sc.label}</span>
            <span className="text-[10px] text-slate-400 font-mono">{b.bookingNumber}</span>
            {days > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 flex items-center gap-1">
                <Layers className="w-2.5 h-2.5" />{days}d
              </span>
            )}
          </div>
          <h3 className="font-bold text-slate-900 text-sm truncate">{b.eventName ?? "—"}</h3>
          <p className="text-xs text-slate-400">{b.client.firstName} {b.client.lastName ?? ""}</p>
        </div>
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button onClick={() => setMenuOpen(o => !o)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
              <button onClick={() => { onView(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><Eye className="w-4 h-4 text-slate-400" />View Details</button>
              <button onClick={() => { onEdit(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><Edit3 className="w-4 h-4 text-slate-400" />Edit</button>
              <div className="border-t border-slate-100" />
              <button onClick={() => { onDelete(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" />Delete</button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-slate-400 mb-3">
        {b.eventDate && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{fmtDate(b.eventDate)}</span>}
        {b.eventLocation && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.eventLocation}</span>}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div>
          <p className="text-xs text-slate-400">Contract</p>
          <p className="font-bold text-slate-900 text-sm">{sym}{Number(b.grandTotal).toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Due</p>
          <p className={cn("font-bold text-sm", due > 0 ? "text-red-600" : "text-emerald-600")}>{sym}{due.toLocaleString()}</p>
        </div>
        {Number(b.profitAmount) !== 0 && (
          <div className="text-right">
            <p className="text-xs text-slate-400">Profit</p>
            <p className={cn("font-bold text-sm", Number(b.profitAmount) >= 0 ? "text-emerald-600" : "text-red-600")}>
              {sym}{Number(b.profitAmount).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Delete Dialog ─────────────────────────────────────────────────────────────
function DeleteDialog({ booking, onClose, onDeleted }: { booking: Booking | null; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false);
  if (!booking) return null;
  async function doDelete() {
    setLoading(true);
    await apiFetch(`${API}/bookings/${booking!.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } }).catch(() => {});
    onDeleted(); onClose(); setLoading(false);
  }
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Delete Program?</h3>
          <p className="text-slate-500 text-sm mt-2"><span className="font-semibold text-slate-700">{booking.eventName ?? booking.bookingNumber}</span> will be permanently deleted.</p>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200">Cancel</Button>
            <Button onClick={doDelete} disabled={loading} className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Delete
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Status Pipeline ──────────────────────────────────────────────────────────
const STATUS_PIPELINE = [
  "inquiry", "confirmed", "advance_received", "in_progress",
  "editing", "ready_for_delivery", "delivered", "completed",
];

function StatusPipeline({ current, bookingId, onChanged }: { current: string; bookingId: string; onChanged: () => void }) {
  const [loading, setLoading] = useState<string | null>(null);
  const isCancelled = current === "cancelled" || current === "refunded";

  async function changeStatus(s: string) {
    if (s === current || loading) return;
    setLoading(s);
    try {
      await apiFetch(`${API}/bookings/${bookingId}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s }),
      });
      onChanged();
    } finally { setLoading(null); }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</p>
      {isCancelled ? (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-red-200 bg-red-50">
          <span className="text-sm font-semibold text-red-700 capitalize">{current}</span>
          <button onClick={() => changeStatus("confirmed")}
            className="text-xs text-slate-500 hover:text-indigo-600 underline">Reopen</button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
          {STATUS_PIPELINE.map((s, i) => {
            const sc = STATUS_CFG[s];
            const idx = STATUS_PIPELINE.indexOf(current);
            const done = i < idx;
            const active = s === current;
            return (
              <button key={s} onClick={() => changeStatus(s)}
                disabled={loading !== null}
                className={cn("flex-shrink-0 flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all",
                  active ? "bg-indigo-600" : done ? "bg-indigo-100 hover:bg-indigo-200" : "bg-slate-100 hover:bg-slate-200")}>
                <div className={cn("w-4 h-4 rounded-full flex items-center justify-center",
                  active ? "bg-white" : done ? "bg-indigo-500" : "bg-slate-300")}>
                  {loading === s
                    ? <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-600" />
                    : done ? <Check className="w-2.5 h-2.5 text-white" />
                    : <span className={cn("w-1.5 h-1.5 rounded-full", active ? "bg-indigo-600" : "bg-slate-400")} />}
                </div>
                <span className={cn("text-[9px] font-semibold leading-tight text-center max-w-[52px]",
                  active ? "text-white" : done ? "text-indigo-700" : "text-slate-400")}>
                  {sc?.label ?? s}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {!isCancelled && (
        <div className="flex gap-2 mt-1">
          <button onClick={() => changeStatus("cancelled")}
            className="text-xs text-red-500 hover:text-red-700 underline">Mark Cancelled</button>
          {current !== "completed" && (
            <button onClick={() => changeStatus("completed")}
              className="text-xs text-emerald-600 hover:text-emerald-700 underline">Mark Completed</button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Payment Modal ─────────────────────────────────────────────────────────────
const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mobile_banking", label: "bKash / Nagad" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Card" },
  { value: "other", label: "Other" },
];

// ─── WhatsApp Modal ────────────────────────────────────────────────────────────
interface WaTemplate { id: string; name: string; category: string; body: string; }

function WhatsAppModal({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loadingTpl, setLoadingTpl] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [preview, setPreview] = useState("");
  const [phone, setPhone] = useState("");
  const [filling, setFilling] = useState(false);
  const [customMsg, setCustomMsg] = useState("");
  const [mode, setMode] = useState<"template" | "custom">("template");

  useEffect(() => {
    if (!booking) return;
    setPhone(booking.client?.phone ?? "");
    fetch(`${API}/wa-templates`, { headers: { "Content-Type": "application/json" } })
      .then(r => r.json()).then(d => { setTemplates(Array.isArray(d) ? d : []); })
      .catch(() => {}).finally(() => setLoadingTpl(false));
  }, [booking]);

  async function fillTemplate(id: string) {
    if (!booking || !id) return;
    setFilling(true); setSelectedId(id);
    try {
      const r = await apiFetch(`${API}/wa-templates/fill`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: id, bookingId: booking.id }),
      });
      if (r.ok) { const d = await r.json(); setPreview(d.filled); if (d.phone) setPhone(d.phone); }
    } finally { setFilling(false); }
  }

  function sendWA() {
    const msg = mode === "template" ? preview : customMsg;
    if (!msg.trim()) return;
    const num = phone.replace(/\D/g, "");
    const bd = num.startsWith("0") ? "88" + num : num.startsWith("880") ? num : num;
    window.open(`https://wa.me/${bd}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  if (!booking) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 text-sm">Send WhatsApp</p>
              <p className="text-xs text-slate-400 truncate">{booking.client?.firstName} {booking.client?.lastName ?? ""} · {booking.bookingNumber}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Phone Number</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-green-400" />
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button onClick={() => setMode("template")}
                className={cn("flex-1 py-2 text-xs font-semibold transition-all",
                  mode === "template" ? "bg-green-600 text-white" : "text-slate-500 hover:bg-slate-50")}>
                Use Template
              </button>
              <button onClick={() => setMode("custom")}
                className={cn("flex-1 py-2 text-xs font-semibold transition-all",
                  mode === "custom" ? "bg-green-600 text-white" : "text-slate-500 hover:bg-slate-50")}>
                Custom Message
              </button>
            </div>

            {mode === "template" ? (
              <>
                {loadingTpl ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-green-500" /></div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-xl">
                    <p className="text-sm text-slate-500">No templates yet</p>
                    <a href="/whatsapp" target="_blank" className="text-xs text-green-600 hover:underline mt-1 inline-block">Create templates →</a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map(t => (
                      <button key={t.id} onClick={() => fillTemplate(t.id)}
                        className={cn("w-full text-left px-3.5 py-3 rounded-xl border transition-all text-sm",
                          selectedId === t.id ? "border-green-400 bg-green-50" : "border-slate-200 hover:border-green-300 bg-white")}>
                        <span className="font-semibold text-slate-800 block">{t.name}</span>
                        <span className="text-xs text-slate-400 line-clamp-1 mt-0.5">{t.body.slice(0, 60)}…</span>
                      </button>
                    ))}
                  </div>
                )}

                {filling && <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-green-500" /></div>}

                {preview && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-500">Preview</p>
                    <pre className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">{preview}</pre>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-600">Your Message</p>
                <textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)} rows={8}
                  placeholder="Type your WhatsApp message here..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-green-400 resize-y" />
              </div>
            )}
          </div>

          <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex gap-3">
            <button onClick={onClose} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={sendWA}
              disabled={(mode === "template" && !preview) || (mode === "custom" && !customMsg.trim()) || !phone.trim()}
              className="flex-1 h-11 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all">
              <Send className="w-4 h-4" />Open WhatsApp
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function PaymentModal({ booking, onClose, onSaved }: { booking: Booking | null; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (booking) {
      const due = Number(booking.grandTotal) - Number(booking.paidAmount);
      setAmount(due > 0 ? String(due) : "");
      setMethod("cash"); setRef(""); setNote(""); setError("");
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [booking]);

  if (!booking) return null;
  const bk = booking;
  const sym = bk.currency === "BDT" ? "৳" : "$";
  const due = Number(bk.grandTotal) - Number(bk.paidAmount);

  async function submit() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter a valid amount."); return; }
    setError(""); setLoading(true);
    try {
      const r = await apiFetch(`${API}/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: bk.id,
          amount: amt,
          currency: bk.currency ?? "BDT",
          paymentMethod: method,
          paymentDate: date,
          referenceNumber: ref || undefined,
          notes: note || undefined,
          paymentStatus: "completed",
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.message || "Failed to record payment."); return; }
      onSaved(); onClose();
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">Record Payment</h3>
              <p className="text-xs text-slate-400 mt-0.5">{booking.eventName ?? booking.bookingNumber}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="p-5 space-y-3">
            {due > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-red-50 rounded-xl border border-red-100">
                <span className="text-xs text-red-600">Outstanding Due</span>
                <span className="font-bold text-red-700 text-sm">{sym}{due.toLocaleString()}</span>
              </div>
            )}
            {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Amount *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{sym}</span>
                <Input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0" className="pl-7 h-11 border-slate-200 text-base font-semibold" autoFocus />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Method</Label>
                <select value={method} onChange={e => setMethod(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400">
                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10 border-slate-200 text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Reference / TrxID</Label>
              <Input value={ref} onChange={e => setRef(e.target.value)} placeholder="bKash TrxID, bank ref..." className="h-10 border-slate-200 text-sm" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Note</Label>
              <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note" className="h-10 border-slate-200 text-sm" />
            </div>
          </div>

          <div className="px-5 pb-5 flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200">Cancel</Button>
            <Button onClick={submit} disabled={loading} className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              Record Payment
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Delivery Section ─────────────────────────────────────────────────────────
function DeliverySection({ booking, r2Enabled, onRefresh }: { booking: Booking; r2Enabled: boolean; onRefresh: () => void }) {
  const [mode, setMode] = useState<"drive_link" | "r2" | null>(
    booking.deliveryMethod === "drive_link" ? "drive_link" :
    booking.deliveryMethod === "r2" ? "r2" : null
  );
  const [editing, setEditing] = useState(!booking.deliveryMethod);
  const [link, setLink] = useState(booking.deliveryLink ?? "");
  const [note, setNote] = useState(booking.deliveryNote ?? "");
  const [date, setDate] = useState(
    booking.deliveryDate ? new Date(booking.deliveryDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [saving, setSaving] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [error, setError] = useState("");
  const [r2Files, setR2Files] = useState<{ name: string; status: "uploading" | "done" | "error" }[]>([]);
  const [r2Uploading, setR2Uploading] = useState(false);
  const r2InputRef = useRef<HTMLInputElement>(null);

  async function saveLink() {
    if (!link.trim()) { setError("Drive link is required."); return; }
    setSaving(true); setError("");
    try {
      const r = await apiFetch(`${API}/bookings/${booking.id}/delivery`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryMethod: "drive_link", deliveryLink: link.trim(), deliveryNote: note.trim() || undefined, deliveryDate: date || undefined, status: "delivered" }),
      });
      if (!r.ok) { const d = await r.json(); setError(d.message || "Failed."); return; }
      setEditing(false);
      onRefresh();
    } catch { setError("Something went wrong."); }
    finally { setSaving(false); }
  }

  async function createDriveFolder() {
    setAutoLoading(true); setError("");
    try {
      const r = await apiFetch(`${API}/google-drive/deliver/${booking.id}`, { method: "POST" });
      if (!r.ok) { const d = await r.json(); setError(d.message || "Failed to create Drive folder."); return; }
      onRefresh();
    } catch { setError("Something went wrong."); }
    finally { setAutoLoading(false); }
  }

  async function handleR2Upload(files: FileList) {
    if (!files.length) return;
    const fileArr = Array.from(files);
    setR2Uploading(true); setError("");
    setR2Files(fileArr.map(f => ({ name: f.name, status: "uploading" })));
    let successCount = 0;
    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i];
      try {
        const urlRes = await apiFetch(`${API}/deliveries/upload-url`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: booking.id, fileName: file.name, mimeType: file.type || "application/octet-stream", fileSize: file.size }),
        });
        if (!urlRes.ok) throw new Error("URL error");
        const { uploadUrl, fileKey } = await urlRes.json();
        const up = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
        if (!up.ok) throw new Error("Upload error");
        const confRes = await apiFetch(`${API}/deliveries/confirm`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: booking.id, fileKey, fileName: file.name, mimeType: file.type || "application/octet-stream", fileSize: file.size }),
        });
        if (!confRes.ok) throw new Error("Confirm error");
        setR2Files(prev => prev.map((f, idx) => idx === i ? { ...f, status: "done" } : f));
        successCount++;
      } catch {
        setR2Files(prev => prev.map((f, idx) => idx === i ? { ...f, status: "error" } : f));
      }
    }
    if (successCount > 0) {
      await apiFetch(`${API}/bookings/${booking.id}/delivery`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryMethod: "r2", status: "delivered" }),
      });
      onRefresh();
    }
    setR2Uploading(false);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Delivery</p>

      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      {/* Drive Auto result */}
      {booking.deliveryMethod === "drive_auto" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">Drive Folder Created</span>
          </div>
          {booking.driveDeliveredAt && <p className="text-xs text-emerald-600">{fmtDate(booking.driveDeliveredAt)}</p>}
          {booking.driveFolderUrl && (
            <a href={booking.driveFolderUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> Open Drive Folder
            </a>
          )}
          <button onClick={createDriveFolder} disabled={autoLoading}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 underline">
            {autoLoading && <Loader2 className="w-3 h-3 animate-spin" />} Create New Folder
          </button>
        </div>
      )}

      {/* Drive Link result */}
      {booking.deliveryMethod === "drive_link" && !editing && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Drive Link</span>
            </div>
            <button onClick={() => setEditing(true)} className="text-xs text-slate-400 hover:text-indigo-600">Edit</button>
          </div>
          {booking.deliveryDate && <p className="text-xs text-emerald-600">{fmtDate(booking.deliveryDate)}</p>}
          {booking.deliveryLink && (
            <a href={booking.deliveryLink} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline break-all">
              <ExternalLink className="w-3.5 h-3.5 shrink-0" /> {booking.deliveryLink.length > 40 ? booking.deliveryLink.slice(0, 40) + "…" : booking.deliveryLink}
            </a>
          )}
          {booking.deliveryNote && <p className="text-xs text-slate-500">{booking.deliveryNote}</p>}
        </div>
      )}

      {/* R2 result */}
      {booking.deliveryMethod === "r2" && !editing && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">R2 Cloud Upload</span>
            </div>
            <button onClick={() => { setEditing(true); setMode("r2"); }} className="text-xs text-slate-400 hover:text-indigo-600">Add More</button>
          </div>
          {r2Files.length > 0 && (
            <div className="space-y-1">
              {r2Files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {f.status === "done" ? <Check className="w-3 h-3 text-emerald-500" /> : f.status === "error" ? <X className="w-3 h-3 text-red-500" /> : <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
                  <span className="text-slate-600 truncate">{f.name}</span>
                </div>
              ))}
            </div>
          )}
          <a href="/delivery" className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline">
            <ExternalLink className="w-3 h-3" /> Manage files in Delivery page
          </a>
        </div>
      )}

      {/* No delivery / choosing method */}
      {(!booking.deliveryMethod || ((booking.deliveryMethod === "drive_link" || booking.deliveryMethod === "r2") && editing)) && (
        <>
          {mode === null && (
            <div className="space-y-2">
              {/* Method cards */}
              <div className={`grid gap-2 ${r2Enabled ? "grid-cols-3" : "grid-cols-2"}`}>
                <button onClick={() => setMode("drive_link")}
                  className="flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left">
                  <Link2 className="w-4 h-4 text-indigo-500" />
                  <div>
                    <p className="text-xs font-bold text-slate-700">Manual Link</p>
                    <p className="text-[9px] text-slate-400 leading-relaxed mt-0.5">Paste Google Drive, Dropbox or WeTransfer link. Saved in DB. All companies.</p>
                  </div>
                </button>
                <button onClick={createDriveFolder} disabled={autoLoading}
                  className="flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left">
                  {autoLoading ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> : <HardDrive className="w-4 h-4 text-emerald-500" />}
                  <div>
                    <p className="text-xs font-bold text-slate-700">Drive Auto</p>
                    <p className="text-[9px] text-slate-400 leading-relaxed mt-0.5">Auto-creates a folder in your Google Drive. Requires connected Drive account. All companies.</p>
                  </div>
                </button>
                {r2Enabled && (
                  <button onClick={() => setMode("r2")}
                    className="flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left">
                    <ArrowRight className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-xs font-bold text-slate-700">R2 Upload</p>
                      <p className="text-[9px] text-slate-400 leading-relaxed mt-0.5">Upload files to Cloudflare R2 cloud. Secure storage. Super Admin permission required.</p>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {mode === "drive_link" && (
            <div className="space-y-2.5 bg-slate-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600">Manual Link Delivery</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Paste your Google Drive, Dropbox, or WeTransfer link</p>
                </div>
                {!booking.deliveryMethod && (
                  <button onClick={() => setMode(null)} className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Delivery Link *</Label>
                <Input value={link} onChange={e => setLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="h-10 text-sm border-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Delivery Date</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-10 text-sm border-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Note</Label>
                  <Input value={note} onChange={e => setNote(e.target.value)} placeholder="200 photos, 2 reels…" className="h-10 text-sm border-slate-200" />
                </div>
              </div>
              <Button onClick={saveLink} disabled={saving} className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Delivery"}
              </Button>
            </div>
          )}

          {mode === "r2" && (
            <div className="space-y-2.5 bg-slate-50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-600">R2 Cloud Upload</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Files stored securely on Cloudflare R2. Client downloads after full payment.</p>
                </div>
                <button onClick={() => { setMode(null); setEditing(!booking.deliveryMethod); setR2Files([]); }} className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
              </div>
              <input ref={r2InputRef} type="file" multiple className="hidden"
                onChange={e => e.target.files && handleR2Upload(e.target.files)} />
              <button onClick={() => r2InputRef.current?.click()} disabled={r2Uploading}
                className="w-full flex flex-col items-center gap-2 py-6 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                {r2Uploading ? <Loader2 className="w-6 h-6 animate-spin text-indigo-500" /> : <ArrowRight className="w-6 h-6 text-slate-400" />}
                <span className="text-xs text-slate-500">{r2Uploading ? "Uploading…" : "Click to select files"}</span>
                <span className="text-[10px] text-slate-400">Photos, Videos, ZIP — max 500 MB each</span>
              </button>
              {r2Files.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {r2Files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-white rounded-lg px-3 py-2">
                      {f.status === "done" ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : f.status === "error" ? <X className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500 shrink-0" />}
                      <span className={`truncate ${f.status === "error" ? "text-red-600" : "text-slate-700"}`}>{f.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── View Drawer ──────────────────────────────────────────────────────────────
function ViewDrawer({ booking, onClose, onEdit, onRefresh, r2Enabled }: {
  booking: Booking | null; onClose: () => void; onEdit: () => void; onRefresh: () => void; r2Enabled: boolean;
}) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [genInvoicing, setGenInvoicing] = useState(false);
  const [localBooking, setLocalBooking] = useState<Booking | null>(null);
  const router = useRouter();

  useEffect(() => { setLocalBooking(booking); }, [booking]);

  async function refreshBooking() {
    if (!localBooking) return;
    try {
      const r = await apiFetch(`${API}/bookings/${localBooking.id}`, { headers: { "Content-Type": "application/json" } });
      if (r.ok) setLocalBooking(await r.json());
    } catch { /* silent */ }
    onRefresh();
  }

  const b = localBooking;
  if (!b) return null;
  const sc = STATUS_CFG[b.status] ?? STATUS_CFG.inquiry;
  const sym = b.currency === "BDT" ? "৳" : "$";
  const due = Number(b.grandTotal) - Number(b.paidAmount);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">{b.eventName ?? b.bookingNumber}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400 font-mono">{b.bookingNumber}</span>
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", sc.badge)}>{sc.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {due > 0 && (
              <button onClick={() => setPaymentOpen(true)}
                className="h-8 px-3 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />Pay
              </button>
            )}
            <button
              disabled={genInvoicing}
              onClick={async () => {
                setGenInvoicing(true);
                try {
                  const r = await apiFetch(`${API}/studio-invoices/generate/${b.id}`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` } });
                  const d = await r.json();
                  if (r.ok || d.message?.includes("already exists")) {
                    router.push("/invoices");
                  }
                } catch { /* silent */ } finally { setGenInvoicing(false); }
              }}
              className="h-8 px-3 rounded-lg border border-indigo-300 bg-indigo-50 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 flex items-center gap-1.5 disabled:opacity-50">
              {genInvoicing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}Invoice
            </button>
            {b.client?.phone && (
              <button onClick={() => setWaOpen(true)}
                className="h-8 px-3 rounded-lg border border-green-300 bg-green-50 text-xs font-semibold text-green-700 hover:bg-green-100 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" />WA
              </button>
            )}
            <button onClick={onEdit} className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5" />Edit
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Status Pipeline */}
          <StatusPipeline current={b.status} bookingId={b.id} onChanged={refreshBooking} />

          {/* Client */}
          <div className="bg-slate-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Client</p>
            <p className="font-bold text-slate-900">{b.client.firstName} {b.client.lastName ?? ""}</p>
            {b.client.phone && <p className="text-sm text-slate-500">{b.client.phone}</p>}
          </div>

          {/* Event Days */}
          {b.eventDays?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Event Days</p>
              {b.eventDays.map((day, i) => (
                <div key={day.id} className="border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="font-semibold text-sm text-slate-800">{day.eventType}</span>
                    {day.date && <span className="text-xs text-slate-400">{fmtDate(day.date)}</span>}
                  </div>
                  {day.location && <p className="text-xs text-slate-400 ml-7 flex items-center gap-1"><MapPin className="w-3 h-3" />{day.location}</p>}
                  {day.shifts.map(s => (
                    <div key={s.id} className="ml-7 mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{s.label}</span>
                      <span className="text-[10px] text-slate-400">{s.memberIds.length} members</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Financials */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Financials</p>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Contract</span><span className="font-semibold">{sym}{Number(b.totalAmount).toLocaleString()}</span></div>
              {Number(b.discountAmount) > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="text-red-500">− {sym}{Number(b.discountAmount).toLocaleString()}</span></div>}
              <div className="flex justify-between font-bold"><span>Net</span><span>{sym}{Number(b.grandTotal).toLocaleString()}</span></div>
              <div className="border-t border-slate-200 pt-2 flex justify-between">
                <span className="text-slate-500">Paid</span>
                <span className="text-emerald-600 font-semibold">{sym}{Number(b.paidAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Due</span>
                <span className={cn("font-bold", due > 0 ? "text-red-600" : "text-emerald-600")}>{sym}{due.toLocaleString()}</span>
              </div>
            </div>
            {due > 0 && (
              <button onClick={() => setPaymentOpen(true)}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
                <DollarSign className="w-4 h-4" />Record Payment
              </button>
            )}
          </div>

          {/* Cost Entries */}
          {b.costEntries?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Team Costs</p>
              {b.costEntries.map(e => (
                <div key={e.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{e.memberName}</p>
                    {e.note && <p className="text-xs text-slate-400">{e.note}</p>}
                  </div>
                  <span className="font-bold text-slate-800">{sym}{Number(e.totalBill).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {/* Profit */}
          {Number(b.profitAmount) !== 0 && (
            <div className={cn("rounded-xl p-4 flex items-center justify-between", Number(b.profitAmount) >= 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200")}>
              <div className="flex items-center gap-2">
                <TrendingUp className={cn("w-5 h-5", Number(b.profitAmount) >= 0 ? "text-emerald-600" : "text-red-500")} />
                <span className="font-semibold text-sm text-slate-800">Net Profit</span>
              </div>
              <span className={cn("font-extrabold text-lg", Number(b.profitAmount) >= 0 ? "text-emerald-700" : "text-red-600")}>
                {sym}{Number(b.profitAmount).toLocaleString()}
              </span>
            </div>
          )}

          {/* Delivery */}
          <DeliverySection booking={b} r2Enabled={r2Enabled} onRefresh={refreshBooking} />

          {b.internalNotes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-600 mb-1 uppercase tracking-wider">Internal Notes</p>
              <p className="text-sm text-amber-900">{b.internalNotes}</p>
            </div>
          )}
        </div>
      </div>

      <PaymentModal
        booking={paymentOpen ? b : null}
        onClose={() => setPaymentOpen(false)}
        onSaved={refreshBooking}
      />
      <WhatsAppModal
        booking={waOpen ? b : null}
        onClose={() => setWaOpen(false)}
      />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProgramsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1, statusCounts: {} as Record<string, number> });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [packages, setPackages] = useState<Package[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [r2Enabled, setR2Enabled] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<Booking | null>(null);
  const [editTarget, setEditTarget] = useState<Booking | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const [bRes, pkgRes, tmRes, compRes] = await Promise.all([
        apiFetch(`${API}/bookings?${params}`),
        apiFetch(`${API}/programs?limit=100`),
        apiFetch(`${API}/team`),
        apiFetch(`${API}/companies/me`),
      ]);
      if (bRes.ok) { const d = await bRes.json(); setBookings(d.data ?? []); setMeta(d.meta); }
      if (pkgRes.ok) { const d = await pkgRes.json(); setPackages(d.data ?? d ?? []); }
      if (tmRes.ok) { setTeamMembers(await tmRes.json()); }
      if (compRes.ok) { const d = await compRes.json(); setR2Enabled(!!d.r2Enabled); }
    } finally { setLoading(false); }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const allStatuses = Object.entries(meta.statusCounts ?? {}).filter(([, c]) => c > 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Programs</h1>
          <p className="text-slate-400 text-xs mt-0.5">{meta.total} total programs</p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm gap-1.5 h-9">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">New Program</span>
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search programs..." className="pl-9 h-10 border-slate-200" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
        </div>
        {allStatuses.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setStatusFilter("all")}
              className={cn("h-7 px-3 rounded-full text-xs font-medium border transition-all",
                statusFilter === "all" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200")}>
              All · {meta.total}
            </button>
            {allStatuses.map(([s, c]) => {
              const sc = STATUS_CFG[s]; if (!sc) return null;
              return (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={cn("h-7 px-3 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5",
                    statusFilter === s ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200")}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", sc.dot)} />{sc.label} · {c}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16">
          <CalendarDays className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No programs yet</p>
          <Button onClick={() => setNewOpen(true)} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm gap-1.5 h-9">
            <Plus className="w-4 h-4" />New Program
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {bookings.map(b => (
            <ProgramCard key={b.id} b={b}
              onView={() => setViewTarget(b)}
              onEdit={() => setEditTarget(b)}
              onDelete={() => setDeleteTarget(b)} />
          ))}
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
            className="h-8 px-3 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:border-slate-300">← Prev</button>
          <span className="text-sm text-slate-500">{page} / {meta.totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= meta.totalPages}
            className="h-8 px-3 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:border-slate-300">Next →</button>
        </div>
      )}

      {/* Create */}
      <ProgramDrawer open={newOpen} onClose={() => setNewOpen(false)} onSaved={fetchAll} packages={packages} teamMembers={teamMembers} />
      {/* Edit */}
      <ProgramDrawer
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => { fetchAll(); setEditTarget(null); }}
        packages={packages}
        teamMembers={teamMembers}
        initialBooking={editTarget}
      />
      <ViewDrawer
        booking={viewTarget}
        onClose={() => setViewTarget(null)}
        onEdit={() => { setEditTarget(viewTarget); setViewTarget(null); }}
        onRefresh={fetchAll}
        r2Enabled={r2Enabled}
      />
      <DeleteDialog booking={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={fetchAll} />
    </div>
  );
}
