import { AuthService } from './authService';
import { AttendanceService } from './attendanceService';
import { GoogleSheetsService } from './googleSheetsService';

import { getApiBaseUrl } from './apiConfig';

export interface AdmissionSubmission {
  id: string;
  formNo: string;
  formType: 'DJ' | 'EMP';
  firstName: string;
  lastName: string;
  cellPhone: string;
  workPhone?: string;
  email: string;
  aadharNo: string;
  fatherName: string;
  address: string;
  courseOpted: string;
  tenure: string;
  fee: string;
  paymentOption?: 'Full Payment' | '2 Easy Instalments';
  agreedToTerms: boolean;
  signatureName: string;
  photoUrl?: string;
  submittedAt: string;
  status: 'NEW' | 'CONTACTED' | 'ENROLLED' | 'ARCHIVED';
}

const LOCAL_STORAGE_KEY = 'soundabode_admission_submissions';
export const ADMISSION_EVENT_NAME = 'soundabode_admissions_updated';
const API_BASE_URL = getApiBaseUrl();

const INITIAL_ADMISSIONS: AdmissionSubmission[] = [];

let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('soundabode_admissions_channel');
  } catch {
    // Fallback
  }
}

// ─── Real-Time Live SSE Stream Initialization ────────────────────────────────
let liveEventSource: EventSource | null = null;

function initLiveStream() {
  if (typeof window === 'undefined' || !('EventSource' in window)) return;
  if (liveEventSource) return;

  try {
    const sseUrl = `${API_BASE_URL}/live-stream`;
    liveEventSource = new EventSource(sseUrl);

    liveEventSource.addEventListener('ADMISSION_CREATED', (e) => {
      try {
        const item = JSON.parse(e.data);
        if (item && item.id) {
          AdmissionService.handleIncomingLiveAdmission(item);
        }
      } catch (err) {
        console.warn('SSE ADMISSION_CREATED parse error:', err);
      }
    });

    liveEventSource.addEventListener('ADMISSION_UPDATED', (e) => {
      try {
        const item = JSON.parse(e.data);
        if (item && item.id) {
          AdmissionService.handleIncomingLiveUpdate(item);
        }
      } catch (err) {
        console.warn('SSE ADMISSION_UPDATED parse error:', err);
      }
    });

    liveEventSource.addEventListener('ADMISSION_DELETED', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.id) {
          AdmissionService.handleIncomingLiveDelete(data.id);
        }
      } catch (err) {
        console.warn('SSE ADMISSION_DELETED parse error:', err);
      }
    });

    liveEventSource.onerror = () => {
      // EventSource automatically reconnects on error
    };
  } catch (err) {
    console.warn('Failed to initialize SSE stream:', err);
  }
}

if (typeof window !== 'undefined') {
  initLiveStream();
}

type AdmissionListener = (admissions: AdmissionSubmission[]) => void;

export class AdmissionService {
  private static listeners: AdmissionListener[] = [];

  private static isMockAdmission(adm: AdmissionSubmission): boolean {
    return ['adm-101', 'adm-102', 'adm-mock-1', 'adm-mock-2'].includes(adm.id);
  }

  private static deduplicate(admissions: AdmissionSubmission[]): AdmissionSubmission[] {
    const seenIds = new Set<string>();
    const seenFormNos = new Set<string>();
    const result: AdmissionSubmission[] = [];

    for (const a of admissions) {
      if (!a || !a.id || this.isMockAdmission(a)) continue;
      const idKey = a.id;
      const formNoKey = a.formNo ? a.formNo.toLowerCase().trim() : '';

      if (!seenIds.has(idKey) && (!formNoKey || !seenFormNos.has(formNoKey))) {
        seenIds.add(idKey);
        if (formNoKey) seenFormNos.add(formNoKey);
        result.push(a);
      }
    }
    return result;
  }

  public static handleIncomingLiveAdmission(newAdm: AdmissionSubmission): void {
    if (!newAdm || !newAdm.id || this.isMockAdmission(newAdm)) return;
    const current = this.getStoredAdmissions();
    const exists = current.some((a) => a.id === newAdm.id || (a.formNo && a.formNo === newAdm.formNo));
    if (!exists) {
      const merged = [newAdm, ...current];
      merged.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      this.saveAdmissions(merged);
    }
  }

