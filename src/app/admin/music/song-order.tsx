"use client";
/** Super Admin → Music → Tags & settings: how every studio's song lists are ordered. */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { API_URL as API } from "@/lib/api";
import { notify } from "@/components/feedback";

const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("admin_token") ?? ""}` });
const ORDERS: [string, string, string][] = [
  ["newest", "Newest first", "Songs added last come first"],
  ["name", "Name A–Z", "By song name"],
  ["popular", "Most used", "Songs studios and clients use most come first"],
  ["oldest", "Oldest first", "Songs added first come first"],
];

export function SongOrder() {
  const [mode, setMode] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    fetch(`${API}/admin/music/settings`, { headers: authH() }).then(r => r.ok ? r.json() : null).then(d => { if (on && d) setMode(d.songOrder); }).catch(() => {});
    return () => { on = false; };
  }, []);
  const save = async (v: string) => {
    const was = mode; setMode(v);
    const r = await fetch(`${API}/admin/music/settings`, { method: "POST", headers: authH(), body: JSON.stringify({ songOrder: v }) });
    if (r.ok) notify("Song order saved — studios see it within a minute"); else { setMode(was); notify("Couldn't save", { error: true }); }
  };
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <p className="text-sm font-semibold text-white">Song order</p>
      <p className="text-xs text-slate-400 mt-1">How songs are listed for every studio: StuPanel picks, songs from clients and each studio&apos;s own songs. (Popular in studios is always by how many studios use a song, unless Name A–Z is chosen.) Tags are always A–Z.</p>
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2" role="radiogroup" aria-label="Song order">
        {ORDERS.map(([id, name, note]) => (
          <button key={id} type="button" role="radio" aria-checked={mode === id} disabled={!mode} onClick={() => void save(id)}
            className={cn("text-left rounded-lg border px-3 py-2.5 transition-colors disabled:opacity-50", mode === id ? "border-indigo-400 bg-indigo-500/15" : "border-slate-600 hover:bg-slate-700/60")}>
            <span className="block text-sm font-semibold text-white">{name}</span>
            <span className="block text-[11px] text-slate-400 mt-0.5">{note}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
