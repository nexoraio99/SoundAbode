import React, { useEffect } from 'react';

export interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  noindex?: boolean;
  schema?: Record<string, unknown> | Record<string, unknown>[];
}

export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords,
  canonical,
  ogImage,
  ogType,
  noindex = false,
  schema,
}) => {
  useEffect(() => {
    // 1. Title
    document.title = title;

    // Helper: Meta Tag
    const setMetaTag = (selector: string, attrName: string, attrValue: string, content: string) => {
      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attrName, attrValue);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Helper: Link Tag
    const setLinkTag = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`);
      if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        document.head.appendChild(element);
      }
      element.setAttribute('href', href);
    };

    // Description & Keywords
    setMetaTag('meta[name="description"]', 'name', 'description', description);
    if (keywords) {
      setMetaTag('meta[name="keywords"]', 'name', 'keywords', keywords);
    }

    // Robots
    const robotsContent = noindex
      ? 'noindex, nofollow'
      : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
    setMetaTag('meta[name="robots"]', 'name', 'robots', robotsContent);

    // Open Graph
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', title);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
    setMetaTag('meta[property="og:type"]', 'property', 'og:type', ogType || 'website');
    setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', 'Soundabode Academy');
    setMetaTag('meta[property="og:locale"]', 'property', 'og:locale', 'en_IN');

    const defaultOgImage = 'https://soundabode.com/Assets/og-soundabode-cover.jpg';
    setMetaTag('meta[property="og:image"]', 'property', 'og:image', ogImage || defaultOgImage);

    if (canonical) {
      setMetaTag('meta[property="og:url"]', 'property', 'og:url', canonical);
      setLinkTag('canonical', canonical);
    }

    // Twitter Cards
    setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', ogImage || defaultOgImage);

    // JSON-LD Structured Data Schema
    let scriptElement = document.getElementById('json-ld-schema') as HTMLScriptElement | null;
    if (schema) {
      if (!scriptElement) {
        scriptElement = document.createElement('script');
        scriptElement.id = 'json-ld-schema';
        scriptElement.type = 'application/ld+json';
        document.head.appendChild(scriptElement);
      }
      scriptElement.textContent = JSON.stringify(schema, null, 2);
    } else if (scriptElement) {
      scriptElement.remove();
    }
  }, [title, description, keywords, canonical, ogImage, ogType, noindex, schema]);

  return null;
};

export default SEO;
