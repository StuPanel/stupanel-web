/**
 * AI Face Search: shared types and helpers for the studio pages and the guest page.
 */
import { drivePhoto } from "@/lib/photos";

export type FaceStatus = "draft" | "published" | "closed";
export type Strictness = "strict" | "balanced" | "loose";
export type FaceSettings = {
  guestsSee: "own" | "all"; highlightsForAll: boolean; strictness: Strictness;
  downloads: boolean; pin: string; welcome: string;
  /** Ask guests for a name and WhatsApp number: off, optional (they can skip), required (before any photo) */
  register?: "off" | "optional" | "required";
  /** The studio's pages guests are asked to follow before the photos ("" = none) */
  followFacebook?: string; followInstagram?: string;
  /** Put the studio's name on every photo guests see or save ("" text = the studio's name) */
  watermark?: boolean; watermarkText?: string;
  watermarkKind?: "text" | "logo"; watermarkLogo?: string;
  watermarkPos?: "tl" | "tc" | "tr" | "cl" | "cc" | "cr" | "bl" | "bc" | "br";
  /** Share of the photo's width, 5–60 */ watermarkSize?: number; /** 5–100 */ watermarkOpacity?: number;
  /** Placed by hand: how far across and down, 0–100 each (null = use watermarkPos) */
  watermarkX?: number | null; watermarkY?: number | null;
};
export type FaceCounts = { photos: number; ready: number; waiting: number; failed: number; noFace: number; faces: number; hidden: number; guests: number; found: number };
export type Credits = { plan: number; purchased: number; total: number; planResetAt: string | null };
export type Cover = { driveFileId: string; width: number | null; height: number | null } | null;

export type FaceGallery = {
  id: string; title: string; status: FaceStatus; bookingId: string; link: string; settings: FaceSettings;
  publishedAt: string | null; closedAt: string | null; createdAt: string;
  program: { id?: string; number: string; eventName: string | null; eventDate: string | null; client: string } | null;
  counts: FaceCounts; cover: Cover;
};
export type FaceDetail = FaceGallery & { ready: boolean; /** Set while StuPanel has Face Search switched off (for everyone or this studio): the sentence to show. */ off?: string | null; folders: { name: string; photos: number }[]; creditsUsed: number; credits: Credits };

export type FacePhoto = {
  id: string; fileName: string; folder: string | null; driveFileId: string; width: number | null; height: number | null;
  highlight: boolean; takenAt: string | null;
  /** Guest side, when the gallery has a watermark: where this photo is served with the watermark (no Drive id is sent then) */
  wm?: string;
  status?: "pending" | "processing" | "ready" | "failed"; error?: string | null; faceCount?: number; skippedFaces?: number; hidden?: boolean;
};

export type FaceGuest = {
  id: string; name: string | null; phone: string | null; email: string | null; channel: string | null;
  matchCount: number; searches: number; lastSearchAt: string | null; registeredAt: string | null;
  linkSentAt: string | null; openedAt: string | null; downloads: number; createdAt: string;
};

export const FACE_STATUS: Record<FaceStatus, { label: string; badge: string; dot: string }> = {
  draft: { label: "Not published", badge: "bg-[#F1EFF6] text-[#4A4658]", dot: "bg-[#B5B0C4]" },
  published: { label: "Published", badge: "bg-[#E2F4EA] text-[#1F8A5B]", dot: "bg-[#1F8A5B]" },
  closed: { label: "Closed", badge: "bg-[#F5F3FA] text-[#6B6680]", dot: "bg-[#D6D2E0]" },
};

export const num = (n: number) => n.toLocaleString("en");
export const facePhotoUrl = (p: { driveFileId: string; wm?: string }, width = 480) =>
  p.wm ? p.wm.replace("{size}", String(width <= 480 ? 480 : width <= 1600 ? 1600 : 2560)) : drivePhoto(p.driveFileId, width);
/** The file a guest saves: the original from Drive, or the watermarked copy when the gallery has a watermark. */
export const faceSaveUrl = (p: { driveFileId: string; wm?: string }) => (p.wm ? `${p.wm.replace("{size}", "2560")}&dl=1` : faceDownloadUrl(p.driveFileId));
/** The original file, for saving. */
export const faceDownloadUrl = (driveFileId: string) => `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`;
export const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
export const dayTime = (d?: string | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "");
export const errText = (d: { message?: string | string[] } | null | undefined, fallback: string) =>
  (Array.isArray(d?.message) ? d?.message[0] : d?.message) || fallback;

/** Where photos uploaded from a phone or computer go inside the program's raw files on Drive. */
export const FACE_UPLOAD_PATH = "Face search";
