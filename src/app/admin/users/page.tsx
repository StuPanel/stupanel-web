"use client";

/**
 * Admin → Users: people grouped by studio (newest studio first). Each studio is one row;
 * opening it shows its people in order owner → manager → team → freelancer.
 * A search (studio, name, email, phone) opens the studios where a person matched.
 */
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2, ChevronDown, ChevronLeft, ChevronRight, Crown, Loader2, Search, ShieldCheck, UserCheck, UserX, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";

function getToken() { return sessionStorage.getItem("admin_token") ?? ""; }
function authH() { return { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` }; }
function fmtDate(d?: string | null) {
  if (!d) return "Never";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type Kind = "owner" | "manager" | "team" | "freelancer";
type Person = {
  id: string; name: string; email: string | null; username: string | null; phone: string | null; kind: Kind; works: string[];
  canLogIn: boolean; isActive: boolean; isSuperAdmin: boolean; createdAt: string; lastLoginAt: string | null; otherStudios: number; matched: boolean;
};
type Studio = {
  id: string; name: string; slug: string; createdAt: string; state: "open" | "suspended" | "deleting" | "archived"; ownerName: string | null;
  counts: { owner: number; manager: number; team: number; freelancer: number; total: number }; users: Person[];
};

const KIND: Record<Kind, { label: string; plural: string; cls: string }> = {
  owner: { label: "Owner", plural: "owner", cls: "bg-amber-500/15 text-amber-300 border-amber-600/40" },
  manager: { label: "Manager", plural: "manager", cls: "bg-indigo-500/15 text-indigo-300 border-indigo-600/40" },
  team: { label: "Team member", plural: "team", cls: "bg-slate-600/30 text-slate-300 border-slate-600" },
  freelancer: { label: "Freelancer", plural: "freelancer", cls: "bg-teal-500/10 text-teal-300 border-teal-700/50" },
};
const STATE: Record<Studio["state"], { label: string; cls: string } | null> = {
  open: null,
  suspended: { label: "Suspended", cls: "bg-red-500/15 text-red-300 border-red-700/50" },
  deleting: { label: "Being deleted", cls: "bg-amber-500/15 text-amber-300 border-amber-700/50" },
  archived: { label: "Archived", cls: "bg-slate-600/30 text-slate-300 border-slate-600" },
};
const work = (w: string) => w.replace(/_/g, " ");

export default function AdminUsersPage() {
  const router = useRouter();
  const [items, setItems] = useState<Studio[]>([]);
  const [total, setTotal] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [asked, setAsked] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (p = 1, s = "", keepOpen = false) => {
    setLoading(true); setError("");
    try {
      const q = new URLSearchParams({ page: String(p), limit: "20", ...(s && { search: s }) });
      const res = await fetch(`${API}/admin/users/by-studio?${q}`, { headers: authH() });
      if (res.status === 401) { router.replace("/admin/login"); return; }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.message || "Could not load."); return; }
      const list: Studio[] = d.items ?? [];
      setItems(list); setTotal(d.total ?? 0); setTotalUsers(d.totalUsers ?? 0); setPages(d.pages ?? 1); setPage(p); setAsked(s);
      // A search opens the studios where a person matched; with one studio on the page, it is open.
      if (!keepOpen) setOpen(new Set(list.filter(x => (s && x.users.some(u => u.matched)) || list.length === 1).map(x => x.id)));
    } catch { setError("Couldn't reach StuPanel. Check your internet and try again."); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function patch(u: Person, body: Record<string, boolean>) {
    setBusy(u.id);
    await fetch(`${API}/admin/users/${u.id}`, { method: "PATCH", headers: authH(), body: JSON.stringify(body) }).catch(() => {});
    await load(page, asked, true);
    setBusy(null);
  }
  const toggle = (id: string) => setOpen(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOpen = items.length > 0 && items.every(s => open.has(s.id));

  return (
    <div className="p-6 md:p-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-sm text-slate-400 mt-0.5">{asked ? `${total} studio${total === 1 ? "" : "s"} found for “${asked}”` : `${totalUsers} people in ${total} studio${total === 1 ? "" : "s"}`} — grouped by studio, newest first</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); load(1, search.trim()); }} className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)} aria-label="Search studio, name, email or phone"
            placeholder="Search studio, name, email or phone…"
            className="pl-9 pr-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 h-10" />
          {(search || asked) && (
            <button type="button" aria-label="Clear search" onClick={() => { setSearch(""); load(1, ""); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md text-slate-400 hover:bg-slate-700 inline-flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
          )}
        </div>
        <Button type="submit" size="sm" variant="outline" className="bg-transparent border-slate-700 text-slate-200 hover:bg-slate-800 h-10 gap-1.5"><Search className="w-3.5 h-3.5" />Search</Button>
        {items.length > 1 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(allOpen ? new Set() : new Set(items.map(s => s.id)))} className="h-10 text-slate-300 hover:bg-slate-800">
            {allOpen ? "Close all" : "Open all"}
          </Button>
        )}
      </form>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
      ) : error ? (
        <div className="text-center py-16 text-red-400 bg-slate-800 border border-slate-700 rounded-xl text-sm">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-slate-800 border border-slate-700 rounded-xl text-sm">{asked ? `Nothing found for “${asked}”` : "No studios yet"}</div>
      ) : (
        <div className="space-y-2.5">
          {items.map(s => {
            const isOpen = open.has(s.id);
            const st = STATE[s.state];
            const parts = (["owner", "manager", "team", "freelancer"] as Kind[]).filter(k => s.counts[k] > 0).map(k => `${s.counts[k]} ${KIND[k].plural}${k !== "team" && s.counts[k] > 1 ? "s" : ""}`);
            return (
              <section key={s.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <button type="button" onClick={() => toggle(s.id)} aria-expanded={isOpen}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/30">
                  <span className="w-9 h-9 rounded-lg bg-indigo-500/15 text-indigo-300 flex items-center justify-center flex-shrink-0"><Building2 className="w-[18px] h-[18px]" /></span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white break-words">{s.name}</span>
                      {st && <span className={cn("text-[11px] px-1.5 py-0.5 rounded border font-semibold", st.cls)}>{st.label}</span>}
                    </span>
                    <span className="block text-xs text-slate-400 mt-0.5">
                      {s.ownerName ? `${s.ownerName} · ` : ""}{parts.length ? parts.join(" · ") : "No people"} · joined {fmtDate(s.createdAt)}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-slate-300 bg-slate-700/60 rounded-full px-2 py-0.5 flex-shrink-0">{s.counts.total}</span>
                  <ChevronDown className={cn("w-4 h-4 text-slate-400 flex-shrink-0 transition-transform", isOpen && "rotate-180")} />
                </button>

                {isOpen && (
                  <div className="border-t border-slate-700">
                    {s.users.length === 0 ? <p className="px-4 py-4 text-sm text-slate-500">No people in this studio.</p> : (
                      <ul className="divide-y divide-slate-700/60">
                        {s.users.map(u => (
                          <li key={u.id} className={cn("px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2", u.matched && "bg-indigo-500/[0.07]")}>
                            <span className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center font-bold text-sm text-slate-200 flex-shrink-0">
                              {u.kind === "owner" ? <Crown className="w-4 h-4 text-amber-400" /> : (u.name?.[0]?.toUpperCase() ?? "?")}
                            </span>
                            <div className="flex-1 min-w-[180px]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-white text-sm break-words">{u.name || "No name"}</span>
                                <span className={cn("text-[11px] px-1.5 py-0.5 rounded border font-semibold", KIND[u.kind].cls)}>{KIND[u.kind].label}</span>
                                {u.isSuperAdmin && <span className="text-[11px] bg-indigo-600/30 text-indigo-300 border border-indigo-600/40 px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                                {!u.isActive && <span className="text-[11px] px-1.5 py-0.5 rounded border font-semibold bg-red-500/15 text-red-300 border-red-700/50">Disabled</span>}
                              </div>
                              <p className="text-xs text-slate-400 break-all">
                                {u.email ?? (u.username ? `@${u.username}` : u.phone ?? "No login")}
                                {u.works.length > 0 && <span className="text-slate-500"> · {u.works.map(work).join(", ")}</span>}
                              </p>
                              {u.otherStudios > 0 && <p className="text-[11px] text-teal-300/90 mt-0.5">Also in {u.otherStudios} other studio{u.otherStudios === 1 ? "" : "s"} with this email</p>}
                            </div>
                            <div className="text-xs text-slate-400 w-[120px]">
                              <span className="block text-slate-500">{u.canLogIn ? "Last sign-in" : "Sign-in"}</span>
                              {u.canLogIn ? fmtDate(u.lastLoginAt) : "No login"}
                            </div>
                            <div className="flex items-center gap-1 ml-auto">
                              <Button size="sm" variant="ghost" onClick={() => patch(u, { isActive: !u.isActive })} disabled={busy === u.id}
                                className={cn("h-8 px-2 gap-1 text-xs", u.isActive ? "text-red-400 hover:bg-red-900/20" : "text-emerald-400 hover:bg-emerald-900/20")}>
                                {busy === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : u.isActive ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                                {u.isActive ? "Disable" : "Enable"}
                              </Button>
                              {u.isSuperAdmin && (
                                <Button size="sm" variant="ghost" onClick={() => patch(u, { isSuperAdmin: false })} disabled={busy === u.id}
                                  className="h-8 px-2 gap-1 text-xs text-amber-400 hover:bg-amber-900/20"><ShieldCheck className="w-3 h-3" />Revoke admin</Button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="px-4 py-2.5 border-t border-slate-700/60 text-right">
                      <Link href={`/admin/studios/${s.id}`} className="text-xs font-semibold text-indigo-300 hover:underline">Open studio →</Link>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Page {page} of {pages} · {total} studios</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => load(page - 1, asked)} className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 h-8 gap-1"><ChevronLeft className="w-3.5 h-3.5" />Prev</Button>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => load(page + 1, asked)} className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 h-8 gap-1">Next<ChevronRight className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
