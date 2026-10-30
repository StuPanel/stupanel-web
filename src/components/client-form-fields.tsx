"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Camera, Globe, MessageCircle, Search, Share2, Store, UserPlus, Users } from "lucide-react";
import { ReferrerInput } from "@/components/ui/referrer-input";
import { Field, FormGroup, MoreDetails, PillPicker, SwitchRow, inputCls, phoneKey } from "@/components/ui/form-kit";
import { apiFetch, API_URL as API } from "@/lib/api";

export interface ClientFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phoneSecondary: string;
  facebookProfile: string;
  city: string;
  source: string;
  referredByClientId: string;
  referredByName: string;
  address: string;
  occupation: string;
  companyName: string;
  vipStatus: boolean;
  notes: string;
  internalNotes: string;
}

export const blankClientForm: ClientFormData = {
  firstName: "", lastName: "", email: "", phone: "",
  phoneSecondary: "", facebookProfile: "", city: "", source: "",
  referredByClientId: "", referredByName: "",
  address: "", occupation: "", companyName: "",
  vipStatus: false, notes: "", internalNotes: "",
};

export const CLIENT_SOURCES = [
  { value: "facebook", label: "Facebook", icon: Share2 },
  { value: "referral", label: "Referral", icon: Users },
  { value: "walk_in", label: "Walk-in", icon: Store },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "instagram", label: "Instagram", icon: Camera },
  { value: "google", label: "Google", icon: Search },
  { value: "website", label: "Website", icon: Globe },
  { value: "other", label: "Other", icon: UserPlus },
];

export type ExistingClient = { id: string; firstName: string; lastName?: string | null; phone?: string | null };

interface ClientFormFieldsProps {
  value: ClientFormData;
  onChange: (updates: Partial<ClientFormData>) => void;
  autoFocus?: boolean;
  /** Client being edited — not reported as a duplicate of itself. */
  excludeId?: string;
  /** What to offer when the phone already belongs to a client. */
  existingAction?: { label: string; onPick: (c: ExistingClient) => void };
}

