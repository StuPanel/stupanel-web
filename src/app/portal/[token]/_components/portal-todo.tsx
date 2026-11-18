"use client";

/**
 * What the client needs to do, one thing at a time: the most important one big, with one button;
 * anything else waits in a short list under it. One tap takes them to the right place.
 */
import { CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Todo, TodoKind } from "./portal-data";

const ACTION: Record<TodoKind, string> = {
  pay: "See how to pay", photos: "Choose photos", music: "Choose songs", sign: "Read and sign", quote: "Look at it",
};
export const CARD = "bg-white rounded-[22px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_10px_28px_-20px_rgba(22,18,40,.28)]";

export function NextStep({ todos, onTodo, showProgram = true }: { todos: Todo[]; onTodo: (t: Todo) => void; showProgram?: boolean }) {
  const [first, ...rest] = todos;
  if (!first) return null;
  return (
    <section aria-labelledby="next-step" className={cn(CARD, "p-4 sm:p-5")}>
      <p id="next-step" className="text-[12.5px] font-semibold text-[#6B6680]">Your next step</p>
      <p className="mt-1 text-[18px] sm:text-[19px] font-extrabold tracking-[-0.01em] leading-snug text-[#17151F]">{first.title}</p>
      {showProgram && first.sub && <p className={cn("mt-0.5 text-[13px]", first.soon ? "text-[#B42347] font-semibold" : "text-[#6B6680]")}>{first.sub}</p>}
      <button type="button" onClick={() => onTodo(first)}
        className="mt-4 w-full sm:w-auto sm:px-6 h-12 rounded-2xl bg-[#17151F] hover:bg-[#2A2733] text-white text-[14.5px] font-bold transition-colors">
        {ACTION[first.kind]}
      </button>
      {rest.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#F0EEF3]">
          <p className="text-[12px] font-semibold text-[#6B6680]">Also waiting · {rest.length}</p>
          <ul className="mt-1">
            {rest.map(t => (
              <li key={t.key}>
                <button type="button" onClick={() => onTodo(t)} className="w-full min-h-[48px] flex items-center gap-3 text-left group">
                  <span className="w-2 h-2 rounded-full bg-[#7D5CEF] flex-shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-semibold text-[#17151F] group-hover:text-[#5B3FD0]">{t.title}</span>
                    {showProgram && t.sub && <span className={cn("block text-[12.5px] truncate", t.soon ? "text-[#B42347]" : "text-[#6B6680]")}>{t.sub}</span>}
                  </span>
                  <ChevronRight className="w-4 h-4 text-[#9A95A8] flex-shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function AllDone() {
  return (
    <section className={cn(CARD, "px-4 sm:px-5 py-4 flex items-center gap-3")}>
      <span className="w-10 h-10 rounded-full bg-[#E7F5EE] flex items-center justify-center flex-shrink-0"><CheckCircle2 className="w-5 h-5 text-[#1F8A5B]" /></span>
      <div>
        <p className="text-[15px] font-bold text-[#17151F]">Nothing to do right now</p>
        <p className="text-[13px] text-[#6B6680]">When the studio needs something from you, it shows here.</p>
      </div>
    </section>
  );
}
