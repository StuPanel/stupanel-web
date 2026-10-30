"use client";

/**
 * Apple-style profile drawer pieces (client profile, team member profile).
 * Lavender page, a white identity card on top with round action buttons,
 * small stat tiles, then grouped white cards.
 */
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_SHADOW, Tile, type TileColor } from "./apple";

export function ProfileShell({ open, onClose, label, children }: {
  open: boolean; onClose: () => void; label: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={label} className="sp-drawer z-50 sm:max-w-[560px] flex flex-col bg-[#F5F3FA]">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <p className="text-[13px] font-bold text-[#6B6680]">{label}</p>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-[#EEEBF4] text-[#6B6680] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-8">{children}</div>
      </div>
    </>
  );
}

/** Big round initial avatar. */
export function Avatar({ name, color = "#7D5CEF", size = 64 }: { name: string; color?: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const ini = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
  return (
    <div aria-hidden className="rounded-full flex items-center justify-center text-white font-extrabold flex-shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}>{ini}</div>
  );
}

/** Identity card: avatar, name, small line, chips, and a row of round actions. */
export function IdentityCard({ avatar, name, sub, chips, actions }: {
  avatar: React.ReactNode; name: React.ReactNode; sub?: React.ReactNode; chips?: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <div className={cn("bg-white rounded-[24px] p-5 mb-4", CARD_SHADOW)}>
      <div className="flex items-center gap-4">
        {avatar}
        <div className="flex-1 min-w-0">
          <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight truncate">{name}</h2>
          {sub && <p className="text-[13px] text-[#6B6680] mt-0.5 truncate">{sub}</p>}
          {chips && <div className="flex flex-wrap gap-1.5 mt-2">{chips}</div>}
        </div>
      </div>
      {actions && <div className="grid grid-cols-4 gap-2 mt-5">{actions}</div>}
    </div>
  );
}

/** Round action under the identity: tile-like icon with a label. */
export function ActionButton({ icon: Icon, label, onClick, href, tone = "violet", disabled }: {
  icon: React.ElementType; label: string; onClick?: () => void; href?: string;
  tone?: "violet" | "green" | "blue" | "ink" | "red"; disabled?: boolean;
}) {
  const tones = {
    violet: "bg-[#EEE8FD] text-[#5B3FD0]", green: "bg-[#E9F5EF] text-[#1F8A5B]", blue: "bg-[#E6F0FB] text-[#1F5C99]",
    ink: "bg-[#EEEDF2] text-[#17151F]", red: "bg-[#FDECEF] text-[#C2304F]",
  };
  const inner = (
    <>
      <span className={cn("w-11 h-11 rounded-full flex items-center justify-center", tones[tone])}><Icon className="w-[18px] h-[18px]" /></span>
      <span className="text-xs font-semibold text-[#4A4658]">{label}</span>
    </>
  );
  const cls = cn("flex flex-col items-center gap-1.5 py-1 rounded-[14px] transition-opacity", disabled ? "opacity-40 pointer-events-none" : "hover:opacity-80");
  return href
    ? <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={cls} aria-label={label}>{inner}</a>
    : <button type="button" onClick={onClick} className={cls} disabled={disabled} aria-label={label}>{inner}</button>;
}

/** Small stat tile (2 per row on phones, 4 on wider drawers). */
export function MiniStat({ icon, color, label, value, sub, tone }: {
  icon: React.ElementType; color: TileColor; label: string; value: React.ReactNode; sub?: React.ReactNode;
  tone?: "red" | "green";
}) {
  return (
    <div className={cn("bg-white rounded-[20px] p-4", CARD_SHADOW)}>
      <div className="flex items-center gap-2">
        <Tile icon={icon} color={color} size={26} />
        <p className="text-[12px] font-semibold text-[#4A4658] truncate">{label}</p>
      </div>
      <p className={cn("mt-2.5 text-[20px] font-extrabold tracking-[-0.02em] tabular-nums truncate",
        tone === "red" ? "text-[#C2304F]" : tone === "green" ? "text-[#1F8A5B]" : "text-[#17151F]")}>{value}</p>
      {sub && <p className="text-xs text-[#6B6680] mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

/** One line in a grouped card: left text block + right side. */
export function InfoRow({ left, sub, right, onClick }: {
  left: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium text-[#17151F] truncate">{left}</div>
        {sub && <div className="text-xs text-[#6B6680] mt-0.5 truncate">{sub}</div>}
      </div>
      {right && <div className="text-right flex-shrink-0">{right}</div>}
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#F7F5FB] transition-colors">{inner}</button>
    : <div className="flex items-center gap-3 px-4 py-3.5">{inner}</div>;
}

export function waLink(phone?: string | null) {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return undefined;
  return `https://wa.me/${d.startsWith("0") ? "88" + d : d}`;
}
