/**
 * Security and Sanitization Utilities
 * Prevents DOM-based Cross-Site Scripting (XSS) and unsafe URL/HTML injections using browser-native APIs.
 */

/**
 * Escapes special HTML characters in plain text before embedding into HTML strings.
 */
export const escapeHtml = (str?: string | number | null): string => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Sanitizes and validates image URLs to prevent script injection (e.g., javascript: or arbitrary data: URLs).
 */
export const safeImageUrl = (url?: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Reject dangerous pseudo-protocols
  if (/^(javascript|vbscript|data:(?!image\/(png|jpeg|jpg|webp|gif|avif))):/i.test(trimmed)) {
    return '';
  }

  // Allow safe image base64 data URLs
  if (/^data:image\/(png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }

  // Allow relative URLs starting with a single '/'
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return encodeURI(trimmed);
  }

  // Validate absolute URLs against http: / https:
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://soundabode.com';
    const parsed = new URL(trimmed, base);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    return '';
  }

  return '';
};

/**
 * Sanitizes an HTML string using DOMParser to strip script tags, dangerous elements,
 * inline event handlers (on*), and unsafe link/image sources.
 */
export const sanitizeHtml = (html?: string): string => {
  if (!html) return '';

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return escapeHtml(html);
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove executable / structural injection tags
    const dangerousTags = [
      'script', 'iframe', 'object', 'embed', 'link', 'meta', 'style',
      'form', 'input', 'button', 'select', 'textarea', 'base', 'applet', 'template'
    ];

    dangerousTags.forEach((tag) => {
      const elements = doc.querySelectorAll(tag);
      elements.forEach((el) => el.remove());
    });

    // Remove inline event attributes (e.g. onerror, onload, onclick) and sanitize href/src
    const allElements = doc.querySelectorAll('*');
    allElements.forEach((el) => {
      const attributeNames = Array.from(el.attributes).map((attr) => attr.name);
      attributeNames.forEach((attrName) => {
        const lowerAttrName = attrName.toLowerCase();

        // Strip inline event handler attributes
        if (lowerAttrName.startsWith('on')) {
          el.removeAttribute(attrName);
          return;
        }

        // Validate src and href
        if (lowerAttrName === 'src') {
          const val = el.getAttribute(attrName) || '';
          const cleaned = safeImageUrl(val);
          if (cleaned) {
            el.setAttribute(attrName, cleaned);
          } else {
            el.removeAttribute(attrName);
          }
        } else if (lowerAttrName === 'href') {
          const val = (el.getAttribute(attrName) || '').trim();
          if (/^(javascript|vbscript|data:)/i.test(val)) {
            el.removeAttribute(attrName);
          }
        }
      });
    });

    return doc.body.innerHTML;
  } catch {
    return escapeHtml(html);
  }
};

/**
 * Sanitizes an HTML string specifically for document.write() print templates.
 */
export const sanitizePrintHtml = (html?: string): string => {
  if (!html) return '';

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove inline event attributes
    const allElements = doc.querySelectorAll('*');
    allElements.forEach((el) => {
      const attributeNames = Array.from(el.attributes).map((attr) => attr.name);
      attributeNames.forEach((attrName) => {
        if (attrName.toLowerCase().startsWith('on')) {
          el.removeAttribute(attrName);
        }
      });
    });

    return doc.documentElement.outerHTML;
  } catch {
    return html;
  }
};

/**
 * Sanitizes and generates a safe WhatsApp URL string.
 */
export const safeWhatsAppUrl = (phone?: string, text?: string): string => {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const encodedText = encodeURIComponent(text || '');
  const urlString = `https://wa.me/91${cleanPhone}?text=${encodedText}`;

  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://soundabode.com';
    const parsed = new URL(urlString, base);
    if (parsed.protocol === 'https:' && parsed.hostname === 'wa.me') {
      return parsed.href;
    }
  } catch {
    // fallback
  }
  return '#';
};
