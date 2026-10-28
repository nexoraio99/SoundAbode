import { AuthService, CmsUser } from './authService';
import { getApiBaseUrl } from './apiConfig';

export interface EnrolledStudent {
  id: string;
  name: string;
  email: string;
  phone: string;
  course: string;
  courses?: string[];
  batch: string;
  batches?: string[];
  avatarUrl?: string;
  enrolledDate: string;
}

// Splits on commas NOT followed by a digit (so "50,000" stays intact) and on pipes.
const LIST_SPLIT_RE = /\s*,\s*(?!\d)|\s*\|\s*/;

export function parseList(arr?: unknown, fallback?: unknown): string[] {
  const source: unknown[] = Array.isArray(arr) && arr.length > 0
    ? arr
    : (typeof fallback === 'string' && fallback.trim() ? fallback.split(LIST_SPLIT_RE) : []);
  const out: string[] = [];
  source.forEach((item) => {
    if (typeof item !== 'string') return;
    const v = item.trim();
    if (v && !out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v);
  });
  return out;
}

export function getStudentCourses(student?: { course?: string; courses?: string[] } | null): string[] {
  if (!student) return [];
  return parseList(student.courses, student.course);
}

export function getStudentBatches(student?: { batch?: string; batches?: string[] } | null): string[] {
  if (!student) return [];
  return parseList(student.batches, student.batch);
}

function mergeLists(a: string[], b: string[]): string[] {
  const out = [...a];
  b.forEach((v) => {
    if (!out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v);
  });
  return out;
}

/** Ensures `courses`/`batches` arrays and the legacy `course`/`batch` strings stay in sync. */
export function normalizeStudent<T extends EnrolledStudent>(s: T): T {
  const courses = getStudentCourses(s);
  const batches = getStudentBatches(s);
  return {
    ...s,
    courses,
    course: courses.join(', '),
    batches,
    batch: batches.join(' | '),
  };
}

/**
 * Same person if emails match. A name-only match counts only when one side has no email,
 * so two different students who share a name are never merged.
 */
export function isSameStudent(s: { name?: string; email?: string }, name: string, email?: string): boolean {
  const sEmail = (s.email || '').trim().toLowerCase();
  const tEmail = (email || '').trim().toLowerCase();
  if (sEmail && tEmail) return sEmail === tEmail;
  return !!name && (s.name || '').trim().toLowerCase() === name.trim().toLowerCase();
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
  /** Course this session was for. Older records may hold several courses joined, or nothing. */
  course?: string;
  batch?: string;
}

export const LEGACY_STUDENT_ID_MAP: Record<string, string> = {
  // Legacy ObjectIds
  '6a80bc1c6a8952fb6f77991e': 'std-001',
  '6a80bc1c6a8952fb6f77991f': 'std-002',
  '6a80bc1c6a8952fb6f779920': 'std-003',
  '6a80bc1c6a8952fb6f779921': 'std-004',
  '6a80bc1c6a8952fb6f779922': 'std-005',
  '6a80bc1c6a8952fb6f779924': 'std-006',
  '6a80bc1c6a8952fb6f779925': 'std-007',
  '6a80bc1c6a8952fb6f779926': 'std-008',
  '6a80bc1c6a8952fb6f779927': 'std-009',
  '6a80bc1c6a8952fb6f779928': 'std-010',
  '6a80bc1c6a8952fb6f779929': 'std-011',
  '6a80bc1c6a8952fb6f77992a': 'std-012',
  '6a82f66ac9c1d901c179c0ec': 'std-013',
  '6a875146c9c1d901c17a3abc': 'std-014',
  '6a81b980c9c1d901c1788bfb': 'std-015',
  '6a85b66bc9c1d901c17a2b2d': 'std-016',
  '6a8c4aabc9c1d901c17bffc6': 'std-017',
  '6a95898ec1a9dab435071ed9': 'std-018',
  '6a9a8b8cc1a9dab4350c0472': 'std-019',
};

export function canonicalizeStudentId(id: string): string {
  if (!id) return id;
  return LEGACY_STUDENT_ID_MAP[id] || id;
}

// ─── Course entries ───────────────────────────────────────────────────────────
// A student enrolled in several courses is shown and tracked as one entry per course.
// Nothing is stored per entry: the key is derived, and attendance marked from an entry
// is saved against the real student id with that single course in `course`.
//   single-course student : key = student id (unchanged behaviour)
//   multi-course student  : key = `${id}::${course}`
//   older records that name none of the student's current courses: key = `${id}::` + UNMATCHED
const ENTRY_SEP = '::';
const UNMATCHED_COURSE = '__unmatched__';

