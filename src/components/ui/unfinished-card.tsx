"use client";

/** "Unfinished quote · Rina" — a draft this person kept, with Delete and Continue (same as Programs). */
import { useCallback, useEffect, useState } from "react";
import { FilePen } from "lucide-react";
import { Tile } from "@/components/ui/apple";
import { askConfirm, notify } from "@/components/feedback";
import { deleteDraft, loadDraft, type DraftKind } from "@/lib/form-draft";

export function useUnfinished(kind: DraftKind, nameOf: (d: Record<string, unknown>) => string, watch: unknown) {
  const [kept, setKept] = useState<{ name: string; when: string } | null>(null);
  const load = useCallback(() => {
    loadDraft(kind).then(d => setKept(d ? { name: nameOf(d.data) || "No name yet", when: d.when } : null)).catch(() => {});
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  // On arrival, and each time the form closes (watch = the form is open).
  useEffect(() => { if (!watch) { const t = setTimeout(load, 0); return () => clearTimeout(t); } }, [watch, load]);
  return { kept, clear: () => setKept(null) };
}

export function UnfinishedCard({ kind, what, kept, onContinue, onDeleted }: {
  kind: DraftKind; what: string; kept: { name: string; when: string } | null; onContinue: () => void; onDeleted: () => void;
}) {
  if (!kept) return null;
  async function remove() {
    if (!(await askConfirm({ title: `Delete this unfinished ${what}?`, message: "What you filled in will be gone.", confirmLabel: "Delete", danger: true }))) return;
    if (await deleteDraft(kind)) { onDeleted(); notify(`Unfinished ${what} deleted`); }
    else notify("Couldn't delete it. Please try again.", { error: true });
  }
  return (
    <div className="sp-card rounded-[20px] mb-4 px-4 py-3.5 flex flex-wrap items-center gap-3">
      <Tile icon={FilePen} color="orchid" size={36} />
      <div className="flex-1 min-w-[160px]">
        <p className="text-[14px] font-bold text-[#17151F] truncate">Unfinished {what} · {kept.name}</p>
        <p className="text-[12.5px] text-[#6B6680]">{kept.when ? `Saved ${kept.when}. ` : ""}Not a {what} yet — finish it to add it.</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={remove} className="h-10 px-4 rounded-full bg-[#F1EFF6] text-[14px] font-semibold text-[#4A4658]">Delete</button>
        <button type="button" onClick={onContinue} className="h-10 px-5 rounded-full bg-[#7D5CEF] text-white text-[14px] font-semibold">Continue</button>
      </div>
    </div>
  );
}
