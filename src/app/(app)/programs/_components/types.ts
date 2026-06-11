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
  memberRoles: string[];
  roleRates?: { roleId: string; rate: number; rateType: string; note?: string }[];
}

export interface Shift {
  id: string;
  label: string;
  memberIds: string[];
}

export interface EventDay {
  id: string;
  eventType: string;
  date: string;
  location: string;
  shifts: Shift[];
}

export interface CostEntry {
  id: string;
  role: string;
  memberId?: string;
  memberName: string;
  totalBill: number;
  note?: string;
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
  eventDays: EventDay[];
  costEntries: CostEntry[];
  client: { id: string; firstName: string; lastName?: string; phone?: string };
  program?: { id: string; name: string };
  team: { userId: string; roleInBooking?: string; agreedRate?: number; agreedNote?: string }[];
  payments: { id: string; amount: number }[];
}
