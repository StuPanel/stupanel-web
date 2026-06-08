"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, X, Loader2, AlertTriangle, Trash2, Edit3, MoreVertical,
  Eye, EyeOff, Camera, Video, Image, Film, KeyRound, UserCheck,
  UserX, Shield, CheckCircle2, XCircle, Navigation, Briefcase, Tag, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_ROLES = [
  { id: "photographer",    label: "Photographer",    icon: Camera,      color: "bg-blue-100 text-blue-700" },
  { id: "cinematographer", label: "Cinematographer",  icon: Video,       color: "bg-violet-100 text-violet-700" },
  { id: "photo_editor",   label: "Photo Editor",     icon: Image,       color: "bg-emerald-100 text-emerald-700" },
  { id: "video_editor",   label: "Video Editor",     icon: Film,        color: "bg-orange-100 text-orange-700" },
  { id: "drone_pilot",    label: "Drone Pilot",      icon: Navigation,  color: "bg-sky-100 text-sky-700" },
  { id: "assistant",      label: "Assistant",        icon: Briefcase,   color: "bg-slate-100 text-slate-700" },
];

function roleConfig(id: string, customRoles: string[] = []) {
  const def = DEFAULT_ROLES.find(r => r.id === id);
  if (def) return def;
  if (customRoles.includes(id)) return { id, label: id, icon: Tag, color: "bg-indigo-100 text-indigo-700" };
  return { id, label: id, icon: Tag, color: "bg-slate-100 text-slate-600" };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Member {
  id: string; memberId: string; username: string;
  email: string;
  firstName: string; lastName?: string; phone?: string;
  bio?: string; memberRoles: string[]; isActive: boolean;
  payRate?: number | null; payRateType?: string | null;
  roleRates?: { roleId: string; rate: number; rateType: string; note?: string }[];
  createdAt: string;
}

interface RoleRate { roleId: string; rate: string; rateType: string; note: string; }

// ─── Member Drawer ─────────────────────────────────────────────────────────────
function MemberDrawer({ open, onClose, onSaved, editing, customRoles, onCustomRolesChange }: {
  open: boolean; onClose: () => void; onSaved: () => void; editing?: Member | null;
  customRoles: string[]; onCustomRolesChange: (roles: string[]) => void;
}) {
  const isEdit = !!editing;
  const blank = { firstName: "", lastName: "", phone: "", email: "", username: "", password: "", bio: "", memberRoles: [] as string[], payRate: "", payRateType: "per_program", roleRates: [] as RoleRate[] };
  const [form, setForm] = useState(blank);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unCheck, setUnCheck] = useState<{ checking: boolean; available: boolean | null; suggestions: string[] }>({ checking: false, available: null, suggestions: [] });
  const unTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [newRoleInput, setNewRoleInput] = useState("");
  const [addingRole, setAddingRole] = useState(false);
  const [showRoleInput, setShowRoleInput] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setUnCheck({ checking: false, available: null, suggestions: [] });
    setShowRoleInput(false);
    setNewRoleInput("");
    if (editing) {
      const realEmail = editing.email?.includes(".internal") ? "" : (editing.email ?? "");
      const existingRates: RoleRate[] = Array.isArray(editing.roleRates)
        ? editing.roleRates.map(r => ({ roleId: r.roleId, rate: String(r.rate ?? ""), rateType: r.rateType ?? "per_program", note: r.note ?? "" }))
        : [];
      setForm({ firstName: editing.firstName, lastName: editing.lastName ?? "",
        phone: editing.phone ?? "", email: realEmail, username: editing.username,
        password: "", bio: editing.bio ?? "", memberRoles: editing.memberRoles,
        payRate: editing.payRate ? String(editing.payRate) : "",
        payRateType: editing.payRateType ?? "per_program",
        roleRates: existingRates });
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
    setForm(p => {
      const hasRole = p.memberRoles.includes(rid);
      return {
        ...p,
        memberRoles: hasRole ? p.memberRoles.filter(r => r !== rid) : [...p.memberRoles, rid],
        roleRates: hasRole
          ? p.roleRates.filter(r => r.roleId !== rid)
          : [...p.roleRates, { roleId: rid, rate: "", rateType: "per_program", note: "" }],
      };
    });
  }

  function updateRoleRate(roleId: string, field: keyof RoleRate, value: string) {
    setForm(p => ({
      ...p,
      roleRates: p.roleRates.map(r => r.roleId === roleId ? { ...r, [field]: value } : r),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim()) { setError("Name is required."); return; }
    if (!form.username.trim()) { setError("Username is required."); return; }
    if (unCheck.available === false) { setError("Please choose an available username."); return; }
    if (!isEdit && form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError(""); setLoading(true);
    try {
      const payRateVal = form.payRate ? parseFloat(form.payRate) : undefined;
      const cleanRoleRates = form.roleRates
        .filter(r => r.rate.trim() !== "")
        .map(r => ({ roleId: r.roleId, rate: parseFloat(r.rate), rateType: r.rateType, note: r.note || undefined }));
      const base = {
        firstName: form.firstName, lastName: form.lastName || undefined,
        phone: form.phone || undefined, email: form.email || undefined,
        bio: form.bio || undefined, memberRoles: form.memberRoles,
        payRate: payRateVal, payRateType: payRateVal ? form.payRateType : undefined,
        roleRates: cleanRoleRates,
      };
      const body = isEdit
        ? { ...base, username: form.username || undefined }
        : { ...base, username: form.username, password: form.password };
      const url = isEdit ? `${API}/team/${editing!.id}` : `${API}/team`;
      const r = await apiFetch(url, { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setError(d.message || "Failed to save."); return; }
      onSaved(); onClose();
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  }

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-900 text-lg">{isEdit ? "Edit Member" : "Add Team Member"}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <form id="member-form" onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">First Name *</Label>
              <Input value={form.firstName} onChange={set("firstName")} placeholder="Alex" className="h-11 border-slate-200" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Last Name</Label>
              <Input value={form.lastName} onChange={set("lastName")} placeholder="Carter" className="h-11 border-slate-200" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Phone</Label>
            <Input value={form.phone} onChange={set("phone")} placeholder="01XXXXXXXXX" className="h-11 border-slate-200" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">
              Email <span className="text-slate-400 font-normal">(for notifications)</span>
            </Label>
            <Input
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="alex@example.com"
              className="h-11 border-slate-200"
            />
            <p className="text-[11px] text-slate-400">Optional — used to send assignment &amp; event notifications</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Username * <span className="text-slate-400 font-normal">(for login)</span></Label>
            <div className="relative">
              <Input
                value={form.username}
                onChange={e => handleUsernameChange(e.target.value)}
                placeholder="alex_photo"
                className={cn("h-11 border-slate-200 pr-9",
                  unCheck.available === true && "border-emerald-400 focus:border-emerald-400",
                  unCheck.available === false && "border-red-400 focus:border-red-400",
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {unCheck.checking && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                {!unCheck.checking && unCheck.available === true && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                {!unCheck.checking && unCheck.available === false && <XCircle className="w-4 h-4 text-red-500" />}
              </div>
            </div>
            {/* Availability message */}
            {!unCheck.checking && unCheck.available === true && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Username available
              </p>
            )}
            {!unCheck.checking && unCheck.available === false && (
              <div>
                <p className="text-xs text-red-500 flex items-center gap-1 mb-1.5">
                  <XCircle className="w-3 h-3" /> Username already taken
                </p>
                {unCheck.suggestions.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400">Try:</span>
                    {unCheck.suggestions.map(s => (
                      <button key={s} type="button"
                        onClick={() => { setForm(p => ({ ...p, username: s })); handleUsernameChange(s); }}
                        className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-colors font-medium">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Password *</Label>
              <div className="relative">
                <Input type={showPass ? "text" : "password"} value={form.password} onChange={set("password")}
                  placeholder="Min. 6 characters" className="pr-10 h-11 border-slate-200" />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Roles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-slate-600">Roles <span className="text-slate-400 font-normal">(multiple allowed)</span></Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[...DEFAULT_ROLES, ...customRoles.map(cr => ({ id: cr, label: cr, icon: Tag, color: "bg-indigo-100 text-indigo-700" }))].map(r => {
                const Icon = r.icon;
                const selected = form.memberRoles.includes(r.id);
                return (
                  <button key={r.id} type="button" onClick={() => toggleRole(r.id)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left",
                      selected ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                    )}>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs flex-1 truncate">{r.label}</span>
                    {selected && <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>}
                  </button>
                );
              })}
            </div>

            {/* Add custom role */}
            {showRoleInput ? (
              <div className="flex gap-2 mt-1">
                <input
                  value={newRoleInput}
                  onChange={e => setNewRoleInput(e.target.value)}
                  onKeyDown={async e => { if (e.key === "Enter") { e.preventDefault(); await handleAddCustomRole(); } if (e.key === "Escape") { setShowRoleInput(false); setNewRoleInput(""); } }}
                  placeholder="e.g. Makeup Artist"
                  className="flex-1 h-9 px-3 rounded-lg border border-indigo-300 text-sm focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
                <button type="button" onClick={handleAddCustomRole} disabled={addingRole}
                  className="h-9 px-3 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {addingRole ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
                </button>
                <button type="button" onClick={() => { setShowRoleInput(false); setNewRoleInput(""); }}
                  className="h-9 px-2 border border-slate-200 rounded-lg text-slate-400 hover:bg-slate-50">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowRoleInput(true)}
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-1">
                <Plus className="w-3.5 h-3.5" />Add Custom Role
              </button>
            )}
          </div>

          {/* Per-role rates */}
          {form.memberRoles.length > 0 && (
            <div className="space-y-2.5">
              <Label className="text-xs font-medium text-slate-600">
                Payment Rate per Role <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              {form.memberRoles.map(rid => {
                const roleCfg = [...DEFAULT_ROLES, ...customRoles.map(cr => ({ id: cr, label: cr, icon: Tag, color: "" }))].find(r => r.id === rid);
                const rr = form.roleRates.find(r => r.roleId === rid) ?? { roleId: rid, rate: "", rateType: "per_program", note: "" };
                return (
                  <div key={rid} className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-700">{roleCfg?.label ?? rid}</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">৳</span>
                        <input
                          type="number" min="0" step="100"
                          value={rr.rate}
                          onChange={e => updateRoleRate(rid, "rate", e.target.value)}
                          placeholder="0"
                          className="w-full h-9 pl-6 pr-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <select
                        value={rr.rateType}
                        onChange={e => updateRoleRate(rid, "rateType", e.target.value)}
                        className="h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-indigo-400 text-slate-700 cursor-pointer">
                        <option value="per_program">/ Program</option>
                        <option value="per_day">/ Day</option>
                        <option value="monthly">/ Month</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      value={rr.note}
                      onChange={e => updateRoleRate(rid, "note", e.target.value)}
                      placeholder="Note (e.g. with own setup, studio gear included...)"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-indigo-400 placeholder:text-slate-400"
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Note / Bio</Label>
            <textarea value={form.bio} onChange={set("bio")} rows={2} placeholder="Optional note..."
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 resize-none" />
          </div>
        </form>
        <div className="px-5 py-4 border-t border-slate-200 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200">Cancel</Button>
          <Button type="submit" form="member-form" disabled={loading} className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{isEdit ? "Saving..." : "Adding..."}</> : isEdit ? "Save Changes" : "Add Member"}
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── Reset Password Dialog ─────────────────────────────────────────────────────
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
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
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
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  function act(fn: () => void) { fn(); setOpen(false); }
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400">
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
          <button onClick={() => act(onEdit)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><Edit3 className="w-4 h-4 text-slate-400" />Edit Info</button>
          <button onClick={() => act(onReset)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><KeyRound className="w-4 h-4 text-slate-400" />Reset Password</button>
          <button onClick={() => act(onToggle)} className={cn("w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-slate-50", member.isActive ? "text-amber-600" : "text-emerald-600")}>
            {member.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            {member.isActive ? "Deactivate" : "Activate"}
          </button>
          <div className="border-t border-slate-100" />
          <button onClick={() => act(onDelete)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" />Remove</button>
        </div>
      )}
    </div>
  );
}

// ─── Member Card ───────────────────────────────────────────────────────────────
function MemberCard({ m, customRoles, onEdit, onReset, onToggle, onDelete }: {
  m: Member; customRoles: string[];
  onEdit: () => void; onReset: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const initials = (m.firstName[0] + (m.lastName?.[0] ?? "")).toUpperCase();
  const colors = ["bg-indigo-500","bg-violet-500","bg-emerald-500","bg-blue-500","bg-orange-500","bg-pink-500"];
  const bg = colors[m.memberId.charCodeAt(m.memberId.length - 1) % colors.length];

  function waLink(phone: string) {
    const digits = phone.replace(/\D/g, "");
    const intl = digits.startsWith("0") ? "88" + digits : digits;
    return `https://wa.me/${intl}`;
  }

  return (
    <div className={cn("bg-white border rounded-xl p-4 shadow-sm transition-opacity", !m.isActive && "opacity-60")}>
      <div className="flex items-start gap-3">
        <div className={cn("w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0", bg)}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400">{m.memberId}</span>
            {!m.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Inactive</span>}
          </div>
          <h3 className="font-bold text-slate-900 text-sm mt-0.5">{m.firstName} {m.lastName ?? ""}</h3>
          <p className="text-xs text-slate-400">@{m.username}</p>
          {m.email && !m.email.includes(".internal") && (
            <p className="text-xs text-slate-400 mt-0.5">{m.email}</p>
          )}
          {Array.isArray(m.roleRates) && m.roleRates.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {m.roleRates.filter(r => r.rate).map(r => {
                const lbl = [...DEFAULT_ROLES, ...customRoles.map(cr => ({ id: cr, label: cr }))].find(x => x.id === r.roleId)?.label ?? r.roleId;
                const type = r.rateType === "per_program" ? "prog" : r.rateType === "per_day" ? "day" : "mo";
                return (
                  <span key={r.roleId} className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-medium">
                    {lbl}: ৳{Number(r.rate).toLocaleString()}/{type}
                  </span>
                );
              })}
            </div>
          ) : m.payRate ? (
            <p className="text-xs text-emerald-600 font-medium mt-0.5">
              ৳{Number(m.payRate).toLocaleString()} / {m.payRateType === "per_program" ? "program" : m.payRateType === "per_day" ? "day" : "month"}
            </p>
          ) : null}
          {m.phone && (
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-400">{m.phone}</p>
              <a href={waLink(m.phone)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors font-medium border border-green-200">
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
            </div>
          )}
        </div>
        <ActionMenu member={m} onEdit={onEdit} onReset={onReset} onToggle={onToggle} onDelete={onDelete} />
      </div>
      {m.memberRoles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {m.memberRoles.map(rid => {
            const rc = roleConfig(rid, customRoles);
            const Icon = rc.icon;
            return (
              <span key={rid} className={cn("flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium", rc.color)}>
                <Icon className="w-2.5 h-2.5" />{rc.label}
              </span>
            );
          })}
        </div>
      )}
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
      m.username.toLowerCase().includes(q) ||
      (m.phone ?? "").includes(q) ||
      m.memberId.toLowerCase().includes(q);
    const matchRole = roleFilter === "all" || m.memberRoles.includes(roleFilter);
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team</h1>
          <p className="text-slate-400 text-xs mt-0.5">{members.filter(m => m.isActive).length} active · {members.length} total</p>
        </div>
        <Button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm gap-1.5 h-9">
          <Plus className="w-4 h-4" /><span className="hidden sm:inline">Add Member</span>
        </Button>
      </div>

      {/* Search + Role filter */}
      {members.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, username, phone..."
              className="pl-9 h-10 border-slate-200"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setRoleFilter("all")}
              className={cn("h-7 px-3 rounded-full text-xs font-medium border transition-all",
                roleFilter === "all" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}>
              All · {members.length}
            </button>
            {roleStats.filter(r => r.count > 0).map(r => {
              const Icon = r.icon;
              return (
                <button key={r.id} onClick={() => setRoleFilter(roleFilter === r.id ? "all" : r.id)}
                  className={cn("h-7 px-3 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5",
                    roleFilter === r.id ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}>
                  <Icon className="w-3 h-3" />{r.label} · {r.count}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : members.length === 0 ? (
        <div className="text-center py-16">
          <Shield className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No team members yet</p>
          <p className="text-slate-300 text-xs mt-1">Add photographers, editors and cinematographers</p>
          <Button onClick={openAdd} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm gap-1.5 h-9">
            <Plus className="w-4 h-4" />Add Member
          </Button>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No members match your search</p>
          <button onClick={() => { setSearch(""); setRoleFilter("all"); }} className="mt-2 text-xs text-indigo-500 hover:text-indigo-600">Clear filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredMembers.map(m => (
            <MemberCard key={m.id} m={m} customRoles={customRoles}
              onEdit={() => openEdit(m)}
              onReset={() => setResetTarget(m)}
              onToggle={() => toggleStatus(m)}
              onDelete={() => setDeleteTarget(m)} />
          ))}
        </div>
      )}

      <MemberDrawer open={drawer} onClose={() => { setDrawer(false); setEditTarget(null); }} onSaved={fetchMembers} editing={editTarget} customRoles={customRoles} onCustomRolesChange={setCustomRoles} />
      <ResetPassDialog member={resetTarget} onClose={() => setResetTarget(null)} onDone={fetchMembers} />
      <DeleteDialog member={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={fetchMembers} />
    </div>
  );
}