export type EntryKind = 'single' | 'course' | 'unmatched';

export interface StudentEntry {
  key: string;
  studentId: string;
  student: EnrolledStudent;
  kind: EntryKind;
  /** The one course for 'course' entries; the student's full course text otherwise. */
  course: string;
  batch: string;
}

const normCourse = (c?: string) => (c || '').trim().toLowerCase();

export function parseEntryKey(key: string): { studentId: string; course: string | null; unmatched: boolean } {
  const i = (key || '').indexOf(ENTRY_SEP);
  if (i === -1) return { studentId: canonicalizeStudentId(key), course: null, unmatched: false };
  const studentId = canonicalizeStudentId(key.slice(0, i));
  const rest = key.slice(i + ENTRY_SEP.length);
  return rest === UNMATCHED_COURSE
    ? { studentId, course: null, unmatched: true }
    : { studentId, course: rest, unmatched: false };
}

export function courseEntryKey(studentId: string, course: string): string {
  return `${studentId}${ENTRY_SEP}${course}`;
}

/** Which of the student's courses a record belongs to, or null if it names none of them exactly. */
export function matchRecordCourse(record: { course?: string }, courses: string[]): string | null {
  const rc = normCourse(record.course);
  if (!rc) return null;
  return courses.find((c) => normCourse(c) === rc) || null;
}

function courseBatch(student: EnrolledStudent, course: string): string {
  const courses = getStudentCourses(student);
  const batches = getStudentBatches(student);
  const idx = courses.findIndex((c) => normCourse(c) === normCourse(course));
  if (batches.length === courses.length && idx >= 0) return batches[idx];
  return batches.length === 1 ? batches[0] : student.batch;
}

/**
 * One entry per course for multi-course students (plus an "earlier sessions" entry when some
 * of their records can't be tied to a current course); a single entry for everyone else.
 */
export function getStudentEntries(student: EnrolledStudent, records: AttendanceRecord[] = []): StudentEntry[] {
  const courses = getStudentCourses(student);
  if (courses.length <= 1) {
    return [{ key: student.id, studentId: student.id, student, kind: 'single', course: student.course, batch: student.batch }];
  }
  const entries: StudentEntry[] = courses.map((course) => ({
    key: courseEntryKey(student.id, course),
    studentId: student.id,
    student,
    kind: 'course',
    course,
    batch: courseBatch(student, course),
  }));
  const hasUnmatched = records.some(
    (r) => canonicalizeStudentId(r.studentId) === student.id && !matchRecordCourse(r, courses)
  );
  if (hasUnmatched) {
    entries.push({
      key: `${student.id}${ENTRY_SEP}${UNMATCHED_COURSE}`,
      studentId: student.id,
      student,
      kind: 'unmatched',
      course: 'Earlier sessions (course not recorded)',
      batch: student.batch,
    });
  }
  return entries;
}

/** The entry key a stored record shows under. */
export function entryKeyForRecord(record: AttendanceRecord, student?: EnrolledStudent): string {
  const studentId = canonicalizeStudentId(record.studentId);
  if (!student) return studentId;
  const courses = getStudentCourses(student);
  if (courses.length <= 1) return studentId;
  const course = matchRecordCourse(record, courses);
  return course ? courseEntryKey(studentId, course) : `${studentId}${ENTRY_SEP}${UNMATCHED_COURSE}`;
}

export function sortStudentsById(students: EnrolledStudent[]): EnrolledStudent[] {
  return [...students].sort((a, b) => {
    const numA = parseInt((a.id.match(/^std-(\d+)$/i) || [])[1] || '999999', 10);
    const numB = parseInt((b.id.match(/^std-(\d+)$/i) || [])[1] || '999999', 10);
    if (numA !== numB) return numA - numB;
    return (a.name || '').localeCompare(b.name || '');
  });
}

const INITIAL_STUDENTS: EnrolledStudent[] = [];

const INITIAL_ATTENDANCE: AttendanceRecord[] = [];

const STUDENTS_STORAGE_KEY = 'soundabode_enrolled_students';
const RECONCILED_ADMISSIONS_KEY = 'soundabode_reconciled_admissions';
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

