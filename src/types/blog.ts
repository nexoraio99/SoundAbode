export interface BlogAuthor {
  name: string;
  role: string;
  avatarUrl?: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: 'PRODUCTION' | 'DJING' | 'GENERAL' | 'ACADEMY NEWS' | 'GEAR & TECH';
  coverImage: string;
  publishedAt: string; // ISO date or formatted timestamp string
  readTimeMinutes: number;
  author: BlogAuthor;
  isFeatured?: boolean;
  tags?: string[];
  // ── SEO & Meta Fields ──────────────────────────────────────────
  metaTitle?: string;           // Custom <title> tag (falls back to title)
  metaDescription?: string;     // <meta name="description"> — 150–160 chars
  focusKeyword?: string;        // Primary target keyword
  canonicalUrl?: string;        // Canonical URL override
  ogTitle?: string;             // Open Graph / Twitter card title
  ogDescription?: string;       // Open Graph description
  ogImage?: string;             // OG image URL (1200×630 recommended)
  twitterCard?: 'summary' | 'summary_large_image'; // Twitter card type
  noIndex?: boolean;            // Set true to add <meta name="robots" content="noindex">
  schemaType?: 'Article' | 'BlogPosting' | 'NewsArticle'; // JSON-LD schema type
}
