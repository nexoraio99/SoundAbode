import React, { useState, useEffect } from 'react';
import styles from './CmsAdminPage.module.css';
import admissionStyles from '../AdmissionPage/AdmissionPage.module.css';
import SEO from '../../components/common/SEO';
import { BlogService } from '../../services/blogService';
import { InquiryService, ContactInquiry } from '../../services/inquiryService';
import { AttendanceService, EnrolledStudent } from '../../services/attendanceService';
import { AdmissionService, AdmissionSubmission } from '../../services/admissionService';
import { AuthService, CmsUser } from '../../services/authService';
import { BlogPost } from '../../types/blog';
import { DJ_COURSES, EMP_COURSES, DJ_DISCLAIMER, EMP_DISCLAIMER } from '../../constants/admissionConstants';
import { escapeHtml, safeImageUrl, safeWhatsAppUrl, sanitizePrintHtml } from '../../utils/security';

interface CmsAdminPageProps {
  onNavigate?: (page: string) => void;
}

type TabType = 'overview' | 'students' | 'blog' | 'inquiries' | 'admissions' | 'attendance' | 'fees' | 'settings';

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

interface FeeReceipt {
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

const loadFees = (): FeeReceipt[] => {
  try { return JSON.parse(localStorage.getItem(FEES_STORAGE_KEY) || '[]'); } catch { return []; }
};
const saveFees = (receipts: FeeReceipt[]) => {
  localStorage.setItem(FEES_STORAGE_KEY, JSON.stringify(receipts));
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
    if (user?.role === 'teacher') return 'students';
    return 'overview';
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Automatically restrict teacher users to students/attendance
  useEffect(() => {
    if (isTeacher && !['students', 'attendance'].includes(activeTab)) {
      setActiveTab('students');
    }
  }, [isTeacher, activeTab]);

  // Loading Skeleton simulation toggle for Overview
  const [isLoadingSkeleton, setIsLoadingSkeleton] = useState<boolean>(false);

  // Data states
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [admissions, setAdmissions] = useState<AdmissionSubmission[]>([]);

  // Search & Filter states
  const [blogSearch, setBlogSearch] = useState('');
  const [blogCategoryFilter, setBlogCategoryFilter] = useState('ALL');
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<string>('ALL');
  const [selectedInquiryIds, setSelectedInquiryIds] = useState<string[]>([]);

  // Students tab states
  const [studentSearch, setStudentSearch] = useState('');
  const [studentCourseFilter, setStudentCourseFilter] = useState('ALL');
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentFormData, setStudentFormData] = useState({
    name: '',
    email: '',
    phone: '',
    course: 'Pro DJ Course',
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
  const [calendarDate, setCalendarDate] = useState<Date>(new Date(2026, 7, 1)); // August 2026
  const [selectedDateStr, setSelectedDateStr] = useState<string>('2026-08-01');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('11:00 AM - 01:00 PM');
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState<boolean>(false);
  const [attendanceFormDate, setAttendanceFormDate] = useState<string>('2026-08-01');
  const [customTimeStart, setCustomTimeStart] = useState<string>('11:00');
  const [customTimeEnd, setCustomTimeEnd] = useState<string>('13:00');
  const [attendanceFormStatus, setAttendanceFormStatus] = useState<'PRESENT' | 'ABSENT' | 'NA'>('PRESENT');
  const [attendanceFormComment, setAttendanceFormComment] = useState<string>('');
  const [editingAttendanceId, setEditingAttendanceId] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // Modal states for Lead Message Viewer
  const [expandedLeadMessage, setExpandedLeadMessage] = useState<ContactInquiry | null>(null);

  // Modal states for Blog Editor
  const [isBlogModalOpen, setIsBlogModalOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [blogFormData, setBlogFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    category: 'PRODUCTION' as BlogPost['category'],
    coverImage: '',
    readTimeMinutes: 5,
    authorName: 'Soundabode Team',
    authorRole: 'Academy Mentor',
    authorAvatarUrl: '',
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
  const [fees, setFees] = useState<FeeReceipt[]>(loadFees);
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

  // Settings & Real-time states
  const [newPasscode, setNewPasscode] = useState('');
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState('');
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [attendanceRemindersEnabled, setAttendanceRemindersEnabled] = useState(true);
  const [realtimeLeadToast, setRealtimeLeadToast] = useState<{ name: string; courseInterest: string } | null>(null);
  const [dbStatus, setDbStatus] = useState<'connected' | 'connecting' | 'local'>('local');

  // Load data on mount and subscribe to real-time updates
  useEffect(() => {
    refreshData();

    // Check MongoDB Atlas status & poll for connection state
    const checkHealth = () => {
      const apiBase = (import.meta as any).env?.VITE_API_URL || '/api';
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
        });
      }
    });

    // Real-time Admissions subscription
    const unsubscribeAdmissions = AdmissionService.subscribe((updatedAdmissions) => {
      setAdmissions(updatedAdmissions);
    });

    // Lightweight 2.5s polling fallback to ensure zero-lag synchronization
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
    }, 2500);

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

  const [attendanceVersion, setAttendanceVersion] = useState(0);

