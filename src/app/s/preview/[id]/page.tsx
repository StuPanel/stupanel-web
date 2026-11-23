"use client";

/**
 * The studio's "Client preview" of a photo selection: the client's chooser exactly as on their link, read with the
 * studio's login. Before it is sent it shows as open. Nothing tapped here is saved, and it is not counted as a visit.
 */
import { use, useEffect, useMemo, useState } from "react";
import { Eye, Link2Off } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { previewPhotoApi } from "@/lib/select-api";
import { Chooser } from "@/app/portal/[token]/_components/portal-photos";
import { PublicMessage } from "@/components/public/public-shell";

export default function SelectionPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const api = useMemo(() => previewPhotoApi(id), [id]);
  const [failed, setFailed] = useState(false);
  // Inside StuPanel's preview window the window says it already; the note is for a preview opened in its own tab.
  const [ownTab, setOwnTab] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { setOwnTab(window.self === window.top); } catch { setOwnTab(false); } }, []);
  if (failed) return <PublicMessage icon={Link2Off} tone="red" title="Preview not available" text="Sign in to StuPanel in this browser, then open the preview again." />;
  return (
    <>
      <Chooser api={api} brand={BRAND} onFailed={() => setFailed(true)} failText="Sign in to StuPanel in this browser, then open the preview again." />
      {ownTab && <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-3 z-[200] pointer-events-none h-8 px-3.5 rounded-full bg-[#17151F]/85 backdrop-blur text-white text-[12px] font-semibold inline-flex items-center gap-1.5 shadow-lg whitespace-nowrap">
        <Eye className="w-3.5 h-3.5" />Preview — nothing you tap here is saved
      </div>}
    </>
  );
}
