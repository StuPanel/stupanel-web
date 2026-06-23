"use client";

import { Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReferrerInput } from "@/components/ui/referrer-input";
import { cn } from "@/lib/utils";

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
  { value: "referral", label: "Referral" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "google", label: "Google" },
  { value: "website", label: "Website" },
  { value: "walk_in", label: "Walk-in" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "other", label: "Other" },
];

interface ClientFormFieldsProps {
  value: ClientFormData;
  onChange: (updates: Partial<ClientFormData>) => void;
  autoFocus?: boolean;
}

export function ClientFormFields({ value, onChange, autoFocus }: ClientFormFieldsProps) {
  function set(key: keyof ClientFormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      onChange({ [key]: e.target.value });
  }

  return (
    <div className="space-y-4">
      {/* Name */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">First Name *</Label>
          <Input
            placeholder="Karim" value={value.firstName} onChange={set("firstName")}
            className="h-11 border-slate-200 focus:border-indigo-400"
            autoFocus={autoFocus} required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Last Name</Label>
          <Input placeholder="Ahmed" value={value.lastName} onChange={set("lastName")}
            className="h-11 border-slate-200 focus:border-indigo-400" />
        </div>
      </div>

      {/* Phone + Phone 2 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Phone</Label>
          <Input placeholder="017XXXXXXXX" value={value.phone} onChange={set("phone")}
            className="h-11 border-slate-200 focus:border-indigo-400" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Phone 2 <span className="text-slate-400 font-normal">(optional)</span></Label>
          <Input placeholder="017XXXXXXXX" value={value.phoneSecondary} onChange={set("phoneSecondary")}
            className="h-11 border-slate-200 focus:border-indigo-400" />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-slate-700">Email</Label>
        <Input type="email" placeholder="client@email.com" value={value.email} onChange={set("email")}
          className="h-11 border-slate-200 focus:border-indigo-400" />
        {value.email.trim() && (
          <p className="text-[11px] text-amber-600 flex items-center gap-1">
            ⚠️ Make sure this email is correct — we cannot verify if it exists.
          </p>
        )}
      </div>

      {/* Facebook Profile */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-slate-700">Facebook Profile <span className="text-slate-400 font-normal">(optional)</span></Label>
        <Input placeholder="facebook.com/username" value={value.facebookProfile} onChange={set("facebookProfile")}
          className="h-11 border-slate-200 focus:border-indigo-400" />
      </div>

      {/* City + Source */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">City</Label>
          <Input placeholder="Dhaka" value={value.city} onChange={set("city")}
            className="h-11 border-slate-200 focus:border-indigo-400" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Source</Label>
          <select value={value.source} onChange={set("source")}
            className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-indigo-400 cursor-pointer">
            <option value="">Select source...</option>
            {CLIENT_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {value.source === "referral" && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Referred By</Label>
          <ReferrerInput
            clientId={value.referredByClientId || undefined}
            name={value.referredByName}
            onChange={({ clientId, name }) => onChange({ referredByClientId: clientId ?? "", referredByName: name ?? "" })}
          />
        </div>
      )}

      {/* Address */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-slate-700">Address <span className="text-slate-400 font-normal">(optional)</span></Label>
        <Input placeholder="Full address or area" value={value.address} onChange={set("address")}
          className="h-11 border-slate-200 focus:border-indigo-400" />
      </div>

      {/* Occupation + Company */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Occupation</Label>
          <Input placeholder="e.g. Engineer" value={value.occupation} onChange={set("occupation")}
            className="h-11 border-slate-200 focus:border-indigo-400" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-slate-700">Company</Label>
          <Input placeholder="Company name" value={value.companyName} onChange={set("companyName")}
            className="h-11 border-slate-200 focus:border-indigo-400" />
        </div>
      </div>

      {/* VIP toggle */}
      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
        <div className={cn(
          "w-10 h-6 rounded-full transition-colors relative flex-shrink-0",
          value.vipStatus ? "bg-yellow-400" : "bg-slate-200"
        )}>
          <div
            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
            style={{ transform: value.vipStatus ? "translateX(18px)" : "translateX(2px)" }}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" /> VIP Client
          </p>
          <p className="text-xs text-slate-400">Mark as high-value client</p>
        </div>
        <input type="checkbox" checked={value.vipStatus}
          onChange={e => onChange({ vipStatus: e.target.checked })}
          className="sr-only" />
      </label>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-slate-700">Notes <span className="text-slate-400 font-normal">(optional)</span></Label>
        <textarea value={value.notes} onChange={set("notes")} rows={2}
          placeholder="Any notes about this client..."
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 resize-none" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-slate-700">Internal Notes <span className="text-slate-400 font-normal">(private)</span></Label>
        <textarea value={value.internalNotes} onChange={set("internalNotes")} rows={2}
          placeholder="Internal notes, visible only to your team..."
          className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 resize-none" />
      </div>
    </div>
  );
}
