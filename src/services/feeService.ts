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
  createdAt?: string;
  updatedAt?: string;
}

const LOCAL_STORAGE_KEY = 'soundabode_cms_fees';
export const FEES_EVENT_NAME = 'soundabode_fees_updated';
const API_BASE_URL = getApiBaseUrl();

let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('soundabode_fees_channel');
  } catch {
    // Fallback
  }
}

// ─── Real-Time Live SSE Stream Listener for Fees ─────────────────────────────
let liveEventSource: EventSource | null = null;

function initFeesLiveStream() {
  if (typeof window === 'undefined' || !('EventSource' in window)) return;
  if (liveEventSource) return;

  try {
    const sseUrl = `${API_BASE_URL}/live-stream`;
    liveEventSource = new EventSource(sseUrl);

    liveEventSource.addEventListener('FEE_RECEIPT_CREATED', (e) => {
      try {
        const item = JSON.parse(e.data);
        if (item && item.id) {
          FeeService.handleIncomingLiveFee(item);
        }
      } catch (err) {
        console.warn('SSE FEE_RECEIPT_CREATED parse error:', err);
      }
    });

    liveEventSource.addEventListener('FEE_RECEIPT_UPDATED', (e) => {
      try {
        const item = JSON.parse(e.data);
        if (item && item.id) {
          FeeService.handleIncomingLiveUpdate(item);
        }
      } catch (err) {
        console.warn('SSE FEE_RECEIPT_UPDATED parse error:', err);
      }
    });

    liveEventSource.addEventListener('FEE_RECEIPT_DELETED', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.id) {
          FeeService.handleIncomingLiveDelete(data.id);
        }
      } catch (err) {
        console.warn('SSE FEE_RECEIPT_DELETED parse error:', err);
      }
    });
  } catch (err) {
    console.warn('Failed to initialize Fees SSE stream:', err);
  }
}

if (typeof window !== 'undefined') {
  initFeesLiveStream();
}

type FeeListener = (fees: FeeReceipt[]) => void;

export class FeeService {
  private static listeners: FeeListener[] = [];

