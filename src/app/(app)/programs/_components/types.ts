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
  roleRates?: { roleId: string; rate: number; rateType: string; withSetup?: number; workType?: string; label?: string; note?: string }[];
  setup?: { id: string; category: string; name: string; rent: number; rentUnit: string }[];
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
  /** For "rented": shop, item, amount; who paid (studio, or the member → refunded on their bill). */
  rental?: { vendor: string; item: string; amount: number; paidBy: "studio" | "member" };
}

export interface Shift {
  id: string;
  label: string;
  assignments: ShiftAssignment[];
}

export interface EventDay {
  id: string;
  /** Program type id from Settings → Work types (e.g. "muslim-wedding"); same on every day. */
  programType?: string;
  eventType: string;
  date: string;
  location: string;
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
}

export interface CostEntry {
  id: string;
  role: string;
  memberId?: string;
  memberName: string;
  totalBill: number;
  paidAmount?: number;
  note?: string;
  /** Itemised bill (new form). totalBill = sum of lines (deductions subtract). */
  lines?: BillLine[];
}

export interface Booking {
  id: string;
  bookingNumber: string;
  eventName?: string;
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
