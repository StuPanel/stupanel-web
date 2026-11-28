import { apiFetch, API_URL as API } from "@/lib/api";
import type { AlbumDetail, AlbumListRow, Source, Spread } from "./types";

export type ReadySel = { id: string; title: string; status: string; submittedAt: string | null; picked: number; program: { id: string; name: string; number: string; date: string | null }; client: string };

async function json<T>(r: Response | null): Promise<T> {
  if (!r) throw new Error("No connection. Check the internet and try again.");
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((Array.isArray(body?.message) ? body.message[0] : body?.message) || "Something went wrong. Try again.");
  return body as T;
}

export const albumApi = {
  list: () => apiFetch(`${API}/album-studio`).then(json<AlbumListRow[]>),
  ready: () => apiFetch(`${API}/album-studio/ready`).then(json<ReadySel[]>),
  source: (galleryId: string) => apiFetch(`${API}/album-studio/source/${galleryId}`).then(json<Source>),
  get: (id: string) => apiFetch(`${API}/album-studio/${id}`).then(json<AlbumDetail>),
  create: (body: { galleryId: string; title?: string; size: string; look: string; names: Record<string, string>; spreads: Spread[] }) =>
    apiFetch(`${API}/album-studio`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(json<{ id: string }>),
  save: (id: string, body: Partial<{ title: string; size: string; look: string; status: string; names: Record<string, string>; spreads: Spread[] }>) =>
    apiFetch(`${API}/album-studio/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(json<{ id: string; updatedAt: string; status: string }>),
  remove: (id: string) => apiFetch(`${API}/album-studio/${id}`, { method: "DELETE" }).then(json<{ ok: boolean }>),
};

/** Width of an element, kept up to date. */
import { useEffect, useRef, useState } from "react";
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el); setW(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
