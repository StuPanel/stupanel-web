"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect } from "react";
import {
  Building2, FileText, Loader2, CheckCircle2, Camera,
  Link2, Globe, Phone, MapPin, Palette, Percent, CalendarDays,
  CreditCard, Smartphone, ExternalLink, Video,
  Shield, Clock, Bell, AlertCircle, Landmark, Hash, User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";

type Tab = "studio" | "branding" | "payment" | "quotation" | "tax" | "social" | "security";

const DEFAULT_TERMS = `1. 50% advance payment required to confirm booking.
2. Remaining balance due on the event day.
3. Edited photos delivered within 30 working days.
4. Videos delivered within 45 working days.
5. Cancellation with less than 7 days notice will forfeit the advance.
6. Studio is not responsible for circumstances beyond our control.
7. This quotation is valid until the date mentioned above.`;

const CURRENCIES = [
  { code: "BDT", label: "৳ BDT — Bangladeshi Taka" },
  { code: "USD", label: "$ USD — US Dollar" },
  { code: "INR", label: "₹ INR — Indian Rupee" },
  { code: "GBP", label: "£ GBP — British Pound" },
  { code: "EUR", label: "€ EUR — Euro" },
  { code: "AED", label: "AED — UAE Dirham" },
];

const TIMEZONES = [
  { value: "Asia/Dhaka",       label: "Asia/Dhaka (BDT +6:00)" },
  { value: "Asia/Kolkata",     label: "Asia/Kolkata (IST +5:30)" },
  { value: "Asia/Karachi",     label: "Asia/Karachi (PKT +5:00)" },
  { value: "Asia/Dubai",       label: "Asia/Dubai (GST +4:00)" },
  { value: "Asia/Singapore",   label: "Asia/Singapore (SGT +8:00)" },
  { value: "Europe/London",    label: "Europe/London (GMT +0:00)" },
  { value: "America/New_York", label: "America/New_York (EST -5:00)" },
];

const SESSION_OPTS = [
  { value: 30,    label: "30 minutes" },
  { value: 60,    label: "1 hour" },
  { value: 120,   label: "2 hours" },
  { value: 240,   label: "4 hours" },
  { value: 480,   label: "8 hours (recommended)" },
  { value: 1440,  label: "1 day" },
  { value: 10080, label: "1 week (never timeout)" },
];

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }: { msg: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className={cn(
      "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2",
      type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white",
    )}>
      {type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {msg}
    </div>
  );
}

