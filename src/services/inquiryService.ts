import { AuthService } from './authService';
import { GoogleSheetsService } from './googleSheetsService';

import { getApiBaseUrl } from './apiConfig';

export interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  courseInterest: string;
  message: string;
  source?: string;
  submittedAt: string;
  status: 'NEW' | 'CONTACTED' | 'ENROLLED' | 'ARCHIVED';
  notes?: string;
}

const INITIAL_INQUIRIES: ContactInquiry[] = [];

const LOCAL_STORAGE_KEY = 'soundabode_student_inquiries';
export const INQUIRY_EVENT_NAME = 'soundabode_inquiries_updated';
const API_BASE_URL = getApiBaseUrl();

// Cross-tab BroadcastChannel
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('soundabode_inquiries_channel');
  } catch {
    // Channel initialization fallback
  }
}

type InquiryListener = (inquiries: ContactInquiry[], newInquiry?: ContactInquiry) => void;

export class InquiryService {
  private static listeners: InquiryListener[] = [];

  private static isMockInquiry(inquiry: ContactInquiry): boolean {
    return ['inq-101', 'inq-102', 'inq-103', 'inq-301', 'inq-302', 'inq-303'].includes(inquiry.id);
  }

  private static isAdmissionFormInquiry(inquiry: ContactInquiry): boolean {
    if (!inquiry) return false;
    const course = (inquiry.courseInterest || '').toUpperCase();
    const msg = (inquiry.message || '').toUpperCase();
    return course.includes('[ADMISSION FORM') || msg.includes('OFFICIAL ADMISSION FORM APPLICATION');
  }

  private static isInvalidInquiry(inquiry: ContactInquiry): boolean {
    return this.isMockInquiry(inquiry) || this.isAdmissionFormInquiry(inquiry);
  }

  private static getStoredInquiries(): ContactInquiry[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed: ContactInquiry[] = JSON.parse(stored);
        const realInquiries = parsed.filter((i) => !this.isInvalidInquiry(i));
        if (realInquiries.length !== parsed.length) {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(realInquiries));
        }
        return realInquiries;
      }
    } catch {
      // Fallback
    }
    return INITIAL_INQUIRIES;
  }

  private static notifyChange(inquiries: ContactInquiry[], newInquiry?: ContactInquiry): void {
    const cleanInquiries = inquiries.filter((i) => !this.isInvalidInquiry(i));
    // 1. In-process listeners
    this.listeners.forEach((listener) => {
      try {
        listener(cleanInquiries, newInquiry);
      } catch (err) {
        console.error('Error in inquiry listener:', err);
      }
    });

    // 2. Dispatch window event for single-page app components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(INQUIRY_EVENT_NAME, {
          detail: { inquiries: cleanInquiries, newInquiry },
        })
      );
    }

    // 3. Broadcast to other open browser tabs
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: 'INQUIRIES_UPDATED',
          inquiries: cleanInquiries,
          newInquiry,
        });
      } catch {
        // Channel post error fallback
      }
    }
  }

  private static saveInquiries(inquiries: ContactInquiry[], newInquiry?: ContactInquiry): void {
    try {
      const cleanInquiries = inquiries.filter((i) => !this.isInvalidInquiry(i));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanInquiries));
      this.notifyChange(cleanInquiries, newInquiry);
    } catch {
      // Fallback
    }
  }

  public static getAllInquiries(): ContactInquiry[] {
    if (typeof window !== 'undefined') {
      fetch(`${API_BASE_URL}/inquiries`)
        .then((res) => (res.ok ? res.json() : null))
        .then((remoteInquiries) => {
          if (Array.isArray(remoteInquiries)) {
            const realInquiries = remoteInquiries.filter((i: ContactInquiry) => !this.isInvalidInquiry(i));
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(realInquiries));
            this.notifyChange(realInquiries);
          }
        })
        .catch(() => {});
    }
    return this.getStoredInquiries();
  }

  public static subscribe(callback: InquiryListener): () => void {
    this.listeners.push(callback);

    // Cross-tab storage listener
    const storageHandler = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY) {
        const inquiries = this.getStoredInquiries();
        callback(inquiries);
      }
    };

    // Cross-tab broadcast listener
    const broadcastHandler = (event: MessageEvent) => {
      if (event.data?.type === 'INQUIRIES_UPDATED') {
        const inquiries = this.getStoredInquiries();
        callback(inquiries, event.data?.newInquiry);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', storageHandler);
    }

    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', broadcastHandler);
    }

    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', storageHandler);
      }
      if (broadcastChannel) {
        broadcastChannel.removeEventListener('message', broadcastHandler);
      }
    };
  }

  public static addInquiry(inquiry: Omit<ContactInquiry, 'id' | 'submittedAt' | 'status'>): ContactInquiry {
    const inquiries = this.getStoredInquiries();
    const newInquiry: ContactInquiry = {
      ...inquiry,
      id: `inq-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      status: 'NEW',
    };
    const updated = [newInquiry, ...inquiries];
    this.saveInquiries(updated, newInquiry);

    // Submit to Google Sheets and sync to MongoDB Atlas backend
    if (typeof window !== 'undefined') {
      // 1. Client-side submission to Google Sheets
      GoogleSheetsService.submitToGoogleSheets({
        source: newInquiry.source || (newInquiry.message?.includes('Pop-up') ? 'Pop-up Quick Enquiry Form' : 'Contact Form'),
        name: newInquiry.name,
        email: newInquiry.email,
        phone: newInquiry.phone,
        courseInterest: newInquiry.courseInterest,
        message: newInquiry.message,
        submittedAt: newInquiry.submittedAt,
      }).catch((err) => console.warn('Google Sheets client notice:', err));

      // 2. Sync to MongoDB Atlas backend (saves to MongoDB InquiryModel)
      fetch(`${API_BASE_URL}/inquiries`, {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify(newInquiry),
      }).catch((err) => {
        console.warn('Atlas sync notice:', err);
      });
    }

    return newInquiry;
  }

  public static updateInquiryStatus(
    id: string,
    status: ContactInquiry['status'],
    notes?: string
  ): ContactInquiry | null {
    const inquiries = this.getStoredInquiries();
    const index = inquiries.findIndex((i) => i.id === id);
    if (index === -1) return null;

    inquiries[index] = {
      ...inquiries[index],
      status,
      ...(notes !== undefined ? { notes } : {}),
    };
    this.saveInquiries(inquiries);

    // Sync to MongoDB Atlas backend
    if (typeof window !== 'undefined') {
      fetch(`${API_BASE_URL}/inquiries/${id}`, {
        method: 'PATCH',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify({ status, ...(notes !== undefined ? { notes } : {}) }),
      }).catch((err) => console.warn('Atlas update notice:', err));
    }

    return inquiries[index];
  }

  public static deleteInquiry(id: string): boolean {
    let inquiries = this.getStoredInquiries();
    const initialLength = inquiries.length;
    inquiries = inquiries.filter((i) => i.id !== id);
    if (inquiries.length !== initialLength) {
      this.saveInquiries(inquiries);

      // Sync to MongoDB Atlas backend
      if (typeof window !== 'undefined') {
        fetch(`${API_BASE_URL}/inquiries/${id}`, {
          method: 'DELETE',
          headers: AuthService.getAuthHeaders(),
        }).catch((err) => console.warn('Atlas delete notice:', err));
      }

      return true;
    }
    return false;
  }
}
