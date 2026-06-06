"use client";

import { useState, useEffect } from "react";
import {
  Loader2, Save, Lock, Eye, EyeOff, CheckCircle, User,
  Phone, FileText, ShieldCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1";
function getToken() { return localStorage.getItem("access_token") ?? ""; }
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
}

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
    fetch(`${API}/member/profile`, { headers: { Authorization: `Bearer ${getToken()}` } })
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
    const res = await fetch(`${API}/member/profile`, {
      method: "PATCH",
      headers: authHeaders(),
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
    const res = await fetch(`${API}/member/change-password`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const d = await res.json();
    if (!res.ok) { setPwErr(d.message ?? "Failed to change password"); }
    else { setPwOk(true); setCurrentPw(""); setNewPw(""); setConfirmPw(""); setTimeout(() => setPwOk(false), 3000); }
    setPwSaving(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
    </div>
  );

  return (
    <div className="p-5 md:p-7 max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">Update your personal info and password</p>
      </div>

      {/* Avatar + username badge */}
      <div className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 p-4">
        <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center font-bold text-2xl text-indigo-700 flex-shrink-0">
          {(profile?.firstName?.[0] ?? "M").toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-slate-900">{profile?.firstName} {profile?.lastName ?? ""}</p>
          <p className="text-sm text-slate-400 font-mono">@{profile?.username}</p>
          {profile?.memberRoles?.length ? (
            <div className="flex gap-1 mt-1 flex-wrap">
              {profile.memberRoles.map(r => (
                <span key={r} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium capitalize">{r}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Profile form */}
      <form onSubmit={saveProfile} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" />Personal Info
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-600">First Name *</Label>
            <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Md Faisal" required className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-600">Last Name</Label>
            <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Ahmed" className="h-9 text-sm" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-600">Phone</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="01XXXXXXXXX" className="h-9 text-sm pl-9" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-600">Bio / Note</Label>
          <div className="relative">
            <FileText className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <textarea value={bio} onChange={e => setBio(e.target.value)}
              placeholder="Photographer, specializing in weddings..."
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
          </div>
        </div>

        {saveErr && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveErr}</p>}

        <Button type="submit" disabled={saving} className="w-full h-9 text-sm gap-2">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
           savedOk ? <CheckCircle className="w-3.5 h-3.5" /> :
           <Save className="w-3.5 h-3.5" />}
          {savedOk ? "Saved!" : "Save Changes"}
        </Button>
      </form>

      {/* Password form */}
      <form onSubmit={changePassword} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-400" />Change Password
        </p>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-600">Current Password *</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              type={showCurrent ? "text" : "password"}
              value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              placeholder="Enter current password"
              required
              className="h-9 text-sm pl-9 pr-9"
            />
            <button type="button" onClick={() => setShowCurrent(p => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-600">New Password *</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              type={showNew ? "text" : "password"}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="Min. 6 characters"
              required
              className="h-9 text-sm pl-9 pr-9"
            />
            <button type="button" onClick={() => setShowNew(p => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-medium text-slate-600">Confirm New Password *</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Re-enter new password"
              required
              className={cn("h-9 text-sm pl-9", confirmPw && newPw !== confirmPw ? "border-red-300 focus-visible:ring-red-400" : "")}
            />
          </div>
          {confirmPw && newPw !== confirmPw && (
            <p className="text-xs text-red-500">Passwords don't match</p>
          )}
        </div>

        {pwErr && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{pwErr}</p>}

        <Button type="submit" disabled={pwSaving || (!!confirmPw && newPw !== confirmPw)}
          variant="outline" className="w-full h-9 text-sm gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
          {pwSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
           pwOk ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> :
           <ShieldCheck className="w-3.5 h-3.5" />}
          {pwOk ? "Password Changed!" : "Change Password"}
        </Button>
      </form>
    </div>
  );
}
