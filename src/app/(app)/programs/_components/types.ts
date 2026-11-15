export interface Client {
  id: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  facebookProfile?: string;
  address?: string;
  referralSource?: string;
}

export interface Package {
  id: string;
  name: string;
  basePrice?: number;
  currency?: string;
  /** Program type name (Settings → Program types). */
  category?: string | null;
  /** Day names the package covers. */
  eventTypesIncluded?: string[];
  isActive?: boolean;
}

export interface TeamMember {
  id: string;
  memberId: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  memberType?: string;
  isActive?: boolean;
  memberRoles: string[];
  /** "staff" | "manager" … (managers can be mentioned in private notes). */
  role?: string;
  roleRates?: { roleId: string; rate: number; rateType: string; withSetup?: number; workType?: string; label?: string; note?: string }[];
  setup?: { id: string; category: string; name: string; rent: number; rentUnit: string; rents?: Record<string, number> }[];
  /** Days the member said they can't work (set in their panel). */
  daysOff?: { id: string; from: string; to: string; note?: string }[];
}

/** Whose gear a person uses on a shift. */
export type SetupMode = "own" | "other" | "rented";

export interface ShiftAssignment {
  id: string;       // real team member id, or a synthetic "fl_..." id for old free-text freelancers
  role: string;      // photographer | cinematographer | drone_pilot | assistant | custom
  name?: string;      // set only for old free-text freelancers
  /** Their own gear (default), someone else's, or rented from outside. */
  setup?: SetupMode;
  /** For "other": which gear and whose (ownerId = member id or "studio"). */
  gear?: { ownerId: string; itemId?: string; name: string }[];
  /**
   * Who pays the rent of a team member's gear used here. The studio always pays the owner on the team bill;
   * "member" = the studio takes the same amount off this person's pay on this program.
   */
  rentPaidBy?: "studio" | "member";
  /** For "rented": shop, item, amount; who paid (studio, or the member → refunded on their bill). */
  rental?: { vendor: string; item: string; amount: number; paidBy: "studio" | "member" };
}

export interface Shift {
  id: string;
  label: string;
  /** Time for this program (HH:MM), filled from the studio's shift and changeable. */
  start?: string;
  end?: string;
  assignments: ShiftAssignment[];
}

export interface EventDay {
  id: string;
  /** Program type id from Settings → Work types (e.g. "wedding"); same on every day. */
  programType?: string;
  eventType: string;
  date: string;
  location: string;
  /** Google Maps link for the venue (optional). */
  mapUrl?: string;
  /** Whose side this day covers (bride | groom | both). Stored on every day; in the form only when it differs from the program's. */
  side?: string;
  shifts: Shift[];
}

export interface EditorDraft {
  userId: string;
  role: "photo_editor" | "video_editor";
  editingDeadline?: string;
  deliveryDeadline?: string;
  studioNote?: string;
}

/** One line of a team member's bill on a program. */
export interface BillLine {
  id: string;
  /** Stable key for auto lines, so a re-calculation keeps the user's typed amount. */
  key?: string;
  kind: "work" | "gear_rent" | "refund" | "extra" | "deduction";
  auto?: boolean;
  edited?: boolean;
  role?: string;
  setup?: SetupMode;
  label: string;
  qty?: number;
  unit?: string;
  unitPrice?: number;
  amount: number;
  note?: string;
  days?: string[];
  shifts?: number;
  /** Gear rent: who used it on this program. */
  users?: string[];
}

export interface TeamPayment { id: string; amount: number; method: string; date: string; note?: string; walletId?: string; walletName?: string }

/** The team bill can't be changed after these (owner can unlock in Edit). */
export const BILL_LOCKED_STATUSES = ["delivered", "completed"];

export interface CostEntry {
  id: string;
  role: string;
  memberId?: string;
  memberName: string;
  totalBill: number;
  paidAmount?: number;
  /** Payouts to this member for this program (server-managed). */
  payments?: TeamPayment[];
  note?: string;
  /** Itemised bill (new form). totalBill = sum of lines (deductions subtract). */
  lines?: BillLine[];
}

export interface Booking {
  id: string;
  /** The studio opened delivery for the client although money is due. */
  deliveryUnlocked?: boolean;
  bookingNumber: string;
  eventName?: string;
  /** Whose side is covered: bride | groom | both. */
  coverageSide?: string | null;
  eventDate?: string;
  eventEndDate?: string;
  eventLocation?: string;
  status: string;
  currency: string;
  grandTotal: number;
  paidAmount: number;
  totalAmount: number;
  discountAmount: number;
  advanceAmount: number;
  transportCost: number;
  otherCost: number;
  albumCost: number;
  equipCost: number;
  teamBillTotal: number;
  profitAmount: number;
  internalNotes?: string;
  /** Note for the team: members see it, the client never does. */
  teamNotes?: string | null;
  deliveryMethod?: string;
  deliveryLink?: string;
  deliveryLinks?: { id: string; title: string; url: string }[];
  deliveryNote?: string;
  deliveryDate?: string;
  driveFolderUrl?: string;
  driveDeliveredAt?: string;
  rawFilesInfo?: { pcName?: string; folderPath?: string; driveLink?: string; notes?: string };
  eventDays: EventDay[];
  costEntries: CostEntry[];
  client: { id: string; firstName: string; lastName?: string; phone?: string };
  program?: { id: string; name: string };
  team: { userId: string; roleInBooking?: string; agreedRate?: number; agreedNote?: string }[];
  payments: { id: string; amount: number }[];
}

/** What the other programs already took in this program's shifts, and what is free (POST /equipment/check). */
export type GearCheck = {
  /** key = "<day id>|<shift id>" */
  slots: Record<string, {
    date: string;
    busyPeople: Record<string, string>;
    busyGear: Record<string, { usedBy: string; where: string }>;
    free: { people: { role: string; total: number; free: number }[]; gear: { kind: string; name: string; total: number; free: number }[] };
  }>;
  clashes: { type: "person" | "gear"; id: string; name: string; date: string; shift: string; other: { number: string; name: string; day: string; shift: string } }[];
  studioGear: { itemId: string; key: string; name: string; kind: string; state: "ok" | "service" | "out" }[];
  memberGear: { key: string; state: "ok" | "service" | "out"; lend: boolean }[];
};

/** People who can be @mentioned in a program's notes: everyone on its shifts (and its editors), or the managers. */
export function notePeople(team: TeamMember[], days: { shifts?: { assignments?: { id: string; role?: string }[] }[] }[] | undefined, editorIds: string[] = []): { id: string; name: string; sub?: string }[] {
  const roles = new Map<string, Set<string>>();
  for (const d of days ?? []) for (const sh of d.shifts ?? []) for (const a of sh.assignments ?? []) {
    if (!a?.id || a.id.startsWith("fl_")) continue;
    if (!roles.has(a.id)) roles.set(a.id, new Set());
    if (a.role) roles.get(a.id)!.add(a.role.replace(/_/g, " "));
  }
  for (const id of editorIds) if (!roles.has(id)) roles.set(id, new Set(["editor"]));
  return [...roles.entries()].flatMap(([id, r]) => {
    const m = team.find(t => t.id === id);
    return m ? [{ id, name: `${m.firstName} ${m.lastName ?? ""}`.trim(), sub: [...r].join(", ") || undefined }] : [];
  });
}
export const managerPeople = (team: TeamMember[]) =>
  team.filter(m => m.role === "manager" && m.isActive !== false).map(m => ({ id: m.id, name: `${m.firstName} ${m.lastName ?? ""}`.trim(), sub: "Manager" }));
