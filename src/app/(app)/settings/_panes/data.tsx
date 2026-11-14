"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { DeleteDrawer, ExportDrawer, type DataStatus } from "@/components/studio-data/studio-data";
import { Group, Row } from "../_ui";

/** Settings → Your data: download everything, or delete the studio (owner only). */
export function DataPane() {
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [failed, setFailed] = useState("");
  const [open, setOpen] = useState<"" | "export" | "delete">("");
  useEffect(() => {
    apiFetch(`${API}/studio-data/status`).then(async r => {
      if (r.ok) setStatus(await r.json());
      else setFailed(r.status === 403 ? "Only the studio owner can download all the data or delete the studio." : "Couldn't load this. Refresh the page.");
    }).catch(() => setFailed("Couldn't load this. Refresh the page."));
  }, []);
  if (failed) return <Group><Row label={failed} /></Group>;
  if (!status) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#A29DB3]" /></div>;
  return (
    <>
      <Group title="Download" note="One Excel file: every client, program, payment, invoice, quote, agreement, team member, gear, expense, song and setting — each in its own sheet. Passwords and sign-in keys are never included.">
        <Row id="export" label="Download all your data" hint="Excel (.xlsx). Asks for your password; we email you each time it is done.">
          <button type="button" onClick={() => setOpen("export")} className="h-10 px-4 rounded-full bg-[#1F8A5B] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"><Download className="w-4 h-4" />Download</button>
        </Row>
      </Group>
      <Group title="Danger zone" note={`The studio closes when you confirm by email and everything is deleted for good after ${status.deleteAfterDays} days. Until then you can stop it.`}>
        <Row id="deleteStudio" label={<span className="text-[#C2304F]">Delete this studio</span>} hint="Removes the studio and all of its data from StuPanel.">
          <button type="button" onClick={() => setOpen("delete")} className="h-10 px-4 rounded-full bg-[#FDECEF] text-[#C2304F] text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#C2304F] hover:text-white transition-colors"><Trash2 className="w-4 h-4" />Delete studio</button>
        </Row>
      </Group>
      {open === "export" && <ExportDrawer status={status} onClose={() => setOpen("")} />}
      {open === "delete" && <DeleteDrawer status={status} onClose={() => setOpen("")} />}
    </>
  );
}
