/**
 * Google's own folder picker ("Select a folder" window from Google).
 * StuPanel only has the drive.file permission, so this window is the one way a studio can point
 * at a folder StuPanel did not make. The token is short-lived and comes from our API.
 */
import { apiFetch, API_URL as API } from "@/lib/api";

export type PickedFolder = { id: string; name: string; url?: string };
type Setup = { accessToken: string; appId: string; apiKey: string | null; email: string; connectionId: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
let loading: Promise<void> | null = null;
function loadPicker(): Promise<void> {
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const ready = () => (window as any).gapi.load("picker", { callback: () => resolve(), onerror: () => reject(new Error("Couldn't load Google's picker")) });
    if ((window as any).gapi?.load) { ready(); return; }
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/api.js";
    s.async = true;
    s.onload = ready;
    s.onerror = () => { loading = null; reject(new Error("Couldn't reach Google. Check your internet and try again.")); };
    document.head.appendChild(s);
  });
  return loading;
}

/** Opens the picker. Resolves with the chosen folder, or null when the person closes it. */
export async function pickDriveFolder(title = "Choose the folder with the raw files"): Promise<{ folder: PickedFolder | null; email: string }> {
  const r = await apiFetch(`${API}/google-drive/raw-picker/setup`);
  const setup = (await r.json().catch(() => ({}))) as Setup & { message?: string };
  if (!r.ok) throw new Error(setup.message || "Couldn't open Google Drive");
  await loadPicker();
  const g = (window as any).google;
  return new Promise(resolve => {
    const view = new g.picker.DocsView(g.picker.ViewId.FOLDERS)
      .setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes("application/vnd.google-apps.folder")
      .setParent("root");
    const shared = new g.picker.DocsView(g.picker.ViewId.FOLDERS)
      .setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes("application/vnd.google-apps.folder")
      .setOwnedByMe(false);
    let b = new g.picker.PickerBuilder()
      .setTitle(title)
      .addView(view).addView(shared)
      .setOAuthToken(setup.accessToken)
      .setAppId(setup.appId)
      .setOrigin(window.location.origin)
      .setCallback((data: any) => {
        if (data.action === g.picker.Action.PICKED) {
          const d = data.docs?.[0];
          resolve({ folder: d ? { id: d.id, name: d.name, url: d.url } : null, email: setup.email });
        } else if (data.action === g.picker.Action.CANCEL) resolve({ folder: null, email: setup.email });
      });
    if (setup.apiKey) b = b.setDeveloperKey(setup.apiKey);
    b.build().setVisible(true);
  });
}
