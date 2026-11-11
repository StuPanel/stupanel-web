"use client";

import { CircleUserRound as HeaderIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/apple";

import { apiFetch } from "@/lib/api";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Save, Eye, EyeOff, CheckCircle,
  ShieldCheck, Mail, Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_SHADOW } from "@/components/ui/apple";
import { inputCls } from "@/components/ui/form-kit";
import { API_URL as API } from "@/lib/api";


interface Profile {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  role: string;
  isOwner: boolean;
  hasPassword: boolean;
}

/**
 * Your own name, phone and password. Owners find it in Settings → My Profile;
 * managers and staff (who can't open Settings) use /account.
 */
export function MyProfile({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Info form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [phone, setPhone]         = useState("");
  const [bio, setBio]             = useState("");
  const [saving, setSaving]       = useState(false);
  const [savedOk, setSavedOk]     = useState(false);
  const [saveErr, setSaveErr]     = useState("");

  // Password form
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [pwSaving, setPwSaving]       = useState(false);
  const [pwOk, setPwOk]               = useState(false);
  const [pwErr, setPwErr]             = useState("");

  useEffect(() => {
    apiFetch(`${API}/profile`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          if (!embedded && d.isOwner) { router.replace("/settings?pane=profile"); return; }
          setProfile(d);
          setFirstName(d.firstName ?? "");
          setLastName(d.lastName ?? "");
          setPhone(d.phone ?? "");
          setBio(d.bio ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaveErr(""); setSavedOk(false); setSaving(true);
    const res = await apiFetch(`${API}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        bio: bio.trim() || undefined,
      }),
    });
    const d = await res.json();
    if (!res.ok) { setSaveErr(d.message ?? "Failed to save"); }
    else {
      setSavedOk(true);
      setProfile(prev => prev ? { ...prev, ...d } : d);
      setTimeout(() => setSavedOk(false), 3000);
    }
    setSaving(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErr(""); setPwOk(false);
    if (newPw !== confirmPw) { setPwErr("New passwords do not match"); return; }
    if (newPw.length < 8) { setPwErr("Password must be at least 8 characters"); return; }
    setPwSaving(true);
    const body: Record<string, string> = { newPassword: newPw };
    if (profile?.hasPassword) body.currentPassword = currentPw;
    const res = await apiFetch(`${API}/profile/change-password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) { setPwErr(d.message ?? "Failed to change password"); }
    else {
      setPwOk(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setProfile(prev => prev ? { ...prev, hasPassword: true } : prev);
      setTimeout(() => setPwOk(false), 3000);
    }
    setPwSaving(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-7 h-7 animate-spin text-[#7D5CEF]" aria-label="Loading" />
    </div>
  );

  const initials = ((profile?.firstName?.[0] ?? "") + (profile?.lastName?.[0] ?? "")).toUpperCase() || "A";

  const lbl = "block text-[13px] font-semibold text-[#4A4658] mb-1.5";
  const card = cn("bg-white rounded-[20px]", CARD_SHADOW);
  const eye = (on: boolean, set: (f: (p: boolean) => boolean) => void, what: string) => (
    <button type="button" onClick={() => set(p => !p)} aria-label={on ? `Hide ${what}` : `Show ${what}`}
      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#EEEBF4]">
      {on ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
  const mismatch = !!confirmPw && newPw !== confirmPw;

  return (
    <div className="space-y-6">
      {!embedded && <PageHeader icon={HeaderIcon} color="deep" title="My Account" sub="Your profile and password" />}

      <section className={cn(card, "p-5 flex items-center gap-4")}>
        {profile?.avatarUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={profile.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover ring-2 ring-white flex-shrink-0" />
          : <span className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8E72F2] to-[#5B3FD0] text-white text-[22px] font-bold flex items-center justify-center ring-2 ring-white flex-shrink-0">{initials}</span>}
        <div className="min-w-0">
          <p className="text-[18px] font-extrabold tracking-[-0.01em] text-[#17151F] flex items-center gap-2 flex-wrap">
            {profile?.firstName} {profile?.lastName ?? ""}
            {profile?.isOwner && <span className="h-6 px-2.5 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-[12px] font-bold inline-flex items-center gap-1"><Crown className="w-3.5 h-3.5" />Owner</span>}
          </p>
          <p className="text-[13.5px] text-[#6B6680] flex items-center gap-1.5 mt-0.5 min-w-0"><Mail className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{profile?.email}</span></p>
          {!profile?.isOwner && <p className="text-[12.5px] text-[#6B6680] capitalize mt-0.5">{profile?.role}</p>}
        </div>
      </section>

      <section>
        <h2 className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">About you</h2>
        <form onSubmit={saveProfile} className={cn(card, "p-4 sm:p-5 space-y-4")}>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block"><span className={lbl}>First name <span className="text-[#C2304F]">*</span></span>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} required autoComplete="given-name" className={inputCls} /></label>
            <label className="block"><span className={lbl}>Last name</span>
              <input value={lastName} onChange={e => setLastName(e.target.value)} autoComplete="family-name" className={inputCls} /></label>
          </div>
          <label className="block"><span className={lbl}>Phone</span>
            <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" autoComplete="tel" placeholder="Phone number" className={inputCls} /></label>
          <label className="block"><span className={lbl}>About</span>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="A line about you (optional)"
              className={cn(inputCls, "h-auto py-3 resize-none leading-relaxed")} /></label>
          {saveErr && <p role="alert" className="text-[13px] font-semibold text-[#C2304F] bg-[#FDECEF] px-3.5 py-2.5 rounded-[12px]">{saveErr}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="h-11 px-6 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50 w-full sm:w-auto justify-center">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedOk ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {savedOk ? "Saved" : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">{profile?.hasPassword ? "Password" : "Set a password"}</h2>
        <form onSubmit={changePassword} className={cn(card, "p-4 sm:p-5 space-y-4")}>
          {!profile?.hasPassword && <p className="text-[13px] text-[#6B6680]">You signed up with Google. Set a password so you can also sign in with your email.</p>}
          {profile?.hasPassword && (
            <label className="block"><span className={lbl}>Current password</span>
              <span className="relative block">
                <input type={showCurrent ? "text" : "password"} value={currentPw} onChange={e => setCurrentPw(e.target.value)} required autoComplete="current-password" className={cn(inputCls, "pr-12")} />
                {eye(showCurrent, setShowCurrent, "current password")}
              </span></label>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block"><span className={lbl}>New password</span>
              <span className="relative block">
                <input type={showNew ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="At least 8 characters" required autoComplete="new-password" className={cn(inputCls, "pr-12")} />
                {eye(showNew, setShowNew, "new password")}
              </span></label>
            <label className="block"><span className={lbl}>Type it again</span>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required autoComplete="new-password" aria-invalid={mismatch}
                className={cn(inputCls, mismatch && "border-[#C2304F] focus:border-[#C2304F]")} />
              {mismatch && <span className="block text-[12.5px] text-[#C2304F] mt-1.5">The two passwords are different</span>}
            </label>
          </div>
          {pwErr && <p role="alert" className="text-[13px] font-semibold text-[#C2304F] bg-[#FDECEF] px-3.5 py-2.5 rounded-[12px]">{pwErr}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={pwSaving || mismatch} className="h-11 px-6 rounded-full bg-[#17151F] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50 w-full sm:w-auto justify-center">
              {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : pwOk ? <CheckCircle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
              {pwOk ? (profile?.hasPassword ? "Password changed" : "Password set") : (profile?.hasPassword ? "Change password" : "Set password")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
