"use client";

/**
 * For an editor who does not log in (a freelancer):
 *  • AddWorkDrawer — the studio adds the edited files itself; it counts as approved at once.
 *  • WorkLinkDrawer — a private link the editor opens to see the work and hand it in.
 */
import { useEffect, useState } from "react";
import { Copy, ExternalLink, Link2, Loader2, MessageCircle, Plus, RefreshCw } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { askConfirm, notify } from "@/components/feedback";
import { Field, FormDrawer, FormGroup, inputCls } from "@/components/ui/form-kit";
import { waNumber } from "@/lib/phone";
import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  highlight_video: "Highlight video", full_video: "Full video", teaser: "Teaser", reel: "Reel",
  photo_delivery: "Photos", album: "Album", other: "Other",
};
const errOf = async (r: Response, fallback: string) => {
  const d = await r.json().catch(() => ({}));
  return (Array.isArray(d.message) ? d.message[0] : d.message) || fallback;
};

type For = { id: string; name: string; phone?: string | null; role: string; plan: string[]; missing: string[] };

export function AddWorkDrawer({ editor, types, onClose, onDone }: { editor: For; types: string[]; onClose: () => void; onDone: () => void }) {
  const options = editor.plan.length ? [...editor.plan, ...types.filter(t => !editor.plan.includes(t))] : types;
  const [type, setType] = useState(editor.missing[0] ?? options[0]);
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    if (!/^https?:\/\/\S+\.\S+$/i.test(link.trim())) { setErr("Paste the link to the files. It starts with https://"); return; }
    setBusy(true);
    try {
      const r = await apiFetch(`${API}/editor-work/${editor.id}/submissions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverableType: type, link: link.trim(), notes: notes.trim() || undefined }),
      });
      if (!r.ok) { setErr(await errOf(r, "Couldn't save. Please try again.")); return; }
      notify(`${LABEL[type] ?? type} added and approved`);
      onDone(); onClose();
    } catch { setErr("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <FormDrawer open onClose={onClose} onTop icon={Plus} color="violet" title={`Add work for ${editor.name}`} sub="Use this when the editor sent you the files directly"
      footer={<>
        <button type="button" onClick={onClose} className="h-11 px-5 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-sm font-semibold text-[#17151F]">Close</button>
        <button type="button" onClick={save} disabled={busy} className="flex-1 h-11 rounded-full bg-[#7D5CEF] hover:bg-[#6B4AE0] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}Add and approve
        </button>
      </>}>
      <FormGroup note="You are adding it yourself, so it is saved as approved. Nobody gets an email.">
        <Field label="What is it?">{id => (
          <select id={id} value={type} onChange={e => setType(e.target.value)} className={inputCls}>
            {options.map(t => <option key={t} value={t}>{LABEL[t] ?? t}</option>)}
          </select>
        )}</Field>
        <Field label="Link to the files" required>{id => (
          <>
            <input id={id} type="url" inputMode="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://drive.google.com/…" className={inputCls} aria-invalid={!!err} autoFocus />
            {err && <p role="alert" className="mt-1.5 text-[13px] font-semibold text-[#C2304F]">{err}</p>}
          </>
        )}</Field>
        <Field label="Note">{id => <input id={id} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" className={inputCls} />}</Field>
      </FormGroup>
    </FormDrawer>
  );
}

export function WorkLinkDrawer({ editor, program, onClose }: { editor: For; program: string; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function get(fresh = false) {
    setBusy(true); setErr("");
    try {
      const r = await apiFetch(`${API}/editor-work/${editor.id}/link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fresh }) });
      if (!r.ok) { setErr(await errOf(r, "Couldn't make the link. Please try again.")); return; }
      setUrl((await r.json()).url);
      if (fresh) notify("New link made — the old one stopped working");
    } catch { setErr("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }
  useEffect(() => { get(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const first = editor.name.split(" ")[0];
  const message = `Hi ${first}, here is your editing work for ${program}. Open this link to see what to do and to send your files:\n${url}`;
  const wa = waNumber(editor.phone);
  const copy = async (text: string, done: string) => {
    try { await navigator.clipboard.writeText(text); notify(done); } catch { notify("Could not copy. Select the link and copy it.", { error: true }); }
  };
  const row = "w-full min-h-[52px] px-4 flex items-center gap-3 text-left text-[15px] font-semibold text-[#17151F] hover:bg-[#F7F5FB] disabled:opacity-50";

  return (
    <FormDrawer open onClose={onClose} onTop icon={Link2} color="blue" title={`Work link for ${editor.name}`} sub="No login needed — the editor just opens it"
      footer={<button type="button" onClick={onClose} className="flex-1 h-11 rounded-full bg-[#F1EFF6] hover:bg-[#E4E0EC] text-sm font-semibold text-[#17151F]">Close</button>}>
      {err && <p role="alert" className="mb-4 text-[13px] font-semibold text-[#C2304F] bg-[#FDECEF] px-3.5 py-2.5 rounded-[12px]">{err}</p>}
      <FormGroup note="With this link the editor sees what to deliver, your note, the raw files and the client's songs, and hands in the work. You approve it or ask for changes here, as always. The link shows no money and no client phone.">
        <div className="px-4 py-3.5">
          <p className="text-[13px] font-semibold text-[#4A4658] mb-1.5">Link</p>
          <p className={cn(inputCls, "h-auto min-h-11 py-2.5 [overflow-wrap:anywhere] select-all", !url && "text-[#A29DB3]")}>{url || "Making the link…"}</p>
        </div>
        <button type="button" disabled={!url} onClick={() => copy(url, "Link copied")} className={row}><Copy className="w-4 h-4 text-[#6B6680]" />Copy link</button>
        <button type="button" disabled={!url} onClick={() => copy(message, "Message copied")} className={row}><Copy className="w-4 h-4 text-[#6B6680]" />Copy with a message</button>
        {wa && url && (
          <a href={`https://wa.me/${wa}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className={row}><MessageCircle className="w-4 h-4 text-[#1F8A5B]" />Send on WhatsApp</a>
        )}
        {url && <a href={url} target="_blank" rel="noreferrer" className={row}><ExternalLink className="w-4 h-4 text-[#6B6680]" />See what the editor sees</a>}
      </FormGroup>
      <FormGroup title="If the link reached the wrong person">
        <button type="button" disabled={busy || !url} className={cn(row, "rounded-t-[20px]")}
          onClick={async () => { if (await askConfirm({ title: "Make a new link?", message: "The old link stops working at once. Send the new one to the editor.", confirmLabel: "Make new link" })) get(true); }}>
          <RefreshCw className="w-4 h-4 text-[#6B6680]" />Make a new link
        </button>
        <button type="button" disabled={busy || !url} className={cn(row, "rounded-b-[20px] text-[#B42347]")}
          onClick={async () => {
            if (!(await askConfirm({ title: "Turn the link off?", message: "Nobody can open it any more. You can make a new one later.", confirmLabel: "Turn off" }))) return;
            const r = await apiFetch(`${API}/editor-work/${editor.id}/link`, { method: "DELETE" });
            if (r.ok) { notify("Link turned off"); onClose(); } else notify("Couldn't turn it off", { error: true });
          }}>
          <Link2 className="w-4 h-4" />Turn the link off
        </button>
      </FormGroup>
    </FormDrawer>
  );
}
