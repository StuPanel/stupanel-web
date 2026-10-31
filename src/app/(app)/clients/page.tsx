"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search, Plus, Phone, Mail, MapPin, Star, MoreHorizontal, Users,
  Camera, Building2, User, Loader2, X, AlertTriangle,
  Edit3, Trash2, Eye, Link2, Check, MessageCircle, Wallet, CheckCircle2, CalendarDays,
} from "lucide-react";
import { Chips, DateBox, EmptyState, Group, MainButton, PageHeader, Pager, RowsSkeleton, SearchField } from "@/components/ui/apple";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CLIENT_SOURCES, ClientFormFields, blankClientForm, type ClientFormData } from "@/components/client-form-fields";
import { ActionButton, Avatar, IdentityCard, InfoRow, MiniStat, ProfileShell, waLink } from "@/components/ui/profile-kit";
import { STATUS_CFG } from "../programs/_components/constants";
import { FormDrawer } from "@/components/ui/form-kit";
import { notify } from "@/components/feedback";
import { API_URL as API } from "@/lib/api";
import { formatCurrency, fmtDate } from "@/lib/format";
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
  open, onClose, onSaved, editing, onOpenExisting,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: Client | null;
  onOpenExisting: (id: string) => void;
}) {
  const router = useRouter();
  const isEdit = !!editing;

  const [form, setForm] = useState<ClientFormData>(blankClientForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (open) {
      setError(""); setAdded(null);
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
    if (!form.firstName.trim()) { setError("Please write the client's name."); return; }
    if (!form.phone.trim()) { setError("Please add a phone number — it's how you'll reach them."); return; }
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
      if (!res.ok) { const msg = data.message; setError(Array.isArray(msg) ? msg[0] : (msg || "Couldn't save. Please try again.")); return; }
      onSaved();
      if (isEdit) { notify("Client saved"); onClose(); }
      else setAdded({ id: data.id, name: [body.firstName, body.lastName].filter(Boolean).join(" ") });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (added) {
    return (
      <FormDrawer open={open} onClose={onClose} icon={Users} color="blue" title="Client added"
        footer={<button type="button" onClick={onClose} className="flex-1 h-12 rounded-full bg-[#EEEBF4] text-[15px] font-semibold text-[#17151F] hover:bg-[#E4E0EC]">Done</button>}>
        <div className="bg-white rounded-[20px] p-6 text-center shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)]">
          <div className="w-14 h-14 rounded-full bg-[#E9F5EF] flex items-center justify-center mx-auto">
            <Check className="w-7 h-7 text-[#1F8A5B]" />
          </div>
          <p className="mt-4 text-[17px] font-bold text-[#17151F]">{added.name} is saved</p>
          <p className="mt-1 text-sm text-[#6B6680]">What next?</p>
          <div className="mt-5 grid gap-2">
            <button type="button" onClick={() => router.push(`/programs?newFor=${added.id}`)}
              className="h-12 rounded-full bg-[#7D5CEF] hover:bg-[#6C4BE0] text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2">
              <Camera className="w-4 h-4" />Create a program for them
            </button>
            <button type="button" onClick={() => { setAdded(null); setForm(blankClientForm); }}
              className="h-12 rounded-full bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[#17151F] text-[15px] font-semibold inline-flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />Add another client
            </button>
          </div>
        </div>
      </FormDrawer>
    );
  }

  return (
    <FormDrawer open={open} onClose={onClose} icon={Users} color="blue"
      title={isEdit ? "Edit client" : "New client"}
      sub={isEdit ? fullName(editing!) : "Only name and phone are needed — add the rest any time."}
      footer={<>
        <button type="button" onClick={onClose} className="flex-1 h-12 rounded-full bg-[#EEEBF4] text-[15px] font-semibold text-[#17151F] hover:bg-[#E4E0EC]">Cancel</button>
        <button type="submit" form="client-form" disabled={loading}
          className="flex-[1.4] h-12 rounded-full bg-[#7D5CEF] hover:bg-[#6C4BE0] disabled:opacity-60 text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : isEdit ? "Save changes" : "Add client"}
        </button>
      </>}>
      <form id="client-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div role="alert" className="mb-4 px-4 py-3 rounded-[14px] bg-[#FDECEF] text-[#8A2340] text-sm font-medium">{error}</div>
        )}
        <ClientFormFields
          value={form}
          onChange={updates => setForm(prev => ({ ...prev, ...updates }))}
          autoFocus={!isEdit}
          excludeId={editing?.id}
          existingAction={{ label: "Open", onPick: c => onOpenExisting(c.id) }}
        />
      </form>
    </FormDrawer>
  );
}

// ─── View Profile Drawer ────────────────────────────────────────────────────

type ClientDetail = Client & {
  facebookProfile?: string;
  stats?: { programs: number; total: number; paid: number; due: number; nextProgram: { id: string; eventName?: string; eventDate?: string } | null };
  referrals?: { id: string; firstName: string; lastName?: string; createdAt: string }[];
};
type ClientPayment = { id: string; amount: number; currency?: string; paymentMethod?: string; paymentDate?: string; booking?: { eventName?: string; bookingNumber?: string } };

const METHOD_LABEL: Record<string, string> = { cash: "Cash", mobile_banking: "bKash / Nagad", bank_transfer: "Bank", card: "Card", other: "Other" };

function ProfileDrawer({
  client, onClose, onEdit,
}: {
  client: Client | null;
  onClose: () => void;
  onEdit: (c: Client) => void;
}) {
  const router = useRouter();
  const [portalOpen, setPortalOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [payments, setPayments] = useState<ClientPayment[]>([]);

  useEffect(() => {
    setDetail(null); setPayments([]); setMoreOpen(false);
    if (!client) return;
    apiFetch(`${API}/clients/${client.id}`).then(r => r.ok ? r.json() : null).then(d => d && setDetail(d)).catch(() => {});
    apiFetch(`${API}/payments?clientId=${client.id}&limit=10`).then(r => r.ok ? r.json() : null)
      .then(d => setPayments(Array.isArray(d?.data) ? d.data : [])).catch(() => {});
  }, [client]);

  if (!client) return null;
  const c: ClientDetail = { ...client, ...(detail ?? {}) };
  const name = fullName(c);
  const st = c.stats;
  const bookings = c.bookings ?? [];
  const src = CLIENT_SOURCES.find(s => s.value === c.source);

  return (
    <>
      {portalOpen && <PortalAccessModal client={client} onClose={() => setPortalOpen(false)} />}
      <ProfileShell open onClose={onClose} label="Client">
        <IdentityCard
          avatar={<Avatar name={name} color="#1F5C99" />}
          name={<span className="inline-flex items-center gap-2">{name}{c.vipStatus && <Star className="w-5 h-5 text-[#9E3A8C] fill-[#9E3A8C]" aria-label="VIP" />}</span>}
          sub={[c.phone, c.companyName || c.occupation].filter(Boolean).join(" · ") || "No phone yet"}
          chips={<>
            {c.vipStatus && <span className="h-6 px-2.5 rounded-full bg-[#FBF2FA] text-[#9E3A8C] text-xs font-bold inline-flex items-center">VIP</span>}
            {src && <span className="h-6 px-2.5 rounded-full bg-[#F5F3FA] text-[#4A4658] text-xs font-semibold inline-flex items-center">From {src.label}{c.source === "referral" && (c.referredByClientName || c.referredByName) ? ` · ${c.referredByClientName || c.referredByName}` : ""}</span>}
          </>}
          actions={<>
            <ActionButton icon={MessageCircle} label="WhatsApp" tone="green" href={waLink(c.phone)} disabled={!c.phone} />
            <ActionButton icon={Phone} label="Call" tone="blue" href={c.phone ? `tel:${c.phone}` : undefined} disabled={!c.phone} />
            <ActionButton icon={Camera} label="New program" tone="violet" onClick={() => router.push(`/programs?newFor=${c.id}`)} />
            <div className="relative">
              <ActionButton icon={MoreHorizontal} label="More" tone="ink" onClick={() => setMoreOpen(o => !o)} />
              {moreOpen && (
                <div role="menu" className="absolute right-0 top-[72px] w-52 bg-white rounded-[16px] shadow-[0_2px_4px_rgba(22,18,40,.06),0_16px_32px_rgba(22,18,40,.14)] z-30 p-1">
                  <button role="menuitem" onClick={() => { setMoreOpen(false); onClose(); onEdit(client); }} className="w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#17151F] hover:bg-[#F5F3FA]"><Edit3 className="w-4 h-4 text-[#6B6680]" />Edit details</button>
                  <button role="menuitem" onClick={() => { setMoreOpen(false); setPortalOpen(true); }} className="w-full flex items-center gap-2.5 px-3 h-10 rounded-[12px] text-sm text-[#17151F] hover:bg-[#F5F3FA]"><Link2 className="w-4 h-4 text-[#6B6680]" />Client portal link</button>
                </div>
              )}
            </div>
          </>}
        />

        <div className="grid grid-cols-2 gap-3 mb-7">
          <MiniStat icon={Wallet} color="red" label="Due now" value={formatCurrency(st?.due ?? 0)} tone={(st?.due ?? 0) > 0 ? "red" : undefined} sub={(st?.due ?? 0) > 0 ? "Across their programs" : "Nothing due"} />
          <MiniStat icon={CheckCircle2} color="green" label="Paid so far" value={formatCurrency(st?.paid ?? 0)} sub={`of ${formatCurrency(st?.total ?? 0)}`} />
          <MiniStat icon={Camera} color="deep" label="Programs" value={st?.programs ?? bookings.length} sub={c.createdAt ? `Client since ${fmtDate(c.createdAt)}` : undefined} />
          <MiniStat icon={CalendarDays} color="blue" label="Next program" value={st?.nextProgram ? fmtDate(st.nextProgram.eventDate) : "—"} sub={st?.nextProgram?.eventName ?? "Nothing booked"} />
        </div>

        <Group title="Programs" action={<button type="button" onClick={() => router.push(`/programs?newFor=${c.id}`)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#5B3FD0]"><Plus className="w-3.5 h-3.5" />New</button>}>
          {bookings.length === 0 ? <InfoRow left={<span className="text-[#A29DB3]">No programs yet</span>} /> : bookings.map(b => {
            const due = Math.max(0, Number(b.grandTotal) - Number(b.paidAmount));
            return (
              <button key={b.id} type="button" onClick={() => router.push(`/programs?view=${b.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F7F5FB] transition-colors">
                <DateBox date={b.eventDate} />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#17151F] truncate">{b.eventName || "Untitled program"}</p>
                  <p className="text-xs text-[#6B6680] truncate mt-0.5">{b.bookingNumber} · {STATUS_CFG[b.status]?.label ?? b.status}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[15px] font-bold text-[#17151F] tabular-nums">{formatCurrency(Number(b.grandTotal), b.currency)}</p>
                  {Number(b.grandTotal) > 0 && (due > 0
                    ? <p className="text-xs font-semibold text-[#C2304F] tabular-nums">{formatCurrency(due, b.currency)} due</p>
                    : <p className="text-xs font-semibold text-[#1F8A5B]">Paid</p>)}
                </div>
              </button>
            );
          })}
        </Group>

        <Group title="Payments">
          {payments.length === 0 ? <InfoRow left={<span className="text-[#A29DB3]">No payments yet</span>} /> : payments.map(p => (
            <InfoRow key={p.id}
              left={p.booking?.eventName || p.booking?.bookingNumber || "Payment"}
              sub={[fmtDate(p.paymentDate), METHOD_LABEL[p.paymentMethod ?? ""] ?? p.paymentMethod].filter(Boolean).join(" · ")}
              right={<p className="text-[15px] font-bold text-[#1F8A5B] tabular-nums">{formatCurrency(Number(p.amount), p.currency)}</p>} />
          ))}
        </Group>

        <Group title="Details" action={<button type="button" onClick={() => { onClose(); onEdit(client); }} className="text-[13px] font-semibold text-[#5B3FD0]">Edit</button>}>
          {c.phone && <InfoRow left={c.phone} sub="Phone / WhatsApp" />}
          {c.phoneSecondary && <InfoRow left={c.phoneSecondary} sub="Second phone" />}
          {c.email && <InfoRow left={<span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-[#6B6680]" />{c.email}</span>} sub="Email" />}
          {c.facebookProfile && <InfoRow left={c.facebookProfile} sub="Facebook" />}
          {(c.address || c.city) && <InfoRow left={[c.address, c.city].filter(Boolean).join(", ")} sub="Address" />}
          {c.occupation && <InfoRow left={c.occupation} sub="Occupation" />}
          {c.companyName && <InfoRow left={c.companyName} sub="Company / organisation" />}
          {!c.phone && !c.email && !c.address && !c.city && <InfoRow left={<span className="text-[#A29DB3]">No details yet</span>} />}
        </Group>

        {(c.referrals?.length ?? 0) > 0 && (
          <Group title={`Brought ${c.referrals!.length} client${c.referrals!.length === 1 ? "" : "s"}`} note="Clients who came through this person.">
            {c.referrals!.map(r => (
              <InfoRow key={r.id} left={`${r.firstName} ${r.lastName ?? ""}`.trim()} sub={`Added ${fmtDate(r.createdAt)}`}
                onClick={() => router.push(`/clients?view=${r.id}`)} />
            ))}
          </Group>
        )}

        {(c.notes || c.internalNotes) && (
          <Group title="Notes">
            {c.notes && <InfoRow left={<span className="whitespace-normal">{c.notes}</span>} sub="Notes" />}
            {c.internalNotes && <InfoRow left={<span className="whitespace-normal">{c.internalNotes}</span>} sub="Private — only your team" />}
          </Group>
        )}
      </ProfileShell>
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
    <div>
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
        onOpenExisting={id => { setDrawer(false); setEditTarget(null); router.push(`/clients?view=${id}`); }}
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
