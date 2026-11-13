"use client";

/**
 * The studio chose this person's password → they choose their own before going in.
 * The session is already saved, so the change goes through the normal profile route.
 */
import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { inputCls } from "@/components/ui/form-kit";
import { cn } from "@/lib/utils";

export function NewPasswordStep({ currentPassword, onDone }: { currentPassword: string; onDone: () => void }) {
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pass.length < 8) { setError("Use at least 8 characters."); return; }
    if (!again) { setError("Type the same password again in the second box."); return; }
    if (pass !== again) { setError("The two passwords are not the same."); return; }
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
      <form onSubmit={save} className="space-y-4" noValidate>
        <label className="block">
          <span className="block text-sm font-medium text-[#33303F] mb-1.5">New password</span>
          <span className="relative block">
            <input type={show ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} autoFocus autoComplete="new-password"
              placeholder="At least 8 characters" className={cn(inputCls, "pr-10")} />
            <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6680]">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
          </span>
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-[#33303F] mb-1.5">Type it again</span>
          <input type={show ? "text" : "password"} value={again} onChange={e => setAgain(e.target.value)} autoComplete="new-password" placeholder="The same password again" className={inputCls} />
        </label>
        <button type="submit" disabled={busy}
          className="w-full h-11 rounded-lg bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-70">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}Save and continue
        </button>
      </form>
    </div>
  );
}
