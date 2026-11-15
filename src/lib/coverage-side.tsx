/**
 * Whose side of a wedding the studio covers: the bride's, the groom's or both.
 * A program has one (or none); a day of the program can have its own.
 */
import { cn } from "@/lib/utils";

export type Side = "bride" | "groom" | "both";

export const SIDES: { id: Side; label: string; short: string }[] = [
  { id: "bride", label: "Bride's side", short: "Bride" },
  { id: "groom", label: "Groom's side", short: "Groom" },
  { id: "both", label: "Both sides", short: "Both" },
];

/** A stored value → a side we know, or null. */
export function cleanSide(v: unknown): Side | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return s === "bride" || s === "groom" || s === "both" ? s : null;
}

/** "Bride's side" / "Groom's side" / "Both sides"; "" when not said. */
export const sideLabel = (v: unknown) => SIDES.find(s => s.id === cleanSide(v))?.label ?? "";

/** The side of one day: its own if it has one, else the program's. */
export const daySide = (day: { side?: unknown } | null | undefined, programSide?: unknown) => cleanSide(day?.side) ?? cleanSide(programSide);

/** Program types about a couple ask "Whose side?" unless the studio turned it off (same rule as the server). */
export function typeHasSides(t?: { id?: string; name?: string; sides?: boolean } | null): boolean {
  if (!t) return false;
  if (typeof t.sides === "boolean") return t.sides;
  return /wedding|engagement|biye|bibaho|nikah|akd|holud|haldi|mehe?ndi|reception|walima|bou.?bhat|বিয়ে|বিবাহ/.test(`${t.id ?? ""} ${t.name ?? ""}`.toLowerCase());
}

// Colour is not the only sign — the words are always there.
const TONE: Record<Side, string> = {
  bride: "bg-[#FCE9F1] text-[#9B2257]",
  groom: "bg-[#E6F0FB] text-[#1F5C99]",
  both: "bg-[#EEE8FD] text-[#5B3FD0]",
};
const TONE_DARK: Record<Side, string> = {
  bride: "bg-[#9B2257]/30 text-[#FFC2DA]",
  groom: "bg-[#1F5C99]/35 text-[#BBD9FF]",
  both: "bg-[#5B3FD0]/35 text-[#D5C8FF]",
};

/** A small pill: "Bride's side". Renders nothing when the side is not set. */
export function SideBadge({ side, short, dark, className }: { side: unknown; short?: boolean; dark?: boolean; className?: string }) {
  const s = cleanSide(side);
  if (!s) return null;
  const it = SIDES.find(x => x.id === s)!;
  return (
    <span className={cn("inline-flex items-center h-[22px] px-2 rounded-full text-[11.5px] font-bold whitespace-nowrap", (dark ? TONE_DARK : TONE)[s], className)}
      title={`Coverage: ${it.label}`}>
      {short ? it.short : it.label}
    </span>
  );
}

/** Three buttons to choose the side; pressing the chosen one again clears it. */
export function SidePicker({ value, onChange, label = "Whose side?", size = "md" }: { value: Side | null; onChange: (s: Side | null) => void; label?: string; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {SIDES.map(s => {
        const on = value === s.id;
        return (
          <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(on ? null : s.id)}
            className={cn("rounded-full font-semibold transition-colors", size === "sm" ? "h-8 px-3 text-[12.5px]" : "h-9 px-3.5 text-[13px]",
              on ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]")}>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