  const refreshData = () => {
    setPosts(BlogService.getAllPosts());
    setInquiries(InquiryService.getAllInquiries());
    setStudents(AttendanceService.getAllStudents());
    setAdmissions(AdmissionService.getAllAdmissions());
    AttendanceService.getAllAttendanceRecords();
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
        setActiveTab('students');
      }
      return;
    }

    setAuthError(response.error || 'Invalid credentials. Check your email address and password.');
  };

  const handleLogout = () => {
    AuthService.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

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
      authorName: 'Soundabode Team',
      authorRole: 'Certified Instructor',
      authorAvatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
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
    setIsBlogModalOpen(true);
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
    setIsBlogModalOpen(true);
  };

  const handleSaveBlog = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTags = blogFormData.tags
      ? blogFormData.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const generatedSlug =
      blogFormData.slug.trim() ||
      blogFormData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

    const postPayload: BlogPost = {
      id: editingPostId || String(Date.now()),
      title: blogFormData.title,
      slug: generatedSlug,
      excerpt: blogFormData.excerpt,
      content: blogFormData.content,
      category: blogFormData.category,
      coverImage: blogFormData.coverImage,
      readTimeMinutes: Number(blogFormData.readTimeMinutes) || 5,
      publishedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      author: {
        name: blogFormData.authorName,
        role: blogFormData.authorRole,
        avatarUrl: blogFormData.authorAvatarUrl,
      },
      isFeatured: blogFormData.isFeatured,
      tags: parsedTags,
      // SEO fields
      metaTitle: blogFormData.metaTitle || undefined,
      metaDescription: blogFormData.metaDescription || undefined,
      focusKeyword: blogFormData.focusKeyword || undefined,
      canonicalUrl: blogFormData.canonicalUrl || undefined,
      ogTitle: blogFormData.ogTitle || undefined,
      ogDescription: blogFormData.ogDescription || undefined,
      ogImage: blogFormData.ogImage || undefined,
      twitterCard: blogFormData.twitterCard,
      noIndex: blogFormData.noIndex,
      schemaType: blogFormData.schemaType,
    };

    if (editingPostId) {
      BlogService.updatePost(editingPostId, postPayload);
    } else {
      BlogService.createPost(postPayload);
    }

    refreshData();
    setIsBlogModalOpen(false);
  };

  const handleDeleteBlog = (id: string, title: string) => {
    if (window.confirm(`Delete article "${title}"?`)) {
      BlogService.deletePost(id);
      refreshData();
    }
  };

  // INQUIRY STATUS CYCLE HANDLER
  const cycleInquiryStatus = (id: string, currentStatus: ContactInquiry['status']) => {
    const sequence: ContactInquiry['status'][] = ['NEW', 'CONTACTED', 'ENROLLED', 'ARCHIVED'];
    const currentIndex = sequence.indexOf(currentStatus);
    const nextStatus = sequence[(currentIndex + 1) % sequence.length];
    InquiryService.updateInquiryStatus(id, nextStatus);
    refreshData();
  };

  const handleDeleteInquiry = (id: string) => {
    if (window.confirm('Delete this inquiry?')) {
      InquiryService.deleteInquiry(id);
      setSelectedInquiryIds((prev) => prev.filter((item) => item !== id));
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

  const handleBatchDeleteInquiries = () => {
    if (selectedInquiryIds.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedInquiryIds.length} selected lead(s)?`)) {
      selectedInquiryIds.forEach((id) => InquiryService.deleteInquiry(id));
      setSelectedInquiryIds([]);
      refreshData();
    }
  };

  const handleBatchUpdateInquiriesStatus = (status: ContactInquiry['status']) => {
    if (selectedInquiryIds.length === 0) return;
    selectedInquiryIds.forEach((id) => InquiryService.updateInquiryStatus(id, status));
    setSelectedInquiryIds([]);
    refreshData();
  };

  // ADMISSION SUBMISSIONS HANDLERS
  const cycleAdmissionStatus = (id: string, currentStatus: AdmissionSubmission['status']) => {
    const sequence: AdmissionSubmission['status'][] = ['NEW', 'CONTACTED', 'ENROLLED', 'ARCHIVED'];
    const currentIndex = sequence.indexOf(currentStatus);
    const nextStatus = sequence[(currentIndex + 1) % sequence.length];
    AdmissionService.updateStatus(id, nextStatus);
    refreshData();
  };

  const handleDeleteAdmission = (id: string, formNo: string) => {
    if (window.confirm(`Delete submission ${formNo}?`)) {
      AdmissionService.deleteAdmission(id);
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
            .courseTable tr.selected { background: rgba(239, 68, 68, 0.06); }
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
            <div>
              <span class="softwarePill">ABLETON LIVE</span>
              <span class="softwarePill">NATIVE INSTRUMENTS</span>
              <span class="softwarePill">WAVES ACCESS</span>
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
  };

  const handleOpenAttendanceModal = (slot?: string, date?: string) => {
    const targetDate = date || selectedDateStr;
    const targetSlot = slot || selectedTimeSlot || '11:00 AM - 01:00 PM';

    setAttendanceFormDate(targetDate);
    setSelectedTimeSlot(targetSlot);

    if (targetSlot && targetSlot.includes('-')) {
      const parts = targetSlot.split('-').map((s) => s.trim());
      if (parts.length === 2) {
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
        setCustomTimeStart(convert12to24(parts[0], '11:00'));
        setCustomTimeEnd(convert12to24(parts[1], '13:00'));
      }
    }

    if (!selectedStudentId && students.length > 0) {
      setSelectedStudentId(students[0].id);
    }

    const currentStudentId = selectedStudentId || (students.length > 0 ? students[0].id : '');
    if (currentStudentId) {
      const records = AttendanceService.getAttendanceForStudent(currentStudentId, currentUser || undefined);
      const existing = records.find((r) => r.date === targetDate && r.timeSlot === targetSlot);
      if (existing) {
        setEditingAttendanceId(existing.id);
        setAttendanceFormStatus(existing.status);
        setAttendanceFormComment(existing.comment);
      } else {
        setEditingAttendanceId(null);
        setAttendanceFormStatus('PRESENT');
        setAttendanceFormComment('');
      }
    } else {
      setEditingAttendanceId(null);
    }
    setIsAttendanceModalOpen(true);
  };

  const handleDeleteCurrentAttendance = () => {
    if (!selectedStudentId) return;
    const targetDate = attendanceFormDate || selectedDateStr;

    if (window.confirm(`Are you sure you want to delete this attendance session?`)) {
      if (editingAttendanceId) {
        AttendanceService.deleteAttendanceRecord(editingAttendanceId);
      } else {
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
        const existing = records.find((r) => r.date === targetDate && r.timeSlot === finalSlot);
        if (existing) {
          AttendanceService.deleteAttendanceRecord(existing.id);
        }
      }
      setIsAttendanceModalOpen(false);
      setEditingAttendanceId(null);
      refreshData();
    }
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

    const markerEmail = currentUser?.email || (isTeacher ? 'teacher@soundabode.com' : 'admin@soundabode.com');
    const markerName = currentUser?.name || (isTeacher ? 'Teacher' : 'Soundabode Admin');
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
      batch: 'Regular Studio Batch (Mon/Wed/Fri)',
      enrolledDate: new Date().toISOString().split('T')[0],
    });
    setIsStudentModalOpen(true);
  };

  const handleOpenEditStudentModal = (std: EnrolledStudent) => {
    setEditingStudentId(std.id);
    setStudentFormData({
      name: std.name,
      email: std.email,
      phone: std.phone,
      course: std.course,
      batch: std.batch,
      enrolledDate: std.enrolledDate,
    });
    setIsStudentModalOpen(true);
  };

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentFormData.name.trim()) return;

    if (editingStudentId) {
      AttendanceService.updateStudent(editingStudentId, studentFormData);
    } else {
      AttendanceService.addStudent(studentFormData);
    }

    setIsStudentModalOpen(false);
    refreshData();
  };

  const handleDeleteStudent = (id: string, name: string) => {
    if (window.confirm(`Remove student "${name}" from roster?`)) {
      AttendanceService.deleteStudent(id);
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
    const currentFees = loadFees();
    setFeeFormData({
      ...defaultFeeForm(),
      receiptNo: getNextReceiptNo(currentFees),
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

  const handleSaveFee = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(feeFormData.amount) || 0;
    const currentFees = loadFees();
    const finalReceiptNo = feeFormData.receiptNo.trim() || getNextReceiptNo(currentFees);
    if (editingFeeId) {
      const updated = currentFees.map((r) =>
        r.id === editingFeeId
          ? { ...r, ...feeFormData, receiptNo: finalReceiptNo, amount: amt }
          : r
      );
      saveFees(updated);
      setFees(updated);
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
      const updated = [newReceipt, ...currentFees];
      saveFees(updated);
      setFees(updated);
    }
    setIsFeeModalOpen(false);
  };

  const handleDeleteFee = (id: string, receiptNo: string) => {
    if (window.confirm(`Delete Receipt #${receiptNo}? This cannot be undone.`)) {
      const updated = fees.filter((r) => r.id !== id);
      saveFees(updated);
      setFees(updated);
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
    .sig-footer { margin-top: 28px; display: flex; justify-content: flex-end; text-align: center; position: relative; }
    .sig-box { font-size: 11px; color: #475569; position: relative; display: inline-block; padding: 0 10px; }
    .sig-line { width: 140px; border-bottom: 1.5px solid #1e293b; margin: 0 auto 6px; height: 30px; }
    .sig-stamp { position: absolute; top: -15px; right: 0; width: 80px; height: auto; opacity: 0.88; transform: rotate(-8deg); pointer-events: none; }
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
      <div class="sig-line"></div>
      <img src="${window.location.origin}/stamp.ico" class="sig-stamp" alt="Soundabode Stamp" />
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
      blogPosts: BlogService.getAllPosts(),
      inquiries: InquiryService.getAllInquiries(),
      students: AttendanceService.getAllStudents(),
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

  const filteredInquiries = inquiries.filter((inq) => {
    return inquiryStatusFilter === 'ALL' || inq.status === inquiryStatusFilter;
  });

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

  const filteredStudents = students.filter((std) => {
    const matchesSearch =
      !studentSearch ||
      std.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      std.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
      std.phone.includes(studentSearch) ||
      std.course.toLowerCase().includes(studentSearch.toLowerCase());
    const matchesCourse =
      studentCourseFilter === 'ALL' || std.course.toLowerCase().includes(studentCourseFilter.toLowerCase());
    return matchesSearch && matchesCourse;
  });

  const newInquiryCount = inquiries.filter((i) => i.status === 'NEW').length;
  const enrolledCount = inquiries.filter((i) => i.status === 'ENROLLED').length;
  const conversionRate = inquiries.length > 0 ? Math.round((enrolledCount / inquiries.length) * 100) : 0;

  // Active Selected Student details & records for Attendance
  const activeStudent = selectedStudentId ? AttendanceService.getStudentById(selectedStudentId) : undefined;
  const activeAttendanceRecords = (selectedStudentId && attendanceVersion >= 0)
    ? AttendanceService.getAttendanceForStudent(selectedStudentId, currentUser || undefined)
    : [];

  const totalPresent = activeAttendanceRecords.filter((r) => r.status === 'PRESENT').length;
  const totalAbsent = activeAttendanceRecords.filter((r) => r.status === 'ABSENT').length;
  const totalNa = activeAttendanceRecords.filter((r) => r.status === 'NA').length;
  const totalMarked = activeAttendanceRecords.length;
  const attendancePercentage = (totalPresent + totalAbsent) > 0 ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100) : 0;

  // Calendar Days Calculation for current calendarDate
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
                    stroke="#94a3b8"
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
                    stroke="#94a3b8"
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
            <button onClick={handleLogout} className={styles.btnGhost} style={{ color: '#f87171', padding: '0 0.5rem' }}>
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
                <div style={{ fontSize: '0.65rem', color: dbStatus === 'connected' ? '#34d399' : '#fbbf24', marginTop: '0.2rem' }}>
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

              <button
                onClick={() => { setActiveTab('students'); setIsMobileMenuOpen(false); }}
                className={`${styles.sidebarBtn} ${activeTab === 'students' ? styles.sidebarBtnActive : ''}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
                Students
                <span className={styles.badgeCount}>{students.length}</span>
              </button>

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
              <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className={styles.btnGhost} style={{ color: '#f87171', justifyContent: 'center' }}>
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
              <div className={styles.pageHeaderRow}>
                <div>
                  <h1 className={styles.pageTitle}>Overview</h1>
                  <div className={styles.pageMetaBadge}>
                    <span>Updated just now</span>
                    <span>•</span>
                    <span>5 active studio modules in Pune</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsLoadingSkeleton(!isLoadingSkeleton)}
                  className={styles.btnSecondary}
                  style={{ fontSize: '0.75rem' }}
                >
                  {isLoadingSkeleton ? 'Show Real Data' : 'Simulate Loading'}
                </button>
              </div>

              {/* ASYMMETRIC METRIC CARDS (NO REPETITIVE CORNER CHIPS) */}
              <div className={styles.kpiGrid}>
                {isLoadingSkeleton ? (
                  <>
                    <div className={`${styles.kpiCard} ${styles.skeletonBox}`} style={{ height: '90px' }} />
                    <div className={`${styles.kpiCard} ${styles.skeletonBox}`} style={{ height: '90px' }} />
                    <div className={`${styles.kpiCard} ${styles.skeletonBox}`} style={{ height: '90px' }} />
                    <div className={`${styles.kpiCard} ${styles.skeletonBox}`} style={{ height: '90px' }} />
                  </>
                ) : (
                  <>
                    {/* CARD 1: INLINE LABEL WITH ICON */}
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabelRow}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                        </svg>
                        Total Inquiries
                      </div>
                      <div className={styles.kpiValue}>{inquiries.length}</div>
                      <div className={styles.kpiSubText}>
                        Live prospect leads
                      </div>
                    </div>

                    {/* CARD 2: BIG NUMBER + INLINE BADGE (NO ICON CHIP AT ALL) */}
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabelRow}>Enrolled Students</div>
                      <div className={styles.kpiValue}>{students.length}</div>
                      <div className={styles.kpiSubText}>
                        <span className={`${styles.badge} ${styles.badgeEnrolled}`} style={{ padding: '0.1rem 0.4rem' }}>
                          Active in Studio
                        </span>
                      </div>
                    </div>

                    {/* CARD 3: STAT + LINEAR PROGRESS INDICATOR */}
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabelRow}>Conversion Rate</div>
                      <div className={styles.kpiValue}>{conversionRate}%</div>
                      <div className={styles.progressBarTrack} style={{ marginTop: '0.6rem' }}>
                        <div className={styles.progressBarFill} style={{ width: `${conversionRate}%`, background: '#e11d48' }} />
                      </div>
                    </div>

                    {/* CARD 4: TEXT METRIC WITH COUNT BREAKDOWN */}
                    <div className={styles.kpiCard}>
                      <div className={styles.kpiLabelRow}>Published Articles</div>
                      <div className={styles.kpiValue}>{posts.length}</div>
                      <div className={styles.kpiSubText}>Live on soundabode.com/blog</div>
                    </div>
                  </>
                )}
              </div>

              {/* CHARTS GRID (FLAT SURFACE, NO GRADIENT BLUR) */}
              <div className={styles.chartsGrid}>
                <div className={styles.chartCard}>
                  <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>Inquiries &amp; Student Volume</h3>
                  </div>

                  {isLoadingSkeleton ? (
                    <div className={styles.skeletonBox} style={{ width: '100%', height: '170px' }} />
                  ) : (
                    <div style={{ width: '100%', height: '170px' }}>
                      <svg width="100%" height="100%" viewBox="0 0 500 150" preserveAspectRatio="none">
                        <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                        <line x1="0" y1="75" x2="500" y2="75" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                        <line x1="0" y1="120" x2="500" y2="120" stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />

                        {/* Flat stroke & subtle flat opacity fill (NO blur or gradient filters) */}
                        <path
                          d="M 0,120 Q 80,45 160,65 T 320,30 T 500,55 L 500,150 L 0,150 Z"
                          fill="rgba(225, 29, 72, 0.08)"
                        />

                        <path
                          d="M 0,120 Q 80,45 160,65 T 320,30 T 500,55"
                          fill="none"
                          stroke="#e11d48"
                          strokeWidth="2"
                        />

                        <circle cx="160" cy="65" r="3" fill="#ffffff" stroke="#e11d48" strokeWidth="2" />
                        <circle cx="320" cy="30" r="3" fill="#ffffff" stroke="#e11d48" strokeWidth="2" />
                        <circle cx="500" cy="55" r="3" fill="#ffffff" stroke="#e11d48" strokeWidth="2" />
                      </svg>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
                        <span>Mar</span>
                        <span>Apr</span>
                        <span>May</span>
                        <span>Jun</span>
                        <span>Jul</span>
                        <span>Aug</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.chartCard}>
                  <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>Course Distribution</h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                        <span>Ableton EMP</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>48%</span>
                      </div>
                      <div className={styles.progressBarTrack}>
                        <div style={{ width: '48%', height: '100%', background: '#e11d48', borderRadius: '3px' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                        <span>Pioneer DJ</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>32%</span>
                      </div>
                      <div className={styles.progressBarTrack}>
                        <div style={{ width: '32%', height: '100%', background: '#3b82f6', borderRadius: '3px' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                        <span>Audio Engineering</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>20%</span>
                      </div>
                      <div className={styles.progressBarTrack}>
                        <div style={{ width: '20%', height: '100%', background: '#10b981', borderRadius: '3px' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RECENT INQUIRIES DATA TABLE */}
              <div className={styles.tableCard}>
                <div className={styles.tableHeaderBar}>
                  <h3 className={styles.tableHeaderTitle}>Recent Prospects</h3>
                  <button onClick={() => setActiveTab('inquiries')} className={styles.btnGhost} style={{ gap: '0.35rem' }}>
                    View All Leads ({inquiries.length})
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                  </button>
                </div>

                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Prospect</th>
                      <th>Program</th>
                      <th>Contact Details</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inquiries.slice(0, 5).map((inq) => {
                      const avatar = getAvatarDetails(inq.name);
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
                              <div className={styles.studentName}>{inq.name}</div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>{inq.courseInterest}</span>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>{inq.email}</div>
                          </td>
                          <td>
                            <button
                              onClick={() => cycleInquiryStatus(inq.id, inq.status)}
                              className={`${styles.badge} ${inq.status === 'NEW'
                                  ? styles.badgeNew
                                  : inq.status === 'CONTACTED'
                                    ? styles.badgeContacted
                                    : inq.status === 'ENROLLED'
                                      ? styles.badgeEnrolled
                                      : styles.badgeArchived
                                }`}
                              style={{ cursor: 'pointer' }}
                              title="Click to cycle status"
                            >
                              <span className={styles.statusDot} />
                              {inq.status}
                            </button>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => handleDeleteInquiry(inq.id)}
                              className={styles.btnDestructive}
                              title="Delete inquiry"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: STUDENT DIRECTORY */}
          {activeTab === 'students' && (
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
                          {filteredStudents.map((std) => {
                            const avatar = getAvatarDetails(std.name);
                            return (
                              <tr key={std.id}>
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
                                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>ID: {std.id}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span style={{
                                    display: 'inline-block',
                                    background: 'var(--bg-surface)',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border-medium)',
                                    borderRadius: '5px',
                                    fontSize: '0.725rem',
                                    fontWeight: 500,
                                    padding: '0.2rem 0.5rem',
                                  }}>{std.course}</span>
                                </td>
                                <td>
                                  <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>{std.batch}</div>
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
                                  <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <button
                                      onClick={() => {
                                        setSelectedStudentId(std.id);
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
                                    <button
                                      onClick={() => handleDeleteStudent(std.id, std.name)}
                                      className={styles.btnGhost}
                                      style={{ fontSize: '0.725rem', height: '26px', padding: '0 0.35rem', color: 'var(--text-muted)' }}
                                      title="Remove student"
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
                    {filteredStudents.map((std) => {
                      const avatar = getAvatarDetails(std.name);
                      return (
                        <div key={std.id} className={styles.mobileDataCard}>
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
                            <span className={styles.badge} style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: '0.675rem' }}>
                              {std.course}
                            </span>
                          </div>

                          <div className={styles.mobileCardBody}>
                            <div className={styles.mobileCardRow}>
                              <span className={styles.mobileCardLabel}>Batch</span>
                              <span className={styles.mobileCardValue}>{std.batch}</span>
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
                                setSelectedStudentId(std.id);
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
                            <button
                              onClick={() => handleDeleteStudent(std.id, std.name)}
                              className={styles.btnDestructive}
                              style={{ height: '34px', padding: '0 0.6rem' }}
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
          )}

          {/* TAB 2: STUDENT ATTENDANCE FEATURE */}
          {activeTab === 'attendance' && (
            <div>
              {!selectedStudentId ? (
                /* VIEW A: ENROLLED STUDENTS ROSTER */
                <div>
                  <div className={styles.pageHeaderRow}>
                    <div>
                      <h1 className={styles.pageTitle}>Attendance</h1>
                      <div className={styles.pageMetaBadge}>
                        <span>{students.length} enrolled students</span>
                        <span>•</span>
                        <span>Pune Studio Roster</span>
                      </div>
                    </div>
                  </div>

                  {/* STUDENTS ROSTER DESKTOP TABLE */}
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
                          {students.map((student) => {
                            const avatar = getAvatarDetails(student.name, student.avatarUrl);
                            const studentRecords = AttendanceService.getAttendanceForStudent(student.id, currentUser || undefined);
                            const presentCount = studentRecords.filter((r) => r.status === 'PRESENT').length;
                            const totalCount = studentRecords.length;
                            const pct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

                            return (
                              <tr key={student.id}>
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
                                      <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{student.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>{student.course}</div>
                                  <div style={{ fontSize: '0.725rem', color: '#8a99ad' }}>{student.batch}</div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    <div className={styles.progressBarTrack} style={{ width: '90px' }}>
                                      <div
                                        className={styles.progressBarFill}
                                        style={{
                                          width: `${pct}%`,
                                          background: pct >= 80 ? '#34d399' : pct >= 60 ? '#fbbf24' : '#f87171',
                                        }}
                                      />
                                    </div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{pct}%</span>
                                  </div>
                                </td>
                                <td style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                                  {presentCount} Present / {totalCount} Sessions
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                    <button
                                      onClick={() => {
                                        setSelectedStudentId(student.id);
                                        handleOpenAttendanceModal(undefined, selectedDateStr);
                                      }}
                                      className={styles.btnPrimary}
                                      style={{ height: '28px', fontSize: '0.75rem', padding: '0 0.6rem' }}
                                    >
                                      Mark
                                    </button>
                                    <button
                                      onClick={() => handleOpenStudentCalendar(student.id)}
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

                  {/* STUDENTS ROSTER MOBILE CARD LIST */}
                  <div className={styles.mobileCardList}>
                    {students.map((student) => {
                      const avatar = getAvatarDetails(student.name, student.avatarUrl);
                      const studentRecords = AttendanceService.getAttendanceForStudent(student.id, currentUser || undefined);
                      const presentCount = studentRecords.filter((r) => r.status === 'PRESENT').length;
                      const totalCount = studentRecords.length;
                      const pct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

                      return (
                        <div key={student.id} className={styles.mobileDataCard}>
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
                              <span className={styles.mobileCardValue}>{student.course} ({student.batch})</span>
                            </div>
                            <div className={styles.mobileCardRow}>
                              <span className={styles.mobileCardLabel}>Attendance Sessions</span>
                              <span className={styles.mobileCardValue}>{presentCount} / {totalCount} Present</span>
                            </div>
                            <div style={{ marginTop: '0.2rem' }}>
                              <div className={styles.progressBarTrack}>
                                <div
                                  className={styles.progressBarFill}
                                  style={{
                                    width: `${pct}%`,
                                    background: pct >= 80 ? '#34d399' : pct >= 60 ? '#fbbf24' : '#f87171',
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className={styles.mobileCardActions}>
                            <button
                              onClick={() => {
                                setSelectedStudentId(student.id);
                                handleOpenAttendanceModal(undefined, selectedDateStr);
                              }}
                              className={styles.btnPrimary}
                              style={{ height: '34px', fontSize: '0.775rem' }}
                            >
                              Mark Attendance
                            </button>
                            <button
                              onClick={() => handleOpenStudentCalendar(student.id)}
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
                          <span>{activeStudent?.course}</span>
                          <span>•</span>
                          <span>{activeStudent?.batch}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button onClick={() => handleOpenAttendanceModal(undefined, selectedDateStr)} className={styles.btnPrimary} style={{ gap: '0.4rem' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Mark Attendance
                      </button>
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
                  <div className={styles.kpiGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1.25rem' }}>
                    <div className={styles.kpiCard} style={{ padding: '0.85rem 1rem' }}>
                      <div className={styles.kpiLabelRow}>Rate</div>
                      <div className={styles.kpiValue} style={{ fontSize: '1.5rem', color: attendancePercentage >= 80 ? '#34d399' : '#fbbf24' }}>
                        {attendancePercentage}%
                      </div>
                    </div>
                    <div className={styles.kpiCard} style={{ padding: '0.85rem 1rem' }}>
                      <div className={styles.kpiLabelRow}>Present</div>
                      <div className={styles.kpiValue} style={{ fontSize: '1.5rem', color: '#34d399' }}>
                        {totalPresent}
                      </div>
                    </div>
                    <div className={styles.kpiCard} style={{ padding: '0.85rem 1rem' }}>
                      <div className={styles.kpiLabelRow}>Absent</div>
                      <div className={styles.kpiValue} style={{ fontSize: '1.5rem', color: '#f87171' }}>
                        {totalAbsent}
                      </div>
                    </div>
                    <div className={styles.kpiCard} style={{ padding: '0.85rem 1rem' }}>
                      <div className={styles.kpiLabelRow}>N/A</div>
                      <div className={styles.kpiValue} style={{ fontSize: '1.5rem', color: '#94a3b8' }}>
                        {totalNa}
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
                              handleOpenAttendanceModal(undefined, item.dateStr);
                            }}
                            className={`${styles.calendarDayCell} ${hasSessions ? styles.calendarDayCellSession : styles.calendarDayCellMuted
                              } ${isSelected ? styles.calendarDayCellActive : ''}`}
                            style={{ cursor: 'pointer' }}
                            title={`Click to mark attendance for ${item.dateStr}`}
                          >
                            <span className={styles.calendarDayNumber}>{item.day}</span>

                            <div className={styles.calendarDotsRow}>
                              {dayRecords.map((r) => (
                                <span
                                  key={r.id}
                                  className={
                                    r.status === 'PRESENT'
                                      ? styles.dotPresent
                                      : r.status === 'ABSENT'
                                        ? styles.dotAbsent
                                        : styles.dotNa
                                  }
                                  title={`${r.timeSlot}: ${r.status}`}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* TIME SLOTS INSPECTOR FOR SELECTED DATE */}
                  <div className={styles.tableCard} style={{ marginTop: '1.25rem', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        Time Slots for {selectedDateStr}
                      </h3>
                      <button
                        onClick={() => handleOpenAttendanceModal(undefined, selectedDateStr)}
                        className={styles.btnSecondary}
                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', gap: '0.35rem' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Mark Attendance for {selectedDateStr}
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem' }}>
                      {['11:00 AM - 01:00 PM', '02:00 PM - 04:00 PM', '04:00 PM - 06:00 PM'].map((slot) => {
                        const slotRecords = activeAttendanceRecords.filter(
                          (r) => r.date === selectedDateStr && r.timeSlot === slot
                        );

                        return (
                          <div
                            key={slot}
                            onClick={() => handleOpenAttendanceModal(slot)}
                            className={styles.timeSlotBox}
                          >
                            <div style={{ width: '100%' }}>
                              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{slot}</div>
                              {slotRecords.length > 0 ? (
                                slotRecords.map((r) => (
                                  <div key={r.id} style={{ fontSize: '0.725rem', marginTop: '3px', lineHeight: '1.3' }}>
                                    <span style={{ color: r.status === 'PRESENT' ? '#34d399' : '#f87171', fontWeight: 600 }}>
                                      ● {r.status}
                                    </span>
                                    {r.comment ? <span style={{ color: '#94a3b8' }}> ({r.comment})</span> : null}
                                    {!isTeacher && (
                                      <span style={{ fontSize: '0.675rem', background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', padding: '1px 5px', borderRadius: '4px', marginLeft: '6px', fontWeight: 500 }}>
                                        By {r.markedByName || 'Staff'}
                                      </span>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <div style={{ fontSize: '0.725rem', color: '#8a99ad', marginTop: '2px' }}>
                                  Unmarked • Click to edit
                                </div>
                              )}
                            </div>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2">
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
                <button onClick={openNewBlogModal} className={styles.btnPrimary} style={{ gap: '0.4rem' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New Article
                </button>
              </div>

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
                                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{role}</div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{post.publishedAt}</td>
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
            </div>
          )}

          {/* TAB 4: STUDENT LEADS CRM */}
          {!isTeacher && activeTab === 'inquiries' && (
            <div>
              <div className={styles.pageHeaderRow}>
                <div>
                  <h1 className={styles.pageTitle}>Lead Management</h1>
                  <div className={styles.pageMetaBadge}>
                    <span>{inquiries.length} total prospect inquiries</span>
                  </div>
                </div>
              </div>

              <div className={styles.filterBar} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.775rem', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={
                        filteredInquiries.length > 0 &&
                        filteredInquiries.every((inq) => selectedInquiryIds.includes(inq.id))
                      }
                      onChange={handleToggleSelectAllInquiries}
                      style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: 'var(--accent-red)' }}
                    />
                    <span>Select All Leads ({filteredInquiries.length})</span>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.775rem', color: '#8a99ad' }}>Filter status:</div>
                  <select
                    value={inquiryStatusFilter}
                    onChange={(e) => setInquiryStatusFilter(e.target.value)}
                    className={styles.selectInput}
                  >
                    <option value="ALL">All Prospects ({inquiries.length})</option>
                    <option value="NEW">New Leads</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="ENROLLED">Enrolled</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              {/* BATCH ACTION BAR FOR SELECTED LEADS */}
              {selectedInquiryIds.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '10px',
                    padding: '0.65rem 1rem',
                    marginBottom: '1rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#f1f5f9', fontWeight: 600 }}>
                    <span>{selectedInquiryIds.length} lead(s) selected</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Mark status:</span>
                    <button
                      onClick={() => handleBatchUpdateInquiriesStatus('CONTACTED')}
                      className={styles.btnSecondary}
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                    >
                      Contacted
                    </button>
                    <button
                      onClick={() => handleBatchUpdateInquiriesStatus('ENROLLED')}
                      className={styles.btnSecondary}
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                    >
                      Enrolled
                    </button>
                    <button
                      onClick={() => handleBatchUpdateInquiriesStatus('ARCHIVED')}
                      className={styles.btnSecondary}
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                    >
                      Archived
                    </button>
                    <button
                      onClick={handleBatchDeleteInquiries}
                      className={styles.btnDestructive}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                    >
                      Delete Selected ({selectedInquiryIds.length})
                    </button>
                    <button
                      onClick={() => setSelectedInquiryIds([])}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
              )}

              {/* INQUIRIES TABLE / EMPTY STATE */}
              {filteredInquiries.length === 0 ? (
                <div className={styles.tableCard}>
                  <div className={styles.emptyStateCard}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                    </svg>
                    <div className={styles.emptyStateTitle}>No prospect leads found</div>
                    <div className={styles.emptyStateDesc}>There are no inquiries matching your selected status filter.</div>
                    <button onClick={() => setInquiryStatusFilter('ALL')} className={styles.btnSecondary} style={{ marginTop: '0.5rem' }}>
                      Show All Prospects
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
                            <th style={{ width: '40px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={
                                  filteredInquiries.length > 0 &&
                                  filteredInquiries.every((inq) => selectedInquiryIds.includes(inq.id))
                                }
                                onChange={handleToggleSelectAllInquiries}
                                title="Select All Visible Leads"
                                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-red)' }}
                              />
                            </th>
                            <th>Prospect</th>
                            <th>Interested Program</th>
                            <th>Contact Details</th>
                            <th>Message</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInquiries.map((inq) => {
                            const avatar = getAvatarDetails(inq.name);
                            const isSelected = selectedInquiryIds.includes(inq.id);
                            return (
                              <tr key={inq.id} style={isSelected ? { backgroundColor: 'rgba(239, 68, 68, 0.05)' } : {}}>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectInquiry(inq.id)}
                                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-red)' }}
                                  />
                                </td>
                                <td>
                                  <div className={styles.studentCell}>
                                    <div
                                      className={styles.avatarCircle}
                                      style={{ background: avatar.bg, border: `1px solid ${avatar.border}` }}
                                    >
                                      {avatar.initials}
                                    </div>
                                    <div className={styles.studentName}>{inq.name}</div>
                                  </div>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>{inq.courseInterest}</span>
                                </td>
                                <td>
                                  <a href={`mailto:${inq.email}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'block', fontSize: '0.775rem' }}>
                                    {inq.email}
                                  </a>
                                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{inq.phone}</div>
                                </td>
                                <td style={{ maxWidth: '240px' }}>
                                  <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.775rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                    {inq.message}
                                  </div>
                                  <button
                                    onClick={() => setExpandedLeadMessage(inq)}
                                    style={{ background: 'none', border: 'none', color: 'var(--accent-red)', fontSize: '0.7rem', padding: 0, cursor: 'pointer', marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                  >
                                    View Full
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                                  </button>
                                </td>
                                <td>
                                  <button
                                    onClick={() => cycleInquiryStatus(inq.id, inq.status)}
                                    className={`${styles.badge} ${inq.status === 'NEW'
                                        ? styles.badgeNew
                                        : inq.status === 'CONTACTED'
                                          ? styles.badgeContacted
                                          : inq.status === 'ENROLLED'
                                            ? styles.badgeEnrolled
                                            : styles.badgeArchived
                                      }`}
                                    style={{ cursor: 'pointer' }}
                                    title="Click to cycle status"
                                  >
                                    <span className={styles.statusDot} />
                                    {inq.status}
                                  </button>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    onClick={() => handleDeleteInquiry(inq.id)}
                                    className={styles.btnDestructive}
                                    title="Delete inquiry"
                                  >
                                    Delete
                                  </button>
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
                      return (
                        <div key={inq.id} className={styles.mobileDataCard} style={isSelected ? { border: '1px solid rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.03)' } : {}}>
                          <div className={styles.mobileCardHeader}>
                            <div className={styles.mobileCardTitleBox}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectInquiry(inq.id)}
                                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-red)', marginRight: '0.3rem' }}
                              />
                              <div
                                className={styles.avatarCircle}
                                style={{ background: avatar.bg, border: `1px solid ${avatar.border}`, width: '34px', height: '34px' }}
                              >
                                {avatar.initials}
                              </div>
                              <div>
                                <div className={styles.mobileCardTitle}>{inq.name}</div>
                                <div className={styles.mobileCardSubText}>{inq.email}</div>
                              </div>
                            </div>
                            <button
                              onClick={() => cycleInquiryStatus(inq.id, inq.status)}
                              className={`${styles.badge} ${inq.status === 'NEW'
                                  ? styles.badgeNew
                                  : inq.status === 'CONTACTED'
                                    ? styles.badgeContacted
                                    : inq.status === 'ENROLLED'
                                      ? styles.badgeEnrolled
                                      : styles.badgeArchived
                                }`}
                              style={{ cursor: 'pointer', fontSize: '0.65rem' }}
                            >
                              <span className={styles.statusDot} />
                              {inq.status}
                            </button>
                          </div>

                          <div className={styles.mobileCardBody}>
                            <div className={styles.mobileCardRow}>
                              <span className={styles.mobileCardLabel}>Program</span>
                              <span className={styles.mobileCardValue}>{inq.courseInterest}</span>
                            </div>
                            <div className={styles.mobileCardRow}>
                              <span className={styles.mobileCardLabel}>Phone</span>
                              <span className={styles.mobileCardValue}>{inq.phone || 'N/A'}</span>
                            </div>
                            <div style={{ marginTop: '0.2rem', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                              "{(inq.message || '').slice(0, 90)}..."
                            </div>
                          </div>

                          <div className={styles.mobileCardActions}>
                            <button
                              onClick={() => setExpandedLeadMessage(inq)}
                              className={styles.btnSecondary}
                              style={{ height: '34px', fontSize: '0.775rem' }}
                            >
                              View Full Message
                            </button>
                            <button
                              onClick={() => handleDeleteInquiry(inq.id)}
                              className={styles.btnDestructive}
                              style={{ height: '34px', padding: '0 0.6rem' }}
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
                    All Submissions ({admissions.length})
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
                    DJ Forms ({admissions.filter((a) => a.formType === 'DJ').length})
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
                    EMP Forms ({admissions.filter((a) => a.formType === 'EMP').length})
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
                                    <div
                                      className={styles.avatarCircle}
                                      style={{ background: avatar.bg, border: `1px solid ${avatar.border}` }}
                                    >
                                      {avatar.initials}
                                    </div>
                                    <div>
                                      <div className={styles.studentName} style={{ fontWeight: 600 }}>{item.firstName} {item.lastName}</div>
                                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Father: {item.fatherName}</div>
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
                                  <button
                                    onClick={() => cycleAdmissionStatus(item.id, item.status)}
                                    className={`${styles.badge} ${item.status === 'NEW'
                                        ? styles.badgeNew
                                        : item.status === 'CONTACTED'
                                          ? styles.badgeContacted
                                          : item.status === 'ENROLLED'
                                            ? styles.badgeEnrolled
                                            : styles.badgeArchived
                                      }`}
                                    style={{ cursor: 'pointer' }}
                                    title="Click to cycle status"
                                  >
                                    <span className={styles.statusDot} />
                                    {item.status}
                                  </button>
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
                              <div
                                className={styles.avatarCircle}
                                style={{ background: avatar.bg, border: `1px solid ${avatar.border}`, width: '34px', height: '34px' }}
                              >
                                {avatar.initials}
                              </div>
                              <div>
                                <div className={styles.mobileCardTitle}>{item.firstName} {item.lastName}</div>
                                <div className={styles.mobileCardSubText}>Form No: {item.formNo}</div>
                              </div>
                            </div>
                            <button
                              onClick={() => cycleAdmissionStatus(item.id, item.status)}
                              className={`${styles.badge} ${item.status === 'NEW'
                                  ? styles.badgeNew
                                  : item.status === 'CONTACTED'
                                    ? styles.badgeContacted
                                    : item.status === 'ENROLLED'
                                      ? styles.badgeEnrolled
                                      : styles.badgeArchived
                                }`}
                              style={{ cursor: 'pointer', fontSize: '0.65rem' }}
                            >
                              <span className={styles.statusDot} />
                              {item.status}
                            </button>
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
                                  {receipt.date ? new Date(receipt.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                </td>
                                <td style={{ fontWeight: 600 }}>{receipt.studentName}</td>
                                <td style={{ color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {receipt.courseName}
                                </td>
                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  ₹{receipt.amount.toLocaleString('en-IN')}
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 500 }}>
                                    {receipt.paymentMode}
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {receipt.periodFrom && receipt.periodTo
                                    ? `${receipt.periodFrom} → ${receipt.periodTo}`
                                    : '—'}
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
                    <span>System security, notifications, and data exports</span>
                  </div>
                </div>
              </div>

              {/* Constrained width container (max-w-800px, left aligned) */}
              <div className={styles.settingsContainer}>
                {/* CARD 1: SECURITY CREDENTIALS */}
                <div className={styles.settingsCard}>
                  <h3 className={styles.settingsCardTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 2l-2 2m-1.5 1.5L4 19.5a2.5 2.5 0 1 1-3.5-3.5L16 2.5 17.5 4z" />
                      <circle cx="18" cy="6" r="3" />
                    </svg>
                    Console Passcode Security
                  </h3>
                  <p className={styles.settingsCardDesc}>
                    Update the secret passcode required to access soundabode.com/CMS-Admin.
                  </p>

                  <form onSubmit={handleChangePasscode} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                      type="password"
                      placeholder="New admin passcode..."
                      value={newPasscode}
                      onChange={(e) => setNewPasscode(e.target.value)}
                      className={styles.formInput}
                      style={{ maxWidth: '300px' }}
                    />
                    <button type="submit" className={styles.btnSecondary}>
                      Save Passcode
                    </button>
                  </form>
                  {settingsSuccessMsg && (
                    <div style={{ color: 'var(--text-success)', fontSize: '0.775rem', fontWeight: 500 }}>
                      {settingsSuccessMsg}
                    </div>
                  )}
                </div>

                {/* CARD 2: NOTIFICATION PREFERENCES */}
                <div className={styles.settingsCard}>
                  <h3 className={styles.settingsCardTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    Notification Preferences
                  </h3>
                  <p className={styles.settingsCardDesc}>
                    Configure automated email alerts and studio class log notifications.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                      <span>Instant Email Alerts for New Student Leads</span>
                      <input
                        type="checkbox"
                        checked={emailAlertsEnabled}
                        onChange={(e) => setEmailAlertsEnabled(e.target.checked)}
                        style={{ accentColor: 'var(--accent-red)', width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                      <span>Daily Student Attendance Class Log Reminders</span>
                      <input
                        type="checkbox"
                        checked={attendanceRemindersEnabled}
                        onChange={(e) => setAttendanceRemindersEnabled(e.target.checked)}
                        style={{ accentColor: 'var(--accent-red)', width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </label>
                  </div>
                </div>

                {/* CARD 3: DATABASE BACKUP EXPORT */}
                <div className={styles.settingsCard}>
                  <h3 className={styles.settingsCardTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <ellipse cx="12" cy="5" rx="9" ry="3" />
                      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                    </svg>
                    Data Snapshot Backup
                  </h3>
                  <p className={styles.settingsCardDesc}>
                    Export a full JSON database snapshot containing articles, prospect CRM leads, and student attendance logs.
                  </p>

                  <div>
                    <button onClick={handleExportBackup} className={styles.btnSecondary} style={{ gap: '0.4rem' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Export JSON Snapshot
                    </button>
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
                      — {numberToWords(parseFloat(feeFormData.amount) || 0)} Rupees Only
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
      {expandedLeadMessage && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Prospect Inquiry Details</h2>
              <button onClick={() => setExpandedLeadMessage(null)} className={styles.closeModalBtn}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{expandedLeadMessage.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#8a99ad', marginTop: '2px' }}>
                  {expandedLeadMessage.email} • {expandedLeadMessage.phone}
                </div>
              </div>

              <div style={{ background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  INTERESTED PROGRAM: {expandedLeadMessage.courseInterest}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#f1f5f9', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  "{expandedLeadMessage.message}"
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
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
                  <select
                    value={selectedStudentId || ''}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className={styles.selectInput}
                    style={{ width: '100%' }}
                  >
                    {students.map((std) => (
                      <option key={std.id} value={std.id}>
                        {std.name} ({std.course})
                      </option>
                    ))}
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
                      onChange={(e) => setAttendanceFormDate(e.target.value)}
                      className={styles.searchInput}
                      style={{ width: '100%', maxWidth: 'none' }}
                    />
                  </div>

                  {/* CUSTOM TIME SLOT PICKER */}
                  <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                    <label className={styles.formLabel}>Custom Time Slot</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label className={styles.formLabel} style={{ fontSize: '0.725rem', color: '#8a99ad' }}>Start Time</label>
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
                        <label className={styles.formLabel} style={{ fontSize: '0.725rem', color: '#8a99ad' }}>End Time</label>
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setAttendanceFormStatus('PRESENT')}
                      style={{
                        background: attendanceFormStatus === 'PRESENT' ? 'var(--bg-hover)' : 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        border: `1px solid ${attendanceFormStatus === 'PRESENT' ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
                        padding: '0.45rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-success)', display: 'inline-block' }} />
                      PRESENT
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceFormStatus('ABSENT')}
                      style={{
                        background: attendanceFormStatus === 'ABSENT' ? 'var(--bg-hover)' : 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        border: `1px solid ${attendanceFormStatus === 'ABSENT' ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
                        padding: '0.45rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-danger)', display: 'inline-block' }} />
                      ABSENT
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceFormStatus('NA')}
                      style={{
                        background: attendanceFormStatus === 'NA' ? 'var(--bg-hover)' : 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        border: `1px solid ${attendanceFormStatus === 'NA' ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
                        padding: '0.45rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block' }} />
                      NA
                    </button>
                  </div>
                </div>

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
                {editingAttendanceId ? (
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

                {/* COURSE + DATE */}
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Course Opted</label>
                    <select
                      value={studentFormData.course}
                      onChange={(e) => setStudentFormData({ ...studentFormData, course: e.target.value })}
                      className={styles.formSelect}
                    >
                      <option value="DJ Course">DJ Course</option>
                      <option value="Basic DJ Course">Basic DJ Course</option>
                      <option value="Pro DJ Course">Pro DJ Course</option>
                      <option value="Special DJ Course">Special DJ Course</option>
                      <option value="DJ Pro Course">DJ Pro Course</option>
                      <option value="EMP Basic">EMP Basic</option>
                      <option value="EMP Diploma">EMP Diploma</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Enrolled Date</label>
                    <input
                      type="date"
                      value={studentFormData.enrolledDate}
                      onChange={(e) => setStudentFormData({ ...studentFormData, enrolledDate: e.target.value })}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                {/* BATCH */}
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
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: '750px', background: '#08090a' }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Official Student Attendance Report</h2>
              <button onClick={() => setIsReportModalOpen(false)} className={styles.closeModalBtn}>
                ✕
              </button>
            </div>

            <div className={styles.modalBody} style={{ background: '#ffffff', color: '#0f172a', padding: '2rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e11d48', paddingBottom: '0.85rem', marginBottom: '1.25rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <img
                    src="/favicon-192x192.png"
                    alt="Soundabode Logo"
                    style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'contain' }}
                  />
                  <div>
                    <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#e11d48', margin: 0 }}>SOUNDABODE ACADEMY</h1>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Vision 9 Mall, Pimple Saudagar, Pune • Audio Engineering &amp; DJ Academy</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#475569' }}>
                  <div>Report Date: {new Date().toLocaleDateString()}</div>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>OFFICIAL ATTENDANCE REPORT</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '6px', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>STUDENT NAME</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{activeStudent.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>{activeStudent.email} • {activeStudent.phone}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>PROGRAM &amp; BATCH</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{activeStudent.course}</div>
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>{activeStudent.batch}</div>
                </div>
              </div>

              {/* STATS SUMMARY */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ background: '#f1f5f9', padding: '0.65rem 1rem', borderRadius: '6px', flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>TOTAL SESSIONS</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{totalMarked}</div>
                </div>
                <div style={{ background: '#ecfdf5', padding: '0.65rem 1rem', borderRadius: '6px', flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#047857' }}>PRESENT</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#047857' }}>{totalPresent}</div>
                </div>
                <div style={{ background: '#fef2f2', padding: '0.65rem 1rem', borderRadius: '6px', flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#b91c1c' }}>ABSENT</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#b91c1c' }}>{totalAbsent}</div>
                </div>
                <div style={{ background: '#fef3c7', padding: '0.65rem 1rem', borderRadius: '6px', flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#b45309' }}>ATTENDANCE RATE</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#b45309' }}>{attendancePercentage}%</div>
                </div>
              </div>

              {/* LOGS TABLE */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Date</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Time Slot</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Status</th>
                    {!isTeacher && <th style={{ padding: '0.4rem 0.5rem' }}>Marked By</th>}
                    <th style={{ padding: '0.4rem 0.5rem' }}>Mentor Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAttendanceRecords.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>{r.date}</td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>{r.timeSlot}</td>
                      <td style={{ padding: '0.4rem 0.5rem', fontWeight: 700, color: r.status === 'PRESENT' ? '#047857' : '#b91c1c' }}>
                        {r.status}
                      </td>
                      {!isTeacher && (
                        <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600, color: '#e11d48' }}>
                          {r.markedByName || 'Staff'}
                        </td>
                      )}
                      <td style={{ padding: '0.4rem 0.5rem', color: '#334155' }}>{r.comment || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.modalFooter}>
              <button onClick={() => window.print()} className={styles.btnSecondary} style={{ gap: '0.4rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print PDF
              </button>
              <button onClick={() => setIsReportModalOpen(false)} className={styles.btnSecondary}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLOG POST & AUTHOR EDIT MODAL */}
      {isBlogModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingPostId ? 'Edit Article & Author Details' : 'Create New Article'}
              </h2>
              <button onClick={() => setIsBlogModalOpen(false)} className={styles.closeModalBtn}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBlog}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Article Title</label>
                  <input
                    type="text"
                    required
                    value={blogFormData.title}
                    onChange={(e) => setBlogFormData({ ...blogFormData, title: e.target.value })}
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Category</label>
                    <select
                      value={blogFormData.category}
                      onChange={(e) =>
                        setBlogFormData({ ...blogFormData, category: e.target.value as BlogPost['category'] })
                      }
                      className={styles.formSelect}
                    >
                      <option value="PRODUCTION">PRODUCTION</option>
                      <option value="DJING">DJING</option>
                      <option value="GENERAL">GENERAL</option>
                      <option value="ACADEMY NEWS">ACADEMY NEWS</option>
                      <option value="GEAR & TECH">GEAR &amp; TECH</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Read Time (Minutes)</label>
                    <input
                      type="number"
                      value={blogFormData.readTimeMinutes}
                      onChange={(e) => setBlogFormData({ ...blogFormData, readTimeMinutes: Number(e.target.value) })}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Cover Image URL</label>
                  <input
                    type="text"
                    required
                    value={blogFormData.coverImage}
                    onChange={(e) => setBlogFormData({ ...blogFormData, coverImage: e.target.value })}
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Short Excerpt</label>
                  <textarea
                    rows={2}
                    required
                    value={blogFormData.excerpt}
                    onChange={(e) => setBlogFormData({ ...blogFormData, excerpt: e.target.value })}
                    className={styles.formInput}
                    style={{ minHeight: '50px' }}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>HTML Article Content</label>
                  <textarea
                    required
                    value={blogFormData.content}
                    onChange={(e) => setBlogFormData({ ...blogFormData, content: e.target.value })}
                    className={styles.formTextarea}
                  />
                </div>

                {/* EDIT AUTHOR CREDENTIALS */}
                <div style={{ marginTop: '0.5rem', padding: '0.85rem', background: 'var(--bg-surface)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e11d48', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Author Profile &amp; Credentials
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Author Name</label>
                      <input
                        type="text"
                        required
                        value={blogFormData.authorName}
                        onChange={(e) => setBlogFormData({ ...blogFormData, authorName: e.target.value })}
                        className={styles.formInput}
                        placeholder="e.g. Aditya Sharma"
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Author Role / Title</label>
                      <input
                        type="text"
                        required
                        value={blogFormData.authorRole}
                        onChange={(e) => setBlogFormData({ ...blogFormData, authorRole: e.target.value })}
                        className={styles.formInput}
                        placeholder="e.g. Certified Ableton Instructor"
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup} style={{ marginTop: '0.75rem' }}>
                    <label className={styles.formLabel}>Author Avatar Image URL</label>
                    <input
                      type="text"
                      value={blogFormData.authorAvatarUrl}
                      onChange={(e) => setBlogFormData({ ...blogFormData, authorAvatarUrl: e.target.value })}
                      className={styles.formInput}
                      placeholder="https://images.unsplash.com/photo-..."
                    />
                  </div>
                </div>

                {/* ── SEO & META SECTION ── */}
                <div style={{ marginTop: '0.5rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>

                  {/* SECTION HEADER */}
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    SEO &amp; Meta Settings
                  </div>

                  {/* META TITLE */}
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Meta Title <span style={{ color: '#818cf8' }}>(title tag)</span></span>
                      <span style={{ color: blogFormData.metaTitle.length > 60 ? '#f87171' : blogFormData.metaTitle.length > 50 ? '#fbbf24' : 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 400 }}>{blogFormData.metaTitle.length}/60</span>
                    </label>
                    <input
                      type="text"
                      placeholder={blogFormData.title || 'Defaults to article title if blank'}
                      value={blogFormData.metaTitle}
                      onChange={(e) => setBlogFormData({ ...blogFormData, metaTitle: e.target.value })}
                      className={styles.formInput}
                      maxLength={80}
                    />
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Recommended: 50–60 characters. Shown in Google search results &amp; browser tabs.</span>
                  </div>

                  {/* META DESCRIPTION */}
                  <div className={styles.formGroup} style={{ marginTop: '0.75rem' }}>
                    <label className={styles.formLabel} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Meta Description</span>
                      <span style={{ color: blogFormData.metaDescription.length > 160 ? '#f87171' : blogFormData.metaDescription.length > 140 ? '#fbbf24' : 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 400 }}>{blogFormData.metaDescription.length}/160</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="A concise summary for Google snippets (150–160 chars)..."
                      value={blogFormData.metaDescription}
                      onChange={(e) => setBlogFormData({ ...blogFormData, metaDescription: e.target.value })}
                      className={styles.formInput}
                      style={{ minHeight: '60px', resize: 'vertical' }}
                      maxLength={200}
                    />
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Shown under the page title in Google SERPs. Use your focus keyword naturally.</span>
                  </div>

                  {/* FOCUS KEYWORD + SCHEMA TYPE */}
                  <div className={styles.formRow} style={{ marginTop: '0.75rem' }}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Focus Keyword</label>
                      <input
                        type="text"
                        placeholder="e.g. DJ course Pune"
                        value={blogFormData.focusKeyword}
                        onChange={(e) => setBlogFormData({ ...blogFormData, focusKeyword: e.target.value })}
                        className={styles.formInput}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Schema Type <span style={{ color: '#818cf8' }}>(JSON-LD)</span></label>
                      <select
                        value={blogFormData.schemaType}
                        onChange={(e) => setBlogFormData({ ...blogFormData, schemaType: e.target.value as 'Article' | 'BlogPosting' | 'NewsArticle' })}
                        className={styles.formSelect}
                      >
                        <option value="BlogPosting">BlogPosting (recommended)</option>
                        <option value="Article">Article</option>
                        <option value="NewsArticle">NewsArticle</option>
                      </select>
                    </div>
                  </div>

                  {/* CANONICAL URL */}
                  <div className={styles.formGroup} style={{ marginTop: '0.75rem' }}>
                    <label className={styles.formLabel}>Canonical URL <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem', textTransform: 'none', letterSpacing: 0 }}>(optional — leave blank to auto-generate)</span></label>
                    <input
                      type="url"
                      placeholder="https://soundabode.com/blog/your-article-slug"
                      value={blogFormData.canonicalUrl}
                      onChange={(e) => setBlogFormData({ ...blogFormData, canonicalUrl: e.target.value })}
                      className={styles.formInput}
                    />
                  </div>

                  {/* OPEN GRAPH SECTION */}
                  <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(99, 102, 241, 0.12)' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>Open Graph / Social Sharing</div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>OG Title <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem', textTransform: 'none' }}>(Facebook, LinkedIn, WhatsApp)</span></label>
                      <input
                        type="text"
                        placeholder={blogFormData.metaTitle || blogFormData.title || 'Defaults to meta title or article title'}
                        value={blogFormData.ogTitle}
                        onChange={(e) => setBlogFormData({ ...blogFormData, ogTitle: e.target.value })}
                        className={styles.formInput}
                      />
                    </div>

                    <div className={styles.formGroup} style={{ marginTop: '0.6rem' }}>
                      <label className={styles.formLabel}>OG Description</label>
                      <textarea
                        rows={2}
                        placeholder="Short compelling social preview description..."
                        value={blogFormData.ogDescription}
                        onChange={(e) => setBlogFormData({ ...blogFormData, ogDescription: e.target.value })}
                        className={styles.formInput}
                        style={{ minHeight: '55px', resize: 'vertical' }}
                      />
                    </div>

                    <div className={styles.formRow} style={{ marginTop: '0.6rem' }}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>OG Image URL <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem', textTransform: 'none' }}>1200×630px</span></label>
                        <input
                          type="text"
                          placeholder={blogFormData.coverImage || 'Defaults to cover image'}
                          value={blogFormData.ogImage}
                          onChange={(e) => setBlogFormData({ ...blogFormData, ogImage: e.target.value })}
                          className={styles.formInput}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Twitter Card Type</label>
                        <select
                          value={blogFormData.twitterCard}
                          onChange={(e) => setBlogFormData({ ...blogFormData, twitterCard: e.target.value as 'summary' | 'summary_large_image' })}
                          className={styles.formSelect}
                        >
                          <option value="summary_large_image">Summary Large Image</option>
                          <option value="summary">Summary (small image)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* NO INDEX TOGGLE */}
                  <div style={{ marginTop: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <input
                      type="checkbox"
                      id="noIndexToggle"
                      checked={blogFormData.noIndex}
                      onChange={(e) => setBlogFormData({ ...blogFormData, noIndex: e.target.checked })}
                      style={{ width: '15px', height: '15px', accentColor: '#818cf8', cursor: 'pointer' }}
                    />
                    <label htmlFor="noIndexToggle" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <strong>No-Index</strong> — Prevent search engines from indexing this article
                      {blogFormData.noIndex && <span style={{ color: '#f87171', marginLeft: '0.4rem', fontSize: '0.7rem' }}>⚠ This page will be hidden from Google</span>}
                    </label>
                  </div>

                </div>

              </div>{/* end modalBody */}

              <div className={styles.modalFooter}>
                <button type="button" onClick={() => setIsBlogModalOpen(false)} className={styles.btnSecondary}>
                  Cancel
                </button>

                <button type="submit" className={styles.btnPrimary}>
                  Save Article &amp; Author
                </button>
              </div>
            </form>
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
                      <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
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

                    <div className={admissionStyles.softwarePills}>
                      <span className={admissionStyles.softwarePill}>ABLETON LIVE</span>
                      <span className={admissionStyles.softwarePill}>NATIVE INSTRUMENTS</span>
                      <span className={admissionStyles.softwarePill}>WAVES ACCESS</span>
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

      {/* REAL-TIME LEAD NOTIFICATION TOAST */}
      {realtimeLeadToast && (
        <div className={styles.realtimeLeadToast}>
          <div className={styles.toastIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div className={styles.toastContent}>
            <div className={styles.toastTitle}>NEW LEAD SUBMISSION RECORDED</div>
            <div className={styles.toastBody}>
              <strong>{realtimeLeadToast.name}</strong> • {realtimeLeadToast.courseInterest}
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
    </div>
  );
};

export default CmsAdminPage;
