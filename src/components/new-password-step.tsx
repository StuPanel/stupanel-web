"use client";

/**
 * The studio chose this person's password → they choose their own before going in.
 * The session is already saved, so the change goes through the normal profile route.
 */
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { CreatePassword, MIN_PASSWORD } from "@/components/create-password";

export function NewPasswordStep({ currentPassword, onDone }: { currentPassword: string; onDone: () => void }) {
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pass.length < MIN_PASSWORD) { setError(`Your password needs at least ${MIN_PASSWORD} characters.`); return; }
    if (pass === currentPassword) { setError("Choose a password different from the one the studio gave you."); return; }
    setBusy(true); setError("");
    try {
      const r = await apiFetch(`${API}/profile/change-password`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword: pass }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't save. Please try again."); return; }
      onDone();
    } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="mb-6">
        <span className="w-12 h-12 rounded-[14px] bg-[#EEE8FD] flex items-center justify-center mb-4"><KeyRound className="w-6 h-6 text-[#5B3FD0]" /></span>
        <h2 className="text-2xl font-bold text-[#17151F]">Choose your own password</h2>
        <p className="text-[#6B6680] mt-1 text-sm">Your studio set the password you used. Choose one only you know — you&apos;ll use it from now on.</p>
      </div>
      {error && <div role="alert" className="mb-4 px-4 py-3 rounded-lg bg-[#FEF5F7] border border-[#F6CFD8] text-[#C2304F] text-sm">{error}</div>}
      <form onSubmit={save} noValidate>
        <CreatePassword value={pass} onChange={v => { setPass(v); if (error) setError(""); }} show={show} onShow={setShow} label="Your new password" />
        <button type="submit" disabled={busy || pass.length < MIN_PASSWORD}
          className="mt-6 w-full h-[52px] rounded-[14px] bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(125,92,239,.3)] disabled:opacity-50 disabled:shadow-none">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}Save and continue
        </button>
      </form>
    </div>
  );
}
