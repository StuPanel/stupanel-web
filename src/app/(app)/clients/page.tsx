"use client";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, Plus, Phone, Star, MoreHorizontal, Users, Camera, User, Edit3, Trash2, Eye } from "lucide-react";
import { Chips, EmptyState, Group, MainButton, PageHeader, Pager, RowsSkeleton, SearchField } from "@/components/ui/apple";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { ClientDrawer, DeleteDialog, fullName, type Client } from "./_components/client-drawer";

// ─── Helpers ────────────────────────────────────────────────────────────────




function initials(c: Client) {
  const f = c.firstName?.[0] ?? "";
  const l = c.lastName?.[0] ?? "";
  return (f + l).toUpperCase() || "?";
}

const AVATAR_COLORS = [
  "bg-[#EEE8FD] text-[#5B3FD0]",
  "bg-[#E7F5EE] text-[#1F8A5B]",
  "bg-[#E8F0FA] text-[#1F5C99]",
  "bg-[#EEE8FD] text-[#5B3FD0]",
  "bg-[#FFF3E0] text-[#9A5B00]",
  "bg-[#F7E9F4] text-[#9E3A8C]",
  "bg-[#E3F2F1] text-[#126B66]",
  "bg-[#FFF3E0] text-[#9A5B00]",
];

function avatarColor(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n += id.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

// ─── Client row (Apple style) ───────────────────────────────────────────────

function ClientListRow({
  client, onView, onEdit, onDelete,
}: {
  client: Client;
  onView: (c: Client) => void;
  onEdit: (c: Client) => void;
  onDelete: (c: Client) => void;
}) {
  const n = client.bookings?.length ?? 0;
  const sub = [client.phone, client.city].filter(Boolean).join(" · ") || client.email || "No contact yet";
  return (
    <div role="button" tabIndex={0} onClick={() => onView(client)} onKeyDown={e => { if (e.key === "Enter") onView(client); }}
      className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[68px] cursor-pointer hover:bg-[#F7F5FB] transition-colors focus:outline-none focus-visible:bg-[#F7F5FB]">
      <span className="w-11 h-11 rounded-full bg-[#EEE8FD] text-[#5B3FD0] text-sm font-bold flex items-center justify-center flex-shrink-0">
        {initials(client)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#17151F] truncate flex items-center gap-1.5">
          {fullName(client)}
          {client.vipStatus && <span className="text-[11px] font-bold text-[#9E3A8C] bg-[#FBF2FA] px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5"><Star className="w-3 h-3 fill-current" />VIP</span>}
        </p>
        <p className="text-xs text-[#6B6680] truncate mt-0.5">{sub}</p>
      </div>
      <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-[#4A4658] bg-[#F5F3FA] px-2.5 py-1 rounded-full flex-shrink-0">
        <Camera className="w-3.5 h-3.5" />{n} program{n === 1 ? "" : "s"}
      </span>
      {client.phone && (
        <a href={`tel:${client.phone}`} onClick={e => e.stopPropagation()} aria-label={`Call ${fullName(client)}`}
          className="w-9 h-9 rounded-full flex items-center justify-center text-[#1F8A5B] hover:bg-[#E9F5EF] flex-shrink-0">
          <Phone className="w-4 h-4" />
        </a>
      )}
      <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label={`More for ${fullName(client)}`} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#EEEBF4] text-[#6B6680]">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-[16px] p-1">
            <DropdownMenuItem className="gap-2 text-sm h-10 rounded-[12px]" onClick={() => onView(client)}><Eye className="w-4 h-4" /> Open profile</DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-sm h-10 rounded-[12px]" onClick={() => onEdit(client)}><Edit3 className="w-4 h-4" /> Edit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-sm h-10 rounded-[12px] text-[#C2304F]" onClick={() => onDelete(client)}><Trash2 className="w-4 h-4" /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [vipOnly, setVipOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const [drawer, setDrawer] = useState(false);
  const [editTarget, setEditTarget] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const LIMIT = 20;

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(search && { search }),
        ...(vipOnly && { vipStatus: "true" }),
      });
      const res = await apiFetch(`${API}/clients?${params}`, { headers: { "Content-Type": "application/json" } });
      if (!res.ok) return;
      const data = await res.json();
      setClients(data.data ?? []);
      setTotal(data.meta?.total ?? 0);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [page, search, vipOnly]);

  useEffect(() => { fetchClients(); }, [fetchClients]);
  useEffect(() => { setPage(1); }, [search, vipOnly]);

  // Old links (?view=id) go to the client's page
  useEffect(() => {
    const viewId = searchParams.get("view");
    if (viewId) router.replace(`/clients/${viewId}`);
  }, [searchParams, router]);

  function openNew() { setEditTarget(null); setDrawer(true); }
  function openEdit(c: Client) { setEditTarget(c); setDrawer(true); }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <PageHeader icon={Users} color="blue" title="Clients"
        sub={total ? `${total} client${total === 1 ? "" : "s"}` : "Everyone you work with"}>
        <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={search} onChange={setSearch} placeholder="Search name or phone" />
        <MainButton icon={Plus} onClick={openNew}>Add client</MainButton>
      </PageHeader>

      <Chips label="Filter clients" value={vipOnly ? "vip" : "all"} onChange={v => setVipOnly(v === "vip")}
        options={[{ value: "all", label: "All clients" }, { value: "vip", label: "VIP", dot: "#9E3A8C" }]} />

      {loading ? (
        <RowsSkeleton n={6} />
      ) : clients.length === 0 ? (
        search || vipOnly ? (
          <EmptyState icon={Search} title={search ? `No clients match "${search}"` : "No VIP clients yet"} text="Try another name or phone number." />
        ) : (
          <EmptyState icon={User} title="No clients yet" text="Add your first client to get started."
            action={<MainButton icon={Plus} onClick={openNew}>Add client</MainButton>} />
        )
      ) : (
        <Group>
          {clients.map(c => (
            <ClientListRow key={c.id} client={c}
              onView={c => router.push(`/clients/${c.id}`)}
              onEdit={openEdit}
              onDelete={c => setDeleteTarget(c)} />
          ))}
        </Group>
      )}

      <Pager page={page} pages={totalPages} onChange={setPage} />

      {/* Drawers & Dialogs */}
      <ClientDrawer
        open={drawer}
        onClose={() => { setDrawer(false); setEditTarget(null); }}
        onSaved={fetchClients}
        editing={editTarget}
        onOpenExisting={id => { setDrawer(false); setEditTarget(null); router.push(`/clients/${id}`); }}
      />
      <DeleteDialog
        client={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={fetchClients}
      />
    </div>
  );
}
