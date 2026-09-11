import { AuthService, CmsUser } from './authService';
import { getApiBaseUrl } from './apiConfig';

export interface EnrolledStudent {
  id: string;
  name: string;
  email: string;
  phone: string;
  course: string;
  batch: string;
  avatarUrl?: string;
  enrolledDate: string;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'PRACTICE_SESSION' | 'GROUP_SESSION' | 'NA';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD format
  timeSlot: string; // e.g. "11:00 AM - 01:00 PM"
  status: AttendanceStatus;
  comment: string;
  markedBy: string; // email or user id
  markedByName: string; // e.g. "Ashu", "Vaibhav", "Vrishan", "Soundabode Admin"
  markedByRole: 'admin' | 'teacher';
  updatedAt: string;
}

const INITIAL_STUDENTS: EnrolledStudent[] = [
  {
    id: 'std-001',
    name: 'Shailendra Chakravarthy',
    email: 'shailendrachakravarthy8@gmail.com',
    phone: '9866514403/9307031006',
    course: 'Complete DJ training course',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-01',
  },
  {
    id: 'std-002',
    name: 'Deeksha Vishwakarma',
    email: 'deekshavishwakarma705@gmail.com',
    phone: '8319948935/8819007910',
    course: 'Complete DJ training course',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-01',
  },
  {
    id: 'std-003',
    name: 'Sonal Shandilya',
    email: 'Sha.sonal@gmail.com',
    phone: '9798880002',
    course: 'Basic DJ training course',
    batch: 'Weekend Batch',
    enrolledDate: '2026-08-02',
  },
  {
    id: 'std-004',
    name: 'Ridhima Deshpande',
    email: 'ridhimadeshpande990@gmail.com',
    phone: '9527556666',
    course: 'Special 3 months rekordbox course - 50,000',
    batch: 'Special Batch',
    enrolledDate: '2026-08-03',
  },
  {
    id: 'std-005',
    name: 'Pranavadeep Bagul',
    email: 'pranavdeeponly@gmail.com',
    phone: '9322060312',
    course: 'Beginner electronic music production',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-04',
  },
  {
    id: 'std-006',
    name: 'Anuj Aware',
    email: 'anujawasare0457@gmail.com',
    phone: '8975066947',
    course: 'Basic DJ training',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-05',
  },
  {
    id: 'std-007',
    name: 'Chaitanya Jain',
    email: 'djchaitanyajain100@gmail.com',
    phone: '9172902597',
    course: 'Beginner electronic music production',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-06',
  },
  {
    id: 'std-008',
    name: 'Kush Kachoriya',
    email: 'Kk.wav.work@gmail.com',
    phone: '7046029474',
    course: 'Beginner electronic music production',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-07',
  },
  {
    id: 'std-009',
    name: 'Yogesh Kashid',
    email: 'kashidyogesh096@gmail.com',
    phone: '7875547537',
    course: 'Basic DJ training course plus DJ training crash course',
    batch: 'Crash Course Batch',
    enrolledDate: '2026-08-08',
  },
  {
    id: 'std-010',
    name: 'Rohit Govvilkar',
    email: 'rohietgovvilkar@gmail.com',
    phone: '8767607223',
    course: 'Basic training course',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-09',
  },
  {
    id: 'std-011',
    name: 'Devansh Prasad',
    email: 'regurgmusic@gmail.com',
    phone: '9381340066',
    course: 'Basic DJ training course',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-10',
  },
  {
    id: 'std-012',
    name: 'Tavjot Singh',
    email: 'tavjyotsingh76782222@gmail.com',
    phone: '7678115930',
    course: 'Complete DJ training course',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-11',
  },
  {
    id: 'std-013',
    name: 'Sharvil Sonawane',
    email: '',
    phone: '9158979991/9049499991',
    course: 'Beginner electronic music production',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-12',
  },
];

const INITIAL_ATTENDANCE: AttendanceRecord[] = [];

const STUDENTS_STORAGE_KEY = 'soundabode_enrolled_students';
const ATTENDANCE_EVENT_NAME = 'soundabode_attendance_updated';
const API_BASE_URL = getApiBaseUrl();

type AttendanceListener = (records: AttendanceRecord[]) => void;

