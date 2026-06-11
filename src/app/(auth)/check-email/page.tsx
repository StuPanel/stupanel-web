"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_URL as API } from "@/lib/api";


function CheckEmailContent() {
  const params = useSearchParams();
  const email = params.get("email") || "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setResending(true); setError(""); setResent(false);
    try {
      const res = await fetch(`${API}/auth/resend-verification-public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) { setResent(true); setCooldown(60); }
      else setError("Failed to resend. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="text-center space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto">
        <Mail className="w-8 h-8 text-indigo-600" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-slate-900">Check your email</h2>
        <p className="text-slate-500 mt-2 text-sm leading-relaxed">
          We sent a verification link to<br />
          <span className="font-semibold text-slate-800">{email}</span>
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left">
        <p className="text-sm text-amber-800 font-medium">Before you can login:</p>
        <p className="text-xs text-amber-700 mt-1">Please verify your email address by clicking the link we sent you. Check your spam folder if you don&apos;t see it.</p>
      </div>

      {resent && (
        <div className="flex items-center gap-2 justify-center text-emerald-600 text-sm font-medium">
          <CheckCircle className="w-4 h-4" /> New verification email sent!
        </div>
      )}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button
        onClick={handleResend}
        disabled={resending || cooldown > 0}
        variant="outline"
        className="w-full h-11 border-slate-200 text-slate-700 hover:bg-slate-50"
      >
        {resending ? (
          <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Sending...</span>
        ) : cooldown > 0 ? (
          `Resend in ${cooldown}s`
        ) : (
          "Resend verification email"
        )}
      </Button>

      <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
        <ArrowLeft className="w-4 h-4" /> Back to login
      </Link>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense>
      <CheckEmailContent />
    </Suspense>
  );
}
