"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Loader2, Camera, Video, Image, Film, Navigation, Briefcase, Tag,
  Phone, Mail, CalendarDays, UserCheck, UserX, Edit3, KeyRound,
  TrendingUp, Wallet, Clock, CheckCircle2, Plus, Save, ChevronRight,
  MessageSquare, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { API_URL as API } from "@/lib/api";
import { formatCurrency, fmtDate as sharedFmtDate } from "@/lib/format";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Member {
  id: string; memberId: string; username: string; email: string;
  firstName: string; lastName?: string; phone?: string; bio?: string;
  memberRoles: string[]; isActive: boolean;
  payRate?: number | null; payRateType?: string | null;
  roleRates?: { roleId: string; rate: number; rateType: string; note?: string }[];
  createdAt: string; adminNotes?: string;
}

interface ProgramEntry {
  id: string; bookingNumber: string; eventName?: string;
  eventDate?: string; status: string; currency: string;
  role: string; totalBill: number; note: string; clientName: string;
}

interface SalarySlip {
  id: string; month: number; year: number;
  baseSalary: string; deductions: string; netSalary: string;
  notes?: string; status: string; paidAt?: string;
}

interface ProfileData {
  member: Member;
  stats: { totalPrograms: number; thisMonthPrograms: number; lifetimeEarned: number; totalPaid: number; pendingAmount: number };
  programs: ProgramEntry[];
  salarySlips: SalarySlip[];
}

// ─── Constants ───────────────────────────────────────────────────────────────
const DEFAULT_ROLES = [
  { id: "photographer",    label: "Photographer",   icon: Camera,     color: "bg-blue-100 text-blue-700" },
  { id: "cinematographer", label: "Cinematographer", icon: Video,      color: "bg-violet-100 text-violet-700" },
  { id: "photo_editor",   label: "Photo Editor",    icon: Image,      color: "bg-emerald-100 text-emerald-700" },
  { id: "video_editor",   label: "Video Editor",    icon: Film,       color: "bg-orange-100 text-orange-700" },
  { id: "drone_pilot",    label: "Drone Pilot",     icon: Navigation, color: "bg-sky-100 text-sky-700" },
  { id: "assistant",      label: "Assistant",       icon: Briefcase,  color: "bg-slate-100 text-slate-700" },
];

const STATUS_CFG: Record<string, { label: string; dot: string; badge: string }> = {
  draft:              { label: "Draft",       dot: "bg-slate-400",   badge: "bg-slate-100 text-slate-600" },
  confirmed:          { label: "Confirmed",   dot: "bg-blue-400",    badge: "bg-blue-100 text-blue-700" },
  in_progress:        { label: "Shooting",    dot: "bg-amber-400",   badge: "bg-amber-100 text-amber-700" },
  editing:            { label: "Editing",     dot: "bg-purple-400",  badge: "bg-purple-100 text-purple-700" },
  ready_for_delivery: { label: "Ready",       dot: "bg-indigo-400",  badge: "bg-indigo-100 text-indigo-700" },
  delivered:          { label: "Delivered",   dot: "bg-teal-400",    badge: "bg-teal-100 text-teal-700" },
  completed:          { label: "Completed",   dot: "bg-emerald-400", badge: "bg-emerald-100 text-emerald-700" },
  cancelled:          { label: "Cancelled",   dot: "bg-red-400",     badge: "bg-red-100 text-red-700" },
};

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtDate(d?: string | null) { return sharedFmtDate(d); }

function roleConfig(id: string, customRoles: string[] = []) {
  const def = DEFAULT_ROLES.find(r => r.id === id);
  if (def) return def;
  if (customRoles.includes(id)) return { id, label: id, icon: Tag, color: "bg-indigo-100 text-indigo-700" };
  return { id, label: id, icon: Tag, color: "bg-slate-100 text-slate-600" };
}

