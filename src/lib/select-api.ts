/**
 * Where the photo / music choosing screens send their calls. The same screens run inside
 * the client portal (link + access code) and on a direct link (/s/…, /m/…, no code).
 */
import { API_URL as API } from "@/lib/api";
import { apiFetch } from "@/lib/api";
import { portalHeaders } from "@/lib/portal-session";

export type SelectApi = {
  /** "" = the selection itself; "/marks", "/submit", "/reopen", "/lookup"… */
  url: (path: string) => string;
  headers: (extra?: Record<string, string>) => HeadersInit;
  /** How the selection is read (default: the browser's fetch). */
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  /** The studio's preview: the client's screen, but nothing is saved and nothing is counted. */
  preview?: boolean;
};

export const portalPhotoApi = (token: string, galleryId: string): SelectApi => ({
  url: p => `${API}/public/portal/${token}/photos/${galleryId}${p}`,
  headers: extra => portalHeaders(token, extra),
});

export const linkPhotoApi = (link: string): SelectApi => ({
  url: p => `${API}/public/select/photos/${encodeURIComponent(link)}${p}`,
  headers: extra => ({ ...(extra ?? {}) }),
});

export const portalMusicApi = (token: string, bookingId: string): SelectApi => ({
  url: p => (p === "/lookup" ? `${API}/public/portal/${token}/music/lookup` : `${API}/public/portal/${token}/music/${bookingId}${p}`),
  headers: extra => portalHeaders(token, extra),
});

export const linkMusicApi = (link: string): SelectApi => ({
  url: p => `${API}/public/select/music/${encodeURIComponent(link)}${p}`,
  headers: extra => ({ ...(extra ?? {}) }),
});

/** The studio's "Client preview" of a photo selection (studio login; read only). */
export const previewPhotoApi = (galleryId: string): SelectApi => ({
  url: () => `${API}/photo-selection/${galleryId}/preview`,
  headers: extra => ({ ...(extra ?? {}) }),
  fetch: (url, init) => apiFetch(url, init),
  preview: true,
});
