"use client";

/** Add / edit a client (drawer) and the delete confirmation — used by the clients list and the client profile page. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Check, Loader2, Plus, Trash2, Users } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { ClientFormFields, blankClientForm, type ClientFormData } from "@/components/client-form-fields";
import { FormDrawer } from "@/components/ui/form-kit";
import { notify } from "@/components/feedback";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Client {
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

export function fullName(c: { firstName: string; lastName?: string | null }) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
}

// ─── Add / Edit Drawer ──────────────────────────────────────────────────────

export function ClientDrawer({
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

// ─── Delete Dialog ──────────────────────────────────────────────────────────

export function DeleteDialog({
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
          <div className="w-14 h-14 rounded-full bg-[#FDECEF] flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-[#C2304F]" />
          </div>
          <h3 className="font-extrabold text-[#17151F] text-lg">Delete this client?</h3>
          <p className="text-[#6B6680] text-sm mt-2">
            <span className="font-semibold text-[#33303F]">{fullName(client)}</span> and all related data will be deleted.
          </p>
          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-sm font-semibold text-[#17151F]">Cancel</button>
            <button type="button" onClick={doDelete} disabled={loading}
              className="flex-1 h-11 rounded-full bg-[#C2304F] hover:bg-[#A82642] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

