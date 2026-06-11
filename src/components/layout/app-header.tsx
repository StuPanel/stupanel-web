"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, API_URL as API } from "@/lib/api";
import {
  Bell, Search, ChevronDown, Menu, Settings, User, LogOut, ShieldAlert,
  Camera, Users, FileText, X, Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  
  const [user, setUser] = useState<UserProfile | null>(null);

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    apiFetch(`${API}/auth/me`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.firstName) setUser(data); })
      .catch(() => {});
  }, []);

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
          href: `/bookings/${b.id}`,
        })),
        ...(clientsData.data ?? []).map((c: any) => ({
          id: c.id, type: "client" as const,
          label: c.name,
          sub: c.phone ?? c.email ?? "",
          href: `/clients/${c.id}`,
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
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
  }

  function navigate(r: SearchResult) {
    setOpen(false);
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
    if (type === "booking") return <Camera className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />;
    if (type === "client") return <Users className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />;
    return <FileText className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />;
  };

  const typeLabel = (type: SearchResult["type"]) => {
    if (type === "booking") return "Program";
    if (type === "client") return "Client";
    return "Invoice";
  };

  async function handleLogout() {
    try {
      await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    } catch {}
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    document.cookie = "access_token=; path=/; max-age=0; SameSite=Lax";
    router.push("/login");
  }

  const initials = user
    ? `${user.firstName[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "?";
  const displayName = user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Loading...";
  const roleLabel = user?.role === "owner" ? "Studio Admin" : user?.role === "staff" ? "Staff" : (user?.role ?? "");

  return (
    <>
      {user?.impersonatedBy && (
        <div className="bg-amber-500 text-white text-xs font-semibold text-center py-1.5 px-4 flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>⚠️ You are viewing this studio as a Super Admin. All actions are logged.</span>
        </div>
      )}

      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>

          {/* Search box */}
          <div className="relative hidden sm:block w-64 lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (results.length > 0) setOpen(true); }}
              placeholder="Search programs, clients…"
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-colors h-9"
            />
            {searching && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
            )}
            {query && !searching && (
              <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Dropdown results */}
            {open && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 mt-1 w-full bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden"
              >
                {results.length === 0 && !searching && (
                  <div className="px-4 py-6 text-center text-sm text-slate-400">
                    কোনো ফলাফল পাওয়া যায়নি
                  </div>
                )}
                {results.length > 0 && (
                  <ul className="py-1 max-h-72 overflow-y-auto">
                    {results.map((r, i) => (
                      <li key={r.id + r.type}>
                        <button
                          onMouseEnter={() => setSelected(i)}
                          onClick={() => navigate(r)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                            selected === i ? "bg-indigo-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                            {typeIcon(r.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{r.label}</p>
                            {r.sub && <p className="text-xs text-slate-400 truncate">{r.sub}</p>}
                          </div>
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
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

        <div className="flex items-center gap-2">
          <button className="sm:hidden p-2 rounded-lg hover:bg-slate-100">
            <Search className="w-5 h-5 text-slate-500" />
          </button>

          <Button variant="ghost" size="sm" className="relative w-9 h-9 p-0">
            <Bell className="w-4 h-4 text-slate-500" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-slate-100 rounded-lg px-2 py-1.5 transition-colors">
                <Avatar className="w-8 h-8">
                  {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={displayName} />}
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left hidden md:block">
                  <p className="text-sm font-medium text-slate-900 leading-none">{displayName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{roleLabel}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52" sideOffset={8}>
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="text-xs text-slate-500 mt-0.5">{user?.company?.name ?? ""}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/account")} className="cursor-pointer gap-2">
                <User className="w-4 h-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer gap-2">
                <Settings className="w-4 h-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer gap-2 text-red-600 focus:text-red-600 focus:bg-red-50">
                <LogOut className="w-4 h-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  );
}
