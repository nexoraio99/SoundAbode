import { AuthService } from './authService';
import { GoogleSheetsService } from './googleSheetsService';
import { getStoredAttribution, refreshBrowserSignals, LeadAttribution, trackLeadConversionEvent } from '../utils/attribution';

import { getApiBaseUrl } from './apiConfig';

export interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  courseInterest: string;
  message: string;
  source?: string;
  attribution?: LeadAttribution;
  submittedAt: string;
  status: 'NEW' | 'CONTACTED' | 'ENROLLED' | 'ARCHIVED';
  notes?: string;
  metaLeadId?: string;
  adName?: string;
  campaignName?: string;
  formName?: string;
  assignedTo?: string;
  assignedToName?: string;
  assignedBy?: string;
  assignedAt?: string | null;
  archiveReason?: string;
  archiveNote?: string;
  statusUpdatedBy?: string;
  statusUpdatedAt?: string | null;
}

export type LeadStatus = ContactInquiry['status'];

export interface TeamMember {
  email: string;
  name: string;
  role: 'admin' | 'teacher';
}

/** Must match ARCHIVE_REASONS in server/index.js */
export const ARCHIVE_REASONS = [
  'Did not respond',
  'Did not enquire',
  'Not interested',
  'Fees / budget too high',
  'Joined another academy',
  'Timing / location issue',
  'Invalid contact details',
  'Duplicate lead',
  'Other',
] as const;

