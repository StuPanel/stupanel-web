"use client";

import { useState, useEffect, useRef } from "react";
import { Camera, Loader2, Eye, EyeOff, CheckCircle, ShieldCheck, Trash2, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/apple";
import { Field, FormGroup, inputCls } from "@/components/ui/form-kit";
import { IdentityCard } from "@/components/ui/profile-kit";
import { askConfirm, notify } from "@/components/feedback";
import { MemberPhoto, PROFILE_EVENT, Spinner } from "../_components/kit";
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

/** Centre-crop to a square and shrink, so any phone photo becomes a small JPG. */
async function squareJpeg(file: File, size = 512): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("That file isn't a picture we can read")); i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error("That file isn't a picture we can read");
    const out = Math.min(size, side);
    const c = document.createElement("canvas");
    c.width = out; c.height = out;
    c.getContext("2d")!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
    return await new Promise<Blob>((ok, bad) => c.toBlob(b => (b ? ok(b) : bad(new Error("Couldn't prepare the photo"))), "image/jpeg", 0.88));
  } finally { URL.revokeObjectURL(url); }
}

export default function MemberProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (photoRef.current) photoRef.current.value = "";
    if (!file || photoBusy) return;
    if (!file.type.startsWith("image/")) { notify("Please choose a photo", { error: true }); return; }
    setPhotoBusy(true);
    try {
      const form = new FormData();
      form.append("file", await squareJpeg(file), "photo.jpg");
      const r = await apiFetch(`${API}/member/profile/photo`, { method: "POST", body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || "Couldn't save the photo");
      setProfile(p => (p ? { ...p, avatarUrl: d.avatarUrl } : p));
      window.dispatchEvent(new Event(PROFILE_EVENT));
      notify("Photo saved");
    } catch (err) {
      notify(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Couldn't save the photo — check your internet", { error: true });
    } finally { setPhotoBusy(false); }
  }

  async function removePhoto() {
    if (photoBusy || !(await askConfirm({ title: "Remove your photo?", message: "Your name's first letter will be shown instead.", confirmLabel: "Remove photo", danger: true }))) return;
    setPhotoBusy(true);
    try {
      const r = await apiFetch(`${API}/member/profile/photo`, { method: "DELETE" });
      if (!r.ok) throw new Error();
      setProfile(p => (p ? { ...p, avatarUrl: undefined } : p));
      window.dispatchEvent(new Event(PROFILE_EVENT));
    } catch { notify("Couldn't remove the photo", { error: true }); }
    finally { setPhotoBusy(false); }
  }

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
    else { setSavedOk(true); setProfile(prev => prev ? { ...prev, ...d } : d); window.dispatchEvent(new Event(PROFILE_EVENT)); setTimeout(() => setSavedOk(false), 3000); }
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
    <div>
      <PageHeader icon={UserCircle} color="orchid" title="My profile" sub="Your details and password" />

      <IdentityCard
        avatar={
          <span className="relative flex-shrink-0">
            <MemberPhoto url={profile?.avatarUrl} name={profile?.firstName} size={72} round />
            <button type="button" onClick={() => photoRef.current?.click()} disabled={photoBusy} aria-label={profile?.avatarUrl ? "Change my photo" : "Add my photo"}
              className="absolute -right-1 -bottom-1 w-8 h-8 rounded-full bg-[#17151F] hover:bg-black text-white flex items-center justify-center ring-2 ring-white disabled:opacity-70">
              {photoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            </button>
            <input ref={photoRef} type="file" accept="image/*" hidden onChange={onPhoto} />
          </span>
        }
        name={`${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim() || "Me"}
        sub={profile?.username ? `@${profile.username}` : undefined}
        chips={profile?.memberRoles?.map(r => (
          <span key={r} className="text-xs bg-[#EEE8FD] text-[#5B3FD0] px-2.5 py-1 rounded-full font-semibold capitalize">{r.replace(/_/g, " ")}</span>
        ))}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 -mt-1 mb-6 text-[13px]">
        <button type="button" onClick={() => photoRef.current?.click()} disabled={photoBusy} className="font-semibold text-[#5B3FD0] hover:text-[#4630A8] inline-flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" />{profile?.avatarUrl ? "Change photo" : "Add my photo"}</button>
        {profile?.avatarUrl && <button type="button" onClick={removePhoto} disabled={photoBusy} className="font-semibold text-[#C2304F] hover:text-[#9C2340] inline-flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />Remove</button>}
        <span className="text-[#8A8599]">The studio and your team see this photo.</span>
      </div>

      <form onSubmit={saveProfile} className="mb-7">
        <FormGroup title="About me">
          <div className="grid grid-cols-2">
            <Field label="First name" required>{id => <input id={id} value={firstName} onChange={e => setFirstName(e.target.value)} required className={inputCls} />}</Field>
            <Field label="Last name">{id => <input id={id} value={lastName} onChange={e => setLastName(e.target.value)} className={inputCls} />}</Field>
          </div>
          <Field label="Phone / WhatsApp">{id => <input id={id} type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" className={inputCls} />}</Field>
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
