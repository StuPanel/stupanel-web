"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, User, X } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";

type Suggestion =
  | { type: "client"; id: string; name: string; phone?: string }
  | { type: "name"; name: string };

interface ReferrerInputProps {
  clientId?: string;
  name?: string;
  onChange: (v: { clientId?: string; name?: string }) => void;
}

// Free-text "who referred this client" field with autocomplete drawn from
// existing clients + previously-typed referrer names. Selecting an existing
// client links referredByClientId; anything else is stored as referredByName.
export function ReferrerInput({ clientId, name, onChange }: ReferrerInputProps) {
  const [query, setQuery] = useState(name ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { setQuery(name ?? ""); }, [name]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!query.trim()) { setSuggestions([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`${API}/clients/referrers?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch { setSuggestions([]); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [query]);

  function pick(s: Suggestion) {
    setQuery(s.name);
    setOpen(false);
    onChange(s.type === "client" ? { clientId: s.id, name: s.name } : { clientId: undefined, name: s.name });
  }

  function clear() {
    setQuery("");
    onChange({ clientId: undefined, name: undefined });
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            onChange({ clientId: undefined, name: e.target.value });
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
          placeholder="Type a name..."
          className={cn(
            "w-full h-11 px-3 pr-8 rounded-lg border text-sm focus:outline-none focus:border-indigo-400",
            clientId ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 bg-white",
          )}
        />
        {query && (
          <button type="button" onClick={clear} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {clientId && (
        <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
          <User className="w-3 h-3" /> Linked to an existing client
        </p>
      )}
      {open && (loading || suggestions.length > 0) && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Searching...</div>
          )}
          {!loading && suggestions.map((s, i) => (
            <button
              key={i} type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex items-center justify-between gap-2"
            >
              <span className="truncate">{s.name}</span>
              {s.type === "client" ? (
                <span className="text-[10px] text-emerald-600 flex-shrink-0">Client{s.phone ? ` · ${s.phone}` : ""}</span>
              ) : (
                <span className="text-[10px] text-slate-400 flex-shrink-0">Previously used</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
