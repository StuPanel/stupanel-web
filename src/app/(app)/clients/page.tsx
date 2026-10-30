"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search, Plus, Phone, Mail, MapPin, Star, MoreHorizontal, Users,
  Camera, Building2, User, Loader2, X, AlertTriangle,
  Edit3, Trash2, Eye, Link2,
} from "lucide-react";
import { Chips, EmptyState, Group, MainButton, PageHeader, Pager, RowsSkeleton, SearchField } from "@/components/ui/apple";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ClientFormFields, blankClientForm, type ClientFormData } from "@/components/client-form-fields";
import { API_URL as API } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { PortalAccessModal } from "@/components/portal-access-modal";

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
  referredByClientId?: string;
  referredByName?: string;
  referredByClientName?: string;
  notes?: string;
  internalNotes?: string;
  vipStatus?: boolean;
  isActive?: boolean;
  createdAt?: string;
  bookings?: { id: string; bookingNumber: string; eventName?: string; eventDate?: string; status: string; grandTotal: number; paidAmount: number; currency?: string }[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────



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
          referredByClientId: editing.referredByClientId ?? "",
          referredByName: editing.referredByClientName ?? editing.referredByName ?? "",
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
      referredByClientId: form.source === "referral" && form.referredByClientId ? form.referredByClientId : undefined,
      referredByName: form.source === "referral" && !form.referredByClientId && form.referredByName.trim() ? form.referredByName.trim() : undefined,
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
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div className="sp-drawer z-50 max-w-lg flex flex-col">
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
  const [portalOpen, setPortalOpen] = useState(false);

  if (!client) return null;
  const color = avatarColor(client.id);

  return (
    <>
      {portalOpen && <PortalAccessModal client={client} onClose={() => setPortalOpen(false)} />}
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div className="sp-drawer z-50 max-w-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-900 text-lg">Client Profile</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPortalOpen(true)}
              className="gap-1.5 h-8 text-xs border-slate-200">
              <Link2 className="w-3.5 h-3.5" /> Portal
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
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(Number(b.grandTotal), b.currency)}</p>
                    <p className={cn("text-xs font-medium",
                      b.paidAmount >= b.grandTotal && b.grandTotal > 0 ? "text-emerald-600" : "text-orange-500"
                    )}>
                      {b.paidAmount >= b.grandTotal && b.grandTotal > 0 ? "Paid" : `Due ${formatCurrency(Math.max(0, b.grandTotal - b.paidAmount), b.currency)}`}
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
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="sp-modal w-full max-w-sm p-6 text-center">
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

// ─── Client row (Apple style) ───────────────────────────────────────────────

function ClientListRow({
  client, onView, onEdit, onDelete,
}: {
  client: Client;
  onView: (c: Client) => void;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
}) {
  const n = client.bookings?.length ?? 0;
  const sub = [client.phone, client.city].filter(Boolean).join(" · ") || client.email || "No contact yet";
  return (
    <div role="button" tabIndex={0} onClick={() => onView(client)} onKeyDown={e => { if (e.key === "Enter") onView(client); }}
      className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[68px] cursor-pointer hover:bg-[#F7F5FB] transition-colors focus:outline-none focus-visible:bg-[#F7F5FB]">
      <span className="w-11 h-11 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-sm font-bold flex items-center justify-center flex-shrink-0">
        {initials(client)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#17151F] truncate flex items-center gap-1.5">
          {fullName(client)}
          {client.vipStatus && <span className="text-[11px] font-bold text-[#9E3A8C] bg-[#FBF2FA] px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5"><Star className="w-3 h-3 fill-current" />VIP</span>}
        </p>
        <p className="text-xs text-[#6B6680] truncate mt-0.5">{sub}</p>
      </div>
      <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-[#4A4658] bg-[#F5F3FA] px-2.5 py-1 rounded-full flex-shrink-0">
        <Camera className="w-3.5 h-3.5" />{n} program{n === 1 ? "" : "s"}
      </span>
      {client.phone && (
        <a href={`tel:${client.phone}`} onClick={e => e.stopPropagation()} aria-label={`Call ${fullName(client)}`}
          className="w-9 h-9 rounded-full flex items-center justify-center text-[#1F8A5B] hover:bg-[#E9F5EF] flex-shrink-0">
          <Phone className="w-4 h-4" />
        </a>
      )}
      <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label={`More for ${fullName(client)}`} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#EEEBF4] text-[#6B6680]">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-[16px] p-1">
            <DropdownMenuItem className="gap-2 text-sm h-10 rounded-[12px]" onClick={() => onView(client)}><Eye className="w-4 h-4" /> Open profile</DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-sm h-10 rounded-[12px]" onClick={() => onEdit(client)}><Edit3 className="w-4 h-4" /> Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-sm h-10 rounded-[12px] text-[#C2304F]" onClick={() => onDelete(client)}><Trash2 className="w-4 h-4" /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [vipOnly, setVipOnly] = useState(false);
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

  // Auto-open drawer when navigating from search (?view=id)
  useEffect(() => {
    const viewId = searchParams.get("view");
    if (!viewId || loading) return;
    const found = clients.find((c) => c.id === viewId);
    if (found) {
      setViewTarget(found);
      router.replace("/clients", { scroll: false });
    } else {
      apiFetch(`${API}/clients/${viewId}`).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setViewTarget(data);
          router.replace("/clients", { scroll: false });
        }
      });
    }
  }, [searchParams, clients, loading, router]);

  function openNew() { setEditTarget(null); setDrawer(true); }
  function openEdit(c: Client) { setEditTarget(c); setDrawer(true); }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="max-w-[1180px]">
      <PageHeader icon={Users} color="blue" title="Clients"
        sub={total ? `${total} client${total === 1 ? "" : "s"}` : "Everyone you work with"}>
        <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={search} onChange={setSearch} placeholder="Search name or phone" />
        <MainButton icon={Plus} onClick={openNew}>Add client</MainButton>
      </PageHeader>

      <Chips label="Filter clients" value={vipOnly ? "vip" : "all"} onChange={v => setVipOnly(v === "vip")}
        options={[{ value: "all", label: "All clients" }, { value: "vip", label: "VIP", dot: "#9E3A8C" }]} />

      {loading ? (
        <RowsSkeleton n={6} />
      ) : clients.length === 0 ? (
        search || vipOnly ? (
          <EmptyState icon={Search} title={search ? `No clients match "${search}"` : "No VIP clients yet"} text="Try another name or phone number." />
        ) : (
          <EmptyState icon={User} title="No clients yet" text="Add your first client to get started."
            action={<MainButton icon={Plus} onClick={openNew}>Add client</MainButton>} />
        )
      ) : (
        <Group>
          {clients.map(c => (
            <ClientListRow key={c.id} client={c}
              onView={c => setViewTarget(c)}
              onEdit={openEdit}
              onDelete={c => setDeleteTarget(c)} />
          ))}
        </Group>
      )}

      <Pager page={page} pages={totalPages} onChange={setPage} />

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
