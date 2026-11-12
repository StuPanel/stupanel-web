"use client";

import { createPortal } from "react-dom";

import { UserCog as HeaderIcon } from "lucide-react";
import { Chips, EmptyState, Group, MainButton, PageHeader, RowsSkeleton, SearchField, Tile } from "@/components/ui/apple";

import { apiFetch } from "@/lib/api";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, Edit3, MoreHorizontal, MessageCircle, KeyRound, UserCheck, UserX, Shield, Tag, Search, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { Avatar } from "@/components/ui/profile-kit";
import { WaitingCostsLink, useWaitingCosts } from "@/components/team-costs";
import { offOn, todayStr } from "@/lib/member-prefs";
import { DEFAULT_ROLES, DeleteDialog, MemberDrawer, ResetPassDialog, resendInvite, roleConfig, type Member } from "./_components/member-drawer";
import { useRouter } from "next/navigation";
import { unitLabel } from "./_components/rate-card";
import { formatCurrency } from "@/lib/format";
import { useAuth } from "@/context/auth-context";
import { waNumber } from "@/lib/phone";



// ─── Action Menu ───────────────────────────────────────────────────────────────
function ActionMenu({ member, onEdit, onReset, onToggle, onDelete }: {
  member: Member; onEdit: () => void; onReset: () => void; onToggle: () => void; onDelete: () => void;
}) {
  // The list card clips its content (rounded corners), so the menu is drawn on
  // top of the page at the button's spot, and opens upward if there's no room below.
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const isOwner = useAuth().user?.role === "owner";
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const open = !!pos;
  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) setPos(null);
    }
    const shut = () => setPos(null);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); setPos(null); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", shut, true);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", shut, true);
      window.removeEventListener("resize", shut);
    };
  }, [open]);
  function toggle() {
    if (open) { setPos(null); return; }
    const r = btn.current!.getBoundingClientRect();
    const MENU_H = 200, MENU_W = 200;
    const up = window.innerHeight - r.bottom < MENU_H + 12 && r.top > MENU_H + 12;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: Math.max(8, Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8)), up });
  }
  function act(fn: () => void) { fn(); setPos(null); }
  const item = "w-full flex items-center gap-2.5 px-3.5 h-10 rounded-[12px] text-sm text-left";
  return (
    <>
      <button ref={btn} onClick={toggle} aria-label="More" aria-haspopup="menu" aria-expanded={open} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#EEEBF4] text-[#6B6680]">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {pos && typeof document !== "undefined" && createPortal(
        <div ref={menu} role="menu" style={{ top: pos.top, left: pos.left, width: 200, transform: pos.up ? "translateY(-100%)" : undefined }}
          className="fixed z-[80] bg-white rounded-[16px] shadow-[0_2px_4px_rgba(22,18,40,.06),0_16px_32px_rgba(22,18,40,.14)] p-1">
          <button role="menuitem" onClick={() => act(onEdit)} className={cn(item, "text-[#17151F] hover:bg-[#F5F3FA]")}><Edit3 className="w-4 h-4 text-[#6B6680]" />Edit info</button>
          {isOwner && member.memberType !== "freelancer" && (member.login?.invitePending
            ? <button role="menuitem" onClick={() => act(() => { resendInvite(member); })} className={cn(item, "text-[#17151F] hover:bg-[#F5F3FA]")}><Send className="w-4 h-4 text-[#6B6680]" />Send invite again</button>
            : <button role="menuitem" onClick={() => act(onReset)} className={cn(item, "text-[#17151F] hover:bg-[#F5F3FA]")}><KeyRound className="w-4 h-4 text-[#6B6680]" />{member.login?.shared ? "Send reset link" : "Reset password"}</button>)}
          <button role="menuitem" onClick={() => act(onToggle)} className={cn(item, "hover:bg-[#F5F3FA]", member.isActive ? "text-[#823072]" : "text-[#1F8A5B]")}>
            {member.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            {member.isActive ? "Deactivate" : "Activate"}
          </button>
          {isOwner && <>
            <div className="my-1 border-t border-[#EEEBF4]" />
            <button role="menuitem" onClick={() => act(onDelete)} className={cn(item, "text-[#C2304F] hover:bg-[#FDECEF]")}><Trash2 className="w-4 h-4" />Remove</button>
          </>}
        </div>,
        document.body,
      )}
    </>
  );
}

