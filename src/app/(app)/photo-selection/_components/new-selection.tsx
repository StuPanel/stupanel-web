"use client";

/**
 * New photo selection — three numbered steps, each ticks itself when done:
 * 1 Program (the client comes with it), 2 Albums and how many photos each, 3 Time to choose.
 * The footer says exactly what is missing.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Images, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { FormDrawer, inputCls } from "@/components/ui/form-kit";
import { CARD_SHADOW } from "@/components/ui/apple";

type Program = {
  id: string; bookingNumber: string; eventName: string | null; eventDate: string | null; status: string;
  client?: { firstName: string; lastName: string | null } | null;
  eventDays?: { eventType?: string; date?: string }[] | null;
};
type AlbumRow = { key: string; name: string; min: string; max: string; allowExtra: boolean };

const DEADLINES = [{ v: "", l: "No limit" }, { v: "7", l: "7 days" }, { v: "14", l: "14 days" }, { v: "30", l: "30 days" }, { v: "date", l: "Pick a date" }];
const key = () => Math.random().toString(36).slice(2, 9);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

function Step({ n, title, sub, done, children }: { n: number; title: string; sub: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <div className="flex items-center gap-3 px-1 mb-2">
        <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 transition-colors duration-300",
          done ? "bg-[#1F8A5B] text-white" : "bg-white text-[#5B3FD0] ring-1 ring-[#E4DEF8]")}>
          {done ? <Check className="w-4 h-4" strokeWidth={3} /> : n}
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-[#17151F] leading-tight">{title}</h3>
          <p className="text-[12.5px] text-[#6B6680]">{sub}</p>
        </div>
      </div>
      <div className={cn("bg-white rounded-[20px] p-3.5", CARD_SHADOW)}>{children}</div>
    </section>
  );
}

export function NewSelection({ onClose, onCreated, programId }: { onClose: () => void; onCreated: (id: string) => void; programId?: string }) {
  const [q, setQ] = useState("");
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [albums, setAlbums] = useState<AlbumRow[]>([{ key: key(), name: "Album", min: "", max: "", allowExtra: false }]);
  const [deadline, setDeadline] = useState("");
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  // Programs: recent first; search by name, number or client
  useEffect(() => {
    const n = ++seq.current;
    const id = setTimeout(async () => {
      const p = new URLSearchParams({ limit: "20" });
      if (q.trim()) p.set("search", q.trim());
      const r = await apiFetch(`${API}/bookings?${p}`).catch(() => null);
      const d = r?.ok ? await r.json() : { data: [] };
      if (n !== seq.current) return;
      const list: Program[] = (d.data ?? []).filter((b: Program) => !["cancelled", "refunded"].includes(b.status));
      setPrograms(list);
      if (programId && !program) { const f = list.find(b => b.id === programId); if (f) pick(f); }
    }, q ? 250 : 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function pick(b: Program) {
    setProgram(b);
  }

  const clientName = (b?: Program | null) => (b?.client ? `${b.client.firstName} ${b.client.lastName ?? ""}`.trim() : "");
  const badAlbum = albums.find(a => !a.name.trim() || (a.min && a.max && Number(a.min) > Number(a.max)));
  const dupName = albums.find((a, i) => albums.findIndex(x => x.name.trim().toLowerCase() === a.name.trim().toLowerCase()) !== i);
  const albumsOk = albums.length > 0 && !badAlbum && !dupName;
  const deadlineOk = deadline !== "date" || !!date;
  const missing = !program ? "Choose the program" : !albumsOk ? (dupName ? `"${dupName.name}" is listed twice` : badAlbum && !badAlbum.name.trim() ? "Give every album a name" : "Fewest can't be more than most") : !deadlineOk ? "Pick the last date" : "";

  const deadlineIso = useMemo(() => {
    if (!deadline) return null;
    if (deadline === "date") return date ? new Date(`${date}T23:59:00`).toISOString() : null;
    const d = new Date(); d.setDate(d.getDate() + Number(deadline)); d.setHours(23, 59, 0, 0);
    return d.toISOString();
  }, [deadline, date]);

  async function create() {
    if (missing || !program) return;
    setSaving(true);
    try {
      const r = await apiFetch(`${API}/photo-selection`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: program.id, title: title.trim() || undefined, deadline: deadlineIso,
          albums: albums.map(a => ({ name: a.name.trim(), minPicks: a.min ? Number(a.min) : null, maxPicks: a.max ? Number(a.max) : null, allowExtra: a.allowExtra })),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { notify(Array.isArray(d.message) ? d.message[0] : d.message || "Couldn't create", { error: true }); return; }
      notify("Created — now add the photos");
      onCreated(d.id);
    } finally { setSaving(false); }
  }

  const setAlbum = (k: string, p: Partial<AlbumRow>) => setAlbums(list => list.map(a => (a.key === k ? { ...a, ...p } : a)));
  const num = "w-full h-10 px-2 rounded-[10px] bg-[#F5F3FA] text-[15px] text-center outline-none border border-transparent focus:bg-white focus:border-[#7D5CEF]";

  return (
    <FormDrawer open onClose={onClose} icon={Images} color="red" title="New photo selection" sub="The client picks photos for their album(s)"
      footer={
        <>
          <p className={cn("flex-1 self-center text-[13px]", missing ? "text-[#6B6680]" : "text-[#1F8A5B] font-semibold")}>{missing || "Ready — next you add the photos"}</p>
          <button type="button" onClick={create} disabled={!!missing || saving}
            className="h-11 px-5 rounded-full bg-[#7D5CEF] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-45">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}Create
          </button>
        </>
      }>
      <Step n={1} title="Program" sub="Whose photos? The client comes with it." done={!!program}>
        {program ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-[#17151F] truncate">{program.eventName || program.bookingNumber}</p>
              <p className="text-[13px] text-[#6B6680] truncate">{clientName(program)} · {program.bookingNumber}{program.eventDate ? ` · ${fmtDate(program.eventDate)}` : ""}</p>
            </div>
            <button type="button" onClick={() => setProgram(null)} className="h-9 px-3.5 rounded-full bg-[#F5F3FA] text-[13px] font-semibold text-[#4A4658]">Change</button>
          </div>
        ) : (
          <>
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-[#A29DB3] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search program, number or client" className={cn(inputCls, "pl-10")} aria-label="Search programs" />
            </div>
            <div className="max-h-[260px] overflow-y-auto -mx-1">
              {programs === null ? <div className="space-y-2 p-1">{[0, 1, 2].map(i => <div key={i} className="sp-skel h-12 rounded-[12px]" />)}</div>
                : programs.length === 0 ? <p className="text-[13px] text-[#6B6680] p-3">No program found.</p>
                : programs.map(b => (
                  <button key={b.id} type="button" onClick={() => pick(b)}
                    className="w-full text-left px-3 py-2.5 rounded-[12px] hover:bg-[#F5F3FA] flex items-center gap-3">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold text-[#17151F] truncate">{b.eventName || b.bookingNumber}</span>
                      <span className="block text-[12.5px] text-[#6B6680] truncate">{clientName(b)} · {b.bookingNumber}{b.eventDate ? ` · ${fmtDate(b.eventDate)}` : ""}</span>
                    </span>
                  </button>
                ))}
            </div>
          </>
        )}
      </Step>

      <Step n={2} title="Albums" sub="Usually one album: Holud, Wedding and Reception go inside it as folders when you add the photos. How many photos should it have? Leave empty for no limit." done={!!program && albumsOk}>
        <div className="grid grid-cols-[minmax(0,1fr)_64px_64px_32px] gap-2 px-1 mb-1.5 text-[12px] font-semibold text-[#6B6680]">
          <span>Album</span><span className="text-center">Fewest</span><span className="text-center">Most</span><span />
        </div>
        <div className="space-y-2">
          {albums.map(a => (
            <div key={a.key}>
              <div className="grid grid-cols-[minmax(0,1fr)_64px_64px_32px] gap-2 items-center">
                <input value={a.name} maxLength={80} onChange={e => setAlbum(a.key, { name: e.target.value })} aria-label="Album name" placeholder="e.g. Wedding album"
                  className="w-full h-10 px-3 rounded-[10px] bg-[#F5F3FA] text-[15px] outline-none border border-transparent focus:bg-white focus:border-[#7D5CEF]" />
                <input value={a.min} inputMode="numeric" onChange={e => setAlbum(a.key, { min: e.target.value.replace(/\D/g, "").slice(0, 4) })} aria-label={`Fewest photos for ${a.name}`} placeholder="—" className={num} />
                <input value={a.max} inputMode="numeric" onChange={e => setAlbum(a.key, { max: e.target.value.replace(/\D/g, "").slice(0, 4) })} aria-label={`Most photos for ${a.name}`} placeholder="—" className={num} />
                <button type="button" onClick={() => setAlbums(l => l.filter(x => x.key !== a.key))} disabled={albums.length === 1} aria-label={`Remove ${a.name}`}
                  className="w-8 h-8 rounded-full text-[#C2304F] hover:bg-[#FDECEF] flex items-center justify-center disabled:opacity-25"><Trash2 className="w-4 h-4" /></button>
              </div>
              {a.max && (
                <label className="flex items-center gap-2 mt-1.5 ml-1 text-[12.5px] text-[#4A4658] cursor-pointer w-fit">
                  <input type="checkbox" checked={a.allowExtra} onChange={e => setAlbum(a.key, { allowExtra: e.target.checked })} className="w-4 h-4 accent-[#7D5CEF]" />
                  Let the client pick more than {a.max} (you can charge for extra)
                </label>
              )}
            </div>
          ))}
        </div>
        {albums.length < 20 && (
          <button type="button" onClick={() => setAlbums(l => [...l, { key: key(), name: "", min: "", max: "", allowExtra: false }])}
            className="mt-3 h-9 px-3.5 rounded-full bg-[#F5F3FA] text-[#5B3FD0] text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#EEE8FD]">
            <Plus className="w-4 h-4" />Add album
          </button>
        )}
      </Step>

      <Step n={3} title="Time to choose" sub="The client sees a countdown. You can give more time later." done={!!program && albumsOk && deadlineOk}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Time to choose">
          {DEADLINES.map(d => (
            <button key={d.v} type="button" role="radio" aria-checked={deadline === d.v} onClick={() => setDeadline(d.v)}
              className={cn("h-9 px-3.5 rounded-full text-[13px] font-semibold transition-colors", deadline === d.v ? "bg-[#17151F] text-white" : "bg-[#F5F3FA] text-[#4A4658] hover:bg-[#EEEBF4]")}>{d.l}</button>
          ))}
        </div>
        {deadline === "date" && (
          <input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} className={cn(inputCls, "mt-3")} aria-label="Last date" />
        )}
        {deadlineIso && <p className="text-[12.5px] text-[#6B6680] mt-2">Until {fmtDate(deadlineIso)}, end of the day.</p>}
        <details className="mt-4 group">
          <summary className="text-[13px] font-semibold text-[#5B3FD0] cursor-pointer list-none">Name (optional)</summary>
          <input value={title} maxLength={150} onChange={e => setTitle(e.target.value)} placeholder={program ? `${program.eventName || program.bookingNumber} — album photos` : "e.g. Wedding album photos"}
            className={cn(inputCls, "mt-2")} aria-label="Name" />
        </details>
      </Step>
    </FormDrawer>
  );
}
