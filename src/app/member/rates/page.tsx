"use client";

/**
 * Member panel: my prices (set by the studio, read-only) and my own gear.
 * The member keeps the gear list (names); the studio sets the rent price of each item.
 */
import { useEffect, useState } from "react";
import { BadgeDollarSign, Edit3, Loader2, Package, Wallet } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { EmptyState, PageHeader, type TileColor } from "@/components/ui/apple";
import { FormDrawer } from "@/components/ui/form-kit";
import { Empty, List, Row, Section, linkBtn, softBtn } from "@/components/ui/profile-page";
import { SetupEditor, gearRents, setupToItems, type SetupItem } from "@/app/(app)/team/_components/rate-card";
import { Spinner } from "../_components/kit";
import { GearRow, RatePrice, rateSub, roleInfo, type MyRates } from "../_components/rates";
import { RateRequestSection } from "../_components/prefs";
import type { MemberPrefs } from "@/lib/member-prefs";

export default function MyRatesPage() {
  const [data, setData] = useState<MyRates | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<SetupItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<MemberPrefs | null>(null);

  useEffect(() => {
    apiFetch(`${API}/member/rates`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
    apiFetch(`${API}/member/prefs`).then(r => (r.ok ? r.json() : null)).then(d => { if (d?.rateRequests) setPrefs(d); }).catch(() => {});
  }, []);

  if (failed) return <EmptyState icon={BadgeDollarSign} title="Couldn't load your rates" text="Check your internet and refresh the page." />;
  if (!data) return <Spinner />;

  function openEditor() {
    setItems(setupToItems(data!.setup));
    setEditing(true);
  }

  async function save() {
    const clean = items.map(i => ({ ...i, name: i.name.trim() })).filter(i => i.name);
    if (!clean.length && data!.setup.length === 0) { setEditing(false); return; } // nothing to save
    setSaving(true);
    try {
      const r = await apiFetch(`${API}/member/setup`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: clean.map(i => ({ id: i.id, category: i.category, name: i.name })) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(Array.isArray(d?.message) ? d.message[0] : d?.message || "Couldn't save your gear", { error: true }); return; }
      setData(prev => (prev ? { ...prev, setup: d.setup ?? [] } : prev));
      setEditing(false);
      notify("Gear saved");
    } catch { notify("Couldn't save — check your internet", { error: true }); }
    finally { setSaving(false); }
  }

  const noPrices = !data.monthly && data.rates.length === 0;
  const waiting = data.setup.filter(g => gearRents(g).length === 0).length;

  return (
    <div>
      <PageHeader icon={BadgeDollarSign} color="green" title="My rates & gear" sub="What you get for each kind of work, and the gear you own" />

      <div className="lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
        <Section title="My prices" action={<span className="text-[12.5px] text-[#6B6680]">Set by the studio</span>}>
          {noPrices ? (
            <Empty icon={Wallet} title="No prices set yet" text="The studio hasn't set your prices. Ask the studio in Chat." />
          ) : (
            <List>
              {data.monthly > 0 && <Row icon={Wallet} color="green" title="Monthly salary" sub="Every month" right={<span className="text-[14.5px] font-bold text-[#17151F] tabular-nums">{formatCurrency(data.monthly)}</span>} />}
              {data.rates.map((r, i) => {
                const rc = roleInfo(r.roleId);
                return <Row key={`${r.roleId}-${r.rateType}-${r.workType ?? ""}-${i}`} icon={rc.icon} color={rc.tile as TileColor} title={rc.label} sub={rateSub(r, data.workTypes)} right={<RatePrice r={r} />} />;
              })}
            </List>
          )}
          {!noPrices && data.rates.some(r => r.withSetup != null && r.withSetup > 0) && (
            <p className="text-[12.5px] text-[#6B6680] px-1 mt-2">&quot;With setup&quot; is what you get when you work with your own gear. &quot;Work only&quot; is when the gear is someone else&apos;s.</p>
          )}
        </Section>

        <Section title={`My gear${data.setup.length ? ` · ${data.setup.length}` : ""}`}
          action={data.setup.length > 0 ? <button type="button" onClick={openEditor} className={linkBtn}><Edit3 className="w-3.5 h-3.5" />Edit</button> : undefined}>
          {data.setup.length === 0 ? (
            <Empty icon={Package} title="No gear added" text="Add your own camera, lens, light or drone, so the studio knows what you can bring.">
              <button type="button" onClick={openEditor} className={softBtn}><Package className="w-4 h-4" />Add my gear</button>
            </Empty>
          ) : (
            <List>{data.setup.map(g => <GearRow key={g.id} g={g} />)}</List>
          )}
          {data.setup.length > 0 && (
            <p className={cn("text-[12.5px] px-1 mt-2", waiting ? "text-[#7A4800]" : "text-[#6B6680]")}>
              {waiting ? `${waiting} item${waiting > 1 ? "s" : ""} ha${waiting > 1 ? "ve" : "s"} no rent yet — the studio sets the rent price.` : "The studio sets the rent price for each item."}
            </p>
          )}
        </Section>
      </div>

      {prefs && <RateRequestSection prefs={prefs} onChange={setPrefs} />}

      <FormDrawer open={editing} onClose={() => { if (!saving) setEditing(false); }} icon={Package} color="deep" title="My gear" sub="Names only — the studio sets the rent"
        footer={<>
          <button type="button" onClick={() => setEditing(false)} disabled={saving} className="h-12 px-6 rounded-full bg-[#F1EFF6] hover:bg-[#E9E6F0] text-[#17151F] text-[15px] font-semibold">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="flex-1 h-12 rounded-full bg-[#7D5CEF] hover:bg-[#6B4AE0] disabled:opacity-60 text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}Save my gear
          </button>
        </>}>
        <SetupEditor items={items} onChange={setItems} own />
      </FormDrawer>
    </div>
  );
}