  public static handleIncomingLiveUpdate(updatedAdm: AdmissionSubmission): void {
    if (!updatedAdm || !updatedAdm.id) return;
    const current = this.getStoredAdmissions();
    const index = current.findIndex((a) => a.id === updatedAdm.id);
    if (index !== -1) {
      current[index] = { ...current[index], ...updatedAdm };
      this.saveAdmissions(current);
    } else {
      this.handleIncomingLiveAdmission(updatedAdm);
    }
  }

  public static handleIncomingLiveDelete(id: string): void {
    if (!id) return;
    const current = this.getStoredAdmissions();
    const filtered = current.filter((a) => a.id !== id);
    if (filtered.length !== current.length) {
      this.saveAdmissions(filtered);
    }
  }

  private static getStoredAdmissions(): AdmissionSubmission[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed: AdmissionSubmission[] = JSON.parse(stored);
        const cleanAdmissions = this.deduplicate(parsed);
        return cleanAdmissions;
      }
    } catch {
      // Fallback
    }
    return INITIAL_ADMISSIONS;
  }

  private static notifyChange(admissions: AdmissionSubmission[]): void {
    const cleanAdmissions = this.deduplicate(admissions);
    this.listeners.forEach((listener) => {
      try {
        listener(cleanAdmissions);
      } catch (err) {
        console.error('Error in admission listener:', err);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(ADMISSION_EVENT_NAME, {
          detail: { admissions: cleanAdmissions },
        })
      );
    }

    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: 'ADMISSIONS_UPDATED',
          admissions: cleanAdmissions,
        });
      } catch {
        // Fallback
      }
    }
  }

  private static saveAdmissions(admissions: AdmissionSubmission[]): void {
    try {
      const cleanAdmissions = this.deduplicate(admissions);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleanAdmissions));
      this.notifyChange(cleanAdmissions);
    } catch {
      // Fallback
    }
  }

  public static getAllAdmissions(): AdmissionSubmission[] {
    const local = this.getStoredAdmissions();

    if (typeof window !== 'undefined') {
      fetch(`${API_BASE_URL}/admissions`, {
        headers: AuthService.getAuthHeaders(),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((remoteAdmissions) => {
          if (Array.isArray(remoteAdmissions)) {
            const merged = this.deduplicate([...remoteAdmissions, ...local]);
            merged.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
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

  public static getNextFormNumber(formType: 'DJ' | 'EMP'): string {
    const admissions = this.getStoredAdmissions();
    const typeAdmissions = admissions.filter((a) => a.formType === formType);
    const startSeq = formType === 'DJ' ? 1000 : 2000;

    let maxSeq = startSeq;
    typeAdmissions.forEach((a) => {
      const match = a.formNo.match(/(?:DJ|EMP)-(\d+)/i);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    });

    const nextSeq = maxSeq + 1;
    return `SAS/V-9/${formType}-${nextSeq}`;
  }

  public static subscribe(callback: AdmissionListener): () => void {
    this.listeners.push(callback);

    const storageHandler = (e: StorageEvent) => {
      if (e.key === LOCAL_STORAGE_KEY) {
        callback(this.getStoredAdmissions());
      }
    };

    const channelHandler = (e: MessageEvent) => {
      if (e.data && e.data.type === 'ADMISSIONS_UPDATED') {
        callback(this.getStoredAdmissions());
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

  public static submitAdmissionForm(
    formData: Omit<AdmissionSubmission, 'id' | 'formNo' | 'submittedAt' | 'status'>
  ): AdmissionSubmission {
    const admissions = this.getStoredAdmissions();
    const formNo = this.getNextFormNumber(formData.formType);

    const newAdmission: AdmissionSubmission = {
      ...formData,
      id: `adm-${Date.now()}`,
      formNo,
      submittedAt: new Date().toISOString(),
      status: 'NEW',
    };

    const updated = [newAdmission, ...admissions];
    this.saveAdmissions(updated);

    // Build the Google Sheets payload once for reuse
    const sheetsPayload = {
      source: `Official Admission Application (${newAdmission.formType})`,
      formNo: newAdmission.formNo,
      name: `${newAdmission.firstName} ${newAdmission.lastName}`,
      email: newAdmission.email,
      phone: newAdmission.cellPhone,
      courseInterest: newAdmission.courseOpted,
      message: `Father: ${newAdmission.fatherName} | Aadhar: ${newAdmission.aadharNo} | Tenure: ${newAdmission.tenure} | Fee: ₹${newAdmission.fee} | Payment: ${newAdmission.paymentOption} | Address: ${newAdmission.address}`,
      submittedAt: newAdmission.submittedAt,
    };

    // Always send to Google Sheets as a safety net (client-side)
    GoogleSheetsService.submitToGoogleSheets(sheetsPayload);

    // Sync to backend API (which saves to MongoDB + also forwards to Google Sheets)
    if (typeof window !== 'undefined') {
      fetch(`${API_BASE_URL}/admissions`, {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify(newAdmission),
      })
        .then((res) => res.ok ? res.json() : Promise.reject(new Error(`Server responded with ${res.status}`)))
        .then((data) => {
          if (data && data.mongoSaved === false) {
            console.error(
              '⚠️ CRITICAL: Admission form was received by server but MongoDB save FAILED!',
              'Form:', newAdmission.formNo,
              'Student:', newAdmission.firstName, newAdmission.lastName,
              'Reason:', data.dbError || 'Unknown'
            );
          } else {
            console.log('✅ Admission synced to backend & MongoDB successfully:', newAdmission.formNo);
          }
        })
        .catch((err) => {
          console.error(
            '⚠️ CRITICAL: Backend is UNREACHABLE — admission NOT saved to MongoDB!',
            'Form:', newAdmission.formNo,
            'Student:', newAdmission.firstName, newAdmission.lastName,
            'Error:', err.message
          );
        });
    }

    return newAdmission;
  }

  public static getAdmissionById(id: string): AdmissionSubmission | undefined {
    const admissions = this.getStoredAdmissions();
    return admissions.find((a) => a.id === id);
  }

  public static getAdmissionByFormNo(formNo: string): AdmissionSubmission | undefined {
    const admissions = this.getStoredAdmissions();
    return admissions.find((a) => a.formNo.toLowerCase() === formNo.toLowerCase());
  }

  public static async deleteAdmission(id: string): Promise<boolean> {
    const admissions = this.getStoredAdmissions();
    const filtered = admissions.filter((a) => a.id !== id);
    this.saveAdmissions(filtered);

    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`${API_BASE_URL}/admissions/${id}`, {
          method: 'DELETE',
          headers: AuthService.getAuthHeaders(),
        });
        return res.ok;
      } catch (err) {
        console.warn('Admission delete sync notice:', err);
      }
    }
    return true;
  }

  public static updateStatus(id: string, status: AdmissionSubmission['status']): boolean {
    const admissions = this.getStoredAdmissions();
    const index = admissions.findIndex((a) => a.id === id);
    if (index === -1) return false;

    const target = admissions[index];
    admissions[index] = { ...target, status };
    this.saveAdmissions(admissions);

    // If marked as ENROLLED, automatically add as Enrolled Student
    if (status === 'ENROLLED') {
      try {
        const studentName = `${target.firstName} ${target.lastName}`.trim();
        const existingStudents = AttendanceService.getAllStudents();
        const alreadyExists = existingStudents.some(
          (s) => s.name.toLowerCase() === studentName.toLowerCase() || (target.email && s.email === target.email)
        );

        if (!alreadyExists) {
          AttendanceService.addStudent({
            name: studentName,
            email: target.email || '',
            phone: target.cellPhone || '',
            course: target.courseOpted || (target.formType === 'DJ' ? 'DJ Training Course' : 'EMP Production'),
            batch: `${target.formType === 'DJ' ? 'Regular DJ Studio Batch' : 'Regular EMP Studio Batch'}`,
            enrolledDate: new Date().toISOString().split('T')[0],
          });
        }
      } catch (err) {
        console.warn('Auto student enrollment error:', err);
      }
    }

    // Sync status update to backend API
    if (typeof window !== 'undefined') {
      fetch(`${API_BASE_URL}/admissions/${id}`, {
        method: 'PATCH',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify({ status }),
      }).catch((err) => console.warn('Admission status backend sync notice:', err));
    }

    return true;
  }
}
