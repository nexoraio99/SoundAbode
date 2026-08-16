import { AuthService } from './authService';
import { getApiBaseUrl } from './apiConfig';

export interface StudentReminderPayload {
  studentEmail: string;
  studentName: string;
  subject: string;
  message: string;
  reminderType?: 'FEE_PAYMENT' | 'ATTENDANCE' | 'CLASS_SCHEDULE' | 'GENERAL';
  courseName?: string;
}

const API_BASE_URL = getApiBaseUrl();

export class ReminderService {
  /** Send a student reminder email via backend Zoho Mail SMTP */
  static async sendStudentReminder(payload: StudentReminderPayload): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!payload.studentEmail || !payload.studentEmail.trim()) {
      return { success: false, error: 'Student email address is required.' };
    }
    if (!payload.subject || !payload.subject.trim()) {
      return { success: false, error: 'Reminder subject is required.' };
    }
    if (!payload.message || !payload.message.trim()) {
      return { success: false, error: 'Reminder message content is required.' };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/students/send-reminder`, {
        method: 'POST',
        headers: AuthService.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, message: data.message || 'Reminder email sent successfully to student!' };
      }
      return { success: false, error: data.error || 'Failed to send reminder email.' };
    } catch {
      return { success: false, error: 'Cannot reach the server. Please check your connection and try again.' };
    }
  }
}
