/**
 * metaCapi.js — Meta Conversions API (CAPI) Helper
 *
 * Sends qualified CRM lead-stage events to Meta Events Manager via the
 * server-side Conversions API (v26.0). All PII is SHA-256 hashed before
 * transmission per Meta's privacy requirements.
 *
 * Isolation contract:
 *  - This module is fire-and-forget. All errors are caught internally.
 *  - Callers never await this module; it cannot block or crash the server.
 *  - If META_ACCESS_TOKEN is not set, the module is a safe no-op.
 */

import { createHash } from 'crypto';

// ─── Configuration ─────────────────────────────────────────────────────────────
const META_API_VERSION = 'v26.0';
const DATASET_ID = process.env.META_DATASET_ID || '976314001636856';
const ACCESS_TOKEN = () => (process.env.META_ACCESS_TOKEN || '').trim();
const TEST_EVENT_CODE = () => (process.env.META_TEST_EVENT_CODE || '').trim();
const CRM_SOURCE_NAME = 'Soundabode CMS';

// ─── CRM Stage → CAPI Event Name Mapping ──────────────────────────────────────
// Maps inquiry statuses to Meta's standard or custom event names.
// Set a value to null to suppress the event for that status.
export const CAPI_EVENT_MAP = {
  NEW:       'Lead',       // Raw inbound lead (deduplicated with browser Pixel)
  CONTACTED: 'Contact',    // Admin outreach confirmed
  ENROLLED:  'Subscribe',  // Student enrolled — highest-value conversion
  ARCHIVED:  null,         // Disqualified — no event fired
};

// ─── PII Normalisation & Hashing ──────────────────────────────────────────────

/**
 * SHA-256 hashes a plain-text string.
 * Returns an empty string for null/undefined input (safe no-op).
 */
function hashSHA256(value) {
  if (!value || typeof value !== 'string') return '';
  return createHash('sha256').update(value).digest('hex');
}

/** Normalise email: lowercase + trim before hashing. */
function normalizeAndHashEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes('@')) return '';
  return hashSHA256(normalized);
}

/** Normalise phone: strip all non-digits before hashing (E.164 compatible). */
function normalizeAndHashPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length < 7) return '';
  return hashSHA256(digitsOnly);
}

// ─── Payload Builder ───────────────────────────────────────────────────────────

/**
 * Builds a CAPI-compliant payload object.
 *
 * @param {object} opts
 * @param {string}  opts.eventName       - e.g. 'Lead', 'Contact', 'Subscribe'
 * @param {number}  [opts.eventTime]     - UNIX timestamp (defaults to now)
 * @param {string}  [opts.email]         - Raw email (hashed internally)
 * @param {string}  [opts.phone]         - Raw phone (hashed internally)
 * @param {string}  [opts.fbclid]        - Raw fbclid from attribution
 * @param {string}  [opts.metaLeadId]    - Meta Lead Ad lead_id (15–17 digits)
 * @param {string}  [opts.clientIpAddress] - Client IP for match quality
 * @param {string}  [opts.clientUserAgent] - Client user-agent for match quality
 * @param {string}  [opts.fbp]           - Meta _fbp cookie value
 * @param {string}  [opts.fbc]           - Meta _fbc cookie value
 * @param {string}  [opts.eventSourceUrl] - URL where the event occurred
 * @param {boolean} [opts.isTest]        - If true, includes test_event_code
 */
function buildCapiPayload(opts) {
  const {
    eventName,
    eventTime = Math.floor(Date.now() / 1000),
    email,
    phone,
    fbclid,
    metaLeadId,
    clientIpAddress,
    clientUserAgent,
    fbp,
    fbc,
    eventSourceUrl,
    isTest = false,
  } = opts;

  const userData = {};

  const hashedEmail = normalizeAndHashEmail(email);
  if (hashedEmail) userData.em = [hashedEmail];

  const hashedPhone = normalizeAndHashPhone(phone);
  if (hashedPhone) userData.ph = [hashedPhone];

  // Generate external_id from email for cross-device matching
  if (hashedEmail) {
    userData.external_id = [hashedEmail];
  }

  // Client IP address (from server-side request headers)
  if (clientIpAddress && typeof clientIpAddress === 'string' && clientIpAddress.trim()) {
    userData.client_ip_address = clientIpAddress.trim();
  }

  // Client user-agent (from browser navigator.userAgent or request headers)
  if (clientUserAgent && typeof clientUserAgent === 'string' && clientUserAgent.trim()) {
    userData.client_user_agent = clientUserAgent.trim();
  }

  // Meta _fbp cookie (first-party browser ID — critical for match quality)
  if (fbp && typeof fbp === 'string' && fbp.trim()) {
    userData.fbp = fbp.trim();
  }

  // Meta _fbc cookie or constructed from fbclid
  if (fbc && typeof fbc === 'string' && fbc.trim()) {
    userData.fbc = fbc.trim();
  } else if (fbclid && typeof fbclid === 'string' && fbclid.trim()) {
    // Construct fbc cookie format: fb.1.<timestamp>.<fbclid>
    const ts = Math.floor(Date.now() / 1000);
    userData.fbc = `fb.1.${ts}.${fbclid.trim()}`;
  }

  // Meta Lead Ad ID (15–17 digit numeric string)
  if (metaLeadId && String(metaLeadId).trim()) {
    const leadIdStr = String(metaLeadId).trim();
    if (/^\d{15,17}$/.test(leadIdStr)) {
      userData.lead_id = parseInt(leadIdStr, 10);
    }
  }

  const eventData = {
    action_source: 'website',
    event_name: eventName,
    event_time: eventTime,
    custom_data: {
      event_source: 'crm',
      lead_event_source: CRM_SOURCE_NAME,
    },
    user_data: userData,
  };

  // Event source URL (page where the conversion happened)
  if (eventSourceUrl && typeof eventSourceUrl === 'string' && eventSourceUrl.trim()) {
    eventData.event_source_url = eventSourceUrl.trim();
  }

  const eventPayload = {
    data: [eventData],
  };

  // Inject test_event_code when running in test mode
  const testCode = TEST_EVENT_CODE();
  if (isTest && testCode) {
    eventPayload.test_event_code = testCode;
  }

  return eventPayload;
}

