"use client";

/**
 * Keeps this device on the studio's backdrop (Settings → Appearance).
 * The backdrop is one choice for the whole studio, so the team's panel looks like the studio app.
 * Renders nothing.
 */
import { useEffect } from "react";
import { apiFetch, API_URL as API } from "@/lib/api";
import { applyStudioBackdrop, getLocalBackdrop } from "@/lib/backdrop";

const ADOPTED = "sp_backdrop_adopted";

/**
 * `adopt`: for the studio owner only. The backdrop used to be saved per device; if the studio
 * has none yet and the owner had picked one here, it becomes the studio's (once per device).
 */
export function StudioBackdrop({ adopt = false }: { adopt?: boolean }) {
  useEffect(() => {
    let alive = true;
    apiFetch(`${API}/companies/settings`)
      .then(r => (r.ok ? r.json() : null))
      .then(async s => {
        if (!alive || !s) return;
        if (applyStudioBackdrop(s)) return;
        if (!adopt || !s.appearance || s.appearance.backdrop !== null) return; // older API, or already chosen
        const mine = getLocalBackdrop();
        try { if (!mine || localStorage.getItem(ADOPTED)) return; } catch { return; }
        await apiFetch(`${API}/companies/settings`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appearance: { backdrop: mine } }),
        });
        // Answered (saved or refused): don't ask again from this device. A network failure tries again next time.
        try { localStorage.setItem(ADOPTED, "1"); } catch { /* storage blocked */ }
      })
      .catch(() => { /* keep what this device has */ });
    return () => { alive = false; };
  }, [adopt]);
  return null;
}
