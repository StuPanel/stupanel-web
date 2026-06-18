"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { API_URL as API } from "@/lib/api";


export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const raw = data.message;
        setError(Array.isArray(raw) ? raw[0] : (raw || "Login failed"));
        return;
      }

      if (!data.user?.isSuperAdmin) {
        setError("Access denied. Super Admin account required.");
        return;
      }

      sessionStorage.setItem("admin_token", data.accessToken);
      localStorage.setItem("admin_name", `${data.user.firstName} ${data.user.lastName ?? ""}`.trim());
      router.replace("/admin/dashboard");
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">StuPanel Admin</h1>
          <p className="text-slate-400 text-sm mt-1">Super Admin Control Panel</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Email</label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@stupanel.com"
              required
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 h-10"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Password</label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 h-10 pr-10"
              />
              <button type="button" onClick={() => setShowPw(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-950/50 border border-red-900 px-3 py-2 rounded-lg">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Sign In as Super Admin
          </Button>
        </form>

        <p className="text-center text-xs text-slate-600 mt-4">
          StuPanel Super Admin Panel — Restricted Access
        </p>
      </div>
    </div>
  );
}
