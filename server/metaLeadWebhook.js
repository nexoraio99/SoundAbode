/**
 * metaLeadWebhook.js — Meta Lead Ads Webhook Handler & Parser
 *
 * Receives incoming webhook events from Facebook / Instagram Lead Ad forms,
 * verifies HMAC SHA-256 signatures, fetches the prospect's lead details
 * (name, email, phone, interested course) via Meta Graph API,
 * stores the lead in MongoDB, forwards to Google Sheets, and broadcasts
 * real-time SSE events to the CMS.
 *
 * Isolation & Resilience:
 *  - Fails gracefully if tokens or secrets are not yet configured.
 *  - Provides test simulation so the CMS pipeline can be tested instantly.
 *  - Responses to Meta webhook events are acknowledged with 200 OK within 3s.
 */

import { createHmac } from 'crypto';

const META_GRAPH_VERSION = 'v19.0';

/**
 * Verify Meta's X-Hub-Signature-256 header against raw request body
 */
export function verifyWebhookSignature(req, appSecret) {
  if (!appSecret) {
    // If app secret is not configured yet in .env, permit in development/sandbox mode
    return true;
  }

  const signatureHeader = req.headers['x-hub-signature-256'];
  if (!signatureHeader) {
    console.warn('[Meta Webhook] Missing X-Hub-Signature-256 header');
    return false;
  }

  try {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const expectedSignature = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
    return signatureHeader === expectedSignature;
  } catch (err) {
    console.error('[Meta Webhook] Signature verification error:', err.message);
    return false;
  }
}

/**
 * Normalizes question strings from Meta Lead Ad forms to detect lead attributes
 */
