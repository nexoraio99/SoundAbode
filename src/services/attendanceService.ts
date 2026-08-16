import { AuthService } from './authService';

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

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD format
  timeSlot: string; // e.g. "11:00 AM - 01:00 PM"
  status: 'PRESENT' | 'ABSENT' | 'NA';
  comment: string;
  markedBy: string; // email or user id
  markedByName: string; // e.g. "Ashu", "Vaibhav", "Soundabode Admin"
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

import { getApiBaseUrl } from './apiConfig';

const STUDENTS_STORAGE_KEY = 'soundabode_enrolled_students';
const ATTENDANCE_STORAGE_KEY = 'soundabode_attendance_records';
const ATTENDANCE_EVENT_NAME = 'soundabode_attendance_updated';
const API_BASE_URL = getApiBaseUrl();

type AttendanceListener = (records: AttendanceRecord[]) => void;

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

  private static getStoredAttendance(): AttendanceRecord[] {
    try {
      const stored = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
      if (stored) {
        const parsed: AttendanceRecord[] = JSON.parse(stored);
        return parsed.filter((r) => r && !['att-201', 'att-202', 'att-203', 'att-204'].includes(r.id));
      }
    } catch {
      // Fallback
    }
    return INITIAL_ATTENDANCE;
  }

  public static clearAllAttendance(): void {
    try {
      localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify([]));
    } catch {}
    this.notifyChange([]);
    if (typeof window !== 'undefined') {
      fetch(`${API_BASE_URL}/attendance`, {
        method: 'DELETE',
        headers: AuthService.getAuthHeaders(),
      }).catch(() => {});
    }
  }

  private static saveAttendance(records: AttendanceRecord[]): void {
    try {
      localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(records));
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

  private static syncAttendanceToRemote(record: AttendanceRecord): void {
    if (typeof window !== 'undefined') {
      const student = this.getStudentById(record.studentId);
      const payload = {
        ...record,
        studentName: student?.name || '',
        studentEmail: student?.email || '',
        studentPhone: student?.phone || '',
        course: student?.course || '',
        batch: student?.batch || '',
      };
      fetch(`${API_BASE_URL}/attendance`, {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify(payload),
      }).catch((err) => console.warn('Attendance remote sync notice:', err));
    }
  }

  public static getAllAttendanceRecords(): AttendanceRecord[] {
    if (typeof window !== 'undefined') {
      fetch(`${API_BASE_URL}/attendance`, {
        headers: AuthService.getAuthHeaders(),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((remoteRecords) => {
          if (Array.isArray(remoteRecords)) {
            const cleanRecords = remoteRecords.filter((r) => !['att-201', 'att-202', 'att-203', 'att-204'].includes(r.id));
            const currentLocal = this.getStoredAttendance();
            const remoteIds = new Set(cleanRecords.map((r: AttendanceRecord) => r.id));
            const unsyncedLocal = currentLocal.filter((r) => !remoteIds.has(r.id) && !['att-201', 'att-202', 'att-203', 'att-204'].includes(r.id));

            unsyncedLocal.forEach((r) => this.syncAttendanceToRemote(r));

            const merged = [...unsyncedLocal, ...cleanRecords];
            this.saveAttendance(merged);
          }
        })
        .catch(() => {});
    }
    return this.getStoredAttendance();
  }

  public static getAllStudents(): EnrolledStudent[] {
    if (typeof window !== 'undefined') {
      fetch(`${API_BASE_URL}/students`, {
        headers: AuthService.getAuthHeaders(),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((remoteStudents) => {
          if (Array.isArray(remoteStudents) && remoteStudents.length > 0) {
            const mockIds = ['std-101', 'std-201', 'std-202', 'std-203', 'std-204', 'std-205', 'std-206', 'std-207', 'std-208', 'std-209', 'std-210', 'std-211', 'std-212', 'std-213', 'std-214', 'std-215', 'std-216', 'std-217', 'std-218'];
            const cleanRemote = remoteStudents.filter((s: EnrolledStudent) => s && !mockIds.includes(s.id));
            const currentLocal = this.getStoredStudents();
            const remoteIds = new Set(cleanRemote.map((s: EnrolledStudent) => s.id));
            const unsyncedLocal = currentLocal.filter((s) => !remoteIds.has(s.id) && !mockIds.includes(s.id));

            unsyncedLocal.forEach((s) => this.syncStudentToRemote(s));

            const merged = [...unsyncedLocal, ...cleanRemote];
            this.saveStudents(merged);
            this.notifyChange(this.getStoredAttendance());
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

  public static deleteStudent(id: string): boolean {
    let students = this.getStoredStudents();
    const initialLen = students.length;
    students = students.filter((s) => s.id !== id);
    if (students.length !== initialLen) {
      this.saveStudents(students);
      if (typeof window !== 'undefined') {
        fetch(`${API_BASE_URL}/students/${id}`, {
          method: 'DELETE',
          headers: AuthService.getAuthHeaders(),
        }).catch((err) => console.warn('Student delete sync notice:', err));
      }
      return true;
    }
    return false;
  }

  public static getAttendanceForStudent(
    studentId: string,
    user?: { email?: string; role?: string; name?: string }
  ): AttendanceRecord[] {
    this.getAllAttendanceRecords();
    const records = this.getStoredAttendance();
    const studentRecords = records.filter((r) => r.studentId === studentId);

    // If no user context or role === 'admin', return ALL records
    if (!user || user.role === 'admin') {
      return studentRecords;
    }

    // Teacher role (e.g. Ashu or Vaibhav) - ONLY return records marked by THIS teacher
    const uEmail = (user.email || '').toLowerCase();
    const uName = (user.name || '').toLowerCase();

    return studentRecords.filter((r) => {
      const mBy = (r.markedBy || '').toLowerCase();
      const mName = (r.markedByName || '').toLowerCase();
      if (mBy && mBy === uEmail) return true;
      if (mName && mName === uName) return true;
      if (uEmail.includes('ashu') && (mBy.includes('ashu') || mName.includes('ashu'))) return true;
      if (uEmail.includes('vaibhav') && (mBy.includes('vaibhav') || mName.includes('vaibhav'))) return true;
      if (uName.includes('ashu') && (mBy.includes('ashu') || mName.includes('ashu'))) return true;
      if (uName.includes('vaibhav') && (mBy.includes('vaibhav') || mName.includes('vaibhav'))) return true;
      return false;
    });
  }

  public static markAttendance(payload: {
    studentId: string;
    date: string;
    timeSlot: string;
    status: 'PRESENT' | 'ABSENT' | 'NA';
    comment: string;
    markedBy: string;
    markedByName: string;
    markedByRole: 'admin' | 'teacher';
  }): AttendanceRecord {
    let records = this.getStoredAttendance();

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
      if (mBy.includes('ashu') && (rBy.includes('ashu') || rName.includes('ashu'))) return true;
      if (mBy.includes('vaibhav') && (rBy.includes('vaibhav') || rName.includes('vaibhav'))) return true;
      if (mName.includes('ashu') && (rBy.includes('ashu') || rName.includes('ashu'))) return true;
      if (mName.includes('vaibhav') && (rBy.includes('vaibhav') || rName.includes('vaibhav'))) return true;
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
      this.saveAttendance(records);
      this.syncAttendanceToRemote(records[existingIndex]);
      return records[existingIndex];
    } else {
      const newRecord: AttendanceRecord = {
        id: `att-${Date.now()}`,
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
      this.saveAttendance(records);
      this.syncAttendanceToRemote(newRecord);
      return newRecord;
    }
  }

  public static deleteAttendanceRecord(id: string): boolean {
    let records = this.getStoredAttendance();
    const initialLen = records.length;
    records = records.filter((r) => r.id !== id);
    if (records.length !== initialLen) {
      this.saveAttendance(records);
      if (typeof window !== 'undefined') {
        fetch(`${API_BASE_URL}/attendance/${id}`, {
          method: 'DELETE',
          headers: AuthService.getAuthHeaders(),
        }).catch((err) => console.warn('Attendance delete sync notice:', err));
      }
      return true;
    }
    return false;
  }
}
