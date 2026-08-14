export interface GoogleSheetsPayload {
  source: string;
  name: string;
  phone: string;
  email?: string;
  courseInterest: string;
  message?: string;
  formNo?: string;
  sheetName?: string;
  submittedAt?: string;
}

export class GoogleSheetsService {
  private static recentSubmissions = new Map<string, number>();
  private static WEB_APP_URL =
    (import.meta as any).env?.VITE_GOOGLE_SHEETS_URL ||
    (import.meta as any).env?.VITE_GOOGLE_SCRIPT_URL ||
    '';

  public static async submitToGoogleSheets(payload: GoogleSheetsPayload): Promise<boolean> {
    const rawUrl = (import.meta as any).env?.VITE_GOOGLE_SHEETS_URL || this.WEB_APP_URL;
    const url = (rawUrl || '').trim();

    // Deduplication signature
    const signature = `lead-${payload.email || payload.phone || payload.name}-${payload.source}-${payload.courseInterest}`;
    const now = Date.now();
    const lastSub = this.recentSubmissions.get(signature);
    if (lastSub && now - lastSub < 10000) {
      return true;
    }
    this.recentSubmissions.set(signature, now);

    const data = {
      fullName: payload.name,
      name: payload.name,
      phone: payload.phone || '',
      email: payload.email || '',
      course: payload.courseInterest,
      interest: payload.courseInterest,
      courseInterest: payload.courseInterest,
      source: payload.source,
      message: payload.message || '',
      formNo: payload.formNo || '',
      submittedAt: payload.submittedAt || new Date().toISOString(),
    };

    console.log('📝 Submitting Lead to Google Sheets:', data);

    if (!url) {
      console.warn(
        '⚠️ Google Sheets URL missing! Please add VITE_GOOGLE_SHEETS_URL=https://script.google.com/macros/s/.../exec to your .env file.'
      );
      return false;
    }

    try {
      const searchParams = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      const targetUrlWithQuery = url.includes('?')
        ? `${url}&${searchParams.toString()}`
        : `${url}?${searchParams.toString()}`;

      await fetch(targetUrlWithQuery, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(data),
      });

      console.log('✅ Google Sheets lead submitted successfully!');
      return true;
    } catch (err) {
      console.warn('⚠️ Google Sheets posting notice:', err);
      return false;
    }
  }
}