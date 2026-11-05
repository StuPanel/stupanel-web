"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/layout/app-sidebar";
import { apiFetch, API_URL as API } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import {
  Bell, Search, Settings, User, LogOut, ShieldAlert,
  Camera, Users, FileText, X, Loader2, LifeBuoy,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
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
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

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

  const checkUnread = useCallback(() => {
    apiFetch(`${API}/dashboard/notifications`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.items) { setHasUnread(false); return; }
        let dismissed: string[] = [];
        let seen: string[] = [];
        try { dismissed = JSON.parse(localStorage.getItem("notif_dismissed") ?? "[]"); } catch {}
        try { seen = JSON.parse(localStorage.getItem("notif_seen") ?? "[]"); } catch {}
        const unseen = data.items.filter((n: { id: string }) => !dismissed.includes(n.id) && !seen.includes(n.id));
        setHasUnread(unseen.length > 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    // Initial notification check
    checkUnread();

    // Poll only when tab is visible, every 2 minutes
    function onVisibilityChange() {
      if (document.visibilityState === "visible") checkUnread();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("notif-seen-updated", checkUnread);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") checkUnread();
    }, 120000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("notif-seen-updated", checkUnread);
      clearInterval(interval);
    };
  }, [checkUnread]);

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
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
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
    if (type === "booking") return <Camera className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />;
    if (type === "client") return <Users className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />;
    return <FileText className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />;
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
  const roleLabel = user?.role === "owner" ? "Owner" : user?.role === "manager" ? "Manager" : user?.role === "staff" ? "Staff" : (user?.role ?? "");
  const isOwner = user?.role === "owner";

  // Account menu opens on hover (and on click / tap); closes shortly after the pointer leaves.
  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openMenu = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setMenuOpen(true); };
  // Only real mouse hover — on phones a tap must not open and close it at once.
  const hoveredAt = useRef(0);
  const hoverOpen = () => { if (window.matchMedia("(hover: hover)").matches) { hoveredAt.current = Date.now(); openMenu(); } };
  // A click right after hovering open should not close it again.
  const onMenuChange = (o: boolean) => { if (!o && Date.now() - hoveredAt.current < 600) return; setMenuOpen(o); };
  const closeMenuSoon = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => setMenuOpen(false), 180); };

  return (
    <>
      {user?.impersonatedBy && (
        <div className="lg:mt-3 lg:rounded-xl bg-[#C2304F] text-white text-xs font-semibold text-center py-1.5 px-4 flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>You are viewing this studio as a Super Admin. All actions are logged.</span>
        </div>
      )}

      <header className="sticky top-0 z-20 bg-slate-50/85 backdrop-blur-md supports-[backdrop-filter]:bg-slate-50/70">
        <div className="relative h-16 flex items-center justify-between gap-3 px-3 sm:px-4 lg:px-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile: brand */}
            <Link href="/dashboard" className="lg:hidden flex items-center gap-2 min-w-0">
              <BrandMark size={30} />
              <span className="font-extrabold text-[16px] tracking-tight text-slate-900 truncate">StuPanel</span>
            </Link>

            {/* Search box (desktop inline, mobile as a drop-down row) */}
            <div className={cn(
              "lg:relative lg:block lg:w-80 xl:w-96",
              mobileSearch ? "absolute left-3 right-3 top-[60px] sm:left-4 sm:right-4 z-30" : "hidden"
            )}>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => { if (results.length > 0) setOpen(true); }}
                  placeholder="Search programs, clients, invoices…"
                  className="w-full h-10 pl-10 pr-9 bg-white border border-slate-200 rounded-xl text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-violet-500/15 focus:border-violet-400 transition-shadow"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-500 animate-spin" />
                )}
                {query && !searching && (
                  <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear search">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Dropdown results */}
              {open && (
                <div
                  ref={dropdownRef}
                  className="absolute top-full left-0 mt-2 w-full bg-white rounded-2xl shadow-[0_20px_50px_-20px_rgba(22,20,29,0.35)] border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  {results.length === 0 && !searching && (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">No results found</div>
                  )}
                  {results.length > 0 && (
                    <ul className="p-1.5 max-h-80 overflow-y-auto">
                      {results.map((r, i) => (
                        <li key={r.id + r.type}>
                          <button
                            onMouseEnter={() => setSelected(i)}
                            onClick={() => navigate(r)}
                            className={cn("w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors",
                              selected === i ? "bg-violet-50" : "hover:bg-slate-50")}
                          >
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                              {typeIcon(r.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{r.label}</p>
                              {r.sub && <p className="text-xs text-slate-400 truncate">{r.sub}</p>}
                            </div>
                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md flex-shrink-0">
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
                mobileSearch ? "bg-violet-50 text-violet-700" : "bg-white border border-slate-200 text-slate-600")}
              aria-label="Search"
            >
              {mobileSearch ? <X className="w-[18px] h-[18px]" /> : <Search className="w-[18px] h-[18px]" />}
            </button>

            <button
              onClick={() => router.push("/notifications")}
              className="relative w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-violet-700 hover:border-violet-200 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-[18px] h-[18px]" />
              {hasUnread && <span className="absolute top-2 right-2 w-2 h-2 bg-violet-600 rounded-full ring-2 ring-white" />}
            </button>

            <DropdownMenu open={menuOpen} onOpenChange={onMenuChange} modal={false}>
              <DropdownMenuTrigger asChild onMouseEnter={hoverOpen} onMouseLeave={closeMenuSoon}>
                <button aria-label="Account menu" title={displayName}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[13px] font-bold text-violet-700 hover:border-violet-200 transition-colors">
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} onMouseEnter={openMenu} onMouseLeave={closeMenuSoon}
                className="w-60 p-0 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-[0_12px_40px_-12px_rgba(22,18,40,.28)] duration-150 data-open:zoom-in-100 data-closed:zoom-out-100">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{roleLabel}{user?.company?.name ? ` · ${user.company.name}` : ""}</p>
                </div>
                <div className="p-1.5">
                  {isOwner ? (<>
                    <DropdownMenuItem onClick={() => router.push("/settings?pane=profile")} className="cursor-pointer gap-2 rounded-lg">
                      <User className="w-4 h-4 text-violet-600" /> My profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer gap-2 rounded-lg">
                      <Settings className="w-4 h-4 text-slate-500" /> Settings
                    </DropdownMenuItem>
                  </>) : (
                    <DropdownMenuItem onClick={() => router.push("/account")} className="cursor-pointer gap-2 rounded-lg">
                      <User className="w-4 h-4 text-violet-600" /> My profile
                    </DropdownMenuItem>
                  )}
                  {user?.role === "manager" && (
                    <DropdownMenuItem onClick={() => router.push("/member/dashboard")} className="cursor-pointer gap-2 rounded-lg">
                      <Camera className="w-4 h-4 text-violet-600" /> My work &amp; pay
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => router.push("/support")} className="cursor-pointer gap-2 rounded-lg">
                    <LifeBuoy className="w-4 h-4 text-slate-500" /> Help &amp; Support
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer gap-2 rounded-lg text-[#C2304F] focus:text-[#C2304F] focus:bg-rose-50">
                    <LogOut className="w-4 h-4" /> Log out
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  );
}