export interface LeadUpdate {
  status?: LeadStatus;
  archiveReason?: string;
  archiveNote?: string;
  notes?: string;
  assignedTo?: string;
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
        // A cache written during an admin session may still be on this device —
        // non-admins only ever see leads assigned to them.
        const user = AuthService.getCurrentUser();
        if (user && user.role !== 'admin') {
          const email = user.email.toLowerCase();
          return parsed.filter((i) => !this.isInvalidInquiry(i) && (i.assignedTo || '').toLowerCase() === email);
        }
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
      fetch(`${API_BASE_URL}/inquiries`, {
        headers: AuthService.getAuthHeaders(),
      })
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
    const attribution = {
      ...(inquiry.attribution || getStoredAttribution()),
      ...refreshBrowserSignals(), // Inject fresh _fbp, _fbc, user_agent for CAPI match quality
    };
    const newInquiry: ContactInquiry = {
      ...inquiry,
      attribution,
      id: `inq-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      status: 'NEW',
    };
    const updated = [newInquiry, ...inquiries];
    this.saveInquiries(updated, newInquiry);

    // Fire Lead conversion event to Meta Pixel (Lead) & Google Analytics (generate_lead)
    trackLeadConversionEvent({
      course: newInquiry.courseInterest,
      source: newInquiry.attribution?.source || newInquiry.source || 'Direct',
    });

    // Primary: Sync to backend API (backend handles Google Sheets forwarding with deduplication)
    // Fallback: If backend is offline/unreachable, submit directly to Google Sheets from client
    if (typeof window !== 'undefined') {
      fetch(`${API_BASE_URL}/inquiries`, {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify(newInquiry),
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error ${res.status}`);
          }
        })
        .catch((err) => {
          console.warn('Backend sync notice (falling back to client Google Sheets):', err);
          GoogleSheetsService.submitToGoogleSheets({
            source: newInquiry.source || (newInquiry.message?.includes('Pop-up') ? 'Pop-up Quick Enquiry Form' : 'Contact Form'),
            name: newInquiry.name,
            email: newInquiry.email,
            phone: newInquiry.phone,
            courseInterest: newInquiry.courseInterest,
            message: newInquiry.message,
            submittedAt: newInquiry.submittedAt,
          }).catch((gsErr) => console.warn('Google Sheets fallback notice:', gsErr));
        });
    }

    return newInquiry;
  }

  /**
   * Apply a CMS change (stage, archive reason, notes, assignment) optimistically,
   * then persist it. If the server rejects it, local data is re-synced from the
   * server and the error message is returned.
   */
  public static async updateLead(id: string, update: LeadUpdate): Promise<{ ok: boolean; error?: string }> {
    const inquiries = this.getStoredInquiries();
    const index = inquiries.findIndex((i) => i.id === id);
    if (index !== -1) {
      const next: ContactInquiry = { ...inquiries[index], ...update };
      if (update.status && update.status !== 'ARCHIVED') {
        next.archiveReason = '';
        next.archiveNote = '';
      }
      if (update.assignedTo !== undefined && !update.assignedTo) next.assignedToName = '';
      inquiries[index] = next;
      this.saveInquiries(inquiries);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/inquiries/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify(update),
      });
      if (res.ok) {
        const saved: ContactInquiry = await res.json();
        const latest = this.getStoredInquiries().map((i) => (i.id === id ? { ...i, ...saved } : i));
        this.saveInquiries(latest);
        return { ok: true };
      }
      const data = await res.json().catch(() => ({}));
      this.getAllInquiries();
      return { ok: false, error: data.error || `Could not save (HTTP ${res.status}).` };
    } catch {
      this.getAllInquiries();
      return { ok: false, error: 'Network error — change was not saved.' };
    }
  }

  public static updateInquiryStatus(
    id: string,
    status: ContactInquiry['status'],
    notes?: string
  ): Promise<{ ok: boolean; error?: string }> {
    return this.updateLead(id, { status, ...(notes !== undefined ? { notes } : {}) });
  }

  /** Team members an admin can assign leads to. */
  public static async fetchTeam(): Promise<TeamMember[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/team`, { headers: AuthService.getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.team)) return data.team;
      }
    } catch {
      // Offline — assignment menus stay empty
    }
    return [];
  }

  public static async deleteInquiry(id: string): Promise<boolean> {
    let inquiries = this.getStoredInquiries();
    inquiries = inquiries.filter((i) => i.id !== id);
    this.saveInquiries(inquiries);

    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`${API_BASE_URL}/inquiries/${id}`, {
          method: 'DELETE',
          headers: AuthService.getAuthHeaders(),
        });
        return res.ok;
      } catch (err) {
        console.warn('Atlas delete notice:', err);
      }
    }
    return true;
  }

  public static async getMetaWebhookStatus(): Promise<{
    status: string;
    verifyTokenConfigured: boolean;
    appSecretConfigured: boolean;
    pageAccessTokenConfigured: boolean;
    capiTokenConfigured: boolean;
    tokenStatus?: string;
    tokenError?: string;
    verifyToken: string;
    webhookEndpoint: string;
  }> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`${API_BASE_URL}/webhooks/meta-leads/status`, {
          headers: AuthService.getAuthHeaders(),
        });
        if (res.ok) {
          return await res.json();
        }
      } catch {
        // Fallback
      }
    }
    // Server unreachable: report that, rather than a made-up "configured" state
    return {
      status: 'offline',
      verifyTokenConfigured: false,
      appSecretConfigured: false,
      pageAccessTokenConfigured: false,
      capiTokenConfigured: false,
      tokenStatus: 'unknown',
      tokenError: 'Could not reach the server to check the Meta connection.',
      verifyToken: '',
      webhookEndpoint: '/api/webhooks/meta-leads',
    };
  }

  /**
   * Sync Meta leads: cleans up fake test leads and re-fetches real lead data
   * from Meta Graph API for any leads that couldn't be fetched originally.
   */
  public static async syncMetaLeads(): Promise<{
    success: boolean;
    synced: number;
    cleaned: number;
    failed: number;
    details: Array<{ id: string; action: string; reason?: string; name?: string }>;
  }> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`${API_BASE_URL}/webhooks/meta-leads/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...AuthService.getAuthHeaders(),
          },
        });
        if (res.ok) {
          return await res.json();
        }
        const errData = await res.json().catch(() => ({}));
        return { success: false, synced: 0, cleaned: 0, failed: 0, details: [{ id: '', action: 'error', reason: errData.error || `HTTP ${res.status}` }] };
      } catch (err: any) {
        return { success: false, synced: 0, cleaned: 0, failed: 0, details: [{ id: '', action: 'error', reason: err?.message || 'Network error' }] };
      }
    }
    return { success: false, synced: 0, cleaned: 0, failed: 0, details: [] };
  }
}

