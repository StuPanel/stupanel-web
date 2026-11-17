/**
 * AI Face Search: shared types and helpers for the studio pages and the guest page.
 */
import { drivePhoto } from "@/lib/photos";

export type FaceStatus = "draft" | "published" | "closed";
export type Strictness = "strict" | "balanced" | "loose";
export type FaceSettings = {
  guestsSee: "own" | "all"; highlightsForAll: boolean; strictness: Strictness;
  downloads: boolean; pin: string; welcome: string;
  /** A second code for the couple and family: whoever types it sees every photo ("" = off) */
  fullPin?: string;
  /** The last day the gallery is open, YYYY-MM-DD ("" = no end) */
  expiresAt?: string;
  /** Guests may save many photos at once (Download all, Choose); `downloads` is the single photo's Download */
  downloadAll?: boolean;
  /** The file guests save: as uploaded, or the same pixels saved smaller */
  downloadSize?: "original" | "medium" | "small";
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
  /** Email a guest when their photos are ready; auto = by itself, manual = when the studio presses the button */
  notifyEmail?: boolean; notifyWhen?: "auto" | "manual";
  /** What the details form asks for besides the name (both hidden = the number is asked) */
  askPhone?: "hide" | "optional" | "required"; askEmail?: "hide" | "optional" | "required";
  /** The guest's name in the details form */
  askName?: "hide" | "optional" | "required";
  /** With WhatsApp and Email both optional: one of the two is needed */
  contactOne?: boolean;
  /** The all-photos link: also ask its code; ask for details first. The VIP link: also ask the guests' code. */
  fullAskPin?: boolean; fullRegister?: boolean; vipAskPin?: boolean;
  /** When guests are asked to follow the studio's pages, and the card's rules and words */
  followWhen?: "off" | "before" | "results" | "open" | "download" | "downloaded";
  followSkip?: boolean; followAgain?: boolean; followTitle?: string; followText?: string;
  /** "Book us" card after the photos (WhatsApp with a ready message) and a review link */
  bookButton?: boolean; bookWhatsApp?: string; bookText?: string; reviewUrl?: string;
  /** When the Book us card shows (end of the photos, or slides up), ask again after Not now, keep it at the end too */
  bookWhen?: "end" | "results" | "downloaded" | "afterFollow"; bookAgain?: boolean; bookKeepCard?: boolean;
  /** Share button in the opened photo, and the caption copied with it ("" = Photo by @handle) */
  shareButton?: boolean; shareCaption?: string;
  /** The message sent to guests ("" = the usual one); {name} {event} {studio} {count} {link} are filled in */
  message?: string;
};
export type FaceCounts = { photos: number; ready: number; waiting: number; failed: number; noFace: number; faces: number; hidden: number; guests: number; found: number };
export type Credits = { plan: number; purchased: number; total: number; planResetAt: string | null };
export type Cover = { /** Set for guests when the cover carries the watermark */ id?: string; driveFileId: string; width: number | null; height: number | null } | null;

export type FaceGallery = {
  id: string; title: string; status: FaceStatus; bookingId: string; link: string; settings: FaceSettings;
  /** The two other share links: every photo (couple and family), and VIP (no details asked) */
  links?: { full: string | null; vip: string | null };
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
  /** Guest side, when the gallery saves photos smaller (Medium / Small): where the saved file comes from */
  file?: string;
  status?: "pending" | "processing" | "ready" | "failed"; error?: string | null; faceCount?: number; skippedFaces?: number; hidden?: boolean;
};

export type FaceGuest = {
  id: string; name: string | null; phone: string | null; email: string | null; channel: string | null;
  matchCount: number; searches: number; lastSearchAt: string | null; registeredAt: string | null;
  linkSentAt: string | null; openedAt: string | null; downloads: number; createdAt: string;
  /** Photos the guest had when they were last told */ notifiedCount?: number;
  /** New photos since they were told (or never told): the link can be sent now */ due?: boolean;
  /** Came back after the message went out */ opened?: boolean;
  /** The ready WhatsApp message with the guest's own link (guests with a number) */ text?: string;
};
/** What the Guests tab gets: the guests and how messages are set for this gallery. */
export type FaceGuestList = { guests: FaceGuest[]; status?: FaceStatus; message?: string; notifyEmail?: boolean; notifyWhen?: "auto" | "manual" };
/** The message guests get when the studio writes none of its own (the same words as on the server). */
export const DEFAULT_GUEST_MESSAGE = "Hi {name}, your photos from {event} are ready. We found {count} of you. See them here: {link}";

export const FACE_STATUS: Record<FaceStatus, { label: string; badge: string; dot: string }> = {
  draft: { label: "Not published", badge: "bg-[#F1EFF6] text-[#4A4658]", dot: "bg-[#B5B0C4]" },
  published: { label: "Published", badge: "bg-[#E2F4EA] text-[#1F8A5B]", dot: "bg-[#1F8A5B]" },
  closed: { label: "Closed", badge: "bg-[#F5F3FA] text-[#6B6680]", dot: "bg-[#D6D2E0]" },
};

export const num = (n: number) => n.toLocaleString("en");
export const facePhotoUrl = (p: { driveFileId: string; wm?: string }, width = 480) =>
  p.wm ? p.wm.replace("{size}", String(width <= 480 ? 480 : width <= 1600 ? 1600 : 2560)) : drivePhoto(p.driveFileId, width);
/** The file a guest saves: the original from Drive, or the watermarked copy when the gallery has a watermark. */
export const faceSaveUrl = (p: { driveFileId: string; wm?: string; file?: string }) => (p.file ? `${p.file}&dl=1` : p.wm ? `${p.wm.replace("{size}", "2560")}&dl=1` : faceDownloadUrl(p.driveFileId));
/**
 * The file a phone fetches to hand to its share sheet ("Save image"): the watermarked copy, or the full-size
 * picture from Google (the Drive download link cannot be fetched by a page).
 */
export const faceFileUrl = (p: { driveFileId: string; wm?: string; file?: string }) => (p.file ? p.file : p.wm ? p.wm.replace("{size}", "2560") : `https://lh3.googleusercontent.com/d/${p.driveFileId}=s0`);
/** The original file, for saving. */
export const faceDownloadUrl = (driveFileId: string) => `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`;
export const day = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
export const dayTime = (d?: string | null) => (d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "");
export const errText = (d: { message?: string | string[] } | null | undefined, fallback: string) =>
  (Array.isArray(d?.message) ? d?.message[0] : d?.message) || fallback;

/** Where photos uploaded from a phone or computer go inside the program's raw files on Drive. */
export const FACE_UPLOAD_PATH = "Face search";
