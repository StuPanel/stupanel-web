"use client";

import { useState, useEffect } from "react";
import { Loader2, Eye, EyeOff, CheckCircle, ShieldCheck, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/apple";
import { Field, FormGroup, inputCls } from "@/components/ui/form-kit";
import { Avatar, IdentityCard } from "@/components/ui/profile-kit";
import { Spinner } from "../_components/kit";
import { apiFetch, API_URL as API } from "@/lib/api";

interface Profile {
  id: string;
  username: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  memberRoles?: string[];
  avatarUrl?: string;
}

export default function MemberProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile form
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
    apiFetch(`${API}/member/profile`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setProfile(d);
          setFirstName(d.firstName ?? "");
          setLastName(d.lastName ?? "");
          setPhone(d.phone ?? "");
          setBio(d.bio ?? "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaveErr(""); setSavedOk(false); setSaving(true);
    const res = await apiFetch(`${API}/member/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() || undefined, phone: phone.trim() || undefined, bio: bio.trim() || undefined }),
    });
    const d = await res.json();
    if (!res.ok) { setSaveErr(d.message ?? "Failed to save"); }
    else { setSavedOk(true); setProfile(prev => prev ? { ...prev, ...d } : d); setTimeout(() => setSavedOk(false), 3000); }
    setSaving(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErr(""); setPwOk(false);
    if (newPw !== confirmPw) { setPwErr("New passwords do not match"); return; }
    if (newPw.length < 6) { setPwErr("New password must be at least 6 characters"); return; }
    setPwSaving(true);
    const res = await apiFetch(`${API}/member/change-password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const d = await res.json();
    if (!res.ok) { setPwErr(d.message ?? "Failed to change password"); }
    else { setPwOk(true); setCurrentPw(""); setNewPw(""); setConfirmPw(""); setTimeout(() => setPwOk(false), 3000); }
    setPwSaving(false);
  }

  if (loading) return <Spinner />;

  const pwMismatch = !!confirmPw && newPw !== confirmPw;
  const btn = "w-full h-12 rounded-full text-[15px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 transition-colors";

  return (
    <div className="max-w-2xl">
      <PageHeader icon={UserCircle} color="orchid" title="My profile" sub="Your details and password" />

      <IdentityCard
        avatar={<Avatar name={`${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`} size={64} />}
        name={`${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim() || "Me"}
        sub={profile?.username ? `@${profile.username}` : undefined}
        chips={profile?.memberRoles?.map(r => (
          <span key={r} className="text-xs bg-[#EEE8FD] text-[#5B3FD0] px-2.5 py-1 rounded-full font-semibold capitalize">{r.replace(/_/g, " ")}</span>
        ))}
      />

      <form onSubmit={saveProfile} className="mb-7">
        <FormGroup title="About me">
          <div className="grid grid-cols-2">
            <Field label="First name" required>{id => <input id={id} value={firstName} onChange={e => setFirstName(e.target.value)} required className={inputCls} />}</Field>
            <Field label="Last name">{id => <input id={id} value={lastName} onChange={e => setLastName(e.target.value)} className={inputCls} />}</Field>
          </div>
          <Field label="Phone / WhatsApp">{id => <input id={id} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="01XXXXXXXXX" className={inputCls} />}</Field>
          <Field label="About you" hint="A line about your work — the studio sees this.">{id => <textarea id={id} rows={2} value={bio} onChange={e => setBio(e.target.value)} placeholder="Wedding photographer, Sony A7 IV" className={cn(inputCls, "h-auto py-2.5 resize-none")} />}</Field>
        </FormGroup>
        {saveErr && <p role="alert" className="mb-3 px-4 py-3 rounded-[14px] bg-[#FDECEF] text-[#8A2340] text-sm font-medium">{saveErr}</p>}
        <button type="submit" disabled={saving} className={cn(btn, "bg-[#7D5CEF] hover:bg-[#6C4BE0] text-white")}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : savedOk ? <CheckCircle className="w-4 h-4" /> : null}
          {savedOk ? "Saved" : "Save"}
        </button>
      </form>

      <form onSubmit={changePassword}>
        <FormGroup title="Password" note="Signed in with Google only? You can skip this.">
          <Field label="Current password" required>{id => (
            <div className="relative">
              <input id={id} type={showCurrent ? "text" : "password"} value={currentPw} onChange={e => setCurrentPw(e.target.value)} required autoComplete="current-password" className={cn(inputCls, "pr-11")} />
              <button type="button" onClick={() => setShowCurrent(p => !p)} aria-label={showCurrent ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6680]">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}</Field>
          <Field label="New password" required hint="At least 6 characters.">{id => (
            <div className="relative">
              <input id={id} type={showNew ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)} required autoComplete="new-password" className={cn(inputCls, "pr-11")} />
              <button type="button" onClick={() => setShowNew(p => !p)} aria-label={showNew ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6680]">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}</Field>
          <Field label="New password again" required>{id => (
            <>
              <input id={id} type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required autoComplete="new-password"
                className={cn(inputCls, pwMismatch && "ring-2 ring-[#C2304F]/40")} />
              {pwMismatch && <p className="mt-1.5 text-xs text-[#C2304F]">Passwords don&apos;t match.</p>}
            </>
          )}</Field>
        </FormGroup>
        {pwErr && <p role="alert" className="mb-3 px-4 py-3 rounded-[14px] bg-[#FDECEF] text-[#8A2340] text-sm font-medium">{pwErr}</p>}
        <button type="submit" disabled={pwSaving || pwMismatch} className={cn(btn, "bg-white text-[#5B3FD0] shadow-[0_1px_2px_rgba(22,18,40,.06)] hover:bg-[#F7F5FB]")}>
          {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : pwOk ? <CheckCircle className="w-4 h-4 text-[#1F8A5B]" /> : <ShieldCheck className="w-4 h-4" />}
          {pwOk ? "Password changed" : "Change password"}
        </button>
      </form>
    </div>
  );
}
