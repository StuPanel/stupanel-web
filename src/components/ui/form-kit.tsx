"use client";

/**
 * Apple-style form pieces for drawers (add client, add team member…).
 * A form is a stack of <FormGroup>s; each group is a white rounded card with
 * <Field> rows inside. Inputs sit on a soft lavender fill, no hard borders.
 */
import { useId, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_SHADOW, Tile, type TileColor } from "./apple";

export const inputCls =
  "w-full h-11 px-3.5 rounded-[12px] bg-[#F5F3FA] text-[15px] text-[#17151F] placeholder:text-[#A29DB3] " +
  "border border-transparent outline-none transition-colors focus:bg-white focus:border-[#7D5CEF] focus:ring-4 focus:ring-[#7D5CEF]/12";

/** Drawer page: lavender background, header with tile, sticky footer. */
export function FormDrawer({ open, onClose, icon, color, title, sub, children, footer }: {
  open: boolean; onClose: () => void;
  icon: React.ElementType; color: TileColor; title: string; sub?: React.ReactNode;
  children: React.ReactNode; footer: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="sp-backdrop z-40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="sp-drawer z-50 sm:max-w-[520px] flex flex-col bg-[#F5F3FA]">
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <Tile icon={icon} color={color} size={40} />
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#17151F] leading-tight">{title}</h2>
            {sub && <p className="text-[13px] text-[#6B6680] mt-0.5 truncate">{sub}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white hover:bg-[#EEEBF4] text-[#6B6680] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 pt-1 pb-6">{children}</div>
        <div className="px-4 sm:px-5 py-4 bg-white/80 backdrop-blur border-t border-[#EEEBF4] flex gap-3">{footer}</div>
      </div>
    </>
  );
}

export function FormGroup({ title, note, children, className }: {
  title?: React.ReactNode; note?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("mb-5", className)}>
      {title && <h3 className="px-1 mb-2 text-[13px] font-bold text-[#4A4658]">{title}</h3>}
      <div className={cn("bg-white rounded-[20px] divide-y divide-[#EEEBF4]", CARD_SHADOW)}>{children}</div>
      {note && <p className="px-1 mt-2 text-xs text-[#6B6680] leading-relaxed">{note}</p>}
    </section>
  );
}

/** One row: label (+hint) over the control. `children` may use the id passed to render. */
export function Field({ label, hint, required, children, className }: {
  label: React.ReactNode; hint?: React.ReactNode; required?: boolean; className?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn("px-4 py-3.5", className)}>
      <label htmlFor={id} className="block text-[13px] font-semibold text-[#4A4658] mb-1.5">
        {label}{required && <span className="text-[#C2304F]"> *</span>}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-[#6B6680] mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

/** A row with a label on the left and a switch on the right. */
export function SwitchRow({ label, hint, on, onChange }: {
  label: string; hint?: string; on: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-[#17151F]">{label}</p>
        {hint && <p className="text-xs text-[#6B6680] mt-0.5">{hint}</p>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
        className={cn("relative w-[51px] h-[31px] rounded-full transition-colors flex-shrink-0", on ? "bg-[#7D5CEF]" : "bg-[#E4E0EC]")}>
        <span className={cn("absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,.18)] transition-transform",
          on && "translate-x-[20px]")} />
      </button>
    </div>
  );
}

/** Pick one (or several) from a row of pills. */
export function PillPicker<T extends string>({ options, value, onChange, multi, label }: {
  options: { value: T; label: string; icon?: React.ElementType }[];
  value: T | T[]; onChange: (v: T) => void; multi?: boolean; label: string;
}) {
  const sel = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div role={multi ? "group" : "radiogroup"} aria-label={label} className="flex flex-wrap gap-2">
      {options.map(o => {
        const Icon = o.icon;
        const on = sel(o.value);
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            role={multi ? "checkbox" : "radio"} aria-checked={on}
            className={cn("inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold transition-all",
              on ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]")}>
            {Icon && <Icon className="w-3.5 h-3.5" />}{o.label}
          </button>
        );
      })}
    </div>
  );
}

/** "More details" — folded part of a form. */
export function MoreDetails({ title = "More details", sub, children, defaultOpen }: {
  title?: string; sub?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="mb-5">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className={cn("w-full flex items-center gap-3 px-4 py-3.5 bg-white rounded-[20px] text-left", CARD_SHADOW)}>
        <div className="flex-1">
          <p className="text-[15px] font-semibold text-[#17151F]">{title}</p>
          {sub && <p className="text-xs text-[#6B6680] mt-0.5">{sub}</p>}
        </div>
        <ChevronDown className={cn("w-4 h-4 text-[#6B6680] transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

/** Bangladesh-friendly phone digits for comparing: last 10 digits ("01712…" == "+8801712…"). */
export function phoneKey(p?: string | null) {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}
