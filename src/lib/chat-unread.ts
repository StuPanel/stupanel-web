import { apiFetch, API_URL as API } from "@/lib/api";

export type ChatUnread = { programs: number; team: number; clients: number; total: number };

/** Fired after messages are read, so badges refresh straight away. */
export const CHAT_READ_EVENT = "sp-chat-read";
export function chatRead(delay = 600) {
  if (typeof window === "undefined") return;
  setTimeout(() => window.dispatchEvent(new Event(CHAT_READ_EVENT)), delay);
}

export async function loadChatUnread(): Promise<ChatUnread | null> {
  try {
    const r = await apiFetch(`${API}/chat/unread`);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
