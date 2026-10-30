"use client";

import { useEffect, useState } from "react";
import { Copy, Files, RefreshCw, SkipForward } from "lucide-react";
import type { DuplicateCheck, DuplicateChoice } from "@/lib/drive-uploader";

/**
 * Shown before a Drive upload when some files are already in the target
 * folder — like Google Drive's own "file already exists" box.
 * Skip (default) uploads only the new files.
 */
export function UploadDuplicateDialog({ check, onChoose }: {
  check: DuplicateCheck;
  onChoose: (choice: DuplicateChoice | null) => void;
}) {
  const [choice, setChoice] = useState<DuplicateChoice>("skip");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onChoose(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onChoose]);

  const same = check.same.size;
  const nameOnly = check.nameOnly.size;
  const fresh = check.fresh.length;
  const clashing = same + nameOnly;
  const total = fresh + clashing;
  const names = [...check.same.keys(), ...check.nameOnly.keys()].map(f => f.name);
  const folders = [...new Set([...check.same.keys(), ...check.nameOnly.keys()].map(f => check.folderOf.get(f) || "Other Files"))];
  const where = folders.length === 1 ? folders[0] : `${folders.length} folders`;
  const skipCount = fresh + nameOnly;

  const options: { key: DuplicateChoice; icon: typeof SkipForward; title: string; text: string }[] = [
    {
      key: "skip", icon: SkipForward, title: "Skip files that are already there",
      text: skipCount === 0
        ? "Nothing new to upload — every file is already there."
        : `Upload only the ${skipCount} new file${skipCount > 1 ? "s" : ""}.`,
    },
    {
      key: "keep", icon: Copy, title: "Keep both",
      text: `Upload all ${total}. Copies get a number, like ${numbered(names[0] ?? "photo.jpg")}.`,
    },
    {
      key: "replace", icon: RefreshCw, title: "Replace",
      text: `Upload all ${total}. The old copies go to Google Drive's trash.`,
    },
  ];

  return (
    <>
      <div className="sp-backdrop z-[90]" onClick={() => onChoose(null)} />
      <div className="fixed inset-0 z-[91] flex items-center justify-center p-4 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-labelledby="dup-title"
          className="sp-modal pointer-events-auto w-full max-w-md p-6">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-[#EEE8FD] flex items-center justify-center flex-shrink-0">
              <Files className="w-5 h-5 text-[#5B3FD0]" />
            </div>
            <div className="min-w-0">
              <h2 id="dup-title" className="font-bold text-[#17151F] text-lg leading-tight">
                {clashing} of {total} file{total > 1 ? "s are" : " is"} already there
              </h2>
              <p className="text-sm text-[#6B6680] mt-1 truncate">
                In <span className="font-semibold text-[#17151F]">{where}</span>
                {" · "}{names.slice(0, 2).join(", ")}{names.length > 2 ? ` +${names.length - 2} more` : ""}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2" role="radiogroup">
            {options.map(o => {
              const active = choice === o.key;
              const Icon = o.icon;
              return (
                <button key={o.key} role="radio" aria-checked={active} onClick={() => setChoice(o.key)}
                  className={`w-full text-left rounded-2xl border p-3 flex items-start gap-3 transition-colors ${active ? "border-[#7D5CEF] bg-[#F7F4FE]" : "border-[#E3DFEC] hover:bg-[#F5F3FA]"}`}>
                  <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 ${active ? "border-[#7D5CEF] bg-[#7D5CEF] shadow-[inset_0_0_0_3px_white]" : "border-[#CFC8DC]"}`} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-[#17151F]">
                      <Icon className="w-3.5 h-3.5 text-[#5B3FD0]" /> {o.title}
                      {o.key === "skip" && <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-[#5B3FD0] bg-[#EEE8FD] px-1.5 py-0.5 rounded-full">Recommended</span>}
                    </span>
                    <span className="block text-xs text-[#6B6680] mt-0.5">{o.text}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {nameOnly > 0 && choice === "skip" && (
            <p className="mt-3 text-xs text-[#6B6680]">
              {nameOnly} file{nameOnly > 1 ? "s have" : " has"} the same name but a different size — kept as a numbered copy so nothing is lost.
            </p>
          )}

          <div className="flex gap-3 mt-6">
            <button onClick={() => onChoose(null)}
              className="flex-1 h-11 rounded-full bg-[#F5F3FA] text-[#17151F] text-sm font-semibold hover:bg-[#EEEBF4] transition-colors">
              Cancel
            </button>
            <button autoFocus onClick={() => onChoose(choice)}
              className="flex-1 h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6143CF] text-white text-sm font-semibold transition-colors">
              {choice === "skip" && skipCount === 0 ? "OK" : "Upload"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function numbered(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? `${name.slice(0, dot)} (1)${name.slice(dot)}` : `${name} (1)`;
}
