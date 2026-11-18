"use client";

/** Settings → Payments: the numbers studios pay to (plan payments and Face Search credits). */
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { API_URL as API } from "@/lib/api";
import { Msg, Page, Panel } from "../../_components/staff-kit";

function authH() { return { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` }; }

const NUMBERS = [
  { label: "bKash", key: "billing.bkash_number" },
  { label: "Nagad", key: "billing.nagad_number" },
  { label: "Rocket", key: "billing.rocket_number" },
];

export default function PaymentSettingsPage() {
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  useEffect(() => {
    fetch(`${API}/admin/settings`, { headers: authH() }).then(r => (r.ok ? r.json() : [])).then((all: { key: string; value: string }[]) => {
      const out: Record<string, string> = {};
      for (const n of NUMBERS) out[n.key] = (Array.isArray(all) ? all : []).find(s => s.key === n.key)?.value ?? "";
      setValues(out);
    }).catch(() => setValues({}));
  }, []);

  async function save() {
    if (!values) return;
    setSaving(true); setMsg({});
    try {
      for (const n of NUMBERS) {
        const r = await fetch(`${API}/admin/settings`, {
          method: "POST", headers: authH(),
          body: JSON.stringify({ key: n.key, value: (values[n.key] ?? "").trim(), category: "billing", description: `${n.label} personal number shown on the studio billing page (leave empty to hide)` }),
        });
        if (!r.ok) throw new Error("Couldn't save. Please try again.");
      }
      setMsg({ ok: "Payment numbers saved" });
    } catch (e) { setMsg({ error: e instanceof Error ? e.message : "Couldn't save" }); }
    setSaving(false);
  }

  return (
    <Page title="Payments" sub="The numbers studios send money to, for plans and Face Search credits">
      <Panel title="Payment numbers" sub="Shown to studios when they pay. Leave a number empty to hide that method.">
        {!values ? <Loader2 className="w-5 h-5 animate-spin text-indigo-400" /> : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {NUMBERS.map(n => (
                <label key={n.key} className="block">
                  <span className="text-xs font-medium text-slate-300">{n.label} number</span>
                  <input value={values[n.key] ?? ""} onChange={e => setValues(v => ({ ...(v ?? {}), [n.key]: e.target.value }))}
                    placeholder="01XXXXXXXXX" inputMode="tel"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
                </label>
              ))}
            </div>
            <button onClick={save} disabled={saving}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save numbers
            </button>
            <div className="mt-3"><Msg {...msg} /></div>
          </>
        )}
      </Panel>
    </Page>
  );
}