function getAttendanceStorageKey(user?: CmsUser | null): string {
  const u = user || AuthService.getCurrentUser();
  if (!u) return 'soundabode_attendance_records_guest';
  const cleanEmail = (u.email || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `soundabode_attendance_records_${u.role}_${cleanEmail}`;
}

// ─── Real-Time Live SSE Stream Initialization for Attendance ─────────────────
let liveAttendanceEventSource: EventSource | null = null;

function initAttendanceLiveStream() {
  if (typeof window === 'undefined' || !('EventSource' in window)) return;
  if (liveAttendanceEventSource) return;

  try {
    const sseUrl = `${API_BASE_URL}/live-stream`;
    liveAttendanceEventSource = new EventSource(sseUrl);

    liveAttendanceEventSource.addEventListener('ATTENDANCE_SAVED', (e: MessageEvent) => {
      try {
        const item = JSON.parse(e.data);
        if (item && item.id) {
          AttendanceService.handleIncomingLiveAttendance(item);
        }
      } catch (err) {
        console.warn('SSE ATTENDANCE_SAVED parse error:', err);
      }
    });

    liveAttendanceEventSource.addEventListener('ATTENDANCE_DELETED', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.id) {
          AttendanceService.handleIncomingLiveDelete(data.id);
        }
      } catch (err) {
        console.warn('SSE ATTENDANCE_DELETED parse error:', err);
      }
    });

    liveAttendanceEventSource.addEventListener('ATTENDANCE_PURGED', () => {
      AttendanceService.handleIncomingLivePurge();
    });

    liveAttendanceEventSource.onerror = () => {
      // EventSource auto-reconnects
    };
  } catch (err) {
    console.warn('Failed to initialize Attendance SSE stream:', err);
  }
}

if (typeof window !== 'undefined') {
  initAttendanceLiveStream();
}

export class AttendanceService {
  private static listeners: AttendanceListener[] = [];

  public static subscribe(listener: AttendanceListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private static notifyChange(records: AttendanceRecord[]): void {
    this.listeners.forEach((l) => {
      try {
        l(records);
      } catch {}
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ATTENDANCE_EVENT_NAME, { detail: { records } }));
    }
  }

