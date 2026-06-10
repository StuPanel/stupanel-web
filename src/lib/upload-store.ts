export interface UploadEntry {
  id: string;
  fileName: string;
  progress: number;
  done: boolean;
  error?: string;
  type: "drive" | "r2";
  bookingId: string;
  bookingName?: string;
  folderName?: string;
}

type Listener = (uploads: UploadEntry[]) => void;

class UploadStore {
  private map = new Map<string, UploadEntry>();
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.getAll());
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const arr = this.getAll();
    this.listeners.forEach(fn => fn(arr));
  }

  add(entry: UploadEntry) {
    this.map.set(entry.id, entry);
    this.notify();
  }

  update(id: string, patch: Partial<UploadEntry>) {
    const e = this.map.get(id);
    if (e) { this.map.set(id, { ...e, ...patch }); this.notify(); }
  }

  clearDone() {
    for (const [id, e] of this.map) if (e.done || e.error) this.map.delete(id);
    this.notify();
  }

  getAll(): UploadEntry[] {
    return Array.from(this.map.values());
  }

  hasActive(): boolean {
    return Array.from(this.map.values()).some(u => !u.done && !u.error);
  }
}

export const uploadStore = new UploadStore();
