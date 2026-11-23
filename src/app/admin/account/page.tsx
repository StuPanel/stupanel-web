"use client";

/** My account: name and phone. Password, app code, how long you stay signed in and devices: Settings → Sign-in & security. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { pfetch, savePlatformSession, type PlatformUser } from "@/lib/platform-api";
import { Btn, Msg, Page, Panel, inp } from "../_components/staff-kit";

export default function MyAccountPage() {
  const [me, setMe] = useState<PlatformUser | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileMsg, setProfileMsg] = useState<{ error?: string; ok?: string }>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const load = useCallback(async () => {
    const u = await pfetch<PlatformUser>("/me");
    setMe(u); setName(u.name); setPhone(u.phone ?? "");
  }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setSavingProfile(true); setProfileMsg({});
    try {
      const u = await pfetch<PlatformUser>("/me", { method: "PATCH", json: { name: name.trim(), phone: phone.trim() } });
      setMe(u); savePlatformSession(sessionStorage.getItem("admin_token") || "", u);
      setProfileMsg({ ok: "Saved." });
    } catch (err) { setProfileMsg({ error: (err as Error).message }); } finally { setSavingProfile(false); }
  }

  if (!me) return <Page title="My account"><div className="h-40" /></Page>;

  return (
    <Page title="My account" sub={`${me.email} · ${me.isOwner ? "Owner" : me.role?.name ?? ""}`}>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Profile">
          <form onSubmit={saveProfile} className="space-y-3">
            <label className="block space-y-1"><span className="text-xs text-slate-400">Name</span>
              <input value={name} onChange={e => setName(e.target.value)} required minLength={2} className={inp} /></label>
            <label className="block space-y-1"><span className="text-xs text-slate-400">Phone</span>
              <input value={phone} onChange={e => setPhone(e.target.value)} className={inp} placeholder="01XXXXXXXXX" /></label>
            <label className="block space-y-1"><span className="text-xs text-slate-400">Email</span>
              <input value={me.email} disabled className={inp} /></label>
            <Msg {...profileMsg} />
            <Btn loading={savingProfile}>Save</Btn>
          </form>
        </Panel>

        <Panel title="Sign-in & security" sub="Password, app code, how long you stay signed in, and your devices">
          <p className="text-sm text-slate-300 mb-3">These are now together in Settings.</p>
          <Link href="/admin/settings/security" className="h-9 px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white">
            <ShieldCheck className="w-3.5 h-3.5" />Open Sign-in & security
          </Link>
        </Panel>
      </div>
    </Page>
  );
}
