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
  if (/^(javascript|vbscript|data:(?!image\/(png|jpeg|jpg|webp|gif|avif|bmp|svg\+xml))):/i.test(trimmed)) {
    return '';
  }

  // Allow safe image base64 data URLs
  if (/^data:image\/(png|jpeg|jpg|webp|gif|avif|bmp|svg\+xml)(;[a-z0-9-]+=[a-z0-9-]+)*;base64,[\sA-Za-z0-9+/=]+$/i.test(trimmed)) {
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

// ─── Article HTML sanitizer (allowlist) ───────────────────────────────────────
// Only formatting the article editor produces is kept. Everything else is dropped:
//  - DROP_WITH_CONTENT elements are removed with everything inside them (scripts, embeds,
//    forms, and SVG/MathML, whose namespace quirks enable mutation-XSS tricks);
//  - any other unknown element is unwrapped (its text and allowed children stay);
//  - attributes not on the allowlist are removed (on* handlers, xlink:href, formaction, srcdoc…);
//  - href must be http(s), mailto, tel or relative; src goes through safeImageUrl.
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'del', 'ins', 'sub', 'sup', 'small', 'mark', 'blockquote', 'q', 'cite', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'a', 'img', 'figure', 'figcaption', 'pre', 'code', 'span', 'div', 'font',
  'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
]);
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'svg', 'math',
  'template', 'noscript', 'noembed', 'noframes', 'xmp', 'plaintext', 'form', 'input', 'button',
  'select', 'option', 'textarea', 'link', 'meta', 'base', 'title', 'head',
]);
const ALLOWED_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'target', 'rel', 'width', 'height', 'class', 'style',
  'colspan', 'rowspan', 'scope', 'align', 'color', 'face', 'size', 'start', 'reversed', 'type', 'loading',
]);

// Removes whitespace/control characters browsers ignore inside a URL scheme ("java\tscript:")
const compactUrl = (value: string) => value.replace(/[\u0000-\u0020\u007F-\u009F]/g, '');

const isSafeHref = (value: string): boolean => {
  const v = compactUrl(value).toLowerCase();
  if (!v) return false;
  const scheme = v.match(/^([a-z][a-z0-9+.-]*):/);
  return !scheme || ['http', 'https', 'mailto', 'tel'].includes(scheme[1]);
};

// Inline styles can't run script in current browsers; old-IE expression()/behaviors and
// script URLs are rejected anyway
const isSafeStyle = (value: string) => !/expression\s*\(|javascript:|vbscript:|@import|behavior\s*:|-moz-binding/i.test(compactUrl(value));

export const sanitizeHtml = (html?: string): string => {
  if (!html) return '';

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return escapeHtml(html);
  }

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const body = doc.body;

    // Comments are dropped (they are a common carrier for parser-confusion payloads)
    const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
    const comments: Node[] = [];
    while (walker.nextNode()) comments.push(walker.currentNode);
    comments.forEach((c) => c.parentNode?.removeChild(c));

    Array.from(body.querySelectorAll('*')).forEach((el) => {
      if (!el.isConnected) return; // inside an element already removed
      const tag = el.tagName.toLowerCase();

      if (DROP_WITH_CONTENT.has(tag)) {
        el.remove();
        return;
      }
      if (!ALLOWED_TAGS.has(tag)) {
        el.replaceWith(...Array.from(el.childNodes));
        return;
      }

      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (!ALLOWED_ATTRS.has(name)) {
          el.removeAttribute(attr.name);
          return;
        }
        if (name === 'href' && !isSafeHref(attr.value)) {
          el.removeAttribute(attr.name);
        } else if (name === 'src') {
          // safeImageUrl parses the URL (browsers drop tabs/newlines there too) and only keeps http(s), relative or raster data: images
          const cleaned = safeImageUrl(attr.value);
          if (cleaned) el.setAttribute('src', cleaned);
          else el.removeAttribute('src');
        } else if (name === 'style' && !isSafeStyle(attr.value)) {
          el.removeAttribute(attr.name);
        }
      });

      // Links opening a new tab can't reach back into this page
      if (tag === 'a' && el.getAttribute('target') === '_blank') {
        el.setAttribute('rel', 'noopener noreferrer');
      }
    });

    return body.innerHTML;
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
