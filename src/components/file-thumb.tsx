"use client";

/** A Drive thumbnail (photo / video frame); falls back to a file icon if Google has none or it expired. */
import { useState } from "react";
import { File, FileImage, FileVideo, Play } from "lucide-react";
import { cn } from "@/lib/utils";

/** Drive thumbnail links end in "=s220"; ask for a sharper one. */
export const thumbAt = (url: string, px = 400) => (/=s\d+$/.test(url) ? url.replace(/=s\d+$/, `=s${px}`) : url);
export const isMedia = (mime?: string) => !!mime && (mime.startsWith("image/") || mime.startsWith("video/"));

export function FileThumb({ thumb, mime, className }: { thumb?: string | null; mime?: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  const video = !!mime?.startsWith("video/");
  const Icon = video ? FileVideo : mime?.startsWith("image/") ? FileImage : File;
  return (
    <div className={cn("relative bg-[#F2EFF8] overflow-hidden flex items-center justify-center", className)}>
      {thumb && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbAt(thumb)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)}
          className="w-full h-full object-cover" />
      ) : (
        <Icon className="w-6 h-6 text-[#A29DB3]" />
      )}
      {video && (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="w-8 h-8 rounded-full bg-black/45 flex items-center justify-center"><Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" /></span>
        </span>
      )}
    </div>
  );
}

/** Grid or list — remembered per browser. */
export function useViewMode(key: string, fallback: "grid" | "list") {
  const [mode, setMode] = useState<"grid" | "list">(() => {
    try { const v = localStorage.getItem(`sp-view-${key}`); return v === "grid" || v === "list" ? v : fallback; } catch { return fallback; }
  });
  const set = (m: "grid" | "list") => { setMode(m); try { localStorage.setItem(`sp-view-${key}`, m); } catch { /* private mode */ } };
  return [mode, set] as const;
}
