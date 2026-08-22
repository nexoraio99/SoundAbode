export interface RawAttributionData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  referrer?: string;
  landing_page?: string;
}

export interface LeadAttribution extends RawAttributionData {
  source: string;
}

export const ATTRIBUTION_STORAGE_KEY = 'lead_attribution';

/**
 * Resolves raw attribution parameters into a standardized lead source label.
 * Priority:
 * 1. fbclid present OR utm_source is "facebook"/"instagram"/"meta" -> "Meta Ads"
 * 2. gclid present OR (utm_source is "google" AND utm_medium is "cpc"/"ppc"/"paid") -> "Google Ads"
 * 3. utm_source present (anything else) -> "Campaign: {utm_source}"
 * 4. referrer exists and is NOT our own domain -> "Organic/Referral"
 * 5. no referrer, no utm, no click id -> "Direct"
 */
export function resolveLeadSource(attribution?: Partial<RawAttributionData> | null): string {
  if (!attribution || typeof attribution !== 'object') {
    return 'Direct';
  }

  const fbclid = (attribution.fbclid || '').trim();
  const gclid = (attribution.gclid || '').trim();
  const utm_source = (attribution.utm_source || '').trim();
  const utm_medium = (attribution.utm_medium || '').trim();
  const referrer = (attribution.referrer || '').trim();

  const utmSourceLower = utm_source.toLowerCase();
  const utmMediumLower = utm_medium.toLowerCase();

  // 1. Meta Ads (fbclid or social source)
  if (fbclid || utmSourceLower === 'facebook' || utmSourceLower === 'instagram' || utmSourceLower === 'meta') {
    return 'Meta Ads';
  }

  // 2. Google Ads (gclid or google cpc)
  if (
    gclid ||
    (utmSourceLower === 'google' &&
      (utmMediumLower === 'cpc' || utmMediumLower === 'ppc' || utmMediumLower === 'adwords' || utmMediumLower === 'paid'))
  ) {
    return 'Google Ads';
  }

  // 3. Other Campaign UTM source
  if (utm_source) {
    return `Campaign: ${utm_source}`;
  }

  // 4. External Referrer -> Organic / Referral
  if (referrer) {
    try {
      const refUrl = new URL(referrer.startsWith('http') ? referrer : `https://${referrer}`);
      const currentHost = typeof window !== 'undefined' && window.location ? window.location.hostname : 'soundabode.com';
      const isOwnDomain =
        refUrl.hostname === currentHost ||
        refUrl.hostname.endsWith('soundabode.com') ||
        refUrl.hostname === 'soundabode.com' ||
        refUrl.hostname === 'localhost' ||
        refUrl.hostname === '127.0.0.1';

      if (!isOwnDomain) {
        return 'Organic/Referral';
      }
    } catch {
      if (!referrer.includes('soundabode.com') && !referrer.startsWith('/')) {
        return 'Organic/Referral';
      }
    }
  }

  // 5. Fallback -> Direct
  return 'Direct';
}

function extractQueryParam(name: string): string | undefined {
  if (typeof window === 'undefined') return undefined;

  // 1. Check standard window.location.search
  const searchParams = new URLSearchParams(window.location.search);
  const val = searchParams.get(name);
  if (val) return val;

  // 2. Check hash query if URL is formatted like /#contact?utm_source=...
  if (window.location.hash && window.location.hash.includes('?')) {
    const hashQuery = window.location.hash.split('?')[1];
    const hashParams = new URLSearchParams(hashQuery);
    const hashVal = hashParams.get(name);
    if (hashVal) return hashVal;
  }

  // 3. Check full href fallback
  try {
    const url = new URL(window.location.href);
    const hrefVal = url.searchParams.get(name);
    if (hrefVal) return hrefVal;
  } catch {
    // Fallback
  }

  return undefined;
}

/**
 * Checks if an attribution object contains explicit paid/campaign tracking signals
 */
export function hasCampaignSignals(data?: Partial<RawAttributionData> | null): boolean {
  if (!data) return false;
  return Boolean(
    data.utm_source ||
      data.utm_medium ||
      data.utm_campaign ||
      data.gclid ||
      data.fbclid ||
      data.utm_content ||
      data.utm_term
  );
}