  private static saveStudents(students: EnrolledStudent[]): void {
    try {
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));
    } catch {
      // Fallback
    }
  }

  private static getStoredStudents(): EnrolledStudent[] {
    try {
      const stored = localStorage.getItem(STUDENTS_STORAGE_KEY);
      if (stored) {
        const parsed: EnrolledStudent[] = JSON.parse(stored);
        const mockIds = ['std-101', 'std-201', 'std-202', 'std-203', 'std-204', 'std-205', 'std-206', 'std-207', 'std-208', 'std-209', 'std-210', 'std-211', 'std-212', 'std-213', 'std-214', 'std-215', 'std-216', 'std-217', 'std-218'];
        const realStudents = parsed.filter((s) => !mockIds.includes(s.id));
        if (realStudents.length > 0) {
          if (realStudents.length !== parsed.length) {
            this.saveStudents(realStudents);
          }
          return realStudents;
        }
      }
    } catch {
      // Fallback
    }
    this.saveStudents(INITIAL_STUDENTS);
    return INITIAL_STUDENTS;
  }

  private static getStoredAttendance(user?: CmsUser | null): AttendanceRecord[] {
    try {
      const storageKey = getAttendanceStorageKey(user);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: AttendanceRecord[] = JSON.parse(stored);
        const filtered = parsed.filter(
          (r) => r && !['att-201', 'att-202', 'att-203', 'att-204'].includes(r.id)
        );
        return filtered;
      }
    } catch {
      // Fallback
    }
    return INITIAL_ATTENDANCE;
  }

  public static clearAllAttendance(): void {
    const storageKey = getAttendanceStorageKey();
    try {
      localStorage.setItem(storageKey, JSON.stringify([]));
    } catch {}
    this.notifyChange([]);
    if (typeof window !== 'undefined') {
      fetch(`${API_BASE_URL}/attendance`, {
        method: 'DELETE',
        headers: AuthService.getAuthHeaders(),
      }).catch(() => {});
    }
  }

  public static clearUserCache(): void {
    try {
      const storageKey = getAttendanceStorageKey();
      localStorage.removeItem(storageKey);
      // Also remove legacy un-scoped key if present
      localStorage.removeItem('soundabode_attendance_records');
    } catch {}
    this.notifyChange([]);
  }

  private static saveAttendance(records: AttendanceRecord[], user?: CmsUser | null): void {
    try {
      const storageKey = getAttendanceStorageKey(user);
      localStorage.setItem(storageKey, JSON.stringify(records));
      this.notifyChange(records);
    } catch {
      // Fallback
    }
  }

  private static syncStudentToRemote(student: EnrolledStudent): void {
    if (typeof window !== 'undefined') {
      fetch(`${API_BASE_URL}/students`, {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify(student),
      }).catch((err) => console.warn('Student remote sync notice:', err));
    }
  }

  private static async syncAttendanceToRemote(record: AttendanceRecord): Promise<void> {
    if (typeof window !== 'undefined') {
      const student = this.getStudentById(record.studentId);
      const payload = {
        ...record,
        studentName: student?.name || (record as any).studentName || '',
        studentEmail: student?.email || (record as any).studentEmail || '',
        studentPhone: student?.phone || (record as any).studentPhone || '',
        course: student?.course || (record as any).course || '',
        batch: student?.batch || (record as any).batch || '',
      };
      try {
        const res = await fetch(`${API_BASE_URL}/attendance`, {
          method: 'POST',
          headers: AuthService.getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          console.warn('Attendance remote sync failed:', res.status, await res.text().catch(() => ''));
        }
      } catch (err) {
        console.warn('Attendance remote sync notice:', err);
      }
    }
  }

  public static collectAllLocalStorageAttendance(): AttendanceRecord[] {
    const collected: AttendanceRecord[] = [];
    const seenIds = new Set<string>();

    if (typeof window === 'undefined') return collected;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('soundabode_attendance_records') || key === 'soundabode_attendance_records')) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                parsed.forEach((r: AttendanceRecord) => {
                  if (r && r.id && !['att-201', 'att-202', 'att-203', 'att-204'].includes(r.id) && !seenIds.has(r.id)) {
                    seenIds.add(r.id);
                    collected.push(r);
                  }
                });
              }
            }
          } catch {}
        }
      }
    } catch {}

    return collected;
  }

  /**
   * Fetches latest attendance from remote MongoDB and syncs to user-scoped storage.
   * MongoDB Atlas is the single source of truth.
   */
  public static async fetchAndSyncFromRemote(user?: CmsUser | null): Promise<AttendanceRecord[]> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`${API_BASE_URL}/attendance`, {
          headers: AuthService.getAuthHeaders(),
        });
        if (res.ok) {
          const remoteRecords = await res.json();
          if (Array.isArray(remoteRecords)) {
            const cleanRecords: AttendanceRecord[] = [];

            const activeUser = user || AuthService.getCurrentUser();
            const isTeacher = activeUser?.role === 'teacher';
            const uEmail = (activeUser?.email || '').toLowerCase();
            const uName = (activeUser?.name || '').toLowerCase();

            remoteRecords.forEach((r: AttendanceRecord) => {
              if (!r || !r.id) return;
              if (['att-201', 'att-202', 'att-203', 'att-204'].includes(r.id)) return;

              // Teacher role check
              if (isTeacher) {
                const mBy = (r.markedBy || '').toLowerCase();
                const mName = (r.markedByName || '').toLowerCase();
                const matchesTeacher =
                  mBy === uEmail ||
                  mName === uName ||
                  (uEmail && mBy.includes(uEmail)) ||
                  (uName && (mName.includes(uName) || mBy.includes(uName)));
                if (!matchesTeacher) return;
              }

              cleanRecords.push(r);
            });

            this.saveAttendance(cleanRecords, activeUser);
            return cleanRecords;
          }
        }
      } catch (err) {
        console.warn('Attendance remote fetch failed:', err);
      }
    }
    return this.getStoredAttendance(user);
  }

  public static getAllAttendanceRecords(user?: CmsUser | null): AttendanceRecord[] {
    const activeUser = user || AuthService.getCurrentUser();
    const records = this.getStoredAttendance(activeUser);

    if (activeUser?.role === 'teacher') {
      const uEmail = (activeUser.email || '').toLowerCase();
      const uName = (activeUser.name || '').toLowerCase();
      return records.filter((r) => {
        const mBy = (r.markedBy || '').toLowerCase();
        const mName = (r.markedByName || '').toLowerCase();
        if (mBy && mBy === uEmail) return true;
        if (mName && mName === uName) return true;
        if (uEmail && mBy.includes(uEmail)) return true;
        if (uName && (mName.includes(uName) || mBy.includes(uName))) return true;
        return false;
      });
    }

    return records;
  }

  // ─── Real-Time Live SSE Handlers ──────────────────────────────────────────
  public static handleIncomingLiveAttendance(record: AttendanceRecord): void {
    const currentUser = AuthService.getCurrentUser();
    if (currentUser?.role === 'teacher') {
      const uEmail = (currentUser.email || '').toLowerCase();
      const uName = (currentUser.name || '').toLowerCase();
      const mBy = (record.markedBy || '').toLowerCase();
      const mName = (record.markedByName || '').toLowerCase();
      const matches =
        mBy === uEmail ||
        mName === uName ||
        (uEmail && mBy.includes(uEmail)) ||
        (uName && (mName.includes(uName) || mBy.includes(uName)));
      if (!matches) return; // Do not inject other teacher's records into active teacher session
    }

    let records = this.getStoredAttendance(currentUser);
    const existingIndex = records.findIndex((r) => r.id === record.id);
    if (existingIndex !== -1) {
      records[existingIndex] = record;
    } else {
      records = [record, ...records];
    }
    this.saveAttendance(records, currentUser);
  }

  public static handleIncomingLiveDelete(id: string): void {
    const currentUser = AuthService.getCurrentUser();
    let records = this.getStoredAttendance(currentUser);
    records = records.filter((r) => r.id !== id);
    this.saveAttendance(records, currentUser);
  }

  public static handleIncomingLivePurge(): void {
    const currentUser = AuthService.getCurrentUser();
    this.saveAttendance([], currentUser);
  }

  public static getAllStudents(): EnrolledStudent[] {
    if (typeof window !== 'undefined') {
      fetch(`${API_BASE_URL}/students`, {
        headers: AuthService.getAuthHeaders(),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((remoteStudents) => {
          if (Array.isArray(remoteStudents)) {
            const mockIds = ['std-101', 'std-201', 'std-202', 'std-203', 'std-204', 'std-205', 'std-206', 'std-207', 'std-208', 'std-209', 'std-210', 'std-211', 'std-212', 'std-213', 'std-214', 'std-215', 'std-216', 'std-217', 'std-218'];
            const cleanRemote = remoteStudents.filter((s: EnrolledStudent) => s && !mockIds.includes(s.id));
            this.saveStudents(cleanRemote);
          }
        })
        .catch(() => {});
    }
    return this.getStoredStudents();
  }

  public static getStudentById(id: string): EnrolledStudent | undefined {
    return this.getStoredStudents().find((s) => s.id === id);
  }

  public static addStudent(payload: Omit<EnrolledStudent, 'id'>): EnrolledStudent {
    const students = this.getStoredStudents();
    const newStudent: EnrolledStudent = {
      ...payload,
      id: `std-${Date.now()}`,
    };
    const updated = [newStudent, ...students];
    this.saveStudents(updated);
    this.syncStudentToRemote(newStudent);
    return newStudent;
  }

  public static updateStudent(id: string, payload: Partial<EnrolledStudent>): EnrolledStudent | undefined {
    const students = this.getStoredStudents();
    const index = students.findIndex((s) => s.id === id);
    if (index === -1) return undefined;
    students[index] = { ...students[index], ...payload };
    this.saveStudents(students);
    this.syncStudentToRemote(students[index]);
    return students[index];
  }

  public static async deleteStudent(id: string): Promise<boolean> {
    let students = this.getStoredStudents();
    const targetStudent = students.find((s) => s.id === id);
    students = students.filter((s) => s.id !== id);
    this.saveStudents(students);

    // Also purge all attendance records for this student
    const currentUser = AuthService.getCurrentUser();
    let attendance = this.getStoredAttendance(currentUser);
    const recordsToDelete = attendance.filter((r) => r.studentId === id);
    attendance = attendance.filter((r) => r.studentId !== id);
    this.saveAttendance(attendance, currentUser);
    this.notifyChange(attendance);

    if (typeof window !== 'undefined') {
      try {
        // Delete all remote attendance records for this student
        recordsToDelete.forEach((r) => {
          fetch(`${API_BASE_URL}/attendance/${r.id}`, {
            method: 'DELETE',
            headers: AuthService.getAuthHeaders(),
          }).catch(() => {});
        });

        const queryParams = new URLSearchParams();
        if (targetStudent?.email) queryParams.append('email', targetStudent.email);
        if (targetStudent?.name) queryParams.append('name', targetStudent.name);
        const qStr = queryParams.toString();
        const deleteUrl = qStr
          ? `${API_BASE_URL}/students/${encodeURIComponent(id)}?${qStr}`
          : `${API_BASE_URL}/students/${encodeURIComponent(id)}`;

        const res = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: AuthService.getAuthHeaders(),
        });
        return res.ok;
      } catch (err) {
        console.warn('Student delete sync notice:', err);
      }
    }
    return true;
  }

  public static getAttendanceForStudent(
    studentId: string,
    user?: { email?: string; role?: string; name?: string }
  ): AttendanceRecord[] {
    const activeUser = (user || AuthService.getCurrentUser()) as CmsUser | null;
    const records = this.getStoredAttendance(activeUser);
    const studentRecords = records.filter((r) => r.studentId === studentId);

    // If no user context or role === 'admin', return ALL records
    if (!activeUser || activeUser.role === 'admin') {
      return studentRecords;
    }

    // Teacher role (e.g. Ashu, Vaibhav, Vrishan) - ONLY return records marked by THIS teacher
    const uEmail = (activeUser.email || '').toLowerCase();
    const uName = (activeUser.name || '').toLowerCase();

    return studentRecords.filter((r) => {
      const mBy = (r.markedBy || '').toLowerCase();
      const mName = (r.markedByName || '').toLowerCase();
      if (mBy && mBy === uEmail) return true;
      if (mName && mName === uName) return true;
      if (uEmail && mBy.includes(uEmail)) return true;
      if (uName && (mName.includes(uName) || mBy.includes(uName))) return true;
      return false;
    });
  }

  public static markAttendance(payload: {
    studentId: string;
    date: string;
    timeSlot: string;
    status: AttendanceStatus;
    comment: string;
    markedBy: string;
    markedByName: string;
    markedByRole: 'admin' | 'teacher';
  }): AttendanceRecord {
    const currentUser = AuthService.getCurrentUser();
    let records = this.getStoredAttendance(currentUser);

    const mBy = payload.markedBy.toLowerCase();
    const mName = payload.markedByName.toLowerCase();

    // Check if record exists for student, date, timeSlot AND markedBy/markedByName
    const existingIndex = records.findIndex((r) => {
      if (r.studentId !== payload.studentId || r.date !== payload.date || r.timeSlot !== payload.timeSlot) {
        return false;
      }
      const rBy = (r.markedBy || '').toLowerCase();
      const rName = (r.markedByName || '').toLowerCase();

      if (rBy && rBy === mBy) return true;
      if (rName && rName === mName) return true;
      if (mBy && rBy.includes(mBy)) return true;
      if (mName && (rName.includes(mName) || rBy.includes(mName))) return true;
      return false;
    });

    const now = new Date().toISOString();

    if (existingIndex !== -1) {
      records[existingIndex] = {
        ...records[existingIndex],
        status: payload.status,
        comment: payload.comment,
        markedBy: payload.markedBy,
        markedByName: payload.markedByName,
        markedByRole: payload.markedByRole,
        updatedAt: now,
      };
      this.saveAttendance(records, currentUser);
      this.syncAttendanceToRemote(records[existingIndex]);
      return records[existingIndex];
    } else {
      const newRecord: AttendanceRecord = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${payload.studentId}`,
        studentId: payload.studentId,
        date: payload.date,
        timeSlot: payload.timeSlot,
        status: payload.status,
        comment: payload.comment,
        markedBy: payload.markedBy,
        markedByName: payload.markedByName,
        markedByRole: payload.markedByRole,
        updatedAt: now,
      };
      records = [newRecord, ...records];
      this.saveAttendance(records, currentUser);
      this.syncAttendanceToRemote(newRecord);
      return newRecord;
    }
  }

  public static markBatchGroupAttendance(payload: {
    studentIds: string[];
    date: string;
    timeSlot: string;
    status: AttendanceStatus;
    comment: string;
    markedBy: string;
    markedByName: string;
    markedByRole: 'admin' | 'teacher';
  }): AttendanceRecord[] {
    const updatedRecords: AttendanceRecord[] = [];
    payload.studentIds.forEach((studentId) => {
      const rec = this.markAttendance({
        studentId,
        date: payload.date,
        timeSlot: payload.timeSlot,
        status: payload.status,
        comment: payload.comment,
        markedBy: payload.markedBy,
        markedByName: payload.markedByName,
        markedByRole: payload.markedByRole,
      });
      updatedRecords.push(rec);
    });
    return updatedRecords;
  }

  public static async deleteAttendanceRecord(id: string): Promise<boolean> {
    const currentUser = AuthService.getCurrentUser();
    let records = this.getStoredAttendance(currentUser);
    records = records.filter((r) => r.id !== id);
    this.saveAttendance(records, currentUser);

    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`${API_BASE_URL}/attendance/${id}`, {
          method: 'DELETE',
          headers: AuthService.getAuthHeaders(),
        });
        return res.ok;
      } catch (err) {
        console.warn('Attendance delete sync notice:', err);
      }
    }
    return true;
  }
}