// ─── Member row (Apple style) ──────────────────────────────────────────────────
function rateLine(m: Member, customRoles: string[]) {
  const parts: string[] = [];
  if (m.payRateType === "monthly" && m.payRate) parts.push(`Salary ${formatCurrency(Number(m.payRate))}/month`);
  const rates = (m.roleRates ?? []).filter(r => (r.rate || r.withSetup) && !r.workType);
  for (const r of rates.slice(0, 2)) {
    const lbl = roleConfig(r.roleId, customRoles).label;
    const unit = unitLabel(r.roleId, r.rateType, r.label).toLowerCase();
    parts.push(r.withSetup
      ? `${lbl} ${formatCurrency(Number(r.withSetup))} with setup${r.rate ? ` (${formatCurrency(Number(r.rate))} work only)` : ""} ${unit}`
      : `${lbl} ${formatCurrency(Number(r.rate))} ${unit}`);
  }
  const more = (m.roleRates ?? []).filter(r => r.rate || r.withSetup).length - Math.min(rates.length, 2);
  if (more > 0) parts.push(`+${more} more`);
  if (!parts.length && m.payRate) parts.push(`${formatCurrency(Number(m.payRate))}/${m.payRateType === "per_day" ? "day" : "program"}`);
  return parts.length ? parts.join(" · ") : null;
}

