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

// Persistent token key — stored in localStorage so credentials persist permanently across tab closes.
const SESSION_TOKEN_KEY = 'soundabode_cms_session_token';
const SESSION_USER_KEY = 'soundabode_cms_session_user';




export class AuthService {
  /** Retrieve the active session token (if any). */
  static getSessionToken(): string | null {
    try {
      return localStorage.getItem(SESSION_TOKEN_KEY) || sessionStorage.getItem(SESSION_TOKEN_KEY);
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
      const raw = localStorage.getItem(SESSION_USER_KEY) || sessionStorage.getItem(SESSION_USER_KEY);
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

    // Authentication is ONLY performed server-side — no client-side fallback
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailKey, passcode: passAttempt }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.user) {
        try {
          if (data.token) {
            localStorage.setItem(SESSION_TOKEN_KEY, data.token);
          }
          localStorage.setItem(SESSION_USER_KEY, JSON.stringify(data.user));
        } catch {}
        return { success: true, user: data.user };
      }

      // Server explicitly rejected the credentials
      return {
        success: false,
        error: data.error || 'Invalid credentials. Check your email address and passcode.',
      };
    } catch {
      // Server unreachable — do NOT fall back to client-side auth
      return {
        success: false,
        error: 'Cannot reach the server. Please check your connection and try again.',
      };
    }
  }

  static logout(): void {
    try {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem(SESSION_USER_KEY);
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