export function initAttendanceLiveStream() {
  if (typeof window === 'undefined' || !('EventSource' in window)) return;
  const token = AuthService.getSessionToken();
  if (!token) return; // Only authenticated CMS users connect to SSE live stream
  if (liveAttendanceEventSource) return;

  try {
    const sseUrl = `${API_BASE_URL}/live-stream?token=${encodeURIComponent(token)}`;
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

    liveAttendanceEventSource.addEventListener('STUDENT_SAVED', (e: MessageEvent) => {
      try {
        const student = JSON.parse(e.data);
        if (student && student.id) {
          AttendanceService.handleIncomingLiveStudent(student);
        }
      } catch (err) {
        console.warn('SSE STUDENT_SAVED parse error:', err);
      }
    });

    liveAttendanceEventSource.addEventListener('STUDENT_DELETED', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.id) {
          AttendanceService.handleIncomingLiveDeleteStudent(data.id);
        }
      } catch (err) {
        console.warn('SSE STUDENT_DELETED parse error:', err);
      }
    });

    liveAttendanceEventSource.onerror = () => {
      // EventSource auto-reconnects
    };
  } catch (err) {
    console.warn('Failed to initialize Attendance SSE stream:', err);
  }
}

if (typeof window !== 'undefined' && AuthService.getSessionToken()) {
  initAttendanceLiveStream();
}

// Helper: Normalize time slot string for resilient matching across formats
function normalizeTimeSlot(slot?: string): string {
  if (!slot) return '';
  return slot
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/0([0-9]):/g, '$1:')
    .trim()
    .toLowerCase();
}

export class AttendanceService {
  private static listeners: AttendanceListener[] = [];
  private static studentListeners: ((students: EnrolledStudent[]) => void)[] = [];