function normalizeKey(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Parses Meta's `field_data` array into standardized prospect fields
 */
export function parseLeadFieldData(fieldData = []) {
  let name = '';
  let email = '';
  let phone = '';
  let courseInterest = '';
  const additionalFields = [];

  for (const item of fieldData) {
    const fieldName = item.name || '';
    const key = normalizeKey(fieldName);
    const value = Array.isArray(item.values) && item.values.length > 0 ? String(item.values[0]).trim() : '';

    if (!value) continue;

    // Detect Email
    if (!email && (key.includes('email') || value.includes('@'))) {
      email = value;
      continue;
    }

    // Detect Phone
    if (!phone && (key.includes('phone') || key.includes('mobile') || key.includes('contactnumber') || /^\+?[0-9\s\-()]{7,16}$/.test(value))) {
      phone = value;
      continue;
    }

    // Detect Full Name or First/Last
    if (key.includes('fullname') || key === 'name') {
      name = value;
      continue;
    } else if (key.includes('firstname') && !name) {
      name = value;
      continue;
    } else if (key.includes('lastname') && name) {
      name = `${name} ${value}`.trim();
      continue;
    }

    // Detect Course Interest
    if (
      !courseInterest &&
      (key.includes('course') ||
        key.includes('program') ||
        key.includes('interest') ||
        key.includes('production') ||
        key.includes('soundengineering') ||
        key.includes('dj') ||
        key.includes('audio'))
    ) {
      courseInterest = value;
      continue;
    }

    // Fallback: collect other questions as additional metadata
    additionalFields.push(`${fieldName}: ${value}`);
  }

  // Sensible defaults
  if (!name) name = email ? email.split('@')[0] : 'Meta Prospect';
  if (!courseInterest) courseInterest = 'Music Production & Sound Engineering';

  return {
    name,
    email,
    phone,
    courseInterest,
    additionalNotes: additionalFields.join(' | '),
  };
}

/**
 * Fetch lead details from Meta Graph API using leadgen_id and Page Access Token
 */
export async function fetchLeadFromMeta(leadgenId, pageAccessToken) {
  if (!pageAccessToken) {
    throw new Error('META_PAGE_ACCESS_TOKEN is not configured');
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${leadgenId}?fields=created_time,id,ad_id,form_id,field_data&access_token=${encodeURIComponent(pageAccessToken)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Meta Graph API error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  return data;
}

/**
 * Builds or upserts an Inquiry record in MongoDB for a Meta Lead
 */
export async function persistMetaLead({
  leadgenId,
  name,
  email,
  phone,
  courseInterest,
  adId = '',
  formId = '',
  formName = '',
  campaignName = '',
  additionalNotes = '',
  createdTime = null,
  InquiryModel,
  forwardToGoogleSheets,
  broadcastLiveEvent,
  sendCapiEventForStatus,
}) {
  const customId = `meta-${leadgenId}`;
  const submittedAt = createdTime ? new Date(createdTime) : new Date();

  const messageLines = [];
  if (formName || formId) messageLines.push(`Form: ${formName || formId}`);
  if (adId) messageLines.push(`Ad ID: ${adId}`);
  if (campaignName) messageLines.push(`Campaign: ${campaignName}`);
  if (additionalNotes) messageLines.push(`Responses: ${additionalNotes}`);

  const inquiryData = {
    id: customId,
    name: (name || 'Meta Lead').trim(),
    email: (email || '').trim().toLowerCase(),
    phone: (phone || '').trim(),
    courseInterest: (courseInterest || 'Music Production & Sound Engineering').trim(),
    message: messageLines.join('\n') || 'Meta Lead Ad Form Submission',
    source: 'Meta Lead Ad',
    metaLeadId: String(leadgenId),
    attribution: {
      source: 'Meta Ads',
      utm_source: 'facebook',
      utm_medium: 'lead_ad',
      utm_campaign: campaignName || (adId ? `ad_${adId}` : 'meta_lead_gen'),
      utm_content: formName || formId || '',
      utm_term: '',
      fbclid: '',
      gclid: '',
      referrer: 'https://instagram.com',
      landing_page: 'Meta Instant Form',
    },
    submittedAt,
    status: 'NEW',
    notes: 'Generated via Meta Lead Ads',
  };

  let savedRecord = inquiryData;

  // Persist to MongoDB if available
  if (InquiryModel) {
    try {
      const existing = await InquiryModel.findOne({
        $or: [{ metaLeadId: String(leadgenId) }, { id: customId }],
      });

      if (existing) {
        // Update existing record
        Object.assign(existing, {
          name: inquiryData.name || existing.name,
          email: inquiryData.email || existing.email,
          phone: inquiryData.phone || existing.phone,
          courseInterest: inquiryData.courseInterest || existing.courseInterest,
        });
        await existing.save();
        savedRecord = existing.toObject ? existing.toObject() : existing;
      } else {
        const newLead = new InquiryModel(inquiryData);
        await newLead.save();
        savedRecord = newLead.toObject ? newLead.toObject() : newLead;
      }
    } catch (dbErr) {
      console.error('[Meta Webhook] Database save notice:', dbErr.message);
    }
  }

  // Forward to Google Sheets server-side
  if (typeof forwardToGoogleSheets === 'function') {
    try {
      forwardToGoogleSheets(inquiryData);
    } catch (gsErr) {
      console.warn('[Meta Webhook] Google Sheets forwarding error:', gsErr.message);
    }
  }

  // Broadcast real-time SSE events to connected CMS admin clients
  if (typeof broadcastLiveEvent === 'function') {
    try {
      broadcastLiveEvent('INQUIRY_SAVED', savedRecord);
      broadcastLiveEvent('META_LEAD_RECEIVED', savedRecord);
    } catch (sseErr) {
      console.warn('[Meta Webhook] SSE broadcast notice:', sseErr.message);
    }
  }

  // Fire CAPI event for initial inbound lead
  if (typeof sendCapiEventForStatus === 'function') {
    Promise.resolve().then(async () => {
      try {
        await sendCapiEventForStatus({
          status: 'NEW',
          email: inquiryData.email,
          phone: inquiryData.phone,
          metaLeadId: String(leadgenId),
        });
      } catch (capiErr) {
        console.warn('[Meta Webhook] CAPI dispatch notice:', capiErr.message);
      }
    });
  }

  return savedRecord;
}

/**
 * Handles GET /api/webhooks/meta-leads (Meta Webhook Verification Handshake)
 */
export function handleWebhookVerification(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = (process.env.META_WEBHOOK_VERIFY_TOKEN || 'soundabode_leads_2024').trim();

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[Meta Webhook] Verification handshake successful.');
    return res.status(200).send(challenge);
  } else {
    console.warn('[Meta Webhook] Verification failed. Token mismatch or invalid mode.', {
      mode,
      receivedToken: token,
      expectedTokenSet: !!expectedToken,
    });
    return res.status(403).send('Forbidden: Verification token mismatch');
  }
}

/**
 * Handles POST /api/webhooks/meta-leads (Incoming Meta Lead Notification)
 */
export async function handleWebhookEvent(
  req,
  res,
  { InquiryModel, forwardToGoogleSheets, broadcastLiveEvent, sendCapiEventForStatus }
) {
  const appSecret = (process.env.META_APP_SECRET || '').trim();
  const pageAccessToken = (process.env.META_PAGE_ACCESS_TOKEN || '').trim();

  // 1. Signature Verification (if app secret is present)
  if (appSecret && !verifyWebhookSignature(req, appSecret)) {
    console.warn('[Meta Webhook] Invalid signature rejected');
    return res.status(401).send('Unauthorized: Invalid signature');
  }

  // 2. Immediate 200 OK acknowledgment to Meta (avoids timeout & retries)
  res.status(200).send('EVENT_RECEIVED');

  // 3. Process payload asynchronously
  try {
    const body = req.body || {};
    if (body.object !== 'page' || !Array.isArray(body.entry)) {
      return;
    }

    for (const entry of body.entry) {
      if (!Array.isArray(entry.changes)) continue;

      for (const change of entry.changes) {
        if (change.field === 'leadgen' && change.value) {
          const leadgenId = change.value.leadgen_id;
          const adId = change.value.ad_id || '';
          const formId = change.value.form_id || '';
          const createdTime = change.value.created_time ? change.value.created_time * 1000 : Date.now();

          console.log(`[Meta Webhook] Processing leadgen_id: ${leadgenId}`);

          if (!pageAccessToken) {
            console.warn('[Meta Webhook] META_PAGE_ACCESS_TOKEN not set; saving stub.');
            // Save basic stub so lead is not lost
            await persistMetaLead({
              leadgenId,
              name: `Meta Lead (${leadgenId.slice(-4)})`,
              email: '',
              phone: '',
              courseInterest: 'Music Production & Sound Engineering',
              adId,
              formId,
              createdTime,
              additionalNotes: 'Lead created without page access token. Add META_PAGE_ACCESS_TOKEN to .env to fetch details.',
              InquiryModel,
              forwardToGoogleSheets,
              broadcastLiveEvent,
              sendCapiEventForStatus,
            });
            continue;
          }

          // Fetch full lead data from Meta
          try {
            const rawLead = await fetchLeadFromMeta(leadgenId, pageAccessToken);
            const parsed = parseLeadFieldData(rawLead.field_data || []);

            await persistMetaLead({
              leadgenId,
              name: parsed.name,
              email: parsed.email,
              phone: parsed.phone,
              courseInterest: parsed.courseInterest,
              adId: rawLead.ad_id || adId,
              formId: rawLead.form_id || formId,
              additionalNotes: parsed.additionalNotes,
              createdTime: rawLead.created_time || createdTime,
              InquiryModel,
              forwardToGoogleSheets,
              broadcastLiveEvent,
              sendCapiEventForStatus,
            });
          } catch (fetchErr) {
            console.warn(`[Meta Webhook] Could not fetch lead details for leadgen_id ${leadgenId}:`, fetchErr.message);
            // The Graph API call failed — this could be a real lead whose details
            // couldn't be retrieved (expired token, missing permissions, data >90 days old),
            // or a test/mock payload from the Meta Developer Dashboard.
            // Persist a stub so the lead isn't lost, but do NOT assign fake contact info
            // that would make it look like a real prospect.
            await persistMetaLead({
              leadgenId,
              name: `Meta Lead (${String(leadgenId).slice(-4)})`,
              email: '',
              phone: '',
              courseInterest: 'Music Production & Sound Engineering',
              adId,
              formId,
              additionalNotes: `Lead details could not be fetched from Meta Graph API: ${fetchErr.message}. Use "Sync Now" to retry.`,
              InquiryModel,
              forwardToGoogleSheets,
              broadcastLiveEvent,
              sendCapiEventForStatus,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('[Meta Webhook] Asynchronous processing error:', err.message);
  }
}

/**
 * Programmatically subscribes the Facebook Page to this app's leadgen webhook
 */
export async function subscribePageToLeadWebhook(pageId = '1609738365919238', pageAccessToken) {
  const token = (pageAccessToken || process.env.META_PAGE_ACCESS_TOKEN || '').trim();
  if (!token) {
    throw new Error('META_PAGE_ACCESS_TOKEN is missing');
  }

  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/subscribed_apps?subscribed_fields=leadgen&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url, { method: 'POST' });
  const data = await res.json();
  console.log(`[Meta Webhook] Subscribed page ${pageId} response:`, data);
  return data;
}

/**
 * Pull-based lead retrieval: fetches ALL leads from all leadgen forms on a Facebook Page.
 * This complements the push-based webhook approach and ensures no leads are missed
 * (e.g. when the server was down, the token was expired at webhook time, etc.)
 *
 * Flow:
 *  1. GET /{page-id}/leadgen_forms → list of all lead forms
 *  2. For each form, GET /{form-id}/leads → all lead submissions
 *  3. Parse each lead and return the full set
 *
 * @param {string} pageId - Facebook Page ID
 * @param {string} [pageAccessToken] - Override token (defaults to env var)
 * @returns {Promise<{leads: Array, forms: Array, error?: string}>}
 */
export async function fetchAllLeadsFromPage(pageId = '1609738365919238', pageAccessToken) {
  const token = (pageAccessToken || process.env.META_PAGE_ACCESS_TOKEN || '').trim();
  if (!token) {
    return { leads: [], forms: [], error: 'META_PAGE_ACCESS_TOKEN is not configured' };
  }

  const results = { leads: [], forms: [], errors: [] };

  try {
    // Step 1: Fetch all leadgen forms on this page
    const formsUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/leadgen_forms?fields=id,name,status,leads_count,created_time&limit=50&access_token=${encodeURIComponent(token)}`;
    const formsRes = await fetch(formsUrl, { headers: { Accept: 'application/json' } });
    const formsData = await formsRes.json();

    if (formsData.error) {
      const errMsg = formsData.error.message || JSON.stringify(formsData.error);
      console.error('[Meta Pull Sync] Failed to fetch forms:', errMsg);
      return { leads: [], forms: [], error: errMsg };
    }

    const forms = formsData.data || [];
    results.forms = forms.map(f => ({ id: f.id, name: f.name, status: f.status, leadsCount: f.leads_count }));
    console.log(`[Meta Pull Sync] Found ${forms.length} leadgen forms on page ${pageId}`);

    // Step 2: For each form, fetch all leads
    for (const form of forms) {
      try {
        let leadsUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${form.id}/leads?fields=id,created_time,ad_id,form_id,field_data&limit=50&access_token=${encodeURIComponent(token)}`;

        // Paginate through all leads in this form
        while (leadsUrl) {
          const leadsRes = await fetch(leadsUrl, { headers: { Accept: 'application/json' } });
          const leadsData = await leadsRes.json();

          if (leadsData.error) {
            console.warn(`[Meta Pull Sync] Error fetching leads from form ${form.id}:`, leadsData.error.message);
            results.errors.push({ formId: form.id, formName: form.name, error: leadsData.error.message });
            break;
          }

          const leads = leadsData.data || [];
          for (const rawLead of leads) {
            const parsed = parseLeadFieldData(rawLead.field_data || []);
            results.leads.push({
              leadgenId: rawLead.id,
              name: parsed.name,
              email: parsed.email,
              phone: parsed.phone,
              courseInterest: parsed.courseInterest,
              adId: rawLead.ad_id || '',
              formId: rawLead.form_id || form.id,
              formName: form.name || '',
              additionalNotes: parsed.additionalNotes,
              createdTime: rawLead.created_time,
            });
          }

          // Follow pagination cursor
          leadsUrl = leadsData.paging?.next || null;
        }
      } catch (formErr) {
        console.warn(`[Meta Pull Sync] Exception on form ${form.id}:`, formErr.message);
        results.errors.push({ formId: form.id, error: formErr.message });
      }
    }

    console.log(`[Meta Pull Sync] Total leads fetched from all forms: ${results.leads.length}`);
  } catch (err) {
    console.error('[Meta Pull Sync] Top-level error:', err.message);
    return { leads: [], forms: [], error: err.message };
  }

  return results;
}
