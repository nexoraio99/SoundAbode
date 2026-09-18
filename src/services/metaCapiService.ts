import { AuthService } from './authService';
import { getApiBaseUrl } from './apiConfig';

const API_BASE_URL = getApiBaseUrl();

/** CAPI Event names that correspond to CRM stages */
export type CapiEventName = 'Lead' | 'Contact' | 'Subscribe';

/** Maps inquiry status values to CAPI event names (null = no event) */
export const CAPI_STATUS_MAP: Record<string, CapiEventName | null> = {
  NEW: 'Lead',
  CONTACTED: 'Contact',
  ENROLLED: 'Subscribe',
  ARCHIVED: null,
};

export interface CapiTestResult {
  success: boolean;
  message?: string;
  error?: string;
  status?: number;
  body?: unknown;
}

/**
 * Sends a test CAPI event to Meta Events Manager via the server endpoint.
 * Requires META_TEST_EVENT_CODE to be set in server/.env.
 * Admin-only — requires a valid auth token.
 */
export async function triggerCapiTestEvent(): Promise<CapiTestResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/meta-capi/test`, {
      method: 'POST',
      headers: {
        ...AuthService.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return data as CapiTestResult;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: `Network error: ${message}` };
  }
}

/**
 * Returns the CAPI event name that will be fired for a given inquiry status.
 * Returns null if the status does not trigger a CAPI event.
 */
export function getCapiEventNameForStatus(status: string): CapiEventName | null {
  return CAPI_STATUS_MAP[status] ?? null;
}

/**
 * Returns a human-readable label for the CAPI event name.
 */
export function getCapiEventLabel(eventName: CapiEventName | null): string {
  switch (eventName) {
    case 'Lead':      return 'Meta: Lead event';
    case 'Contact':   return 'Meta: Contact event';
    case 'Subscribe': return 'Meta: Subscribe event';
    default:          return 'No Meta event';
  }
}
