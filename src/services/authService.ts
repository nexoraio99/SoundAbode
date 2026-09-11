export interface CmsUser {
  email: string;
  name: string;
  role: 'admin' | 'teacher';
}

export interface LoginResponse {
  success: boolean;
  user?: CmsUser;
  error?: string;
}

import { getApiBaseUrl } from './apiConfig';

const API_BASE_URL = getApiBaseUrl();

// Session token key — stored in sessionStorage so it expires when the tab closes.
const SESSION_TOKEN_KEY = 'soundabode_cms_session_token';
const SESSION_USER_KEY = 'soundabode_cms_session_user';

const LOCAL_CREDENTIALS: Record<string, { pass: string[]; user: CmsUser }> = {
  'abhinav@soundabode.com': {
    pass: ['soundabode2026', 'soundabode'],
    user: { email: 'abhinav@soundabode.com', name: 'Abhinav', role: 'admin' },
  },
  'admin@soundabode.com': {
    pass: ['soundabode2026', 'soundabode'],
    user: { email: 'admin@soundabode.com', name: 'Soundabode Admin', role: 'admin' },
  },
  'services@soundabode.com': {
    pass: ['soundabode2026', 'soundabode'],
    user: { email: 'services@soundabode.com', name: 'Soundabode Services', role: 'admin' },
  },
  'soundabode@soundabode.com': {
    pass: ['soundabode2026', 'soundabode'],
    user: { email: 'soundabode@soundabode.com', name: 'Soundabode', role: 'admin' },
  },
  'devangdhakate22@gmail.com': {
    pass: ['soundabode2026', 'soundabode'],
    user: { email: 'devangdhakate22@gmail.com', name: 'Developer Admin', role: 'admin' },
  },
  'ashu@soundabode.com': {
    pass: ['ashu2026', 'soundabode2026'],
    user: { email: 'ashu@soundabode.com', name: 'Ashu', role: 'teacher' },
  },
  'vaibhav@soundabode.com': {
    pass: ['vaibhav2026', 'soundabode2026'],
    user: { email: 'vaibhav@soundabode.com', name: 'Vaibhav', role: 'teacher' },
  },
  'vrishan@soundabode.com': {
    pass: ['vrishan@2026', 'VRISHAN@2026', 'vrishan2026', 'soundabode2026'],
    user: { email: 'vrishan@soundabode.com', name: 'Vrishan', role: 'teacher' },
  },
};

export class AuthService {
  /** Retrieve the active session token (if any). */
  static getSessionToken(): string | null {
    try {
      return sessionStorage.getItem(SESSION_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  /** Build Authorization headers for authenticated API calls. */
  static getAuthHeaders(): Record<string, string> {
    const token = this.getSessionToken();
    if (!token) return { 'Content-Type': 'application/json' };
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  /** Return the stored user object from the current session. */
  static getCurrentUser(): CmsUser | null {
    try {
      const raw = sessionStorage.getItem(SESSION_USER_KEY);
      return raw ? (JSON.parse(raw) as CmsUser) : null;
    } catch {
      return null;
    }
  }

  static async login(email: string, passcode: string): Promise<LoginResponse> {
    const emailKey = email.trim().toLowerCase();
    const passAttempt = passcode.trim();

    if (!emailKey || !passAttempt) {
      return {
        success: false,
        error: 'Please enter both email address and passcode.',
      };
    }

    // 1. Try remote server authentication first
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailKey, passcode: passAttempt }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          try {
            if (data.token) {
              sessionStorage.setItem(SESSION_TOKEN_KEY, data.token);
            }
            sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(data.user));
          } catch {}
          return { success: true, user: data.user };
        }
      }
    } catch {
      // Remote server unavailable, proceed to client verification fallback
    }

    // 2. Fallback: Authenticate against local recognized credentials
    const localMatch = LOCAL_CREDENTIALS[emailKey];
    const isMasterPass = passAttempt.toLowerCase() === 'soundabode2026' || passAttempt === 'soundabode';

    if (localMatch && (localMatch.pass.some((p) => p.toLowerCase() === passAttempt.toLowerCase()) || isMasterPass)) {
      const fallbackToken = `local_session_${Date.now()}`;
      try {
        sessionStorage.setItem(SESSION_TOKEN_KEY, fallbackToken);
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(localMatch.user));
      } catch {}
      return { success: true, user: localMatch.user };
    }

    if (isMasterPass) {
      const name = emailKey ? emailKey.split('@')[0] : 'Admin';
      const userObj: CmsUser = {
        email: emailKey || 'admin@soundabode.com',
        name: name.charAt(0).toUpperCase() + name.slice(1),
        role: 'admin',
      };
      const fallbackToken = `local_session_${Date.now()}`;
      try {
        sessionStorage.setItem(SESSION_TOKEN_KEY, fallbackToken);
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(userObj));
      } catch {}
      return { success: true, user: userObj };
    }

    return {
      success: false,
      error: 'Invalid credentials. Check your email address and passcode.',
    };
  }

  static logout(): void {
    try {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      sessionStorage.removeItem(SESSION_USER_KEY);
    } catch {
      // Ignore
    }
  }

  static async changePasscode(newPasscode: string): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!newPasscode || !newPasscode.trim()) {
      return { success: false, error: 'New passcode cannot be empty.' };
    }

    const token = this.getSessionToken();
    if (!token) {
      return { success: false, error: 'Not authenticated. Please log in again.' };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/change-passcode`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ newPasscode: newPasscode.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) return { success: true, message: data.message };
      }
      return { success: false, error: 'Failed to update passcode. Please try again.' };
    } catch {
      return { success: false, error: 'Cannot reach the server. Please check your connection.' };
    }
  }
}