  public static subscribe(listener: AttendanceListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public static subscribeStudents(listener: (students: EnrolledStudent[]) => void): () => void {
    this.studentListeners.push(listener);
    return () => {
      this.studentListeners = this.studentListeners.filter((l) => l !== listener);
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

  private static notifyStudentsChange(students: EnrolledStudent[]): void {
    this.studentListeners.forEach((l) => {
      try {
        l(students);
      } catch {}
    });
  }

  private static saveStudents(students: EnrolledStudent[]): void {
    try {
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));
      this.notifyStudentsChange(students);
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
        
        // Merge & migrate all students to canonical std-001..std-019 IDs
        const mergedMap = new Map<string, EnrolledStudent>();
        INITIAL_STUDENTS.forEach((s) => mergedMap.set(s.id, s));
        realStudents.forEach((s) => {
          const canonicalId = canonicalizeStudentId(s.id);
          const existing = mergedMap.get(canonicalId);
          mergedMap.set(canonicalId, { ...(existing || {}), ...s, id: canonicalId });
        });
        const merged = sortStudentsById(Array.from(mergedMap.values()));

        // Only write back if a migration actually changed something (avoid infinite notify loops)
        const needsMigration = parsed.some((s) => mockIds.includes(s.id)) ||
          parsed.some((s) => LEGACY_STUDENT_ID_MAP[s.id]) ||
          parsed.length !== merged.length;
        if (needsMigration) {
          this.saveStudents(merged);
        }
        return merged;
      }
    } catch {
      // Fallback
    }
    // First-time init: save without notifying to avoid triggering re-renders during mount
    try {
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(INITIAL_STUDENTS));
    } catch {}
    return INITIAL_STUDENTS;
  }

  private static getStoredAttendance(user?: CmsUser | null): AttendanceRecord[] {
    try {
      const storageKey = getAttendanceStorageKey(user);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: AttendanceRecord[] = JSON.parse(stored);
        const filtered = parsed
          .filter((r) => r && !['att-201', 'att-202', 'att-203', 'att-204'].includes(r.id))
          .map((r) => ({
            ...r,
            studentId: canonicalizeStudentId(r.studentId),
          }));
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
    if (liveAttendanceEventSource) {
      try { liveAttendanceEventSource.close(); } catch {}
      liveAttendanceEventSource = null;
    }
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

  private static syncStudentToRemote(student: EnrolledStudent, isNew = false): void {
    if (typeof window !== 'undefined') {
      fetch(`${API_BASE_URL}/students`, {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify({ ...student, isNew }),
      })
        .then(async (res) => {
          if (res.ok) {
            const saved = await res.json();
            if (saved && saved.id && saved.id !== student.id) {
              // Server reassigned the ID (collision) or merged into an existing record.
              const withoutTemp = this.getStoredStudents().filter((s) => s.id !== student.id);
              const savedNorm = normalizeStudent({ ...saved, id: canonicalizeStudentId(saved.id) } as EnrolledStudent);
              const idx = withoutTemp.findIndex((s) => s.id === savedNorm.id);
              if (idx !== -1) withoutTemp[idx] = savedNorm;
              else withoutTemp.push(savedNorm);
              this.saveStudents(sortStudentsById(withoutTemp));
            }
          }
        })
        .catch((err) => console.warn('Student remote sync notice:', err));
    }
  }

  private static async syncAttendanceToRemote(record: AttendanceRecord): Promise<void> {
    if (typeof window !== 'undefined') {
      const student = this.getStudentById(record.studentId);
      // A multi-course student's record keeps the one course it was marked for; only a
      // single-course student's record takes the student's current course text.
      const isMultiCourse = getStudentCourses(student).length > 1;
      const payload = {
        ...record,
        studentName: student?.name || (record as any).studentName || '',
        studentEmail: student?.email || (record as any).studentEmail || '',
        studentPhone: student?.phone || (record as any).studentPhone || '',
        course: (isMultiCourse ? record.course : student?.course) || record.course || '',
        batch: (isMultiCourse ? record.batch : student?.batch) || record.batch || '',
        ...(isMultiCourse && record.course ? { courseScoped: true } : {}),
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

            const currentStored = this.getStoredAttendance(activeUser);
            if (JSON.stringify(currentStored) !== JSON.stringify(cleanRecords)) {
              this.saveAttendance(cleanRecords, activeUser);
            }
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
    const existingIndex = records.findIndex((r) => r.id === record.id || (
      canonicalizeStudentId(r.studentId) === canonicalizeStudentId(record.studentId) &&
      r.date === record.date &&
      normalizeTimeSlot(r.timeSlot) === normalizeTimeSlot(record.timeSlot)
    ));
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

  public static handleIncomingLiveStudent(student: EnrolledStudent): void {
    if (!student || !student.id) return;
    const students = this.getStoredStudents();
    const targetId = canonicalizeStudentId(student.id);
    const existingIndex = students.findIndex((s) => s.id === targetId || (student.email && s.email && s.email.toLowerCase() === student.email.toLowerCase()));
    let updated: EnrolledStudent[];
    if (existingIndex !== -1) {
      updated = [...students];
      const mergedCourses = Array.from(new Set([
        ...getStudentCourses(updated[existingIndex]),
        ...getStudentCourses(student),
      ]));
      const mergedBatches = Array.from(new Set([
        ...getStudentBatches(updated[existingIndex]),
        ...getStudentBatches(student),
      ]));
      updated[existingIndex] = {
        ...updated[existingIndex],
        ...student,
        id: targetId,
        courses: mergedCourses,
        course: mergedCourses.join(', ') || student.course || updated[existingIndex].course,
        batches: mergedBatches,
        batch: mergedBatches.join(' | ') || student.batch || updated[existingIndex].batch,
      };
    } else {
      const courses = getStudentCourses(student);
      const batches = getStudentBatches(student);
      updated = [...students, {
        ...student,
        id: targetId,
        courses,
        course: courses.join(', ') || student.course,
        batches,
        batch: batches.join(' | ') || student.batch,
      }];
    }
    const sorted = sortStudentsById(updated);
    const currentStored = this.getStoredStudents();
    if (JSON.stringify(currentStored) !== JSON.stringify(sorted)) {
      this.saveStudents(sorted);
    }
  }

  public static handleIncomingLiveDeleteStudent(id: string): void {
    if (!id) return;
    const students = this.getStoredStudents();
    const targetId = canonicalizeStudentId(id);
    const updated = students.filter((s) => s.id !== id && s.id !== targetId);
    if (updated.length !== students.length) {
      this.saveStudents(updated);
    }
  }

  public static async fetchStudents(): Promise<EnrolledStudent[]> {
    if (typeof window !== 'undefined') {
      initAttendanceLiveStream();
      try {
        const res = await fetch(`${API_BASE_URL}/students`, {
          headers: AuthService.getAuthHeaders(),
        });
        if (res.ok) {
          const remoteStudents = await res.json();
          if (Array.isArray(remoteStudents)) {
            const mockIds = ['std-101', 'std-201', 'std-202', 'std-203', 'std-204', 'std-205', 'std-206', 'std-207', 'std-208', 'std-209', 'std-210', 'std-211', 'std-212', 'std-213', 'std-214', 'std-215', 'std-216', 'std-217', 'std-218'];
            const cleanRemote = sortStudentsById(
              remoteStudents
                .filter((s: EnrolledStudent) => s && !mockIds.includes(s.id))
                .map((s: EnrolledStudent) => {
                  const courses = getStudentCourses(s);
                  const batches = getStudentBatches(s);
                  return {
                    ...s,
                    id: canonicalizeStudentId(s.id),
                    courses,
                    course: courses.join(', ') || s.course,
                    batches,
                    batch: batches.join(' | ') || s.batch,
                  };
                })
            );
            const currentStored = this.getStoredStudents();
            if (JSON.stringify(currentStored) !== JSON.stringify(cleanRemote)) {
              this.saveStudents(cleanRemote);
            }
            return cleanRemote;
          }
        }
      } catch (err) {
        console.warn('Students remote fetch failed:', err);
      }
    }
    return this.getStoredStudents();
  }

  public static getAllStudents(): EnrolledStudent[] {
    if (typeof window !== 'undefined') {
      this.fetchStudents().catch(() => {});
    }
    return this.getStoredStudents();
  }

  public static getStudentById(id: string): EnrolledStudent | undefined {
    const { studentId } = parseEntryKey(id);
    return this.getStoredStudents().find((s) => s.id === studentId || s.id === id);
  }

  /**
   * The entry behind a key, for display. For a course entry the student copy carries only
   * that course and batch. Never pass this copy to updateStudent: it is not the full record.
   */
  public static getEntry(key: string): StudentEntry | undefined {
    const { studentId, course, unmatched } = parseEntryKey(key);
    const student = this.getStoredStudents().find((s) => s.id === studentId);
    if (!student) return undefined;
    const courses = getStudentCourses(student);
    if (courses.length <= 1 || (!course && !unmatched)) {
      return { key: student.id, studentId, student, kind: 'single', course: student.course, batch: student.batch };
    }
    if (unmatched) {
      return { key, studentId, student, kind: 'unmatched', course: 'Earlier sessions (course not recorded)', batch: student.batch };
    }
    const real = courses.find((c) => normCourse(c) === normCourse(course || ''));
    if (!real) {
      // Course was removed from the student since the key was created: fall back to the whole student
      return { key: student.id, studentId, student, kind: 'single', course: student.course, batch: student.batch };
    }
    const batch = courseBatch(student, real);
    return {
      key: courseEntryKey(studentId, real),
      studentId,
      student: { ...student, course: real, courses: [real], batch, batches: [batch] },
      kind: 'course',
      course: real,
      batch,
    };
  }

  public static addStudent(payload: Omit<EnrolledStudent, 'id'>): EnrolledStudent {
    const students = this.getStoredStudents();
    const existingNums = students.map((s) => {
      const match = s.id.match(/^std-(\d+)$/i);
      if (!match) return 0;
      const n = parseInt(match[1], 10);
      return n < 10000 ? n : 0;
    });
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums) : 0;
    const nextNum = Math.max(19, maxNum) + 1;
    const nextId = `std-${String(nextNum).padStart(3, '0')}`;

    // Temporary local ID; the server assigns the final one (see syncStudentToRemote).
    const newStudent = normalizeStudent({ ...payload, id: nextId } as EnrolledStudent);
    const updated = sortStudentsById([...students, newStudent]);
    this.saveStudents(updated);
    this.syncStudentToRemote(newStudent, true);
    return newStudent;
  }

  public static updateStudent(id: string, payload: Partial<EnrolledStudent>): EnrolledStudent | undefined {
    const students = this.getStoredStudents();
    const index = students.findIndex((s) => s.id === id);
    if (index === -1) return undefined;
    const existing = students[index];

    // Lists provided in the payload are authoritative (so courses can be removed);
    // otherwise keep what the student already has.
    const hasCourseInput = Array.isArray(payload.courses) || typeof payload.course === 'string';
    const hasBatchInput = Array.isArray(payload.batches) || typeof payload.batch === 'string';

    students[index] = normalizeStudent({
      ...existing,
      ...payload,
      id: existing.id,
      courses: hasCourseInput ? parseList(payload.courses, payload.course) : getStudentCourses(existing),
      batches: hasBatchInput ? parseList(payload.batches, payload.batch) : getStudentBatches(existing),
    } as EnrolledStudent);
    this.saveStudents(students);
    this.syncStudentToRemote(students[index]);
    return students[index];
  }

  /**
   * Adds the course from each ENROLLED admission to the matching existing student.
   * Each admission is applied only once, so a course an admin later removes is not re-added.
   */
  public static reconcileWithAdmissions(admissions: { id?: string; firstName: string; lastName: string; email?: string; cellPhone?: string; courseOpted?: string; formType?: string; status: string }[]): boolean {
    if (!Array.isArray(admissions) || admissions.length === 0) return false;

    let applied: string[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(RECONCILED_ADMISSIONS_KEY) || '[]');
      if (Array.isArray(raw)) applied = raw.filter((x): x is string => typeof x === 'string');
    } catch {
      applied = [];
    }
    const appliedSet = new Set(applied);

    const students = this.getStoredStudents();
    const changedIds = new Set<string>();

    admissions.forEach((adm) => {
      if (adm.status !== 'ENROLLED' || !adm.id || appliedSet.has(adm.id)) return;
      const studentName = `${adm.firstName || ''} ${adm.lastName || ''}`.trim();
      const idx = students.findIndex((s) => isSameStudent(s, studentName, adm.email));
      if (idx === -1) return; // Not on the roster yet; the server-side enrollment will create it.

      const targetCourse = (adm.courseOpted || '').trim() || (adm.formType === 'DJ' ? 'DJ Training Course' : 'EMP Production');
      const targetBatch = adm.formType === 'DJ' ? 'Regular DJ Studio Batch' : 'Regular EMP Studio Batch';
      const student = students[idx];
      const courses = mergeLists(getStudentCourses(student), [targetCourse]);
      const batches = mergeLists(getStudentBatches(student), [targetBatch]);

      if (courses.length !== getStudentCourses(student).length) {
        students[idx] = normalizeStudent({
          ...student,
          courses,
          batches,
          phone: student.phone || adm.cellPhone || '',
          email: student.email || adm.email || '',
        });
        changedIds.add(students[idx].id);
      }
      appliedSet.add(adm.id);
    });

    try {
      localStorage.setItem(RECONCILED_ADMISSIONS_KEY, JSON.stringify(Array.from(appliedSet)));
    } catch {
      // Storage full / unavailable — reconcile will simply run again next time.
    }

    if (changedIds.size > 0) {
      this.saveStudents(sortStudentsById(students));
      students.filter((s) => changedIds.has(s.id)).forEach((s) => this.syncStudentToRemote(s));
    }
    return changedIds.size > 0;
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
    const entry = parseEntryKey(studentId);
    const targetId = entry.studentId;
    let studentRecords = records.filter((r) => r.studentId === targetId || canonicalizeStudentId(r.studentId) === targetId);

    // Course entries only see sessions for that course; the "earlier sessions" entry sees
    // the ones that match none of the student's current courses.
    if (entry.course || entry.unmatched) {
      const student = this.getStoredStudents().find((s) => s.id === targetId);
      const courses = getStudentCourses(student);
      // A key for a course the student no longer has falls back to the whole student,
      // matching getEntry()
      const courseStillListed = entry.unmatched || courses.some((c) => normCourse(c) === normCourse(entry.course || ''));
      if (courses.length > 1 && courseStillListed) {
        studentRecords = studentRecords.filter((r) => {
          const matched = matchRecordCourse(r, courses);
          return entry.unmatched ? !matched : !!matched && normCourse(matched) === normCourse(entry.course || '');
        });
      }
    }

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

    // A course entry key saves against the real student, scoped to that one course
    const entry = this.getEntry(payload.studentId);
    const studentId = entry ? entry.studentId : canonicalizeStudentId(payload.studentId);
    const scopedCourse = entry?.kind === 'course' ? entry.course : undefined;
    const scopedBatch = entry?.kind === 'course' ? entry.batch : undefined;

    const mBy = payload.markedBy.toLowerCase();
    const mName = payload.markedByName.toLowerCase();

    // Check if record exists for student, date, timeSlot (and course, for course entries) AND markedBy/markedByName
    const existingIndex = records.findIndex((r) => {
      if (r.studentId !== studentId || r.date !== payload.date || r.timeSlot !== payload.timeSlot) {
        return false;
      }
      if (scopedCourse && normCourse(r.course) !== normCourse(scopedCourse)) {
        return false;
      }
      if (entry?.kind === 'unmatched' && matchRecordCourse(r, getStudentCourses(entry.student))) {
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
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${studentId}`,
        studentId,
        ...(scopedCourse ? { course: scopedCourse, batch: scopedBatch } : {}),
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
