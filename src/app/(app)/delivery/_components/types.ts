export interface DeliveryLink { id: string; title: string; url: string }

export interface Booking {
  id: string;
  bookingNumber: string;
  eventName?: string;
  status: string;
  eventDate?: string;
  eventLocation?: string;
  currency: string;
  grandTotal: number;
  paidAmount: number;
  deliveryLink?: string;
  deliveryLinks?: DeliveryLink[];
  deliveryNote?: string;
  deliveryDate?: string;
  driveFolderUrl?: string;
  driveDeliveredAt?: string;
  client: { id: string; firstName: string; lastName?: string; phone?: string };
}

export interface R2File {
  id: string;
  fileName: string;
  fileKey: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  viewUrl?: string;
  downloadUrl: string;
  folderName?: string | null;
}

export interface DriveFile {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  folderName: string | null;
  viewUrl: string | null;
  downloadUrl: string | null;
}

export interface UploadItem { file: File; progress: number; done: boolean; error?: string }
