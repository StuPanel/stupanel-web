"use client";

/**
 * Settings → Menu: the owner hides menu items, changes their order (inside a group and the groups
 * themselves) and picks the 3 middle phone buttons. Same for everyone in the studio.
 * Dashboard and Settings always stay, so nobody gets locked out.
 */
import { ArrowDown, ArrowUp, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tile } from "@/components/ui/apple";
import { askConfirm } from "@/components/feedback";
import { ALL_ITEMS, ALWAYS, DEFAULT_PHONE, arrange, switchedOff, type ArrangedGroup, type MenuChoice } from "@/lib/studio-menu";
import { Group, Row, Select, Switch, useSettings } from "../_ui";

const moveBtn = "w-9 h-9 rounded-full flex items-center justify-center text-[#6B6680] hover:bg-[#F5F3FA] hover:text-[#17151F] disabled:opacity-30 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B3FD0]";

function toChoice(groups: ArrangedGroup[], phone: string[]): MenuChoice {
  return {
    groups: groups.map(g => ({ id: g.id, items: g.items.map(i => i.id) })),
    hidden: groups.flatMap(g => g.items.filter(i => i.hidden).map(i => i.id)),
    phone,
  };
}

export function MenuPane() {
  const { studio, patchStudio } = useSettings();
  if (!studio) return (
    <div className="bg-white rounded-[20px] p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#7D5CEF]" /></div>
  );
  const choice = studio.menu ?? { groups: [], hidden: [], phone: [] };
  const groups = arrange(choice);
  const phone = choice.phone?.length === 3 ? choice.phone : DEFAULT_PHONE;
  const save = (g: ArrangedGroup[], p = phone) => patchStudio("menu", toChoice(g, p));
  const custom = choice.groups.length > 0 || choice.hidden.length > 0 || choice.phone.length > 0;

  const moveGroup = (gi: number, d: -1 | 1) => {
    const next = [...groups];
    [next[gi], next[gi + d]] = [next[gi + d], next[gi]];
    save(next);
  };
  const moveItem = (gi: number, ii: number, d: -1 | 1) => {
    const next = groups.map(g => ({ ...g, items: [...g.items] }));
    const items = next[gi].items;
    [items[ii], items[ii + d]] = [items[ii + d], items[ii]];
    save(next);
  };
  const setHidden = (gi: number, ii: number, hidden: boolean) => {
    const next = groups.map(g => ({ ...g, items: [...g.items] }));
    next[gi].items[ii] = { ...next[gi].items[ii], hidden };
    save(next);
  };
  const reset = async () => {
    if (!(await askConfirm({ title: "Go back to StuPanel's menu?", message: "Every hidden item comes back and the order and phone buttons go back to how StuPanel set them.", confirmLabel: "Reset" }))) return;
    patchStudio("menu", { groups: [], hidden: [], phone: [] });
  };

  const phoneOptions = ALL_ITEMS.filter(i => !ALWAYS.includes(i.id)).map(i => ({ value: i.id, label: i.phoneName && i.phoneName !== i.name ? `${i.phoneName} (${i.name})` : i.name }));
  const setPhone = (slot: number, id: string) => {
    const next = [...phone];
    const other = next.indexOf(id);
    if (other >= 0) next[other] = next[slot]; // picking one that's already there swaps the two
    next[slot] = id;
    save(groups, next);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <p className="flex-1 min-w-[220px] text-[13.5px] text-[#4A4658] leading-relaxed">
          Choose what the side menu shows and in what order. It changes the menu for everyone in your studio. A hidden page keeps its data and still opens from search.
        </p>
        <button type="button" onClick={reset} disabled={!custom}
          className="h-10 px-4 rounded-full bg-white shadow-[0_1px_2px_rgba(22,18,40,.06)] hover:bg-[#F5F3FA] text-[13px] font-semibold text-[#4A4658] inline-flex items-center gap-2 disabled:opacity-45">
          <RotateCcw className="w-4 h-4" />Reset to StuPanel&apos;s menu
        </button>
      </div>

      <div id="set-menu-order" className="scroll-mt-28">
        {groups.map((g, gi) => (
          <section key={g.id} className="mb-5">
            <div className="flex items-center gap-1 px-1 mb-2">
              <h2 className="flex-1 text-[13px] font-bold text-[#4A4658]">{g.title || "Top of the menu"}</h2>
              <button type="button" className={moveBtn} disabled={gi === 0} onClick={() => moveGroup(gi, -1)} aria-label={`Move ${g.title || "top group"} up`}><ArrowUp className="w-4 h-4" /></button>
              <button type="button" className={moveBtn} disabled={gi === groups.length - 1} onClick={() => moveGroup(gi, 1)} aria-label={`Move ${g.title || "top group"} down`}><ArrowDown className="w-4 h-4" /></button>
            </div>
            <div className="sp-card bg-white rounded-[20px] shadow-[0_1px_2px_rgba(22,18,40,.05),0_8px_24px_rgba(22,18,40,.05)] divide-y divide-[#EEEBF4] overflow-hidden">
              {g.items.map((it, ii) => {
                const locked = ALWAYS.includes(it.id);
                const off = switchedOff(it.href, studio.features);
                return (
                  <div key={it.id} className={cn("flex items-center gap-2 sm:gap-3 px-3 sm:px-4 min-h-[56px]", it.hidden && "bg-[#FAF9FC]")}>
                    <Tile icon={it.icon} color={it.color} size={28} className={cn(it.hidden && "opacity-45")} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-semibold truncate", it.hidden ? "text-[#8A8599]" : "text-[#17151F]")}>{it.name}</p>
                      {locked && <p className="text-xs text-[#6B6680]">Always shown</p>}
                      {!locked && off && <p className="text-xs text-[#6B6680]">Turned off in its own settings</p>}
                      {!locked && !off && it.hidden && <p className="text-xs text-[#6B6680]">Hidden from the menu</p>}
                    </div>
                    <button type="button" className={moveBtn} disabled={ii === 0} onClick={() => moveItem(gi, ii, -1)} aria-label={`Move ${it.name} up`}><ArrowUp className="w-4 h-4" /></button>
                    <button type="button" className={moveBtn} disabled={ii === g.items.length - 1} onClick={() => moveItem(gi, ii, 1)} aria-label={`Move ${it.name} down`}><ArrowDown className="w-4 h-4" /></button>
                    <Switch label={`Show ${it.name} in the menu`} on={!it.hidden} disabled={locked} onChange={v => setHidden(gi, ii, !v)} />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        <p className="px-1 -mt-2 mb-7 text-xs text-[#6B6680] leading-relaxed">Settings and Support stay at the bottom of the menu.</p>
      </div>

      <Group title="Phone bottom bar" note="Home and More are always there. More opens the whole menu.">
        {[0, 1, 2].map(slot => (
          <Row key={slot} id={slot === 0 ? "menu-phone" : undefined} label={`Button ${slot + 2}`}>
            <Select<string> label={`Phone button ${slot + 2}`} value={phone[slot]} options={phoneOptions} onChange={v => setPhone(slot, v)} />
          </Row>
        ))}
      </Group>
    </>
  );
}