function MemberRow({ m, customRoles, onView, onEdit, onReset, onToggle, onDelete }: {
  m: Member; customRoles: string[];
  onView: () => void; onEdit: () => void; onReset: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const main = roleConfig(m.memberRoles[0] ?? "assistant", customRoles);
  const rates = rateLine(m, customRoles);
  const wa = m.phone ? `https://wa.me/${waNumber(m.phone)}` : null;
  return (
    <div role="button" tabIndex={0} onClick={onView} onKeyDown={e => { if (e.key === "Enter") onView(); }}
      className={cn("flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[72px] cursor-pointer hover:bg-[#F7F5FB] transition-colors focus:outline-none focus-visible:bg-[#F7F5FB]", !m.isActive && "opacity-60")}>
      {m.avatarUrl ? <Avatar name={m.firstName} src={m.avatarUrl} size={40} /> : <Tile icon={main.icon} color={main.tile} size={40} />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#17151F] truncate flex items-center gap-2">
          {m.firstName} {m.lastName ?? ""}
          {m.memberType === "freelancer" && <span className="text-[11px] font-bold text-[#9E3A8C] bg-[#FBF2FA] px-1.5 py-0.5 rounded-full">Freelancer</span>}
          {m.role === "manager" && <span className="text-[11px] font-bold text-[#5B3FD0] bg-[#EEE8FD] px-1.5 py-0.5 rounded-full">Manager</span>}
          {m.rateRequestWaiting && <span className="text-[11px] font-bold text-[#823072] bg-[#F7E9F4] px-1.5 py-0.5 rounded-full whitespace-nowrap">Rate change asked</span>}
          {offOn(m.daysOff, [todayStr()]).length > 0 && <span className="text-[11px] font-bold text-[#7A4800] bg-[#FFF3E0] px-1.5 py-0.5 rounded-full whitespace-nowrap">Off today</span>}
          {!m.isActive && <span className="text-[11px] font-bold text-[#6B6680] bg-[#EEEDF2] px-1.5 py-0.5 rounded-full">Inactive</span>}
          {m.login?.invitePending && <span className="text-[11px] font-bold text-[#9A5B00] bg-[#FFF3E0] px-1.5 py-0.5 rounded-full whitespace-nowrap">{m.login.inviteExpired ? "Invite expired" : "Invite sent"}</span>}
        </p>
        <p className="text-xs text-[#6B6680] truncate mt-0.5">
          {m.memberRoles.map(r => roleConfig(r, customRoles).label).join(", ") || "No role yet"}
          <span className="text-[#9893A8]"> · {m.memberId}</span>
        </p>
        {rates && <p className="text-xs font-semibold text-[#1F8A5B] truncate mt-0.5">{rates}</p>}
      </div>
      {m.phone && <span className="hidden lg:block text-xs text-[#6B6680] tabular-nums flex-shrink-0">{m.phone}</span>}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} aria-label={`WhatsApp ${m.firstName}`}
          className="w-9 h-9 rounded-full flex items-center justify-center text-[#1F8A5B] hover:bg-[#E9F5EF] flex-shrink-0">
          <MessageCircle className="w-4 h-4" />
        </a>
      )}
      <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} className="flex-shrink-0">
        <ActionMenu member={m} onEdit={onEdit} onReset={onReset} onToggle={onToggle} onDelete={onDelete} />
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const waitingCosts = useWaitingCosts();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [resetTarget, setResetTarget] = useState<Member | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const router = useRouter();
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, crRes] = await Promise.all([
        apiFetch(`${API}/team`),
        apiFetch(`${API}/team/custom-roles`),
      ]);
      if (mRes.ok) setMembers(await mRes.json());
      if (crRes.ok) setCustomRoles(await crRes.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  async function toggleStatus(m: Member) {
    await apiFetch(`${API}/team/${m.id}/toggle-status`, { method: "PATCH", headers: { "Content-Type": "application/json" } }).catch(() => {});
    fetchMembers();
  }

  function openAdd() { setEditTarget(null); setDrawer(true); }
  function openEdit(m: Member) { setEditTarget(m); setDrawer(true); }

  const allRoles = [
    ...DEFAULT_ROLES,
    ...customRoles.map(cr => ({ id: cr, label: cr, icon: Tag, color: "bg-[#EEE8FD] text-[#5B3FD0]" })),
  ];
  const roleStats = allRoles.map(r => ({
    ...r,
    count: members.filter(m => m.memberRoles.includes(r.id) && m.isActive).length,
  }));

  const filteredMembers = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      `${m.firstName} ${m.lastName ?? ""}`.toLowerCase().includes(q) ||
      (m.username ?? "").toLowerCase().includes(q) ||
      (m.phone ?? "").includes(q) ||
      m.memberId.toLowerCase().includes(q);
    const matchRole = roleFilter === "all" || m.memberRoles.includes(roleFilter);
    return matchSearch && matchRole;
  });

  return (
    <div>
      <PageHeader icon={HeaderIcon} color="blue" title="Team" sub={<>{members.filter(m => m.isActive).length} active · {members.length} total</>}>
        {members.length > 0 && <SearchField className="flex-1 min-w-0 sm:w-64 sm:flex-none" value={search} onChange={setSearch} placeholder="Search name, username, phone" />}
        <MainButton icon={Plus} onClick={openAdd}>Add member</MainButton>
      </PageHeader>
      <WaitingCostsLink n={waitingCosts} />

      {members.length > 0 && (
        <Chips label="Filter by role" value={roleFilter} onChange={setRoleFilter}
          options={[{ value: "all", label: "Everyone", count: members.length },
            ...roleStats.filter(r => r.count > 0).map(r => ({ value: r.id, label: r.label, count: r.count }))]} />
      )}

      {loading ? (
        <RowsSkeleton n={6} />
      ) : members.length === 0 ? (
        <EmptyState icon={Shield} title="No team members yet" text="Add photographers, editors and cinematographers."
          action={<MainButton icon={Plus} onClick={openAdd}>Add member</MainButton>} />
      ) : filteredMembers.length === 0 ? (
        <EmptyState icon={Search} title="No one matches" text="Try another name or role."
          action={<button onClick={() => { setSearch(""); setRoleFilter("all"); }} className="text-sm font-semibold text-[#5B3FD0]">Clear filters</button>} />
      ) : (
        <Group>
          {filteredMembers.map(m => (
            <MemberRow key={m.id} m={m} customRoles={customRoles}
              onView={() => router.push(`/team/${m.id}`)}
              onEdit={() => openEdit(m)}
              onReset={() => setResetTarget(m)}
              onToggle={() => toggleStatus(m)}
              onDelete={() => setDeleteTarget(m)} />
          ))}
        </Group>
      )}

      <MemberDrawer open={drawer} onClose={() => { setDrawer(false); setEditTarget(null); }} onSaved={fetchMembers} editing={editTarget} customRoles={customRoles} onCustomRolesChange={setCustomRoles} />
      <ResetPassDialog member={resetTarget} onClose={() => setResetTarget(null)} onDone={fetchMembers} />
      <DeleteDialog member={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={fetchMembers} />
    </div>
  );
}
