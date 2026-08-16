import { AuthService } from './authService';
import { getApiBaseUrl } from './apiConfig';

export interface SystemInfo {
  userAgent: string;
  screenResolution: string;
  activeTab: string;
  url: string;
  timestamp: string;
}

export interface DeveloperIssue {
  id: string;
  title: string;
  description: string;
  category: 'Bug / Technical Issue' | 'UI / Display Problem' | 'Feature Request' | 'Performance / Speed' | 'Other';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  reporterEmail: string;
  reporterName: string;
  reporterRole: 'admin' | 'teacher' | string;
  systemInfo: SystemInfo;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  developerNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateIssuePayload {
  title: string;
  description: string;
  category?: DeveloperIssue['category'];
  priority?: DeveloperIssue['priority'];
  activeTab?: string;
}

export const DEVELOPER_EMAIL = 'devangdhakate22@gmail.com';
export const SENDER_EMAIL = 'services@soundabode.com';

const LOCAL_STORAGE_KEY = 'soundabode_developer_issues';
export const ISSUE_EVENT_NAME = 'soundabode_issues_updated';
const API_BASE_URL = getApiBaseUrl();

// Cross-tab BroadcastChannel
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('soundabode_issues_channel');
  } catch {
    // Channel initialization fallback
  }
}

type IssueListener = (issues: DeveloperIssue[]) => void;

export class IssueService {
  private static listeners: IssueListener[] = [];

  /** Gather user agent and environment system diagnostics */
  static getSystemInfo(activeTab = 'overview'): SystemInfo {
    if (typeof window === 'undefined') {
      return {
        userAgent: 'Server-side',
        screenResolution: 'N/A',
        activeTab,
        url: '',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      userAgent: navigator.userAgent || 'Unknown Browser',
      screenResolution: `${window.screen.width}x${window.screen.height} (Viewport: ${window.innerWidth}x${window.innerHeight})`,
      activeTab,
      url: window.location.href,
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    };
  }

  /** Retrieve stored local issues fallback */
  private static getStoredIssues(): DeveloperIssue[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Fallback
    }
    return [];
  }

  /** Save issues locally */
  private static saveStoredIssues(issues: DeveloperIssue[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(issues));
    } catch {
      // Fallback
    }
    this.notifyChange(issues);
  }

  private static notifyChange(issues: DeveloperIssue[]): void {
    this.listeners.forEach((listener) => {
      try {
        listener(issues);
      } catch (err) {
        console.error('Error in issue listener:', err);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(ISSUE_EVENT_NAME, {
          detail: { issues },
        })
      );
    }

    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({
          type: 'ISSUES_UPDATED',
          issues,
        });
      } catch {
        // Fallback
      }
    }
  }

  static subscribe(listener: IssueListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Submit a new issue to developer */
  static async submitIssue(payload: CreateIssuePayload): Promise<{ success: boolean; issue?: DeveloperIssue; error?: string }> {
    const user = AuthService.getCurrentUser();
    const systemInfo = this.getSystemInfo(payload.activeTab || 'overview');

    const newIssue: DeveloperIssue = {
      id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      title: payload.title.trim(),
      description: payload.description.trim(),
      category: payload.category || 'Bug / Technical Issue',
      priority: payload.priority || 'Medium',
      reporterEmail: user?.email || 'anonymous@soundabode.com',
      reporterName: user?.name || 'CMS User',
      reporterRole: user?.role || 'user',
      systemInfo,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };

    // Always record locally immediately for instant feedback
    const localList = this.getStoredIssues();
    localList.unshift(newIssue);
    this.saveStoredIssues(localList);

    // Try posting to backend API
    try {
      const res = await fetch(`${API_BASE_URL}/issues`, {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify(newIssue),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.issue) {
          // Replace temporary local issue with server version if ID matches
          const updatedLocal = this.getStoredIssues().map((item) =>
            item.id === newIssue.id ? { ...data.issue, id: data.issue._id || data.issue.id } : item
          );
          this.saveStoredIssues(updatedLocal);
          return { success: true, issue: data.issue };
        }
      }
    } catch (err) {
      console.warn('Backend API submit issue unreachable, using local fallback mode:', err);
    }

    return { success: true, issue: newIssue };
  }

  /** Fetch issues for management or status check */
  static async fetchIssues(): Promise<DeveloperIssue[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/issues`, {
        method: 'GET',
        headers: AuthService.getAuthHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.issues)) {
          const formatted: DeveloperIssue[] = data.issues.map((i: any) => ({
            id: i._id || i.id,
            title: i.title || '',
            description: i.description || '',
            category: i.category || 'Bug / Technical Issue',
            priority: i.priority || 'Medium',
            reporterEmail: i.reporterEmail || '',
            reporterName: i.reporterName || '',
            reporterRole: i.reporterRole || '',
            systemInfo: i.systemInfo || {},
            status: i.status || 'OPEN',
            developerNotes: i.developerNotes || '',
            createdAt: i.createdAt || new Date().toISOString(),
            updatedAt: i.updatedAt,
          }));
          this.saveStoredIssues(formatted);
          return formatted;
        }
      }
    } catch {
      // Backend unavailable, fallback to local storage
    }

    return this.getStoredIssues();
  }

  /** Update issue status (OPEN, IN_PROGRESS, RESOLVED, CLOSED) */
  static async updateIssueStatus(id: string, status: DeveloperIssue['status'], developerNotes?: string): Promise<boolean> {
    const list = this.getStoredIssues();
    const updatedList = list.map((item) =>
      item.id === id ? { ...item, status, developerNotes: developerNotes ?? item.developerNotes, updatedAt: new Date().toISOString() } : item
    );
    this.saveStoredIssues(updatedList);

    try {
      const res = await fetch(`${API_BASE_URL}/issues/${id}`, {
        method: 'PATCH',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify({ status, developerNotes }),
      });
      return res.ok;
    } catch {
      return true; // Local update succeeded
    }
  }

  /** Delete issue */
  static async deleteIssue(id: string): Promise<boolean> {
    const list = this.getStoredIssues();
    const filtered = list.filter((item) => item.id !== id);
    this.saveStoredIssues(filtered);

    try {
      const res = await fetch(`${API_BASE_URL}/issues/${id}`, {
        method: 'DELETE',
        headers: AuthService.getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return true;
    }
  }

  /** Formats a text summary of the issue report to copy or mail */
  static formatDiagnosticReport(issue: Partial<DeveloperIssue>): string {
    const info = issue.systemInfo || this.getSystemInfo();
    return `[SOUNDABODE CMS ISSUE REPORT]
To: ${DEVELOPER_EMAIL}
From: ${SENDER_EMAIL}
Title: ${issue.title || 'Untitled'}
Category: ${issue.category || 'N/A'}
Priority: ${issue.priority || 'Medium'}
Reporter: ${issue.reporterName || 'CMS User'} (${issue.reporterEmail || 'N/A'})
Role: ${issue.reporterRole || 'User'}
Timestamp: ${info.timestamp || new Date().toISOString()}

--- ISSUE DESCRIPTION ---
${issue.description || 'No description provided.'}

--- SYSTEM DIAGNOSTICS ---
Browser/UA: ${info.userAgent}
Screen: ${info.screenResolution}
Active Tab: ${info.activeTab}
URL: ${info.url}
`;
  }
}
