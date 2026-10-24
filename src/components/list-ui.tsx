"use client";

import { Search, X } from "lucide-react";

/** DESIGN_SYSTEM §6: every list page has a search pill that filters live. */
export function SearchPill({ value, onChange, placeholder = "Search…" }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6680] pointer-events-none" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-11 pl-11 pr-10 rounded-full bg-white border border-[#E3DFEC] text-sm text-[#17151F] placeholder:text-[#6B6680] focus:outline-none focus:ring-2 focus:ring-[#5B3FD0]/30 focus:border-[#5B3FD0] transition-colors" />
      {value && (
        <button onClick={() => onChange("")} aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA]">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/** DESIGN_SYSTEM §6: loading = skeleton shimmer, not a lone spinner. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-[18px] p-4 flex items-center gap-3 shadow-sm">
          <div className="sp-skel w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="sp-skel h-3.5 w-2/5 rounded-full" />
            <div className="sp-skel h-3 w-3/5 rounded-full" />
          </div>
          <div className="sp-skel h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Case-insensitive match of a query against any of the given fields. */
export function matches(q: string, ...fields: (string | number | null | undefined)[]) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return fields.some(f => f != null && String(f).toLowerCase().includes(s));
}