// ─── Section Header ─────────────────────────────────────────────────────────────
function SectionHead({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-5">
      <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-indigo-600" />
      </div>
      <div>
        <p className="font-bold text-slate-800 text-sm">{title}</p>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
    </div>
  );
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ─── Shared save hook ──────────────────────────────────────────────────────────
function useSave() {
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  async function save(payload: object, successMsg = "Saved!") {
    setSaving(true);
    try {
      const r = await apiFetch(`${API}/companies/me`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error();
      setToast({ msg: successMsg, type: "success" });
    } catch { setToast({ msg: "Failed to save. Try again.", type: "error" }); }
    finally { setSaving(false); }
  }

  return { saving, toast, setToast, save };
}

// ─── Studio Tab ────────────────────────────────────────────────────────────────
function StudioTab({ data }: { data: any }) {
  const [f, setF] = useState({
    name: data.name ?? "", phone: data.phone ?? "",
    website: data.website ?? "", address: data.address ?? "",
    city: data.city ?? "", state: data.state ?? "", country: data.country ?? "Bangladesh",
    currency: data.currency ?? "BDT", timezone: data.timezone ?? "Asia/Dhaka",
  });
  const { saving, toast, setToast, save } = useSave();
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF(p => ({ ...p, [k]: e.target.value }));

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <SectionHead icon={Building2} title="Studio Information" sub="Your studio's public profile and contact details" />
      <form onSubmit={e => { e.preventDefault(); save(f, "Studio info saved!"); }} className="space-y-4 max-w-lg">
        <Field label="Studio Name *">
          <Input value={f.name} onChange={set("name")} placeholder="Faisal Photography" className="h-11 border-slate-200" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={f.phone} onChange={set("phone")} placeholder="+880 1XXXXXXXXX" className="h-11 pl-9 border-slate-200" />
            </div>
          </Field>
          <Field label="Website">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={f.website} onChange={set("website")} placeholder="https://yourstudio.com" className="h-11 pl-9 border-slate-200" />
            </div>
          </Field>
        </div>
        <Field label="Address">
          <div className="relative">
            <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <textarea value={f.address} onChange={set("address")} rows={2} placeholder="Studio address…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 resize-none" />
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          {([ ["city","City","Dhaka"], ["state","State","(optional)"], ["country","Country","Bangladesh"] ] as [string,string,string][]).map(([k,l,p]) => (
            <Field key={k} label={l}>
              <Input value={(f as any)[k]} onChange={set(k)} placeholder={p} className="h-10 border-slate-200 text-sm" />
            </Field>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency">
            <select value={f.currency} onChange={set("currency")}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400">
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Timezone">
            <select value={f.timezone} onChange={set("timezone")}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400">
              {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </div>
        <Button type="submit" disabled={saving} className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 px-6">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><CheckCircle2 className="w-4 h-4" />Save Studio Info</>}
        </Button>
      </form>
    </>
  );
}

// ─── Branding Tab ──────────────────────────────────────────────────────────────
function BrandingTab({ data }: { data: any }) {
  const [logoUrl, setLogoUrl] = useState(data.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(data.primaryColor ?? "#4F46E5");
  const [logoErr, setLogoErr] = useState(false);
  const { saving, toast, setToast, save } = useSave();

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <SectionHead icon={Palette} title="Branding" sub="Logo and colors shown on quotes, invoices and client pages" />
      <div className="space-y-6 max-w-lg">

        {/* Logo */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Studio Logo</Label>
          <div className="flex items-start gap-4">
            <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 flex-shrink-0 overflow-hidden">
              {logoUrl && !logoErr
                ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" onError={() => setLogoErr(true)} />
                : <Camera className="w-9 h-9 text-slate-300" />}
            </div>
            <div className="flex-1 space-y-2">
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={logoUrl} onChange={e => { setLogoUrl(e.target.value); setLogoErr(false); }}
                  placeholder="https://… paste image URL" className="h-10 pl-9 border-slate-200 text-sm" />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">Paste a direct image URL (PNG/JPG/SVG). Recommended: 200×200px, transparent background.</p>
            </div>
          </div>
        </div>

        {/* Primary Color */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Brand Color</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
              className="w-12 h-12 rounded-xl border border-slate-200 cursor-pointer p-1 bg-white" />
            <div className="flex-1">
              <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                placeholder="#4F46E5" maxLength={7} className="h-11 border-slate-200 font-mono" />
            </div>
            <div className="w-11 h-11 rounded-xl border border-slate-200 flex-shrink-0" style={{ backgroundColor: primaryColor }} />
          </div>
          <p className="text-[11px] text-slate-400">Used as accent color on quotes and client-facing pages.</p>
        </div>

        {/* Live Preview */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Live Preview</p>
          <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center bg-slate-50">
              {logoUrl && !logoErr
                ? <img src={logoUrl} alt="" className="w-full h-full object-contain p-1" />
                : <Camera className="w-5 h-5 text-slate-300" />}
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: primaryColor }}>{data.name || "Studio Name"}</p>
              <p className="text-xs text-slate-400">{data.city || "City"} · {data.country || "Country"}</p>
            </div>
            <div className="ml-auto px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ backgroundColor: primaryColor }}>
              View Quote
            </div>
          </div>
        </div>

        <Button disabled={saving} onClick={() => save({ logoUrl: logoUrl || undefined, primaryColor }, "Branding saved!")}
          className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 px-6">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><CheckCircle2 className="w-4 h-4" />Save Branding</>}
        </Button>
      </div>
    </>
  );
}

// ─── Payment Info Tab ──────────────────────────────────────────────────────────
function PaymentTab({ data }: { data: any }) {
  const [f, setF] = useState({
    bankName: data.bankName ?? "", bankBranch: data.bankBranch ?? "",
    bankAccountName: data.bankAccountName ?? "", bankAccountNumber: data.bankAccountNumber ?? "",
    bankRoutingNumber: data.bankRoutingNumber ?? "",
    bkashNumber: data.bkashNumber ?? "", nagadNumber: data.nagadNumber ?? "", rocketNumber: data.rocketNumber ?? "",
  });
  const { saving, toast, setToast, save } = useSave();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <SectionHead icon={CreditCard} title="Payment Information" sub="Bank and mobile banking details shown on quotes and invoices" />
      <div className="space-y-5 max-w-lg">

        {/* Bank */}
        <div className="space-y-3 p-4 rounded-2xl border border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 mb-1">
            <Landmark className="w-4 h-4 text-indigo-500" />
            <p className="text-sm font-semibold text-slate-700">Bank Transfer</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank Name">
              <Input value={f.bankName} onChange={set("bankName")} placeholder="Dutch Bangla Bank" className="h-10 border-slate-200 text-sm bg-white" />
            </Field>
            <Field label="Branch">
              <Input value={f.bankBranch} onChange={set("bankBranch")} placeholder="Gulshan Branch" className="h-10 border-slate-200 text-sm bg-white" />
            </Field>
          </div>
          <Field label="Account Holder Name">
            <Input value={f.bankAccountName} onChange={set("bankAccountName")} placeholder="Faisal Ahmed Photography" className="h-10 border-slate-200 text-sm bg-white" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Account Number">
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={f.bankAccountNumber} onChange={set("bankAccountNumber")} placeholder="1234567890" className="h-10 pl-9 border-slate-200 text-sm bg-white" />
              </div>
            </Field>
            <Field label="Routing Number">
              <Input value={f.bankRoutingNumber} onChange={set("bankRoutingNumber")} placeholder="090261688" className="h-10 border-slate-200 text-sm bg-white" />
            </Field>
          </div>
        </div>

        {/* Mobile Banking */}
        <div className="space-y-3 p-4 rounded-2xl border border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 mb-1">
            <Smartphone className="w-4 h-4 text-indigo-500" />
            <p className="text-sm font-semibold text-slate-700">Mobile Banking</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {([
              ["bkashNumber",  "bKash",  "01XXXXXXXXX", "text-pink-600"   ],
              ["nagadNumber",  "Nagad",  "01XXXXXXXXX", "text-orange-600" ],
              ["rocketNumber", "Rocket", "01XXXXXXXXX", "text-purple-600" ],
            ] as [string,string,string,string][]).map(([key, label, placeholder, color]) => (
              <Field key={key} label={label}>
                <div className="relative">
                  <Smartphone className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", color)} />
                  <Input value={(f as any)[key]} onChange={set(key)} placeholder={placeholder}
                    className="h-10 pl-9 border-slate-200 text-sm bg-white" />
                </div>
              </Field>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl">
          <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-700 leading-relaxed">These details appear at the bottom of every quote and invoice so clients know how to pay you.</p>
        </div>

        <Button disabled={saving} onClick={() => save(f, "Payment info saved!")}
          className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 px-6">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><CheckCircle2 className="w-4 h-4" />Save Payment Info</>}
        </Button>
      </div>
    </>
  );
}

// ─── Quotation Tab ─────────────────────────────────────────────────────────────
function QuotationTab({ data }: { data: any }) {
  const [defaultTerms, setDefaultTerms] = useState(data.defaultTerms ?? DEFAULT_TERMS);
  const [defaultValidityDays, setDefaultValidityDays] = useState(Number(data.defaultValidityDays ?? 7));
  const [defaultAdvancePercent, setDefaultAdvancePercent] = useState(Number(data.defaultAdvancePercent ?? 50));
  const { saving, toast, setToast, save } = useSave();

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <SectionHead icon={FileText} title="Quotation Defaults" sub="Auto-filled when creating a new quotation — override per quote anytime" />
      <div className="space-y-5 max-w-lg">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Validity Days" hint={`Quote expires ${defaultValidityDays} days after creation`}>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="number" min="1" max="365" value={defaultValidityDays}
                onChange={e => setDefaultValidityDays(Number(e.target.value) || 7)}
                className="w-full h-11 pl-9 pr-14 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">days</span>
            </div>
          </Field>
          <Field label="Default Advance %" hint={`Client pays ${defaultAdvancePercent}% upfront to confirm`}>
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="number" min="0" max="100" step="5" value={defaultAdvancePercent}
                onChange={e => setDefaultAdvancePercent(Number(e.target.value) || 50)}
                className="w-full h-11 pl-9 pr-8 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
            </div>
          </Field>
        </div>
        <Field label="Default Terms & Conditions">
          <textarea value={defaultTerms} onChange={e => setDefaultTerms(e.target.value)} rows={10}
            placeholder="Enter your standard terms…"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 resize-y font-mono text-xs leading-relaxed" />
        </Field>
        <Button disabled={saving} onClick={() => save({ defaultTerms, defaultValidityDays, defaultAdvancePercent }, "Quotation defaults saved!")}
          className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 px-6">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><CheckCircle2 className="w-4 h-4" />Save Defaults</>}
        </Button>
      </div>
    </>
  );
}

// ─── Tax Tab ───────────────────────────────────────────────────────────────────
function TaxTab({ data }: { data: any }) {
  const [taxLabel, setTaxLabel] = useState(data.taxLabel ?? "VAT");
  const [defaultTaxPercent, setDefaultTaxPercent] = useState(Number(data.defaultTaxPercent ?? 0));
  const { saving, toast, setToast, save } = useSave();

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <SectionHead icon={Percent} title="Tax Settings" sub="Default tax applied on quotations and invoices" />
      <div className="space-y-5 max-w-lg">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tax Label" hint="Shown on quote (e.g. VAT, GST, Tax)">
            <Input value={taxLabel} onChange={e => setTaxLabel(e.target.value)} placeholder="VAT"
              maxLength={20} className="h-11 border-slate-200" />
          </Field>
          <Field label="Default Tax %" hint={defaultTaxPercent === 0 ? "No tax applied" : `${defaultTaxPercent}% added to subtotal`}>
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="number" min="0" max="30" step="0.5" value={defaultTaxPercent}
                onChange={e => setDefaultTaxPercent(Number(e.target.value))}
                className="w-full h-11 pl-9 pr-8 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-400 bg-white" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
            </div>
          </Field>
        </div>
        {/* Preview */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Quote preview</p>
          <div className="flex justify-between text-sm text-slate-500"><span>Subtotal</span><span>৳ 50,000</span></div>
          {defaultTaxPercent > 0 && (
            <div className="flex justify-between text-sm text-slate-600">
              <span>{taxLabel || "Tax"} ({defaultTaxPercent}%)</span>
              <span>+ ৳ {(50000 * defaultTaxPercent / 100).toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 text-sm">
            <span>Grand Total</span>
            <span>৳ {(50000 + 50000 * defaultTaxPercent / 100).toLocaleString()}</span>
          </div>
        </div>
        <Button disabled={saving} onClick={() => save({ taxLabel, defaultTaxPercent }, "Tax settings saved!")}
          className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 px-6">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><CheckCircle2 className="w-4 h-4" />Save Tax Settings</>}
        </Button>
      </div>
    </>
  );
}

// ─── Social Media Tab ──────────────────────────────────────────────────────────
function SocialTab({ data }: { data: any }) {
  const [f, setF] = useState({
    facebookUrl: data.facebookUrl ?? "", instagramUrl: data.instagramUrl ?? "",
    youtubeUrl: data.youtubeUrl ?? "", tiktokUrl: data.tiktokUrl ?? "",
  });
  const { saving, toast, setToast, save } = useSave();
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  const fields: { key: string; label: string; placeholder: string; color: string }[] = [
    { key: "facebookUrl",  label: "Facebook",  placeholder: "https://facebook.com/yourstudio",  color: "text-blue-600"  },
    { key: "instagramUrl", label: "Instagram", placeholder: "https://instagram.com/yourstudio", color: "text-pink-600"  },
    { key: "youtubeUrl",   label: "YouTube",   placeholder: "https://youtube.com/@yourstudio",  color: "text-red-600"   },
    { key: "tiktokUrl",    label: "TikTok",    placeholder: "https://tiktok.com/@yourstudio",   color: "text-slate-700" },
  ];

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <SectionHead icon={Globe} title="Social Media" sub="Links shown on client-facing pages and quote footers" />
      <div className="space-y-4 max-w-lg">
        {fields.map(({ key, label, placeholder, color }) => (
          <Field key={key} label={label}>
            <div className="relative">
              <ExternalLink className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", color)} />
              <Input value={(f as any)[key]} onChange={set(key)} placeholder={placeholder}
                className="h-11 pl-9 border-slate-200" />
            </div>
          </Field>
        ))}
        <Button disabled={saving} onClick={() => save(f, "Social links saved!")}
          className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 px-6 mt-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><CheckCircle2 className="w-4 h-4" />Save Social Links</>}
        </Button>
      </div>
    </>
  );
}

// ─── Security Tab ──────────────────────────────────────────────────────────────
function SecurityTab({ data }: { data: any }) {
  const [resetEmail, setResetEmail] = useState(data.resetEmail ?? data.email ?? "");
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(Number(data.sessionTimeoutMinutes ?? 480));
  const { saving, toast, setToast, save } = useSave();

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <SectionHead icon={Shield} title="Security" sub="Account security and session management for your studio" />
      <div className="space-y-5 max-w-lg">

        {/* Password Reset Email */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-500" />
            <p className="text-sm font-semibold text-slate-700">Password Reset Email</p>
          </div>
          <Field label="Receive reset links at" hint="When any team member resets password, notification goes here">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                placeholder="admin@yourstudio.com" className="h-11 pl-9 border-slate-200 bg-white" />
            </div>
          </Field>
        </div>

        {/* Session Timeout */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            <p className="text-sm font-semibold text-slate-700">Session Timeout</p>
          </div>
          <Field label="Auto-logout after inactivity" hint="Applies to all team members">
            <select value={sessionTimeoutMinutes} onChange={e => setSessionTimeoutMinutes(Number(e.target.value))}
              className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-indigo-400">
              {SESSION_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>

        {/* Coming Soon — Login Activity */}
        <div className="p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 opacity-60">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-500">Login Activity Log</p>
            <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-medium">Coming Soon</span>
          </div>
          <p className="text-xs text-slate-400">Track who logged in, from which device and IP — available in next update.</p>
        </div>

        {/* Coming Soon — 2FA */}
        <div className="p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 opacity-60">
          <div className="flex items-center gap-2 mb-1">
            <Smartphone className="w-4 h-4 text-slate-400" />
            <p className="text-sm font-semibold text-slate-500">Two-Factor Authentication (2FA)</p>
            <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-medium">Coming Soon</span>
          </div>
          <p className="text-xs text-slate-400">Require OTP on login for all team members. Stronger account protection.</p>
        </div>

        <Button disabled={saving} onClick={() => save({ resetEmail, sessionTimeoutMinutes }, "Security settings saved!")}
          className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 px-6">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><CheckCircle2 className="w-4 h-4" />Save Security Settings</>}
        </Button>
      </div>
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("studio");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`${API}/companies/me`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "studio",    label: "Studio",    icon: Building2  },
    { id: "branding",  label: "Branding",  icon: Palette    },
    { id: "payment",   label: "Payment",   icon: CreditCard },
    { id: "quotation", label: "Quotation", icon: FileText   },
    { id: "tax",       label: "Tax",       icon: Percent    },
    { id: "social",    label: "Social",    icon: Globe      },
    { id: "security",  label: "Security",  icon: Shield     },
  ];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Studio Settings</h1>
        <p className="text-xs text-slate-400 mt-0.5">Configure your studio profile, payment info, quotation defaults and security</p>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all",
                active
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50",
              )}>
              <Icon className={cn("w-3.5 h-3.5", active ? "text-white" : "text-slate-400")} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        {tab === "studio"    && <StudioTab    data={data} />}
        {tab === "branding"  && <BrandingTab  data={data} />}
        {tab === "payment"   && <PaymentTab   data={data} />}
        {tab === "quotation" && <QuotationTab data={data} />}
        {tab === "tax"       && <TaxTab       data={data} />}
        {tab === "social"    && <SocialTab    data={data} />}
        {tab === "security"  && <SecurityTab  data={data} />}
      </div>
    </div>
  );
}
