import { AuthService } from './authService';
import { getApiBaseUrl } from './apiConfig';

export interface FeeReceipt {
  id: string;
  receiptNo: string;
  studentName: string;
  courseName: string;
  amount: number;
  paymentMode: string;
  periodFrom: string;
  periodTo: string;
  date: string;
  comment: string;
}

const FEES_STORAGE_KEY = 'soundabode_cms_fees';
const API_BASE_URL = getApiBaseUrl();

const sortReceipts = (receipts: FeeReceipt[]) => [...receipts].sort((a, b) =>
  `${b.date || ''}${b.id}`.localeCompare(`${a.date || ''}${a.id}`)
);

export class FeeService {
  static getCached(): FeeReceipt[] {
    try {
      const stored = JSON.parse(localStorage.getItem(FEES_STORAGE_KEY) || '[]');
      return Array.isArray(stored) ? sortReceipts(stored) : [];
    } catch { return []; }
  }

  static cache(receipts: FeeReceipt[]): FeeReceipt[] {
    const sorted = sortReceipts(receipts);
    try { localStorage.setItem(FEES_STORAGE_KEY, JSON.stringify(sorted)); } catch {}
    return sorted;
  }

  static async fetchAll(): Promise<FeeReceipt[] | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/fees`, { headers: AuthService.getAuthHeaders() });
      if (!response.ok) return null;
      const receipts = await response.json();
      return Array.isArray(receipts) ? sortReceipts(receipts) : null;
    } catch { return null; }
  }

  /** Sync old browser-only receipts once, then use MongoDB as the shared source. */
  static async fetchAndSync(): Promise<FeeReceipt[]> {
    const remote = await this.fetchAll();
    if (remote === null) return this.getCached();
    const localOnly = this.getCached().filter((local) => !remote.some((receipt) => receipt.id === local.id));
    if (localOnly.length) {
      await Promise.all(localOnly.map((receipt) => this.save(receipt)));
      const refreshed = await this.fetchAll();
      if (refreshed !== null) return this.cache(refreshed);
    }
    return this.cache(remote);
  }

  static async save(receipt: FeeReceipt): Promise<FeeReceipt | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/fees`, { method: 'POST', headers: AuthService.getAuthHeaders(), body: JSON.stringify(receipt) });
      return response.ok ? await response.json() : null;
    } catch { return null; }
  }

  static async update(id: string, updates: Partial<FeeReceipt>): Promise<FeeReceipt | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/fees/${encodeURIComponent(id)}`, { method: 'PATCH', headers: AuthService.getAuthHeaders(), body: JSON.stringify(updates) });
      return response.ok ? await response.json() : null;
    } catch { return null; }
  }

  static async delete(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/fees/${encodeURIComponent(id)}`, { method: 'DELETE', headers: AuthService.getAuthHeaders() });
      return response.ok;
    } catch { return false; }
  }
}
