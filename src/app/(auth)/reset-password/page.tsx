"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!token) { setError("Invalid or missing reset token."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/v1"}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to reset password."); return; }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-[#E7F5EE] flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8 text-[#1F8A5B]" />
        </div>
        <h2 className="text-2xl font-bold text-[#17151F]">Password reset!</h2>
        <p className="text-[#6B6680] mt-2 text-sm">Your password has been updated successfully.</p>
        <Link href="/login">
          <Button className="mt-8 w-full h-11 bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white font-semibold text-sm">
            Sign In Now
          </Button>
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#17151F]">Invalid link</h2>
        <p className="text-[#6B6680] mt-2 text-sm">This reset link is invalid or has expired.</p>
        <Link href="/forgot-password"
          className="mt-6 flex items-center justify-center gap-2 text-sm text-[#7D5CEF] hover:text-[#5B3FD0]">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#17151F]">Set new password</h2>
        <p className="text-[#6B6680] mt-1 text-sm">Choose a strong password for your account.</p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-lg bg-[#FEF5F7] border border-[#F6CFD8] text-[#C2304F] text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-[#33303F] text-sm font-medium">New Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8599]" />
            <Input id="password" type={showPassword ? "text" : "password"}
              placeholder="Min. 8 characters"
              value={password} onChange={e => setPassword(e.target.value)}
              className="pl-10 pr-10 h-11 bg-white border-[#E4E0EC] focus:border-indigo-400"
              minLength={8} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8599] hover:text-[#4A4658]">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="text-[#33303F] text-sm font-medium">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8599]" />
            <Input id="confirm" type={showPassword ? "text" : "password"}
              placeholder="Repeat your password"
              value={confirm} onChange={e => setConfirm(e.target.value)}
              className={cn("pl-10 h-11 bg-white border-[#E4E0EC] focus:border-indigo-400",
                confirm && password !== confirm && "border-[#EDA6B5] focus:border-[#DA6A82]"
              )} required />
          </div>
          {confirm && password !== confirm && (
            <p className="text-xs text-[#C2304F]">Passwords do not match</p>
          )}
        </div>

        <Button type="submit" disabled={loading || (!!confirm && password !== confirm)}
          className={cn("w-full h-11 bg-[#7D5CEF] hover:bg-[#5B3FD0] text-white font-semibold text-sm mt-2", loading && "opacity-80")}>
          {loading
            ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Updating...</span>
            : "Reset Password"
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