function avatarBg(memberId: string) {
  const colors = ["bg-indigo-500","bg-violet-500","bg-emerald-500","bg-blue-500","bg-orange-500","bg-pink-500"];
  return colors[memberId.charCodeAt(memberId.length - 1) % colors.length];
}

// ─── Add Payment Modal ────────────────────────────────────────────────────────
function AddPaymentModal({ memberId, onClose, onSaved }: {
  memberId: string; onClose: () => void; onSaved: () => void;
}) {
  const now = new Date();
  const [form, setForm] = useState({
    amount: "", deductions: "", notes: "",
    month: now.getMonth() + 1, year: now.getFullYear(),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const net = (parseFloat(form.amount) || 0) - (parseFloat(form.deductions) || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) { setError("Amount is required."); return; }
    setSaving(true); setError("");
    try {
      const r = await apiFetch(`${API}/team/${memberId}/salary-slip`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: form.month, year: form.year,
          amount: parseFloat(form.amount),
          deductions: parseFloat(form.deductions) || 0,
          notes: form.notes || undefined,
        }),
      });
      if (r.ok) { onSaved(); onClose(); }
      else { const d = await r.json(); setError(d.message || "Failed to save."); }
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-60" onClick={onClose} />
      <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-slate-900">Add Payment Record</h3>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          {error && <div className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Month</p>
                <select value={form.month} onChange={e => setForm(f => ({ ...f, month: Number(e.target.value) }))}
                  className="w-full h-10 px-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400">
                  {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Year</p>
                <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Amount *</p>
              <input type="number" min="0" step="100" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0" autoFocus
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Deductions <span className="text-slate-400">(optional)</span></p>
              <input type="number" min="0" step="100" value={form.deductions}
                onChange={e => setForm(f => ({ ...f, deductions: e.target.value }))}
                placeholder="0"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            {form.amount && (
              <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <span className="text-xs text-emerald-700">Net Payment</span>
                <span className="text-sm font-bold text-emerald-700">{formatCurrency(net)}</span>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500 mb-1">Note <span className="text-slate-400">(optional)</span></p>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Payment for June programs..."
                className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 h-10 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving}
                className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── Profile Drawer ───────────────────────────────────────────────────────────
export function ProfileDrawer({ member, onClose, onEdit, onReset, onToggle, customRoles }: {
  member: Member | null;
  onClose: () => void;
  onEdit: (m: Member) => void;
  onReset: (m: Member) => void;
  onToggle: (m: Member) => void;
  customRoles: string[];
}) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"programs" | "payments">("programs");
  const [addPayOpen, setAddPayOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchProfile = useCallback(async () => {
    if (!member) return;
    setLoading(true);
    try {
      const r = await apiFetch(`${API}/team/${member.id}/profile`);
      if (r.ok) {
        const d = await r.json();
        setData(d);
        setNotes(d.member.adminNotes ?? "");
      }
    } finally { setLoading(false); }
  }, [member?.id]);

  useEffect(() => {
    if (!member) { setData(null); return; }
    setTab("programs");
    fetchProfile();
  }, [member?.id]);

  async function saveNotes(value: string) {
    if (!member) return;
    setSavingNotes(true);
    try {
      await apiFetch(`${API}/team/${member.id}/admin-notes`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value }),
      });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } finally { setSavingNotes(false); }
  }

  function handleNotesChange(val: string) {
    setNotes(val);
    setNotesSaved(false);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => saveNotes(val), 1200);
  }

  if (!member) return null;

  const initials = (member.firstName[0] + (member.lastName?.[0] ?? "")).toUpperCase();
  const bg = avatarBg(member.memberId);
  const stats = data?.stats;
  const programs = data?.programs ?? [];
  const slips = data?.salarySlips ?? [];

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Member Profile</p>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Identity Header ── */}
          <div className="px-5 py-5 border-b border-slate-100">
            <div className="flex items-start gap-4">
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0", bg)}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{member.memberId}</span>
                  <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-semibold",
                    member.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                    {member.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <h2 className="font-bold text-slate-900 text-lg mt-1 leading-tight">{member.firstName} {member.lastName ?? ""}</h2>
                <p className="text-sm text-slate-400">@{member.username}</p>
              </div>
            </div>

            {/* Contact row */}
            <div className="mt-4 space-y-1.5">
              {member.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-700">{member.phone}</span>
                  <a href={`https://wa.me/${member.phone.replace(/\D/g,"").replace(/^0/,"88")}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200 font-medium hover:bg-green-100">
                    WhatsApp
                  </a>
                </div>
              )}
              {member.email && !member.email.includes(".internal") && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-700">{member.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-sm text-slate-500">Joined {fmtDate(member.createdAt)}</span>
              </div>
            </div>

            {/* Role badges */}
            {member.memberRoles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {member.memberRoles.map(rid => {
                  const rc = roleConfig(rid, customRoles);
                  const Icon = rc.icon;
                  return (
                    <span key={rid} className={cn("flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-medium", rc.color)}>
                      <Icon className="w-3 h-3" />{rc.label}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mt-4">
              <button onClick={() => onEdit(member)}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                <Edit3 className="w-3.5 h-3.5" />Edit Info
              </button>
              <button onClick={() => onReset(member)}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                <KeyRound className="w-3.5 h-3.5" />Reset Password
              </button>
              <button onClick={() => onToggle(member)}
                className={cn("flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-medium transition-colors",
                  member.isActive
                    ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50")}>
                {member.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                {member.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
          ) : (
            <>
              {/* ── Stats Cards ── */}
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Overview</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">Total Programs</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{stats?.totalPrograms ?? 0}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">This Month</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900">{stats?.thisMonthPrograms ?? 0}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[10px] font-semibold text-emerald-500 uppercase">Lifetime Earned</span>
                    </div>
                    <p className="text-xl font-bold text-emerald-700">{formatCurrency(stats?.lifetimeEarned ?? 0)}</p>
                  </div>
                  <div className={cn("rounded-xl p-3 border", (stats?.pendingAmount ?? 0) > 0 ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100")}>
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className={cn("w-3.5 h-3.5", (stats?.pendingAmount ?? 0) > 0 ? "text-amber-500" : "text-slate-400")} />
                      <span className={cn("text-[10px] font-semibold uppercase", (stats?.pendingAmount ?? 0) > 0 ? "text-amber-500" : "text-slate-400")}>Pending</span>
                    </div>
                    <p className={cn("text-xl font-bold", (stats?.pendingAmount ?? 0) > 0 ? "text-amber-700" : "text-slate-500")}>
                      {formatCurrency(stats?.pendingAmount ?? 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Tabs ── */}
              <div className="px-5 pt-4">
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4">
                  {(["programs","payments"] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                      className={cn("flex-1 h-8 rounded-lg text-xs font-semibold transition-all capitalize",
                        tab === t ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}>
                      {t === "programs" ? `Programs (${programs.length})` : `Payments (${slips.length})`}
                    </button>
                  ))}
                </div>

                {/* Programs Tab */}
                {tab === "programs" && (
                  <div className="space-y-2 pb-4">
                    {programs.length === 0 ? (
                      <div className="text-center py-10 text-slate-400">
                        <Camera className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                        <p className="text-sm">No programs assigned yet</p>
                      </div>
                    ) : programs.map(p => {
                      const sc = STATUS_CFG[p.status] ?? { label: p.status, dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600" };
                      return (
                        <div key={p.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{p.eventName ?? p.bookingNumber}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{p.clientName} · {fmtDate(p.eventDate)}</p>
                              {p.role && (
                                <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium capitalize">
                                  {p.role.replace(/_/g," ")}
                                </span>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-emerald-700">{formatCurrency(Number(p.totalBill))}</p>
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block", sc.badge)}>{sc.label}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Payments Tab */}
                {tab === "payments" && (
                  <div className="pb-4 space-y-3">
                    <button onClick={() => setAddPayOpen(true)}
                      className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 transition-colors">
                      <Plus className="w-4 h-4" />Add Payment Record
                    </button>

                    {slips.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <Wallet className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                        <p className="text-sm">No payment records yet</p>
                      </div>
                    ) : slips.map(s => (
                      <div key={s.id} className="bg-white rounded-xl p-3 border border-slate-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{MONTH_NAMES[s.month - 1]} {s.year}</p>
                            {s.notes && <p className="text-xs text-slate-400 mt-0.5">{s.notes}</p>}
                            {Number(s.deductions) > 0 && (
                              <p className="text-xs text-red-500 mt-0.5">-{formatCurrency(Number(s.deductions))} deduction</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-base font-bold text-emerald-700">{formatCurrency(Number(s.netSalary))}</p>
                            <div className="flex items-center gap-1 justify-end mt-0.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span className="text-[10px] text-emerald-600 font-medium">Paid</span>
                            </div>
                            {s.paidAt && <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(s.paidAt)}</p>}
                          </div>
                        </div>
                      </div>
                    ))}

                    {slips.length > 0 && (
                      <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                        <span className="text-xs text-slate-500 font-medium">Total Paid</span>
                        <span className="text-sm font-bold text-slate-800">{formatCurrency(stats?.totalPaid ?? 0)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Rate Card ── */}
              {(member.roleRates?.length ?? 0) > 0 && (
                <div className="px-5 py-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Rate Card</p>
                    <button onClick={() => onEdit(member)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                      <Edit3 className="w-3 h-3" />Edit
                    </button>
                  </div>
                  <div className="space-y-2">
                    {member.roleRates?.filter(r => r.rate).map(r => {
                      const rc = roleConfig(r.roleId, customRoles);
                      const Icon = rc.icon;
                      const typeLabel = r.rateType === "per_program" ? "/ Program" : r.rateType === "per_day" ? "/ Day" : "/ Month";
                      return (
                        <div key={r.roleId} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-sm text-slate-700 font-medium">{rc.label}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-emerald-700">{formatCurrency(Number(r.rate))}</span>
                            <span className="text-xs text-slate-400 ml-1">{typeLabel}</span>
                          </div>
                        </div>
                      );
                    })}
                    {member.roleRates?.every(r => !r.rate) && (
                      <p className="text-xs text-slate-400 text-center py-2">No rates set · <button onClick={() => onEdit(member)} className="text-indigo-500 underline">Add rates</button></p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Admin Notes ── */}
              <div className="px-5 py-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Admin Notes</p>
                    <span className="text-[10px] text-slate-300">(private, member can&apos;t see)</span>
                  </div>
                  {savingNotes && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                  {notesSaved && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                      <CheckCircle2 className="w-3 h-3" />Saved
                    </span>
                  )}
                </div>
                <textarea
                  value={notes}
                  onChange={e => handleNotesChange(e.target.value)}
                  rows={3}
                  placeholder="Private notes about this member (attendance, behavior, special arrangements...)"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm placeholder:text-slate-300 focus:outline-none focus:border-indigo-400 resize-none"
                />
                <div className="flex justify-end mt-2">
                  <button onClick={() => saveNotes(notes)} disabled={savingNotes}
                    className="flex items-center gap-1.5 px-3 h-8 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {savingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}Save Notes
                  </button>
                </div>
              </div>

              {/* bottom pad */}
              <div className="h-6" />
            </>
          )}
        </div>
      </div>

      {addPayOpen && (
        <AddPaymentModal
          memberId={member.id}
          onClose={() => setAddPayOpen(false)}
          onSaved={() => { fetchProfile(); setAddPayOpen(false); }}
        />
      )}
    </>
  );
}
