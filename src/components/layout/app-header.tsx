"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/layout/app-sidebar";
import { apiFetch, API_URL as API } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { Search, ShieldAlert, Camera, Users, FileText, X, Loader2 } from "lucide-react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { AccountMenu } from "@/components/layout/account-menu";

interface UserProfile {
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl?: string | null;
  impersonatedBy?: string | null;
  company: { name: string };
}

interface SearchResult {
  id: string;
  label: string;
  sub?: string;
  type: "booking" | "client" | "invoice";
  href: string;
}

interface AppHeaderProps {
  onMenuClick?: () => void;
}

export function AppHeader({ onMenuClick }: AppHeaderProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(-1);
  const [mobileSearch, setMobileSearch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setSearching(true);
    setOpen(true);
    try {
      const [bookingsRes, clientsRes, invoicesRes] = await Promise.all([
        apiFetch(`${API}/bookings?search=${encodeURIComponent(q)}&limit=4`),
        apiFetch(`${API}/clients?search=${encodeURIComponent(q)}&limit=4`),
        apiFetch(`${API}/studio-invoices?search=${encodeURIComponent(q)}&limit=3`),
      ]);

      const [bookingsData, clientsData, invoicesData] = await Promise.all([
        bookingsRes.ok ? bookingsRes.json() : { data: [] },
        clientsRes.ok ? clientsRes.json() : { data: [] },
        invoicesRes.ok ? invoicesRes.json() : { data: [] },
      ]);

      const items: SearchResult[] = [
        ...(bookingsData.data ?? []).map((b: any) => ({
          id: b.id, type: "booking" as const,
          label: b.eventName ?? "Program",
          sub: b.client ? `${b.client.firstName ?? ""} ${b.client.lastName ?? ""}`.trim() : "",
          href: `/programs?view=${b.id}`,
        })),
        ...(clientsData.data ?? []).map((c: any) => ({
          id: c.id, type: "client" as const,
          label: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim(),
          sub: c.phone ?? c.email ?? "",
          href: `/clients?view=${c.id}`,
        })),
        ...(invoicesData.data ?? []).map((inv: any) => ({
          id: inv.id, type: "invoice" as const,
          label: inv.invoiceNumber ?? "Invoice",
          sub: inv.booking?.eventName ?? inv.clientName ?? "",
          href: `/invoices`,
        })),
      ];

      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [API]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    setSelected(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(() => doSearch(q), 300);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && selected >= 0 && results[selected]) {
      navigate(results[selected]);
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); inputRef.current?.blur(); }
  }

  function navigate(r: SearchResult) {
    setOpen(false);
    setMobileSearch(false);
    setQuery("");
    setResults([]);
    router.push(r.href);
  }

  function clearSearch() {
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  const typeIcon = (type: SearchResult["type"]) => {
    if (type === "booking") return <Camera className="w-3.5 h-3.5 text-[#7D5CEF] flex-shrink-0" />;
    if (type === "client") return <Users className="w-3.5 h-3.5 text-[#1F8A5B] flex-shrink-0" />;
    return <FileText className="w-3.5 h-3.5 text-[#7D5CEF] flex-shrink-0" />;
  };

  const typeLabel = (type: SearchResult["type"]) => {
    if (type === "booking") return "Program";
    if (type === "client") return "Client";
    return "Invoice";
  };

  return (
    <>
      {user?.impersonatedBy && (
        <div className="lg:mt-3 lg:rounded-xl bg-[#C2304F] text-white text-xs font-semibold text-center py-1.5 px-4 flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>You are viewing this studio as a Super Admin. All actions are logged.</span>
        </div>
      )}

      <header className="sticky top-0 z-20 sp-topbar">
        <div className="relative h-16 flex items-center justify-between gap-3 px-3 sm:px-4 lg:px-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile: brand */}
            <Link href="/dashboard" className="lg:hidden flex items-center gap-2 min-w-0">
              <BrandMark size={30} />
              <span className="font-extrabold text-[16px] tracking-tight text-[#17151F] truncate">StuPanel</span>
            </Link>

            {/* Search box (desktop inline, mobile as a drop-down row) */}
            <div className={cn(
              "lg:relative lg:block lg:w-80 xl:w-96",
              mobileSearch ? "absolute left-3 right-3 top-[60px] sm:left-4 sm:right-4 z-30" : "hidden"
            )}>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8599] pointer-events-none" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => { if (results.length > 0) setOpen(true); }}
                  placeholder="Search programs, clients, invoices…"
                  className="w-full h-10 pl-10 pr-9 bg-white border border-[#E4E0EC] rounded-xl text-sm shadow-sm placeholder:text-[#8A8599] focus:outline-none focus:ring-4 focus:ring-[#7D5CEF]/15 focus:border-[#A28BF5] transition-shadow"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7D5CEF] animate-spin" />
                )}
                {query && !searching && (
                  <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8599] hover:text-[#4A4658]" aria-label="Clear search">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Dropdown results */}
              {open && (
                <div
                  ref={dropdownRef}
                  className="absolute top-full left-0 mt-2 w-full bg-white rounded-2xl shadow-[0_20px_50px_-20px_rgba(22,20,29,0.35)] border border-[#E4E0EC] z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  {results.length === 0 && !searching && (
                    <div className="px-4 py-8 text-center text-sm text-[#8A8599]">No results found</div>
                  )}
                  {results.length > 0 && (
                    <ul className="p-1.5 max-h-80 overflow-y-auto">
                      {results.map((r, i) => (
                        <li key={r.id + r.type}>
                          <button
                            onMouseEnter={() => setSelected(i)}
                            onClick={() => navigate(r)}
                            className={cn("w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors",
                              selected === i ? "bg-[#F7F4FE]" : "hover:bg-[#F7F5FB]")}
                          >
                            <div className="w-8 h-8 rounded-lg bg-[#F1EFF6] flex items-center justify-center flex-shrink-0">
                              {typeIcon(r.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#17151F] truncate">{r.label}</p>
                              {r.sub && <p className="text-xs text-[#8A8599] truncate">{r.sub}</p>}
                            </div>
                            <span className="text-xs font-semibold text-[#6B6680] bg-[#F1EFF6] px-1.5 py-0.5 rounded-md flex-shrink-0">
                              {typeLabel(r.type)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => { setMobileSearch(v => !v); setTimeout(() => inputRef.current?.focus(), 50); }}
              className={cn("lg:hidden w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                mobileSearch ? "bg-[#F7F4FE] text-[#5B3FD0]" : "bg-white border border-[#E4E0EC] text-[#4A4658]")}
              aria-label="Search"
            >
              {mobileSearch ? <X className="w-[18px] h-[18px]" /> : <Search className="w-[18px] h-[18px]" />}
            </button>

            <NotificationBell />
            {/* On phones the sidebar is hidden, so the account menu sits here too */}
            <div className="lg:hidden"><AccountMenu variant="icon" side="bottom" /></div>
          </div>
        </div>
      </header>
    </>
  );
}