  private static deduplicate(receipts: FeeReceipt[]): FeeReceipt[] {
    const seenIds = new Set<string>();
    const result: FeeReceipt[] = [];

    for (const r of receipts) {
      if (!r || !r.id) continue;
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        result.push(r);
      }
    }
    return result;
  }

  private static getStoredFees(): FeeReceipt[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed: FeeReceipt[] = JSON.parse(stored);
        return this.deduplicate(parsed);
      }
    } catch {
      // Fallback
    }
    return [];
  }

  private static notifyChange(fees: FeeReceipt[]): void {
    const cleanFees = this.deduplicate(fees);
    this.listeners.forEach((listener) => {
      try {
        listener(cleanFees);
      } catch (err) {
        console.error('Error in fee listener:', err);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(FEES_EVENT_NAME, {
          detail: { fees: cleanFees },
        })
      );
    }

    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: 'FEES_UPDATED',
          fees: cleanFees,
        });
      } catch {
        // Fallback
      }
    }
  }

  public static saveFeesLocally(fees: FeeReceipt[]): void {
    try {
      const cleanFees = this.deduplicate(fees);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanFees));
      this.notifyChange(cleanFees);
    } catch {
      // Fallback
    }
  }

  public static handleIncomingLiveFee(newFee: FeeReceipt): void {
    if (!newFee || !newFee.id) return;
    const current = this.getStoredFees();
    const exists = current.some((f) => f.id === newFee.id);
    if (!exists) {
      const merged = [newFee, ...current];
      this.saveFeesLocally(merged);
    }
  }

  public static handleIncomingLiveUpdate(updatedFee: FeeReceipt): void {
    if (!updatedFee || !updatedFee.id) return;
    const current = this.getStoredFees();
    const index = current.findIndex((f) => f.id === updatedFee.id);
    if (index !== -1) {
      current[index] = { ...current[index], ...updatedFee };
      this.saveFeesLocally(current);
    } else {
      this.handleIncomingLiveFee(updatedFee);
    }
  }

  public static handleIncomingLiveDelete(id: string): void {
    if (!id) return;
    const current = this.getStoredFees();
    const filtered = current.filter((f) => f.id !== id);
    if (filtered.length !== current.length) {
      this.saveFeesLocally(filtered);
    }
  }

  /**
   * Retrieves all fee receipts from cache and syncs with remote MongoDB.
   * Also automatically pushes any un-synced local receipts to MongoDB Atlas.
   */
  public static getAllFees(): FeeReceipt[] {
    const local = this.getStoredFees();

    if (typeof window !== 'undefined') {
      fetch(`${API_BASE_URL}/fees`, {
        headers: AuthService.getAuthHeaders(),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((remoteFees) => {
          if (Array.isArray(remoteFees)) {
            const remoteIdSet = new Set(remoteFees.map((r: FeeReceipt) => r.id));
            const unSyncedLocal = local.filter((l) => !remoteIdSet.has(l.id));

            if (unSyncedLocal.length > 0) {
              unSyncedLocal.forEach((unsynced) => {
                fetch(`${API_BASE_URL}/fees`, {
                  method: 'POST',
                  headers: AuthService.getAuthHeaders(),
                  body: JSON.stringify(unsynced),
                }).catch(() => {});
              });
            }

            const merged = this.deduplicate([...remoteFees, ...local]);
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
            } catch {}
            this.notifyChange(merged);
          }
        })
        .catch(() => {});
    }
    return local;
  }

  public static getNextReceiptNo(existingFees?: FeeReceipt[]): string {
    const fees = existingFees || this.getStoredFees();
    if (fees.length === 0) return '001';
    const nums = fees.map((f) => parseInt(f.receiptNo, 10)).filter(Boolean);
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return String(max + 1).padStart(3, '0');
  }

  public static async saveFee(receipt: FeeReceipt): Promise<FeeReceipt> {
    const currentFees = this.getStoredFees();
    const index = currentFees.findIndex((r) => r.id === receipt.id);
    let updated: FeeReceipt[];

    if (index !== -1) {
      updated = currentFees.map((r) => (r.id === receipt.id ? { ...r, ...receipt } : r));
    } else {
      updated = [receipt, ...currentFees];
    }

    this.saveFeesLocally(updated);

    // Sync to backend MongoDB
    if (typeof window !== 'undefined') {
      try {
        const method = index !== -1 ? 'PATCH' : 'POST';
        const url = index !== -1 ? `${API_BASE_URL}/fees/${receipt.id}` : `${API_BASE_URL}/fees`;

        const res = await fetch(url, {
          method,
          headers: AuthService.getAuthHeaders(),
          body: JSON.stringify(receipt),
        });
        if (res.ok) {
          const savedDoc = await res.json();
          if (savedDoc && savedDoc.id) {
            return savedDoc;
          }
        }
      } catch (err) {
        console.warn('Backend fee sync notice:', err);
      }
    }

    return receipt;
  }

  public static async deleteFee(id: string): Promise<boolean> {
    const currentFees = this.getStoredFees();
    const filtered = currentFees.filter((r) => r.id !== id);
    this.saveFeesLocally(filtered);

    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`${API_BASE_URL}/fees/${id}`, {
          method: 'DELETE',
          headers: AuthService.getAuthHeaders(),
        });
        return res.ok;
      } catch (err) {
        console.warn('Backend fee delete notice:', err);
      }
    }
    return true;
  }

  public static subscribe(callback: FeeListener): () => void {
    this.listeners.push(callback);

    const storageHandler = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY) {
        callback(this.getStoredFees());
      }
    };

    const channelHandler = (e: MessageEvent) => {
      if (e.data && e.data.type === 'FEES_UPDATED') {
        callback(this.getStoredFees());
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', storageHandler);
      if (broadcastChannel) {
        broadcastChannel.addEventListener('message', channelHandler);
      }
    }

    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', storageHandler);
        if (broadcastChannel) {
          broadcastChannel.removeEventListener('message', channelHandler);
        }
      }
    };
  }
}