/**
 * Captures first-touch attribution parameters and saves them in sessionStorage.
 * Preserves the FIRST touch by refusing to overwrite an existing session record with campaign signals.
 */
export function captureFirstTouchAttribution(): LeadAttribution | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const utm_source = extractQueryParam('utm_source');
  const utm_medium = extractQueryParam('utm_medium');
  const utm_campaign = extractQueryParam('utm_campaign');
  const utm_content = extractQueryParam('utm_content');
  const utm_term = extractQueryParam('utm_term');
  const gclid = extractQueryParam('gclid');
  const fbclid = extractQueryParam('fbclid');
  const referrer = document.referrer || undefined;
  const landing_page = window.location.pathname + (window.location.search || '');

  const currentUrlData: RawAttributionData = {
    ...(utm_source ? { utm_source } : {}),
    ...(utm_medium ? { utm_medium } : {}),
    ...(utm_campaign ? { utm_campaign } : {}),
    ...(utm_content ? { utm_content } : {}),
    ...(utm_term ? { utm_term } : {}),
    ...(gclid ? { gclid } : {}),
    ...(fbclid ? { fbclid } : {}),
    ...(referrer ? { referrer } : {}),
    landing_page,
  };

  const currentHasCampaign = hasCampaignSignals(currentUrlData);

  try {
    const existing = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (existing) {
      const parsed = JSON.parse(existing) as LeadAttribution;
      // If existing attribution already has campaign signals or current visit has no campaign signals, preserve it
      if (parsed && parsed.source) {
        if (hasCampaignSignals(parsed) || !currentHasCampaign) {
          return parsed;
        }
      }
    }
  } catch {
    // Ignore JSON parse errors and continue
  }

  try {
    const source = resolveLeadSource(currentUrlData);
    const fullAttribution: LeadAttribution = {
      ...currentUrlData,
      source,
    };

    sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(fullAttribution));
    return fullAttribution;
  } catch (err) {
    console.warn('[Attribution] Failed to capture first touch attribution:', err);
    return {
      source: 'Direct',
      landing_page: typeof window !== 'undefined' ? window.location.pathname : '/',
    };
  }
}

/**
 * Retrieves the stored first-touch attribution from sessionStorage.
 * If not present, attempts to capture and returns a safe fallback.
 */
export function getStoredAttribution(): LeadAttribution {
  if (typeof window === 'undefined') {
    return { source: 'Direct' };
  }

  try {
    const stored = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as LeadAttribution;
      if (parsed && typeof parsed === 'object') {
        if (!parsed.source) {
          parsed.source = resolveLeadSource(parsed);
        }
        return parsed;
      }
    }
  } catch {
    // Fallback
  }

  const captured = captureFirstTouchAttribution();
  return captured || { source: 'Direct', landing_page: window.location.pathname };
}

/**
 * Dispatches official conversion events to Meta Pixel and Google Analytics (GA4)
 */
export function trackLeadConversionEvent(params?: {
  course?: string;
  source?: string;
  value?: number;
  currency?: string;
}) {
  if (typeof window === 'undefined') return;

  // 1. Meta Pixel: Standard 'Lead' event
  try {
    const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq;
    if (typeof fbq === 'function') {
      fbq('track', 'Lead', {
        content_name: params?.course || 'Course Inquiry',
        content_category: 'Prospect Lead',
        currency: params?.currency || 'INR',
        value: params?.value || 1,
      });
    }
  } catch (err) {
    console.warn('[Analytics] Meta Pixel conversion notice:', err);
  }

  // 2. Google Analytics 4: Standard 'generate_lead' event
  try {
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag === 'function') {
      gtag('event', 'generate_lead', {
        event_category: 'Leads',
        event_label: params?.course || 'Course Inquiry',
        course_interest: params?.course || 'Course Inquiry',
        lead_source: params?.source || 'Direct',
        currency: params?.currency || 'INR',
        value: params?.value || 1,
      });
    }
  } catch (err) {
    console.warn('[Analytics] GA4 conversion notice:', err);
  }
}

// Auto-run once on module import if running in browser
if (typeof window !== 'undefined') {
  captureFirstTouchAttribution();
}
