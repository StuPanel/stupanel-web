"use client";

/**
 * After the client has chosen: get the photos out and the album going.
 *  • Copy to Google Drive — the chosen originals into album / "Most important" / "Chosen" folders
 *  • Sort on this computer — same folders, made next to the originals on the studio's PC
 *  • Album designer — a team member gets the album as work
 *  • Family link — a view-only page for the family
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, Check, CheckCircle2, CloudUpload, Copy, ExternalLink, FolderOpen, Laptop, Loader2, MessageCircle, RotateCcw, TriangleAlert, Users,
} from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { cn } from "@/lib/utils";
import { notify } from "@/components/feedback";
import { CARD_SHADOW, Initial, Tile, type TileColor } from "@/components/ui/apple";
import { Field, FormDrawer, FormGroup, inputCls } from "@/components/ui/form-kit";
import { isPicked, type GalleryDetail, type Handoff } from "@/lib/photos";
import { canSortLocally, pickFolder, sortLocally, type SortProgress, type SortResult } from "@/lib/local-sort";

const errText = (d: { message?: string | string[] }, f: string) => (Array.isArray(d.message) ? d.message[0] : d.message) || f;
const STATUS_TEXT: Record<string, string> = {
  assigned: "Not started", in_progress: "Working on it", submitted: "Sent for review", under_review: "Being reviewed",
  revision_requested: "Changes asked", resubmitted: "Sent again", approved: "Approved", delivered: "Done",
};

function Card({ icon, color, title, sub, children, dim }: { icon: React.ElementType; color: TileColor; title: string; sub: string; children: React.ReactNode; dim?: boolean }) {
  return (
    <div className={cn("bg-white rounded-[20px] p-4 flex flex-col min-w-0", CARD_SHADOW, dim && "opacity-70")}>
      <div className="flex items-start gap-3">
        <Tile icon={icon} color={color} size={38} />
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-[#17151F]">{title}</p>
          <p className="text-[12.5px] text-[#6B6680] mt-0.5 leading-snug">{sub}</p>
        </div>
      </div>
      <div className="mt-3.5 flex-1 flex flex-col justify-end gap-2">{children}</div>
    </div>
  );
}
const btn = "h-10 px-4 rounded-full text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-45 transition-colors";
const Bar = ({ pct, color = "bg-[#1F8A5B]" }: { pct: number; color?: string }) => (
  <div className="h-2 rounded-full bg-[#F1EFF6] overflow-hidden"><div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${Math.max(3, pct)}%` }} /></div>
);

export function HandoffPanel({ g }: { g: GalleryDetail }) {
  const [h, setH] = useState<Handoff | null>(null);
  const [busy, setBusy] = useState<"" | "drive" | "share">("");
  const [designer, setDesigner] = useState(false);
  const [sorting, setSorting] = useState<SortProgress | null>(null);
  const [sorted, setSorted] = useState<SortResult | null>(null);
  const [withRaw, setWithRaw] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const cancel = useRef({ cancelled: false });

  const picked = useMemo(() => g.photos.filter(p => isPicked(p.m)), [g.photos]);
  const onDrive = picked.filter(p => p.src === "raw" || p.src === "delivery").length;
  const fromPc = picked.length - onDrive;

  const load = useCallback(async () => {
    const r = await apiFetch(`${API}/photo-selection/${g.id}/handoff`).catch(() => null);
    if (r?.ok) setH(await r.json());
  }, [g.id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  const running = h?.drive?.state === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [running, load]);

  async function post(path: string, body?: unknown) {
    const r = await apiFetch(`${API}/photo-selection/${g.id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    if (!r?.ok) { notify(errText(d ?? {}, "Something went wrong"), { error: true }); return null; }
    setH(d); return d as Handoff;
  }
  async function toDrive() { setBusy("drive"); try { await post("to-drive"); } finally { setBusy(""); } }
  async function share(on: boolean) { setBusy("share"); try { const d = await post("share", { on }); if (d) notify(on ? "Family link is on" : "Family link is off"); } finally { setBusy(""); } }
  async function copyLink() {
    if (!h?.share) return;
    try { await navigator.clipboard.writeText(h.share.url); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); } catch { notify("Couldn't copy", { error: true }); }
  }

  async function sortOnPc() {
    setSorted(null);
    let dir;
    try { dir = await pickFolder(); } catch { notify("The browser didn't allow that folder. Try another one.", { error: true }); return; }
    if (!dir) return;
    cancel.current = { cancelled: false };
    setSorting({ phase: "reading", found: 0, total: picked.length, done: 0, copied: 0, skipped: 0 });
    try {
      const r = await sortLocally(dir, { title: g.title, photos: g.photos, albums: g.albums, withRaw, onProgress: setSorting, signal: cancel.current });
      setSorted(r);
      notify(r.missing.length ? `${r.copied} copied · ${r.missing.length} not found` : `${r.copied} files copied`);
    } catch (e) {
      notify((e as Error)?.name === "NotAllowedError" ? "The browser needs permission to write in that folder." : "Couldn't sort the photos", { error: true });
    } finally { setSorting(null); }
  }

  const d = h?.drive;
  const none = picked.length === 0;
  const wa = h?.share ? `https://wa.me/?text=${encodeURIComponent(`Here are the photos from ${g.program.name}: ${h.share.url}`)}` : null;

  return (
    <section className="mb-5" aria-label="After the client has chosen">
      <div className="flex items-baseline justify-between gap-3 px-1 mb-2">
        <h2 className="text-[13px] font-bold text-[#4A4658]">Get the chosen photos</h2>
        {none && <span className="text-[12.5px] text-[#6B6680]">Ready once the client chooses</span>}
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Drive */}
        <Card icon={CloudUpload} color="green" title="Copy to Google Drive" dim={none || onDrive === 0}
          sub={`Album folders with "Most important" and "Chosen" inside, next to the program's raw files. Originals stay as they are.`}>
          {d?.state === "running" ? (
            <>
              <div className="flex justify-between text-[12.5px] text-[#4A4658]"><span className="inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Copying {d.done} / {d.total}</span><span className="text-[#6B6680]">You can leave</span></div>
              <Bar pct={d.total ? (d.done / d.total) * 100 : 0} />
            </>
          ) : d?.state === "done" ? (
            <>
              <p className="text-[12.5px] text-[#14613F] font-semibold inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#1F8A5B]" />{d.copied} copied{d.skipped ? ` · ${d.skipped} already there` : ""}{d.failed ? ` · ${d.failed} failed` : ""}</p>
              {d.folders.map(f => (
                <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className={cn(btn, "bg-[#E7F5EE] hover:bg-[#D6EEE2] text-[#14613F] w-full")}>
                  <FolderOpen className="w-4 h-4" /><span className="truncate">Open folder{d.folders.length > 1 ? ` · ${f.email}` : ""}</span><ExternalLink className="w-3.5 h-3.5" />
                </a>
              ))}
              <button type="button" onClick={toDrive} disabled={busy === "drive" || none} className={cn(btn, "bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[#17151F]")}><RotateCcw className="w-3.5 h-3.5" />Copy again (adds new picks)</button>
            </>
          ) : (
            <>
              {d?.state === "failed" && <p className="text-[12.5px] text-[#C2304F] inline-flex items-start gap-1.5"><TriangleAlert className="w-4 h-4 flex-shrink-0" />{d.error || "Copy failed"}</p>}
              <button type="button" onClick={toDrive} disabled={busy === "drive" || none || onDrive === 0} className={cn(btn, "bg-[#1F8A5B] hover:bg-[#18724A] text-white")}>
                {busy === "drive" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}Copy {onDrive || ""} photo{onDrive === 1 ? "" : "s"}
              </button>
            </>
          )}
          {fromPc > 0 && <p className="text-[12px] text-[#6B6680]">{fromPc} chosen photo{fromPc === 1 ? " was" : "s were"} added from a computer — use &quot;Sort on this computer&quot; for {fromPc === 1 ? "it" : "them"}.</p>}
        </Card>

        {/* This computer */}
        <Card icon={Laptop} color="ink" title="Sort on this computer" dim={none}
          sub="Pick the folder with your original photos. The chosen ones are copied into album folders inside it — nothing is moved or deleted.">
          {!canSortLocally() ? (
            <p className="text-[12.5px] text-[#6B6680] bg-[#F5F3FA] rounded-[12px] px-3 py-2.5">Works in Chrome or Edge on a computer. On other browsers, use Get list → Download list.</p>
          ) : sorting ? (
            <>
              <div className="flex justify-between text-[12.5px] text-[#4A4658]">
                <span className="inline-flex items-center gap-1.5 min-w-0"><Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" /><span className="truncate">{sorting.phase === "reading" ? `Reading the folder… ${sorting.found} files` : `Copying ${sorting.done} / ${sorting.total}`}</span></span>
                <button type="button" onClick={() => { cancel.current.cancelled = true; }} className="text-[#C2304F] font-semibold flex-shrink-0">Stop</button>
              </div>
              <Bar pct={sorting.phase === "reading" ? 8 : sorting.total ? (sorting.done / sorting.total) * 100 : 0} color="bg-[#17151F]" />
              <p className="text-[12px] text-[#6B6680]">Keep this tab open until it finishes.</p>
            </>
          ) : (
            <>
              {sorted && (
                <div className="text-[12.5px] space-y-1">
                  <p className="text-[#14613F] font-semibold inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#1F8A5B]" />{sorted.copied} copied{sorted.skipped ? ` · ${sorted.skipped} already there` : ""}</p>
                  <p className="text-[#6B6680] break-all">In: {sorted.folder}</p>
                  {sorted.missing.length > 0 && (
                    <details className="text-[#9C2340]"><summary className="cursor-pointer font-semibold">{sorted.missing.length} not found in that folder</summary>
                      <p className="mt-1 text-[12px] text-[#6B6680] break-all">{sorted.missing.slice(0, 40).join(", ")}{sorted.missing.length > 40 ? "…" : ""}</p>
                      <button type="button" onClick={() => navigator.clipboard.writeText(sorted.missing.join("\n")).then(() => notify("Names copied"))} className="mt-1 text-[#5B3FD0] font-semibold">Copy these names</button>
                    </details>
                  )}
                </div>
              )}
              <label className="flex items-center gap-2 text-[12.5px] text-[#4A4658] cursor-pointer select-none">
                <input type="checkbox" checked={withRaw} onChange={e => setWithRaw(e.target.checked)} className="w-4 h-4 accent-[#7D5CEF]" />
                Also copy the RAW file with the same name
              </label>
              <button type="button" onClick={sortOnPc} disabled={none} className={cn(btn, "bg-[#17151F] hover:bg-[#2B2836] text-white")}><FolderOpen className="w-4 h-4" />{sorted ? "Choose a folder again" : "Choose the originals folder"}</button>
            </>
          )}
        </Card>

        {/* Designer */}
        <Card icon={BookOpen} color="orchid" title="Album designer" dim={none}
          sub="A team member gets the album as work in their app, with the chosen photos and your note.">
          {h?.designer ? (
            <>
              <div className="flex items-center gap-2.5 rounded-[14px] bg-[#F7F5FB] px-3 py-2.5">
                <Initial name={h.designer.name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-[#17151F] truncate">{h.designer.name}</p>
                  <p className="text-[12px] text-[#6B6680] truncate">{STATUS_TEXT[h.designer.status] ?? h.designer.status}{h.designer.deadline ? ` · by ${new Date(h.designer.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}</p>
                </div>
              </div>
              <button type="button" onClick={() => setDesigner(true)} className={cn(btn, "bg-[#F5F3FA] hover:bg-[#EEEBF4] text-[#17151F]")}>Change or remind</button>
            </>
          ) : (
            <button type="button" onClick={() => setDesigner(true)} disabled={none} className={cn(btn, "bg-[#9E3A8C] hover:bg-[#86307A] text-white")}><BookOpen className="w-4 h-4" />Give to a designer</button>
          )}
          {h?.designer && !d && onDrive > 0 && <p className="text-[12px] text-[#6B6680]">Tip: copy to Drive first — the designer can then open the folder.</p>}
        </Card>

        {/* Family */}
        <Card icon={Users} color="blue" title="Family link"
          sub="A page the family can open to see the photos — with your watermark, no download, nothing to change.">
          {h?.share ? (
            <>
              <div className="flex items-center gap-2 rounded-full bg-[#F5F3FA] p-1 pl-3">
                <p className="flex-1 min-w-0 text-[12.5px] text-[#4A4658] truncate">{h.share.url}</p>
                <button type="button" onClick={copyLink} className={cn("h-8 px-3 rounded-full text-[12.5px] font-semibold inline-flex items-center gap-1 flex-shrink-0", linkCopied ? "bg-[#1F8A5B] text-white" : "bg-[#17151F] text-white")}>{linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{linkCopied ? "Copied" : "Copy"}</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={cn(btn, "bg-[#1F8A5B] hover:bg-[#18724A] text-white")}><MessageCircle className="w-4 h-4" />WhatsApp</a>}
                <button type="button" onClick={() => share(false)} disabled={busy === "share"} className={cn(btn, "bg-[#F5F3FA] hover:bg-[#FDECEF] text-[#C2304F]")}>Turn off</button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => share(true)} disabled={busy === "share" || g.status === "preparing"} className={cn(btn, "bg-[#1F5C99] hover:bg-[#194D82] text-white")}>
              {busy === "share" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}Make a family link
            </button>
          )}
          {g.status === "preparing" && <p className="text-[12px] text-[#6B6680]">Send the selection to the client first.</p>}
        </Card>
      </div>

      {designer && <DesignerDrawer g={g} current={h?.designer ?? null} pickedCount={picked.length} onClose={() => setDesigner(false)} onSaved={x => { setH(x); setDesigner(false); notify("The album is with the designer"); }} />}
    </section>
  );
}

type Member = { id: string; firstName: string; lastName?: string | null; memberRoles?: string[]; isActive?: boolean; email?: string | null };
const ROLE: Record<string, string> = { photo_editor: "Photo editor", video_editor: "Video editor", photographer: "Photographer", cinematographer: "Cinematographer" };

function DesignerDrawer({ g, current, pickedCount, onClose, onSaved }: {
  g: GalleryDetail; current: Handoff["designer"]; pickedCount: number; onClose: () => void; onSaved: (h: Handoff) => void;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [userId, setUserId] = useState(current?.userId ?? "");
  const [deadline, setDeadline] = useState(current?.deadline ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`${API}/team`).then(r => (r.ok ? r.json() : [])).then((d: Member[]) => {
      const list = (Array.isArray(d) ? d : []).filter(m => m.isActive !== false);
      // Photo editors first
      list.sort((a, b) => Number((b.memberRoles ?? []).includes("photo_editor")) - Number((a.memberRoles ?? []).includes("photo_editor")));
      setMembers(list);
    }).catch(() => setMembers([]));
  }, []);

  async function save() {
    if (!userId) { setError("Choose who designs the album."); return; }
    setSaving(true); setError("");
    try {
      const r = await apiFetch(`${API}/photo-selection/${g.id}/designer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, deadline: deadline || null, note: note.trim() || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(errText(d, "Couldn't give the album")); return; }
      onSaved(d);
    } catch { setError("Something went wrong."); } finally { setSaving(false); }
  }

  return (
    <FormDrawer open onClose={onClose} icon={BookOpen} color="orchid" title="Album designer" sub={`${g.title} · ${pickedCount} chosen photos`}
      footer={
        <>
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-sm font-semibold text-[#17151F]">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="flex-1 h-11 rounded-full bg-[#9E3A8C] hover:bg-[#86307A] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}{current ? "Save" : "Give the album"}
          </button>
        </>
      }>
      {error && <p role="alert" className="mb-4 text-[13px] font-semibold text-[#C2304F] bg-[#FDECEF] px-3.5 py-2.5 rounded-[12px]">{error}</p>}
      <FormGroup title="Who designs it" note="They see it in their app under Editing, with “Album” to deliver. They also get an email.">
        {members === null ? (
          <div className="px-4 py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#7D5CEF]" aria-label="Loading" /></div>
        ) : members.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-[#6B6680]">No team members yet. Add them in Team.</p>
        ) : (
          <div role="radiogroup" aria-label="Team member" className="max-h-[320px] overflow-y-auto">
            {members.map(m => {
              const on = userId === m.id;
              const name = `${m.firstName} ${m.lastName ?? ""}`.trim();
              return (
                <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => setUserId(m.id)}
                  className={cn("w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#EEEBF4] last:border-0", on ? "bg-[#FBF2FA]" : "hover:bg-[#F7F5FB]")}>
                  <Initial name={name} size={34} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14.5px] font-semibold text-[#17151F] truncate">{name}</span>
                    <span className="block text-[12px] text-[#6B6680] truncate">{(m.memberRoles ?? []).map(r => ROLE[r] ?? r.replace(/_/g, " ")).join(", ") || "Team member"}</span>
                  </span>
                  <span className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0", on ? "border-[#9E3A8C] bg-[#9E3A8C]" : "border-[#CFC8DD]")}>{on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}</span>
                </button>
              );
            })}
          </div>
        )}
      </FormGroup>
      <FormGroup>
        <Field label="Finish by">{id => <input id={id} type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputCls} />}</Field>
        <Field label="Note for the designer">{id => (
          <textarea id={id} rows={3} value={note} onChange={e => setNote(e.target.value)} maxLength={1000} placeholder="Size, pages, style, cover photo…"
            className={cn(inputCls, "h-auto py-3 resize-none leading-relaxed")} />
        )}</Field>
      </FormGroup>
    </FormDrawer>
  );
}
