"use client";
/**
 * Feature flags from Super Admin → Settings → Feature flags (on for everyone, some plans, or some studios).
 * `useFlag("new_reports")` is true when the flag is on for this studio. Read once per page load.
 */
import { useEffect, useState } from "react";
import { apiFetch, API_URL as API } from "@/lib/api";

let cached: Set<string> | null = null;
let loading: Promise<Set<string>> | null = null;

export function loadFlags(): Promise<Set<string>> {
  if (cached) return Promise.resolve(cached);
  if (!loading) {
    loading = apiFetch(`${API}/feature-flags/mine`).then(r => (r.ok ? r.json() : { on: [] }))
      .then((d: { on?: string[] }) => (cached = new Set(d.on ?? [])))
      .catch(() => new Set<string>())
      .finally(() => { loading = null; });
  }
  return loading;
}

export function useFlag(key: string): boolean {
  const [on, setOn] = useState(() => !!cached?.has(key));
  useEffect(() => { let alive = true; void loadFlags().then(s => { if (alive) setOn(s.has(key)); }); return () => { alive = false; }; }, [key]);
  return on;
}
