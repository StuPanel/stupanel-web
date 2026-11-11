"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1"}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Something went wrong.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-[#E7F5EE] flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8 text-[#1F8A5B]" />
        </div>
        <h2 className="text-2xl font-bold text-[#17151F]">Check your email</h2>
        <p className="text-[#6B6680] mt-2 text-sm leading-relaxed">
          We sent a password reset link to<br />
          <span className="font-semibold text-[#33303F]">{email}</span>
        </p>
        <p className="text-xs text-[#8A8599] mt-4">
          Didn&apos;t receive it? Check your spam folder or{" "}
          <button onClick={() => setSent(false)} className="text-[#7D5CEF] hover:underline font-medium">
            try again
          </button>
        </p>
        <Link href="/login"
          className="mt-8 flex items-center justify-center gap-2 text-sm text-[#6B6680] hover:text-[#33303F] transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#17151F]">Forgot password?</h2>
        <p className="text-[#6B6680] mt-1 text-sm">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-lg bg-[#FEF5F7] border border-[#F6CFD8] text-[#C2304F] text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-[#33303F] text-sm font-medium">Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8599]" />
            <Input id="email" type="email" placeholder="you@studio.com"
              value={email} onChange={e => setEmail(e.target.value)}
              className="pl-10 h-11 bg-white border-[#E4E0EC] focus:border-indigo-400" required />
          </div>
        </div>

        <Button type="submit" disabled={loading}
          className={cn("w-full h-11 bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white font-semibold text-sm", loading && "opacity-80")}>
          {loading
            ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Sending...</span>
            : "Send Reset Link"
          }
        </Button>
      </form>

      <Link href="/login"
        className="mt-6 flex items-center justify-center gap-2 text-sm text-[#6B6680] hover:text-[#33303F] transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Sign In
      </Link>
    </div>
  );
}