/** Looks up clients with the same phone (last 10 digits), after the user stops typing. */
function useSamePhone(phone: string, excludeId?: string) {
  const [match, setMatch] = useState<ExistingClient | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    const key = phoneKey(phone);
    if (key.length < 10) { setMatch(null); return; }
    timer.current = setTimeout(async () => {
      try {
        const r = await apiFetch(`${API}/clients?search=${encodeURIComponent(key)}&limit=5`);
        if (!r.ok) return;
        const d = await r.json();
        const list: ExistingClient[] = Array.isArray(d?.data) ? d.data : [];
        setMatch(list.find(c => c.id !== excludeId && phoneKey(c.phone) === key) ?? null);
      } catch { /* offline: the server still blocks duplicates */ }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [phone, excludeId]);
  return match;
}

export function ClientFormFields({ value, onChange, autoFocus, excludeId, existingAction }: ClientFormFieldsProps) {
  const set = (key: keyof ClientFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ [key]: e.target.value });
  const same = useSamePhone(value.phone, excludeId);
  const extraCount = [value.phoneSecondary, value.facebookProfile, value.city, value.address, value.occupation, value.companyName, value.notes, value.internalNotes]
    .filter(v => v.trim()).length + (value.vipStatus ? 1 : 0);

  return (
    <div>
      <FormGroup title="Client">
        <Field label="Name" required>
          {id => (
            <div className="grid grid-cols-2 gap-2">
              <input id={id} className={inputCls} placeholder="First name" value={value.firstName} onChange={set("firstName")}
                autoFocus={autoFocus} autoComplete="off" aria-label="First name" />
              <input className={inputCls} placeholder="Last name" value={value.lastName} onChange={set("lastName")}
                autoComplete="off" aria-label="Last name" />
            </div>
          )}
        </Field>
        <Field label="Phone / WhatsApp" required>
          {id => (
            <>
              <input id={id} className={inputCls} type="tel" inputMode="tel" placeholder="01XXXXXXXXX"
                value={value.phone} onChange={set("phone")} autoComplete="off" />
              {same && (
                <div role="status" className="mt-2 flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] bg-[#FDECEF]">
                  <AlertTriangle className="w-4 h-4 text-[#C2304F] flex-shrink-0" />
                  <p className="flex-1 text-[13px] text-[#8A2340] leading-snug">
                    This number belongs to <strong>{[same.firstName, same.lastName].filter(Boolean).join(" ")}</strong>.
                  </p>
                  {existingAction && (
                    <button type="button" onClick={() => existingAction.onPick(same)}
                      className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-white text-[13px] font-semibold text-[#17151F] hover:bg-[#F5F3FA] flex-shrink-0">
                      {existingAction.label}<ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </Field>
        <Field label="Email" hint="Needed for reminder, invoice and delivery emails.">
          {id => <input id={id} className={inputCls} type="email" inputMode="email" placeholder="client@email.com"
            value={value.email} onChange={set("email")} autoComplete="off" />}
        </Field>
      </FormGroup>

      <FormGroup title="How did they find you?">
        <div className="px-4 py-3.5">
          <PillPicker label="Source" options={CLIENT_SOURCES} value={value.source}
            onChange={v => onChange({ source: value.source === v ? "" : v })} />
        </div>
        {value.source === "referral" && (
          <Field label="Referred by" hint="Pick a client, or type any name.">
            {() => (
              <ReferrerInput
                clientId={value.referredByClientId || undefined}
                name={value.referredByName}
                onChange={({ clientId, name }) => onChange({ referredByClientId: clientId ?? "", referredByName: name ?? "" })}
              />
            )}
          </Field>
        )}
      </FormGroup>

      <MoreDetails sub={extraCount ? `${extraCount} filled` : "Second phone, Facebook, address, work, VIP, notes"} defaultOpen={extraCount > 0}>
        <FormGroup title="Contact">
          <Field label="Second phone">
            {id => <input id={id} className={inputCls} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={value.phoneSecondary} onChange={set("phoneSecondary")} />}
          </Field>
          <Field label="Facebook profile">
            {id => <input id={id} className={inputCls} placeholder="facebook.com/username" value={value.facebookProfile} onChange={set("facebookProfile")} />}
          </Field>
          <Field label="City">
            {id => <input id={id} className={inputCls} placeholder="Feni" value={value.city} onChange={set("city")} />}
          </Field>
          <Field label="Address">
            {id => <input id={id} className={inputCls} placeholder="House, road, area" value={value.address} onChange={set("address")} />}
          </Field>
        </FormGroup>
        <FormGroup title="Work">
          <Field label="Occupation">
            {id => <input id={id} className={inputCls} placeholder="e.g. Engineer" value={value.occupation} onChange={set("occupation")} />}
          </Field>
          <Field label="Company / organisation" hint="For corporate and school programs.">
            {id => <input id={id} className={inputCls} placeholder="Company name" value={value.companyName} onChange={set("companyName")} />}
          </Field>
        </FormGroup>
        <FormGroup title="Notes">
          <SwitchRow label="VIP client" hint="Marked with a star in lists" on={value.vipStatus} onChange={v => onChange({ vipStatus: v })} />
          <Field label="Notes">
            {id => <textarea id={id} rows={2} className={inputCls + " h-auto py-2.5 resize-none"} placeholder="Anything about this client…" value={value.notes} onChange={set("notes")} />}
          </Field>
          <Field label="Private notes" hint="Only your team sees these — never the client.">
            {id => <textarea id={id} rows={2} className={inputCls + " h-auto py-2.5 resize-none"} placeholder="Internal notes…" value={value.internalNotes} onChange={set("internalNotes")} />}
          </Field>
        </FormGroup>
      </MoreDetails>
    </div>
  );
}
