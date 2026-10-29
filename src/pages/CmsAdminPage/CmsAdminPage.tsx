import React, { useState, useEffect, useMemo } from 'react';
import styles from './CmsAdminPage.module.css';
import admissionStyles from '../AdmissionPage/AdmissionPage.module.css';
import SEO from '../../components/common/SEO';
import { BlogService } from '../../services/blogService';
import { InquiryService, ContactInquiry, ARCHIVE_REASONS, LeadStatus, LeadUpdate, TeamMember, LeadComment } from '../../services/inquiryService';
import { AttendanceService, EnrolledStudent, AttendanceStatus, AttendanceRecord, canonicalizeStudentId, sortStudentsById, getStudentCourses, getStudentEntries, entryKeyForRecord, matchRecordCourse, StudentEntry } from '../../services/attendanceService';
import { AdmissionService, AdmissionSubmission } from '../../services/admissionService';
import { AuthService, CmsUser } from '../../services/authService';
import { getApiBaseUrl } from '../../services/apiConfig';
import { BlogPost } from '../../types/blog';
import { DJ_COURSES, EMP_COURSES, DJ_DISCLAIMER, EMP_DISCLAIMER } from '../../constants/admissionConstants';
import { escapeHtml, safeImageUrl, safeWhatsAppUrl, sanitizePrintHtml } from '../../utils/security';
import { IssueService, DeveloperIssue, DEVELOPER_EMAIL, SENDER_EMAIL } from '../../services/issueService';
import { ReminderService } from '../../services/reminderService';
import { FeeReceipt, FeeService } from '../../services/feeService';
import { WordPressArticleEditorModal } from '../../components/cms/WordPressArticleEditorModal';
import { triggerCapiTestEvent, getCapiEventNameForStatus } from '../../services/metaCapiService';
import { MetaAdsTab } from './components/MetaAdsTab';

interface CmsAdminPageProps {
  onNavigate?: (page: string) => void;
}

const LEAD_STAGES: LeadStatus[] = ['NEW', 'CONTACTED', 'ENROLLED', 'ARCHIVED'];
const LEAD_STAGE_LABELS: Record<LeadStatus, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  ENROLLED: 'Enrolled',
  ARCHIVED: 'Archived',
};

function formatLeadAge(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type TabType = 'overview' | 'students' | 'classes' | 'blog' | 'inquiries' | 'meta-ads' | 'admissions' | 'attendance' | 'fees' | 'settings';

const THEME_STORAGE_KEY = 'soundabode_cms_theme';

const safeMailto = (email: string, subject = '', body = ''): string => {
  const cleanEmail = (email || '').trim().replace(/[^a-zA-Z0-9@._+-]/g, '');
  if (!cleanEmail) return '#';
  let url = `mailto:${encodeURIComponent(cleanEmail)}`;
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  if (params.length) url += `?${params.join('&')}`;
  return url;
};

const safeAdmissionWhatsAppUrl = (item?: { cellPhone?: string; firstName?: string; formNo?: string; formType?: string; id?: string } | null): string => {
  if (!item) return '#';
  const phone = (item.cellPhone || '').replace(/\D/g, '');
  const firstName = (item.firstName || '').trim().replace(/[^\w\s-]/gi, '');
  const formNo = (item.formNo || '').trim().replace(/[^\w\s-]/gi, '');
  const formType = (item.formType || '').toLowerCase().replace(/[^\w-]/gi, '');
  const id = (item.id || '').replace(/[^\w-]/gi, '');
  const baseUrl = typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : 'https://soundabode.com';
  const shareUrl = `${baseUrl}/admission-${encodeURIComponent(formType)}?id=${encodeURIComponent(id)}`;
  const text = `Hello ${firstName}, here is your official Soundabode Studios Admission Form (${formNo}):\n${shareUrl}`;
  return safeWhatsAppUrl(phone, text);
};



// Helper: Convert number to words (Indian numbering)
const numberToWords = (num: number): string => {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const toWords = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + toWords(n % 100) : '');
    if (n < 100000) return toWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + toWords(n % 1000) : '');
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + toWords(n % 100000) : '');
    return toWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + toWords(n % 10000000) : '');
  };
  return toWords(Math.round(num));
};

// Helper: Deterministic avatar color and initials from name
const getAvatarDetails = (name: string, customAvatarUrl?: string) => {
  const parts = name.trim().split(' ');
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : (name.slice(0, 2) || 'SA').toUpperCase();

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hues = [210, 260, 340, 160, 35, 190, 280];
  const hue = hues[Math.abs(hash) % hues.length];
  const bg = `hsl(${hue}, 60%, 26%)`;
  const border = `hsl(${hue}, 65%, 40%)`;

  return { initials, bg, border, avatarUrl: customAvatarUrl };
};

// Helper: Format local YYYY-MM-DD string without UTC offset bugs
const formatLocalDateStr = (year: number, monthIndex: number, day: number): string => {
  const yyyy = String(year);
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getTodayDateStr = (): string => {
  const now = new Date();
  return formatLocalDateStr(now.getFullYear(), now.getMonth(), now.getDate());
};

// Helper: Normalize time slot string for resilient matching across formats
const normalizeTimeSlot = (slot?: string): string => {
  if (!slot) return '';
  return slot
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/0([0-9]):/g, '$1:')
    .trim()
    .toLowerCase();
};

// Helper: Resolve instructor identity, color, and role badge
const getInstructorInfo = (rec?: { markedByName?: string; markedBy?: string }) => {
  if (!rec) return { name: 'Staff', role: 'Instructor', color: 'var(--text-primary)', bg: 'var(--bg-surface)', border: 'var(--border-subtle)' };
  const name = (rec.markedByName || '').toLowerCase();
  const by = (rec.markedBy || '').toLowerCase();

  if (name.includes('ashu') || by.includes('ashu')) {
    return { name: 'Ashu', role: 'Faculty / Mentor', color: 'var(--text-primary)', bg: 'var(--bg-surface)', border: 'var(--border-medium)' };
  }
  if (name.includes('vaibhav') || by.includes('vaibhav')) {
    return { name: 'Vaibhav', role: 'Faculty / Mentor', color: 'var(--text-primary)', bg: 'var(--bg-surface)', border: 'var(--border-medium)' };
  }
  if (name.includes('vrishan') || by.includes('vrishan')) {
    return { name: 'Vrishan', role: 'Faculty / Mentor', color: 'var(--text-primary)', bg: 'var(--bg-surface)', border: 'var(--border-medium)' };
  }
  if (name.includes('abhinav') || by.includes('abhinav') || by.includes('admin')) {
    return { name: 'Abhinav', role: 'Lead / Admin', color: 'var(--text-primary)', bg: 'var(--bg-surface)', border: 'var(--border-medium)' };
  }
  return {
    name: rec.markedByName || 'Soundabode Staff',
    role: 'Instructor',
    color: 'var(--text-primary)',
    bg: 'var(--bg-surface)',
    border: 'var(--border-subtle)',
  };
};

export interface ClassLogEntry {
  id: string;
  type: 'INDIVIDUAL' | 'GROUP';
  studentId?: string;
  student?: EnrolledStudent;
  studentIds: string[];
  students: EnrolledStudent[];
  date: string;
  timeSlot: string;
  markedBy?: string;
  markedByName?: string;
  markedByRole?: string;
  status: 'PRESENT' | 'ABSENT' | 'PRACTICE_SESSION' | 'GROUP_SESSION' | 'NA';
  comment?: string;
  updatedAt?: string;
  records: AttendanceRecord[];
}

export const CmsAdminPage: React.FC<CmsAdminPageProps> = ({ onNavigate }) => {
  // Theme State (Dark / Light)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem(THEME_STORAGE_KEY) as 'dark' | 'light') || 'dark';
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };
  // Auth state & role management
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return AuthService.getCurrentUser() !== null;
  });
  const [currentUser, setCurrentUser] = useState<CmsUser | null>(() => {
    return AuthService.getCurrentUser();
  });
  const [loginEmail, setLoginEmail] = useState('');
  const [passcodeAttempt, setPasscodeAttempt] = useState('');
  const [authError, setAuthError] = useState('');

  const isTeacher = currentUser?.role === 'teacher';

  // Active tab & Mobile menu drawer
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const user = AuthService.getCurrentUser();
    if (user?.role === 'teacher') return 'attendance';
    return 'overview';
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // DEVELOPER ISSUE MODAL STATES
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [issueCategory, setIssueCategory] = useState<DeveloperIssue['category']>('Bug / Technical Issue');
  const [issuePriority, setIssuePriority] = useState<DeveloperIssue['priority']>('Medium');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [issueFeedbackToast, setIssueFeedbackToast] = useState<string | null>(null);
  const [developerIssues, setDeveloperIssues] = useState<DeveloperIssue[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // STUDENT REMINDER MODAL STATES
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [selectedStudentForReminder, setSelectedStudentForReminder] = useState<{ email: string; name: string; course?: string } | null>(null);
  const [reminderType, setReminderType] = useState<'FEE_PAYMENT' | 'ATTENDANCE' | 'CLASS_SCHEDULE' | 'GENERAL'>('FEE_PAYMENT');
  const [reminderSubject, setReminderSubject] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [reminderFeedbackToast, setReminderFeedbackToast] = useState<string | null>(null);

  // Teachers can only use attendance and their assigned leads
  useEffect(() => {
    if (isTeacher && activeTab !== 'attendance' && activeTab !== 'inquiries') {
      setActiveTab('attendance');
    }
  }, [isTeacher, activeTab]);

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [students, setStudents] = useState<EnrolledStudent[]>(() => sortStudentsById(AttendanceService.getAllStudents()));
  const [admissions, setAdmissions] = useState<AdmissionSubmission[]>([]);

  // Search & Filter states
  const [blogSearch, setBlogSearch] = useState('');
  const [blogCategoryFilter, setBlogCategoryFilter] = useState('ALL');
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<string>('ALL');
  const [inquirySourceFilter, setInquirySourceFilter] = useState<string>('ALL');
  const [selectedInquiryIds, setSelectedInquiryIds] = useState<string[]>([]);
  // Lead pipeline view toggle: 'pipeline' | 'list'
  const [leadView, setLeadView] = useState<'pipeline' | 'list'>('pipeline');
  // Mobile pipeline stage filter: 'ALL' | 'NEW' | 'CONTACTED' | 'ENROLLED' | 'ARCHIVED'
  const [mobilePipelineStage, setMobilePipelineStage] = useState<'ALL' | 'NEW' | 'CONTACTED' | 'ENROLLED' | 'ARCHIVED'>('ALL');
  // Lead assignment & archive workflow
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadAssigneeFilter, setLeadAssigneeFilter] = useState<string>('ALL');
  const [leadArchiveReasonFilter, setLeadArchiveReasonFilter] = useState<string>('ALL');
  const [archivePrompt, setArchivePrompt] = useState<{ ids: string[]; reason: string; note: string } | null>(null);
  const [leadActionError, setLeadActionError] = useState<string | null>(null);
  // Call notes panel
  const [notesLeadId, setNotesLeadId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  // Meta CAPI test state
  const [capiTestStatus, setCapiTestStatus] = useState<{ loading: boolean; result: string | null; isError: boolean }>({ loading: false, result: null, isError: false });

  // Students tab states
  const [studentSearch, setStudentSearch] = useState('');
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendancePickerSearch, setAttendancePickerSearch] = useState('');
  const [studentCourseFilter, setStudentCourseFilter] = useState('ALL');
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentFormData, setStudentFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    course: string;
    courses: string[];
    batch: string;
    enrolledDate: string;
  }>({
    name: '',
    email: '',
    phone: '',
    course: 'Pro DJ Course',
    courses: ['Pro DJ Course'],
    batch: 'Regular Studio Batch',
    enrolledDate: new Date().toISOString().split('T')[0],
  });

  // Admission Submissions states
  const [admissionSearch, setAdmissionSearch] = useState('');
  const [admissionTypeFilter, setAdmissionTypeFilter] = useState('ALL');
  const [admissionStatusFilter, setAdmissionStatusFilter] = useState('ALL');
  const [selectedAdmissionForModal, setSelectedAdmissionForModal] = useState<AdmissionSubmission | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // ATTENDANCE FEATURE STATES (Flowchart Integration)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => getTodayDateStr());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('11:00 AM - 01:00 PM');
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState<boolean>(false);
  const [attendanceFormDate, setAttendanceFormDate] = useState<string>(() => getTodayDateStr());
  const [customTimeStart, setCustomTimeStart] = useState<string>('11:00');
  const [customTimeEnd, setCustomTimeEnd] = useState<string>('13:00');
  const [attendanceFormStatus, setAttendanceFormStatus] = useState<AttendanceStatus>('PRESENT');
  const [attendanceFormComment, setAttendanceFormComment] = useState<string>('');
  const [editingAttendanceId, setEditingAttendanceId] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // Modal states for Group Session Batch Attendance
  const [isGroupAttendanceModalOpen, setIsGroupAttendanceModalOpen] = useState<boolean>(false);
  const [groupSessionDate, setGroupSessionDate] = useState<string>(() => getTodayDateStr());
  const [groupCustomTimeStart, setGroupCustomTimeStart] = useState<string>('11:00');
  const [groupCustomTimeEnd, setGroupCustomTimeEnd] = useState<string>('13:00');
  const [groupSessionStatus, setGroupSessionStatus] = useState<AttendanceStatus>('GROUP_SESSION');
  const [groupSessionComment, setGroupSessionComment] = useState<string>('');
  const [selectedGroupStudentIds, setSelectedGroupStudentIds] = useState<string[]>([]);
  const [groupStudentSearchQuery, setGroupStudentSearchQuery] = useState<string>('');
  const [groupSessionSuccessBanner, setGroupSessionSuccessBanner] = useState<string | null>(null);
  const [attendanceSubTab, setAttendanceSubTab] = useState<'roster' | 'group'>('roster');
  const [groupTabSearchQuery, setGroupTabSearchQuery] = useState<string>('');

  // Modal states for Lead Message Viewer
  const [expandedLeadMessage, setExpandedLeadMessage] = useState<ContactInquiry | null>(null);

  // States for Blog Editor
  const [articleSubTab, setArticleSubTab] = useState<'list' | 'editor'>('list');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [blogFormData, setBlogFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    category: 'PRODUCTION' as BlogPost['category'],
    coverImage: '',
    readTimeMinutes: 5,
    authorName: 'Abhinav',
    authorRole: 'Founder & Lead Music Production Mentor',
    authorAvatarUrl: 'https://raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/IMG_1400.JPG',
    isFeatured: false,
    tags: 'Music Production, Ableton Live',
    // SEO & Meta fields
    metaTitle: '',
    metaDescription: '',
    focusKeyword: '',
    canonicalUrl: '',
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
    twitterCard: 'summary_large_image' as 'summary' | 'summary_large_image',
    noIndex: false,
    schemaType: 'BlogPosting' as 'Article' | 'BlogPosting' | 'NewsArticle',
  });

  // FEES STATE
  const [fees, setFees] = useState<FeeReceipt[]>(FeeService.getCached);
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [feeSearch, setFeeSearch] = useState('');
  const defaultFeeForm = () => ({
    receiptNo: '',
    studentName: '',
    courseName: '',
    amount: '',
    paymentMode: 'Cash',
    periodFrom: new Date().toISOString().split('T')[0],
    periodTo: new Date().toISOString().split('T')[0],
    date: new Date().toISOString().split('T')[0],
    comment: '',
  });
  const [feeFormData, setFeeFormData] = useState<{
    receiptNo: string;
    studentName: string;
    courseName: string;
    amount: string;
    paymentMode: string;
    periodFrom: string;
    periodTo: string;
    date: string;
    comment: string;
  }>(defaultFeeForm());

  // CLASSES SECTION (ADMIN ONLY) STATES & FILTERS
  const [classesTeacherFilter, setClassesTeacherFilter] = useState<'ALL' | 'ashu' | 'vaibhav' | 'vrishan' | 'abhinav' | 'admin'>('ALL');
  const [classesStatusFilter, setClassesStatusFilter] = useState<string>('ALL');
  const [classesDatePreset, setClassesDatePreset] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [classesCustomDate, setClassesCustomDate] = useState<string>('');
  const [classesCourseFilter, setClassesCourseFilter] = useState<string>('ALL');
  const [classesSearch, setClassesSearch] = useState<string>('');
  const [selectedRecordForInspection, setSelectedRecordForInspection] = useState<ClassLogEntry | AttendanceRecord | null>(null);
  const [isClassesSyncing, setIsClassesSyncing] = useState<boolean>(false);
  const [classesFeedbackToast, setClassesFeedbackToast] = useState<string | null>(null);

  // Settings & Real-time states
  const [newPasscode, setNewPasscode] = useState('');
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState('');
  const [realtimeLeadToast, setRealtimeLeadToast] = useState<{ name: string; courseInterest: string; source?: string } | null>(null);
  const [dbStatus, setDbStatus] = useState<'connected' | 'connecting' | 'local'>('local');

  // Load data on mount and subscribe to real-time updates
  useEffect(() => {
    refreshData();

    // Check MongoDB Atlas status & poll for connection state
    const checkHealth = () => {
      const apiBase = getApiBaseUrl();
      fetch(`${apiBase}/health`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.mongodb === 'connected') setDbStatus('connected');
          else if (data?.mongodb === 'connecting') setDbStatus('connecting');
          else setDbStatus('local');
        })
        .catch(() => setDbStatus('local'));
    };

    checkHealth();
    const healthInterval = setInterval(checkHealth, 3000);

    // Real-time Inquiry subscription (cross-tab & in-app)
    const unsubscribeInquiries = InquiryService.subscribe((updatedInquiries, newInquiry) => {
      setInquiries(updatedInquiries);
      if (newInquiry) {
        setRealtimeLeadToast({
          name: newInquiry.name,
          courseInterest: newInquiry.courseInterest,
          source: newInquiry.attribution?.source || newInquiry.source || 'Direct',
        });
      }
    });

    // Real-time Admissions subscription
    const unsubscribeAdmissions = AdmissionService.subscribe((updatedAdmissions) => {
      setAdmissions(updatedAdmissions);
    });

    // Periodic polling fallback to ensure zero-lag synchronization (every 5s)
    const pollInterval = setInterval(() => {
      const latestInquiries = InquiryService.getAllInquiries();
      setInquiries((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(latestInquiries)) {
          return latestInquiries;
        }
        return prev;
      });

      const latestAdmissions = AdmissionService.getAllAdmissions();
      setAdmissions((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(latestAdmissions)) {
          return latestAdmissions;
        }
        return prev;
      });

      // Keep attendance synced with remote MongoDB
      AttendanceService.fetchAndSyncFromRemote();
      FeeService.fetchAndSync().then(setFees);
    }, 5000);

    const unsubscribeAttendance = AttendanceService.subscribe(() => {
      setAttendanceVersion((v) => v + 1);
    });

    return () => {
      unsubscribeInquiries();
      unsubscribeAdmissions();
      unsubscribeAttendance();
      clearInterval(pollInterval);
      clearInterval(healthInterval);
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && currentUser?.role === 'admin') {
      InquiryService.fetchTeam().then(setTeam);
    }
  }, [isAuthenticated, currentUser?.role]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshData();
      IssueService.fetchIssues().then((issues) => setDeveloperIssues(issues));
      const unsubscribeIssues = IssueService.subscribe((issues) => setDeveloperIssues(issues));
      const unsubscribeStudents = AttendanceService.subscribeStudents((sts) => setStudents(sortStudentsById(sts)));
      return () => {
        unsubscribeIssues();
        unsubscribeStudents();
      };
    }
  }, [isAuthenticated]);

  const [attendanceVersion, setAttendanceVersion] = useState(0);

  const refreshData = () => {
    setPosts(BlogService.getAllPosts());
    setInquiries(InquiryService.getAllInquiries());
    const currentAdmissions = AdmissionService.getAllAdmissions();
    setAdmissions(currentAdmissions);
    AttendanceService.reconcileWithAdmissions(currentAdmissions);
    AttendanceService.fetchStudents().then((sts) => setStudents(sortStudentsById(sts)));
    FeeService.fetchAndSync().then(setFees);
    // Trigger async remote sync — when it completes, saveAttendance fires notifyChange which bumps attendanceVersion via subscription
    AttendanceService.fetchAndSyncFromRemote();
    IssueService.fetchIssues().then((issues) => setDeveloperIssues(issues));
    setAttendanceVersion((v) => v + 1);
  };

  // Auth Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailKey = loginEmail.trim().toLowerCase();
    const passAttempt = passcodeAttempt.trim();

    const response = await AuthService.login(emailKey, passAttempt);

    if (response.success && response.user) {
      const userObj = response.user;
      setCurrentUser(userObj);
      setIsAuthenticated(true);
      setAuthError('');
      if (userObj.role === 'teacher') {
        setActiveTab('attendance');
      }
      refreshData();
      return;
    }

    setAuthError(response.error || 'Invalid credentials. Check your email address and password.');
  };

  const handleLogout = () => {
    AuthService.logout();
    AttendanceService.clearUserCache();
    AdmissionService.closeLiveStream();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  // Sign out when the server stops accepting the stored token, instead of
  // silently showing stale cached data
  useEffect(() => {
    if (!isAuthenticated) return;
    const verify = async () => {
      if (!(await AuthService.isSessionValid())) {
        handleLogout();
        setAuthError('Your session has expired. Please sign in again.');
      }
    };
    verify();
    const interval = setInterval(verify, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Each lead-details view starts with an empty note box
  useEffect(() => {
    setNoteDraft('');
    setNoteError(null);
  }, [expandedLeadMessage?.id]);

  // Escape closes the top-most open dialog (checked from the most nested outward)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (archivePrompt) return setArchivePrompt(null);
      if (notesLeadId) return setNotesLeadId(null);
      if (isReportModalOpen) return setIsReportModalOpen(false);
      if (isIssueModalOpen) return setIsIssueModalOpen(false);
      if (isReminderModalOpen) return setIsReminderModalOpen(false);
      if (isFeeModalOpen) return setIsFeeModalOpen(false);
      if (isAttendanceModalOpen) return setIsAttendanceModalOpen(false);
      if (isGroupAttendanceModalOpen) return setIsGroupAttendanceModalOpen(false);
      if (isStudentModalOpen) return setIsStudentModalOpen(false);
      if (selectedAdmissionForModal) return setSelectedAdmissionForModal(null);
      if (expandedLeadMessage) return setExpandedLeadMessage(null);
      if (isMobileMenuOpen) return setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    archivePrompt, notesLeadId, isReportModalOpen, isIssueModalOpen, isReminderModalOpen, isFeeModalOpen, isAttendanceModalOpen,
    isGroupAttendanceModalOpen, isStudentModalOpen, selectedAdmissionForModal, expandedLeadMessage, isMobileMenuOpen,
  ]);

  const navigateToPublic = (path: string) => {
    if (onNavigate) {
      if (path === '/') onNavigate('home');
      else if (path === '/blog') onNavigate('blog');
      else if (path === '/courses') onNavigate('courses');
    }
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // DEVELOPER ISSUE HANDLER
  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTitle.trim() || !issueDescription.trim()) {
      setIssueFeedbackToast('Please enter both a title and description.');
      return;
    }

    setIsSubmittingIssue(true);
    try {
      const res = await IssueService.submitIssue({
        title: issueTitle,
        description: issueDescription,
        category: issueCategory,
        priority: issuePriority,
        activeTab: activeTab,
      });

      if (res.success) {
        setIssueFeedbackToast('Issue submitted successfully to the developer team!');
        setIssueTitle('');
        setIssueDescription('');
        setIssueCategory('Bug / Technical Issue');
        setIssuePriority('Medium');
        const updated = await IssueService.fetchIssues();
        setDeveloperIssues(updated);
        setTimeout(() => {
          setIsIssueModalOpen(false);
          setIssueFeedbackToast(null);
        }, 1800);
      } else {
        setIssueFeedbackToast(res.error || 'Failed to send issue. Please try again.');
      }
    } catch {
      setIssueFeedbackToast('An error occurred. Please try again or email directly.');
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const handleCopyDiagnostics = () => {
    const report = IssueService.formatDiagnosticReport({
      title: issueTitle || 'Draft Issue',
      description: issueDescription || 'No description entered yet',
      category: issueCategory,
      priority: issuePriority,
      reporterEmail: currentUser?.email,
      reporterName: currentUser?.name,
      reporterRole: currentUser?.role,
      systemInfo: IssueService.getSystemInfo(activeTab),
    });

    navigator.clipboard.writeText(report).then(() => {
      setCopyToast('Diagnostic report copied to clipboard!');
      setTimeout(() => setCopyToast(null), 2500);
    }).catch(() => {
      setCopyToast('Failed to copy text.');
    });
  };

  // STUDENT REMINDER HANDLERS
  const handleOpenReminderModal = (student: { email: string; name: string; course?: string }, defaultType: 'FEE_PAYMENT' | 'ATTENDANCE' | 'CLASS_SCHEDULE' | 'GENERAL' = 'FEE_PAYMENT') => {
    setSelectedStudentForReminder(student);
    setReminderType(defaultType);
    setReminderFeedbackToast(null);

    if (defaultType === 'FEE_PAYMENT') {
      setReminderSubject(`Soundabode Studios - Fee Payment Reminder for ${student.name}`);
      setReminderMessage(`Dear ${student.name},\n\nThis is a friendly reminder from Soundabode Studios regarding your course fee payment for ${student.course || 'your training program'}.\n\nPlease ensure your pending payment is completed at your earliest convenience to maintain uninterrupted access to studio practice sessions and classes.\n\nFor any queries or receipt confirmation, feel free to contact us.\n\nBest regards,\nSoundabode Studios Management`);
    } else if (defaultType === 'ATTENDANCE') {
      setReminderSubject(`Soundabode Studios - Class Attendance Notice for ${student.name}`);
      setReminderMessage(`Dear ${student.name},\n\nThis is an attendance notice regarding your recent class attendance at Soundabode Studios.\n\nRegular attendance is mandatory to successfully complete your training modules. Please log your session with your instructor or get in touch if you missed any recent class.\n\nBest regards,\nSoundabode Studios`);
    } else if (defaultType === 'CLASS_SCHEDULE') {
      setReminderSubject(`Soundabode Studios - Class Schedule Update`);
      setReminderMessage(`Dear ${student.name},\n\nPlease note an important update regarding your upcoming class schedule at Soundabode Studios.\n\nIf you have any questions regarding your time slots or instructor availability, please reach out to studio admin.\n\nBest regards,\nSoundabode Studios`);
    } else {
      setReminderSubject(`Soundabode Studios - Notice for ${student.name}`);
      setReminderMessage(`Dear ${student.name},\n\nWe hope your training at Soundabode Studios is going great!\n\nPlease review this important notice from the studio management team.\n\nBest regards,\nSoundabode Studios`);
    }

    setIsReminderModalOpen(true);
  };

  const handleSendReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForReminder || !selectedStudentForReminder.email) {
      setReminderFeedbackToast('No valid student email address selected.');
      return;
    }

    setIsSendingReminder(true);
    try {
      const res = await ReminderService.sendStudentReminder({
        studentEmail: selectedStudentForReminder.email,
        studentName: selectedStudentForReminder.name,
        subject: reminderSubject,
        message: reminderMessage,
        reminderType,
        courseName: selectedStudentForReminder.course,
      });

      if (res.success) {
        setReminderFeedbackToast(`Email reminder sent successfully to ${selectedStudentForReminder.email} via Zoho Mail!`);
        setTimeout(() => {
          setIsReminderModalOpen(false);
          setReminderFeedbackToast(null);
        }, 1800);
      } else {
        setReminderFeedbackToast(res.error || 'Failed to send reminder email.');
      }
    } catch {
      setReminderFeedbackToast('An error occurred while sending the email.');
    } finally {
      setIsSendingReminder(false);
    }
  };

  // BLOG HANDLERS
  const openNewBlogModal = () => {
    setEditingPostId(null);
    setBlogFormData({
      title: '',
      slug: '',
      excerpt: '',
      content: '<p>Write your article content here...</p>',
      category: 'PRODUCTION',
      coverImage: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1200&auto=format&fit=crop',
      readTimeMinutes: 5,
      authorName: 'Abhinav',
      authorRole: 'Founder & Lead Music Production Mentor',
      authorAvatarUrl: 'https://raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/IMG_1400.JPG',
      isFeatured: false,
      tags: 'Music Production, Ableton Live',
      // SEO defaults
      metaTitle: '',
      metaDescription: '',
      focusKeyword: '',
      canonicalUrl: '',
      ogTitle: '',
      ogDescription: '',
      ogImage: '',
      twitterCard: 'summary_large_image',
      noIndex: false,
      schemaType: 'BlogPosting',
    });
    setArticleSubTab('editor');
  };

  const openEditBlogModal = (post: BlogPost) => {
    setEditingPostId(post.id);
    const authorName = post.author?.name || (post as any).authorName || 'Soundabode Team';
    const authorRole = post.author?.role || (post as any).authorRole || 'Certified Instructor';
    const authorAvatarUrl = post.author?.avatarUrl || (post as any).authorAvatarUrl || '';

    setBlogFormData({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      category: post.category,
      coverImage: post.coverImage,
      readTimeMinutes: post.readTimeMinutes,
      authorName,
      authorRole,
      authorAvatarUrl,
      isFeatured: !!post.isFeatured,
      tags: post.tags ? post.tags.join(', ') : '',
      // SEO fields
      metaTitle: post.metaTitle || '',
      metaDescription: post.metaDescription || '',
      focusKeyword: post.focusKeyword || '',
      canonicalUrl: post.canonicalUrl || '',
      ogTitle: post.ogTitle || '',
      ogDescription: post.ogDescription || '',
      ogImage: post.ogImage || '',
      twitterCard: post.twitterCard || 'summary_large_image',
      noIndex: post.noIndex || false,
      schemaType: post.schemaType || 'BlogPosting',
    });
    setArticleSubTab('editor');
  };

  const handleSaveBlog = (savedData?: typeof blogFormData) => {
    const dataToSave = savedData || blogFormData;
    const parsedTags = dataToSave.tags
      ? dataToSave.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const generatedSlug =
      dataToSave.slug.trim() ||
      dataToSave.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

    const postPayload: BlogPost = {
      id: editingPostId || String(Date.now()),
      title: dataToSave.title,
      slug: generatedSlug,
      excerpt: dataToSave.excerpt,
      content: dataToSave.content,
      category: dataToSave.category,
      coverImage: dataToSave.coverImage,
      readTimeMinutes: Number(dataToSave.readTimeMinutes) || 5,
      publishedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      author: {
        name: dataToSave.authorName,
        role: dataToSave.authorRole,
        avatarUrl: dataToSave.authorAvatarUrl,
      },
      isFeatured: dataToSave.isFeatured,
      tags: parsedTags,
      // SEO fields
      metaTitle: dataToSave.metaTitle || undefined,
      metaDescription: dataToSave.metaDescription || undefined,
      focusKeyword: dataToSave.focusKeyword || undefined,
      canonicalUrl: dataToSave.canonicalUrl || undefined,
      ogTitle: dataToSave.ogTitle || undefined,
      ogDescription: dataToSave.ogDescription || undefined,
      ogImage: dataToSave.ogImage || undefined,
      twitterCard: dataToSave.twitterCard,
      noIndex: dataToSave.noIndex,
      schemaType: dataToSave.schemaType,
    };

    if (editingPostId) {
      BlogService.updatePost(editingPostId, postPayload);
    } else {
      BlogService.createPost(postPayload);
    }

    refreshData();
    setArticleSubTab('list');
  };

  const handleDeleteBlog = async (id: string, title: string) => {
    if (window.confirm(`Delete article "${title}"?`)) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
      await BlogService.deletePost(id);
      refreshData();
    }
  };

  // LEAD STAGE, ARCHIVE & ASSIGNMENT HANDLERS
  const applyLeadUpdate = async (ids: string[], update: LeadUpdate) => {
    setLeadActionError(null);
    const results = await Promise.all(ids.map((id) => InquiryService.updateLead(id, update)));
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      setLeadActionError(`${failed.length} of ${ids.length} lead(s) not updated: ${failed[0].error}`);
    }
    refreshData();
  };

  // Archiving always asks for a reason first; other stages apply immediately
  const requestStageChange = (ids: string[], status: LeadStatus, notes?: string) => {
    if (ids.length === 0) return;
    if (status === 'ARCHIVED') {
      const existing = ids.length === 1 ? inquiries.find((i) => i.id === ids[0]) : undefined;
      setArchivePrompt({ ids, reason: existing?.archiveReason || '', note: existing?.archiveNote || '' });
      return;
    }
    applyLeadUpdate(ids, { status, ...(notes !== undefined ? { notes } : {}) });
  };

  const confirmArchive = async () => {
    if (!archivePrompt || !archivePrompt.reason) return;
    const { ids, reason, note } = archivePrompt;
    setArchivePrompt(null);
    setSelectedInquiryIds((prev) => prev.filter((id) => !ids.includes(id)));
    await applyLeadUpdate(ids, { status: 'ARCHIVED', archiveReason: reason, archiveNote: note.trim() });
  };

  const handleArchiveReasonChange = (inq: ContactInquiry, reason: string) => {
    if (reason === 'Other') {
      setArchivePrompt({ ids: [inq.id], reason, note: inq.archiveNote || '' });
      return;
    }
    applyLeadUpdate([inq.id], { status: 'ARCHIVED', archiveReason: reason, archiveNote: '' });
  };

  const handleAssignLeads = (ids: string[], assignedTo: string) => {
    if (ids.length === 0) return;
    applyLeadUpdate(ids, { assignedTo });
  };

  const handleDeleteInquiry = async (id: string) => {
    if (window.confirm('Delete this inquiry?')) {
      setInquiries((prev) => prev.filter((i) => i.id !== id));
      setSelectedInquiryIds((prev) => prev.filter((item) => item !== id));
      await InquiryService.deleteInquiry(id);
      refreshData();
    }
  };

  const handleToggleSelectAllInquiries = () => {
    const allFilteredIds = filteredInquiries.map((i) => i.id);
    const isAllSelected =
      allFilteredIds.length > 0 &&
      allFilteredIds.every((id) => selectedInquiryIds.includes(id));

    if (isAllSelected) {
      setSelectedInquiryIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedInquiryIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleToggleSelectInquiry = (id: string) => {
    setSelectedInquiryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBatchDeleteInquiries = async () => {
    if (selectedInquiryIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedInquiryIds.length} selected lead(s)?`)) {
      const idsToDelete = [...selectedInquiryIds];
      setInquiries((prev) => prev.filter((i) => !idsToDelete.includes(i.id)));
      setSelectedInquiryIds([]);
      await Promise.all(idsToDelete.map((id) => InquiryService.deleteInquiry(id)));
      refreshData();
    }
  };

  const handleBatchUpdateInquiriesStatus = (status: LeadStatus) => {
    if (selectedInquiryIds.length === 0) return;
    requestStageChange([...selectedInquiryIds], status);
    if (status !== 'ARCHIVED') setSelectedInquiryIds([]);
  };

  // ADMISSION SUBMISSIONS HANDLERS
  // Enrolling also creates the student record on the server, so confirm it first
  const handleAdmissionStatusChange = (item: AdmissionSubmission, nextStatus: AdmissionSubmission['status']) => {
    if (nextStatus === item.status) return;
    if (
      nextStatus === 'ENROLLED' &&
      !window.confirm(`Enroll ${item.firstName} ${item.lastName}? This adds them to Students and Attendance.`)
    ) {
      return;
    }
    AdmissionService.updateStatus(item.id, nextStatus);
    refreshData();
  };

  const renderAdmissionStatusSelect = (item: AdmissionSubmission) => (
    <div className={`${styles.stageDropdownWrapper} ${styles.stageDropdownInline}`} data-stage={item.status} title="Change application status">
      <span className={styles.stageDot} />
      <select
        value={item.status}
        onChange={(e) => handleAdmissionStatusChange(item, e.target.value as AdmissionSubmission['status'])}
        className={styles.stageSelect}
        aria-label={`Status for ${item.firstName} ${item.lastName}`}
      >
        {LEAD_STAGES.map((st) => (
          <option key={st} value={st} className={styles.stageOption}>{LEAD_STAGE_LABELS[st]}</option>
        ))}
      </select>
      <svg className={styles.stageChevron} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
    </div>
  );

  const handleDeleteAdmission = async (id: string, formNo: string) => {
    if (window.confirm(`Delete submission ${formNo}?`)) {
      setAdmissions((prev) => prev.filter((a) => a.id !== id));
      await AdmissionService.deleteAdmission(id);
      refreshData();
    }
  };

  const handleGenerateReceiptFromAdmission = (item: AdmissionSubmission) => {
    setEditingFeeId(null);
    const cleanedAmount = item.fee ? item.fee.replace(/[^0-9]/g, '') : '';
    setFeeFormData({
      receiptNo: item.formNo || '',
      studentName: `${item.firstName} ${item.lastName}`.trim(),
      courseName: item.courseOpted || '',
      amount: cleanedAmount,
      paymentMode: 'Cash',
      periodFrom: new Date().toISOString().split('T')[0],
      periodTo: new Date().toISOString().split('T')[0],
      date: new Date().toISOString().split('T')[0],
      comment: '',
    });
    setIsFeeModalOpen(true);
  };

  const handleCopyAdmissionLink = (item: AdmissionSubmission) => {
    const shareUrl = `${window.location.origin}/admission-${item.formType.toLowerCase()}?id=${item.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopyToast(`Copied share link for ${item.formNo}!`);
    setTimeout(() => setCopyToast(null), 3000);
  };

  const handlePrintAdmissionForm = (item: AdmissionSubmission) => {
    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) return;

    const courses = item.formType === 'DJ' ? DJ_COURSES : EMP_COURSES;
    const disclaimer = item.formType === 'DJ' ? DJ_DISCLAIMER : EMP_DISCLAIMER;
    const subtitle = item.formType === 'DJ' ? 'Disk Jockey Training Course' : 'Electronic Music Production';

    const coursesRows = courses
      .map((c) => {
        const isSelected = item.courseOpted.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(item.courseOpted.toLowerCase());
        return `
          <tr class="${isSelected ? 'selected' : ''}">
            <td style="text-align: center; font-weight: bold; color: #ef4444;">${isSelected ? '✓' : ''}</td>
            <td><strong>${escapeHtml(c.name)}</strong> ${isSelected ? ' <span style="color:#ef4444; font-weight:800;">(SELECTED)</span>' : ''}</td>
            <td>${escapeHtml(c.tenure)}</td>
            <td><strong>${escapeHtml(c.fee)}</strong></td>
          </tr>
        `;
      })
      .join('');

    const disclaimerItems = disclaimer.map((d) => `<li>${escapeHtml(d)}</li>`).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>SoundAbode Form ${escapeHtml(item.formNo)} - ${escapeHtml(item.firstName)} ${escapeHtml(item.lastName)}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; padding: 20px; background: #fff; line-height: 1.4; }
            .docHeader { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #1e293b; margin-bottom: 15px; }
            .docBrandHeader { display: flex; align-items: center; gap: 12px; }
            .docLogoImg { height: 42px; }
            .docTitleH2 { font-size: 1.5rem; font-weight: 800; margin: 0; color: #0f172a; }
            .docFormNo { font-size: 0.85rem; font-weight: 700; font-family: monospace; background: #f1f5f9; padding: 6px 12px; border-radius: 4px; border: 1px solid #cbd5e1; }
            .sectionHeaderBar { background: #272e39; color: #fff; padding: 6px 12px; font-size: 0.82rem; font-weight: 700; text-transform: capitalize; margin: 15px 0 10px; border-radius: 2px; }
            .fieldGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; font-size: 0.85rem; }
            .fullWidth { grid-column: span 2; }
            .formGroup label { font-size: 0.78rem; font-weight: 700; color: #475569; display: block; margin-bottom: 4px; }
            .formInput { width: 100%; padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 0.85rem; box-sizing: border-box; background: #f8fafc; color: #0f172a; font-family: inherit; }
            .formTextarea { min-height: 50px; resize: none; }
            .courseTable { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 0.82rem; }
            .courseTable th { background: #f1f5f9; text-align: left; padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700; }
            .courseTable td { padding: 6px 10px; border: 1px solid #cbd5e1; }
            .courseTable tr.selected { background: rgba(225, 29, 72, 0.06); }
            .disclaimerList { padding-left: 20px; font-size: 0.75rem; color: #475569; line-height: 1.5; margin: 8px 0; }
            .agreementBox { border: 1px solid #cbd5e1; background: #f8fafc; padding: 12px; border-radius: 6px; margin-top: 15px; font-size: 0.8rem; }
            .docFooterBranding { margin-top: 25px; padding-top: 15px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: #64748b; }
            .softwarePill { display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; margin-left: 4px; color: #334155; }
            .passportPhotoBox { width: 1.5in; height: 2in; border: 1.5px dashed #cbd5e1; border-radius: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #f8fafc; flex-shrink: 0; box-sizing: border-box; }
          </style>
        </head>
        <body>
          <div class="docHeader">
            <div class="docBrandHeader">
              <img src="${window.location.origin}/favicon-192x192.png" class="docLogoImg" />
              <div>
                <h2 class="docTitleH2">Training Form</h2>
                <div style="font-size:0.82rem; color:#64748b; font-weight:600;">${escapeHtml(subtitle)}</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:12px;">
              <div class="docFormNo">Form No. ${escapeHtml(item.formNo)}</div>
              <div class="passportPhotoBox">
                ${safeImageUrl(item.photoUrl)
        ? `<img src="${safeImageUrl(item.photoUrl)}" style="width:100%;height:100%;object-fit:cover;display:block;" />`
        : `<div style="padding:4px;color:#64748b;font-size:0.68rem;text-align:center;font-weight:600;">Affix Passport<br/>Photo<br/>(1.5" × 2")</div>`
      }
              </div>
            </div>
          </div>

          <div class="sectionHeaderBar">Trainee Info</div>
          <div class="fieldGrid">
            <div class="formGroup"><label>First Name</label><input class="formInput" value="${escapeHtml(item.firstName)}" readonly /></div>
            <div class="formGroup"><label>Last Name</label><input class="formInput" value="${escapeHtml(item.lastName)}" readonly /></div>
            <div class="formGroup"><label>Cell Phone</label><input class="formInput" value="${escapeHtml(item.cellPhone)}" readonly /></div>
            <div class="formGroup"><label>Work Phone</label><input class="formInput" value="${escapeHtml(item.workPhone || '')}" readonly /></div>
            <div class="formGroup"><label>Email</label><input class="formInput" value="${escapeHtml(item.email)}" readonly /></div>
            <div class="formGroup"><label>Aadhar / ID Proof No.</label><input class="formInput" value="${escapeHtml(item.aadharNo)}" readonly /></div>
            <div class="formGroup fullWidth"><label>Father's Name</label><input class="formInput" value="${escapeHtml(item.fatherName)}" readonly /></div>
            <div class="formGroup fullWidth"><label>Address / ID Proof Details</label><textarea class="formInput formTextarea" readonly>${escapeHtml(item.address)}</textarea></div>
          </div>

          <div class="sectionHeaderBar">Course Opting For</div>
          <table class="courseTable">
            <thead>
              <tr>
                <th style="width:40px; text-align:center;">SELECT</th>
                <th>COURSE OPTION</th>
                <th style="width:120px;">TENURE</th>
                <th style="width:120px;">FEE AMOUNT</th>
              </tr>
            </thead>
            <tbody>${coursesRows}</tbody>
          </table>

          <div class="sectionHeaderBar">Disclaimer &amp; Studio Rules</div>
          <ol class="disclaimerList">${disclaimerItems}</ol>

          <div class="agreementBox">
            <p>I <strong>${escapeHtml(item.firstName)} ${escapeHtml(item.lastName)}</strong> hereby agree with the terms and conditions laid down by SoundAbode Studios for <strong>${escapeHtml(item.courseOpted)}</strong> and therefore paying in full amount or easy installments for the same.</p>
            <div style="margin-bottom:8px;"><label style="font-size:0.75rem; font-weight:700;">Student Signature (Typed Name)</label><input class="formInput" value="${escapeHtml(item.signatureName)}" readonly /></div>
            <div>✓ I confirm that I have read and agree to abide by all the terms, conditions, and studio rules laid down by SoundAbode Studios.</div>
          </div>

          <div class="docFooterBranding">
            <div>
              <strong>VISION 9 MALL, SHOP 218</strong>, PIMPLE SAUDAGAR, PUNE – 411017<br />
              PH: 9975016189 | EMAIL: SERVICES@SOUNDABODE.COM | WWW.SOUNDABODE.COM
            </div>

          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(sanitizePrintHtml(html));
    printWindow.document.close();
  };

  // ATTENDANCE FLOWCHART HANDLERS
  const handleOpenStudentCalendar = (studentId: string) => {
    setSelectedStudentId(studentId);
    setAttendanceSubTab('roster');
    setActiveTab('attendance');
    const now = new Date();
    setCalendarDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateStr(getTodayDateStr());
  };

  const handleOpenAttendanceModal = (slot?: string, date?: string, studentId?: string) => {
    const targetDate = date || selectedDateStr || getTodayDateStr();
    const targetSlot = slot || selectedTimeSlot || '11:00 AM - 01:00 PM';

    setAttendanceFormDate(targetDate);
    setAttendancePickerSearch('');

    const convert12to24 = (time12: string, default24: string) => {
      const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (!match) return default24;
      let hour = parseInt(match[1], 10);
      const min = match[2];
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      return `${hour.toString().padStart(2, '0')}:${min}`;
    };

    // Use explicit studentId param (avoids stale state from React batching)
    const resolvedStudentId = studentId || selectedStudentId || (students.length > 0 ? students[0].id : '');
    if (resolvedStudentId && resolvedStudentId !== selectedStudentId) {
      setSelectedStudentId(resolvedStudentId);
    }

    const currentStudentId = resolvedStudentId;
    if (currentStudentId) {
      const records = AttendanceService.getAttendanceForStudent(currentStudentId, currentUser || undefined);

      // If a specific slot was clicked, do exact match. If no slot (calendar day click), find first record for that date.
      let existing: typeof records[0] | undefined;
      if (slot) {
        existing = records.find((r) => r.date === targetDate && r.timeSlot === slot);
      } else {
        existing = records.find((r) => r.date === targetDate);
      }

      if (existing) {
        setEditingAttendanceId(existing.id);
        setAttendanceFormStatus(existing.status as AttendanceStatus);
        setAttendanceFormComment(existing.comment);
        // Use the ACTUAL time slot from the existing record to populate the time picker
        const recordSlot = existing.timeSlot || targetSlot;
        setSelectedTimeSlot(recordSlot);
        if (recordSlot && recordSlot.includes('-')) {
          const parts = recordSlot.split('-').map((s) => s.trim());
          if (parts.length === 2) {
            setCustomTimeStart(convert12to24(parts[0], '11:00'));
            setCustomTimeEnd(convert12to24(parts[1], '13:00'));
          }
        }
      } else {
        setEditingAttendanceId(null);
        setAttendanceFormStatus('PRESENT');
        setAttendanceFormComment('');
        setSelectedTimeSlot(targetSlot);
        if (targetSlot && targetSlot.includes('-')) {
          const parts = targetSlot.split('-').map((s) => s.trim());
          if (parts.length === 2) {
            setCustomTimeStart(convert12to24(parts[0], '11:00'));
            setCustomTimeEnd(convert12to24(parts[1], '13:00'));
          }
        }
      }
    } else {
      setEditingAttendanceId(null);
      setSelectedTimeSlot(targetSlot);
      if (targetSlot && targetSlot.includes('-')) {
        const parts = targetSlot.split('-').map((s) => s.trim());
        if (parts.length === 2) {
          setCustomTimeStart(convert12to24(parts[0], '11:00'));
          setCustomTimeEnd(convert12to24(parts[1], '13:00'));
        }
      }
    }
    setIsAttendanceModalOpen(true);
  };

  const handleDeleteCurrentAttendance = async () => {
    if (!selectedStudentId) return;
    const targetDate = attendanceFormDate || selectedDateStr;

    if (window.confirm(`Are you sure you want to delete this attendance record?`)) {
      if (editingAttendanceId) {
        // Delete the specific record we're editing
        await AttendanceService.deleteAttendanceRecord(editingAttendanceId);
      } else {
        // No editingAttendanceId — try to find matching record by date + constructed slot
        const formatTime = (timeStr: string) => {
          if (!timeStr) return '';
          const [h, m] = timeStr.split(':');
          const hour = parseInt(h, 10);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const formattedHour = hour % 12 || 12;
          return `${formattedHour.toString().padStart(2, '0')}:${m} ${ampm}`;
        };
        const finalSlot = customTimeStart && customTimeEnd
          ? `${formatTime(customTimeStart)} - ${formatTime(customTimeEnd)}`
          : '11:00 AM - 01:00 PM';
        const records = AttendanceService.getAttendanceForStudent(selectedStudentId, currentUser || undefined);
        // Try exact slot match first, then fallback to any record on that date
        const existing = records.find((r) => r.date === targetDate && r.timeSlot === finalSlot)
          || records.find((r) => r.date === targetDate);
        if (existing) {
          await AttendanceService.deleteAttendanceRecord(existing.id);
        }
      }
      setIsAttendanceModalOpen(false);
      setEditingAttendanceId(null);
      refreshData();
    }
  };

  const [editingGroupSessionKey, setEditingGroupSessionKey] = useState<{ date: string; timeSlot: string } | null>(null);

  const parseTimeSlotToInputs = (timeSlot: string) => {
    try {
      const parts = timeSlot.split('-').map((s) => s.trim());
      if (parts.length === 2) {
        const parseSingle = (tStr: string) => {
          const match = tStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
          if (!match) return '';
          let hour = parseInt(match[1], 10);
          const min = match[2];
          const ampm = match[3].toUpperCase();
          if (ampm === 'PM' && hour < 12) hour += 12;
          if (ampm === 'AM' && hour === 12) hour = 0;
          return `${hour.toString().padStart(2, '0')}:${min}`;
        };
        const start = parseSingle(parts[0]);
        const end = parseSingle(parts[1]);
        if (start && end) return { start, end };
      }
    } catch {}
    return { start: '11:00', end: '13:00' };
  };

  const handleOpenGroupAttendanceModal = (dateStr?: string) => {
    setEditingGroupSessionKey(null);
    const targetDate = dateStr || selectedDateStr || getTodayDateStr();
    setGroupSessionDate(targetDate);
    setGroupCustomTimeStart('11:00');
    setGroupCustomTimeEnd('13:00');
    setSelectedGroupStudentIds([]);
    setGroupSessionStatus('GROUP_SESSION');
    setGroupSessionComment('');
    setGroupStudentSearchQuery('');
    setIsGroupAttendanceModalOpen(true);
  };

  const handleToggleSelectGroupStudent = (studentId: string) => {
    const canonicalId = canonicalizeStudentId(studentId);
    setSelectedGroupStudentIds((prev) => {
      const exists = prev.some((id) => canonicalizeStudentId(id) === canonicalId);
      if (exists) {
        return prev.filter((id) => canonicalizeStudentId(id) !== canonicalId);
      } else {
        return [...prev, canonicalId];
      }
    });
  };

  const handleToggleSelectAllGroupStudents = () => {
    if (selectedGroupStudentIds.length === markableEntries.length) {
      setSelectedGroupStudentIds([]);
    } else {
      setSelectedGroupStudentIds(markableEntries.map((e) => e.key));
    }
  };

  // Entry key a stored record shows under (course entry for multi-course students)
  const keyForRecord = (r: AttendanceRecord) =>
    entryKeyForRecord(r, students.find((s) => s.id === canonicalizeStudentId(r.studentId)));

  const handleSaveGroupAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedGroupStudentIds.length === 0) {
      alert('Please select at least one student for the group session.');
      return;
    }

    const formatTime = (timeStr: string) => {
      if (!timeStr) return '';
      const [h, m] = timeStr.split(':');
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const formattedHour = hour % 12 || 12;
      return `${formattedHour.toString().padStart(2, '0')}:${m} ${ampm}`;
    };

    const timeSlotStr = groupCustomTimeStart && groupCustomTimeEnd
      ? `${formatTime(groupCustomTimeStart)} - ${formatTime(groupCustomTimeEnd)}`
      : '11:00 AM - 01:00 PM';

    const user = currentUser || AuthService.getCurrentUser();
    const markedByEmail = user?.email || (isTeacher ? 'teacher@soundabode.com' : 'abhinav@soundabode.com');
    const markedByName = user?.name || (isTeacher ? 'Teacher' : 'Abhinav');
    const markedByRole = user?.role === 'teacher' ? 'teacher' : 'admin';

    // If editing an existing session, remove unselected students or clean up old slot records
    if (editingGroupSessionKey) {
      const oldRecords = allAttendanceRecords.filter(
        (r) => r.date === editingGroupSessionKey.date &&
               r.timeSlot === editingGroupSessionKey.timeSlot &&
               r.status === 'GROUP_SESSION'
      );
      
      const newSelectedSet = new Set(selectedGroupStudentIds);
      const isSlotOrDateChanged = editingGroupSessionKey.date !== groupSessionDate || editingGroupSessionKey.timeSlot !== timeSlotStr;

      for (const oldRec of oldRecords) {
        if (isSlotOrDateChanged || !newSelectedSet.has(keyForRecord(oldRec))) {
          await AttendanceService.deleteAttendanceRecord(oldRec.id);
        }
      }
    }

    AttendanceService.markBatchGroupAttendance({
      studentIds: selectedGroupStudentIds,
      date: groupSessionDate,
      timeSlot: timeSlotStr,
      status: groupSessionStatus,
      comment: groupSessionComment.trim(),
      markedBy: markedByEmail,
      markedByName: markedByName,
      markedByRole: markedByRole,
    });

    setEditingGroupSessionKey(null);
    setAttendanceVersion((v) => v + 1);
    setIsGroupAttendanceModalOpen(false);
    setGroupSessionSuccessBanner(
      `Group Session attendance updated for ${selectedGroupStudentIds.length} student(s) on ${groupSessionDate} (${timeSlotStr})!`
    );
    setTimeout(() => setGroupSessionSuccessBanner(null), 5000);
  };


  const handleSaveAttendance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;


    const formatTime = (timeStr: string) => {
      if (!timeStr) return '';
      const [h, m] = timeStr.split(':');
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const formattedHour = hour % 12 || 12;
      return `${formattedHour.toString().padStart(2, '0')}:${m} ${ampm}`;
    };
    const finalSlot = customTimeStart && customTimeEnd
      ? `${formatTime(customTimeStart)} - ${formatTime(customTimeEnd)}`
      : '11:00 AM - 01:00 PM';

    // A new session for a multi-course student must say which course it was for;
    // updating one of their existing sessions (same date and time) is fine
    const entry = AttendanceService.getEntry(selectedStudentId);
    const courseUnknown = !!entry && entry.kind !== 'course' && getStudentCourses(entry.student).length > 1;
    const saveDate = attendanceFormDate || selectedDateStr;
    const updatesExisting = AttendanceService.getAttendanceForStudent(selectedStudentId, currentUser || undefined)
      .some((r) => r.date === saveDate && r.timeSlot === finalSlot);
    if (courseUnknown && !updatesExisting) {
      alert(`${entry!.student.name} is enrolled in more than one course. Choose the course entry this session was for.`);
      return;
    }

    const user = currentUser || AuthService.getCurrentUser();
    const markerEmail = user?.email || (isTeacher ? 'teacher@soundabode.com' : 'abhinav@soundabode.com');
    const markerName = user?.name || (isTeacher ? 'Teacher' : 'Abhinav');
    const markerRole = isTeacher ? 'teacher' : 'admin';

    AttendanceService.markAttendance({
      studentId: selectedStudentId,
      date: attendanceFormDate || selectedDateStr,
      timeSlot: finalSlot,
      status: attendanceFormStatus,
      comment: attendanceFormComment,
      markedBy: markerEmail,
      markedByName: markerName,
      markedByRole: markerRole,
    });

    setIsAttendanceModalOpen(false);
    refreshData();
  };

  // STUDENT MANAGEMENT HANDLERS
  const handleOpenNewStudentModal = () => {
    setEditingStudentId(null);
    setStudentFormData({
      name: '',
      email: '',
      phone: '',
      course: 'Pro DJ Course',
      courses: ['Pro DJ Course'],
      batch: 'Regular Studio Batch (Mon/Wed/Fri)',
      enrolledDate: new Date().toISOString().split('T')[0],
    });
    setIsStudentModalOpen(true);
  };

  const handleOpenEditStudentModal = (std: EnrolledStudent) => {
    setEditingStudentId(std.id);
    const courses = getStudentCourses(std);
    setStudentFormData({
      name: std.name,
      email: std.email,
      phone: std.phone,
      course: courses.join(', ') || std.course,
      courses: courses.length > 0 ? courses : [std.course || 'Pro DJ Course'],
      batch: std.batch,
      enrolledDate: std.enrolledDate,
    });
    setIsStudentModalOpen(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentFormData.name.trim()) return;

    const finalCourses = studentFormData.courses && studentFormData.courses.length > 0
      ? studentFormData.courses
      : (studentFormData.course ? getStudentCourses(studentFormData) : ['Pro DJ Course']);

    const payload = {
      ...studentFormData,
      courses: finalCourses,
      course: finalCourses.join(', '),
    };

    if (editingStudentId) {
      AttendanceService.updateStudent(editingStudentId, payload);
    } else {
      AttendanceService.addStudent(payload);
    }

    setIsStudentModalOpen(false);
    refreshData();
  };

  // Takes one course off a multi-course student. Their past sessions for it are kept and
  // then show under "Earlier sessions (course not recorded)".
  const handleRemoveStudentCourse = (student: EnrolledStudent, course: string) => {
    const courses = getStudentCourses(student);
    const idx = courses.findIndex((c) => c.toLowerCase() === course.toLowerCase());
    if (idx === -1 || courses.length <= 1) return;
    if (!window.confirm(`Remove "${course}" from ${student.name}? Their other courses and all past attendance are kept.`)) return;
    const batches = student.batches && student.batches.length === courses.length
      ? student.batches.filter((_, i) => i !== idx)
      : undefined;
    AttendanceService.updateStudent(student.id, {
      courses: courses.filter((_, i) => i !== idx),
      ...(batches ? { batches } : {}),
    });
    refreshData();
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    if (window.confirm(`Remove student "${name}" from roster?`)) {
      setStudents((prev) => prev.filter((s) => s.id !== id));
      await AttendanceService.deleteStudent(id);
      refreshData();
    }
  };

  // FEES HANDLERS
  const getNextReceiptNo = (existingFees: FeeReceipt[]): string => {
    if (existingFees.length === 0) return '001';
    const nums = existingFees.map((f) => parseInt(f.receiptNo, 10)).filter(Boolean);
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return String(max + 1).padStart(3, '0');
  };

  const handleOpenNewFeeModal = () => {
    setEditingFeeId(null);
    setFeeFormData({
      ...defaultFeeForm(),
      receiptNo: getNextReceiptNo(fees),
    });
    setIsFeeModalOpen(true);
  };

  const handleOpenEditFeeModal = (receipt: FeeReceipt) => {
    setEditingFeeId(receipt.id);
    setFeeFormData({
      receiptNo: receipt.receiptNo,
      studentName: receipt.studentName,
      courseName: receipt.courseName,
      amount: String(receipt.amount),
      paymentMode: receipt.paymentMode,
      periodFrom: receipt.periodFrom,
      periodTo: receipt.periodTo,
      date: receipt.date,
      comment: receipt.comment,
    });
    setIsFeeModalOpen(true);
  };

  const handleSaveFee = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(feeFormData.amount) || 0;
    const finalReceiptNo = feeFormData.receiptNo.trim() || getNextReceiptNo(fees);
    if (editingFeeId) {
      const saved = await FeeService.update(editingFeeId, { ...feeFormData, receiptNo: finalReceiptNo, amount: amt });
      if (!saved) return window.alert('Could not save this receipt to MongoDB. Please check the connection and try again.');
      setFees((current) => FeeService.cache(current.map((receipt) => receipt.id === editingFeeId ? saved : receipt)));
    } else {
      const newReceipt: FeeReceipt = {
        id: `fee-${Date.now()}`,
        receiptNo: finalReceiptNo,
        studentName: feeFormData.studentName,
        courseName: feeFormData.courseName,
        amount: amt,
        paymentMode: feeFormData.paymentMode,
        periodFrom: feeFormData.periodFrom,
        periodTo: feeFormData.periodTo,
        date: feeFormData.date,
        comment: feeFormData.comment,
      };
      const saved = await FeeService.save(newReceipt);
      if (!saved) return window.alert('Could not create this receipt in MongoDB. Please check the connection and try again.');
      setFees((current) => FeeService.cache([saved, ...current]));
    }
    setIsFeeModalOpen(false);
  };

  const handleDeleteFee = async (id: string, receiptNo: string) => {
    if (window.confirm(`Delete Receipt #${receiptNo}? This cannot be undone.`)) {
      if (!await FeeService.delete(id)) return window.alert('Could not delete this receipt from MongoDB. Please try again.');
      setFees((current) => FeeService.cache(current.filter((receipt) => receipt.id !== id)));
    }
  };

  const handlePrintReceipt = (receipt: FeeReceipt) => {
    const printWindow = window.open('', '_blank', 'width=800,height=1050');
    if (!printWindow) return;
    const amountInWords = numberToWords(receipt.amount) + ' Rupees Only';
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      const [y, m, d] = dateStr.split('-');
      return `${d}-${m}-${y}`;
    };
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Receipt #${escapeHtml(receipt.receiptNo)} – ${escapeHtml(receipt.studentName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    @page { size: A5; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; margin: 0; padding: 24px 28px; background: #fff; color: #1e293b; font-size: 13px; }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1e293b; padding-bottom: 16px; }
    .logo { width: 64px; margin: 0 auto 6px; display: block; }
    .brand-name { font-size: 22px; font-weight: 800; letter-spacing: 0.12em; color: #0f172a; }
    .address { font-size: 10.5px; color: #475569; line-height: 1.55; margin-top: 4px; }
    .receipt-meta { display: flex; justify-content: space-between; margin: 18px 0 14px; font-size: 12.5px; }
    .meta-item { display: flex; gap: 6px; align-items: baseline; }
    .meta-label { color: #64748b; }
    .meta-value { font-weight: 700; font-size: 14px; border-bottom: 1.5px solid #64748b; min-width: 90px; padding-bottom: 1px; }
    .dotted-line { border: none; border-bottom: 1px dotted #94a3b8; margin: 12px 0; }
    .field-row { margin: 13px 0; font-size: 12.5px; line-height: 2; }
    .field-row span.label { color: #475569; }
    .field-row span.value { font-weight: 600; border-bottom: 1.5px solid #94a3b8; padding-bottom: 1px; padding-left: 6px; display: inline-block; min-width: 220px; }
    .words-value { font-style: italic; font-weight: 500; border-bottom: 1.5px solid #94a3b8; display: inline; padding-bottom: 1px; }
    .period-row { margin: 13px 0; font-size: 12.5px; }
    .comment-section { margin: 14px 0; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; line-height: 1.5; }
    .comment-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 4px; }
    .sig-footer { margin-top: 18px; display: flex; justify-content: flex-end; text-align: center; position: relative; }
    .sig-box { font-size: 11px; color: #475569; position: relative; display: inline-block; padding: 0 10px; }
    .sig-img { display: block; max-width: 145px; height: 46px; margin: 0 auto -14px; object-fit: contain; position: relative; z-index: 2; }
    .sig-line { width: 140px; border-bottom: 1.5px solid #1e293b; margin: 0 auto 6px; position: relative; z-index: 1; }
  </style>
</head>
<body>
  <div class="header">
    <img src="${window.location.origin}/favicon-192x192.png" class="logo" alt="SoundAbode Logo" />
    <div class="brand-name">SOUNDABODE</div>
    <div class="address">
      218, VISION 9 MALL, KUNAL ICON ROAD, PIMPLE SAUDAGAR, PUNE – 411027<br/>
      PH: 997-501-6189
    </div>
  </div>

  <div class="receipt-meta">
    <div class="meta-item">
      <span class="meta-label">Receipt No.</span>
      <span class="meta-value">${escapeHtml(receipt.receiptNo)}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Date:</span>
      <span class="meta-value">${escapeHtml(formatDate(receipt.date))}</span>
    </div>
  </div>

  <hr class="dotted-line" />

  <div class="field-row">
    Received a sum of ₹&nbsp;<span class="value">${escapeHtml(receipt.amount.toLocaleString('en-IN'))}</span>&nbsp; in words &nbsp;<span class="words-value">${escapeHtml(amountInWords)}</span>
  </div>

  <div class="field-row">
    <span class="label">by </span><span class="value">${escapeHtml(receipt.paymentMode)}</span>
  </div>

  <div class="field-row">
    <span class="label">Drawn for Course </span><span class="value">${escapeHtml(receipt.courseName)}</span>
  </div>

  <div class="field-row">
    <span class="label">From Mr/Ms </span><span class="value">${escapeHtml(receipt.studentName)}</span>
  </div>

  <div class="period-row">
    <span class="label">For the month/Period of</span><br/>
    <span class="value" style="min-width:100px;">From ${escapeHtml(formatDate(receipt.periodFrom))}</span>
    &nbsp;&nbsp;to&nbsp;&nbsp;
    <span class="value" style="min-width:100px;">${escapeHtml(formatDate(receipt.periodTo))}</span>
  </div>

  ${receipt.comment ? `
  <div class="comment-section">
    <div class="comment-label">Comment / Note</div>
    ${escapeHtml(receipt.comment)}
  </div>` : ''}

  <div class="sig-footer">
    <div class="sig-box">
      <img src="${window.location.origin}/signature.png" class="sig-img" alt="Authorised Signature" />
      <div class="sig-line"></div>
      Director<br/>Authorised Signatory
    </div>
  </div>

  <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 600); };</script>
</body>
</html>`;
    printWindow.document.open();
    printWindow.document.write(sanitizePrintHtml(html));
    printWindow.document.close();
  };

  // BACKUP HANDLERS
  const handleExportBackup = () => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      version: '2.0',
      blogPosts: BlogService.getAllPosts(),
      inquiries: InquiryService.getAllInquiries(),
      admissions: admissions,
      feeReceipts: fees,
      students: AttendanceService.getAllStudents(),
      attendanceRecords: AttendanceService.getAllAttendanceRecords(),
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soundabode_cms_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;
        const data = JSON.parse(text);

        let restoredCount = 0;
        if (Array.isArray(data.attendanceRecords)) {
          for (const rec of data.attendanceRecords) {
            if (rec && rec.id && rec.studentId && rec.date) {
              await fetch(`${getApiBaseUrl()}/attendance`, {
                method: 'POST',
                headers: AuthService.getAuthHeaders(),
                body: JSON.stringify(rec),
              }).catch(() => {});
              restoredCount++;
            }
          }
        }

        if (Array.isArray(data.students)) {
          for (const st of data.students) {
            if (st && st.id && st.name) {
              await fetch(`${getApiBaseUrl()}/students`, {
                method: 'POST',
                headers: AuthService.getAuthHeaders(),
                body: JSON.stringify(st),
              }).catch(() => {});
            }
          }
        }

        await AttendanceService.fetchAndSyncFromRemote();
        refreshData();
        setSettingsSuccessMsg(`Successfully restored ${restoredCount} attendance record(s) and database snapshot!`);
        setTimeout(() => setSettingsSuccessMsg(''), 5000);
      } catch (err: any) {
        alert('Failed to parse backup JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const [serverBackups, setServerBackups] = useState<{ filename: string; sizeBytes: number; createdAt: string }[]>([]);
  const [isLoadingServerBackups, setIsLoadingServerBackups] = useState(false);

  const fetchServerBackups = async () => {
    setIsLoadingServerBackups(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/backups`, {
        headers: AuthService.getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setServerBackups(data);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoadingServerBackups(false);
    }
  };

  const handleGenerateServerBackup = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/backups/generate`, {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
      });
      if (res.ok) {
        setSettingsSuccessMsg('Server database backup snapshot created successfully!');
        fetchServerBackups();
        setTimeout(() => setSettingsSuccessMsg(''), 4000);
      } else {
        alert('Failed creating server backup.');
      }
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  };

  const handleRestoreServerBackup = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to restore the database from server backup:\n"${filename}"?\n\nThis will safely update all records in MongoDB.`)) return;

    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/backups/restore/${encodeURIComponent(filename)}`, {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
      });
      if (res.ok) {
        const result = await res.json();
        await AttendanceService.fetchAndSyncFromRemote();
        refreshData();
        setSettingsSuccessMsg(`Restored ${result.restoredAttendance || 0} attendance records and ${result.restoredStudents || 0} students from ${filename}!`);
        setTimeout(() => setSettingsSuccessMsg(''), 5000);
      } else {
        alert('Failed to restore server backup.');
      }
    } catch (err: any) {
      alert('Restore error: ' + err.message);
    }
  };

  const handleDownloadServerBackup = (filename: string) => {
    const url = `${getApiBaseUrl()}/admin/backups/download/${encodeURIComponent(filename)}`;
    window.open(url, '_blank');
  };

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchServerBackups();
    }
  }, [activeTab]);

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPasscode.trim()) return;

    const result = await AuthService.changePasscode(newPasscode.trim());
    if (result.success) {
      setSettingsSuccessMsg('Admin Passcode updated successfully.');
      setNewPasscode('');
    } else {
      setSettingsSuccessMsg(result.error || 'Failed to update admin passcode.');
    }
    setTimeout(() => setSettingsSuccessMsg(''), 4000);
  };

  // Filtered lists
  const filteredPosts = posts.filter((p) => {
    const matchesCat = blogCategoryFilter === 'ALL' || p.category === blogCategoryFilter;
    const matchesSearch =
      !blogSearch ||
      p.title.toLowerCase().includes(blogSearch.toLowerCase()) ||
      p.excerpt.toLowerCase().includes(blogSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getSourceBadgeDetails = (inquiry: ContactInquiry) => {
    const source = inquiry.attribution?.source || (inquiry.source && !['Contact Form', 'Pop-up Quick Enquiry Form'].includes(inquiry.source) ? inquiry.source : 'Direct');
    const sourceLower = source.toLowerCase();

    if (source === 'Meta Ads' || sourceLower.includes('meta') || sourceLower.includes('facebook') || sourceLower.includes('instagram')) {
      return { label: 'Meta Ads', className: styles.badgeSourceMeta };
    }
    if (source === 'Google Ads' || sourceLower.includes('google')) {
      return { label: 'Google Ads', className: styles.badgeSourceGoogle };
    }
    if (source === 'Organic/Referral' || sourceLower.includes('organic') || sourceLower.includes('referral')) {
      return { label: 'Organic/Referral', className: styles.badgeSourceOrganic };
    }
    if (source.startsWith('Campaign:') || sourceLower.includes('campaign')) {
      return { label: source, className: styles.badgeSourceCampaign };
    }
    return { label: source || 'Direct', className: styles.badgeSourceDirect };
  };

  // Filters shared by the pipeline and list views (stage is a column in the pipeline,
  // so the status filter only applies to the list view)
  const leadsMatchingFilters = inquiries.filter((inq) => {
    const query = leadSearch.trim().toLowerCase();
    if (query) {
      const haystack = `${inq.name} ${inq.email} ${inq.phone} ${inq.courseInterest}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (leadAssigneeFilter === 'UNASSIGNED' && inq.assignedTo) return false;
    if (leadAssigneeFilter !== 'ALL' && leadAssigneeFilter !== 'UNASSIGNED' && inq.assignedTo !== leadAssigneeFilter) return false;
    if (leadArchiveReasonFilter !== 'ALL' && inq.status === 'ARCHIVED' && inq.archiveReason !== leadArchiveReasonFilter) return false;

    const resolvedSource = inq.attribution?.source || (inq.source && !['Contact Form', 'Pop-up Quick Enquiry Form'].includes(inq.source) ? inq.source : 'Direct');
    
    let matchesSource = true;
    if (inquirySourceFilter !== 'ALL') {
      if (inquirySourceFilter === 'Campaign') {
        matchesSource = resolvedSource.startsWith('Campaign:') || Boolean(inq.attribution?.utm_source);
      } else {
        matchesSource = resolvedSource === inquirySourceFilter;
      }
    }
    return matchesSource;
  });

  const filteredInquiries = leadView === 'list'
    ? leadsMatchingFilters.filter((inq) => inquiryStatusFilter === 'ALL' || inq.status === inquiryStatusFilter)
    : leadsMatchingFilters;

  const unassignedLeadCount = inquiries.filter((i) => !i.assignedTo && i.status !== 'ARCHIVED').length;
  const hasActiveLeadFilters =
    Boolean(leadSearch.trim()) || inquirySourceFilter !== 'ALL' || leadAssigneeFilter !== 'ALL' ||
    leadArchiveReasonFilter !== 'ALL' || (leadView === 'list' && inquiryStatusFilter !== 'ALL');
  const clearLeadFilters = () => {
    setLeadSearch('');
    setInquirySourceFilter('ALL');
    setLeadAssigneeFilter('ALL');
    setLeadArchiveReasonFilter('ALL');
    setInquiryStatusFilter('ALL');
  };

  const renderStageSelect = (inq: ContactInquiry) => (
    <div className={styles.stageDropdownWrapper} data-stage={inq.status} title="Move lead to another stage">
      <span className={styles.stageDot} />
      <select
        id={`pipeline-stage-select-${inq.id}`}
        value={inq.status}
        onChange={(e) => requestStageChange([inq.id], e.target.value as LeadStatus)}
        className={styles.stageSelect}
        aria-label={`Stage for ${inq.name}`}
      >
        {LEAD_STAGES.map((st) => (
          <option key={st} value={st} className={styles.stageOption}>{LEAD_STAGE_LABELS[st]}</option>
        ))}
      </select>
      <svg className={styles.stageChevron} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
    </div>
  );

  // Admins get an inline "assign" menu; teachers only see who owns the lead
  const renderAssignee = (inq: ContactInquiry, compact = false) => {
    if (isTeacher) return null;
    return (
      <label className={`${styles.assigneeRow} ${compact ? styles.assigneeRowCompact : ''}`} data-unassigned={!inq.assignedTo || undefined}>
        {!compact && <span className={styles.assigneeLabel}>Owner</span>}
        <span className={styles.assigneeSelectWrap}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          <select
            value={inq.assignedTo || ''}
            onChange={(e) => handleAssignLeads([inq.id], e.target.value)}
            className={styles.assigneeSelect}
            aria-label={`Assign ${inq.name}`}
          >
            <option value="">Unassigned</option>
            {team.map((m) => (
              <option key={m.email} value={m.email}>{m.name}{m.role === 'admin' ? ' (admin)' : ''}</option>
            ))}
            {inq.assignedTo && !team.some((m) => m.email === inq.assignedTo) && (
              <option value={inq.assignedTo}>{inq.assignedToName || inq.assignedTo}</option>
            )}
          </select>
        </span>
      </label>
    );
  };

  const renderArchiveReason = (inq: ContactInquiry) => (
    <div className={styles.archiveReasonRow}>
      <span className={styles.assigneeLabel}>Reason</span>
      <span className={styles.assigneeSelectWrap} data-missing={!inq.archiveReason || undefined}>
        <select
          value={inq.archiveReason || ''}
          onChange={(e) => e.target.value && handleArchiveReasonChange(inq, e.target.value)}
          className={styles.assigneeSelect}
          aria-label={`Archive reason for ${inq.name}`}
        >
          {!inq.archiveReason && <option value="">Choose a reason…</option>}
          {ARCHIVE_REASONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </span>
      {inq.archiveNote && <span className={styles.archiveNote} title={inq.archiveNote}>“{inq.archiveNote}”</span>}
    </div>
  );

  const openLeadNotes = (id: string) => {
    setNotesLeadId(id);
    setNoteDraft('');
    setNoteError(null);
  };

  const handleSaveNote = async (leadId: string) => {
    const text = noteDraft.trim();
    if (!text || noteSaving) return;
    setNoteSaving(true);
    setNoteError(null);
    const result = await InquiryService.addLeadComment(leadId, text);
    setNoteSaving(false);
    if (!result.ok) return setNoteError(result.error || 'The note was not saved.');
    setNoteDraft('');
    refreshData();
  };

  const handleDeleteNote = async (leadId: string, note: LeadComment) => {
    if (!window.confirm('Remove this note?')) return;
    const result = await InquiryService.deleteLeadComment(leadId, note.id);
    if (!result.ok) return setNoteError(result.error || 'The note was not removed.');
    refreshData();
  };

  const formatNoteTime = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  // Newest first. A note can be removed by its author or an admin.
  const renderLeadNotes = (lead: ContactInquiry) => {
    const notes = [...(lead.comments || [])].reverse();
    const myEmail = (currentUser?.email || '').toLowerCase();
    return (
      <div className={styles.leadNotes}>
        <form
          className={styles.leadNoteForm}
          onSubmit={(e) => { e.preventDefault(); handleSaveNote(lead.id); }}
        >
          <textarea
            className={styles.formTextarea}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            maxLength={1000}
            placeholder="What did the lead say? e.g. Interested in the weekend batch, will visit Saturday."
            aria-label={`Note for ${lead.name}`}
          />
          {noteError && <div className={styles.leadNoteError} role="alert">{noteError}</div>}
          <div className={styles.leadNoteFormRow}>
            <span className={styles.leadNoteHint}>{noteDraft.length}/1000</span>
            <button type="submit" className={styles.btnPrimary} disabled={!noteDraft.trim() || noteSaving}>
              {noteSaving ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </form>

        {notes.length === 0 ? (
          <p className={styles.leadNoteEmpty}>No notes yet. Add what the lead said after each call.</p>
        ) : (
          <ul className={styles.leadNoteList}>
            {notes.map((n) => (
              <li key={n.id} className={styles.leadNoteItem}>
                <p className={styles.leadNoteText}>{n.text}</p>
                <div className={styles.leadNoteMeta}>
                  <span>{n.authorName || n.authorEmail} · {formatNoteTime(n.createdAt)}</span>
                  {(!isTeacher || (n.authorEmail || '').toLowerCase() === myEmail) && (
                    <button type="button" className={styles.linkBtn} onClick={() => handleDeleteNote(lead.id, n)}>
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const filteredAdmissions = admissions.filter((adm) => {
    const matchesType = admissionTypeFilter === 'ALL' || adm.formType === admissionTypeFilter;
    const matchesStatus = admissionStatusFilter === 'ALL' || adm.status === admissionStatusFilter;
    const searchLower = admissionSearch.toLowerCase();
    const matchesSearch =
      !admissionSearch ||
      adm.firstName.toLowerCase().includes(searchLower) ||
      adm.lastName.toLowerCase().includes(searchLower) ||
      adm.email.toLowerCase().includes(searchLower) ||
      adm.formNo.toLowerCase().includes(searchLower) ||
      adm.courseOpted.toLowerCase().includes(searchLower) ||
      adm.cellPhone.includes(searchLower);

    return matchesType && matchesStatus && matchesSearch;
  });

  const filteredStudents = useMemo(() => {
    return sortStudentsById(
      students.filter((std) => {
        const studentCourses = getStudentCourses(std);
        const matchesSearch =
          !studentSearch ||
          std.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
          std.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
          std.phone.includes(studentSearch) ||
          std.course.toLowerCase().includes(studentSearch.toLowerCase()) ||
          studentCourses.some((c) => c.toLowerCase().includes(studentSearch.toLowerCase())) ||
          std.id.toLowerCase().includes(studentSearch.toLowerCase());
        const matchesCourse =
          studentCourseFilter === 'ALL' ||
          studentCourses.some((c) => c.toLowerCase().includes(studentCourseFilter.toLowerCase())) ||
          std.course.toLowerCase().includes(studentCourseFilter.toLowerCase());
        return matchesSearch && matchesCourse;
      })
    );
  }, [students, studentSearch, studentCourseFilter]);

  // Students tab rows: one per course for multi-course students. With a course filter
  // set, only the matching course rows are shown.
  const filteredStudentEntries = useMemo(() => {
    const filter = studentCourseFilter.toLowerCase();
    return filteredStudents
      .flatMap((s) => getStudentEntries(s))
      .filter((e) => e.kind !== 'course' || studentCourseFilter === 'ALL' || e.course.toLowerCase().includes(filter));
  }, [filteredStudents, studentCourseFilter]);

  const newInquiryCount = inquiries.filter((i) => i.status === 'NEW').length;
  const metaLeadsCount = useMemo(() => {
    return inquiries.filter((inq) => {
      const isMeta =
        inq.source === 'Meta Lead Ad' ||
        inq.source === 'Meta Ads' ||
        Boolean(inq.metaLeadId) ||
        inq.attribution?.source === 'Meta Ads';
      return isMeta;
    }).length;
  }, [inquiries]);
  const newMetaLeadsCount = useMemo(() => {
    return inquiries.filter((inq) => {
      const isMeta =
        inq.source === 'Meta Lead Ad' ||
        inq.source === 'Meta Ads' ||
        Boolean(inq.metaLeadId) ||
        inq.attribution?.source === 'Meta Ads';
      return isMeta && inq.status === 'NEW';
    }).length;
  }, [inquiries]);
  const enrolledCount = inquiries.filter((i) => i.status === 'ENROLLED').length;
  const newAdmissionsCount = useMemo(() => admissions.filter((a) => a.status === 'NEW').length, [admissions]);
  const djStudentsCount = useMemo(() => students.filter((s) => getStudentCourses(s).some((c) => c.toLowerCase().includes('dj'))).length, [students]);
  const empStudentsCount = useMemo(() => students.filter((s) => getStudentCourses(s).some((c) => !c.toLowerCase().includes('dj'))).length, [students]);

  // Real Dynamic Course Distribution
  const dynamicCourseStats = useMemo(() => {
    let djCount = 0;
    let empCount = 0;
    let audioCount = 0;

    students.forEach((s) => {
      const courses = getStudentCourses(s);
      const lowerList = courses.map((c) => c.toLowerCase());
      const hasDj = lowerList.some((c) => c.includes('dj'));
      const hasAudio = lowerList.some((c) => c.includes('audio') || c.includes('sound'));
      const hasEmp = lowerList.some((c) => c.includes('emp') || c.includes('production') || c.includes('electronic')) || (!hasDj && !hasAudio);

      if (hasDj) djCount++;
      if (hasAudio) audioCount++;
      if (hasEmp) empCount++;
    });

    const total = (djCount + empCount + audioCount) || students.length || 1;
    return [
      { name: 'DJ Performance & Pioneer Decks', count: djCount, percentage: Math.round((djCount / total) * 100) || 0, color: 'var(--text-primary)', trackBg: 'rgba(255, 255, 255, 0.08)' },
      { name: 'Electronic Music Production (Ableton Live)', count: empCount, percentage: Math.round((empCount / total) * 100) || 0, color: 'var(--text-secondary)', trackBg: 'rgba(255, 255, 255, 0.08)' },
      { name: 'Audio Engineering & Sound Design', count: audioCount, percentage: Math.round((audioCount / total) * 100) || 0, color: 'var(--text-muted)', trackBg: 'rgba(255, 255, 255, 0.08)' },
    ];
  }, [students]);

  // Real Dynamic 6-Month Intake & Velocity Trend
  const intakeMonthlyTrend = useMemo(() => {
    const now = new Date();
    const list: { label: string; yearMonth: string; inqCount: number; admCount: number; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'short' });
      list.push({ label, yearMonth: ym, inqCount: 0, admCount: 0, total: 0 });
    }

    inquiries.forEach((inq) => {
      const ym = (inq.submittedAt || '').slice(0, 7);
      const target = list.find((m) => m.yearMonth === ym);
      if (target) {
        target.inqCount++;
        target.total++;
      }
    });

    admissions.forEach((adm) => {
      const ym = (adm.submittedAt || '').slice(0, 7);
      const target = list.find((m) => m.yearMonth === ym);
      if (target) {
        target.admCount++;
        target.total++;
      }
    });

    const maxVal = Math.max(...list.map((m) => m.total), 4);
    const totalVolume = list.reduce((acc, m) => acc + m.total, 0);
    return { list, maxVal, totalVolume };
  }, [inquiries, admissions]);

  // Active Selected Student details & records for Attendance
  // For a course entry this is a display copy scoped to that one course
  const activeEntry = selectedStudentId ? AttendanceService.getEntry(selectedStudentId) : undefined;
  const activeStudent = activeEntry?.student;
  // New attendance needs a known course: true for course entries and single-course students,
  // false for the "earlier sessions" row or a multi-course student opened as a whole
  const canMarkActiveEntry = !!activeEntry && (
    activeEntry.kind === 'course' || (activeEntry.kind === 'single' && getStudentCourses(activeEntry.student).length <= 1)
  );
  const activeAttendanceRecords = (selectedStudentId && attendanceVersion >= 0)
    ? AttendanceService.getAttendanceForStudent(selectedStudentId, currentUser || undefined)
    : [];

  const getOrFallbackStudent = (studentId: string, record?: AttendanceRecord): EnrolledStudent => {
    const canonicalId = canonicalizeStudentId(studentId);
    const existing = students.find((s) => s.id === canonicalId || s.id === studentId);
    if (existing) {
      const courses = getStudentCourses(existing);
      const course = record && courses.length > 1 ? matchRecordCourse(record, courses) : null;
      return course ? { ...existing, course, courses: [course] } : existing;
    }
    return {
      id: canonicalId || studentId,
      name: (record as any)?.studentName || `Student (${studentId})`,
      email: (record as any)?.studentEmail || '',
      phone: (record as any)?.studentPhone || '',
      course: (record as any)?.course || 'Music Production',
      batch: (record as any)?.batch || 'Regular Batch',
      enrolledDate: record?.date || '2026-09-01',
    };
  };

  const allAttendanceRecords = useMemo(() => {
    if (attendanceVersion < 0) return [];
    const all = AttendanceService.getAllAttendanceRecords(currentUser || undefined);
    if (isTeacher && currentUser) {
      const uEmail = (currentUser.email || '').toLowerCase();
      const uName = (currentUser.name || '').toLowerCase();
      return all.filter((r) => {
        const mBy = (r.markedBy || '').toLowerCase();
        const mName = (r.markedByName || '').toLowerCase();
        if (mBy && mBy === uEmail) return true;
        if (mName && mName === uName) return true;
        if (uEmail && mBy.includes(uEmail)) return true;
        if (uName && (mName.includes(uName) || mBy.includes(uName))) return true;
        return false;
      });
    }
    return all;
  }, [attendanceVersion, isTeacher, currentUser]);

  // Roster rows: one per course for multi-course students, plus an "earlier sessions" row
  // when some of their records name none of their current courses
  const attendanceEntries = useMemo(
    () => students.flatMap((s) => getStudentEntries(s, allAttendanceRecords)),
    [students, allAttendanceRecords]
  );
  // Entries attendance can be marked against (the "earlier sessions" row is view/edit only)
  const markableEntries = useMemo(() => attendanceEntries.filter((e) => e.kind !== 'unmatched'), [attendanceEntries]);
  // Search across name, email, phone, course and batch
  const entryMatches = (e: StudentEntry, query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [e.student.name, e.student.email, e.student.phone, e.course, e.batch, ...getStudentCourses(e.student)]
      .some((v) => (v || '').toLowerCase().includes(q));
  };
  const visibleAttendanceEntries = useMemo(
    () => attendanceEntries.filter((e) => entryMatches(e, attendanceSearch)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attendanceEntries, attendanceSearch]
  );
  const entryLabel = (e: StudentEntry) => (e.kind === 'single' ? e.student.name : `${e.student.name} · ${e.course}`);

  // Group picker: one checkbox per course entry. An "earlier sessions" entry only appears
  // when editing a session that already includes it, so it can still be unticked.
  const filteredGroupEntries = attendanceEntries.filter((e) => {
    if (e.kind === 'unmatched' && !selectedGroupStudentIds.includes(e.key)) return false;
    if (!groupStudentSearchQuery.trim()) return true;
    const q = groupStudentSearchQuery.toLowerCase();
    return e.student.name.toLowerCase().includes(q) || e.course.toLowerCase().includes(q) || e.batch.toLowerCase().includes(q);
  });

  const getGroupSessionDetails = (dateStr: string, slotStr?: string) => {
    const matchingRecords = allAttendanceRecords.filter((r) => {
      if (r.date !== dateStr) return false;
      if (slotStr && r.timeSlot !== slotStr) return false;
      return r.status === 'GROUP_SESSION';
    });

    const studentIds = Array.from(new Set(matchingRecords.map((r) => r.studentId)));
    const attendingStudents = studentIds.map((id) => {
      const rec = matchingRecords.find((r) => r.studentId === id);
      return getOrFallbackStudent(id, rec);
    });

    return {
      records: matchingRecords,
      count: attendingStudents.length,
      students: attendingStudents,
    };
  };

  const groupSessionsList = useMemo(() => {
    const groupRecords = allAttendanceRecords.filter((r) => r.status === 'GROUP_SESSION');
    const sessionMap = new Map<string, {
      id: string;
      date: string;
      timeSlot: string;
      markedBy: string;
      markedByName: string;
      comment: string;
      updatedAt: string;
      studentIds: string[];
      students: EnrolledStudent[];
    }>();

    groupRecords.forEach((r) => {
      const key = `${r.date}___${r.timeSlot}`;
      const student = getOrFallbackStudent(r.studentId, r);
      if (!sessionMap.has(key)) {
        sessionMap.set(key, {
          id: key,
          date: r.date,
          timeSlot: r.timeSlot,
          markedBy: r.markedBy,
          markedByName: r.markedByName,
          comment: r.comment,
          updatedAt: r.updatedAt,
          studentIds: [r.studentId],
          students: [student],
        });
      } else {
        const existing = sessionMap.get(key)!;
        if (!existing.studentIds.includes(r.studentId)) {
          existing.studentIds.push(r.studentId);
          existing.students.push(student);
        }
        if (!existing.comment && r.comment) {
          existing.comment = r.comment;
        }
      }
    });

    return Array.from(sessionMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [allAttendanceRecords, students]);

  const filteredGroupSessionsList = useMemo(() => {
    if (!groupTabSearchQuery.trim()) return groupSessionsList;
    const q = groupTabSearchQuery.toLowerCase();
    return groupSessionsList.filter((gs: (typeof groupSessionsList)[0]) => {
      const dateMatch = gs.date.includes(q);
      const slotMatch = gs.timeSlot.toLowerCase().includes(q);
      const commentMatch = gs.comment.toLowerCase().includes(q);
      const studentMatch = gs.students.some(
        (s: EnrolledStudent) => s.name.toLowerCase().includes(q) || s.course.toLowerCase().includes(q) || s.batch.toLowerCase().includes(q)
      );
      return dateMatch || slotMatch || commentMatch || studentMatch;
    });
  }, [groupSessionsList, groupTabSearchQuery]);

  const totalGroupAttendeesCount = useMemo(() => {
    return groupSessionsList.reduce((acc: number, s: (typeof groupSessionsList)[0]) => acc + s.studentIds.length, 0);
  }, [groupSessionsList]);

  const avgGroupAttendeesCount = useMemo(() => {
    return groupSessionsList.length > 0
      ? (totalGroupAttendeesCount / groupSessionsList.length).toFixed(1)
      : '0';
  }, [groupSessionsList, totalGroupAttendeesCount]);

  const latestGroupSessionFormatted = useMemo(() => {
    if (groupSessionsList.length === 0) return 'N/A';
    const latestDate = groupSessionsList[0].date;
    try {
      const d = new Date(latestDate + 'T00:00:00');
      if (isNaN(d.getTime())) return latestDate;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return latestDate;
    }
  }, [groupSessionsList]);

  const formatGroupDateBadge = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      if (isNaN(d.getTime())) return { formatted: dateStr, day: 'Session' };
      const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const day = d.toLocaleDateString('en-US', { weekday: 'short' });
      return { formatted, day };
    } catch {
      return { formatted: dateStr, day: 'Session' };
    }
  };

  const handleDeleteGroupSession = async (dateStr: string, timeSlotStr: string) => {
    if (window.confirm(`Are you sure you want to delete the group session on ${dateStr} (${timeSlotStr})?`)) {
      const targetRecords = allAttendanceRecords.filter(
        (r) => r.date === dateStr && r.timeSlot === timeSlotStr && r.status === 'GROUP_SESSION'
      );
      for (const rec of targetRecords) {
        await AttendanceService.deleteAttendanceRecord(rec.id);
      }
      refreshData();
    }
  };

  const handleEditGroupSession = (session: { date: string; timeSlot: string; studentIds: string[]; comment?: string }) => {
    setEditingGroupSessionKey({ date: session.date, timeSlot: session.timeSlot });
    setGroupSessionDate(session.date);
    const parsedTime = parseTimeSlotToInputs(session.timeSlot);
    setGroupCustomTimeStart(parsedTime.start);
    setGroupCustomTimeEnd(parsedTime.end);
    const sessionRecords = allAttendanceRecords.filter(
      (r) => r.date === session.date && r.timeSlot === session.timeSlot && r.status === 'GROUP_SESSION'
    );
    setSelectedGroupStudentIds(Array.from(new Set(sessionRecords.map(keyForRecord))));
    setGroupSessionStatus('GROUP_SESSION');
    setGroupSessionComment(session.comment || '');
    setIsGroupAttendanceModalOpen(true);
  };

  // ─── CLASSES SECTION COMPUTATIONS & HANDLERS (ADMIN ONLY) ───────────────────
  const isDateInPreset = (dateStr: string, preset: typeof classesDatePreset, customDate: string) => {
    if (preset === 'ALL') return true;
    if (preset === 'CUSTOM') return !customDate || dateStr === customDate;

    const now = new Date();
    const todayStr = formatLocalDateStr(now.getFullYear(), now.getMonth(), now.getDate());

    if (preset === 'TODAY') {
      return dateStr === todayStr;
    }

    if (preset === 'YESTERDAY') {
      const yDate = new Date(now);
      yDate.setDate(yDate.getDate() - 1);
      const yesterdayStr = formatLocalDateStr(yDate.getFullYear(), yDate.getMonth(), yDate.getDate());
      return dateStr === yesterdayStr;
    }

    if (preset === 'THIS_WEEK') {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      const startOfWeekStr = formatLocalDateStr(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate());
      return dateStr >= startOfWeekStr && dateStr <= todayStr;
    }

    if (preset === 'THIS_MONTH') {
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return dateStr.startsWith(currentYearMonth);
    }

    return true;
  };

  const hasActiveClassesFilter = useMemo(() => {
    return (
      classesTeacherFilter !== 'ALL' ||
      classesStatusFilter !== 'ALL' ||
      classesDatePreset !== 'ALL' ||
      classesCourseFilter !== 'ALL' ||
      Boolean(classesSearch.trim())
    );
  }, [classesTeacherFilter, classesStatusFilter, classesDatePreset, classesCourseFilter, classesSearch]);

  // Records filtered by Date, Status, Course, and Search (cross-teacher context)
  const contextFilteredRecords = useMemo(() => {
    return allAttendanceRecords.filter((r) => {
      if (classesStatusFilter !== 'ALL' && r.status !== classesStatusFilter) {
        return false;
      }
      if (!isDateInPreset(r.date, classesDatePreset, classesCustomDate)) {
        return false;
      }
      if (classesCourseFilter !== 'ALL') {
        const st = getOrFallbackStudent(r.studentId, r);
        if (!getStudentCourses(st).includes(classesCourseFilter)) return false;
      }
      if (classesSearch.trim()) {
        const q = classesSearch.toLowerCase().trim();
        const st = getOrFallbackStudent(r.studentId, r);
        const matchesStudent =
          st.name.toLowerCase().includes(q) ||
          (st.email || '').toLowerCase().includes(q) ||
          (st.phone || '').toLowerCase().includes(q);
        const matchesTeacher =
          (r.markedByName || '').toLowerCase().includes(q) ||
          (r.markedBy || '').toLowerCase().includes(q);
        const matchesSlot = (r.timeSlot || '').toLowerCase().includes(q);
        const matchesDate = (r.date || '').toLowerCase().includes(q);
        const matchesComment = (r.comment || '').toLowerCase().includes(q);
        if (!matchesStudent && !matchesTeacher && !matchesSlot && !matchesDate && !matchesComment) {
          return false;
        }
      }
      return true;
    });
  }, [allAttendanceRecords, classesStatusFilter, classesDatePreset, classesCustomDate, classesCourseFilter, classesSearch, students]);

  const teacherAshuRecords = useMemo(() => {
    return allAttendanceRecords.filter((r) => {
      const by = (r.markedBy || '').toLowerCase();
      const name = (r.markedByName || '').toLowerCase();
      return by.includes('ashu') || name.includes('ashu');
    });
  }, [allAttendanceRecords]);

  const teacherVaibhavRecords = useMemo(() => {
    return allAttendanceRecords.filter((r) => {
      const by = (r.markedBy || '').toLowerCase();
      const name = (r.markedByName || '').toLowerCase();
      return by.includes('vaibhav') || name.includes('vaibhav');
    });
  }, [allAttendanceRecords]);

  const teacherVrishanRecords = useMemo(() => {
    return allAttendanceRecords.filter((r) => {
      const by = (r.markedBy || '').toLowerCase();
      const name = (r.markedByName || '').toLowerCase();
      return by.includes('vrishan') || name.includes('vrishan');
    });
  }, [allAttendanceRecords]);

  const teacherAbhinavRecords = useMemo(() => {
    return allAttendanceRecords.filter((r) => {
      const by = (r.markedBy || '').toLowerCase();
      const name = (r.markedByName || '').toLowerCase();
      const isAshu = by.includes('ashu') || name.includes('ashu');
      const isVaibhav = by.includes('vaibhav') || name.includes('vaibhav');
      const isVrishan = by.includes('vrishan') || name.includes('vrishan');
      return !isAshu && !isVaibhav && !isVrishan;
    });
  }, [allAttendanceRecords]);

  const filteredAshuRecords = useMemo(() => {
    return contextFilteredRecords.filter((r) => {
      const by = (r.markedBy || '').toLowerCase();
      const name = (r.markedByName || '').toLowerCase();
      return by.includes('ashu') || name.includes('ashu');
    });
  }, [contextFilteredRecords]);

  const filteredVaibhavRecords = useMemo(() => {
    return contextFilteredRecords.filter((r) => {
      const by = (r.markedBy || '').toLowerCase();
      const name = (r.markedByName || '').toLowerCase();
      return by.includes('vaibhav') || name.includes('vaibhav');
    });
  }, [contextFilteredRecords]);

  const filteredVrishanRecords = useMemo(() => {
    return contextFilteredRecords.filter((r) => {
      const by = (r.markedBy || '').toLowerCase();
      const name = (r.markedByName || '').toLowerCase();
      return by.includes('vrishan') || name.includes('vrishan');
    });
  }, [contextFilteredRecords]);

  const filteredAbhinavRecords = useMemo(() => {
    return contextFilteredRecords.filter((r) => {
      const by = (r.markedBy || '').toLowerCase();
      const name = (r.markedByName || '').toLowerCase();
      const isAshu = by.includes('ashu') || name.includes('ashu');
      const isVaibhav = by.includes('vaibhav') || name.includes('vaibhav');
      const isVrishan = by.includes('vrishan') || name.includes('vrishan');
      return !isAshu && !isVaibhav && !isVrishan;
    });
  }, [contextFilteredRecords]);


  // One option per course (a multi-course student contributes each of their courses)
  const distinctCourses = useMemo(() => {
    const courses = new Set<string>();
    students.forEach((s) => getStudentCourses(s).forEach((c) => courses.add(c)));
    return Array.from(courses);
  }, [students]);

  const allClassesLogEntries = useMemo<ClassLogEntry[]>(() => {
    const entries: ClassLogEntry[] = [];
    const groupMap = new Map<string, AttendanceRecord[]>();

    allAttendanceRecords.forEach((r) => {
      if (r.status === 'GROUP_SESSION') {
        const key = `${r.date}___${normalizeTimeSlot(r.timeSlot)}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, []);
        }
        groupMap.get(key)!.push(r);
      } else {
        const student = getOrFallbackStudent(r.studentId, r);
        entries.push({
          id: r.id,
          type: 'INDIVIDUAL',
          studentId: r.studentId,
          student,
          studentIds: [r.studentId],
          students: [student],
          date: r.date,
          timeSlot: r.timeSlot,
          markedBy: r.markedBy,
          markedByName: r.markedByName,
          markedByRole: r.markedByRole,
          status: r.status,
          comment: r.comment,
          updatedAt: r.updatedAt,
          records: [r],
        });
      }
    });

    groupMap.forEach((records, key) => {
      if (records.length === 0) return;
      const first = records[0];
      const studentIds = Array.from(new Set(records.map((r) => r.studentId)));
      const attendingStudents = studentIds.map((id) => {
        const rec = records.find((r) => r.studentId === id);
        return getOrFallbackStudent(id, rec);
      });

      const distinctComments = Array.from(new Set(records.map((r) => r.comment).filter(Boolean))).join('; ');
      const latestUpdate = records.reduce((latest, r) => {
        if (!r.updatedAt) return latest;
        if (!latest) return r.updatedAt;
        return new Date(r.updatedAt) > new Date(latest) ? r.updatedAt : latest;
      }, first.updatedAt || '');

      entries.push({
        id: `group_${key}`,
        type: 'GROUP',
        studentIds,
        students: attendingStudents,
        date: first.date,
        timeSlot: first.timeSlot,
        markedBy: first.markedBy,
        markedByName: first.markedByName,
        markedByRole: first.markedByRole,
        status: 'GROUP_SESSION',
        comment: distinctComments || first.comment || '',
        updatedAt: latestUpdate,
        records,
      });
    });

    return entries.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });
  }, [allAttendanceRecords, students]);

  const filteredClassesRecords = useMemo(() => {
    return allClassesLogEntries.filter((entry) => {
      // 1. Teacher Filter (Only relevant when admin is viewing; teachers are strictly scoped to their own classes)
      if (!isTeacher) {
        if (classesTeacherFilter === 'ashu') {
          const by = (entry.markedBy || '').toLowerCase();
          const name = (entry.markedByName || '').toLowerCase();
          if (!by.includes('ashu') && !name.includes('ashu')) return false;
        } else if (classesTeacherFilter === 'vaibhav') {
          const by = (entry.markedBy || '').toLowerCase();
          const name = (entry.markedByName || '').toLowerCase();
          if (!by.includes('vaibhav') && !name.includes('vaibhav')) return false;
        } else if (classesTeacherFilter === 'vrishan') {
          const by = (entry.markedBy || '').toLowerCase();
          const name = (entry.markedByName || '').toLowerCase();
          if (!by.includes('vrishan') && !name.includes('vrishan')) return false;
        } else if (classesTeacherFilter === 'abhinav' || classesTeacherFilter === 'admin') {
          const by = (entry.markedBy || '').toLowerCase();
          const name = (entry.markedByName || '').toLowerCase();
          if (by.includes('ashu') || name.includes('ashu') || by.includes('vaibhav') || name.includes('vaibhav') || by.includes('vrishan') || name.includes('vrishan')) return false;
        }
      }

      // 2. Status Filter
      if (classesStatusFilter !== 'ALL') {
        if (entry.status !== classesStatusFilter) return false;
      }

      // 3. Date Filter
      if (!isDateInPreset(entry.date, classesDatePreset, classesCustomDate)) {
        return false;
      }

      // 4. Course Filter
      if (classesCourseFilter !== 'ALL') {
        if (entry.type === 'INDIVIDUAL') {
          if (!entry.student || !getStudentCourses(entry.student).includes(classesCourseFilter)) return false;
        } else {
          if (!entry.students.some((s) => getStudentCourses(s).includes(classesCourseFilter))) return false;
        }
      }

      // 5. Search Query
      if (classesSearch.trim()) {
        const q = classesSearch.toLowerCase().trim();
        const matchesStudentName = entry.students.some((s) => s.name.toLowerCase().includes(q));
        const matchesStudentEmail = entry.students.some((s) => (s.email || '').toLowerCase().includes(q));
        const matchesStudentPhone = entry.students.some((s) => (s.phone || '').toLowerCase().includes(q));
        const matchesCourse = entry.students.some((s) => (s.course || '').toLowerCase().includes(q));
        const teacherName = (entry.markedByName || '').toLowerCase();
        const teacherEmail = (entry.markedBy || '').toLowerCase();
        const comment = (entry.comment || '').toLowerCase();
        const date = (entry.date || '').toLowerCase();
        const slot = (entry.timeSlot || '').toLowerCase();

        const matches =
          matchesStudentName ||
          matchesStudentEmail ||
          matchesStudentPhone ||
          matchesCourse ||
          teacherName.includes(q) ||
          teacherEmail.includes(q) ||
          comment.includes(q) ||
          date.includes(q) ||
          slot.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [
    allClassesLogEntries,
    classesTeacherFilter,
    classesStatusFilter,
    classesDatePreset,
    classesCustomDate,
    classesCourseFilter,
    classesSearch,
    isTeacher,
  ]);

  const ashuAnalytics = useMemo(() => {
    const isContextFiltered = classesDatePreset !== 'ALL' || classesStatusFilter !== 'ALL' || classesCourseFilter !== 'ALL' || Boolean(classesSearch.trim());
    const records = isContextFiltered ? filteredAshuRecords : teacherAshuRecords;
    const total = records.length;
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const practice = records.filter((r) => r.status === 'PRACTICE_SESSION').length;
    const groupRecords = records.filter((r) => r.status === 'GROUP_SESSION');
    const group = groupRecords.length;
    const groupSessionsCount = new Set(groupRecords.map((r) => `${r.date}_${r.timeSlot}`)).size;
    const uniqueStudentIds = Array.from(new Set(records.map((r) => r.studentId)));
    const uniqueStudents = uniqueStudentIds.map((id) => students.find((s) => s.id === id)).filter((s): s is EnrolledStudent => Boolean(s));
    const dates = Array.from(new Set(records.map((r) => r.date))).sort().reverse();
    const lastActiveDate = dates[0] || 'No sessions yet';
    const presentRate = total > 0 ? Math.round(((present + practice + group) / total) * 100) : 0;

    return {
      total,
      present,
      absent,
      practice,
      group,
      groupSessionsCount,
      uniqueStudentCount: uniqueStudentIds.length,
      uniqueStudents,
      lastActiveDate,
      presentRate,
      datesCount: dates.length,
    };
  }, [teacherAshuRecords, filteredAshuRecords, students, classesDatePreset, classesStatusFilter, classesCourseFilter, classesSearch]);

  const vaibhavAnalytics = useMemo(() => {
    const isContextFiltered = classesDatePreset !== 'ALL' || classesStatusFilter !== 'ALL' || classesCourseFilter !== 'ALL' || Boolean(classesSearch.trim());
    const records = isContextFiltered ? filteredVaibhavRecords : teacherVaibhavRecords;
    const total = records.length;
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const practice = records.filter((r) => r.status === 'PRACTICE_SESSION').length;
    const groupRecords = records.filter((r) => r.status === 'GROUP_SESSION');
    const group = groupRecords.length;
    const groupSessionsCount = new Set(groupRecords.map((r) => `${r.date}_${r.timeSlot}`)).size;
    const uniqueStudentIds = Array.from(new Set(records.map((r) => r.studentId)));
    const uniqueStudents = uniqueStudentIds.map((id) => students.find((s) => s.id === id)).filter((s): s is EnrolledStudent => Boolean(s));
    const dates = Array.from(new Set(records.map((r) => r.date))).sort().reverse();
    const lastActiveDate = dates[0] || 'No sessions yet';
    const presentRate = total > 0 ? Math.round(((present + practice + group) / total) * 100) : 0;

    return {
      total,
      present,
      absent,
      practice,
      group,
      groupSessionsCount,
      uniqueStudentCount: uniqueStudentIds.length,
      uniqueStudents,
      lastActiveDate,
      presentRate,
      datesCount: dates.length,
    };
  }, [teacherVaibhavRecords, filteredVaibhavRecords, students, classesDatePreset, classesStatusFilter, classesCourseFilter, classesSearch]);

  const vrishanAnalytics = useMemo(() => {
    const isContextFiltered = classesDatePreset !== 'ALL' || classesStatusFilter !== 'ALL' || classesCourseFilter !== 'ALL' || Boolean(classesSearch.trim());
    const records = isContextFiltered ? filteredVrishanRecords : teacherVrishanRecords;
    const total = records.length;
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const practice = records.filter((r) => r.status === 'PRACTICE_SESSION').length;
    const groupRecords = records.filter((r) => r.status === 'GROUP_SESSION');
    const group = groupRecords.length;
    const groupSessionsCount = new Set(groupRecords.map((r) => `${r.date}_${r.timeSlot}`)).size;
    const uniqueStudentIds = Array.from(new Set(records.map((r) => r.studentId)));
    const uniqueStudents = uniqueStudentIds.map((id) => students.find((s) => s.id === id)).filter((s): s is EnrolledStudent => Boolean(s));
    const dates = Array.from(new Set(records.map((r) => r.date))).sort().reverse();
    const lastActiveDate = dates[0] || 'No sessions yet';
    const presentRate = total > 0 ? Math.round(((present + practice + group) / total) * 100) : 0;

    return {
      total,
      present,
      absent,
      practice,
      group,
      groupSessionsCount,
      uniqueStudentCount: uniqueStudentIds.length,
      uniqueStudents,
      lastActiveDate,
      presentRate,
      datesCount: dates.length,
    };
  }, [teacherVrishanRecords, filteredVrishanRecords, students, classesDatePreset, classesStatusFilter, classesCourseFilter, classesSearch]);

  const abhinavAnalytics = useMemo(() => {
    const isContextFiltered = classesDatePreset !== 'ALL' || classesStatusFilter !== 'ALL' || classesCourseFilter !== 'ALL' || Boolean(classesSearch.trim());
    const records = isContextFiltered ? filteredAbhinavRecords : teacherAbhinavRecords;
    const total = records.length;
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const practice = records.filter((r) => r.status === 'PRACTICE_SESSION').length;
    const groupRecords = records.filter((r) => r.status === 'GROUP_SESSION');
    const group = groupRecords.length;
    const groupSessionsCount = new Set(groupRecords.map((r) => `${r.date}_${r.timeSlot}`)).size;
    const uniqueStudentIds = Array.from(new Set(records.map((r) => r.studentId)));
    const uniqueStudents = uniqueStudentIds.map((id) => students.find((s) => s.id === id)).filter((s): s is EnrolledStudent => Boolean(s));
    const dates = Array.from(new Set(records.map((r) => r.date))).sort().reverse();
    const lastActiveDate = dates[0] || 'No sessions yet';
    const presentRate = total > 0 ? Math.round(((present + practice + group) / total) * 100) : 0;

    return {
      total,
      present,
      absent,
      practice,
      group,
      groupSessionsCount,
      uniqueStudentCount: uniqueStudentIds.length,
      uniqueStudents,
      lastActiveDate,
      presentRate,
      datesCount: dates.length,
    };
  }, [teacherAbhinavRecords, filteredAbhinavRecords, students, classesDatePreset, classesStatusFilter, classesCourseFilter, classesSearch]);

  const handleExportClassesCSV = () => {
    const headers = [
      'Record ID',
      'Class Date',
      'Time Slot',
      'Teacher Name',
      'Teacher Email',
      'Teacher Role',
      'Student Name(s)',
      'Student Email(s)',
      'Student Phone(s)',
      'Course',
      'Batch / Type',
      'Attendance Status',
      'Remarks / Topics Covered',
      'Marked At',
    ];

    const rows = filteredClassesRecords.map((rec) => {
      const studentNames = rec.type === 'GROUP'
        ? rec.students.map((s) => s.name).join('; ') || rec.studentIds.join('; ')
        : (rec.student?.name || rec.studentId || '');
      const studentEmails = rec.type === 'GROUP'
        ? rec.students.map((s) => s.email).filter(Boolean).join('; ')
        : (rec.student?.email || '');
      const studentPhones = rec.type === 'GROUP'
        ? rec.students.map((s) => s.phone).filter(Boolean).join('; ')
        : (rec.student?.phone || '');
      const courses = rec.type === 'GROUP'
        ? Array.from(new Set(rec.students.map((s) => s.course).filter(Boolean))).join('; ') || 'Group Masterclass'
        : (rec.student?.course || '');
      const batch = rec.type === 'GROUP' ? 'Group Session' : (rec.student?.batch || '');

      return [
        `"${rec.id}"`,
        `"${rec.date}"`,
        `"${rec.timeSlot}"`,
        `"${(rec.markedByName || 'Staff').replace(/"/g, '""')}"`,
        `"${(rec.markedBy || '').replace(/"/g, '""')}"`,
        `"${rec.markedByRole || 'teacher'}"`,
        `"${studentNames.replace(/"/g, '""')}"`,
        `"${studentEmails.replace(/"/g, '""')}"`,
        `"${studentPhones.replace(/"/g, '""')}"`,
        `"${courses.replace(/"/g, '""')}"`,
        `"${batch.replace(/"/g, '""')}"`,
        `"${rec.status === 'GROUP_SESSION' ? `Group (${rec.students.length} students)` : rec.status}"`,
        `"${(rec.comment || '').replace(/"/g, '""')}"`,
        `"${rec.updatedAt || ''}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `soundabode_teacher_classes_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setClassesFeedbackToast('Exported class logs to CSV successfully.');
    setTimeout(() => setClassesFeedbackToast(null), 3500);
  };

  const handlePrintClassesLedger = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rowsHtml = filteredClassesRecords
      .map((rec) => {
        const studentNames = rec.type === 'GROUP'
          ? `Group: ${rec.students.map((s) => s.name).join(', ') || `${rec.students.length} Students`}`
          : (rec.student?.name || rec.studentId || 'N/A');
        const course = rec.type === 'GROUP'
          ? Array.from(new Set(rec.students.map((s) => s.course).filter(Boolean))).join(', ') || 'Group Masterclass'
          : (rec.student?.course || 'N/A');
        const batch = rec.type === 'GROUP' ? 'Group Session' : (rec.student?.batch || 'N/A');
        const status = rec.status === 'GROUP_SESSION' ? `Group (${rec.students.length})` : rec.status;

        return `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${escapeHtml(rec.date)}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(rec.timeSlot)}</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${escapeHtml(rec.markedByName || 'Staff')} (${escapeHtml(rec.markedBy || '')})</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${escapeHtml(studentNames)}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(course)}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(batch)}</td>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${escapeHtml(status)}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(rec.comment || 'N/A')}</td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Soundabode Studios - Teacher Classes & Attendance Ledger</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            p { font-size: 12px; color: #666; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 15px; }
            th { background: #f2f2f2; padding: 8px; border: 1px solid #ddd; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Soundabode Studios - Teacher Classes & Attendance Master Ledger</h1>
          <p>Generated on ${new Date().toLocaleString('en-IN')} | Total Records: ${filteredClassesRecords.length} | Teachers: Ashu, Vaibhav &amp; Vrishan</p>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time Slot</th>
                <th>Teacher</th>
                <th>Student</th>
                <th>Course</th>
                <th>Batch</th>
                <th>Status</th>
                <th>Remarks / Topic</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(sanitizePrintHtml(htmlContent));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleSyncClassesData = async () => {
    setIsClassesSyncing(true);
    try {
      await AttendanceService.fetchAndSyncFromRemote();
      setAttendanceVersion((v) => v + 1);
      setClassesFeedbackToast('Class records synced with live database!');
    } catch {
      setClassesFeedbackToast('Failed to sync. Using local cache.');
    } finally {
      setIsClassesSyncing(false);
      setTimeout(() => setClassesFeedbackToast(null), 3500);
    }
  };

  const totalPresent = activeAttendanceRecords.filter((r) => r.status === 'PRESENT').length;
  const totalAbsent = activeAttendanceRecords.filter((r) => r.status === 'ABSENT').length;
  const totalPractice = activeAttendanceRecords.filter((r) => r.status === 'PRACTICE_SESSION' || r.status === 'NA').length;
  const totalGroup = activeAttendanceRecords.filter((r) => r.status === 'GROUP_SESSION').length;
  const totalMarked = activeAttendanceRecords.length;
  const attendancePercentage = totalMarked > 0 ? Math.round(((totalPresent + totalPractice + totalGroup) / totalMarked) * 100) : 0;

  // PDF export only (the CMS keeps its full view). Every session counts; group and practice
  // sessions count as present, so Present + Absent = Total. The report never labels a
  // session as "group": those rows read "Present".
  const getAttendanceReportSummary = (records: AttendanceRecord[]) => {
    const classes = records;
    const absent = classes.filter((r) => r.status === 'ABSENT').length;
    const total = classes.length;
    const present = total - absent;
    return { classes, total, present, absent, rate: total > 0 ? Math.round((present / total) * 100) : 0 };
  };
  const reportStatusLabel = (status: AttendanceRecord['status']) =>
    status === 'PRACTICE_SESSION' || status === 'NA' ? 'PRACTICE' : status === 'GROUP_SESSION' ? 'PRESENT' : status;
  const reportSummary = getAttendanceReportSummary(activeAttendanceRecords);

  const handleExportStudentAttendanceCSV = (student?: EnrolledStudent) => {
    const targetStudent = student || activeStudent;
    if (!targetStudent) return;

    const headers = [
      '#',
      'Date',
      'Time Slot',
      'Attendance Status',
      'Marked By',
      'Mentor Notes / Remarks',
      'Student Name',
      'Student Email',
      'Course',
      'Batch',
    ];

    const sortedRecords = [...activeAttendanceRecords].sort((a, b) => {
      const dateDiff = (b.date || '').localeCompare(a.date || '');
      if (dateDiff !== 0) return dateDiff;
      return (b.timeSlot || '').localeCompare(a.timeSlot || '');
    });

    const rows = sortedRecords.map((r, idx) => {
      const statusLabel = r.status === 'PRACTICE_SESSION' || r.status === 'NA'
        ? 'PRACTICE'
        : r.status === 'GROUP_SESSION'
          ? 'GROUP SESSION'
          : r.status;

      return [
        `"${idx + 1}"`,
        `"${r.date}"`,
        `"${r.timeSlot}"`,
        `"${statusLabel}"`,
        `"${(r.markedByName || 'Staff').replace(/"/g, '""')}"`,
        `"${(r.comment || '').replace(/"/g, '""')}"`,
        `"${(targetStudent.name || '').replace(/"/g, '""')}"`,
        `"${(targetStudent.email || '').replace(/"/g, '""')}"`,
        `"${(getStudentCourses(targetStudent).join(', ') || targetStudent.course || '').replace(/"/g, '""')}"`,
        `"${(targetStudent.batch || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const safeName = (targetStudent.name || 'student').toLowerCase().replace(/[^a-z0-9]/g, '_');
    link.setAttribute('download', `soundabode_attendance_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintAttendanceReport = (student?: EnrolledStudent) => {
    const targetStudent = student || activeStudent;
    if (!targetStudent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    const summary = getAttendanceReportSummary(activeAttendanceRecords);
    const sortedRecords = [...summary.classes].sort((a, b) => {
      const dateDiff = (b.date || '').localeCompare(a.date || '');
      if (dateDiff !== 0) return dateDiff;
      return (b.timeSlot || '').localeCompare(a.timeSlot || '');
    });

    const sName = escapeHtml(targetStudent.name || 'Student');
    const sEmail = escapeHtml(targetStudent.email || 'N/A');
    const sPhone = escapeHtml(targetStudent.phone || 'N/A');
    const sCourses = escapeHtml(getStudentCourses(targetStudent).join(', ') || targetStudent.course || 'Audio Engineering & DJ');
    const sBatch = escapeHtml(targetStudent.batch || 'Regular Studio Batch');
    const sEnrolled = escapeHtml(targetStudent.enrolledDate || 'N/A');
    const reportDate = new Date().toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const reportTime = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const rowsHtml = sortedRecords
      .map((r, idx) => {
        const isPresent = r.status === 'PRESENT' || r.status === 'GROUP_SESSION';
        const isAbsent = r.status === 'ABSENT';

        const statusLabel = reportStatusLabel(r.status);
        const badgeClass = isPresent ? 'badge-present' : isAbsent ? 'badge-absent' : 'badge-practice';

        return `
          <tr>
            <td class="col-num">${idx + 1}</td>
            <td class="col-date"><strong>${escapeHtml(r.date)}</strong></td>
            <td class="col-time">${escapeHtml(r.timeSlot)}</td>
            <td class="col-status">
              <span class="status-badge ${badgeClass}">${escapeHtml(statusLabel)}</span>
            </td>
            ${!isTeacher ? `<td class="col-marked"><strong>${escapeHtml(r.markedByName || 'Staff')}</strong></td>` : ''}
            <td class="col-notes">${escapeHtml(r.comment || 'N/A')}</td>
          </tr>
        `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>SoundAbode Attendance Report - ${sName}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              margin: 0;
              padding: 0;
              background: #f1f5f9;
              color: #0f172a;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              font-size: 12px;
              line-height: 1.45;
            }

            /* Screen Toolbar for Mobile & Desktop */
            .no-print {
              display: block;
            }
            @media print {
              .no-print {
                display: none !important;
              }
              body {
                background: #ffffff !important;
                padding: 0 !important;
              }
              .report-sheet {
                padding: 0 !important;
                margin: 0 !important;
                box-shadow: none !important;
                border: none !important;
                max-width: 100% !important;
                width: 100% !important;
                border-radius: 0 !important;
              }
            }

            .print-toolbar {
              position: sticky;
              top: 0;
              z-index: 1000;
              background: #090a0f;
              border-bottom: 1px solid rgba(255, 255, 255, 0.12);
              color: #f8fafc;
              padding: 10px 18px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              flex-wrap: wrap;
              gap: 12px;
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
            }
            .toolbar-left {
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .toolbar-title {
              font-size: 13.5px;
              font-weight: 700;
              color: #ffffff;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .toolbar-subtitle {
              font-size: 11.5px;
              color: #94a3b8;
            }
            .toolbar-actions {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .btn-action-print {
              background: #e11d48;
              color: #ffffff;
              border: none;
              border-radius: 6px;
              padding: 8px 16px;
              font-size: 13px;
              font-weight: 700;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 6px;
              box-shadow: 0 2px 6px rgba(225, 29, 72, 0.35);
              transition: background 0.15s ease;
            }
            .btn-action-print:hover {
              background: #be123c;
            }
            .btn-action-close {
              background: #334155;
              color: #f8fafc;
              border: none;
              border-radius: 6px;
              padding: 8px 14px;
              font-size: 12.5px;
              font-weight: 600;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 5px;
              transition: background 0.15s ease;
            }
            .btn-action-close:hover {
              background: #475569;
            }

            /* Report Sheet Container */
            .report-sheet {
              max-width: 840px;
              margin: 20px auto;
              background: #ffffff;
              padding: 32px 36px;
              border-radius: 8px;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
              border: 1px solid #e2e8f0;
            }

            /* Header Branding */
            .report-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2.5px solid #e11d48;
              padding-bottom: 14px;
              margin-bottom: 16px;
            }
            .brand-group {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .brand-logo {
              width: 44px;
              height: 44px;
              object-fit: contain;
              border-radius: 6px;
            }
            .brand-title {
              font-size: 20px;
              font-weight: 900;
              color: #e11d48;
              letter-spacing: 0.6px;
              margin: 0;
              line-height: 1.15;
            }
            .brand-subtitle {
              font-size: 10px;
              color: #64748b;
              margin-top: 3px;
              font-weight: 500;
            }
            .header-meta {
              text-align: right;
            }
            .meta-badge {
              display: inline-block;
              font-size: 9.5px;
              font-weight: 800;
              letter-spacing: 0.8px;
              color: #ffffff;
              background: #0f172a;
              padding: 3px 8px;
              border-radius: 4px;
              margin-bottom: 4px;
            }
            .meta-date {
              font-size: 10.5px;
              color: #475569;
              font-weight: 500;
            }

            /* Student Details Card */
            .student-card {
              display: grid;
              grid-template-columns: 1.2fr 1fr;
              gap: 14px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 12px 16px;
              margin-bottom: 16px;
            }
            .card-label {
              font-size: 9px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .student-name {
              font-size: 15px;
              font-weight: 800;
              color: #0f172a;
              line-height: 1.2;
            }
            .student-contact {
              font-size: 11px;
              color: #475569;
              margin-top: 2px;
            }
            .course-name {
              font-size: 12.5px;
              font-weight: 700;
              color: #0f172a;
              line-height: 1.25;
            }
            .course-batch {
              font-size: 11px;
              color: #475569;
              margin-top: 2px;
            }

            /* KPI Summary Grid */
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-bottom: 18px;
            }
            .kpi-card {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 8px 6px;
              text-align: center;
            }
            .kpi-label {
              font-size: 8.5px;
              font-weight: 700;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              margin-bottom: 2px;
            }
            .kpi-val {
              font-size: 17px;
              font-weight: 800;
              line-height: 1.1;
              color: #0f172a;
            }
            .kpi-present {
              background: #ecfdf5;
              border-color: #a7f3d0;
            }
            .kpi-present .kpi-label,
            .kpi-present .kpi-val {
              color: #047857;
            }
            .kpi-absent {
              background: #fef2f2;
              border-color: #fecaca;
            }
            .kpi-absent .kpi-label,
            .kpi-absent .kpi-val {
              color: #b91c1c;
            }
            .kpi-group {
              background: #f0f9ff;
              border-color: #bae6fd;
            }
            .kpi-group .kpi-label,
            .kpi-group .kpi-val {
              color: #0284c7;
            }
            .kpi-rate {
              background: #fef3c7;
              border-color: #fde68a;
            }
            .kpi-rate .kpi-label,
            .kpi-rate .kpi-val {
              color: #b45309;
            }

            /* Attendance Table */
            .table-wrap {
              width: 100%;
              margin-bottom: 20px;
            }
            .attendance-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            .attendance-table thead {
              display: table-header-group;
            }
            .attendance-table th {
              background: #f1f5f9;
              color: #334155;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 9px;
              letter-spacing: 0.5px;
              padding: 7px 9px;
              border: 1px solid #cbd5e1;
              text-align: left;
            }
            .attendance-table td {
              padding: 6px 9px;
              border: 1px solid #e2e8f0;
              vertical-align: middle;
              color: #1e293b;
            }
            .attendance-table tr {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .attendance-table tr:nth-child(even) {
              background: #fafafa;
            }
            .col-num {
              width: 32px;
              text-align: center;
              color: #64748b;
              font-size: 9.5px;
            }
            .col-date {
              width: 95px;
              white-space: nowrap;
              color: #0f172a;
              font-weight: 600;
            }
            .col-time {
              width: 155px;
              white-space: nowrap;
              color: #334155;
            }
            .col-status {
              width: 120px;
              text-align: center;
              white-space: nowrap;
            }
            .col-marked {
              width: 95px;
              white-space: nowrap;
              color: #e11d48;
              font-weight: 600;
            }
            .col-notes {
              color: #475569;
              line-height: 1.35;
              word-break: break-word;
            }

            .status-badge {
              display: inline-block;
              font-size: 9px;
              font-weight: 700;
              padding: 2.5px 8px;
              border-radius: 999px;
              letter-spacing: 0.2px;
            }
            .badge-present {
              background: #ecfdf5;
              color: #047857;
              border: 1px solid #a7f3d0;
            }
            .badge-absent {
              background: #fef2f2;
              color: #b91c1c;
              border: 1px solid #fecaca;
            }
            .badge-group {
              background: #f0f9ff;
              color: #0284c7;
              border: 1px solid #bae6fd;
            }
            .badge-practice {
              background: #faf5ff;
              color: #7e22ce;
              border: 1px solid #e9d5ff;
            }

            /* Footer & Signatures */
            .report-footer {
              border-top: 1px solid #cbd5e1;
              padding-top: 14px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              font-size: 9.5px;
              color: #64748b;
              line-height: 1.45;
              page-break-inside: avoid;
            }
            .footer-brand-info {
              max-width: 62%;
            }
            .footer-sign-box {
              text-align: right;
            }
            .sign-line {
              display: inline-block;
              width: 150px;
              border-top: 1px solid #94a3b8;
              padding-top: 4px;
              font-weight: 600;
              color: #334155;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <!-- SCREEN TOOLBAR -->
          <div class="no-print print-toolbar">
            <div class="toolbar-left">
              <img src="${window.location.origin}/favicon-192x192.png" style="width: 26px; height: 26px; border-radius: 4px;" alt="Logo" />
              <div>
                <div class="toolbar-title">SoundAbode Academy • Official Attendance Report</div>
                <div class="toolbar-subtitle">Trainee: ${sName} • ${summary.total} Classes</div>
              </div>
            </div>
            <div class="toolbar-actions">
              <button type="button" id="btnPrintReport" class="btn-action-print">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Print / Save PDF
              </button>
              <button type="button" id="btnCloseReport" class="btn-action-close">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Close
              </button>
            </div>
          </div>

          <!-- PRINT SHEET -->
          <div class="report-sheet">
            <!-- BRAND HEADER -->
            <div class="report-header">
              <div class="brand-group">
                <img src="${window.location.origin}/favicon-192x192.png" class="brand-logo" alt="Soundabode Logo" />
                <div>
                  <h1 class="brand-title">SOUNDABODE ACADEMY</h1>
                  <div class="brand-subtitle">Vision 9 Mall, Pimple Saudagar, Pune • Audio Engineering &amp; DJ Academy</div>
                </div>
              </div>
              <div class="header-meta">
                <div><span class="meta-badge">OFFICIAL ATTENDANCE REPORT</span></div>
                <div class="meta-date">Report Date: ${reportDate} • ${reportTime}</div>
              </div>
            </div>

            <!-- STUDENT DETAILS -->
            <div class="student-card">
              <div>
                <div class="card-label">Student Details</div>
                <div class="student-name">${sName}</div>
                <div class="student-contact">${sEmail} • ${sPhone}</div>
              </div>
              <div>
                <div class="card-label">Program &amp; Batch</div>
                <div class="course-name">${sCourses}</div>
                <div class="course-batch">${sBatch} • Enrolled: ${sEnrolled}</div>
              </div>
            </div>

            <!-- STATS SUMMARY -->
            <div class="kpi-grid">
              <div class="kpi-card">
                <div class="kpi-label">Total Classes</div>
                <div class="kpi-val">${summary.total}</div>
              </div>
              <div class="kpi-card kpi-present">
                <div class="kpi-label">Present</div>
                <div class="kpi-val">${summary.present}</div>
              </div>
              <div class="kpi-card kpi-absent">
                <div class="kpi-label">Absent</div>
                <div class="kpi-val">${summary.absent}</div>
              </div>
              <div class="kpi-card kpi-rate">
                <div class="kpi-label">Attendance Rate</div>
                <div class="kpi-val">${summary.rate}%</div>
              </div>
            </div>

            <!-- ATTENDANCE LEDGER TABLE -->
            <div class="table-wrap">
              <table class="attendance-table">
                <thead>
                  <tr>
                    <th style="width: 32px; text-align: center;">#</th>
                    <th style="width: 95px;">Date</th>
                    <th style="width: 155px;">Time Slot</th>
                    <th style="width: 120px; text-align: center;">Status</th>
                    ${!isTeacher ? '<th style="width: 95px;">Marked By</th>' : ''}
                    <th>Mentor Notes / Topics Covered</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml || '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #94a3b8;">No attendance records found for this student.</td></tr>'}
                </tbody>
              </table>
            </div>

            <!-- FOOTER -->
            <div class="report-footer">
              <div class="footer-brand-info">
                <strong>SOUNDABODE ACADEMY</strong> • Shop 218, Vision 9 Mall, Kunal Icon Rd, Pimple Saudagar, Pune – 411017<br />
                Ph: +91 99750 16189 | Email: services@soundabode.com | Web: www.soundabode.com<br />
                <span style="font-size: 8.5px; color: #94a3b8;">Official academic ledger document verified and generated via SoundAbode CMS.</span>
              </div>
              <div class="footer-sign-box">
                <div class="sign-line">Authorized Signatory</div>
              </div>
            </div>
          </div>

          <script>
            window.addEventListener('DOMContentLoaded', function() {
              var btnPrint = document.getElementById('btnPrintReport');
              var btnClose = document.getElementById('btnCloseReport');
              if (btnPrint) {
                btnPrint.addEventListener('click', function() {
                  window.print();
                });
              }
              if (btnClose) {
                btnClose.addEventListener('click', function() {
                  window.close();
                });
              }
              setTimeout(function() {
                try {
                  window.print();
                } catch (e) {
                  console.warn('Auto print error:', e);
                }
              }, 450);
            });
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(sanitizePrintHtml(htmlContent));
    printWindow.document.close();
    printWindow.focus();
  };
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Mon = 0

  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatLocalDateStr(year, month, day);
    calendarDays.push({ day, dateStr });
  }

  // RENDER LOGIN LOCKSCREEN IF NOT AUTHENTICATED
  if (!isAuthenticated) {
    return (
      <div className={styles.adminContainer} data-theme={theme}>
        <div className={styles.loginOverlay}>
          <div className={styles.loginCard} style={{ maxWidth: '410px', padding: '2.5rem 2rem' }}>
            <div className={styles.cmsLoginHeader} style={{ marginBottom: '1rem' }}>
              <img
                src="/favicon-192x192.png"
                alt="Soundabode Logo"
                className={styles.cmsLogoImg}
                style={{ width: '48px', height: '48px' }}
              />
            </div>
            <h1 className={styles.loginTitle} style={{ fontSize: '1.3rem', fontWeight: 700 }}>Soundabode CMS Portal</h1>
            <p className={styles.loginSubtitle} style={{ marginBottom: '1.75rem' }}>Enter credentials to access console</p>

            <form onSubmit={handleLogin} className={styles.passcodeForm} style={{ gap: '1.1rem' }}>
              <div style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                  Email Address
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ position: 'absolute', left: '0.85rem', pointerEvents: 'none' }}
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  <input
                    type="email"
                    placeholder="name@soundabode.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className={styles.passcodeInput}
                    style={{ paddingLeft: '2.4rem', height: '42px' }}
                  />
                </div>
              </div>

              <div style={{ textAlign: 'left' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                  Passcode / Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ position: 'absolute', left: '0.85rem', pointerEvents: 'none' }}
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    type="password"
                    placeholder="Enter passcode"
                    value={passcodeAttempt}
                    onChange={(e) => setPasscodeAttempt(e.target.value)}
                    className={styles.passcodeInput}
                    style={{ paddingLeft: '2.4rem', height: '42px' }}
                    autoFocus
                  />
                </div>
              </div>

              {authError && <div className={styles.errorAlert}>{authError}</div>}

              <button
                type="submit"
                className={styles.btnPrimary}
                style={{ width: '100%', height: '42px', marginTop: '0.3rem', fontSize: '0.9rem', fontWeight: 600 }}
              >
                Sign In To Portal
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.adminContainer} data-theme={theme}>
      <SEO
        title="Blog Admin - Soundabode"
        description="Soundabode CMS Administration Panel"
        noindex={true}
      />
      {/* UNIFIED HEADER BAR */}
      <header className={styles.topAdminHeader}>
        <div className={styles.brandAdminBox}>
          <img
            src="/favicon-192x192.png"
            alt="Soundabode Logo"
            className={styles.cmsHeaderLogo}
          />
          <span
            title={
              dbStatus === 'connected'
                ? 'MongoDB Atlas Database Connected'
                : dbStatus === 'connecting'
                  ? 'Connecting to MongoDB Atlas...'
                  : 'Local Cache Mode (Atlas fallback ready)'
            }
            className={styles.dbStatusBadge}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dbStatus === 'connected' ? '#10b981' : '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
            <span className={styles.dbStatusText}>{dbStatus === 'connected' ? 'MongoDB Atlas' : 'Local / Atlas Sync'}</span>
          </span>
        </div>

        <div className={styles.topAdminNavLinks}>
          {/* DESKTOP CONTROLS */}
          <div className={styles.desktopOnlyNav}>
            {currentUser && (
              <span className={styles.userBadge}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className={styles.userBadgeText}>{isTeacher ? `Teacher: ${currentUser.name}` : `Admin: ${currentUser.name}`}</span>
              </span>
            )}

            <button
              onClick={toggleTheme}
              className={styles.btnSecondary}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              style={{ padding: '0 0.65rem' }}
            >
              {theme === 'dark' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            <button onClick={() => navigateToPublic('/')} className={styles.btnSecondary} style={{ gap: '0.35rem' }}>
              <span className={styles.navBtnLabel}>Website</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
            <button onClick={() => navigateToPublic('/blog')} className={styles.btnSecondary} style={{ gap: '0.35rem' }}>
              <span className={styles.navBtnLabel}>Blog</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
            <button
              onClick={() => {
                setIsIssueModalOpen(true);
                setIssueFeedbackToast(null);
              }}
              className={styles.btnSecondary}
              style={{ gap: '0.35rem', borderColor: 'rgba(225, 29, 72, 0.4)', color: 'var(--accent-text)' }}
              title="Report an issue or bug directly to the developer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className={styles.navBtnLabel}>Report Issue</span>
            </button>
            <button onClick={handleLogout} className={styles.btnGhost} style={{ color: 'var(--accent-text)', padding: '0 0.5rem' }}>
              <span className={styles.navBtnLabel}>Sign Out</span>
            </button>
          </div>

          {/* MOBILE CONTROLS */}
          <div className={styles.mobileOnlyNav}>
            <button
              onClick={toggleTheme}
              className={styles.btnSecondary}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              style={{ padding: '0 0.55rem', height: '36px' }}
            >
              {theme === 'dark' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={styles.hamburgerBtn}
              title="Open Navigation Menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE DRAWER NAVIGATION */}
      {isMobileMenuOpen && (
        <div className={styles.mobileDrawerOverlay} onClick={() => setIsMobileMenuOpen(false)}>
          <div className={styles.mobileDrawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.mobileDrawerHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <img src="/favicon-192x192.png" alt="Soundabode" style={{ width: '24px', height: '24px' }} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Soundabode CMS</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className={styles.closeModalBtn}
                style={{ fontSize: '1.4rem' }}
              >
                ✕
              </button>
            </div>

            {currentUser && (
              <div className={styles.mobileDrawerUserCard}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {currentUser.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Role: {isTeacher ? 'Teacher' : 'Administrator'} ({currentUser.email})
                </div>
                <div style={{ fontSize: '0.65rem', color: dbStatus === 'connected' ? 'var(--success-text)' : 'var(--warning-text)', marginTop: '0.2rem' }}>
                  ● {dbStatus === 'connected' ? 'Atlas Connected' : 'Local / Sync Mode'}
                </div>
              </div>
            )}

            <div className={styles.mobileDrawerBody}>
              {!isTeacher && (
                <button
                  onClick={() => { setActiveTab('overview'); setIsMobileMenuOpen(false); }}
                  className={`${styles.sidebarBtn} ${activeTab === 'overview' ? styles.sidebarBtnActive : ''}`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
                  Overview
                </button>
              )}

              {!isTeacher && (
                <button
                  onClick={() => { setActiveTab('students'); setIsMobileMenuOpen(false); }}
                  className={`${styles.sidebarBtn} ${activeTab === 'students' ? styles.sidebarBtnActive : ''}`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                  Students
                  <span className={styles.badgeCount}>{students.length}</span>
                </button>
              )}

              {!isTeacher && (
                <button
                  onClick={() => { setActiveTab('classes'); setIsMobileMenuOpen(false); }}
                  className={`${styles.sidebarBtn} ${activeTab === 'classes' ? styles.sidebarBtnActive : ''}`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                  Classes
                  <span className={styles.badgeCount}>{allAttendanceRecords.length}</span>
                </button>
              )}

              {!isTeacher && (
                <button
                  onClick={() => { setActiveTab('blog'); setIsMobileMenuOpen(false); }}
                  className={`${styles.sidebarBtn} ${activeTab === 'blog' ? styles.sidebarBtnActive : ''}`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  Articles
                  <span className={styles.badgeCount}>{posts.length}</span>
                </button>
              )}

              <button
                onClick={() => { setActiveTab('attendance'); setIsMobileMenuOpen(false); }}
                className={`${styles.sidebarBtn} ${activeTab === 'attendance' ? styles.sidebarBtnActive : ''}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /></svg>
                Attendance
                <span className={styles.badgeCount}>{students.length}</span>
              </button>

              {isTeacher && (
                <button
                  onClick={() => { setActiveTab('inquiries'); setIsMobileMenuOpen(false); }}
                  className={`${styles.sidebarBtn} ${activeTab === 'inquiries' ? styles.sidebarBtnActive : ''}`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
                  My Leads
                  {newInquiryCount > 0 && <span className={`${styles.badgeCount} ${styles.badgeCountNew}`}>{newInquiryCount}</span>}
                </button>
              )}

              {!isTeacher && (
                <>
                  <button
                    onClick={() => { setActiveTab('inquiries'); setIsMobileMenuOpen(false); }}
                    className={`${styles.sidebarBtn} ${activeTab === 'inquiries' ? styles.sidebarBtnActive : ''}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
                    Leads CRM
                    {newInquiryCount > 0 && <span className={`${styles.badgeCount} ${styles.badgeCountNew}`}>{newInquiryCount}</span>}
                  </button>

                  <button
                    onClick={() => { setActiveTab('meta-ads'); setIsMobileMenuOpen(false); }}
                    className={`${styles.sidebarBtn} ${activeTab === 'meta-ads' ? styles.sidebarBtnActive : ''}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
                    </svg>
                    Meta Ads
                    {newMetaLeadsCount > 0 ? (
                      <span className={`${styles.badgeCount} ${styles.badgeCountNew}`}>{newMetaLeadsCount}</span>
                    ) : metaLeadsCount > 0 ? (
                      <span className={styles.badgeCount}>{metaLeadsCount}</span>
                    ) : null}
                  </button>

                  <button
                    onClick={() => { setActiveTab('admissions'); setIsMobileMenuOpen(false); }}
                    className={`${styles.sidebarBtn} ${activeTab === 'admissions' ? styles.sidebarBtnActive : ''}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 15l2 2 4-4" /></svg>
                    Submissions
                    <span className={styles.badgeCount}>{admissions.length}</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('fees'); setIsMobileMenuOpen(false); }}
                    className={`${styles.sidebarBtn} ${activeTab === 'fees' ? styles.sidebarBtnActive : ''}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                    Fees & Receipts
                    <span className={styles.badgeCount}>{fees.length}</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
                    className={`${styles.sidebarBtn} ${activeTab === 'settings' ? styles.sidebarBtnActive : ''}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                    Settings
                  </button>
                </>
              )}
            </div>

            <div className={styles.mobileDrawerFooter}>
              <button onClick={() => { navigateToPublic('/'); setIsMobileMenuOpen(false); }} className={styles.btnSecondary} style={{ justifyContent: 'center' }}>
                Visit Website ↗
              </button>
              <button onClick={() => { navigateToPublic('/blog'); setIsMobileMenuOpen(false); }} className={styles.btnSecondary} style={{ justifyContent: 'center' }}>
                Visit Blog ↗
              </button>
              <button
                onClick={() => {
                  setIsIssueModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className={styles.btnSecondary}
                style={{
                  justifyContent: 'center',
                  borderColor: 'rgba(244, 63, 94, 0.4)',
                  color: 'var(--accent-text)',
                  background: 'rgba(244, 63, 94, 0.08)'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Developer Hub
              </button>
              <button onClick={handleLogout} className={styles.btnSecondary} style={{ justifyContent: 'center', color: 'var(--accent-red)' }}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DASHBOARD BODY */}
      <div className={styles.dashboardBody}>
        {/* SIDEBAR NAVIGATION */}
        <aside className={styles.sidebar}>
          {!isTeacher && (
            <button
              onClick={() => setActiveTab('overview')}
              className={`${styles.sidebarBtn} ${activeTab === 'overview' ? styles.sidebarBtnActive : ''}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              Overview
            </button>
          )}

          {!isTeacher && (
            <button
              onClick={() => setActiveTab('students')}
              className={`${styles.sidebarBtn} ${activeTab === 'students' ? styles.sidebarBtnActive : ''}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Students
              <span className={styles.badgeCount}>{students.length}</span>
            </button>
          )}

          {!isTeacher && (
            <button
              onClick={() => setActiveTab('classes')}
              className={`${styles.sidebarBtn} ${activeTab === 'classes' ? styles.sidebarBtnActive : ''}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              Classes
              <span className={styles.badgeCount}>{allAttendanceRecords.length}</span>
            </button>
          )}

          {!isTeacher && (
            <button
              onClick={() => setActiveTab('blog')}
              className={`${styles.sidebarBtn} ${activeTab === 'blog' ? styles.sidebarBtnActive : ''}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Articles
              <span className={styles.badgeCount}>{posts.length}</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('attendance')}
            className={`${styles.sidebarBtn} ${activeTab === 'attendance' ? styles.sidebarBtnActive : ''}`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Attendance
            <span className={styles.badgeCount}>{students.length}</span>
          </button>

          {isTeacher && (
            <button
              onClick={() => setActiveTab('inquiries')}
              className={`${styles.sidebarBtn} ${activeTab === 'inquiries' ? styles.sidebarBtnActive : ''}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              </svg>
              My Leads
              {newInquiryCount > 0 && <span className={`${styles.badgeCount} ${styles.badgeCountNew}`}>{newInquiryCount}</span>}
            </button>
          )}

          {!isTeacher && (
            <>
              <button
                onClick={() => setActiveTab('inquiries')}
                className={`${styles.sidebarBtn} ${activeTab === 'inquiries' ? styles.sidebarBtnActive : ''}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                  <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
                Leads
                {newInquiryCount > 0 && <span className={`${styles.badgeCount} ${styles.badgeCountNew}`}>{newInquiryCount}</span>}
              </button>
              <button
                id="cms-tab-meta-ads"
                onClick={() => setActiveTab('meta-ads')}
                className={`${styles.sidebarBtn} ${activeTab === 'meta-ads' ? styles.sidebarBtnActive : ''}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
                </svg>
                Meta Ads
                {newMetaLeadsCount > 0 ? (
                  <span className={`${styles.badgeCount} ${styles.badgeCountNew}`}>{newMetaLeadsCount}</span>
                ) : metaLeadsCount > 0 ? (
                  <span className={styles.badgeCount}>{metaLeadsCount}</span>
                ) : null}
              </button>
              <button
                onClick={() => setActiveTab('admissions')}
                className={`${styles.sidebarBtn} ${activeTab === 'admissions' ? styles.sidebarBtnActive : ''}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M9 15l2 2 4-4" />
                </svg>
                Submissions
                <span className={styles.badgeCount}>{admissions.length}</span>
              </button>
              <button
                onClick={() => setActiveTab('fees')}
                className={`${styles.sidebarBtn} ${activeTab === 'fees' ? styles.sidebarBtnActive : ''}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                Fees
                <span className={styles.badgeCount}>{fees.length}</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`${styles.sidebarBtn} ${activeTab === 'settings' ? styles.sidebarBtnActive : ''}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Settings
              </button>
            </>
          )}
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className={styles.contentArea}>
          {/* TAB 1: OVERVIEW & ANALYTICS DASHBOARD */}
          {!isTeacher && activeTab === 'overview' && (
            <div>
              {/* HEADER & QUICK ACTIONS */}
              <div className={styles.pageHeaderRow}>
                <div>
                  <h1 className={styles.pageTitle}>Overview</h1>
                  <div className={styles.pageMetaBadge}>
                    <span>{students.length} enrolled</span>
                    <span>·</span>
                    <span>{admissions.length} applications</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleOpenNewStudentModal}
                    className={styles.btnPrimary}
                    style={{ fontSize: '0.75rem', height: '32px', padding: '0 0.85rem' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Enroll Student
                  </button>
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className={styles.btnSecondary}
                    style={{ fontSize: '0.75rem', height: '32px', padding: '0 0.75rem' }}
                  >
                    Take Attendance
                  </button>
                  <button
                    onClick={() => setActiveTab('admissions')}
                    className={styles.btnSecondary}
                    style={{ fontSize: '0.75rem', height: '32px', padding: '0 0.75rem' }}
                  >
                    View Admissions
                  </button>
                </div>
              </div>

              {/* WHAT NEEDS A REPLY TODAY: the screen's focal point */}
              <section className={styles.needsAction} aria-label="Waiting on you">
                <h2 className={styles.needsActionTitle}>Waiting on you</h2>
                {newInquiryCount + unassignedLeadCount + newAdmissionsCount === 0 ? (
                  <p className={styles.needsActionEmpty}>Nothing waiting. Every lead has an owner and every application has been reviewed.</p>
                ) : (
                  <div className={styles.needsActionItems}>
                    {newInquiryCount > 0 && (
                      <button
                        type="button"
                        className={styles.needsActionItem}
                        onClick={() => { clearLeadFilters(); setLeadView('list'); setInquiryStatusFilter('NEW'); setActiveTab('inquiries'); }}
                      >
                        <strong>{newInquiryCount}</strong>
                        <span>new {newInquiryCount === 1 ? 'lead' : 'leads'} to contact</span>
                      </button>
                    )}
                    {unassignedLeadCount > 0 && (
                      <button
                        type="button"
                        className={styles.needsActionItem}
                        onClick={() => { clearLeadFilters(); setLeadAssigneeFilter('UNASSIGNED'); setActiveTab('inquiries'); }}
                      >
                        <strong>{unassignedLeadCount}</strong>
                        <span>{unassignedLeadCount === 1 ? 'lead has' : 'leads have'} no owner</span>
                      </button>
                    )}
                    {newAdmissionsCount > 0 && (
                      <button
                        type="button"
                        className={styles.needsActionItem}
                        onClick={() => { setAdmissionStatusFilter('NEW'); setActiveTab('admissions'); }}
                      >
                        <strong>{newAdmissionsCount}</strong>
                        <span>{newAdmissionsCount === 1 ? 'application' : 'applications'} to review</span>
                      </button>
                    )}
                  </div>
                )}
              </section>

              {/* TOTALS */}
              <div className={styles.kpiGrid}>
                <button type="button" className={styles.kpiCard} onClick={() => setActiveTab('students')}>
                  <span className={styles.kpiLabel}>Enrolled students</span>
                  <span className={styles.kpiValue}>{students.length}</span>
                  <span className={styles.kpiSubRow}>{djStudentsCount} DJ · {empStudentsCount} EMP</span>
                </button>

                <button type="button" className={styles.kpiCard} onClick={() => setActiveTab('admissions')}>
                  <span className={styles.kpiLabel}>Applications</span>
                  <span className={styles.kpiValue}>{admissions.length}</span>
                  <span className={styles.kpiSubRow}>
                    {newAdmissionsCount > 0 ? `${newAdmissionsCount} awaiting review` : 'All reviewed'}
                  </span>
                </button>

                <button type="button" className={styles.kpiCard} onClick={() => setActiveTab('inquiries')}>
                  <span className={styles.kpiLabel}>Leads</span>
                  <span className={styles.kpiValue}>{inquiries.length}</span>
                  <span className={styles.kpiSubRow}>{enrolledCount} of {inquiries.length} enrolled</span>
                </button>

                <button type="button" className={styles.kpiCard} onClick={() => setActiveTab('attendance')}>
                  <span className={styles.kpiLabel}>Sessions logged</span>
                  <span className={styles.kpiValue}>{allAttendanceRecords.length}</span>
                  <span className={styles.kpiSubRow}>{allAttendanceRecords.length > 0 ? 'Across all teachers' : 'None logged yet'}</span>
                </button>
              </div>

              {/* REAL DATA ANALYTICS: 6-MONTH INTAKE TREND & COURSE BREAKDOWN */}
              <div className={styles.chartsGrid}>
                {/* 6-MONTH INTAKE VELOCITY */}
                <div className={styles.chartCard}>
                  <div className={styles.chartHeader}>
                    <div>
                      <h3 className={styles.chartTitle}>6-Month Intake &amp; Lead Flow</h3>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {intakeMonthlyTrend.totalVolume} total submissions recorded across past 6 months
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.65rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', background: 'var(--text-muted)', borderRadius: '2px', display: 'inline-block' }} />
                        Inquiries
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', background: 'var(--text-primary)', borderRadius: '2px', display: 'inline-block' }} />
                        Admissions
                      </span>
                    </div>
                  </div>

                  <div className={styles.intakeChartContainer}>
                    {intakeMonthlyTrend.list.map((m) => {
                      const inqHeightPct = Math.max(8, Math.round((m.inqCount / intakeMonthlyTrend.maxVal) * 100));
                      const admHeightPct = Math.max(8, Math.round((m.admCount / intakeMonthlyTrend.maxVal) * 100));
                      return (
                        <div key={m.yearMonth} className={styles.intakeBarCol}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {m.total}
                          </div>
                          <div className={styles.intakeBarsWrap}>
                            <div
                              className={styles.intakeBarInq}
                              style={{ height: `${m.inqCount > 0 ? inqHeightPct : 4}%` }}
                              title={`${m.label}: ${m.inqCount} Inquiries`}
                            />
                            <div
                              className={styles.intakeBarAdm}
                              style={{ height: `${m.admCount > 0 ? admHeightPct : 4}%` }}
                              title={`${m.label}: ${m.admCount} Admissions`}
                            />
                          </div>
                          <span className={styles.intakeMonthLabel}>{m.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* DYNAMIC COURSE ENROLLMENT BREAKDOWN */}
                <div className={styles.chartCard}>
                  <div className={styles.chartHeader}>
                    <div>
                      <h3 className={styles.chartTitle}>Live Course Distribution</h3>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Breakdown across {students.length} active studio students
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '0.35rem' }}>
                    {dynamicCourseStats.map((cs) => (
                      <div key={cs.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.775rem', marginBottom: '0.35rem' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{cs.name}</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {cs.count} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 400 }}>({cs.percentage}%)</span>
                          </span>
                        </div>
                        <div className={styles.progressBarTrack} style={{ background: cs.trackBg, height: '6px' }}>
                          <div
                            style={{
                              width: `${cs.percentage}%`,
                              height: '100%',
                              background: cs.color,
                              borderRadius: '3px',
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* DUAL OPERATIONAL QUEUES */}
              <div className={styles.overviewDualGrid}>
                {/* QUEUE 1: RECENT ADMISSION APPLICATIONS */}
                <div className={styles.tableCard}>
                  <div className={styles.tableHeaderBar}>
                    <div>
                      <h3 className={styles.tableHeaderTitle}>Recent Admissions</h3>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Official DJ / EMP registrations</span>
                    </div>
                    <button onClick={() => setActiveTab('admissions')} className={styles.btnGhost} style={{ gap: '0.35rem', fontSize: '0.725rem' }}>
                      All ({admissions.length})
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                    </button>
                  </div>

                  {admissions.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      No admission applications received yet.
                    </div>
                  ) : (
                    <table className={`${styles.dataTable} ${styles.overviewAdmissionsTable}`}>
                      <thead>
                        <tr>
                          <th>Applicant</th>
                          <th>Course</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admissions.slice(0, 4).map((adm) => {
                          const avatar = getAvatarDetails(`${adm.firstName} ${adm.lastName}`);
                          return (
                            <tr key={adm.id}>
                              <td>
                                <div className={styles.studentCell}>
                                  {adm.photoUrl && safeImageUrl(adm.photoUrl) ? (
                                    <img
                                      src={safeImageUrl(adm.photoUrl)}
                                      alt={`${adm.firstName} ${adm.lastName}`}
                                      className={styles.avatarCircle}
                                      style={{ objectFit: 'cover', border: '1.5px solid var(--border-strong)' }}
                                    />
                                  ) : (
                                    <div
                                      className={styles.avatarCircle}
                                      style={{ background: avatar.bg, border: `1px solid ${avatar.border}` }}
                                    >
                                      {avatar.initials}
                                    </div>
                                  )}
                                  <div>
                                    <div className={styles.studentName} style={{ fontWeight: 600 }}>{adm.firstName} {adm.lastName}</div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{adm.formNo}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{adm.courseOpted}</span>
                              </td>
                              <td>
                                <button
                                  onClick={() => setActiveTab('admissions')}
                                  className={`${styles.badge} ${adm.status === 'NEW'
                                      ? styles.badgeNew
                                      : adm.status === 'CONTACTED'
                                        ? styles.badgeContacted
                                        : adm.status === 'ENROLLED'
                                          ? styles.badgeEnrolled
                                          : styles.badgeArchived
                                    }`}
                                  style={{ cursor: 'pointer' }}
                                  title="Open in Submissions"
                                >
                                  {LEAD_STAGE_LABELS[adm.status] || adm.status}
                                </button>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  onClick={() => setSelectedAdmissionForModal(adm)}
                                  className={styles.btnSecondary}
                                  style={{ fontSize: '0.7rem', height: '24px', padding: '0 0.5rem' }}
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* QUEUE 2: RECENT PROSPECT INQUIRIES */}
                <div className={styles.tableCard}>
                  <div className={styles.tableHeaderBar}>
                    <div>
                      <h3 className={styles.tableHeaderTitle}>Recent Prospects</h3>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Incoming leads &amp; inquiries</span>
                    </div>
                    <button onClick={() => setActiveTab('inquiries')} className={styles.btnGhost} style={{ gap: '0.35rem', fontSize: '0.725rem' }}>
                      All ({inquiries.length})
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                    </button>
                  </div>

                  {inquiries.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      No incoming prospect inquiries.
                    </div>
                  ) : (
                    <table className={`${styles.dataTable} ${styles.overviewLeadsTable}`}>
                      <thead>
                        <tr>
                          <th>Lead</th>
                          <th>Interest</th>
                          <th>Source</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inquiries.slice(0, 4).map((inq) => {
                          const avatar = getAvatarDetails(inq.name);
                          const sourceBadge = getSourceBadgeDetails(inq);
                          return (
                            <tr key={inq.id}>
                              <td>
                                <div className={styles.studentCell}>
                                  <div
                                    className={styles.avatarCircle}
                                    style={{ background: avatar.bg, border: `1px solid ${avatar.border}` }}
                                  >
                                    {avatar.initials}
                                  </div>
                                  <div>
                                    <div className={styles.studentName} style={{ fontWeight: 600 }}>{inq.name}</div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{inq.phone || inq.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{inq.courseInterest}</span>
                              </td>
                              <td>
                                <span className={`${styles.badge} ${sourceBadge.className}`} style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                                  {sourceBadge.label}
                                </span>
                              </td>
                              <td>
                                <button
                                  onClick={() => setActiveTab('inquiries')}
                                  className={`${styles.badge} ${inq.status === 'NEW'
                                      ? styles.badgeNew
                                      : inq.status === 'CONTACTED'
                                        ? styles.badgeContacted
                                        : inq.status === 'ENROLLED'
                                          ? styles.badgeEnrolled
                                          : styles.badgeArchived
                                    }`}
                                  style={{ cursor: 'pointer' }}
                                  title="Open in Leads"
                                >
                                  {LEAD_STAGE_LABELS[inq.status] || inq.status}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: STUDENT DIRECTORY */}
          {!isTeacher && activeTab === 'students' && (
            <div>
              <div className={styles.pageHeaderRow}>
                <div>
                  <h1 className={styles.pageTitle}>Student Directory</h1>
                  <div className={styles.pageMetaBadge}>
                    <span>Manage all {students.length} enrolled DJ &amp; EMP students</span>
                  </div>
                </div>
                <button onClick={handleOpenNewStudentModal} className={styles.btnPrimary} style={{ gap: '0.4rem' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Enroll New Student
                </button>
              </div>

              {/* SEARCH & COURSE FILTER BAR */}
              <div className={styles.filterBar}>
                <input
                  type="text"
                  placeholder="Search students by name, email, course, phone..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className={styles.searchInput}
                />

                <select
                  value={studentCourseFilter}
                  onChange={(e) => setStudentCourseFilter(e.target.value)}
                  className={styles.selectInput}
                >
                  <option value="ALL">All Courses ({students.length})</option>
                  <option value="Pro DJ">Pro DJ Course</option>
                  <option value="Basic DJ">Basic DJ Course</option>
                  <option value="Special DJ">Special DJ Course</option>
                  <option value="DJ Course">DJ Course</option>
                  <option value="EMP Diploma">EMP Diploma</option>
                  <option value="EMP Basic">EMP Basic</option>
                </select>
              </div>

              {/* STUDENTS TABLE */}
              {filteredStudents.length === 0 ? (
                <div className={styles.emptyStateBox} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <p>No students found matching your search or filters.</p>
                </div>
              ) : (
                <>
                  {/* DESKTOP TABLE VIEW */}
                  <div className={styles.desktopTableContainer}>
                    <div className={styles.tableCard}>
                      <table className={styles.dataTable} style={{ minWidth: '850px' }}>
                        <thead>
                          <tr>
                            <th style={{ minWidth: '180px' }}>Enrolled Student</th>
                            <th style={{ minWidth: '180px' }}>Course &amp; Program</th>
                            <th style={{ minWidth: '200px' }}>Batch Details</th>
                            <th style={{ minWidth: '160px' }}>Contact Info</th>
                            <th style={{ width: '110px' }}>Enrolled Date</th>
                            <th style={{ textAlign: 'right', minWidth: '180px' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudentEntries.map((entry) => {
                            const std = entry.student;
                            const avatar = getAvatarDetails(std.name);
                            const rowCourses = entry.kind === 'course' ? [entry.course] : getStudentCourses(std);
                            return (
                              <tr key={entry.key}>
                                <td>
                                  <div className={styles.studentCell}>
                                    <div
                                      className={styles.avatarCircle}
                                      style={{ background: avatar.bg, border: `1px solid ${avatar.border}` }}
                                    >
                                      {avatar.initials}
                                    </div>
                                    <div>
                                      <div className={styles.studentName} style={{ fontWeight: 600 }}>{std.name}</div>
                                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{std.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                                    {rowCourses.map((courseName, idx) => (
                                      <span
                                        key={idx}
                                        style={{
                                          display: 'inline-block',
                                          background: 'var(--bg-surface)',
                                          color: 'var(--text-secondary)',
                                          border: '1px solid var(--border-medium)',
                                          borderRadius: '5px',
                                          fontSize: '0.725rem',
                                          fontWeight: 500,
                                          padding: '0.2rem 0.5rem',
                                          lineHeight: 1.35,
                                        }}
                                      >
                                        {courseName}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td>
                                  <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>{entry.batch}</div>
                                  {entry.kind === 'course' && (
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      1 of {getStudentCourses(std).length} courses
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <a href={safeMailto(std.email)} style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', fontSize: '0.775rem' }}>
                                    {std.email}
                                  </a>
                                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{std.phone}</div>
                                </td>
                                <td style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                                  {std.enrolledDate}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', maxWidth: '260px', marginLeft: 'auto' }}>
                                    <button
                                      onClick={() => handleOpenReminderModal(std, 'FEE_PAYMENT')}
                                      className={styles.btnSecondary}
                                      style={{ fontSize: '0.725rem', height: '26px', padding: '0 0.55rem', color: 'var(--text-primary)', borderColor: 'var(--border-strong)', gap: '0.25rem', whiteSpace: 'nowrap' }}
                                      title="Send email reminder via Zoho Mail SMTP"
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                        <polyline points="22,6 12,13 2,6" />
                                      </svg>
                                      Send Email
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedStudentId(entry.key);
                                        setActiveTab('attendance');
                                      }}
                                      className={styles.btnSecondary}
                                      style={{ fontSize: '0.725rem', height: '26px', padding: '0 0.55rem', whiteSpace: 'nowrap' }}
                                      title="View & mark attendance"
                                    >
                                      Attendance
                                    </button>
                                    <button
                                      onClick={() => handleOpenEditStudentModal(std)}
                                      className={styles.btnSecondary}
                                      style={{ fontSize: '0.725rem', height: '26px', padding: '0 0.55rem', whiteSpace: 'nowrap' }}
                                      title="Edit student details"
                                    >
                                      Edit
                                    </button>
                                    {entry.kind === 'course' ? (
                                      <button
                                        onClick={() => handleRemoveStudentCourse(std, entry.course)}
                                        className={styles.btnDestructive}
                                        style={{ fontSize: '0.725rem', height: '26px', padding: '0 0.55rem', whiteSpace: 'nowrap' }}
                                        title="Remove this course from the student (keeps the student and their attendance)"
                                      >
                                        Remove course
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => handleDeleteStudent(std.id, std.name)}
                                        className={styles.btnDestructive}
                                        style={{ fontSize: '0.725rem', height: '26px', padding: '0 0.55rem', whiteSpace: 'nowrap' }}
                                        title="Permanently delete student from roster & MongoDB"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* MOBILE CARDS VIEW */}
                  <div className={styles.mobileCardList}>
                    {filteredStudentEntries.map((entry) => {
                      const std = entry.student;
                      const avatar = getAvatarDetails(std.name);
                      const rowCourses = entry.kind === 'course' ? [entry.course] : getStudentCourses(std);
                      return (
                        <div key={entry.key} className={styles.mobileDataCard}>
                          <div className={styles.mobileCardHeader}>
                            <div className={styles.mobileCardTitleBox}>
                              <div
                                className={styles.avatarCircle}
                                style={{ background: avatar.bg, border: `1px solid ${avatar.border}`, width: '36px', height: '36px' }}
                              >
                                {avatar.initials}
                              </div>
                              <div>
                                <div className={styles.mobileCardTitle}>{std.name}</div>
                                <div className={styles.mobileCardSubText}>{std.email}</div>
                              </div>
                            </div>
                          </div>

                          {rowCourses.length > 0 && (
                            <div className={styles.mobileCourseChips}>
                              {rowCourses.map((courseName, idx) => (
                                <span key={idx} className={styles.mobileCourseChip}>{courseName}</span>
                              ))}
                              {entry.kind === 'course' && (
                                <span className={styles.mobileCardSubText}>1 of {getStudentCourses(std).length} courses</span>
                              )}
                            </div>
                          )}

                          <div className={styles.mobileCardBody}>
                            <div className={styles.mobileCardRow}>
                              <span className={styles.mobileCardLabel}>Batch</span>
                              <span className={styles.mobileCardValue}>{entry.batch}</span>
                            </div>
                            <div className={styles.mobileCardRow}>
                              <span className={styles.mobileCardLabel}>Phone</span>
                              <span className={styles.mobileCardValue}>{std.phone || 'N/A'}</span>
                            </div>
                            <div className={styles.mobileCardRow}>
                              <span className={styles.mobileCardLabel}>Enrolled Date</span>
                              <span className={styles.mobileCardValue}>{std.enrolledDate}</span>
                            </div>
                          </div>

                          <div className={styles.mobileCardActions}>
                            <button
                              onClick={() => {
                                setSelectedStudentId(entry.key);
                                setActiveTab('attendance');
                              }}
                              className={styles.btnSecondary}
                              style={{ height: '34px', fontSize: '0.775rem' }}
                            >
                              Attendance
                            </button>
                            <button
                              onClick={() => handleOpenEditStudentModal(std)}
                              className={styles.btnSecondary}
                              style={{ height: '34px', fontSize: '0.775rem' }}
                            >
                              Edit
                            </button>
                            {entry.kind === 'course' ? (
                              <button
                                onClick={() => handleRemoveStudentCourse(std, entry.course)}
                                className={styles.btnDestructive}
                                style={{ height: '34px', padding: '0 0.6rem' }}
                              >
                                Remove course
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDeleteStudent(std.id, std.name)}
                                className={styles.btnDestructive}
                                style={{ height: '34px', padding: '0 0.6rem' }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB: CLASSES & TEACHER ATTENDANCE (ADMIN ROLE ONLY) */}
          {!isTeacher && activeTab === 'classes' && (
            <div className={styles.classesContainer}>
              {/* FEEDBACK NOTIFICATION TOAST */}
              {classesFeedbackToast && (
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-primary)',
                    padding: '0.65rem 0.9rem',
                    borderRadius: 'var(--radius-btn)',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                  {classesFeedbackToast}
                </div>
              )}

              {/* PAGE HEADER ROW */}
              <div className={styles.pageHeaderRow}>
                <div>
                  <h1 className={styles.pageTitle}>
                    Teacher Classes &amp; Attendance Logs
                  </h1>
                  <div className={styles.pageMetaBadge}>
                    <span>
                      {hasActiveClassesFilter ? (
                        <>Showing <strong>{filteredClassesRecords.length}</strong> of {allAttendanceRecords.length} sessions (Filtered)</>
                      ) : (
                        <>{allAttendanceRecords.length} total sessions logged</>
                      )}
                    </span>
                    <span>•</span>
                    <span>Ashu ({filteredAshuRecords.length})</span>
                    <span>•</span>
                    <span>Vaibhav ({filteredVaibhavRecords.length})</span>
                    <span>•</span>
                    <span>Vrishan ({filteredVrishanRecords.length})</span>
                    <span>•</span>
                    <span>Abhinav ({filteredAbhinavRecords.length})</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleSyncClassesData}
                    disabled={isClassesSyncing}
                    className={styles.btnSecondary}
                    style={{ fontSize: '0.8rem', height: '34px', gap: '0.4rem' }}
                    title="Refresh and sync attendance data from MongoDB"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ animation: isClassesSyncing ? 'spin 1s linear infinite' : 'none' }}
                    >
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    {isClassesSyncing ? 'Syncing...' : 'Sync'}
                  </button>

                  <button
                    type="button"
                    onClick={handleExportClassesCSV}
                    className={styles.btnSecondary}
                    style={{ fontSize: '0.8rem', height: '34px', gap: '0.4rem' }}
                    title="Download class logs in CSV format"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export CSV
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintClassesLedger}
                    className={styles.btnPrimary}
                    style={{ fontSize: '0.8rem', height: '34px', gap: '0.4rem' }}
                    title="Print formatted class attendance ledger"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    Print
                  </button>
                </div>
              </div>

              {/* RESTRAINED SUMMARY STATS STRIP */}
              <div className={styles.summaryStatsStrip}>
                {isTeacher ? (
                  /* Single Focused Teacher Block for Teacher Role */
                  <div className={styles.summaryStatBlock} style={{ flex: '1 1 100%', maxWidth: '100%' }}>
                    <div className={styles.summaryStatHeader}>
                      <span className={styles.summaryStatTitle}>My Marked Classes ({currentUser?.name || 'Teacher'})</span>
                      <span className={styles.filterPill} style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem', background: 'var(--bg-hover)' }}>
                        {currentUser?.email}
                      </span>
                    </div>
                    <div className={styles.summaryStatCount}>{contextFilteredRecords.length}</div>
                    <div className={styles.summaryStatMeta}>
                      <span className={styles.summaryStatMetaItem}>
                        Present: <span className={styles.summaryStatMetaNum}>{contextFilteredRecords.filter(r => r.status === 'PRESENT').length}</span>
                      </span>
                      <span>•</span>
                      <span className={styles.summaryStatMetaItem}>
                        Absent: <span className={styles.summaryStatMetaNum}>{contextFilteredRecords.filter(r => r.status === 'ABSENT').length}</span>
                      </span>
                      <span>•</span>
                      <span className={styles.summaryStatMetaItem}>
                        Group Sessions: <span className={styles.summaryStatMetaNum}>{new Set(contextFilteredRecords.filter(r => r.status === 'GROUP_SESSION').map(r => `${r.date}_${r.timeSlot}`)).size} ({contextFilteredRecords.filter(r => r.status === 'GROUP_SESSION').length} st)</span>
                      </span>
                      <span>•</span>
                      <span className={styles.summaryStatMetaItem}>
                        Students: <span className={styles.summaryStatMetaNum}>{new Set(contextFilteredRecords.map(r => r.studentId)).size}</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Admin multi-teacher overview */
                  <>
                    {/* Ashu Block */}
                    <div
                      className={styles.summaryStatBlock}
                      style={{
                        border: classesTeacherFilter === 'ashu' ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                        background: classesTeacherFilter === 'ashu' ? 'var(--bg-hover)' : 'var(--bg-surface)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div className={styles.summaryStatHeader}>
                        <span className={styles.summaryStatTitle}>Teacher Ashu</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = classesTeacherFilter === 'ashu' ? 'ALL' : 'ashu';
                            setClassesTeacherFilter(next);
                          }}
                          className={`${styles.filterPill} ${classesTeacherFilter === 'ashu' ? styles.filterPillActive : ''}`}
                          style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem' }}
                        >
                          {classesTeacherFilter === 'ashu' ? 'Active' : 'Filter'}
                        </button>
                      </div>
                      <div className={styles.summaryStatCount}>{ashuAnalytics.total}</div>
                      <div className={styles.summaryStatMeta}>
                        <span className={styles.summaryStatMetaItem}>
                          Present: <span className={styles.summaryStatMetaNum}>{ashuAnalytics.present}</span>
                        </span>
                        <span>•</span>
                        <span className={styles.summaryStatMetaItem}>
                          Group: <span className={styles.summaryStatMetaNum}>{ashuAnalytics.groupSessionsCount}{ashuAnalytics.group > 0 ? ` (${ashuAnalytics.group} st)` : ''}</span>
                        </span>
                        <span>•</span>
                        <span className={styles.summaryStatMetaItem}>
                          Students: <span className={styles.summaryStatMetaNum}>{ashuAnalytics.uniqueStudentCount}</span>
                        </span>
                        <span>•</span>
                        <span className={styles.summaryStatMetaItem}>
                          Rate: <span className={styles.summaryStatMetaNum}>{ashuAnalytics.presentRate}%</span>
                        </span>
                      </div>
                    </div>

                    {/* Vaibhav Block */}
                    <div
                      className={styles.summaryStatBlock}
                      style={{
                        border: classesTeacherFilter === 'vaibhav' ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                        background: classesTeacherFilter === 'vaibhav' ? 'var(--bg-hover)' : 'var(--bg-surface)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div className={styles.summaryStatHeader}>
                        <span className={styles.summaryStatTitle}>Teacher Vaibhav</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = classesTeacherFilter === 'vaibhav' ? 'ALL' : 'vaibhav';
                            setClassesTeacherFilter(next);
                          }}
                          className={`${styles.filterPill} ${classesTeacherFilter === 'vaibhav' ? styles.filterPillActive : ''}`}
                          style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem' }}
                        >
                          {classesTeacherFilter === 'vaibhav' ? 'Active' : 'Filter'}
                        </button>
                      </div>
                      <div className={styles.summaryStatCount}>{vaibhavAnalytics.total}</div>
                      <div className={styles.summaryStatMeta}>
                        <span className={styles.summaryStatMetaItem}>
                          Present: <span className={styles.summaryStatMetaNum}>{vaibhavAnalytics.present}</span>
                        </span>
                        <span>•</span>
                        <span className={styles.summaryStatMetaItem}>
                          Group: <span className={styles.summaryStatMetaNum}>{vaibhavAnalytics.groupSessionsCount}{vaibhavAnalytics.group > 0 ? ` (${vaibhavAnalytics.group} st)` : ''}</span>
                        </span>
                        <span>•</span>
                        <span className={styles.summaryStatMetaItem}>
                          Students: <span className={styles.summaryStatMetaNum}>{vaibhavAnalytics.uniqueStudentCount}</span>
                        </span>
                        <span>•</span>
                        <span className={styles.summaryStatMetaItem}>
                          Rate: <span className={styles.summaryStatMetaNum}>{vaibhavAnalytics.presentRate}%</span>
                        </span>
                      </div>
                    </div>

                    {/* Vrishan Block */}
                    <div
                      className={styles.summaryStatBlock}
                      style={{
                        border: classesTeacherFilter === 'vrishan' ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                        background: classesTeacherFilter === 'vrishan' ? 'var(--bg-hover)' : 'var(--bg-surface)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div className={styles.summaryStatHeader}>
                        <span className={styles.summaryStatTitle}>Teacher Vrishan</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = classesTeacherFilter === 'vrishan' ? 'ALL' : 'vrishan';
                            setClassesTeacherFilter(next);
                          }}
                          className={`${styles.filterPill} ${classesTeacherFilter === 'vrishan' ? styles.filterPillActive : ''}`}
                          style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem' }}
                        >
                          {classesTeacherFilter === 'vrishan' ? 'Active' : 'Filter'}
                        </button>
                      </div>
                      <div className={styles.summaryStatCount}>{vrishanAnalytics.total}</div>
                      <div className={styles.summaryStatMeta}>
                        <span className={styles.summaryStatMetaItem}>
                          Present: <span className={styles.summaryStatMetaNum}>{vrishanAnalytics.present}</span>
                        </span>
                        <span>•</span>
                        <span className={styles.summaryStatMetaItem}>
                          Group: <span className={styles.summaryStatMetaNum}>{vrishanAnalytics.groupSessionsCount}{vrishanAnalytics.group > 0 ? ` (${vrishanAnalytics.group} st)` : ''}</span>
                        </span>
                        <span>•</span>
                        <span className={styles.summaryStatMetaItem}>
                          Students: <span className={styles.summaryStatMetaNum}>{vrishanAnalytics.uniqueStudentCount}</span>
                        </span>
                        <span>•</span>
                        <span className={styles.summaryStatMetaItem}>
                          Rate: <span className={styles.summaryStatMetaNum}>{vrishanAnalytics.presentRate}%</span>
                        </span>
                      </div>
                    </div>

                    {/* Abhinav Block */}
                    <div
                      className={styles.summaryStatBlock}
                      style={{
                        border: classesTeacherFilter === 'abhinav' ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                        background: classesTeacherFilter === 'abhinav' ? 'var(--bg-hover)' : 'var(--bg-surface)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div className={styles.summaryStatHeader}>
                        <span className={styles.summaryStatTitle}>Abhinav</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = classesTeacherFilter === 'abhinav' ? 'ALL' : 'abhinav';
                            setClassesTeacherFilter(next);
                          }}
                          className={`${styles.filterPill} ${classesTeacherFilter === 'abhinav' ? styles.filterPillActive : ''}`}
                          style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem' }}
                        >
                          {classesTeacherFilter === 'abhinav' ? 'Active' : 'Filter'}
                        </button>
                      </div>
                      <div className={styles.summaryStatCount}>{abhinavAnalytics.total}</div>
                      <div className={styles.summaryStatMeta}>
                        <span className={styles.summaryStatMetaItem}>
                          Present: <span className={styles.summaryStatMetaNum}>{abhinavAnalytics.present}</span>
                        </span>
                        <span>•</span>
                        <span className={styles.summaryStatMetaItem}>
                          Group: <span className={styles.summaryStatMetaNum}>{abhinavAnalytics.groupSessionsCount}{abhinavAnalytics.group > 0 ? ` (${abhinavAnalytics.group} st)` : ''}</span>
                        </span>
                        <span>•</span>
                        <span className={styles.summaryStatMetaItem}>
                          Students: <span className={styles.summaryStatMetaNum}>{abhinavAnalytics.uniqueStudentCount}</span>
                        </span>
                        <span>•</span>
                        <span className={styles.summaryStatMetaItem}>
                          Rate: <span className={styles.summaryStatMetaNum}>{abhinavAnalytics.presentRate}%</span>
                        </span>
                      </div>
                    </div>

                    {/* Studio Total Block */}
                    <div
                      className={styles.summaryStatBlock}
                      style={{
                        border: hasActiveClassesFilter ? '1px solid #38bdf8' : '1px solid var(--border-subtle)',
                        background: hasActiveClassesFilter ? 'var(--bg-hover)' : 'var(--bg-surface)',
                      }}
                    >
                      <div className={styles.summaryStatHeader}>
                        <span className={styles.summaryStatTitle}>
                          {classesTeacherFilter !== 'ALL'
                            ? `${classesTeacherFilter.toUpperCase()} Active`
                            : hasActiveClassesFilter
                            ? 'Filtered Total'
                            : 'Studio Total'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setClassesTeacherFilter('ALL');
                            setClassesStatusFilter('ALL');
                            setClassesDatePreset('ALL');
                            setClassesCustomDate('');
                            setClassesCourseFilter('ALL');
                            setClassesSearch('');
                          }}
                          className={styles.filterPill}
                          style={{ padding: '0.15rem 0.5rem', fontSize: '0.72rem' }}
                        >
                          Reset
                        </button>
                      </div>
                      <div className={styles.summaryStatCount}>
                        {classesTeacherFilter !== 'ALL'
                          ? (classesTeacherFilter === 'ashu' ? filteredAshuRecords.length : classesTeacherFilter === 'vaibhav' ? filteredVaibhavRecords.length : classesTeacherFilter === 'vrishan' ? filteredVrishanRecords.length : filteredAbhinavRecords.length)
                          : contextFilteredRecords.length}
                      </div>
                      <div className={styles.summaryStatMeta}>
                        <span className={styles.summaryStatMetaItem}>
                          Present:{' '}
                          <span className={styles.summaryStatMetaNum}>
                            {(classesTeacherFilter !== 'ALL'
                              ? (classesTeacherFilter === 'ashu' ? filteredAshuRecords : classesTeacherFilter === 'vaibhav' ? filteredVaibhavRecords : classesTeacherFilter === 'vrishan' ? filteredVrishanRecords : filteredAbhinavRecords)
                              : contextFilteredRecords
                            ).filter(r => r.status === 'PRESENT').length}
                          </span>
                        </span>
                        <span>•</span>
                        <span className={styles.summaryStatMetaItem}>
                          Absent:{' '}
                          <span className={styles.summaryStatMetaNum}>
                            {(classesTeacherFilter !== 'ALL'
                              ? (classesTeacherFilter === 'ashu' ? filteredAshuRecords : classesTeacherFilter === 'vaibhav' ? filteredVaibhavRecords : classesTeacherFilter === 'vrishan' ? filteredVrishanRecords : filteredAbhinavRecords)
                              : contextFilteredRecords
                            ).filter(r => r.status === 'ABSENT').length}
                          </span>
                        </span>
                        <span>•</span>
                        <span className={styles.summaryStatMetaItem}>
                          Group:{' '}
                          <span className={styles.summaryStatMetaNum}>
                            {new Set((classesTeacherFilter !== 'ALL'
                              ? (classesTeacherFilter === 'ashu' ? filteredAshuRecords : classesTeacherFilter === 'vaibhav' ? filteredVaibhavRecords : classesTeacherFilter === 'vrishan' ? filteredVrishanRecords : filteredAbhinavRecords)
                              : contextFilteredRecords
                            ).filter(r => r.status === 'GROUP_SESSION').map(r => `${r.date}_${r.timeSlot}`)).size}{' '}
                            ({(classesTeacherFilter !== 'ALL'
                              ? (classesTeacherFilter === 'ashu' ? filteredAshuRecords : classesTeacherFilter === 'vaibhav' ? filteredVaibhavRecords : classesTeacherFilter === 'vrishan' ? filteredVrishanRecords : filteredAbhinavRecords)
                              : contextFilteredRecords
                            ).filter(r => r.status === 'GROUP_SESSION').length} st)
                          </span>
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* UNIFIED FILTER TOOLBAR */}
              <div className={styles.filterBar}>
                <div className={styles.searchBox}>
                  <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search logs…"
                    value={classesSearch}
                    onChange={(e) => setClassesSearch(e.target.value)}
                    className={styles.searchInput}
                  />
                  {classesSearch && (
                    <button
                      onClick={() => setClassesSearch('')}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* TEACHER TOGGLES (Admin only) */}
                {!isTeacher && (
                  <div className={styles.filterPillGroup}>
                    <button
                      type="button"
                      onClick={() => setClassesTeacherFilter('ALL')}
                      className={`${styles.filterPill} ${classesTeacherFilter === 'ALL' ? styles.filterPillActive : ''}`}
                    >
                      All ({contextFilteredRecords.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassesTeacherFilter(classesTeacherFilter === 'ashu' ? 'ALL' : 'ashu')}
                      className={`${styles.filterPill} ${classesTeacherFilter === 'ashu' ? styles.filterPillActive : ''}`}
                    >
                      Ashu ({filteredAshuRecords.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassesTeacherFilter(classesTeacherFilter === 'vaibhav' ? 'ALL' : 'vaibhav')}
                      className={`${styles.filterPill} ${classesTeacherFilter === 'vaibhav' ? styles.filterPillActive : ''}`}
                    >
                      Vaibhav ({filteredVaibhavRecords.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassesTeacherFilter(classesTeacherFilter === 'vrishan' ? 'ALL' : 'vrishan')}
                      className={`${styles.filterPill} ${classesTeacherFilter === 'vrishan' ? styles.filterPillActive : ''}`}
                    >
                      Vrishan ({filteredVrishanRecords.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setClassesTeacherFilter(classesTeacherFilter === 'abhinav' ? 'ALL' : 'abhinav')}
                      className={`${styles.filterPill} ${classesTeacherFilter === 'abhinav' ? styles.filterPillActive : ''}`}
                    >
                      Abhinav ({filteredAbhinavRecords.length})
                    </button>
                  </div>
                )}

                {/* FILTER SELECTS GROUP */}
                <div className={styles.filterSelectGroup}>
                  {/* STATUS FILTER */}
                  <select
                    value={classesStatusFilter}
                    onChange={(e) => setClassesStatusFilter(e.target.value)}
                    className={styles.filterSelect}
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PRESENT">Present</option>
                    <option value="ABSENT">Absent</option>
                    <option value="PRACTICE_SESSION">Practice</option>
                    <option value="GROUP_SESSION">Group</option>
                    <option value="NA">NA</option>
                  </select>

                  {/* DATE PRESET */}
                  <select
                    value={classesDatePreset}
                    onChange={(e) => setClassesDatePreset(e.target.value as typeof classesDatePreset)}
                    className={styles.filterSelect}
                  >
                    <option value="ALL">All Dates</option>
                    <option value="TODAY">Today</option>
                    <option value="YESTERDAY">Yesterday</option>
                    <option value="THIS_WEEK">This Week</option>
                    <option value="THIS_MONTH">This Month</option>
                    <option value="CUSTOM">Custom Date</option>
                  </select>

                  {classesDatePreset === 'CUSTOM' && (
                    <input
                      type="date"
                      value={classesCustomDate}
                      onChange={(e) => setClassesCustomDate(e.target.value)}
                      className={styles.filterSelect}
                    />
                  )}

                  {/* COURSE FILTER */}
                  {distinctCourses.length > 0 && (
                    <select
                      value={classesCourseFilter}
                      onChange={(e) => setClassesCourseFilter(e.target.value)}
                      className={styles.filterSelect}
                    >
                      <option value="ALL">All Courses</option>
                      {distinctCourses.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )}

                  {/* CLEAR FILTERS */}
                  {hasActiveClassesFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setClassesTeacherFilter('ALL');
                        setClassesStatusFilter('ALL');
                        setClassesDatePreset('ALL');
                        setClassesCustomDate('');
                        setClassesCourseFilter('ALL');
                        setClassesSearch('');
                      }}
                      className={styles.btnSecondary}
                      style={{ fontSize: '0.75rem', height: '32px' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* DYNAMIC RESULTS COUNTER STRIP */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.65rem 0 0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Showing <strong style={{ color: 'var(--text-primary)' }}>{filteredClassesRecords.length}</strong> class {filteredClassesRecords.length === 1 ? 'session' : 'sessions'}
                  {hasActiveClassesFilter && (
                    <span style={{ marginLeft: '0.4rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      (filtered from {allClassesLogEntries.length} total sessions)
                    </span>
                  )}
                </div>
                {hasActiveClassesFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setClassesTeacherFilter('ALL');
                      setClassesStatusFilter('ALL');
                      setClassesDatePreset('ALL');
                      setClassesCustomDate('');
                      setClassesCourseFilter('ALL');
                      setClassesSearch('');
                    }}
                    className={styles.filterPill}
                    style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}
                  >
                    Reset filters
                  </button>
                )}
              </div>

              {/* DATA TABLE */}
              {filteredClassesRecords.length === 0 ? (
                <div className={styles.emptyStateCard} style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                  <div className={styles.emptyStateTitle} style={{ fontSize: '1rem', fontWeight: 600 }}>
                    No class records found
                  </div>
                  <div className={styles.emptyStateDesc} style={{ maxWidth: '340px', margin: '0.35rem auto 1rem', fontSize: '0.8rem' }}>
                    Adjust filters to view attendance logs marked by teachers.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setClassesTeacherFilter('ALL');
                      setClassesStatusFilter('ALL');
                      setClassesDatePreset('ALL');
                      setClassesCourseFilter('ALL');
                      setClassesSearch('');
                    }}
                    className={styles.btnPrimary}
                    style={{ height: '34px', fontSize: '0.8rem' }}
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.desktopTableContainer}>
                    <div className={styles.classesTableCard}>
                      <table className={styles.classesTable}>
                        <thead>
                          <tr>
                            <th className={styles.colStudent}>Student</th>
                            <th className={styles.colCourse}>Course</th>
                            <th className={styles.colSchedule}>Date &amp; Slot</th>
                            <th className={styles.colTeacher}>Teacher</th>
                            <th className={styles.colStatus}>Status</th>
                            <th className={styles.colNotes}>Notes</th>
                            <th className={styles.colLoggedAt}>Logged At</th>
                            <th className={styles.colActions}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredClassesRecords.map((rec) => {
                            const isGroup = rec.type === 'GROUP';
                            const isAshu = (rec.markedByName || '').toLowerCase().includes('ashu') || (rec.markedBy || '').toLowerCase().includes('ashu');
                            const isVaibhav = (rec.markedByName || '').toLowerCase().includes('vaibhav') || (rec.markedBy || '').toLowerCase().includes('vaibhav');
                            const isVrishan = (rec.markedByName || '').toLowerCase().includes('vrishan') || (rec.markedBy || '').toLowerCase().includes('vrishan');
                            const teacherName = isAshu ? 'Ashu' : isVaibhav ? 'Vaibhav' : isVrishan ? 'Vrishan' : (rec.markedByName || 'Staff');

                            return (
                              <tr key={rec.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedRecordForInspection(rec)}>
                                <td className={styles.colStudent}>
                                  {isGroup ? (
                                    <div>
                                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                                        Group Session ({rec.students.length} Students)
                                      </div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.35rem' }}>
                                        {rec.students.map((st) => (
                                          <span
                                            key={st.id}
                                            style={{
                                              fontSize: '0.72rem',
                                              background: 'var(--bg-surface)',
                                              color: 'var(--text-primary)',
                                              border: '1px solid var(--border-subtle)',
                                              padding: '1px 6px',
                                              borderRadius: '4px',
                                              fontWeight: 500,
                                            }}
                                          >
                                            {st.name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                                        {rec.student?.name || 'Student ' + rec.studentId}
                                      </div>
                                      <div className={styles.monoCell} style={{ fontSize: '0.72rem' }}>
                                        {rec.student?.phone || rec.studentId}
                                      </div>
                                    </>
                                  )}
                                </td>

                                <td className={styles.colCourse}>
                                  {isGroup ? (
                                    <>
                                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                        {Array.from(new Set(rec.students.map((s) => s.course).filter(Boolean))).join(', ') || 'Group Masterclass'}
                                      </div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        Group Session
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                        {rec.student?.course || 'N/A'}
                                      </div>
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {rec.student?.batch || 'Regular'}
                                      </div>
                                    </>
                                  )}
                                </td>

                                <td className={styles.colSchedule}>
                                  <div className={styles.monoCellStrong}>
                                    {rec.date}
                                  </div>
                                  <div className={styles.monoCell} style={{ fontSize: '0.72rem' }}>
                                    {rec.timeSlot}
                                  </div>
                                </td>

                                <td className={styles.colTeacher}>
                                  <div className={styles.teacherTag}>
                                    {teacherName}
                                  </div>
                                  <div className={styles.teacherTagSub}>
                                    {rec.markedBy}
                                  </div>
                                </td>

                                <td className={styles.colStatus}>
                                  {isGroup ? (
                                    <span className={`${styles.statusTag} ${styles.statusNeutral}`}>
                                      Group ({rec.students.length})
                                    </span>
                                  ) : (
                                    <>
                                      {rec.status === 'PRESENT' && (
                                        <span className={`${styles.statusTag} ${styles.statusPresent}`}>
                                          Present
                                        </span>
                                      )}
                                      {rec.status === 'ABSENT' && (
                                        <span className={`${styles.statusTag} ${styles.statusAbsent}`}>
                                          Absent
                                        </span>
                                      )}
                                      {rec.status === 'PRACTICE_SESSION' && (
                                        <span className={`${styles.statusTag} ${styles.statusNeutral}`}>
                                          Practice
                                        </span>
                                      )}
                                      {rec.status === 'NA' && (
                                        <span className={`${styles.statusTag} ${styles.statusNeutral}`}>
                                          NA
                                        </span>
                                      )}
                                    </>
                                  )}
                                </td>

                                <td className={styles.colNotes}>
                                  <div style={{ fontSize: '0.78rem', color: rec.comment ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                    {rec.comment || 'N/A'}
                                  </div>
                                </td>

                                <td className={styles.colLoggedAt}>
                                  <div className={styles.monoCell} style={{ fontSize: '0.72rem' }}>
                                    {rec.updatedAt ? new Date(rec.updatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'}
                                  </div>
                                </td>

                                <td className={styles.colActions}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }} onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedRecordForInspection(rec)}
                                      className={styles.btnSecondary}
                                      style={{ height: '26px', fontSize: '0.72rem', padding: '0 0.5rem' }}
                                    >
                                      Inspect
                                    </button>
                                    {!isGroup && rec.studentId ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedStudentId(rec.records?.[0] ? keyForRecord(rec.records[0]) : rec.studentId!);
                                          setActiveTab('attendance');
                                        }}
                                        className={styles.btnSecondary}
                                        style={{ height: '26px', fontSize: '0.72rem', padding: '0 0.5rem' }}
                                      >
                                        Sheet
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedStudentId(null);
                                          setGroupSessionDate(rec.date);
                                          setAttendanceSubTab('group');
                                          setActiveTab('attendance');
                                        }}
                                        className={styles.btnSecondary}
                                        style={{ height: '26px', fontSize: '0.72rem', padding: '0 0.5rem' }}
                                      >
                                        Batch
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* MOBILE CARDS LIST VIEW */}
                  <div className={styles.mobileCardList}>
                    {filteredClassesRecords.map((rec) => {
                      const isGroup = rec.type === 'GROUP';
                      const isAshu = (rec.markedByName || '').toLowerCase().includes('ashu') || (rec.markedBy || '').toLowerCase().includes('ashu');
                      const isVaibhav = (rec.markedByName || '').toLowerCase().includes('vaibhav') || (rec.markedBy || '').toLowerCase().includes('vaibhav');
                      const isVrishan = (rec.markedByName || '').toLowerCase().includes('vrishan') || (rec.markedBy || '').toLowerCase().includes('vrishan');
                      const teacherName = isAshu ? 'Ashu' : isVaibhav ? 'Vaibhav' : isVrishan ? 'Vrishan' : (rec.markedByName || 'Abhinav');

                      return (
                        <div key={rec.id} className={styles.mobileDataCard} onClick={() => setSelectedRecordForInspection(rec)}>
                          <div className={styles.mobileCardHeader}>
                            <div className={styles.mobileCardTitleBox}>
                              <div className={styles.mobileCardTitle}>
                                {isGroup ? `Group Session (${rec.students.length} Students)` : (rec.student?.name || 'Student ' + rec.studentId)}
                              </div>
                              <div className={styles.mobileCardSubText}>
                                {isGroup ? (Array.from(new Set(rec.students.map((s) => s.course).filter(Boolean))).join(', ') || 'Group Masterclass') : `${rec.student?.course || 'Enrolled Student'} ${rec.student?.batch ? `• ${rec.student.batch}` : ''}`}
                              </div>
                            </div>
                            <div>
                              {isGroup ? (
                                <span className={`${styles.statusTag} ${styles.statusNeutral}`}>Group ({rec.students.length})</span>
                              ) : (
                                <>
                                  {rec.status === 'PRESENT' && <span className={`${styles.statusTag} ${styles.statusPresent}`}>Present</span>}
                                  {rec.status === 'ABSENT' && <span className={`${styles.statusTag} ${styles.statusAbsent}`}>Absent</span>}
                                  {rec.status === 'PRACTICE_SESSION' && <span className={`${styles.statusTag} ${styles.statusNeutral}`}>Practice</span>}
                                  {rec.status === 'NA' && <span className={`${styles.statusTag} ${styles.statusNeutral}`}>NA</span>}
                                </>
                              )}
                            </div>
                          </div>

                          <div className={styles.mobileCardBody}>
                            {isGroup && (
                              <div style={{ marginBottom: '0.35rem' }}>
                                <span className={styles.mobileCardLabel} style={{ display: 'block', marginBottom: '0.25rem' }}>Students:</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                  {rec.students.map((st) => (
                                    <span key={st.id} style={{ fontSize: '0.72rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '1px 5px', borderRadius: '4px', color: 'var(--text-primary)' }}>
                                      {st.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className={styles.mobileCardRow}>
                              <span className={styles.mobileCardLabel}>Date &amp; Slot</span>
                              <span className={styles.monoCellStrong}>
                                {rec.date} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({rec.timeSlot})</span>
                              </span>
                            </div>
                            <div className={styles.mobileCardRow}>
                              <span className={styles.mobileCardLabel}>Teacher</span>
                              <span className={styles.mobileCardValue}>{teacherName}</span>
                            </div>
                            {rec.comment && (
                              <div className={styles.mobileCardRow} style={{ alignItems: 'flex-start' }}>
                                <span className={styles.mobileCardLabel}>Notes</span>
                                <span className={styles.mobileCardValue} style={{ maxWidth: '65%' }}>{rec.comment}</span>
                              </div>
                            )}
                          </div>

                          <div className={styles.mobileCardActions} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedRecordForInspection(rec)}
                              className={styles.btnSecondary}
                              style={{ height: '28px', fontSize: '0.72rem', padding: '0 0.6rem' }}
                            >
                              Inspect
                            </button>
                            {!isGroup && rec.studentId ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStudentId(rec.records?.[0] ? keyForRecord(rec.records[0]) : rec.studentId!);
                                  setActiveTab('attendance');
                                }}
                                className={styles.btnSecondary}
                                style={{ height: '28px', fontSize: '0.72rem', padding: '0 0.6rem' }}
                              >
                                Sheet
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedStudentId(null);
                                  setGroupSessionDate(rec.date);
                                  setAttendanceSubTab('group');
                                  setActiveTab('attendance');
                                }}
                                className={styles.btnSecondary}
                                style={{ height: '28px', fontSize: '0.72rem', padding: '0 0.6rem' }}
                              >
                                Batch
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: STUDENT ATTENDANCE FEATURE */}
          {activeTab === 'attendance' && (
            <div>
              {/* SUCCESS NOTIFICATION BANNER */}
              {groupSessionSuccessBanner && (
                <div style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text-primary)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  {groupSessionSuccessBanner}
                </div>
              )}

              {/* SUB-TAB NAVIGATION SWITCHER */}
              {!selectedStudentId && (
                <div className={styles.attendanceSubTabNav}>
                  <div className={styles.attendanceSubTabBtns}>
                    <button
                      type="button"
                      onClick={() => setAttendanceSubTab('roster')}
                      className={`${styles.attendanceSubTabBtn} ${attendanceSubTab === 'roster' ? styles.attendanceSubTabBtnActive : ''}`}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Individual Students ({students.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setAttendanceSubTab('group')}
                      className={`${styles.attendanceSubTabBtn} ${attendanceSubTab === 'group' ? styles.attendanceSubTabBtnGroup : ''}`}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      Group Sessions ({groupSessionsList.length})
                    </button>
                  </div>

                  {attendanceSubTab === 'group' && (
                    <button
                      onClick={() => handleOpenGroupAttendanceModal()}
                      className={styles.btnPrimary}
                      style={{ gap: '0.45rem', fontWeight: 600, fontSize: '0.8rem' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      Mark Group Session
                    </button>
                  )}
                </div>
              )}

              {/* VIEW CONDITIONAL: GROUP TAB VS ROSTER VS STUDENT CALENDAR */}
              {attendanceSubTab === 'group' && !selectedStudentId ? (
                /* VIEW C: GROUP SESSIONS LOG & MANAGEMENT TAB */
                <div>
                  <div className={styles.pageHeaderRow} style={{ marginBottom: '1rem' }}>
                    <div>
                      <h1 className={styles.pageTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Group Sessions
                      </h1>
                      <div className={styles.pageMetaBadge}>
                        <span>{groupSessionsList.length} total group sessions recorded</span>
                        <span>•</span>
                        <span>Soundabode Studio Batches</span>
                      </div>
                    </div>
                  </div>

                  {/* GROUP SESSION STATS KPIS */}
                  <div className={styles.kpiGridGroup}>
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabelRow}>Total Sessions</div>
                      <div className={styles.kpiValue}>{groupSessionsList.length}</div>
                      <div className={styles.kpiSubText}>Recorded batch sessions</div>
                    </div>

                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabelRow}>Total Attendees</div>
                      <div className={styles.kpiValue}>{totalGroupAttendeesCount}</div>
                      <div className={styles.kpiSubText}>Combined student attendances</div>
                    </div>

                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabelRow}>Avg Attendees/Session</div>
                      <div className={styles.kpiValue}>{avgGroupAttendeesCount}</div>
                      <div className={styles.kpiSubText}>Students per group session</div>
                    </div>

                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabelRow}>Latest Session</div>
                      <div className={styles.kpiValue} style={{ fontSize: '1.2rem' }}>
                        {latestGroupSessionFormatted}
                      </div>
                      <div className={styles.kpiSubText}>
                        {groupSessionsList.length > 0 ? groupSessionsList[0].timeSlot : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* SEARCH BAR FOR GROUP SESSIONS */}
                  <div className={styles.filterBar} style={{ marginBottom: '1.25rem' }}>
                    <div className={styles.searchBox} style={{ width: '100%', maxWidth: '380px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search by student name, date, or topics..."
                        value={groupTabSearchQuery}
                        onChange={(e) => setGroupTabSearchQuery(e.target.value)}
                        className={styles.searchInput}
                      />
                    </div>
                  </div>

                  {/* GROUP SESSIONS TABLE */}
                  {filteredGroupSessionsList.length === 0 ? (
                    <div className={styles.tableCard} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                        No Group Sessions Found
                      </div>
                      <div style={{ fontSize: '0.8rem' }}>
                        {groupTabSearchQuery ? 'No group sessions match your search query.' : 'Click "Mark Group Session" above to record your first group session.'}
                      </div>
                    </div>
                  ) : (
                    <>
                    <div className={styles.desktopTableContainer}>
                      <div className={styles.tableCard}>
                        <table className={styles.dataTable}>
                          <thead>
                            <tr>
                              <th>Date &amp; Time Slot</th>
                              <th>Attendees</th>
                              <th>Attending Students</th>
                              <th>Marked By</th>
                              <th>Session Comments</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredGroupSessionsList.map((gs: (typeof groupSessionsList)[0]) => {
                              const dateInfo = formatGroupDateBadge(gs.date);

                              return (
                                <tr key={gs.id}>
                                  <td>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                                      {dateInfo.formatted}
                                    </div>
                                    <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                      {gs.timeSlot}
                                    </div>
                                  </td>
                                  <td>
                                    <span style={{
                                      background: 'var(--bg-surface)',
                                      color: 'var(--text-secondary)',
                                      border: '1px solid var(--border-medium)',
                                      padding: '3px 10px',
                                      borderRadius: '12px',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                    }}>
                                      {gs.studentIds.length} Student{gs.studentIds.length === 1 ? '' : 's'}
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '340px' }}>
                                      {gs.students.map((s: EnrolledStudent) => (
                                        <span
                                          key={s.id}
                                          onClick={() => handleOpenStudentCalendar(s.id)}
                                          style={{
                                            fontSize: '0.725rem',
                                            background: 'var(--bg-surface)',
                                            color: 'var(--text-primary)',
                                            border: '1px solid var(--border-subtle)',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                          }}
                                          title={`Click to view ${s.name}'s calendar`}
                                        >
                                          {s.name}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                      {gs.markedByName || gs.markedBy || 'Staff'}
                                    </div>
                                  </td>
                                  <td>
                                    <div
                                      style={{
                                        fontSize: '0.78rem',
                                        color: gs.comment ? 'var(--text-secondary)' : 'var(--text-muted)',
                                        maxWidth: '280px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}
                                      title={gs.comment || ''}
                                    >
                                      {gs.comment || 'N/A'}
                                    </div>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleEditGroupSession(gs)}
                                        className={styles.btnSecondary}
                                        style={{ height: '28px', fontSize: '0.75rem', padding: '0 0.6rem' }}
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteGroupSession(gs.date, gs.timeSlot)}
                                        className={styles.btnDestructive}
                                        style={{ height: '28px', fontSize: '0.75rem', padding: '0 0.6rem' }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* GROUP SESSIONS MOBILE CARD LIST */}
                    <div className={styles.mobileCardList}>
                      {filteredGroupSessionsList.map((gs: (typeof groupSessionsList)[0]) => {
                        const dateInfo = formatGroupDateBadge(gs.date);

                        return (
                          <div key={gs.id} className={styles.mobileDataCard}>
                            <div className={styles.mobileCardHeader}>
                              <div className={styles.mobileCardTitleBox}>
                                <div>
                                  <div className={styles.mobileCardTitle}>{dateInfo.formatted}</div>
                                  <div className={styles.mobileCardSubText}>{gs.timeSlot}</div>
                                </div>
                              </div>
                              <span className={styles.badge} style={{ fontSize: '0.7rem' }}>
                                {gs.studentIds.length} Student{gs.studentIds.length === 1 ? '' : 's'}
                              </span>
                            </div>

                            <div className={styles.mobileCardBody}>
                              <div className={styles.mobileCardRow}>
                                <span className={styles.mobileCardLabel}>Marked By</span>
                                <span className={styles.mobileCardValue}>{gs.markedByName || gs.markedBy || 'Staff'}</span>
                              </div>
                              {gs.comment && (
                                <div className={styles.mobileCardRow}>
                                  <span className={styles.mobileCardLabel}>Comments</span>
                                  <span className={styles.mobileCardValue} style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {gs.comment}
                                  </span>
                                </div>
                              )}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '0.25rem' }}>
                                {gs.students.map((s: EnrolledStudent) => (
                                  <span
                                    key={s.id}
                                    onClick={() => handleOpenStudentCalendar(s.id)}
                                    style={{
                                      fontSize: '0.7rem',
                                      background: 'var(--bg-surface)',
                                      color: 'var(--text-primary)',
                                      border: '1px solid var(--border-subtle)',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      fontWeight: 500,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {s.name}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className={styles.mobileCardActions}>
                              <button
                                type="button"
                                onClick={() => handleEditGroupSession(gs)}
                                className={styles.btnSecondary}
                                style={{ height: '32px', fontSize: '0.75rem', flex: 1 }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteGroupSession(gs.date, gs.timeSlot)}
                                className={styles.btnDestructive}
                                style={{ height: '32px', fontSize: '0.75rem', flex: 1 }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    </>
                  )}
                </div>
              ) : !selectedStudentId ? (
                /* VIEW A: ENROLLED STUDENTS ROSTER */
                <div>
                  <div className={styles.pageHeaderRow}>
                    <div>
                      <h1 className={styles.pageTitle}>Attendance</h1>
                      <div className={styles.pageMetaBadge}>
                        <span>{students.length} enrolled students</span>
                        {attendanceEntries.length !== students.length && (
                          <>
                            <span>•</span>
                            <span>{attendanceEntries.length} course entries</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ROSTER SEARCH */}
                  <div className={styles.filterBar}>
                    <input
                      type="search"
                      placeholder="Search by name, email, phone, course or batch..."
                      value={attendanceSearch}
                      onChange={(e) => setAttendanceSearch(e.target.value)}
                      className={styles.searchInput}
                      aria-label="Search attendance roster"
                    />
                    {attendanceSearch.trim() && (
                      <span className={styles.leadNoteHint}>
                        {visibleAttendanceEntries.length} of {attendanceEntries.length} shown
                      </span>
                    )}
                  </div>

                  {visibleAttendanceEntries.length === 0 && (
                    <div className={styles.tableCard}>
                      <div className={styles.emptyStateCard}>
                        <div className={styles.emptyStateTitle}>No students match "{attendanceSearch.trim()}"</div>
                        <div className={styles.emptyStateDesc}>Try a different name, phone number or course.</div>
                        <button onClick={() => setAttendanceSearch('')} className={styles.btnSecondary} style={{ marginTop: '0.5rem' }}>
                          Clear search
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STUDENTS ROSTER DESKTOP TABLE */}
                  {visibleAttendanceEntries.length > 0 && (
                  <div className={styles.desktopTableContainer}>
                    <div className={styles.tableCard}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Course &amp; Batch</th>
                            <th>Attendance Rate</th>
                            <th>Sessions</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleAttendanceEntries.map((entry) => {
                            const student = entry.student;
                            const avatar = getAvatarDetails(student.name, student.avatarUrl);
                            const studentRecords = AttendanceService.getAttendanceForStudent(entry.key, currentUser || undefined);
                            const attendedCount = studentRecords.filter((r) => r.status !== 'ABSENT').length;
                            const totalCount = studentRecords.length;
                            const pct = totalCount > 0 ? Math.round((attendedCount / totalCount) * 100) : 0;

                            return (
                              <tr key={entry.key}>
                                <td>
                                  <div className={styles.studentCell}>
                                    {avatar.avatarUrl ? (
                                      <img
                                        src={avatar.avatarUrl}
                                        alt={student.name}
                                        style={{ width: '32px', height: '32px', borderRadius: '9999px', objectFit: 'cover' }}
                                      />
                                    ) : (
                                      <div
                                        className={styles.avatarCircle}
                                        style={{ background: avatar.bg, border: `1px solid ${avatar.border}` }}
                                      >
                                        {avatar.initials}
                                      </div>
                                    )}
                                    <div>
                                      <div className={styles.studentName}>{student.name}</div>
                                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{student.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ fontSize: '0.8rem', color: entry.kind === 'unmatched' ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: 500, fontStyle: entry.kind === 'unmatched' ? 'italic' : 'normal' }}>{entry.course}</div>
                                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{entry.kind === 'unmatched' ? 'Older records saved before courses were tracked' : entry.batch}</div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    <div className={styles.progressBarTrack} style={{ width: '90px' }}>
                                      <div
                                        className={styles.progressBarFill}
                                        style={{
                                          width: `${pct}%`,
                                          background: pct >= 80 ? 'var(--success-text)' : pct >= 60 ? 'var(--warning-text)' : 'var(--accent-text)',
                                        }}
                                      />
                                    </div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{pct}%</span>
                                  </div>
                                </td>
                                <td style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                                  {attendedCount} Attended / {totalCount} Sessions
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                    {entry.kind !== 'unmatched' && (
                                    <button
                                      onClick={() => {
                                        handleOpenAttendanceModal(undefined, getTodayDateStr(), entry.key);
                                      }}
                                      className={styles.btnPrimary}
                                      style={{ height: '28px', fontSize: '0.75rem', padding: '0 0.6rem' }}
                                    >
                                      Mark
                                    </button>
                                    )}
                                    <button
                                      onClick={() => handleOpenStudentCalendar(entry.key)}
                                      className={styles.btnSecondary}
                                      style={{ height: '28px', fontSize: '0.75rem', gap: '0.35rem' }}
                                    >
                                      View Calendar
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  )}

                  {/* STUDENTS ROSTER MOBILE CARD LIST */}
                  <div className={styles.mobileCardList}>
                    {visibleAttendanceEntries.map((entry) => {
                      const student = entry.student;
                      const avatar = getAvatarDetails(student.name, student.avatarUrl);
                      const studentRecords = AttendanceService.getAttendanceForStudent(entry.key, currentUser || undefined);
                      const attendedCount = studentRecords.filter((r) => r.status !== 'ABSENT').length;
                      const totalCount = studentRecords.length;
                      const pct = totalCount > 0 ? Math.round((attendedCount / totalCount) * 100) : 0;

                      return (
                        <div key={entry.key} className={styles.mobileDataCard}>
                          <div className={styles.mobileCardHeader}>
                            <div className={styles.mobileCardTitleBox}>
                              {avatar.avatarUrl ? (
                                <img
                                  src={avatar.avatarUrl}
                                  alt={student.name}
                                  style={{ width: '36px', height: '36px', borderRadius: '9999px', objectFit: 'cover' }}
                                />
                              ) : (
                                <div
                                  className={styles.avatarCircle}
                                  style={{ background: avatar.bg, border: `1px solid ${avatar.border}`, width: '36px', height: '36px' }}
                                >
                                  {avatar.initials}
                                </div>
                              )}
                              <div>
                                <div className={styles.mobileCardTitle}>{student.name}</div>
                                <div className={styles.mobileCardSubText}>{student.email}</div>
                              </div>
                            </div>
                            <span className={styles.badge} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.7rem' }}>
                              {pct}% Rate
                            </span>
                          </div>

                          <div className={styles.mobileCardBody}>
                            <div className={styles.mobileCardRow}>
                              <span className={styles.mobileCardLabel}>Course &amp; Batch</span>
                              <span className={styles.mobileCardValue}>{entry.kind === 'unmatched' ? entry.course : `${entry.course} (${entry.batch})`}</span>
                            </div>
                            <div className={styles.mobileCardRow}>
                              <span className={styles.mobileCardLabel}>Attendance Sessions</span>
                              <span className={styles.mobileCardValue}>{attendedCount} / {totalCount} Attended</span>
                            </div>
                            <div style={{ marginTop: '0.2rem' }}>
                              <div className={styles.progressBarTrack}>
                                <div
                                  className={styles.progressBarFill}
                                  style={{
                                    width: `${pct}%`,
                                    background: pct >= 80 ? 'var(--success-text)' : pct >= 60 ? 'var(--warning-text)' : 'var(--accent-text)',
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className={styles.mobileCardActions}>
                            {entry.kind !== 'unmatched' && (
                            <button
                              onClick={() => {
                                handleOpenAttendanceModal(undefined, getTodayDateStr(), entry.key);
                              }}
                              className={styles.btnPrimary}
                              style={{ height: '34px', fontSize: '0.775rem' }}
                            >
                              Mark Attendance
                            </button>
                            )}
                            <button
                              onClick={() => handleOpenStudentCalendar(entry.key)}
                              className={styles.btnSecondary}
                              style={{ height: '34px', fontSize: '0.775rem' }}
                            >
                              Calendar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* VIEW B: STUDENT CALENDAR VIEW & TIME SLOT MARKING */
                <div>
                  <div className={styles.pageHeaderRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <button onClick={() => setSelectedStudentId(null)} className={styles.btnSecondary} style={{ gap: '0.35rem' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
                        Back
                      </button>
                      <div>
                        <h1 className={styles.pageTitle}>{activeStudent?.name}'s Attendance</h1>
                        <div className={styles.pageMetaBadge}>
                          <span>{activeEntry?.kind === 'unmatched' ? activeEntry.course : (getStudentCourses(activeStudent).join(' & ') || activeStudent?.course)}</span>
                          <span>•</span>
                          <span>{activeEntry?.kind === 'unmatched' ? 'View and edit only' : activeStudent?.batch}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className={styles.attendanceHeaderActions}>
                      <button
                        onClick={() => handleOpenGroupAttendanceModal(selectedDateStr)}
                        className={styles.btnPrimary}
                        style={{ gap: '0.4rem', fontWeight: 600 }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Group Session
                      </button>
                      {canMarkActiveEntry && (
                      <button onClick={() => handleOpenAttendanceModal(undefined, selectedDateStr, selectedStudentId || activeStudent?.id)} className={styles.btnSecondary} style={{ gap: '0.4rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Mark Individual
                      </button>
                      )}
                      <button onClick={() => setIsReportModalOpen(true)} className={styles.btnSecondary} style={{ gap: '0.4rem' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        Export PDF
                      </button>
                    </div>
                  </div>

                  {/* STATS OVERVIEW FOR ACTIVE STUDENT */}
                  <div className={styles.kpiGridStudentStats}>
                    <div className={styles.kpiCard} style={{ padding: '0.85rem 1rem' }}>
                      <div className={styles.kpiLabelRow}>Rate</div>
                      <div className={styles.kpiValue} style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>
                        {attendancePercentage}%
                      </div>
                    </div>
                    <div className={styles.kpiCard} style={{ padding: '0.85rem 1rem' }}>
                      <div className={styles.kpiLabelRow}>Present</div>
                      <div className={styles.kpiValue} style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>
                        {totalPresent}
                      </div>
                    </div>
                    <div className={styles.kpiCard} style={{ padding: '0.85rem 1rem' }}>
                      <div className={styles.kpiLabelRow}>Absent</div>
                      <div className={styles.kpiValue} style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>
                        {totalAbsent}
                      </div>
                    </div>
                    <div className={styles.kpiCard} style={{ padding: '0.85rem 1rem' }}>
                      <div className={styles.kpiLabelRow}>Practice</div>
                      <div className={styles.kpiValue} style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>
                        {totalPractice}
                      </div>
                    </div>
                    <div className={styles.kpiCard} style={{ padding: '0.85rem 1rem' }}>
                      <div className={styles.kpiLabelRow}>Group</div>
                      <div className={styles.kpiValue} style={{ fontSize: '1.5rem', color: 'var(--text-primary)' }}>
                        {totalGroup}
                      </div>
                    </div>
                  </div>

                  {/* CALENDAR MONTH GRID (DENSE & MUTED NON-SESSION DAYS) */}
                  <div className={styles.calendarCard}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </h3>

                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
                          className={styles.btnSecondary}
                          style={{ height: '28px', padding: '0 0.5rem', fontSize: '0.725rem', gap: '0.25rem' }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                          Prev
                        </button>
                        <button
                          onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
                          className={styles.btnSecondary}
                          style={{ height: '28px', padding: '0 0.5rem', fontSize: '0.725rem', gap: '0.25rem' }}
                        >
                          Next
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                      </div>
                    </div>

                    {/* 7 COLUMNS WEEKDAY HEADERS */}
                    <div className={styles.calendarGrid}>
                      {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((dayName) => (
                        <div key={dayName} className={styles.calendarHeaderDay}>
                          {dayName}
                        </div>
                      ))}

                      {/* DAYS CELLS */}
                      {calendarDays.map((item, idx) => {
                        if (!item) {
                          return <div key={`empty-${idx}`} style={{ minHeight: '64px', opacity: 0.1 }} />;
                        }

                        const dayRecords = activeAttendanceRecords.filter((r) => r.date === item.dateStr);
                        const hasSessions = dayRecords.length > 0;
                        const isSelected = selectedDateStr === item.dateStr;

                        return (
                          <div
                            key={item.dateStr}
                            onClick={() => {
                              setSelectedDateStr(item.dateStr);
                            }}
                            className={`${styles.calendarDayCell} ${hasSessions ? styles.calendarDayCellSession : styles.calendarDayCellMuted
                              } ${isSelected ? styles.calendarDayCellActive : ''}`}
                            style={{ cursor: 'pointer' }}
                            title={`${item.dateStr}: ${hasSessions ? `${dayRecords.length} class(es) logged` : 'Click to inspect / mark attendance'}`}
                          >
                            <span className={styles.calendarDayNumber}>{item.day}</span>

                            <div className={styles.calendarDotsRow}>
                              {dayRecords.map((r) => {
                                const groupInfo = r.status === 'GROUP_SESSION' ? getGroupSessionDetails(item.dateStr, r.timeSlot) : null;
                                const isGroup = r.status === 'GROUP_SESSION';
                                const groupTitle = groupInfo && groupInfo.count > 0
                                  ? `GROUP SESSION (${groupInfo.count} Present: ${groupInfo.students.map((s) => s.name).join(', ')})`
                                  : 'GROUP SESSION';
                                const instructor = getInstructorInfo(r);

                                return (
                                  <span
                                    key={r.id}
                                    className={
                                      r.status === 'PRESENT'
                                        ? styles.dotPresent
                                        : r.status === 'ABSENT'
                                          ? styles.dotAbsent
                                          : r.status === 'GROUP_SESSION'
                                            ? styles.dotGroup
                                            : styles.dotPractice
                                    }
                                    title={`${r.timeSlot} • Instructor: ${instructor.name} • ${r.status === 'PRACTICE_SESSION' || r.status === 'NA' ? 'PRACTICE SESSION' : isGroup ? groupTitle : r.status}`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* TIME SLOTS & CONDUCTED CLASSES INSPECTOR FOR SELECTED DATE */}
                  <div className={styles.tableCard} style={{ marginTop: '1.25rem', padding: '1.25rem' }}>
                    <div className={styles.timeSlotInspectorHeader}>
                      <div>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                          Classes &amp; Attendance for {selectedDateStr}
                        </h3>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {activeAttendanceRecords.filter((r) => r.date === selectedDateStr).length > 0
                            ? `${activeAttendanceRecords.filter((r) => r.date === selectedDateStr).length} session(s) recorded for this student`
                            : 'No attendance marked for this date yet'}
                        </div>
                      </div>
                      {canMarkActiveEntry && (
                      <button
                        onClick={() => handleOpenAttendanceModal(undefined, selectedDateStr, selectedStudentId || activeStudent?.id)}
                        className={styles.btnPrimary}
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', gap: '0.35rem', fontWeight: 600 }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Mark Attendance for {selectedDateStr}
                      </button>
                      )}
                    </div>

                    {/* DETAILED CLASS LOG CARDS FOR SELECTED DATE */}
                    {(() => {
                      const selectedDayRecords = activeAttendanceRecords.filter((r) => r.date === selectedDateStr);
                      if (selectedDayRecords.length === 0) return null;

                      return (
                        <div style={{ marginTop: '1rem', marginBottom: '1.25rem' }}>
                          <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            Conducted Sessions on this Date ({selectedDayRecords.length})
                          </div>
                          {selectedDayRecords.map((r) => {
                            const inst = getInstructorInfo(r);
                            const isGroup = r.status === 'GROUP_SESSION';
                            const slotGroupInfo = isGroup ? getGroupSessionDetails(selectedDateStr, r.timeSlot) : null;

                            return (
                              <div key={r.id} className={styles.sessionRecordCard}>
                                <div className={styles.sessionRecordHeader}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                      </svg>
                                      {r.timeSlot}
                                    </div>

                                    {/* PROMINENT INSTRUCTOR BADGE */}
                                    <span
                                      className={styles.instructorPill}
                                      style={{
                                        background: inst.bg,
                                        color: inst.color,
                                        border: `1px solid ${inst.border}`,
                                      }}
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                      </svg>
                                      Instructor: {inst.name}
                                    </span>

                                    {/* STATUS BADGE */}
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        background: 'var(--bg-panel)',
                                        color: 'var(--text-primary)',
                                        border: '1px solid var(--border-medium)',
                                      }}
                                    >
                                      {r.status === 'PRACTICE_SESSION' || r.status === 'NA'
                                        ? 'PRACTICE SESSION'
                                        : isGroup
                                          ? 'GROUP SESSION'
                                          : r.status}
                                    </span>
                                  </div>

                                  <button
                                    onClick={() => handleOpenAttendanceModal(r.timeSlot, r.date, selectedStudentId || r.studentId || activeStudent?.id)}
                                    className={styles.btnSecondary}
                                    style={{ fontSize: '0.7rem', padding: '0.2rem 0.55rem', gap: '0.3rem', height: '26px' }}
                                    title="Edit this attendance record"
                                  >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                      <path d="M12 20h9" />
                                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                    </svg>
                                    Edit
                                  </button>
                                </div>

                                {r.comment && (
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'var(--bg-panel)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Topic / Notes:</span> {r.comment}
                                  </div>
                                )}

                                {isGroup && slotGroupInfo && slotGroupInfo.students.length > 0 && (
                                  <div style={{ marginTop: '3px', background: 'var(--bg-surface)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-strong)' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                      Attending Students ({slotGroupInfo.count}):
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                      {slotGroupInfo.students.map((st) => (
                                        <span
                                          key={st.id}
                                          style={{
                                            fontSize: '0.675rem',
                                            background: 'var(--bg-surface)',
                                            color: 'var(--text-primary)',
                                            border: '1px solid var(--border-subtle)',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontWeight: 500,
                                          }}
                                        >
                                          {st.name}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* QUICK TIME SLOTS GRID */}
                    <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem', marginTop: '0.75rem' }}>
                      Standard Time Slots
                    </div>
                    <div className={styles.timeSlotGrid}>
                      {['11:00 AM - 01:00 PM', '02:00 PM - 04:00 PM', '04:00 PM - 06:00 PM'].map((slot) => {
                        const normSlot = normalizeTimeSlot(slot);
                        const slotRecords = activeAttendanceRecords.filter(
                          (r) => r.date === selectedDateStr && normalizeTimeSlot(r.timeSlot) === normSlot
                        );
                        const slotGroupInfo = getGroupSessionDetails(selectedDateStr, slot);

                        return (
                          <div
                            key={slot}
                            onClick={() => (canMarkActiveEntry || slotRecords.length > 0) && handleOpenAttendanceModal(slot, selectedDateStr, selectedStudentId || activeStudent?.id)}
                            className={styles.timeSlotBox}
                          >
                            <div style={{ width: '100%' }}>
                              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{slot}</div>
                              {slotRecords.length > 0 ? (
                                slotRecords.map((r) => {
                                  const isGroup = r.status === 'GROUP_SESSION';
                                  const count = slotGroupInfo.count;
                                  const inst = getInstructorInfo(r);

                                  return (
                                    <div key={r.id} style={{ fontSize: '0.725rem', marginTop: '4px', lineHeight: '1.4' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                        <span style={{
                                          color: 'var(--text-primary)',
                                          fontWeight: 700
                                        }}>
                                          ● {r.status === 'PRACTICE_SESSION' || r.status === 'NA'
                                              ? 'PRACTICE SESSION'
                                              : isGroup
                                                ? `GROUP SESSION (${count > 0 ? `${count} Present` : 'Group'})`
                                                : r.status}
                                        </span>

                                        <span
                                          style={{
                                            fontSize: '0.675rem',
                                            background: 'var(--bg-panel)',
                                            color: 'var(--text-secondary)',
                                            border: '1px solid var(--border-subtle)',
                                            padding: '1px 5px',
                                            borderRadius: '4px',
                                            fontWeight: 600,
                                          }}
                                        >
                                          {inst.name}
                                        </span>
                                      </div>
                                      {r.comment ? <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '2px' }}>{r.comment}</div> : null}
                                    </div>
                                  );
                                })
                              ) : slotGroupInfo.count > 0 ? (
                                <div style={{ fontSize: '0.725rem', marginTop: '3px' }}>
                                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                    ● GROUP SESSION ({slotGroupInfo.count} Student{slotGroupInfo.count === 1 ? '' : 's'} Present)
                                  </span>
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  Unmarked • Click to edit
                                </div>
                              )}
                            </div>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BLOG ARTICLE MANAGEMENT */}
          {!isTeacher && activeTab === 'blog' && (
            <div>
              <div className={styles.pageHeaderRow}>
                <div>
                  <h1 className={styles.pageTitle}>Articles</h1>
                  <div className={styles.pageMetaBadge}>
                    <span>Showing {filteredPosts.length} of {posts.length} published articles</span>
                  </div>
                </div>
                {/* Single Primary Red CTA for Articles Page */}
                <button
                  onClick={() => {
                    if (articleSubTab === 'editor') {
                      setArticleSubTab('list');
                    } else {
                      openNewBlogModal();
                    }
                  }}
                  className={`${styles.btnPrimary} ${styles.hideOnMobile}`}
                  style={{ gap: '0.4rem' }}
                >
                  {articleSubTab === 'editor' ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                      </svg>
                      View All Articles
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      New Article
                    </>
                  )}
                </button>
              </div>

              {/* SUB-TABS NAVIGATION BAR ABOVE SEARCH */}
              <div className={styles.attendanceSubTabNav} style={{ marginTop: '0.75rem', marginBottom: '1.25rem' }}>
                <div className={styles.attendanceSubTabBtns}>
                  <button
                    type="button"
                    onClick={() => setArticleSubTab('list')}
                    className={`${styles.attendanceSubTabBtn} ${articleSubTab === 'list' ? styles.attendanceSubTabBtnActive : ''}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    Published Articles
                    <span className={styles.badge} style={{ marginLeft: '0.25rem', fontSize: '0.68rem', padding: '0.1rem 0.45rem' }}>
                      {posts.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (articleSubTab !== 'editor') {
                        openNewBlogModal();
                      }
                    }}
                    className={`${styles.attendanceSubTabBtn} ${articleSubTab === 'editor' ? styles.attendanceSubTabBtnActive : ''}`}
                  >
                    {editingPostId ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        Edit Article
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Create New Article
                      </>
                    )}
                  </button>
                </div>

                {articleSubTab === 'editor' && (
                  <button
                    type="button"
                    onClick={() => setArticleSubTab('list')}
                    className={styles.btnSecondary}
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', gap: '0.35rem' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="19" y1="12" x2="5" y2="12" />
                      <polyline points="12 19 5 12 12 5" />
                    </svg>
                    Back to Articles List
                  </button>
                )}
              </div>

              {/* INLINE WORDPRESS CMS EDITOR VIEW (NO MODAL OVERLAY) */}
              {articleSubTab === 'editor' && (
                <div style={{ marginBottom: '2rem' }}>
                  <WordPressArticleEditorModal
                    isInline={true}
                    isOpen={true}
                    editingPostId={editingPostId}
                    initialData={blogFormData}
                    onClose={() => setArticleSubTab('list')}
                    onSave={handleSaveBlog}
                  />
                </div>
              )}

              {/* ARTICLES LIST VIEW */}
              {articleSubTab === 'list' && (
                <>
                  {/* FILTER BAR */}
                  <div className={styles.filterBar}>
                    <input
                      type="text"
                      placeholder="Search articles..."
                      value={blogSearch}
                      onChange={(e) => setBlogSearch(e.target.value)}
                      className={styles.searchInput}
                    />

                    <select
                      value={blogCategoryFilter}
                      onChange={(e) => setBlogCategoryFilter(e.target.value)}
                      className={styles.selectInput}
                    >
                      <option value="ALL">All Categories</option>
                      <option value="PRODUCTION">PRODUCTION</option>
                      <option value="DJING">DJING</option>
                      <option value="GENERAL">GENERAL</option>
                      <option value="ACADEMY NEWS">ACADEMY NEWS</option>
                      <option value="GEAR & TECH">GEAR &amp; TECH</option>
                    </select>
                  </div>

                  {/* POSTS TABLE / EMPTY STATE */}
                  {filteredPosts.length === 0 ? (
                    <div className={styles.tableCard}>
                      <div className={styles.emptyStateCard}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <div className={styles.emptyStateTitle}>No articles matching filters</div>
                        <div className={styles.emptyStateDesc}>Try clearing your search query or switching categories.</div>
                        <button
                          onClick={() => {
                            setBlogSearch('');
                            setBlogCategoryFilter('ALL');
                          }}
                          className={styles.btnSecondary}
                          style={{ marginTop: '0.5rem' }}
                        >
                          Clear Filters
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* DESKTOP TABLE VIEW */}
                      <div className={styles.desktopTableContainer}>
                        <div className={styles.tableCard}>
                          <table className={styles.dataTable}>
                            <thead>
                              <tr>
                                <th>Article</th>
                                <th>Category</th>
                                <th>Author</th>
                                <th>Published</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredPosts.map((post) => {
                                const name = post.author?.name || (post as any).authorName || 'Soundabode Team';
                                const role = post.author?.role || (post as any).authorRole || 'Certified Instructor';
                                const avatarUrl = post.author?.avatarUrl || (post as any).authorAvatarUrl || '';
                                const authorAvatar = getAvatarDetails(name, avatarUrl);

                                return (
                                  <tr key={post.id}>
                                    <td style={{ maxWidth: '340px' }}>
                                      <div className={styles.postCellTitle}>{post.title}</div>
                                      <div className={styles.postCellMeta}>{(post.excerpt || '').slice(0, 75)}...</div>
                                    </td>
                                    <td>
                                      <span className={styles.badge} style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}>
                                        {post.category}
                                      </span>
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {safeImageUrl(authorAvatar.avatarUrl) ? (
                                          <img
                                            src={safeImageUrl(authorAvatar.avatarUrl)}
                                            alt={name}
                                            style={{ width: '28px', height: '28px', borderRadius: '9999px', objectFit: 'cover' }}
                                          />
                                        ) : (
                                          <div
                                            className={styles.avatarCircle}
                                            style={{ width: '28px', height: '28px', fontSize: '0.675rem', background: authorAvatar.bg, border: `1px solid ${authorAvatar.border}` }}
                                          >
                                            {authorAvatar.initials}
                                          </div>
                                        )}
                                        <div>
                                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{name}</div>
                                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{role}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{post.publishedAt}</td>
                                    <td style={{ textAlign: 'right' }}>
                                      <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                                        <button onClick={() => openEditBlogModal(post)} className={styles.btnGhost}>
                                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M12 20h9" />
                                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                          </svg>
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => handleDeleteBlog(post.id, post.title)}
                                          className={styles.btnDestructive}
                                          title="Delete post"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* MOBILE CARDS VIEW */}
                      <div className={styles.mobileCardList}>
                        {filteredPosts.map((post) => {
                          const name = post.author?.name || (post as any).authorName || 'Soundabode Team';
                          return (
                            <div key={post.id} className={styles.mobileDataCard}>
                              <div className={styles.mobileCardHeader}>
                                <div style={{ flex: 1 }}>
                                  <div className={styles.mobileCardTitle}>{post.title}</div>
                                  <div className={styles.mobileCardSubText}>{post.publishedAt} • By {name}</div>
                                </div>
                                <span className={styles.badge} style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
                                  {post.category}
                                </span>
                              </div>

                              <div className={styles.mobileCardBody}>
                                <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                  {(post.excerpt || '').slice(0, 110)}...
                                </div>
                              </div>

                              <div className={styles.mobileCardActions}>
                                <button onClick={() => openEditBlogModal(post)} className={styles.btnSecondary} style={{ height: '34px', fontSize: '0.775rem' }}>
                                  Edit Article
                                </button>
                                <button onClick={() => handleDeleteBlog(post.id, post.title)} className={styles.btnDestructive} style={{ height: '34px', padding: '0 0.6rem' }}>
                                  Delete
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 4: STUDENT LEADS CRM */}
          {activeTab === 'inquiries' && (
            <div>
              {/* PAGE HEADER */}
              <div style={{ textAlign: 'center', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <h1 className={styles.pageTitle} style={{ textAlign: 'center', margin: 0 }}>{isTeacher ? 'My Leads' : 'Lead Management'}</h1>
                <div className={styles.pageMetaBadge} style={{ marginTop: '0.45rem', display: 'inline-flex', justifyContent: 'center', gap: '0.5rem' }}>
                  <span>{inquiries.length} {isTeacher ? 'leads assigned to you' : 'total leads'}</span>
                  {!isTeacher && unassignedLeadCount > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <button type="button" className={styles.linkBtn} onClick={() => setLeadAssigneeFilter('UNASSIGNED')}>
                        {unassignedLeadCount} unassigned
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* TOOLBAR: view toggle, search, filters */}
              <div className={styles.leadsToolbar}>
                <div className={styles.leadsToolbarTop}>
                  <div className={styles.viewToggle} role="tablist" aria-label="Lead view">
                    {(['pipeline', 'list'] as const).map((view) => (
                      <button
                        key={view}
                        id={`lead-view-${view}`}
                        role="tab"
                        aria-selected={leadView === view}
                        onClick={() => setLeadView(view)}
                        className={`${styles.viewToggleBtn} ${leadView === view ? styles.viewToggleBtnActive : ''}`}
                      >
                        {view === 'pipeline' ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="18" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/></svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                        )}
                        {view === 'pipeline' ? 'Pipeline' : 'List'}
                      </button>
                    ))}
                  </div>

                  <div className={styles.leadsSearch}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                      type="search"
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      placeholder="Search name, phone, email or course"
                      aria-label="Search leads"
                    />
                  </div>
                </div>

                <div className={styles.leadsToolbarFilters}>
                  {!isTeacher && (
                    <label className={styles.leadFilterItem}>
                      <span className={styles.leadFilterLabel}>Assigned to</span>
                      <select value={leadAssigneeFilter} onChange={(e) => setLeadAssigneeFilter(e.target.value)} className={styles.selectInput}>
                        <option value="ALL">Everyone</option>
                        <option value="UNASSIGNED">Unassigned</option>
                        {team.map((m) => (
                          <option key={m.email} value={m.email}>{m.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className={styles.leadFilterItem}>
                    <span className={styles.leadFilterLabel}>Source</span>
                    <select value={inquirySourceFilter} onChange={(e) => setInquirySourceFilter(e.target.value)} className={styles.selectInput}>
                      <option value="ALL">All sources</option>
                      <option value="Meta Ads">Meta Ads</option>
                      <option value="Google Ads">Google Ads</option>
                      <option value="Organic/Referral">Organic / Referral</option>
                      <option value="Direct">Direct</option>
                      <option value="Campaign">Campaigns</option>
                    </select>
                  </label>
                  {leadView === 'list' && (
                    <label className={styles.leadFilterItem}>
                      <span className={styles.leadFilterLabel}>Stage</span>
                      <select value={inquiryStatusFilter} onChange={(e) => setInquiryStatusFilter(e.target.value)} className={styles.selectInput}>
                        <option value="ALL">All stages</option>
                        {LEAD_STAGES.map((st) => (
                          <option key={st} value={st}>{LEAD_STAGE_LABELS[st]}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className={styles.leadFilterItem}>
                    <span className={styles.leadFilterLabel}>Archive reason</span>
                    <select value={leadArchiveReasonFilter} onChange={(e) => setLeadArchiveReasonFilter(e.target.value)} className={styles.selectInput}>
                      <option value="ALL">All reasons</option>
                      {ARCHIVE_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  {hasActiveLeadFilters && (
                    <button type="button" className={styles.linkBtn} onClick={clearLeadFilters}>Clear filters</button>
                  )}
                </div>
              </div>

              {leadActionError && (
                <div className={styles.leadsErrorBanner} role="alert">
                  <span>{leadActionError}</span>
                  <button type="button" onClick={() => setLeadActionError(null)} aria-label="Dismiss">✕</button>
                </div>
              )}

              {/* KANBAN PIPELINE VIEW */}
              {leadView === 'pipeline' && (
                <>
                  {/* MOBILE QUICK STAGE SWITCHER (Visible only on mobile) */}
                  <div className={styles.mobileStagePills}>
                    {(['ALL', ...LEAD_STAGES] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => setMobilePipelineStage(st)}
                        className={`${styles.mobileStagePillBtn} ${mobilePipelineStage === st ? styles.mobileStagePillBtnActive : ''}`}
                      >
                        {st === 'ALL' ? 'All' : LEAD_STAGE_LABELS[st]}
                        <span className={styles.mobileStageCount}>
                          {st === 'ALL' ? leadsMatchingFilters.length : leadsMatchingFilters.filter((inq) => inq.status === st).length}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className={styles.pipelineBoard}>
                    {(mobilePipelineStage === 'ALL' ? LEAD_STAGES : [mobilePipelineStage]).map((stage) => {
                      const stageLeads = leadsMatchingFilters.filter((inq) => inq.status === stage);
                      const capiEvent = getCapiEventNameForStatus(stage);
                      return (
                        <div key={stage} className={styles.pipelineColumn}>
                          <div className={styles.pipelineColHeader}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <span className={styles.pipelineColTitle}>{LEAD_STAGE_LABELS[stage]}</span>
                              <span className={styles.pipelineColCount}>{stageLeads.length}</span>
                            </div>
                            {!isTeacher && (
                              <span className={styles.pipelineColMeta} title="Meta Conversions API event sent when a lead enters this stage">
                                {capiEvent ? `Meta: ${capiEvent}` : 'No Meta event'}
                              </span>
                            )}
                          </div>

                          <div className={styles.pipelineCards}>
                            {stageLeads.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '2.5rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.74rem' }}>No leads in this stage</div>
                            ) : stageLeads.map((inq) => {
                              const av = getAvatarDetails(inq.name);
                              const sourceBadge = getSourceBadgeDetails(inq);
                              return (
                                <div key={inq.id} className={styles.pipelineCard}>
                                  {/* 1. Who */}
                                  <button type="button" className={styles.leadCardHead} onClick={() => setExpandedLeadMessage(inq)} title="Open lead details">
                                    <span className={styles.leadCardAvatar}>{av.initials}</span>
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                      <span className={styles.leadCardName}>{inq.name}</span>
                                      <span className={styles.leadCardCourse}>{inq.courseInterest || 'General Inquiry'}</span>
                                    </span>
                                    <span className={styles.leadCardTime}>{formatLeadAge(inq.submittedAt)}</span>
                                  </button>

                                  {/* 2. Context */}
                                  <div className={styles.leadCardMeta}>
                                    <span className={styles.leadCardChip}>{sourceBadge.label}</span>
                                    {inq.phone && <span className={styles.leadCardPhone}>{inq.phone}</span>}
                                  </div>

                                  {inq.status === 'ARCHIVED' && renderArchiveReason(inq)}

                                  {/* 3. Owner */}
                                  {renderAssignee(inq)}

                                  {/* 4. Call notes: latest one shown on Contacted cards */}
                                  {stage === 'CONTACTED' && (inq.comments?.length || 0) > 0 && (() => {
                                    const last = inq.comments![inq.comments!.length - 1];
                                    return (
                                      <button type="button" className={styles.leadNotePreview} onClick={() => openLeadNotes(inq.id)} title="Open notes">
                                        <span className={styles.leadNotePreviewText}>“{last.text}”</span>
                                        <span className={styles.leadNotePreviewMeta}>{last.authorName || last.authorEmail} · {formatLeadAge(last.createdAt)}</span>
                                      </button>
                                    );
                                  })()}
                                  <button
                                    type="button"
                                    className={styles.leadNoteBtn}
                                    data-emphasis={stage === 'CONTACTED' || undefined}
                                    onClick={() => openLeadNotes(inq.id)}
                                  >
                                    {(inq.comments?.length || 0) > 0 ? `Notes (${inq.comments!.length})` : stage === 'CONTACTED' ? '+ Add what they said' : '+ Add note'}
                                  </button>

                                  {/* 5. Actions */}
                                  <div className={styles.pipelineActionRow}>
                                    {renderStageSelect(inq)}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                                      {inq.phone && (
                                        <a
                                          href={`https://wa.me/${inq.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Hi ' + inq.name + ', this is Soundabode Studios. We saw your inquiry about ' + inq.courseInterest + '. Can we connect?')}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={styles.pipelineWaBtn}
                                          title={`WhatsApp ${inq.phone}`}
                                          aria-label={`WhatsApp ${inq.name}`}
                                        >
                                          WA
                                        </a>
                                      )}
                                      {!isTeacher && (
                                        <button
                                          id={`pipeline-delete-${inq.id}`}
                                          onClick={() => handleDeleteInquiry(inq.id)}
                                          className={styles.pipelineDelBtn}
                                          title="Delete lead"
                                          aria-label={`Delete ${inq.name}`}
                                        >
                                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* LIST VIEW */}
              {leadView === 'list' && (
                <>
                  {/* SELECTION + BATCH ACTIONS */}
                  <div className={styles.leadsBatchBar} data-active={selectedInquiryIds.length > 0 || undefined}>
                    <label className={styles.selectAllPill}>
                      <input
                        type="checkbox"
                        checked={filteredInquiries.length > 0 && filteredInquiries.every((inq) => selectedInquiryIds.includes(inq.id))}
                        onChange={handleToggleSelectAllInquiries}
                        style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: 'var(--accent-red)' }}
                      />
                      <span>
                        {selectedInquiryIds.length > 0 ? `${selectedInquiryIds.length} selected` : `Select all (${filteredInquiries.length})`}
                      </span>
                    </label>

                    {selectedInquiryIds.length > 0 && (
                      <div className={styles.leadsBatchActions}>
                        {!isTeacher && (
                          <select
                            className={styles.selectInput}
                            value=""
                            onChange={(e) => {
                              const value = e.target.value;
                              if (!value) return;
                              handleAssignLeads([...selectedInquiryIds], value === '__none__' ? '' : value);
                              setSelectedInquiryIds([]);
                            }}
                            aria-label="Assign selected leads"
                          >
                            <option value="">Assign to…</option>
                            {team.map((m) => (
                              <option key={m.email} value={m.email}>{m.name}</option>
                            ))}
                            <option value="__none__">Unassign</option>
                          </select>
                        )}
                        <select
                          className={styles.selectInput}
                          value=""
                          onChange={(e) => e.target.value && handleBatchUpdateInquiriesStatus(e.target.value as LeadStatus)}
                          aria-label="Move selected leads to stage"
                        >
                          <option value="">Move to stage…</option>
                          {LEAD_STAGES.map((st) => (
                            <option key={st} value={st}>{LEAD_STAGE_LABELS[st]}</option>
                          ))}
                        </select>
                        {!isTeacher && (
                          <button onClick={handleBatchDeleteInquiries} className={styles.btnDestructive} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                            Delete
                          </button>
                        )}
                        <button type="button" className={styles.linkBtn} onClick={() => setSelectedInquiryIds([])}>Clear</button>
                      </div>
                    )}
                  </div>

                  {filteredInquiries.length === 0 ? (
                    <div className={styles.tableCard}>
                      <div className={styles.emptyStateCard}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                        </svg>
                        <div className={styles.emptyStateTitle}>{isTeacher && inquiries.length === 0 ? 'No leads assigned to you yet' : 'No leads match these filters'}</div>
                        <div className={styles.emptyStateDesc}>
                          {isTeacher && inquiries.length === 0 ? 'Leads an admin assigns to you will appear here.' : 'Try a different search or clear the filters.'}
                        </div>
                        {hasActiveLeadFilters && (
                          <button onClick={clearLeadFilters} className={styles.btnSecondary} style={{ marginTop: '0.5rem' }}>Clear filters</button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* DESKTOP TABLE VIEW */}
                      <div className={styles.desktopTableContainer}>
                        <div className={styles.tableCard}>
                          <table className={`${styles.dataTable} ${styles.leadsTable}`}>
                            <thead>
                              <tr>
                                <th style={{ width: '40px' }} aria-label="Select" />
                                <th>Lead</th>
                                <th>Contact</th>
                                <th>Source</th>
                                {!isTeacher && <th>Assigned to</th>}
                                <th>Stage</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredInquiries.map((inq) => {
                                const avatar = getAvatarDetails(inq.name);
                                const isSelected = selectedInquiryIds.includes(inq.id);
                                const sourceBadge = getSourceBadgeDetails(inq);
                                return (
                                  <tr key={inq.id} style={isSelected ? { backgroundColor: 'rgba(225, 29, 72, 0.05)' } : {}}>
                                    <td style={{ textAlign: 'center' }}>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggleSelectInquiry(inq.id)}
                                        aria-label={`Select ${inq.name}`}
                                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-red)' }}
                                      />
                                    </td>
                                    <td>
                                      <div className={styles.studentCell}>
                                        <div className={styles.avatarCircle} style={{ background: avatar.bg, border: `1px solid ${avatar.border}` }}>{avatar.initials}</div>
                                        <div>
                                          <div className={styles.studentName}>{inq.name}</div>
                                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{inq.courseInterest} · {formatLeadAge(inq.submittedAt)}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td>
                                      <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>{inq.phone || 'N/A'}</div>
                                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{inq.email}</div>
                                    </td>
                                    <td>
                                      <span className={`${styles.badge} ${sourceBadge.className}`}>
                                        {sourceBadge.label}
                                      </span>
                                    </td>
                                    {!isTeacher && <td style={{ minWidth: '130px' }}>{renderAssignee(inq, true)}</td>}
                                    <td style={{ minWidth: '140px' }}>
                                      {renderStageSelect(inq)}
                                      {inq.status === 'ARCHIVED' && renderArchiveReason(inq)}
                                    </td>
                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                      <button onClick={() => setExpandedLeadMessage(inq)} className={styles.btnSecondary} style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}>
                                        View
                                      </button>
                                      {!isTeacher && (
                                        <button onClick={() => handleDeleteInquiry(inq.id)} className={styles.btnDestructive} style={{ marginLeft: '0.35rem', padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}>
                                          Delete
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* MOBILE CARDS VIEW */}
                      <div className={styles.mobileCardList}>
                        {filteredInquiries.map((inq) => {
                          const avatar = getAvatarDetails(inq.name);
                          const isSelected = selectedInquiryIds.includes(inq.id);
                          const sourceBadge = getSourceBadgeDetails(inq);
                          return (
                            <div key={inq.id} className={styles.mobileDataCard} style={isSelected ? { border: '1px solid rgba(225, 29, 72, 0.4)', background: 'rgba(225, 29, 72, 0.03)' } : {}}>
                              <div className={styles.mobileCardHeader}>
                                <div className={styles.mobileCardTitleBox}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectInquiry(inq.id)}
                                    aria-label={`Select ${inq.name}`}
                                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-red)', marginRight: '0.3rem' }}
                                  />
                                  <div className={styles.avatarCircle} style={{ background: avatar.bg, border: `1px solid ${avatar.border}`, width: '34px', height: '34px' }}>{avatar.initials}</div>
                                  <div>
                                    <div className={styles.mobileCardTitle}>{inq.name}</div>
                                    <div className={styles.mobileCardSubText}>{inq.courseInterest}</div>
                                  </div>
                                </div>
                              </div>

                              <div className={styles.mobileCardBody}>
                                <div className={styles.mobileCardRow}>
                                  <span className={styles.mobileCardLabel}>Phone</span>
                                  <span className={styles.mobileCardValue}>{inq.phone || 'N/A'}</span>
                                </div>
                                <div className={styles.mobileCardRow}>
                                  <span className={styles.mobileCardLabel}>Source</span>
                                  <span className={`${styles.badge} ${sourceBadge.className}`} style={{ fontSize: '0.65rem' }}>
                                    {sourceBadge.label}
                                  </span>
                                </div>
                                {!isTeacher && (
                                  <div className={styles.mobileCardRow}>
                                    <span className={styles.mobileCardLabel}>Assigned</span>
                                    <span style={{ flex: '0 1 180px' }}>{renderAssignee(inq, true)}</span>
                                  </div>
                                )}
                                <div className={styles.mobileCardRow}>
                                  <span className={styles.mobileCardLabel}>Stage</span>
                                  <span style={{ flex: '0 1 180px' }}>{renderStageSelect(inq)}</span>
                                </div>
                                {inq.status === 'ARCHIVED' && renderArchiveReason(inq)}
                              </div>

                              <div className={styles.mobileCardActions}>
                                <button onClick={() => setExpandedLeadMessage(inq)} className={styles.btnSecondary} style={{ height: '34px', fontSize: '0.775rem' }}>
                                  View details
                                </button>
                                {!isTeacher && (
                                  <button onClick={() => handleDeleteInquiry(inq.id)} className={styles.btnDestructive} style={{ height: '34px', padding: '0 0.6rem' }}>
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB: META ADS REAL-TIME PIPELINE */}
          {!isTeacher && activeTab === 'meta-ads' && (
            <MetaAdsTab
              inquiries={inquiries}
              onUpdateStatus={(id, status, notes) => requestStageChange([id], status, notes)}
              onDeleteInquiry={(id) => {
                handleDeleteInquiry(id);
              }}
              onRefresh={() => {
                refreshData();
              }}
            />
          )}

          {/* TAB: ADMISSION FORM SUBMISSIONS */}
          {!isTeacher && activeTab === 'admissions' && (
            <div>
              <div className={styles.pageHeaderRow}>
                <div>
                  <h1 className={styles.pageTitle}>Admission Submissions</h1>
                  <div className={styles.pageMetaBadge}>
                    <span>Store, view, and share official DJ &amp; EMP student application forms</span>
                  </div>
                </div>

                <div className={styles.filterActionsRow} style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-surface)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={() => setAdmissionTypeFilter('ALL')}
                    style={{
                      background: admissionTypeFilter === 'ALL' ? 'var(--bg-panel)' : 'transparent',
                      color: admissionTypeFilter === 'ALL' ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: 'none',
                      padding: '0.35rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.775rem',
                      fontWeight: admissionTypeFilter === 'ALL' ? 600 : 500,
                      cursor: 'pointer',
                      boxShadow: admissionTypeFilter === 'ALL' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    All ({admissions.length})
                  </button>
                  <button
                    onClick={() => setAdmissionTypeFilter('DJ')}
                    style={{
                      background: admissionTypeFilter === 'DJ' ? 'var(--bg-panel)' : 'transparent',
                      color: admissionTypeFilter === 'DJ' ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: 'none',
                      padding: '0.35rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.775rem',
                      fontWeight: admissionTypeFilter === 'DJ' ? 600 : 500,
                      cursor: 'pointer',
                      boxShadow: admissionTypeFilter === 'DJ' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    DJ ({admissions.filter((a) => a.formType === 'DJ').length})
                  </button>
                  <button
                    onClick={() => setAdmissionTypeFilter('EMP')}
                    style={{
                      background: admissionTypeFilter === 'EMP' ? 'var(--bg-panel)' : 'transparent',
                      color: admissionTypeFilter === 'EMP' ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: 'none',
                      padding: '0.35rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.775rem',
                      fontWeight: admissionTypeFilter === 'EMP' ? 600 : 500,
                      cursor: 'pointer',
                      boxShadow: admissionTypeFilter === 'EMP' ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    EMP ({admissions.filter((a) => a.formType === 'EMP').length})
                  </button>
                </div>
              </div>

              {/* SEARCH & STATUS FILTER TOOLBAR */}
              <div className={styles.filterBar}>
                <input
                  type="text"
                  placeholder="Filter submissions by student name, email, form no, phone..."
                  value={admissionSearch}
                  onChange={(e) => setAdmissionSearch(e.target.value)}
                  className={styles.searchInput}
                />

                <select
                  value={admissionStatusFilter}
                  onChange={(e) => setAdmissionStatusFilter(e.target.value)}
                  className={styles.selectInput}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="NEW">NEW</option>
                  <option value="CONTACTED">CONTACTED</option>
                  <option value="ENROLLED">ENROLLED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>

              {copyToast && (
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', color: 'var(--text-success)', padding: '0.5rem 0.85rem', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '1rem', fontWeight: 500 }}>
                  {copyToast}
                </div>
              )}

              {filteredAdmissions.length === 0 ? (
                <div className={styles.emptyStateBox} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <p>No admission form submissions found matching your search or filters.</p>
                </div>
              ) : (
                <>
                  {/* DESKTOP TABLE VIEW */}
                  <div className={styles.desktopTableContainer}>
                    <div className={styles.tableCard}>
                      <table className={styles.dataTable} style={{ minWidth: '850px' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '130px' }}>Form No</th>
                            <th style={{ minWidth: '150px' }}>Applicant Student</th>
                            <th style={{ minWidth: '180px' }}>Course Opted</th>
                            <th style={{ minWidth: '160px' }}>Contact Details</th>
                            <th style={{ width: '100px' }}>Submitted</th>
                            <th style={{ width: '100px' }}>Status</th>
                            <th style={{ textAlign: 'right', minWidth: '180px' }}>Actions &amp; Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAdmissions.map((item) => {
                            const avatar = getAvatarDetails(`${item.firstName} ${item.lastName}`);
                            const formattedDate = new Date(item.submittedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            });

                            return (
                              <tr key={item.id}>
                                <td>
                                  <span
                                    style={{
                                      fontFamily: 'monospace',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      color: 'var(--text-primary)',
                                      background: 'var(--bg-surface)',
                                      border: '1px solid var(--border-medium)',
                                      padding: '0.25rem 0.55rem',
                                      borderRadius: '5px',
                                      whiteSpace: 'nowrap',
                                      display: 'inline-block',
                                    }}
                                  >
                                    {item.formNo}
                                  </span>
                                </td>
                                <td>
                                  <div className={styles.studentCell}>
                                    {item.photoUrl && safeImageUrl(item.photoUrl) ? (
                                      <img
                                        src={safeImageUrl(item.photoUrl)}
                                        alt={`${item.firstName} ${item.lastName}`}
                                        className={styles.avatarCircle}
                                        style={{ objectFit: 'cover', border: '1.5px solid var(--accent-primary, var(--border-strong))' }}
                                      />
                                    ) : (
                                      <div
                                        className={styles.avatarCircle}
                                        style={{ background: avatar.bg, border: `1px solid ${avatar.border}` }}
                                      >
                                        {avatar.initials}
                                      </div>
                                    )}
                                    <div>
                                      <div className={styles.studentName} style={{ fontWeight: 600 }}>{item.firstName} {item.lastName}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>{item.courseOpted}</div>
                                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '2px' }}>{item.fee} • {item.tenure}</div>
                                </td>
                                <td>
                                  <a href={safeMailto(item.email)} style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', fontSize: '0.775rem' }}>
                                    {item.email}
                                  </a>
                                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{item.cellPhone}</div>
                                </td>
                                <td style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                                  {formattedDate}
                                </td>
                                <td>
                                  {renderAdmissionStatusSelect(item)}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <button
                                      onClick={() => setSelectedAdmissionForModal(item)}
                                      className={styles.btnSecondary}
                                      style={{ fontSize: '0.725rem', height: '26px', padding: '0 0.5rem', whiteSpace: 'nowrap' }}
                                      title="View application form details"
                                    >
                                      View
                                    </button>
                                    <button
                                      onClick={() => handlePrintAdmissionForm(item)}
                                      className={styles.btnSecondary}
                                      style={{ fontSize: '0.725rem', height: '26px', padding: '0 0.5rem', whiteSpace: 'nowrap' }}
                                      title="Print or save PDF document"
                                    >
                                      Print
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAdmission(item.id, item.formNo)}
                                      className={styles.btnGhost}
                                      style={{ fontSize: '0.725rem', height: '26px', padding: '0 0.35rem', color: 'var(--text-muted)' }}
                                      title="Delete submission"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* MOBILE CARDS VIEW */}
                  <div className={styles.mobileCardList}>
                    {filteredAdmissions.map((item) => {
                      const avatar = getAvatarDetails(`${item.firstName} ${item.lastName}`);
                      const formattedDate = new Date(item.submittedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      });

                      return (
                        <div key={item.id} className={styles.mobileDataCard}>
                          <div className={styles.mobileCardHeader}>
                            <div className={styles.mobileCardTitleBox}>
                              {item.photoUrl && safeImageUrl(item.photoUrl) ? (
                                <img
                                  src={safeImageUrl(item.photoUrl)}
                                  alt={`${item.firstName} ${item.lastName}`}
                                  className={styles.avatarCircle}
                                  style={{ objectFit: 'cover', border: '1.5px solid var(--accent-primary, var(--border-strong))', width: '34px', height: '34px' }}
                                />
                              ) : (
                                <div
                                  className={styles.avatarCircle}
                                  style={{ background: avatar.bg, border: `1px solid ${avatar.border}`, width: '34px', height: '34px' }}
                                >
                                  {avatar.initials}
                                </div>
                              )}
                              <div>
                                <div className={styles.mobileCardTitle}>{item.firstName} {item.lastName}</div>
                                <div className={styles.mobileCardSubText}>Form No: {item.formNo}</div>
                              </div>
                            </div>
                            {renderAdmissionStatusSelect(item)}
                          </div>

                          <div className={styles.mobileCardBody}>
                            <div className={styles.mobileCardRow}>
                              <span className={styles.mobileCardLabel}>Course</span>
                              <span className={styles.mobileCardValue}>{item.courseOpted}</span>
                            </div>
                            <div className={styles.mobileCardRow}>
                              <span className={styles.mobileCardLabel}>Fee &amp; Tenure</span>
                              <span className={styles.mobileCardValue}>{item.fee} • {item.tenure}</span>
                            </div>
                            <div className={styles.mobileCardRow}>
                              <span className={styles.mobileCardLabel}>Submitted</span>
                              <span className={styles.mobileCardValue}>{formattedDate}</span>
                            </div>
                          </div>

                          <div className={styles.mobileCardActions}>
                            <button
                              onClick={() => setSelectedAdmissionForModal(item)}
                              className={styles.btnPrimary}
                              style={{ height: '34px', fontSize: '0.775rem' }}
                            >
                              View Form
                            </button>
                            <button
                              onClick={() => handlePrintAdmissionForm(item)}
                              className={styles.btnSecondary}
                              style={{ height: '34px', fontSize: '0.775rem' }}
                            >
                              Print PDF
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* FEES TAB */}
          {!isTeacher && activeTab === 'fees' && (
            <div>
              <div className={styles.pageHeaderRow}>
                <div>
                  <h1 className={styles.pageTitle}>Fees & Receipts</h1>
                  <div className={styles.pageMetaBadge}>
                    <span>{fees.length} receipt{fees.length !== 1 ? 's' : ''} issued</span>
                    <span>•</span>
                    <span>₹{fees.reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN')} total collected</span>
                  </div>
                </div>
                <button onClick={handleOpenNewFeeModal} className={styles.btnPrimary}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New Receipt
                </button>
              </div>

              {/* Search bar */}
              <div className={styles.filterBar}>
                <input
                  type="text"
                  placeholder="Search by student name, course, receipt no…"
                  value={feeSearch}
                  onChange={(e) => setFeeSearch(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              {/* Summary KPI row */}
              <div className={styles.kpiGrid} style={{ marginBottom: '1.5rem' }}>
                <div className={styles.kpiCard}>
                  <div className={styles.kpiLabelRow}>Total Receipts</div>
                  <div className={styles.kpiValue}>{fees.length}</div>
                </div>
                <div className={styles.kpiCard}>
                  <div className={styles.kpiLabelRow}>Total Collected</div>
                  <div className={styles.kpiValue} style={{ fontSize: '1.5rem' }}>
                    ₹{fees.reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className={styles.kpiCard}>
                  <div className={styles.kpiLabelRow}>Cash Payments</div>
                  <div className={styles.kpiValue}>{fees.filter(r => r.paymentMode === 'Cash').length}</div>
                </div>
                <div className={styles.kpiCard}>
                  <div className={styles.kpiLabelRow}>Online / UPI</div>
                  <div className={styles.kpiValue}>{fees.filter(r => r.paymentMode !== 'Cash').length}</div>
                </div>
              </div>

              {/* Receipts table */}
              {fees.filter(r => {
                const q = feeSearch.toLowerCase();
                return !feeSearch || r.studentName.toLowerCase().includes(q) || r.courseName.toLowerCase().includes(q) || r.receiptNo.includes(q);
              }).length === 0 ? (
                <div className={styles.emptyStateCard}>
                  <div style={{ marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                      <line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                  </div>
                  <div className={styles.emptyStateTitle}>No receipts found</div>
                  <div className={styles.emptyStateDesc}>Click "New Receipt" to issue the first fee receipt.</div>
                </div>
              ) : (
                <>
                  {/* DESKTOP TABLE VIEW */}
                  <div className={styles.desktopTableContainer}>
                    <div className={styles.tableCard}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Receipt #</th>
                            <th>Date</th>
                            <th>Student</th>
                            <th>Course</th>
                            <th>Amount</th>
                            <th>Mode</th>
                            <th>Period</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fees
                            .filter(r => {
                              const q = feeSearch.toLowerCase();
                              return !feeSearch || r.studentName.toLowerCase().includes(q) || r.courseName.toLowerCase().includes(q) || r.receiptNo.includes(q);
                            })
                            .map((receipt) => (
                              <tr key={receipt.id}>
                                <td>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    #{receipt.receiptNo}
                                  </span>
                                </td>
                                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  {receipt.date ? new Date(receipt.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                                </td>
                                <td style={{ fontWeight: 600 }}>{receipt.studentName}</td>
                                <td style={{ color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {receipt.courseName}
                                </td>
                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  ₹{receipt.amount.toLocaleString('en-IN')}
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', borderRadius: '4px', fontWeight: 500 }}>
                                    {receipt.paymentMode}
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {receipt.periodFrom && receipt.periodTo
                                    ? `${receipt.periodFrom} → ${receipt.periodTo}`
                                    : 'N/A'}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                    <button
                                      onClick={() => handlePrintReceipt(receipt)}
                                      className={styles.btnSecondary}
                                      style={{ height: '28px', padding: '0 0.6rem', fontSize: '0.72rem' }}
                                      title="Print Receipt"
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                                        <polyline points="6 9 6 2 18 2 18 9" />
                                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                        <rect x="6" y="14" width="12" height="8" />
                                      </svg>
                                      Print
                                    </button>
                                    <button
                                      onClick={() => handleOpenEditFeeModal(receipt)}
                                      className={styles.btnSecondary}
                                      style={{ height: '28px', padding: '0 0.6rem', fontSize: '0.72rem' }}
                                      title="Edit Receipt"
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                      </svg>
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteFee(receipt.id, receipt.receiptNo)}
                                      className={styles.btnGhost}
                                      style={{ height: '28px', padding: '0 0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}
                                      title="Delete Receipt"
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      </svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* MOBILE CARDS VIEW */}
                  <div className={styles.mobileCardList}>
                    {fees
                      .filter(r => {
                        const q = feeSearch.toLowerCase();
                        return !feeSearch || r.studentName.toLowerCase().includes(q) || r.courseName.toLowerCase().includes(q) || r.receiptNo.includes(q);
                      })
                      .map((receipt) => (
                        <div key={receipt.id} className={styles.mobileDataCard}>
                          <div className={styles.mobileCardHeader}>
                            <div>
                              <div className={styles.mobileCardTitle}>{receipt.studentName}</div>
                              <div className={styles.mobileCardSubText}>Receipt #{receipt.receiptNo} • {receipt.date}</div>
                            </div>
                            <span className={styles.badge} style={{ background: 'var(--bg-surface)', color: 'var(--text-success)', fontSize: '0.75rem', fontWeight: 700 }}>
                              ₹{receipt.amount.toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div className={styles.mobileCardBody}>
                            <div className={styles.mobileCardRow}>
                              <span className={styles.mobileCardLabel}>Course</span>
                              <span className={styles.mobileCardValue}>{receipt.courseName}</span>
                            </div>
                            <div className={styles.mobileCardRow}>
                              <span className={styles.mobileCardLabel}>Payment Mode</span>
                              <span className={styles.mobileCardValue}>{receipt.paymentMode}</span>
                            </div>
                            {receipt.periodFrom && receipt.periodTo && (
                              <div className={styles.mobileCardRow}>
                                <span className={styles.mobileCardLabel}>Period</span>
                                <span className={styles.mobileCardValue}>{receipt.periodFrom} → {receipt.periodTo}</span>
                              </div>
                            )}
                          </div>

                          <div className={styles.mobileCardActions}>
                            <button
                              onClick={() => handlePrintReceipt(receipt)}
                              className={styles.btnPrimary}
                              style={{ height: '34px', fontSize: '0.775rem' }}
                            >
                              Print Receipt
                            </button>
                            <button
                              onClick={() => handleOpenEditFeeModal(receipt)}
                              className={styles.btnSecondary}
                              style={{ height: '34px', fontSize: '0.775rem' }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteFee(receipt.id, receipt.receiptNo)}
                              className={styles.btnDestructive}
                              style={{ height: '34px', padding: '0 0.6rem' }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 5: SETTINGS & BACKUP (CONSTRAINED CONTAINER, REAL DENSITY) */}
          {!isTeacher && activeTab === 'settings' && (
            <div>
              <div className={styles.pageHeaderRow}>
                <div>
                  <h1 className={styles.pageTitle}>Console Settings</h1>
                  <div className={styles.pageMetaBadge}>
                    <span>Passcode, backups and issue reports</span>
                  </div>
                </div>
              </div>

              {/* Constrained width container (max-w-800px, left aligned) */}
              <div className={styles.settingsContainer}>
                {/* CARD 1: SECURITY CREDENTIALS */}
                <div className={styles.settingsCard}>
                  <h3 className={styles.settingsCardTitle}>
                    Console Passcode Security
                  </h3>
                  <p className={styles.settingsCardDesc}>
                    Update the secret passcode required to access soundabode.com/CMS-Admin.
                  </p>

                  <form onSubmit={handleChangePasscode} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="password"
                      placeholder="New admin passcode..."
                      value={newPasscode}
                      onChange={(e) => setNewPasscode(e.target.value)}
                      className={styles.formInput}
                      style={{ maxWidth: '280px', flex: 1, minWidth: '180px' }}
                    />
                    <button type="submit" className={styles.btnSecondary} style={{ height: '34px' }}>
                      Save Passcode
                    </button>
                  </form>
                  {settingsSuccessMsg && (
                    <div style={{ color: 'var(--text-success)', fontSize: '0.775rem', fontWeight: 500 }}>
                      {settingsSuccessMsg}
                    </div>
                  )}
                </div>

                {/* CARD 3: DATABASE BACKUP EXPORT & RESTORE */}
                <div className={styles.settingsCard}>
                  <h3 className={styles.settingsCardTitle}>
                    Data Snapshot Backup &amp; Restore
                  </h3>
                  <p className={styles.settingsCardDesc}>
                    Export/import full JSON database snapshots, or manage automated server-side rolling daily backups.
                  </p>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <button onClick={handleExportBackup} className={styles.btnSecondary} style={{ gap: '0.4rem' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export JSON Snapshot
                    </button>

                    <label className={styles.btnSecondary} style={{ gap: '0.4rem', cursor: 'pointer', margin: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      Restore from JSON Backup
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleImportBackup}
                        style={{ display: 'none' }}
                      />
                    </label>

                    <button onClick={handleGenerateServerBackup} className={styles.btnSecondary}>
                      Save server snapshot now
                    </button>
                  </div>

                  {/* Automated Server Snapshots Table */}
                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-medium)', paddingTop: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Automated Server Daily Snapshots ({serverBackups.length})
                      </h4>
                      <button onClick={fetchServerBackups} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}>
                        {isLoadingServerBackups ? 'Refreshing...' : 'Refresh List'}
                      </button>
                    </div>

                    {serverBackups.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>No server snapshots generated yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                        {serverBackups.map((b) => (
                          <div
                            key={b.filename}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                              padding: '0.45rem 0.75rem',
                              background: 'var(--table-hover-bg)',
                              borderRadius: '6px',
                              border: '1px solid var(--border-subtle)',
                              fontSize: '0.78rem',
                            }}
                          >
                            <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                              <div style={{ fontWeight: 500, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{b.filename}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {new Date(b.createdAt).toLocaleString()} · {(b.sizeBytes / 1024).toFixed(1)} KB
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button
                                onClick={() => handleRestoreServerBackup(b.filename)}
                                className={styles.btnSecondary}
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', color: 'var(--success-text)', borderColor: 'rgba(74, 222, 128, 0.3)' }}
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => handleDownloadServerBackup(b.filename)}
                                className={styles.btnSecondary}
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                              >
                                Download
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* CARD 4: DEVELOPER ISSUES LOG */}
                <div className={styles.settingsCard}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <h3 className={styles.settingsCardTitle} style={{ margin: 0 }}>
                    Developer Issues &amp; Bug Reports Log
                    </h3>
                    <button
                      onClick={() => {
                        setIsIssueModalOpen(true);
                        setIssueFeedbackToast(null);
                      }}
                      className={styles.btnSecondary}
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', color: 'var(--accent-text)', borderColor: 'rgba(225, 29, 72, 0.4)', gap: '0.3rem' }}
                    >
                      + New Issue
                    </button>
                  </div>
                  <p className={styles.settingsCardDesc}>
                    View and manage all issues submitted to the development team across all CMS user roles.
                  </p>

                  {developerIssues.length === 0 ? (
                    <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-btn)' }}>
                      No reported developer issues found. Click "New Issue" or the "Report Issue" top button to submit one.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.85rem' }}>
                      {developerIssues.map((issue) => (
                        <div
                          key={issue.id}
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-btn)',
                            padding: '0.75rem 1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                background: issue.priority === 'Critical' ? 'rgba(225, 29, 72, 0.2)' : issue.priority === 'High' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(161, 161, 170, 0.2)',
                                color: issue.priority === 'Critical' ? 'var(--accent-text)' : issue.priority === 'High' ? 'var(--warning-text)' : 'var(--text-secondary)',
                                border: `1px solid ${issue.priority === 'Critical' ? 'rgba(225, 29, 72, 0.4)' : issue.priority === 'High' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(161, 161, 170, 0.4)'}`
                              }}>
                                {issue.priority}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{issue.category}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <select
                                value={issue.status}
                                onChange={async (e) => {
                                  await IssueService.updateIssueStatus(issue.id, e.target.value as any);
                                  const updated = await IssueService.fetchIssues();
                                  setDeveloperIssues(updated);
                                }}
                                style={{
                                  background: 'var(--bg-panel)',
                                  color: issue.status === 'RESOLVED' ? 'var(--success-text)' : issue.status === 'IN_PROGRESS' ? 'var(--warning-text)' : 'var(--text-primary)',
                                  border: '1px solid var(--border-medium)',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  padding: '0.35rem 0.5rem',
                                  fontWeight: 600
                                }}
                                aria-label="Issue status"
                              >
                                <option value="OPEN">OPEN</option>
                                <option value="IN_PROGRESS">IN PROGRESS</option>
                                <option value="RESOLVED">RESOLVED</option>
                                <option value="CLOSED">CLOSED</option>
                              </select>
                              <button
                                onClick={async () => {
                                  if (confirm('Delete this issue report?')) {
                                    await IssueService.deleteIssue(issue.id);
                                    const updated = await IssueService.fetchIssues();
                                    setDeveloperIssues(updated);
                                  }
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', minWidth: '32px' }}
                                title="Delete issue"
                                aria-label="Delete issue"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                            {issue.title}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                            {issue.description}
                          </div>

                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <span>Reporter: <strong>{issue.reporterName}</strong> ({issue.reporterEmail} - {issue.reporterRole})</span>
                            <span>Date: {new Date(issue.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* CARD 5: META CONVERSIONS API */}
                <div className={styles.settingsCard} style={{ borderTop: '1px solid rgba(24, 119, 242, 0.25)', boxShadow: '0 0 0 1px rgba(24, 119, 242, 0.08) inset' }}>
                  <h3 className={styles.settingsCardTitle}>
                    Meta Conversions API
                  </h3>
                  <p className={styles.settingsCardDesc}>
                    Server-side CRM integration that sends lead stage changes (New, Contacted, Enrolled) to Meta Events Manager. Fires automatically when you update a lead status.
                  </p>

                  {/* Event mapping table */}
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--table-hover-bg)', borderBottom: '1px solid var(--border-subtle)' }}>
                          <th style={{ padding: '0.5rem 0.85rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>CRM Status</th>
                          <th style={{ padding: '0.5rem 0.85rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Meta CAPI Event</th>
                          <th style={{ padding: '0.5rem 0.85rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Fires Automatically</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(['NEW', 'CONTACTED', 'ENROLLED', 'ARCHIVED'] as const).map((s, idx) => {
                          const ev = getCapiEventNameForStatus(s);
                          return (
                            <tr key={s} style={{ borderBottom: idx < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                              <td style={{ padding: '0.5rem 0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{s}</td>
                              <td style={{ padding: '0.5rem 0.85rem', color: ev ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: ev ? 'normal' : 'italic' }}>{ev ?? 'No event'}</td>
                              <td style={{ padding: '0.5rem 0.85rem' }}>
                                {ev ? (
                                  <span style={{ color: 'var(--success-text)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>
                                    Yes
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>No</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Test event button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      id="meta-capi-test-btn"
                      disabled={capiTestStatus.loading}
                      onClick={async () => {
                        setCapiTestStatus({ loading: true, result: null, isError: false });
                        const result = await triggerCapiTestEvent();
                        setCapiTestStatus({
                          loading: false,
                          result: result.success ? 'Test event sent to Meta Events Manager. Check the Test Events tab.' : (result.error || result.message || 'Failed to send test event.'),
                          isError: !result.success,
                        });
                      }}
                      className={styles.btnSecondary}
                      style={{ gap: '0.4rem', borderColor: 'rgba(24, 119, 242, 0.4)', color: 'var(--text-primary)', opacity: capiTestStatus.loading ? 0.7 : 1 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      {capiTestStatus.loading ? 'Sending...' : 'Send Test Event to Meta'}
                    </button>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Requires META_TEST_EVENT_CODE in server/.env</span>
                  </div>

                  {capiTestStatus.result && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.6rem 0.85rem',
                      background: capiTestStatus.isError ? 'rgba(225, 29, 72, 0.08)' : 'rgba(74, 222, 128, 0.08)',
                      border: `1px solid ${capiTestStatus.isError ? 'rgba(225, 29, 72, 0.25)' : 'rgba(74, 222, 128, 0.25)'}`,
                      borderRadius: '6px',
                      fontSize: '0.775rem',
                      color: capiTestStatus.isError ? 'var(--accent-text)' : 'var(--success-text)',
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {capiTestStatus.isError ? <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/> : <><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></>}
                      </svg>
                      {capiTestStatus.result}
                    </div>
                  )}

                  <div style={{ marginTop: '0.85rem', padding: '0.6rem 0.85rem', background: 'rgba(24, 119, 242, 0.06)', border: '1px solid rgba(24, 119, 242, 0.15)', borderRadius: '6px', fontSize: '0.725rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    <strong>Setup required:</strong> Add your <code style={{ background: 'var(--bg-surface)', padding: '0 3px', borderRadius: '3px' }}>META_ACCESS_TOKEN</code> and <code style={{ background: 'var(--bg-surface)', padding: '0 3px', borderRadius: '3px' }}>META_TEST_EVENT_CODE</code> to <code style={{ background: 'var(--bg-surface)', padding: '0 3px', borderRadius: '3px' }}>server/.env</code>.
                    Generate token from: Meta Events Manager → Dataset 976314001636856 → Settings → Generate Token.
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* FEE RECEIPT MODAL (CREATE / EDIT) */}
      {isFeeModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: '580px' }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingFeeId ? 'Edit Receipt' : 'New Fee Receipt'}
              </h2>
              <button onClick={() => setIsFeeModalOpen(false)} className={styles.closeModalBtn}>✕</button>
            </div>

            <form onSubmit={handleSaveFee}>
              <div className={styles.modalBody}>
                {/* Amount preview banner */}
                {feeFormData.amount && parseFloat(feeFormData.amount) > 0 && (
                  <div style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    marginBottom: '1.25rem',
                    fontSize: '0.82rem',
                    color: 'var(--text-success)',
                    lineHeight: 1.5,
                  }}>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                      ₹{parseFloat(feeFormData.amount).toLocaleString('en-IN')}
                    </span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontStyle: 'italic' }}>
                      ({numberToWords(parseFloat(feeFormData.amount) || 0)} Rupees Only)
                    </span>
                  </div>
                )}

                <div className={styles.fieldGrid} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Receipt No / Form Ref */}
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Receipt No. / Form Ref *</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. SAS/V-9/DJ-1001 or 001"
                      value={feeFormData.receiptNo}
                      onChange={(e) => setFeeFormData({ ...feeFormData, receiptNo: e.target.value })}
                      required
                    />
                  </div>

                  {/* Receipt Date */}
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Receipt Date *</label>
                    <input
                      type="date"
                      className={styles.formInput}
                      value={feeFormData.date}
                      onChange={(e) => setFeeFormData({ ...feeFormData, date: e.target.value })}
                      required
                    />
                  </div>

                  {/* Student Name */}
                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label className={styles.formLabel}>Student Name *</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="Full name of student"
                      value={feeFormData.studentName}
                      onChange={(e) => setFeeFormData({ ...feeFormData, studentName: e.target.value })}
                      required
                    />
                  </div>

                  {/* Course Name */}
                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label className={styles.formLabel}>Course Name *</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="e.g. Basic Disc Jockey Course"
                      value={feeFormData.courseName}
                      onChange={(e) => setFeeFormData({ ...feeFormData, courseName: e.target.value })}
                      required
                    />
                  </div>

                  {/* Amount (editable) */}
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Amount (₹) *</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      placeholder="e.g. 35000"
                      min="0"
                      step="1"
                      value={feeFormData.amount}
                      onChange={(e) => setFeeFormData({ ...feeFormData, amount: e.target.value })}
                      required
                    />
                  </div>

                  {/* Payment Mode */}
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Payment Mode *</label>
                    <select
                      className={styles.formInput}
                      value={feeFormData.paymentMode}
                      onChange={(e) => setFeeFormData({ ...feeFormData, paymentMode: e.target.value })}
                    >
                      <option>Cash</option>
                      <option>UPI</option>
                      <option>Bank Transfer</option>
                      <option>Cheque</option>
                      <option>Card</option>
                      <option>Online</option>
                    </select>
                  </div>

                  {/* Period From */}
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Period From *</label>
                    <input
                      type="date"
                      className={styles.formInput}
                      value={feeFormData.periodFrom}
                      onChange={(e) => setFeeFormData({ ...feeFormData, periodFrom: e.target.value })}
                      required
                    />
                  </div>

                  {/* Period To */}
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Period To *</label>
                    <input
                      type="date"
                      className={styles.formInput}
                      value={feeFormData.periodTo}
                      onChange={(e) => setFeeFormData({ ...feeFormData, periodTo: e.target.value })}
                      required
                    />
                  </div>

                  {/* Comment */}
                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label className={styles.formLabel}>Comment / Note</label>
                    <textarea
                      className={styles.formInput}
                      placeholder="Optional note to include on the receipt (e.g. partial payment, installment 1/3...)"
                      rows={3}
                      value={feeFormData.comment}
                      onChange={(e) => setFeeFormData({ ...feeFormData, comment: e.target.value })}
                      style={{ resize: 'vertical', minHeight: '72px' }}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" onClick={() => setIsFeeModalOpen(false)} className={styles.btnSecondary}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  {editingFeeId ? 'Save Changes' : 'Issue Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL LEAD MESSAGE MODAL */}
      {notesLeadId && (() => {
        const lead = inquiries.find((i) => i.id === notesLeadId);
        if (!lead) return null;
        return (
          <div className={styles.modalOverlay} onClick={() => setNotesLeadId(null)}>
            <div className={`${styles.modalCard} ${styles.notesModal}`} role="dialog" aria-modal="true" aria-labelledby="lead-notes-title" onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div>
                  <h2 id="lead-notes-title" className={styles.modalTitle}>Notes · {lead.name}</h2>
                  <div className={styles.leadNoteHint}>
                    {lead.phone || lead.email} · {LEAD_STAGE_LABELS[lead.status]}{lead.courseInterest ? ` · ${lead.courseInterest}` : ''}
                  </div>
                </div>
                <button onClick={() => setNotesLeadId(null)} className={styles.closeModalBtn} aria-label="Close notes">✕</button>
              </div>
              <div className={styles.modalBody}>{renderLeadNotes(lead)}</div>
            </div>
          </div>
        );
      })()}

      {archivePrompt && (
        <div className={styles.modalOverlay} onClick={() => setArchivePrompt(null)}>
          <div className={`${styles.modalCard} ${styles.archiveModal}`} role="dialog" aria-modal="true" aria-labelledby="archive-lead-title" onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 id="archive-lead-title" className={styles.modalTitle}>
                Archive {archivePrompt.ids.length === 1 ? (inquiries.find((i) => i.id === archivePrompt.ids[0])?.name || 'lead') : `${archivePrompt.ids.length} leads`}
              </h2>
              <button onClick={() => setArchivePrompt(null)} className={styles.closeModalBtn} aria-label="Cancel">✕</button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.formGroup}>
                <span className={styles.formLabel}>Why is this lead being archived?</span>
                <select
                  autoFocus
                  className={styles.formSelect}
                  value={archivePrompt.reason}
                  onChange={(e) => setArchivePrompt({ ...archivePrompt, reason: e.target.value })}
                >
                  <option value="" disabled>Choose a reason…</option>
                  {ARCHIVE_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label className={styles.formGroup}>
                <span className={styles.formLabel}>Note {archivePrompt.reason === 'Other' ? '(required)' : '(optional)'}</span>
                <textarea
                  className={styles.formTextarea}
                  style={{ minHeight: '80px' }}
                  maxLength={500}
                  value={archivePrompt.note}
                  onChange={(e) => setArchivePrompt({ ...archivePrompt, note: e.target.value })}
                  placeholder={archivePrompt.reason === 'Other' ? 'Describe the reason' : 'Anything the team should know'}
                />
              </label>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setArchivePrompt(null)}>Cancel</button>
              <button
                className={styles.btnPrimary}
                onClick={confirmArchive}
                disabled={!archivePrompt.reason || (archivePrompt.reason === 'Other' && !archivePrompt.note.trim())}
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {expandedLeadMessage && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalCard} ${styles.leadDetailModal}`} role="dialog" aria-modal="true" aria-labelledby="lead-detail-title">
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.leadDetailEyebrow}>Prospect inquiry</p>
                <h2 id="lead-detail-title" className={styles.modalTitle}>Lead details</h2>
              </div>
              <button onClick={() => setExpandedLeadMessage(null)} className={styles.closeModalBtn} aria-label="Close lead details">
                ✕
              </button>
            </div>

            <div className={`${styles.modalBody} ${styles.leadDetailBody}`}>
              <section className={styles.leadProfile} aria-label="Prospect contact information">
                {(() => {
                  const avatar = getAvatarDetails(expandedLeadMessage.name);
                  return <div className={styles.leadAvatar} style={{ background: avatar.bg, borderColor: avatar.border }}>{avatar.initials}</div>;
                })()}
                <div className={styles.leadProfileInfo}>
                  <h3>{expandedLeadMessage.name}</h3>
                  <span className={`${styles.badge} ${styles[`badge${expandedLeadMessage.status.charAt(0)}${expandedLeadMessage.status.slice(1).toLowerCase()}` as keyof typeof styles] || ''}`}> {LEAD_STAGE_LABELS[expandedLeadMessage.status]}
                  </span>
                </div>
              </section>

              <section className={styles.leadContactGrid} aria-label="Contact methods">
                <a className={styles.leadContactCard} href={safeMailto(expandedLeadMessage.email)}>
                  <span className={styles.leadContactLabel}>Email</span>
                  <span className={styles.leadContactValue}>{expandedLeadMessage.email || 'Not provided'}</span>
                </a>
                <a className={styles.leadContactCard} href={expandedLeadMessage.phone ? `tel:${expandedLeadMessage.phone.replace(/\D/g, '')}` : '#'}>
                  <span className={styles.leadContactLabel}>Phone</span>
                  <span className={styles.leadContactValue}>{expandedLeadMessage.phone || 'Not provided'}</span>
                </a>
              </section>

              <section className={styles.leadProgramCard}>
                <span className={styles.leadSectionLabel}>Interested program</span>
                <strong>{expandedLeadMessage.courseInterest || 'Not specified'}</strong>
                <span className={styles.leadSubmittedAt}>
                  Received {new Date(expandedLeadMessage.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </section>

              {(() => {
                // Read the live record so changes made here show immediately
                const live = inquiries.find((i) => i.id === expandedLeadMessage.id) || expandedLeadMessage;
                return (
                  <section className={styles.leadProgramCard} aria-label="Lead workflow">
                    <span className={styles.leadSectionLabel}>Workflow</span>
                    <div className={styles.leadWorkflowGrid}>
                      <div>
                        <span className={styles.assigneeLabel}>Stage</span>
                        {renderStageSelect(live)}
                      </div>
                      {!isTeacher && (
                        <div>
                          <span className={styles.assigneeLabel}>Owner</span>
                          {renderAssignee(live, true)}
                        </div>
                      )}
                    </div>
                    {live.status === 'ARCHIVED' && renderArchiveReason(live)}
                    <span className={styles.leadSectionLabel} style={{ marginTop: '0.85rem' }}>
                      Call notes{(live.comments?.length || 0) > 0 ? ` (${live.comments!.length})` : ''}
                    </span>
                    {renderLeadNotes(live)}
                    {live.assignedTo && live.assignedAt && (
                      <span className={styles.leadSubmittedAt}>
                        Assigned to {live.assignedToName || live.assignedTo}
                        {live.assignedBy ? ` by ${live.assignedBy}` : ''} on {new Date(live.assignedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </span>
                    )}
                  </section>
                );
              })()}

              <section className={styles.leadAttributionCard}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span className={styles.leadSectionLabel}>Lead Attribution &amp; First-Touch Tracking</span>
                  {(() => {
                    const badge = getSourceBadgeDetails(expandedLeadMessage);
                    return (
                      <span className={`${styles.badge} ${badge.className}`} style={{ fontSize: '0.65rem' }}>
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>
                <div className={styles.attributionGrid}>
                  <div className={styles.attributionItem}>
                    <span className={styles.attributionKey}>Resolved Source</span>
                    <span className={styles.attributionVal}>{expandedLeadMessage.attribution?.source || expandedLeadMessage.source || 'Direct'}</span>
                  </div>
                  <div className={styles.attributionItem}>
                    <span className={styles.attributionKey}>Landing Page</span>
                    <span className={styles.attributionVal}>{expandedLeadMessage.attribution?.landing_page || '/'}</span>
                  </div>
                  <div className={styles.attributionItemFull}>
                    <span className={styles.attributionKey}>Referrer URL</span>
                    <span className={styles.attributionVal}>{expandedLeadMessage.attribution?.referrer || '(Direct / None)'}</span>
                  </div>
                  <div className={styles.attributionItem}>
                    <span className={styles.attributionKey}>UTM Source</span>
                    <span className={styles.attributionVal}>{expandedLeadMessage.attribution?.utm_source || 'N/A'}</span>
                  </div>
                  <div className={styles.attributionItem}>
                    <span className={styles.attributionKey}>UTM Medium</span>
                    <span className={styles.attributionVal}>{expandedLeadMessage.attribution?.utm_medium || 'N/A'}</span>
                  </div>
                  <div className={styles.attributionItem}>
                    <span className={styles.attributionKey}>UTM Campaign</span>
                    <span className={styles.attributionVal}>{expandedLeadMessage.attribution?.utm_campaign || 'N/A'}</span>
                  </div>
                  <div className={styles.attributionItem}>
                    <span className={styles.attributionKey}>UTM Content</span>
                    <span className={styles.attributionVal}>{expandedLeadMessage.attribution?.utm_content || 'N/A'}</span>
                  </div>
                  <div className={styles.attributionItem}>
                    <span className={styles.attributionKey}>UTM Term</span>
                    <span className={styles.attributionVal}>{expandedLeadMessage.attribution?.utm_term || 'N/A'}</span>
                  </div>
                  <div className={styles.attributionItem}>
                    <span className={styles.attributionKey}>Google Click ID (GCLID)</span>
                    <span className={styles.attributionVal}>{expandedLeadMessage.attribution?.gclid || 'N/A'}</span>
                  </div>
                  <div className={styles.attributionItem}>
                    <span className={styles.attributionKey}>Meta Click ID (FBCLID)</span>
                    <span className={styles.attributionVal}>{expandedLeadMessage.attribution?.fbclid || 'N/A'}</span>
                  </div>
                </div>
              </section>

              <section className={styles.leadMessageCard}>
                <span className={styles.leadSectionLabel}>Message</span>
                <p>{expandedLeadMessage.message?.trim() || 'No message was included with this inquiry.'}</p>
              </section>
            </div>

            <div className={styles.modalFooter}>
              {expandedLeadMessage.phone && (
                <a
                  href={safeWhatsAppUrl(expandedLeadMessage.phone, `Hello ${expandedLeadMessage.name}, this is Soundabode Studios regarding your inquiry about ${expandedLeadMessage.courseInterest || 'our courses'}.`)}
                  className={styles.btnPrimary}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp prospect
                </a>
              )}
              <button onClick={() => setExpandedLeadMessage(null)} className={styles.btnSecondary}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MARK ATTENDANCE MODAL (Student, Date, Time Slot & Class Comments) */}
      {isAttendanceModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: '480px' }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Mark Attendance &amp; Class Comments</h2>
              <button onClick={() => setIsAttendanceModalOpen(false)} className={styles.closeModalBtn}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAttendance}>
              <div className={styles.modalBody}>
                {/* STUDENT SELECTION */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Select Enrolled Student</label>
                  <input
                    type="search"
                    placeholder="Type to filter students..."
                    value={attendancePickerSearch}
                    onChange={(e) => setAttendancePickerSearch(e.target.value)}
                    className={styles.searchInput}
                    style={{ width: '100%', maxWidth: 'none', marginBottom: '0.4rem' }}
                    aria-label="Filter student list"
                  />
                  <select
                    value={selectedStudentId || ''}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedStudentId(newId);
                      const records = AttendanceService.getAttendanceForStudent(newId, currentUser || undefined);
                      const targetDate = attendanceFormDate || selectedDateStr || getTodayDateStr();
                      const existing = selectedTimeSlot
                        ? records.find((r) => r.date === targetDate && r.timeSlot === selectedTimeSlot)
                        : records.find((r) => r.date === targetDate);
                      if (existing) {
                        setEditingAttendanceId(existing.id);
                        setAttendanceFormStatus(existing.status as AttendanceStatus);
                        setAttendanceFormComment(existing.comment || '');
                      } else {
                        setEditingAttendanceId(null);
                        setAttendanceFormStatus('PRESENT');
                        setAttendanceFormComment('');
                      }
                    }}
                    className={styles.selectInput}
                    style={{ width: '100%' }}
                  >
                    {markableEntries
                      .filter((e) => e.key === selectedStudentId || entryMatches(e, attendancePickerSearch))
                      .map((e) => (
                      <option key={e.key} value={e.key}>
                        {e.kind === 'course' ? entryLabel(e) : `${e.student.name} (${getStudentCourses(e.student).join(' & ') || e.student.course || 'General'})`}
                      </option>
                    ))}
                    {activeEntry && !markableEntries.some((e) => e.key === activeEntry.key) && (
                      <option value={selectedStudentId || ''}>
                        {activeEntry.kind === 'unmatched' ? entryLabel(activeEntry) : `${activeEntry.student.name} (all courses)`}
                      </option>
                    )}
                  </select>
                </div>

                {/* DATE & TIME ROW */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {/* SESSION DATE */}
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Attendance Date</label>
                    <input
                      type="date"
                      value={attendanceFormDate}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setAttendanceFormDate(newDate);
                        if (selectedStudentId) {
                          const records = AttendanceService.getAttendanceForStudent(selectedStudentId, currentUser || undefined);
                          const existing = selectedTimeSlot
                            ? records.find((r) => r.date === newDate && r.timeSlot === selectedTimeSlot)
                            : records.find((r) => r.date === newDate);
                          if (existing) {
                            setEditingAttendanceId(existing.id);
                            setAttendanceFormStatus(existing.status as AttendanceStatus);
                            setAttendanceFormComment(existing.comment || '');
                          } else {
                            setEditingAttendanceId(null);
                            setAttendanceFormStatus('PRESENT');
                            setAttendanceFormComment('');
                          }
                        }
                      }}
                      className={styles.searchInput}
                      style={{ width: '100%', maxWidth: 'none' }}
                    />
                  </div>

                  {/* CUSTOM TIME SLOT PICKER */}
                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label className={styles.formLabel}>Custom Time Slot</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label className={styles.formLabel} style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Start Time</label>
                        <input
                          type="time"
                          value={customTimeStart}
                          onChange={(e) => setCustomTimeStart(e.target.value)}
                          className={styles.searchInput}
                          style={{ width: '100%', maxWidth: 'none' }}
                          required
                        />
                      </div>
                      <div>
                        <label className={styles.formLabel} style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>End Time</label>
                        <input
                          type="time"
                          value={customTimeEnd}
                          onChange={(e) => setCustomTimeEnd(e.target.value)}
                          className={styles.searchInput}
                          style={{ width: '100%', maxWidth: 'none' }}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ATTENDANCE STATUS */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Attendance Status</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setAttendanceFormStatus('PRESENT')}
                      style={{
                        background: attendanceFormStatus === 'PRESENT' ? 'rgba(52, 211, 153, 0.15)' : 'var(--bg-surface)',
                        color: attendanceFormStatus === 'PRESENT' ? 'var(--success-text)' : 'var(--text-primary)',
                        border: `1px solid ${attendanceFormStatus === 'PRESENT' ? 'var(--success-text)' : 'var(--border-subtle)'}`,
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success-text)', display: 'inline-block' }} />
                      PRESENT
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceFormStatus('ABSENT')}
                      style={{
                        background: attendanceFormStatus === 'ABSENT' ? 'rgba(248, 113, 113, 0.15)' : 'var(--bg-surface)',
                        color: attendanceFormStatus === 'ABSENT' ? 'var(--accent-text)' : 'var(--text-primary)',
                        border: `1px solid ${attendanceFormStatus === 'ABSENT' ? 'var(--accent-text)' : 'var(--border-subtle)'}`,
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent-text)', display: 'inline-block' }} />
                      ABSENT
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceFormStatus('PRACTICE_SESSION')}
                      style={{
                        background: (attendanceFormStatus === 'PRACTICE_SESSION' || attendanceFormStatus === 'NA') ? 'rgba(192, 132, 252, 0.15)' : 'var(--bg-surface)',
                        color: (attendanceFormStatus === 'PRACTICE_SESSION' || attendanceFormStatus === 'NA') ? '#c084fc' : 'var(--text-primary)',
                        border: `1px solid ${attendanceFormStatus === 'PRACTICE_SESSION' || attendanceFormStatus === 'NA' ? '#c084fc' : 'var(--border-subtle)'}`,
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block' }} />
                      PRACTICE SESSION
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceFormStatus('GROUP_SESSION')}
                      style={{
                        background: attendanceFormStatus === 'GROUP_SESSION' ? 'var(--bg-hover)' : 'var(--bg-surface)',
                        color: attendanceFormStatus === 'GROUP_SESSION' ? 'var(--text-primary)' : 'var(--text-primary)',
                        border: `1px solid ${attendanceFormStatus === 'GROUP_SESSION' ? 'var(--text-primary)' : 'var(--border-subtle)'}`,
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block' }} />
                      GROUP SESSION
                    </button>
                  </div>
                </div>

                {/* GROUP SESSION ATTENDEES SUMMARY BOX */}
                {attendanceFormStatus === 'GROUP_SESSION' && (() => {
                  const targetModalDate = attendanceFormDate || selectedDateStr;
                  const modalGroupDetails = getGroupSessionDetails(targetModalDate);
                  return (
                    <div
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '8px',
                        padding: '0.75rem 0.85rem',
                        marginBottom: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Group Session ({modalGroupDetails.count} Student{modalGroupDetails.count === 1 ? '' : 's'} Present)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAttendanceModalOpen(false);
                            handleOpenGroupAttendanceModal(targetModalDate);
                          }}
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-strong)',
                            color: 'var(--text-primary)',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '0.725rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          View / Edit Group Attendees
                        </button>
                      </div>

                      {modalGroupDetails.students.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                          {modalGroupDetails.students.map((st) => (
                            <span
                              key={st.id}
                              style={{
                                fontSize: '0.725rem',
                                background: 'var(--bg-surface)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-subtle)',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontWeight: 500,
                              }}
                            >
                              {st.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                          No other students linked to this group session yet. Click "View / Edit Group Attendees" to add students.
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* CLASS COMMENTS / MENTOR NOTES */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Class Comments &amp; Topics Covered</label>
                  <textarea
                    rows={3}
                    placeholder="Enter class comments, topics covered (e.g. Ableton MIDI, Rekordbox beatmatching), student performance, homework assigned..."
                    value={attendanceFormComment}
                    onChange={(e) => setAttendanceFormComment(e.target.value)}
                    className={styles.searchInput}
                    style={{ width: '100%', maxWidth: 'none', height: 'auto', minHeight: '75px', padding: '0.5rem 0.75rem' }}
                  />
                </div>
              </div>

              <div className={styles.modalFooter} style={{ justifyContent: 'space-between', width: '100%', display: 'flex', alignItems: 'center' }}>
                {editingAttendanceId || (selectedStudentId && activeAttendanceRecords.some((r) => r.date === (attendanceFormDate || selectedDateStr))) ? (
                  <button
                    type="button"
                    onClick={handleDeleteCurrentAttendance}
                    className={styles.btnDestructive}
                    style={{ height: '36px', fontSize: '0.8rem', padding: '0 0.85rem' }}
                  >
                    Delete Attendance
                  </button>
                ) : (
                  <div />
                )}

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button type="button" onClick={() => setIsAttendanceModalOpen(false)} className={styles.btnSecondary}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.btnPrimary}>
                    Save Attendance Session
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GROUP SESSION MULTI-STUDENT BATCH ATTENDANCE MODAL */}
      {isGroupAttendanceModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsGroupAttendanceModalOpen(false)}>
          <div
            className={styles.modalCard}
            style={{ maxWidth: '640px', width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: 'var(--text-primary)' }}>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  Mark Group Session Attendance
                </h2>
                <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Select multiple students attending this group session to mark their attendance simultaneously.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsGroupAttendanceModalOpen(false)}
                className={styles.closeBtn}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGroupAttendance}>
              <div className={styles.modalBody}>
                {/* DATE & TIME CONTROLS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Session Date</label>
                    <input
                      type="date"
                      value={groupSessionDate}
                      onChange={(e) => setGroupSessionDate(e.target.value)}
                      className={styles.searchInput}
                      style={{ width: '100%', maxWidth: 'none' }}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Attendance Status</label>
                    <select
                      value={groupSessionStatus}
                      onChange={(e) => setGroupSessionStatus(e.target.value as AttendanceStatus)}
                      className={styles.searchInput}
                      style={{ width: '100%', maxWidth: 'none', background: 'var(--bg-surface)' }}
                    >
                      <option value="GROUP_SESSION">Group Session</option>
                      <option value="PRESENT">Present</option>
                      <option value="PRACTICE_SESSION">Practice Session</option>
                      <option value="ABSENT">Absent</option>
                    </select>
                  </div>

                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label className={styles.formLabel}>Custom Time Slot</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label className={styles.formLabel} style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Start Time</label>
                        <input
                          type="time"
                          value={groupCustomTimeStart}
                          onChange={(e) => setGroupCustomTimeStart(e.target.value)}
                          className={styles.searchInput}
                          style={{ width: '100%', maxWidth: 'none' }}
                          required
                        />
                      </div>
                      <div>
                        <label className={styles.formLabel} style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>End Time</label>
                        <input
                          type="time"
                          value={groupCustomTimeEnd}
                          onChange={(e) => setGroupCustomTimeEnd(e.target.value)}
                          className={styles.searchInput}
                          style={{ width: '100%', maxWidth: 'none' }}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* MULTI-STUDENT SELECTOR HEADER */}
                <div className={styles.formGroup} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label className={styles.formLabel} style={{ margin: 0 }}>
                      Select Present Students ({selectedGroupStudentIds.length} of {markableEntries.length} selected)
                    </label>
                    <button
                      type="button"
                      onClick={handleToggleSelectAllGroupStudents}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {selectedGroupStudentIds.length === markableEntries.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Search student by name or course..."
                    value={groupStudentSearchQuery}
                    onChange={(e) => setGroupStudentSearchQuery(e.target.value)}
                    className={styles.searchInput}
                    style={{ width: '100%', maxWidth: 'none', marginBottom: '0.65rem' }}
                  />

                  {/* SCROLLABLE STUDENTS CHECKBOX LIST */}
                  <div
                    style={{
                      maxHeight: '190px',
                      overflowY: 'auto',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      background: 'var(--bg-surface)',
                      padding: '0.4rem'
                    }}
                  >
                    {filteredGroupEntries.map((entry) => {
                      const std = entry.student;
                      const isChecked = selectedGroupStudentIds.some((id) => canonicalizeStudentId(id) === canonicalizeStudentId(entry.key));
                      const avatar = getAvatarDetails(std.name, std.avatarUrl);

                      return (
                        <label
                          key={entry.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.65rem',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            background: isChecked ? 'var(--bg-hover)' : 'transparent',
                            border: `1px solid ${isChecked ? 'var(--border-strong)' : 'transparent'}`,
                            marginBottom: '3px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelectGroupStudent(entry.key)}
                            style={{ width: '16px', height: '16px', accentColor: 'var(--accent-red)', cursor: 'pointer' }}
                          />

                          {avatar.avatarUrl ? (
                            <img src={avatar.avatarUrl} alt={std.name} style={{ width: '26px', height: '26px', borderRadius: '50%' }} />
                          ) : (
                            <div className={styles.avatarCircle} style={{ width: '26px', height: '26px', fontSize: '0.7rem', background: avatar.bg }}>
                              {avatar.initials}
                            </div>
                          )}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{std.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{entry.kind === 'single' ? (getStudentCourses(std).join(' & ') || std.course) : entry.course} • {entry.batch}</div>
                          </div>
                        </label>
                      );
                    })}

                    {filteredGroupEntries.length === 0 && (
                      <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                        No students found matching "{groupStudentSearchQuery}".
                      </div>
                    )}
                  </div>
                </div>

                {/* SESSION COMMENTS / TOPICS */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Group Session Topics &amp; Class Comments</label>
                  <textarea
                    rows={2}
                    placeholder="e.g., Ableton Live MIDI Routing &amp; Performance Jam Session"
                    value={groupSessionComment}
                    onChange={(e) => setGroupSessionComment(e.target.value)}
                    className={styles.searchInput}
                    style={{ width: '100%', maxWidth: 'none', height: 'auto', minHeight: '65px', padding: '0.5rem 0.75rem' }}
                  />
                </div>
              </div>

              <div className={styles.modalFooter} style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {selectedGroupStudentIds.length} student(s) selected
                </span>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={() => setIsGroupAttendanceModalOpen(false)} className={styles.btnSecondary}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={selectedGroupStudentIds.length === 0}
                  >
                    Save Group Attendance ({selectedGroupStudentIds.length})
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ENROLL / EDIT STUDENT MODAL */}
      {isStudentModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: '520px' }}>
            {/* MODAL HEADER */}
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  background: 'var(--bg-surface)', border: '1px solid var(--border-medium)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <h2 className={styles.modalTitle}>
                  {editingStudentId ? 'Edit Student Details' : 'Enroll New Student'}
                </h2>
              </div>
              <button onClick={() => setIsStudentModalOpen(false)} className={styles.closeModalBtn}
                style={{
                  width: '28px', height: '28px', borderRadius: '6px',
                  background: 'var(--bg-hover)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '0.9rem'
                }}
              >✕</button>
            </div>

            <form onSubmit={handleSaveStudent}>
              <div className={styles.modalBody} style={{ gap: '0.9rem' }}>

                {/* NAME */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Student Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Yogesh Kashid"
                    value={studentFormData.name}
                    onChange={(e) => setStudentFormData({ ...studentFormData, name: e.target.value })}
                    className={styles.formInput}
                  />
                </div>

                {/* EMAIL + PHONE */}
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="student@example.com"
                      value={studentFormData.email}
                      onChange={(e) => setStudentFormData({ ...studentFormData, email: e.target.value })}
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Phone Number</label>
                    <input
                      type="text"
                      required
                      placeholder="+91 98220 00000"
                      value={studentFormData.phone}
                      onChange={(e) => setStudentFormData({ ...studentFormData, phone: e.target.value })}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                {/* COURSE OPTED (MULTI-COURSE CAPABLE) */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    Enrolled Courses (Select one or multiple)
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    {[
                      'Pro DJ Course',
                      'Basic DJ Course',
                      'Special DJ Course',
                      'DJ Course',
                      'EMP Diploma',
                      'EMP Basic',
                      'Audio Engineering & Sound Design',
                    ].map((cName) => {
                      const isSelected = (studentFormData.courses || []).some(
                        (c) => c.toLowerCase() === cName.toLowerCase()
                      );
                      return (
                        <button
                          key={cName}
                          type="button"
                          onClick={() => {
                            const current = studentFormData.courses || [];
                            const updated = isSelected
                              ? current.filter((c) => c.toLowerCase() !== cName.toLowerCase())
                              : [...current, cName];
                            setStudentFormData({
                              ...studentFormData,
                              courses: updated,
                              course: updated.join(', '),
                            });
                          }}
                          style={{
                            padding: '0.3rem 0.6rem',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            borderRadius: '6px',
                            border: isSelected ? '1px solid var(--text-primary)' : '1px solid var(--border-medium)',
                            background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface)',
                            color: isSelected ? 'var(--accent-primary, #818cf8)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isSelected ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--border-medium)', display: 'inline-block' }} />
                          )}
                          {cName}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    placeholder="Course name(s), separated by commas if multiple..."
                    value={studentFormData.course}
                    onChange={(e) => {
                      const val = e.target.value;
                      const split = val.split(',').map((s) => s.trim()).filter(Boolean);
                      setStudentFormData({
                        ...studentFormData,
                        course: val,
                        courses: split.length > 0 ? split : [val],
                      });
                    }}
                    className={styles.formInput}
                    style={{ fontSize: '0.8rem' }}
                  />
                </div>

                {/* DATE & BATCH ROW */}
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Enrolled Date</label>
                    <input
                      type="date"
                      value={studentFormData.enrolledDate}
                      onChange={(e) => setStudentFormData({ ...studentFormData, enrolledDate: e.target.value })}
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Batch &amp; Schedule</label>
                    <input
                      type="text"
                      placeholder="e.g. Regular Studio Batch (Mon/Wed/Fri)"
                      value={studentFormData.batch}
                      onChange={(e) => setStudentFormData({ ...studentFormData, batch: e.target.value })}
                      className={styles.formInput}
                    />
                  </div>
                </div>

              </div>

              <div className={styles.modalFooter}>
                <button type="button" onClick={() => setIsStudentModalOpen(false)} className={styles.btnSecondary}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  {editingStudentId ? 'Save Changes' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE / PDF ATTENDANCE REPORT MODAL */}
      {isReportModalOpen && activeStudent && (
        <div className={styles.modalOverlay} id="attendanceReportOverlay">
          <div className={styles.modalCard} style={{ maxWidth: '840px', background: 'var(--bg-page)' }}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <h2 className={styles.modalTitle}>Official Student Attendance Report</h2>
              </div>
              <button onClick={() => setIsReportModalOpen(false)} className={styles.closeModalBtn} aria-label="Close modal">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={`${styles.modalBody} ${styles.paperSheet}`} style={{ background: '#ffffff', color: '#0f172a', padding: '1.5rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2.5px solid #e11d48', paddingBottom: '0.85rem', marginBottom: '1.25rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <img
                    src="/favicon-192x192.png"
                    alt="Soundabode Logo"
                    style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'contain' }}
                  />
                  <div>
                    <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--accent-text)', margin: 0, letterSpacing: '0.5px' }}>SOUNDABODE ACADEMY</h1>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vision 9 Mall, Pimple Saudagar, Pune • Audio Engineering &amp; DJ Academy</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <div>Report Date: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                  <div style={{ fontWeight: 800, color: '#0f172a', marginTop: '2px', letterSpacing: '0.5px' }}>OFFICIAL ATTENDANCE REPORT</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '6px', marginBottom: '1.25rem', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.4px' }}>STUDENT NAME</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{activeStudent.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{activeStudent.email || 'No email registered'} • {activeStudent.phone || 'No phone'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.4px' }}>PROGRAM &amp; BATCH</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>{getStudentCourses(activeStudent).join(', ') || activeStudent.course || 'Audio Engineering & DJ'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{activeStudent.batch || 'Regular Studio Batch'}</div>
                </div>
              </div>

              {/* STATS SUMMARY */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '0.65rem', marginBottom: '1.25rem' }}>
                <div style={{ background: '#f1f5f9', padding: '0.65rem 0.75rem', borderRadius: '6px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL CLASSES</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{reportSummary.total}</div>
                </div>
                <div style={{ background: '#ecfdf5', padding: '0.65rem 0.75rem', borderRadius: '6px', textAlign: 'center', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '0.66rem', color: 'var(--success-text)', fontWeight: 700 }}>PRESENT</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success-text)', marginTop: '2px' }}>{reportSummary.present}</div>
                </div>
                <div style={{ background: '#fef2f2', padding: '0.65rem 0.75rem', borderRadius: '6px', textAlign: 'center', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '0.66rem', color: 'var(--accent-text)', fontWeight: 700 }}>ABSENT</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-text)', marginTop: '2px' }}>{reportSummary.absent}</div>
                </div>
                <div style={{ background: '#fef3c7', padding: '0.65rem 0.75rem', borderRadius: '6px', textAlign: 'center', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '0.66rem', color: 'var(--warning-text)', fontWeight: 700 }}>ATTENDANCE RATE</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--warning-text)', marginTop: '2px' }}>{reportSummary.rate}%</div>
                </div>
              </div>

              {/* LOGS TABLE (Wrapped with horizontal scroll for mobile safety) */}
              <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <table style={{ width: '100%', minWidth: '580px', borderCollapse: 'collapse', fontSize: '0.775rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '0.5rem 0.6rem', width: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>#</th>
                      <th style={{ padding: '0.5rem 0.6rem', width: '95px' }}>Date</th>
                      <th style={{ padding: '0.5rem 0.6rem', width: '155px' }}>Time Slot</th>
                      <th style={{ padding: '0.5rem 0.6rem', width: '120px', textAlign: 'center' }}>Status</th>
                      {!isTeacher && <th style={{ padding: '0.5rem 0.6rem', width: '95px' }}>Marked By</th>}
                      <th style={{ padding: '0.5rem 0.6rem' }}>Mentor Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportSummary.classes.map((r, idx) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.72rem' }}>{idx + 1}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.date}</td>
                        <td style={{ padding: '0.45rem 0.6rem', whiteSpace: 'nowrap' }}>{r.timeSlot}</td>
                        <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            letterSpacing: '0.2px',
                            background: reportStatusLabel(r.status) === 'PRESENT'
                              ? '#ecfdf5'
                              : r.status === 'ABSENT'
                                ? '#fef2f2'
                                : '#faf5ff',
                            color: reportStatusLabel(r.status) === 'PRESENT'
                              ? '#047857'
                              : r.status === 'ABSENT'
                                ? '#b91c1c'
                                : '#7e22ce',
                            border: `1px solid ${
                              reportStatusLabel(r.status) === 'PRESENT'
                                ? '#a7f3d0'
                                : r.status === 'ABSENT'
                                  ? '#fecaca'
                                  : '#e9d5ff'
                            }`
                          }}>
                            {reportStatusLabel(r.status)}
                          </span>
                        </td>
                        {!isTeacher && (
                          <td style={{ padding: '0.45rem 0.6rem', fontWeight: 600, color: 'var(--accent-text)', whiteSpace: 'nowrap' }}>
                            {r.markedByName || 'Staff'}
                          </td>
                        )}
                        <td style={{ padding: '0.45rem 0.6rem', color: '#334155' }}>{r.comment || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.modalFooter} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {reportSummary.total} class{reportSummary.total !== 1 ? 'es' : ''} for {activeStudent.name}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className={styles.btnSecondary}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleExportStudentAttendanceCSV(activeStudent)}
                  className={styles.btnSecondary}
                  style={{ gap: '0.4rem', fontSize: '0.8rem' }}
                  title="Export raw attendance records to CSV / Excel spreadsheet"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintAttendanceReport(activeStudent)}
                  className={styles.btnPrimary}
                  style={{ gap: '0.45rem', fontWeight: 600 }}
                  title="Open formatted A4 report to Print or Save as PDF"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Print / Save PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FULL ADMISSION FORM VIEWER & SHARE OPTIONS */}
      {selectedAdmissionForModal && (
        <div className={styles.modalOverlay} onClick={() => setSelectedAdmissionForModal(null)}>
          <div
            className={styles.modalContainer}
            style={{ maxWidth: '820px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className={styles.modalTitle} style={{ margin: 0 }}>
                  Submission Details &amp; Share ({selectedAdmissionForModal.formNo})
                </h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Submitted on {new Date(selectedAdmissionForModal.submittedAt).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => setSelectedAdmissionForModal(null)}
                className={styles.modalCloseBtn}
                title="Close modal"
              >
                ✕
              </button>
            </div>

            {/* ACTION & SHARE BAR */}
            <div style={{ padding: '0.75rem 1.25rem', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className={styles.btnSecondary}
                style={{ fontSize: '0.8rem' }}
                onClick={() => handleCopyAdmissionLink(selectedAdmissionForModal)}
              >
                Copy Share Link
              </button>

              <a
                href={selectedAdmissionForModal ? safeAdmissionWhatsAppUrl(selectedAdmissionForModal) : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnSecondary}
                style={{ fontSize: '0.8rem', textDecoration: 'none' }}
              >
                Send via WhatsApp
              </a>

              <a
                href={safeMailto(
                  selectedAdmissionForModal.email,
                  `Soundabode Studios Official Admission Form (${selectedAdmissionForModal.formNo})`,
                  `Dear ${selectedAdmissionForModal.firstName} ${selectedAdmissionForModal.lastName},\n\nYour official admission form for ${selectedAdmissionForModal.courseOpted} (${selectedAdmissionForModal.fee}) has been registered.\n\nForm Reference: ${selectedAdmissionForModal.formNo}\nView & Print Document: ${window.location.origin}/admission-${selectedAdmissionForModal.formType.toLowerCase()}?id=${selectedAdmissionForModal.id}\n\nSoundabode Studios Team`
                )}
                className={styles.btnSecondary}
                style={{ fontSize: '0.8rem', textDecoration: 'none' }}
              >
                Send Email
              </a>

              <button
                type="button"
                onClick={() => {
                  handleGenerateReceiptFromAdmission(selectedAdmissionForModal);
                  setSelectedAdmissionForModal(null);
                }}
                className={styles.btnSecondary}
                style={{ fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Generate Receipt
              </button>

              <button
                type="button"
                onClick={() => handlePrintAdmissionForm(selectedAdmissionForModal)}
                className={styles.btnPrimary}
                style={{ fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Print / Save PDF
              </button>
            </div>

            {/* AUTHENTIC PRINTABLE DOCUMENT PAPER VIEW INSIDE CMS */}
            <div className={styles.modalBody} style={{ padding: '1rem', overflowY: 'auto', background: '#090a0f' }}>
              <div className={admissionStyles.formDocument}>
                {/* Header with Official SoundAbode Logo */}
                <div className={admissionStyles.docHeader}>
                  <div className={admissionStyles.docBrandHeader}>
                    <img
                      src="/favicon-192x192.png"
                      alt="SoundAbode Logo"
                      className={admissionStyles.docLogoImg}
                    />
                    <div>
                      <h2 className={admissionStyles.docTitleH2}>Training Form</h2>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {selectedAdmissionForModal.formType === 'DJ' ? 'Disk Jockey Training Course' : 'Electronic Music Production'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className={admissionStyles.docFormNo}>Form No. {selectedAdmissionForModal.formNo}</div>
                    <div className={admissionStyles.passportPhotoWrapper}>
                      {selectedAdmissionForModal.photoUrl && safeImageUrl(selectedAdmissionForModal.photoUrl) ? (
                        <img src={safeImageUrl(selectedAdmissionForModal.photoUrl)} alt="Applicant Passport Photo" className={admissionStyles.passportPhotoImg} />
                      ) : (
                        <div className={admissionStyles.passportPhotoPlaceholder}>
                          <span className={admissionStyles.passportPhotoLabel}>Affix Photo</span>
                          <span className={admissionStyles.passportPhotoSub}>1.5" × 2"</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Trainee Info Section Bar */}
                <div className={admissionStyles.sectionHeaderBar}>Trainee Info</div>

                <div className={admissionStyles.fieldGrid}>
                  <div className={admissionStyles.formGroup}>
                    <label>First Name <span className={admissionStyles.reqStar}>*</span></label>
                    <input type="text" className={admissionStyles.formInput} value={selectedAdmissionForModal.firstName} readOnly />
                  </div>

                  <div className={admissionStyles.formGroup}>
                    <label>Last Name <span className={admissionStyles.reqStar}>*</span></label>
                    <input type="text" className={admissionStyles.formInput} value={selectedAdmissionForModal.lastName} readOnly />
                  </div>

                  <div className={admissionStyles.formGroup}>
                    <label>Cell Phone <span className={admissionStyles.reqStar}>*</span></label>
                    <input type="tel" className={admissionStyles.formInput} value={selectedAdmissionForModal.cellPhone} readOnly />
                  </div>

                  <div className={admissionStyles.formGroup}>
                    <label>Work Phone</label>
                    <input type="tel" className={admissionStyles.formInput} value={selectedAdmissionForModal.workPhone || ''} readOnly />
                  </div>

                  <div className={admissionStyles.formGroup}>
                    <label>Email <span className={admissionStyles.reqStar}>*</span></label>
                    <input type="email" className={admissionStyles.formInput} value={selectedAdmissionForModal.email} readOnly />
                  </div>

                  <div className={admissionStyles.formGroup}>
                    <label>Aadhar / ID Proof No. <span className={admissionStyles.reqStar}>*</span></label>
                    <input type="text" className={admissionStyles.formInput} value={selectedAdmissionForModal.aadharNo} readOnly />
                  </div>

                  <div className={`${admissionStyles.formGroup} ${admissionStyles.fullWidth}`}>
                    <label>Father's Name <span className={admissionStyles.reqStar}>*</span></label>
                    <input type="text" className={admissionStyles.formInput} value={selectedAdmissionForModal.fatherName} readOnly />
                  </div>

                  <div className={`${admissionStyles.formGroup} ${admissionStyles.fullWidth}`}>
                    <label>Address / ID Proof Details <span className={admissionStyles.reqStar}>*</span></label>
                    <textarea className={`${admissionStyles.formInput} ${admissionStyles.formTextarea}`} value={selectedAdmissionForModal.address} readOnly />
                  </div>
                </div>

                {/* Course Opting For Section Bar */}
                <div className={admissionStyles.sectionHeaderBar}>Course Opting For</div>

                <table className={admissionStyles.courseTable}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>SELECT</th>
                      <th>COURSE OPTION</th>
                      <th style={{ width: '120px' }}>TENURE</th>
                      <th style={{ width: '120px' }}>FEE AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedAdmissionForModal.formType === 'DJ' ? DJ_COURSES : EMP_COURSES).map((c) => {
                      const isSelected = selectedAdmissionForModal.courseOpted.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(selectedAdmissionForModal.courseOpted.toLowerCase());
                      return (
                        <tr
                          key={c.id}
                          className={`${admissionStyles.courseTableRow} ${isSelected ? admissionStyles.selectedRow : ''
                            }`}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <div className={admissionStyles.checkboxSquare}>
                              {isSelected ? <span className={admissionStyles.checkedMarkText}>✓</span> : null}
                            </div>
                          </td>
                          <td>
                            <strong>{c.name}</strong>
                            {isSelected && <span className={admissionStyles.selectedBadgePrint}> (SELECTED)</span>}
                          </td>
                          <td>{c.tenure}</td>
                          <td><strong>{c.fee}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Disclaimer & Studio Rules */}
                <div className={admissionStyles.sectionHeaderBar} style={{ marginTop: '1.5rem' }}>
                  Disclaimer &amp; Studio Rules
                </div>

                <ol className={admissionStyles.disclaimerList}>
                  {(selectedAdmissionForModal.formType === 'DJ' ? DJ_DISCLAIMER : EMP_DISCLAIMER).map((rule, idx) => (
                    <li key={idx}>{rule}</li>
                  ))}
                </ol>

                {/* Agreement Clause */}
                <div className={admissionStyles.agreementBox}>
                  <p className={admissionStyles.agreementParagraph}>
                    I <strong>{selectedAdmissionForModal.firstName} {selectedAdmissionForModal.lastName}</strong> hereby agree with the terms and conditions laid down by SoundAbode Studios for <strong>{selectedAdmissionForModal.courseOpted}</strong> and therefore paying in:
                  </p>

                  <div className={admissionStyles.paymentToggleGroup}>
                    <div className={`${admissionStyles.paymentToggleOption} ${admissionStyles.paymentToggleActive}`}>
                      <span className={admissionStyles.toggleRadioIcon}>✓</span>
                      <span>{selectedAdmissionForModal.paymentOption || 'Full Payment'}</span>
                    </div>
                  </div>

                  <div className={admissionStyles.fieldGrid} style={{ marginBottom: '0.85rem' }}>
                    <div className={admissionStyles.formGroup}>
                      <label style={{ fontSize: '0.78rem' }}>
                        Student Signature (Typed Name) <span className={admissionStyles.reqStar}>*</span>
                      </label>
                      <input
                        type="text"
                        className={admissionStyles.formInput}
                        value={selectedAdmissionForModal.signatureName}
                        readOnly
                      />
                    </div>
                  </div>

                  <label className={admissionStyles.agreedLabel}>
                    <input type="checkbox" checked={selectedAdmissionForModal.agreedToTerms} readOnly />
                    I confirm that I have read and agree to abide by all the terms, conditions, and studio rules laid down by SoundAbode Studios.
                  </label>
                </div>

                {/* Document Footer Branding with SoundAbode Logo */}
                <div className={admissionStyles.docFooterBranding}>
                  <div className={admissionStyles.addressText}>
                    <strong>VISION 9 MALL, SHOP 218</strong>, PIMPLE SAUDAGAR, PUNE – 411017<br />
                    PH: 9975016189 | EMAIL: SERVICES@SOUNDABODE.COM | WWW.SOUNDABODE.COM
                  </div>

                  <div className={admissionStyles.brandingLogoBlock}>
                    <div className={admissionStyles.logoFooterGroup}>
                      <img
                        src="/favicon-192x192.png"
                        alt="SoundAbode Logo"
                        className={admissionStyles.footerLogoImg}
                      />
                      <span className={admissionStyles.footerLogoText}>SOUNDABODE</span>
                    </div>


                  </div>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button onClick={() => setSelectedAdmissionForModal(null)} className={styles.btnSecondary}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEND ISSUE TO DEVELOPER MODAL */}
      {isIssueModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsIssueModalOpen(false)}>
          <div className={styles.modalCard} style={{ maxWidth: '640px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'rgba(225, 29, 72, 0.15)',
                  border: '1px solid rgba(225, 29, 72, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-text)'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className={styles.modalTitle}>Send Issue to Developer</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Report issues directly to <strong style={{ color: 'var(--text-primary)' }}>{DEVELOPER_EMAIL}</strong> (From: {SENDER_EMAIL}).
                  </div>
                </div>
              </div>
              <button onClick={() => setIsIssueModalOpen(false)} className={styles.closeModalBtn}>✕</button>
            </div>

            <form onSubmit={handleSubmitIssue} className={styles.modalBody} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Reporter Info Header */}
              {currentUser && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-surface)',
                  padding: '0.6rem 0.85rem',
                  borderRadius: 'var(--radius-btn)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.78rem'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Reporter: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{currentUser.name}</strong> ({currentUser.email})
                  </div>
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    background: isTeacher ? 'rgba(161, 161, 170, 0.15)' : 'rgba(74, 222, 128, 0.15)',
                    color: isTeacher ? 'var(--text-secondary)' : 'var(--success-text)',
                    border: `1px solid ${isTeacher ? 'rgba(161, 161, 170, 0.3)' : 'rgba(74, 222, 128, 0.3)'}`
                  }}>
                    Role: {isTeacher ? 'Teacher' : 'Admin'}
                  </span>
                </div>
              )}

              {/* Feedback Alert Toast */}
              {issueFeedbackToast && (
                <div style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-btn)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  background: issueFeedbackToast.includes('successfully') ? 'rgba(74, 222, 128, 0.12)' : 'rgba(225, 29, 72, 0.12)',
                  color: issueFeedbackToast.includes('successfully') ? 'var(--success-text)' : 'var(--accent-text)',
                  border: `1px solid ${issueFeedbackToast.includes('successfully') ? 'rgba(74, 222, 128, 0.3)' : 'rgba(225, 29, 72, 0.3)'}`
                }}>
                  {issueFeedbackToast}
                </div>
              )}

              {/* Form Controls: Category & Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Issue Category</label>
                  <select
                    className={styles.formSelect}
                    value={issueCategory}
                    onChange={(e) => setIssueCategory(e.target.value as any)}
                  >
                    <option value="Bug / Technical Issue">Bug / Technical Issue</option>
                    <option value="UI / Display Problem">UI / Display Problem</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="Performance / Speed">Performance / Speed</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Priority Level</label>
                  <select
                    className={styles.formSelect}
                    value={issuePriority}
                    onChange={(e) => setIssuePriority(e.target.value as any)}
                  >
                    <option value="Low">Low (General suggestion)</option>
                    <option value="Medium">Medium (Normal bug)</option>
                    <option value="High">High (Blocks work)</option>
                    <option value="Critical">Critical (System crash/down)</option>
                  </select>
                </div>
              </div>

              {/* Title */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Issue Title / Short Summary <span style={{ color: 'var(--accent-text)' }}>*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Student attendance record not updating after save..."
                  className={styles.formInput}
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Detailed Description / Steps to Reproduce <span style={{ color: 'var(--accent-text)' }}>*</span></label>
                <textarea
                  required
                  rows={4}
                  placeholder="Please describe what happened, what you expected, and any error message displayed..."
                  className={styles.formTextarea}
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                />
              </div>

              {/* System Diagnostics Toggle */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-btn)',
                padding: '0.65rem 0.85rem'
              }}>
                <button
                  type="button"
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    Auto-Captured System Diagnostics
                  </span>
                  <span>{showDiagnostics ? '▲ Hide' : '▼ Show'}</span>
                </button>

                {showDiagnostics && (
                  <div style={{
                    marginTop: '0.6rem',
                    paddingTop: '0.6rem',
                    borderTop: '1px dashed var(--border-subtle)',
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)',
                    fontFamily: 'monospace',
                    lineHeight: '1.45',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}>
                    <div><strong>Active Tab:</strong> {activeTab}</div>
                    <div><strong>Browser/OS:</strong> {navigator.userAgent}</div>
                    <div><strong>Screen:</strong> {typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'N/A'}</div>
                    <div><strong>Timestamp:</strong> {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className={styles.modalFooter} style={{ padding: '0.75rem 0 0 0', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleCopyDiagnostics}
                    className={styles.btnSecondary}
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.65rem', gap: '0.35rem' }}
                    title="Copy diagnostic report text to clipboard"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy Report
                  </button>
                  <a
                    href={safeMailto(
                      DEVELOPER_EMAIL,
                      `[CMS Issue Report] ${issueTitle || 'General Technical Issue'}`,
                      IssueService.formatDiagnosticReport({
                        title: issueTitle,
                        description: issueDescription,
                        category: issueCategory,
                        priority: issuePriority,
                        reporterEmail: currentUser?.email,
                        reporterName: currentUser?.name,
                        reporterRole: currentUser?.role,
                        systemInfo: IssueService.getSystemInfo(activeTab)
                      })
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.btnSecondary}
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.65rem', textDecoration: 'none', gap: '0.35rem' }}
                    title="Open mail client directly"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    Email Dev
                  </a>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsIssueModalOpen(false)}
                    className={styles.btnSecondary}
                    disabled={isSubmittingIssue}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={isSubmittingIssue || !issueTitle.trim() || !issueDescription.trim()}
                    style={{
                      background: 'linear-gradient(135deg, var(--accent-red) 0%, #dc2626 100%)',
                      borderColor: '#dc2626'
                    }}
                  >
                    {isSubmittingIssue ? 'Sending...' : 'Submit Issue to Dev'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SEND STUDENT EMAIL REMINDER MODAL */}
      {isReminderModalOpen && selectedStudentForReminder && (
        <div className={styles.modalOverlay} onClick={() => setIsReminderModalOpen(false)}>
          <div className={styles.modalCard} style={{ maxWidth: '600px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-strong)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-primary)'
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div>
                  <h3 className={styles.modalTitle}>Send Student Email Reminder</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Dispatches live email from <strong style={{ color: 'var(--text-primary)' }}>{SENDER_EMAIL}</strong> via Zoho Mail SMTP.
                  </div>
                </div>
              </div>
              <button onClick={() => setIsReminderModalOpen(false)} className={styles.closeModalBtn}>✕</button>
            </div>

            <form onSubmit={handleSendReminder} className={styles.modalBody} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Recipient Details */}
              <div style={{
                background: 'var(--bg-surface)',
                padding: '0.6rem 0.85rem',
                borderRadius: 'var(--radius-btn)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>To Student: </span>
                  <strong style={{ color: 'var(--text-primary)' }}>{selectedStudentForReminder.name}</strong> ({selectedStudentForReminder.email})
                </div>
                {selectedStudentForReminder.course && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {selectedStudentForReminder.course}
                  </span>
                )}
              </div>

              {reminderFeedbackToast && (
                <div style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-btn)',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  background: reminderFeedbackToast.includes('successfully') ? 'rgba(74, 222, 128, 0.12)' : 'rgba(225, 29, 72, 0.12)',
                  color: reminderFeedbackToast.includes('successfully') ? 'var(--success-text)' : 'var(--accent-text)',
                  border: `1px solid ${reminderFeedbackToast.includes('successfully') ? 'rgba(74, 222, 128, 0.3)' : 'rgba(225, 29, 72, 0.3)'}`
                }}>
                  {reminderFeedbackToast}
                </div>
              )}

              {/* Template Preset Picker */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Reminder Type &amp; Template</label>
                <select
                  className={styles.formSelect}
                  value={reminderType}
                  onChange={(e) => {
                    const type = e.target.value as any;
                    handleOpenReminderModal(selectedStudentForReminder, type);
                  }}
                >
                  <option value="FEE_PAYMENT">Fee Payment Reminder</option>
                  <option value="ATTENDANCE">Attendance / Class Notice</option>
                  <option value="CLASS_SCHEDULE">Class Schedule Update</option>
                  <option value="GENERAL">General Notice / Announcement</option>
                </select>
              </div>

              {/* Subject */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email Subject Line <span style={{ color: 'var(--accent-text)' }}>*</span></label>
                <input
                  type="text"
                  required
                  className={styles.formInput}
                  value={reminderSubject}
                  onChange={(e) => setReminderSubject(e.target.value)}
                />
              </div>

              {/* Message Content */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email Message Content <span style={{ color: 'var(--accent-text)' }}>*</span></label>
                <textarea
                  required
                  rows={6}
                  className={styles.formTextarea}
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className={styles.modalFooter} style={{ padding: '0.75rem 0 0 0', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsReminderModalOpen(false)}
                  className={styles.btnSecondary}
                  disabled={isSendingReminder}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={isSendingReminder || !reminderSubject.trim() || !reminderMessage.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    borderColor: '#0284c7',
                    gap: '0.4rem'
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  {isSendingReminder ? 'Sending Email...' : 'Send Reminder via Zoho Mail'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD DETAIL INSPECTION MODAL (ADMIN CLASSES SECTION) */}
      {selectedRecordForInspection && (() => {
        const rec = selectedRecordForInspection;
        const isGroup = (rec as any).type === 'GROUP';
        const groupStudents: EnrolledStudent[] = isGroup
          ? (rec as ClassLogEntry).students
          : [];
        const student = !isGroup
          ? (students.find((s) => s.id === (rec as any).studentId) || (rec as any).student)
          : null;
        const isAshu = (rec.markedByName || '').toLowerCase().includes('ashu') || (rec.markedBy || '').toLowerCase().includes('ashu');
        const isVaibhav = (rec.markedByName || '').toLowerCase().includes('vaibhav') || (rec.markedBy || '').toLowerCase().includes('vaibhav');
        const isVrishan = (rec.markedByName || '').toLowerCase().includes('vrishan') || (rec.markedBy || '').toLowerCase().includes('vrishan');
        const studentAllRecords = !isGroup && (rec as any).studentId ? allAttendanceRecords.filter((r) => r.studentId === (rec as any).studentId) : [];
        const studentAshuCount = studentAllRecords.filter((r) => (r.markedByName || '').toLowerCase().includes('ashu') || (r.markedBy || '').toLowerCase().includes('ashu')).length;
        const studentVaibhavCount = studentAllRecords.filter((r) => (r.markedByName || '').toLowerCase().includes('vaibhav') || (r.markedBy || '').toLowerCase().includes('vaibhav')).length;
        const studentVrishanCount = studentAllRecords.filter((r) => (r.markedByName || '').toLowerCase().includes('vrishan') || (r.markedBy || '').toLowerCase().includes('vrishan')).length;

        return (
          <div className={styles.modalOverlay} onClick={() => setSelectedRecordForInspection(null)}>
            <div className={`${styles.modalCard} ${styles.detailInspectionModal}`} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-strong)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className={styles.modalTitle}>{isGroup ? 'Group Class Session Detail' : 'Class Attendance Detail'}</h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {isGroup ? `${groupStudents.length} Students Attended • Session Verification` : 'Session record & teacher submission verification'}
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedRecordForInspection(null)} className={styles.closeModalBtn}>✕</button>
              </div>

              <div className={styles.modalBody} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* CLEAN INSPECTION LIST */}
                <div className={styles.inspectionList}>
                  <div className={styles.inspectionRow}>
                    <span className={styles.inspectionKey}>{isGroup ? `Students (${groupStudents.length})` : 'Student'}</span>
                    <div className={styles.inspectionVal}>
                      {isGroup ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            Group Masterclass ({groupStudents.length} Students)
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.2rem' }}>
                            {groupStudents.map((st) => (
                              <div
                                key={st.id}
                                style={{
                                  fontSize: '0.75rem',
                                  background: 'var(--bg-surface)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid var(--border-medium)',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                }}
                              >
                                <strong style={{ color: 'var(--text-primary)' }}>{st.name}</strong>
                                {st.course ? <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>({st.course})</span> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 600 }}>{student?.name || 'Student ' + (rec as any).studentId}</div>
                          <div className={styles.monoCell} style={{ fontSize: '0.75rem' }}>
                            ID: {(rec as any).studentId} • {student?.course || 'Enrolled Student'} ({student?.batch || 'Regular'})
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className={styles.inspectionRow}>
                    <span className={styles.inspectionKey}>Schedule</span>
                    <div className={styles.inspectionVal}>
                      <span className={styles.monoCellStrong}>{rec.date}</span>
                      <span className={styles.monoCell} style={{ marginLeft: '0.5rem' }}>Slot: {rec.timeSlot}</span>
                    </div>
                  </div>

                  <div className={styles.inspectionRow}>
                    <span className={styles.inspectionKey}>Marked By Teacher</span>
                    <div className={styles.inspectionVal}>
                      <span style={{ fontWeight: 600 }}>{isAshu ? 'Ashu' : isVaibhav ? 'Vaibhav' : isVrishan ? 'Vrishan' : (rec.markedByName || 'Staff')}</span>
                      <div className={styles.monoCell} style={{ fontSize: '0.75rem' }}>
                        {rec.markedBy} (Role: {rec.markedByRole || 'teacher'})
                      </div>
                    </div>
                  </div>

                  <div className={styles.inspectionRow}>
                    <span className={styles.inspectionKey}>Attendance Status</span>
                    <div className={styles.inspectionVal}>
                      {isGroup ? (
                        <span className={`${styles.statusTag} ${styles.statusNeutral}`}>Group Masterclass ({groupStudents.length} Students)</span>
                      ) : (
                        <>
                          {rec.status === 'PRESENT' && <span className={`${styles.statusTag} ${styles.statusPresent}`}>Present in Studio</span>}
                          {rec.status === 'ABSENT' && <span className={`${styles.statusTag} ${styles.statusAbsent}`}>Absent / Missed</span>}
                          {rec.status === 'PRACTICE_SESSION' && <span className={`${styles.statusTag} ${styles.statusNeutral}`}>Practice Session</span>}
                          {rec.status === 'GROUP_SESSION' && <span className={`${styles.statusTag} ${styles.statusNeutral}`}>Group Masterclass</span>}
                          {rec.status === 'NA' && <span className={`${styles.statusTag} ${styles.statusNeutral}`}>Not Applicable</span>}
                        </>
                      )}
                    </div>
                  </div>

                  <div className={styles.inspectionRow}>
                    <span className={styles.inspectionKey}>Session Remarks</span>
                    <div className={styles.inspectionVal} style={{ fontStyle: rec.comment ? 'normal' : 'italic', color: rec.comment ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {rec.comment || 'No specific notes recorded for this session.'}
                    </div>
                  </div>

                  <div className={styles.inspectionRow}>
                    <span className={styles.inspectionKey}>System Timestamp</span>
                    <div className={styles.inspectionVal}>
                      <span className={styles.monoCell}>
                        {rec.updatedAt ? new Date(rec.updatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A'}
                      </span>
                      <div className={styles.monoCell} style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Record ID: {rec.id}
                      </div>
                    </div>
                  </div>

                  {!isGroup && (
                    <div className={styles.inspectionRow}>
                      <span className={styles.inspectionKey}>Student History</span>
                      <div className={styles.inspectionVal}>
                        <span className={styles.monoCell}>
                          {studentAllRecords.length} total classes logged ({studentAshuCount} with Ashu, {studentVaibhavCount} with Vaibhav, {studentVrishanCount} with Vrishan)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* MODAL FOOTER ACTIONS */}
              <div className={styles.modalFooter} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {!isGroup && student?.phone && (
                    <a
                      href={safeWhatsAppUrl(student.phone, `Hello ${student.name}, this is Soundabode Studios regarding your class session on ${rec.date} (${rec.timeSlot}).`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.btnSecondary}
                      style={{ fontSize: '0.75rem', height: '32px', textDecoration: 'none' }}
                    >
                      WhatsApp
                    </a>
                  )}
                  {!isGroup && student?.email && (
                    <a
                      href={safeMailto(student.email, `Soundabode Studios - Class Update (${rec.date})`, `Hello ${student.name},\n\nRegarding your class session on ${rec.date} at ${rec.timeSlot}.`)}
                      className={styles.btnSecondary}
                      style={{ fontSize: '0.75rem', height: '32px', textDecoration: 'none' }}
                    >
                      Email
                    </a>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!isGroup && (rec as any).studentId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentId((rec as any).records?.[0] ? keyForRecord((rec as any).records[0]) : (rec as any).studentId);
                        setActiveTab('attendance');
                        setSelectedRecordForInspection(null);
                      }}
                      className={styles.btnPrimary}
                      style={{ fontSize: '0.78rem', height: '32px' }}
                    >
                      Student Sheet
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudentId(null);
                        setGroupSessionDate(rec.date);
                        setAttendanceSubTab('group');
                        setActiveTab('attendance');
                        setSelectedRecordForInspection(null);
                      }}
                      className={styles.btnPrimary}
                      style={{ fontSize: '0.78rem', height: '32px' }}
                    >
                      Open Attendance Batch
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedRecordForInspection(null)}
                    className={styles.btnSecondary}
                    style={{ fontSize: '0.78rem', height: '32px' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* REAL-TIME LEAD NOTIFICATION TOAST */}
      {realtimeLeadToast && (
        <div className={styles.realtimeLeadToast}>
          <div className={styles.toastIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div className={styles.toastContent}>
            <div className={styles.toastTitle}>NEW LEAD SUBMISSION RECORDED</div>
            <div className={styles.toastBody}>
              <strong>{realtimeLeadToast.name}</strong> • {realtimeLeadToast.courseInterest}
              {realtimeLeadToast.source && (
                <span style={{ marginLeft: '0.45rem', opacity: 0.85, fontSize: '0.72rem', background: 'var(--bg-surface)', padding: '1px 6px', borderRadius: '4px' }}>
                  {realtimeLeadToast.source}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setRealtimeLeadToast(null)}
            className={styles.toastCloseBtn}
            title="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR — Fast thumb-friendly navigation on phones */}
      <nav className={styles.mobileBottomNav} aria-label="Mobile Navigation">
        <button
          onClick={() => setActiveTab('overview')}
          className={`${styles.mobileBottomNavBtn} ${activeTab === 'overview' ? styles.mobileBottomNavBtnActive : ''}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
          <span>Overview</span>
        </button>

        {!isTeacher && (
          <button
            onClick={() => setActiveTab('meta-ads')}
            className={`${styles.mobileBottomNavBtn} ${activeTab === 'meta-ads' ? styles.mobileBottomNavBtnActive : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            {(newMetaLeadsCount > 0 ? newMetaLeadsCount : metaLeadsCount) > 0 && (
              <span className={styles.mobileBottomNavBadge}>
                {newMetaLeadsCount > 0 ? newMetaLeadsCount : metaLeadsCount}
              </span>
            )}
            <span>Meta Ads</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('inquiries')}
          className={`${styles.mobileBottomNavBtn} ${activeTab === 'inquiries' ? styles.mobileBottomNavBtnActive : ''}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
          {newInquiryCount > 0 && <span className={styles.mobileBottomNavBadge}>{newInquiryCount}</span>}
          <span>{isTeacher ? 'My Leads' : 'Leads'}</span>
        </button>

        {!isTeacher ? (
          <button
            onClick={() => setActiveTab('students')}
            className={`${styles.mobileBottomNavBtn} ${activeTab === 'students' ? styles.mobileBottomNavBtnActive : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
            <span>Students</span>
          </button>
        ) : (
          <button
            onClick={() => setActiveTab('attendance')}
            className={`${styles.mobileBottomNavBtn} ${activeTab === 'attendance' ? styles.mobileBottomNavBtnActive : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /></svg>
            <span>Attendance</span>
          </button>
        )}

        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className={`${styles.mobileBottomNavBtn} ${isMobileMenuOpen ? styles.mobileBottomNavBtnActive : ''}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
};

export default CmsAdminPage;
