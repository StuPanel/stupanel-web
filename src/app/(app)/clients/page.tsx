"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import {
  Search, Plus, Filter, Phone, Mail, MapPin, Star, MoreVertical,
  Camera, CreditCard, Building2, User, Loader2, X, AlertTriangle,
  Edit3, Trash2, Eye, ChevronLeft, ChevronRight, LayoutGrid, List,
  Link2, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ClientFormFields, blankClientForm, type ClientFormData } from "@/components/client-form-fields";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Client {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  phoneSecondary?: string;
  gender?: string;
  dateOfBirth?: string;
  anniversaryDate?: string;
  occupation?: string;
  companyName?: string;
  address?: string;
  city?: string;
  source?: string;
  notes?: string;
  internalNotes?: string;
  vipStatus?: boolean;
  isActive?: boolean;
  createdAt?: string;
  bookings?: { id: string; bookingNumber: string; eventName?: string; eventDate?: string; status: string; grandTotal: number; paidAmount: number }[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";


function fullName(c: Client) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
}

function initials(c: Client) {
  const f = c.firstName?.[0] ?? "";
  const l = c.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-cyan-100 text-cyan-700",
  "bg-yellow-100 text-yellow-700",
];

function avatarColor(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n += id.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

// ─── Add / Edit Drawer ──────────────────────────────────────────────────────

function ClientDrawer({
  open, onClose, onSaved, editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: Client | null;
}) {
  const isEdit = !!editing;

  const [form, setForm] = useState<ClientFormData>(blankClientForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      if (editing) {
        setForm({
          firstName: editing.firstName ?? "",
          lastName: editing.lastName ?? "",
          email: editing.email ?? "",
          phone: editing.phone ?? "",
          phoneSecondary: editing.phoneSecondary ?? "",
          facebookProfile: (editing as any).facebookProfile ?? "",
          city: editing.city ?? "",
          source: editing.source ?? "",
          address: (editing as any).address ?? "",
          occupation: editing.occupation ?? "",
          companyName: editing.companyName ?? "",
          vipStatus: editing.vipStatus ?? false,
          notes: editing.notes ?? "",
          internalNotes: editing.internalNotes ?? "",
        });
      } else {
        setForm(blankClientForm);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim()) { setError("First name is required."); return; }
    setError("");
    setLoading(true);

    const body = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      phoneSecondary: form.phoneSecondary.trim() || undefined,
      facebookProfile: form.facebookProfile.trim() || undefined,
      city: form.city.trim() || undefined,
      source: form.source || undefined,
      address: form.address.trim() || undefined,
      occupation: form.occupation.trim() || undefined,
      companyName: form.companyName.trim() || undefined,
      notes: form.notes.trim() || undefined,
      internalNotes: form.internalNotes.trim() || undefined,
      vipStatus: form.vipStatus,
    };

    try {
      const url = isEdit ? `${API}/clients/${editing!.id}` : `${API}/clients`;
      const res = await apiFetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { const msg = data.message; setError(Array.isArray(msg) ? msg[0] : (msg || "Failed to save.")); return; }
      onSaved();
      onClose();
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">{isEdit ? "Edit Client" : "Add Client"}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{isEdit ? `Editing ${fullName(editing!)}` : "Add a new client"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <form id="client-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">

            {error && (
              <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            )}

            <ClientFormFields
              value={form}
              onChange={updates => setForm(prev => ({ ...prev, ...updates }))}
              autoFocus={!isEdit}
            />

          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 flex gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200 text-slate-600">
            Cancel
          </Button>
          <Button type="submit" form="client-form" disabled={loading}
            className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />{isEdit ? "Saving..." : "Adding..."}</>
              : isEdit ? "Save Changes" : "Add Client"
            }
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── View Profile Drawer ────────────────────────────────────────────────────

function ProfileDrawer({
  client, onClose, onEdit,
}: {
  client: Client | null;
  onClose: () => void;
  onEdit: (c: Client) => void;
}) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalCopied, setPortalCopied] = useState(false);

  async function sharePortal() {
    if (!client) return;
    setPortalLoading(true);
    try {
      const res = await apiFetch(`${API}/client-portal/generate/${client.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const d = await res.json();
      const link = `${window.location.origin}/portal/${d.token}`;
      await navigator.clipboard.writeText(link);
      setPortalCopied(true);
      setTimeout(() => setPortalCopied(false), 3000);
    } catch { /* ignore */ }
    setPortalLoading(false);
  }

  if (!client) return null;
  const color = avatarColor(client.id);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-900 text-lg">Client Profile</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={sharePortal} disabled={portalLoading}
              className="gap-1.5 h-8 text-xs border-slate-200">
              {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
               portalCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> :
               <Link2 className="w-3.5 h-3.5" />}
              {portalCopied ? "Copied!" : "Portal"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { onClose(); onEdit(client); }}
              className="gap-1.5 h-8 text-xs border-slate-200">
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </Button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Avatar + Name */}
          <div className="flex items-center gap-4">
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl", color)}>
              {initials(client)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-xl">{fullName(client)}</h3>
                {client.vipStatus && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
              </div>
              {client.occupation && <p className="text-sm text-slate-500">{client.occupation}</p>}
              {client.companyName && (
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3 h-3" /> {client.companyName}
                </p>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</p>
            {client.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-700">{client.phone}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-700">{client.email}</span>
              </div>
            )}
            {client.city && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-700">{client.city}</span>
              </div>
            )}
            {client.source && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Source:</span>
                <span className="text-xs text-slate-600 font-medium capitalize">{client.source.replace("_", " ")}</span>
              </div>
            )}
          </div>

          {/* Recent Bookings */}
          {client.bookings && client.bookings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recent Bookings</p>
              {client.bookings.map(b => (
                <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono text-slate-400">{b.bookingNumber}</p>
                    <p className="text-sm font-medium text-slate-900">{b.eventName || "Untitled"}</p>
                    {b.eventDate && (
                      <p className="text-xs text-slate-400">
                        {new Date(b.eventDate).toLocaleDateString("en-US", { dateStyle: "medium" })}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">৳{Number(b.grandTotal).toLocaleString()}</p>
                    <p className={cn("text-xs font-medium",
                      b.paidAmount >= b.grandTotal && b.grandTotal > 0 ? "text-emerald-600" : "text-orange-500"
                    )}>
                      {b.paidAmount >= b.grandTotal && b.grandTotal > 0 ? "Paid" : `Due ৳${Math.max(0, b.grandTotal - b.paidAmount).toLocaleString()}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {client.notes && (
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1.5">Notes</p>
              <p className="text-sm text-slate-700">{client.notes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Delete Dialog ──────────────────────────────────────────────────────────

function DeleteDialog({
  client, onClose, onDeleted,
}: {
  client: Client | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  if (!client) return null;

  async function doDelete() {
    setLoading(true);
    try {
      await apiFetch(`${API}/clients/${client!.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      onDeleted();
      onClose();
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h3 className="font-bold text-slate-900 text-lg">Delete Client?</h3>
          <p className="text-slate-500 text-sm mt-2">
            <span className="font-semibold text-slate-700">{fullName(client)}</span> and all related data will be deleted.
          </p>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200">Cancel</Button>
            <Button onClick={doDelete} disabled={loading}
              className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Client Row (Table) ─────────────────────────────────────────────────────

function ClientRow({
  client, onView, onEdit, onDelete,
}: {
  client: Client;
  onView: (c: Client) => void;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
}) {
  const color = avatarColor(client.id);

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
      onClick={() => onView(client)}>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0", color)}>
            {initials(client)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-slate-900 text-sm truncate">{fullName(client)}</span>
              {client.vipStatus && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
            </div>
            <p className="text-xs text-slate-400 capitalize">{client.source?.replace("_", " ") || "—"}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 hidden md:table-cell">
        <div className="space-y-0.5">
          {client.phone && <p className="text-xs text-slate-600 flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</p>}
          {client.email && <p className="text-xs text-slate-400 flex items-center gap-1 truncate max-w-[160px]"><Mail className="w-3 h-3" />{client.email}</p>}
        </div>
      </td>
      <td className="py-3 px-4 hidden lg:table-cell">
        {client.city ? (
          <span className="text-xs text-slate-600 flex items-center gap-1"><MapPin className="w-3 h-3" />{client.city}</span>
        ) : <span className="text-slate-300 text-xs">—</span>}
      </td>
      <td className="py-3 px-4 hidden lg:table-cell">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Camera className="w-3.5 h-3.5" />
          {client.bookings?.length ?? 0}
        </div>
      </td>
      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
              <MoreVertical className="w-4 h-4 text-slate-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem className="gap-2 text-sm" onClick={() => onView(client)}>
              <Eye className="w-4 h-4" /> View Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-sm" onClick={() => onEdit(client)}>
              <Edit3 className="w-4 h-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-sm text-red-600" onClick={() => onDelete(client)}>
              <Trash2 className="w-4 h-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

// ─── Client Card ────────────────────────────────────────────────────────────

function ClientCard({
  client, onView, onEdit, onDelete,
}: {
  client: Client;
  onView: (c: Client) => void;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
}) {
  const color = avatarColor(client.id);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4"
      onClick={() => onView(client)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0", color)}>
            {initials(client)}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-900 text-sm">{fullName(client)}</span>
              {client.vipStatus && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />}
            </div>
            {client.city && <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{client.city}</p>}
          </div>
        </div>
        <div onClick={e => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100">
                <MoreVertical className="w-4 h-4 text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem className="gap-2 text-sm" onClick={() => onView(client)}><Eye className="w-4 h-4" /> View Profile</DropdownMenuItem>
              <DropdownMenuItem className="gap-2 text-sm" onClick={() => onEdit(client)}><Edit3 className="w-4 h-4" /> Edit</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-sm text-red-600" onClick={() => onDelete(client)}><Trash2 className="w-4 h-4" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-1 mb-3">
        {client.phone && <p className="text-xs text-slate-500 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" />{client.phone}</p>}
        {client.email && <p className="text-xs text-slate-500 flex items-center gap-1.5 truncate"><Mail className="w-3.5 h-3.5 text-slate-400" />{client.email}</p>}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Camera className="w-3.5 h-3.5" />
          {client.bookings?.length ?? 0} booking{(client.bookings?.length ?? 0) !== 1 ? "s" : ""}
        </div>
        {client.source && (
          <span className="text-xs text-slate-400 capitalize">{client.source.replace("_", " ")}</span>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [vipOnly, setVipOnly] = useState(false);
  const [view, setView] = useState<"table" | "card">("table");
  const [loading, setLoading] = useState(true);

  const [drawer, setDrawer] = useState(false);
  const [editTarget, setEditTarget] = useState<Client | null>(null);
  const [viewTarget, setViewTarget] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const LIMIT = 20;

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search && { search }),
        ...(vipOnly && { vipStatus: "true" }),
      });
      const res = await apiFetch(`${API}/clients?${params}`, { headers: { "Content-Type": "application/json" } });
      if (!res.ok) return;
      const data = await res.json();
      setClients(data.data ?? []);
      setTotal(data.meta?.total ?? 0);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [page, search, vipOnly]);

  useEffect(() => { fetchClients(); }, [fetchClients]);
  useEffect(() => { setPage(1); }, [search, vipOnly]);

  function openNew() { setEditTarget(null); setDrawer(true); }
  function openEdit(c: Client) { setEditTarget(c); setDrawer(true); }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Clients</h1>
          <p className="text-slate-400 text-xs mt-0.5">{total} total clients</p>
        </div>
        <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm gap-1.5 h-9">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Client</span>
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by name, phone, email..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-white border-slate-200" />
        </div>

        {/* VIP filter */}
        <button
          onClick={() => setVipOnly(v => !v)}
          className={cn("flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-colors flex-shrink-0",
            vipOnly ? "bg-yellow-100 border-yellow-300 text-yellow-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
          )}
        >
          <Star className={cn("w-3.5 h-3.5", vipOnly ? "fill-yellow-500 text-yellow-500" : "text-slate-400")} />
          VIP
        </button>

        <Button variant="outline" size="sm" className="gap-1.5 border-slate-200 text-slate-600 h-9 flex-shrink-0">
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline">Filter</span>
        </Button>

        {/* View toggle — desktop only */}
        <div className="hidden sm:flex border border-slate-200 rounded-lg p-0.5 bg-white flex-shrink-0">
          <button onClick={() => setView("table")}
            className={cn("p-1.5 rounded-md transition-colors",
              view === "table" ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:text-slate-600"
            )}>
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => setView("card")}
            className={cn("p-1.5 rounded-md transition-colors",
              view === "card" ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:text-slate-600"
            )}>
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16">
          <User className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No clients found</p>
          <p className="text-slate-300 text-xs mt-1">
            {search ? "Try a different search term" : "Add your first client to get started"}
          </p>
          {!search && (
            <Button onClick={openNew} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm gap-1.5 h-9">
              <Plus className="w-4 h-4" /> Add Client
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Table — desktop default, hidden on mobile */}
          <div className={cn("hidden", view === "table" ? "sm:block" : "")}>
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Contact</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">City</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Bookings</th>
                      <th className="py-3 px-4 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map(c => (
                      <ClientRow key={c.id} client={c}
                        onView={c => setViewTarget(c)}
                        onEdit={openEdit}
                        onDelete={c => setDeleteTarget(c)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Card grid — mobile always, desktop when toggled */}
          <div className={cn(
            "grid grid-cols-1 gap-3",
            view === "table" ? "sm:hidden" : "sm:grid-cols-2 xl:grid-cols-3"
          )}>
            {clients.map(c => (
              <ClientCard key={c.id} client={c}
                onView={c => setViewTarget(c)}
                onEdit={openEdit}
                onDelete={c => setDeleteTarget(c)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-slate-400">Page {page} of {totalPages} · {total} clients</p>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="h-8 w-8 p-0 border-slate-200">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="h-8 w-8 p-0 border-slate-200">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Drawers & Dialogs */}
      <ClientDrawer
        open={drawer}
        onClose={() => { setDrawer(false); setEditTarget(null); }}
        onSaved={fetchClients}
        editing={editTarget}
      />
      <ProfileDrawer
        client={viewTarget}
        onClose={() => setViewTarget(null)}
        onEdit={c => { setViewTarget(null); openEdit(c); }}
      />
      <DeleteDialog
        client={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={fetchClients}
      />
    </div>
  );
}
