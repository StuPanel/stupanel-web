"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiFetch, API_URL as API } from "@/lib/api";

export interface UserProfile {
  id?: string;
  firstName: string;
  lastName?: string;
  role: string;
  avatarUrl?: string | null;
  email: string;
  emailVerified: boolean;
  impersonatedBy?: string | null;
  company: { name: string };
}

interface AuthContextValue {
  user: UserProfile | null;
  ready: boolean;
  emailVerified: boolean;
  companyLogo: string;
  companyName: string;
  setCompanyLogo: (url: string) => void;
  setCompanyName: (name: string) => void;
  refetchUser: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  ready: false,
  emailVerified: true,
  companyLogo: "",
  companyName: "",
  setCompanyLogo: () => {},
  setCompanyName: () => {},
  refetchUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [companyLogo, setCompanyLogo] = useState("");
  const [companyName, setCompanyName] = useState("");

  const load = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) { setReady(true); return; }
    try {
      const [meRes, compRes] = await Promise.all([
        apiFetch(`${API}/auth/me`),
        apiFetch(`${API}/companies/me`),
      ]);
      if (meRes.ok) {
        const data = await meRes.json();
        setUser(data);
      }
      if (compRes.ok) {
        const comp = await compRes.json();
        if (comp.logoUrl) setCompanyLogo(comp.logoUrl);
        if (comp.name)   setCompanyName(comp.name);
      }
    } catch {
      // network error — don't crash, just proceed
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    load();

    // Update logo from branding settings page
    function onBranding(e: Event) {
      const d = (e as CustomEvent).detail;
      if (d?.logoUrl)     setCompanyLogo(d.logoUrl);
      if (d?.companyName) setCompanyName(d.companyName);
    }
    window.addEventListener("branding-updated", onBranding);
    return () => window.removeEventListener("branding-updated", onBranding);
  }, [load]);

  return (
    <AuthContext.Provider value={{
      user,
      ready,
      emailVerified: user?.emailVerified ?? true,
      companyLogo,
      companyName,
      setCompanyLogo,
      setCompanyName,
      refetchUser: load,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