// ─── API Dispatch ──────────────────────────────────────────────────────────────

/**
 * Posts a CAPI event to Meta's Graph API.
 *
 * @param {object} payload - Built with buildCapiPayload()
 * @returns {Promise<{success: boolean, status?: number, body?: object, error?: string}>}
 */
async function postToMeta(payload) {
  const token = ACCESS_TOKEN();
  if (!token) {
    console.warn('[CAPI] META_ACCESS_TOKEN is not set — skipping event dispatch. Set it in server/.env to activate.');
    return { success: false, error: 'META_ACCESS_TOKEN not configured' };
  }

  const url = `https://graph.facebook.com/${META_API_VERSION}/${DATASET_ID}/events?access_token=${token}`;

  const fetchFn = globalThis.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetchFn) {
    console.error('[CAPI] Native fetch API not available in Node environment.');
    return { success: false, error: 'fetch not available' };
  }

  const response = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let body = {};
  try {
    body = await response.json();
  } catch {
    // Non-JSON response — still log status
  }

  if (response.ok) {
    console.log(`[CAPI] Event dispatched successfully. Event: ${payload?.data?.[0]?.event_name} | Status: ${response.status} | Events received: ${body?.events_received ?? 'unknown'}`);
    return { success: true, status: response.status, body };
  } else {
    console.error(`[CAPI] Event dispatch failed. Status: ${response.status} | Error:`, JSON.stringify(body));
    return { success: false, status: response.status, body, error: body?.error?.message || 'Unknown error' };
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Sends a CAPI event for a CRM stage change.
 * This is the primary function called from index.js.
 *
 * All errors are caught internally — this function NEVER throws.
 *
 * @param {object} opts
 * @param {string}  opts.status     - Inquiry status (NEW, CONTACTED, ENROLLED, ARCHIVED)
 * @param {string}  [opts.email]    - Lead's email address (raw, hashed internally)
 * @param {string}  [opts.phone]    - Lead's phone number (raw, hashed internally)
 * @param {string}  [opts.fbclid]   - Facebook click ID from attribution data
 * @param {string}  [opts.metaLeadId] - Meta Lead Ad ID if available
 * @param {string}  [opts.clientIpAddress] - Client IP (from request headers)
 * @param {string}  [opts.clientUserAgent] - Client user-agent string
 * @param {string}  [opts.fbp]      - Meta _fbp cookie value
 * @param {string}  [opts.fbc]      - Meta _fbc cookie value
 * @param {string}  [opts.eventSourceUrl] - Page URL where event occurred
 */
export async function sendCapiEventForStatus(opts) {
  try {
    const { status } = opts;
    const eventName = CAPI_EVENT_MAP[status];

    if (!eventName) {
      // Status mapped to null (e.g. ARCHIVED) — intentionally no event
      console.log(`[CAPI] Status '${status}' is not mapped to a CAPI event — skipping.`);
      return;
    }

    const payload = buildCapiPayload({
      eventName,
      email: opts.email,
      phone: opts.phone,
      fbclid: opts.fbclid,
      metaLeadId: opts.metaLeadId,
      clientIpAddress: opts.clientIpAddress,
      clientUserAgent: opts.clientUserAgent,
      fbp: opts.fbp,
      fbc: opts.fbc,
      eventSourceUrl: opts.eventSourceUrl,
    });

    await postToMeta(payload);
  } catch (err) {
    // Non-critical — log and swallow. Never propagate.
    console.error('[CAPI] Non-critical error in sendCapiEventForStatus:', err?.message || err);
  }
}

/**
 * Sends a test CAPI event to Meta's Test Events tab in Events Manager.
 * Requires META_TEST_EVENT_CODE to be set in server/.env.
 *
 * @returns {Promise<{success: boolean, error?: string, body?: object}>}
 */
export async function sendTestCapiEvent() {
  try {
    const testCode = TEST_EVENT_CODE();
    if (!testCode) {
      return {
        success: false,
        error: 'META_TEST_EVENT_CODE is not set in server/.env. Add it from Meta Events Manager → Test Events.',
      };
    }

    const payload = buildCapiPayload({
      eventName: 'Lead',
      email: 'test@soundabode.com',
      phone: '9999999999',
      isTest: true,
    });

    const result = await postToMeta(payload);
    return result;
  } catch (err) {
    console.error('[CAPI] Test event error:', err?.message || err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}
