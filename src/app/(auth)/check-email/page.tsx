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
      <div className="w-16 h-16 rounded-2xl bg-[#EEE8FD] flex items-center justify-center mx-auto">
        <Mail className="w-8 h-8 text-[#7D5CEF]" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-[#17151F]">Check your email</h2>
        <p className="text-[#6B6680] mt-2 text-sm leading-relaxed">
          We sent a verification link to<br />
          <span className="font-semibold text-[#17151F]">{email}</span>
        </p>
      </div>

      <div className="bg-[#FFF9EF] border border-[#F6E3B8] rounded-xl px-4 py-3 text-left">
        <p className="text-sm text-[#8A5600] font-medium">Before you can login:</p>
        <p className="text-xs text-[#9A5B00] mt-1">Please verify your email address by clicking the link we sent you. Check your spam folder if you don&apos;t see it.</p>
      </div>

      {resent && (
        <div className="flex items-center gap-2 justify-center text-[#1F8A5B] text-sm font-medium">
          <CheckCircle className="w-4 h-4" /> New verification email sent!
        </div>
      )}
      {error && <p className="text-[#C2304F] text-sm">{error}</p>}

      <Button
        onClick={handleResend}
        disabled={resending || cooldown > 0}
        variant="outline"
        className="w-full h-11 border-[#E4E0EC] text-[#33303F] hover:bg-[#F7F5FB]"
      >
        {resending ? (
          <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Sending...</span>
        ) : cooldown > 0 ? (
          `Resend in ${cooldown}s`
        ) : (
          "Resend verification email"
        )}
      </Button>

      <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-[#7D5CEF] hover:text-[#5B3FD0] font-medium">
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
