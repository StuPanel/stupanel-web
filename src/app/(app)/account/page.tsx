"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect } from "react";
import {
  Loader2, Save, Lock, Eye, EyeOff, CheckCircle,
  Phone, FileText, ShieldCheck, Mail, Crown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

export default function MyAccountPage() {
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
      <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
    </div>
  );

  const initials = ((profile?.firstName?.[0] ?? "") + (profile?.lastName?.[0] ?? "")).toUpperCase() || "A";

  return (
    <div className="p-6 md:p-8 max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Account</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your personal profile and password</p>
      </div>

      {/* Identity card */}
      <div className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 p-5">
        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-xl text-white flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-slate-900 text-base">{profile?.firstName} {profile?.lastName ?? ""}</p>
            {profile?.isOwner && (
              <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                <Crown className="w-3 h-3" />Owner
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 flex items-center gap-1 mt-0.5 truncate">
            <Mail className="w-3.5 h-3.5 flex-shrink-0" />{profile?.email}
          </p>
          <p className="text-xs text-slate-400 capitalize mt-0.5">{profile?.role}</p>
        </div>
      </div>

      {/* Personal info */}
      <form onSubmit={saveProfile} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <p className="text-sm font-bold text-slate-800">Personal Info</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">First Name *</Label>
            <Input value={firstName} onChange={e => setFirstName(e.target.value)}
              placeholder="Md Faisal" required className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Last Name</Label>
            <Input value={lastName} onChange={e => setLastName(e.target.value)}
              placeholder="Ahmed" className="h-9 text-sm" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Phone</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX" className="h-9 text-sm pl-9" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Bio</Label>
          <div className="relative">
            <FileText className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <textarea value={bio} onChange={e => setBio(e.target.value)}
              placeholder="Studio owner, photographer..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
          </div>
        </div>

        {saveErr && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{saveErr}</p>
        )}

        <Button type="submit" disabled={saving} className="w-full h-9 text-sm gap-2">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
           savedOk ? <CheckCircle className="w-3.5 h-3.5" /> :
           <Save className="w-3.5 h-3.5" />}
          {savedOk ? "Saved!" : "Save Changes"}
        </Button>
      </form>

      {/* Change / set password */}
      <form onSubmit={changePassword} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div>
          <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-400" />{profile?.hasPassword ? "Change Password" : "Set Password"}
          </p>
          {!profile?.hasPassword && (
            <p className="text-xs text-slate-400 mt-1">
              You signed up with Google and don&apos;t have a password yet — set one so you can also log in with your email.
            </p>
          )}
        </div>

        {profile?.hasPassword && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Current Password *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input type={showCurrent ? "text" : "password"}
                value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                placeholder="Enter current password" required
                className="h-9 text-sm pl-9 pr-9" />
              <button type="button" onClick={() => setShowCurrent(p => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">New Password *</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input type={showNew ? "text" : "password"}
              value={newPw} onChange={e => setNewPw(e.target.value)}
              placeholder="Min. 8 characters" required
              className="h-9 text-sm pl-9 pr-9" />
            <button type="button" onClick={() => setShowNew(p => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-600">Confirm New Password *</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input type="password"
              value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
              placeholder="Re-enter new password" required
              className={cn("h-9 text-sm pl-9",
                confirmPw && newPw !== confirmPw ? "border-red-300 focus-visible:ring-red-400" : ""
              )} />
          </div>
          {confirmPw && newPw !== confirmPw && (
            <p className="text-xs text-red-500">Passwords don't match</p>
          )}
        </div>

        {pwErr && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{pwErr}</p>
        )}

        <Button type="submit"
          disabled={pwSaving || (!!confirmPw && newPw !== confirmPw)}
          variant="outline"
          className="w-full h-9 text-sm gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
          {pwSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
           pwOk ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> :
           <ShieldCheck className="w-3.5 h-3.5" />}
          {pwOk ? (profile?.hasPassword ? "Password Changed!" : "Password Set!") : (profile?.hasPassword ? "Change Password" : "Set Password")}
        </Button>
      </form>
    </div>
  );
}
