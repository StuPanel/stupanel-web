"use client";

/** "What you need to do" — one tap takes the client to the right place. */
import { CheckCircle2, ChevronRight, CreditCard, FileSignature, FileText, Images, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_SHADOW, Tile } from "@/components/ui/apple";
import type { Todo, TodoKind } from "./portal-data";

const LOOK: Record<TodoKind, { icon: React.ElementType; color: "ink" | "red" | "violet" | "orchid" | "deep" }> = {
  sign: { icon: FileSignature, color: "ink" },
  pay: { icon: CreditCard, color: "red" },
  photos: { icon: Images, color: "violet" },
  music: { icon: Music2, color: "orchid" },
  quote: { icon: FileText, color: "deep" },
};

export function TodoList({ todos, onTodo, title = "To do" }: { todos: Todo[]; onTodo: (t: Todo) => void; title?: string }) {
  return (
    <section className={cn("bg-white rounded-[22px] overflow-hidden", CARD_SHADOW)} aria-label={title}>
      <div className="px-4 sm:px-5 pt-4 pb-2 flex items-center gap-2">
        <h2 className="flex-1 text-[15px] font-extrabold tracking-[-0.01em] text-[#17151F]">{title}</h2>
        <span className="h-6 min-w-6 px-2 rounded-full bg-[#FFF3E0] text-[#9A5B00] text-[12px] font-bold inline-flex items-center justify-center">{todos.length}</span>
      </div>
      <ul className="divide-y divide-[#EEEBF4] border-t border-[#F2EFF8]">
        {todos.map(t => {
          const l = LOOK[t.kind];
          return (
            <li key={t.key}>
              <button type="button" onClick={() => onTodo(t)} className="w-full px-4 sm:px-5 py-3 min-h-[64px] flex items-center gap-3 text-left hover:bg-[#F7F5FB] transition-colors">
                <Tile icon={l.icon} color={l.color} size={38} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14.5px] font-semibold text-[#17151F]">{t.title}</span>
                  <span className={cn("block text-[12.5px] truncate", t.soon ? "text-[#C2304F] font-semibold" : "text-[#6B6680]")}>{t.sub}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-[#B5B0C4] flex-shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AllDone() {
  return (
    <section className={cn("bg-white rounded-[22px] px-4 sm:px-5 py-4 flex items-center gap-3", CARD_SHADOW)}>
      <span className="w-10 h-10 rounded-full bg-[#E7F5EE] flex items-center justify-center flex-shrink-0"><CheckCircle2 className="w-5 h-5 text-[#1F8A5B]" /></span>
      <div>
        <p className="text-[15px] font-bold text-[#17151F]">Nothing to do right now</p>
        <p className="text-[13px] text-[#6B6680]">We&apos;ll show it here when the studio needs something from you.</p>
      </div>
    </section>
  );
}
