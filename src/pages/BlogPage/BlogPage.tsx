import React, { useEffect, useState, useMemo } from 'react';
import styles from './BlogPage.module.css';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import SEO from '../../components/common/SEO';
import { BlogService } from '../../services/blogService';
import { BlogPost } from '../../types/blog';
import { safeImageUrl, sanitizeHtml } from '../../utils/security';

interface BlogPageProps {
  onNavigateHome?: () => void;
  articleSlug?: string;
}

export const BlogPage: React.FC<BlogPageProps> = ({ onNavigateHome, articleSlug }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [posts, setPosts] = useState<BlogPost[]>(() => BlogService.getAllPosts());
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);


  useEffect(() => {
    BlogService.fetchRemotePosts()
      .then(setPosts)
      .finally(() => setIsLoadingPosts(false));
  }, []);

  const selectedPost = articleSlug ? posts.find((post) => post.slug === articleSlug) || null : null;

  // Filtered posts based on category and search query
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesCategory = !activeCategory || activeCategory === 'ALL' || post.category === activeCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query || post.title.toLowerCase().includes(query) || post.excerpt.toLowerCase().includes(query) || Boolean(post.tags?.some((tag) => tag.toLowerCase().includes(query)));
      return matchesCategory && matchesSearch;
    });
  }, [posts, searchQuery, activeCategory]);

  const featuredPosts = useMemo(() => {
    return posts.filter((post) => post.isFeatured);
  }, [posts]);

  const heroPost = useMemo(() => {
    return featuredPosts[0] || filteredPosts[0];
  }, [featuredPosts, filteredPosts]);

  const latestSidebarPosts = useMemo(() => {
    return posts.slice(0, 4);
  }, [posts]);

  const categories = ['ALL', 'PRODUCTION', 'DJING', 'GENERAL', 'ACADEMY NEWS', 'GEAR & TECH'];

  const blogFaqs = [
    {
      question: 'What topics does the Soundabode blog cover?',
      answer:
        'Our blog covers a broad spectrum of audio education topics including Ableton Live 12 tutorial guides, professional DJ performance techniques, sound design concepts, mixing and mastering masterclasses, background scoring secrets, game sound design workflows, and insights on how to build a successful career as an independent electronic music artist in India.',
    },
    {
      question: 'How often are new tutorials published?',
      answer:
        'We regularly update our knowledge hub. Our certified mentors and touring DJs compile new tips, industry updates, and gear guides bi-weekly, ensuring students and readers have access to the latest trends in music technology and underground electronic scenes.',
    },
    {
      question: 'Are the tutorials suitable for complete beginners?',
      answer:
        'Yes! Our articles are designed to be accessible to creators at all levels. We write simple step-by-step guides for beginners setting up their first home studio, as well as highly detailed advanced guides on phase alignment, dynamic range optimization, and compression algorithms for experienced audio engineers.',
    },
    {
      question: 'Can I learn music production or DJing online?',
      answer:
        'Absolutely. Soundabode offers both physical studio batches in Pimple Saudagar, Pune, and live interactive online courses across India. Our online programs feature the same certified curriculum and individual mentor feedback as our physical classes.',
    },
  ];

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail) {
      setNewsletterSubmitted(true);
      setTimeout(() => setNewsletterSubmitted(false), 4000);
      setNewsletterEmail('');
    }
  };

  const blogSchema = selectedPost
    ? {
        '@context': 'https://schema.org',
        '@type': selectedPost.schemaType || 'BlogPosting',
        headline: selectedPost.metaTitle || selectedPost.title,
        description: selectedPost.metaDescription || selectedPost.excerpt,
        image: selectedPost.ogImage || selectedPost.coverImage,
        author: {
          '@type': 'Person',
          name: selectedPost.author?.name || 'Soundabode',
        },
        publisher: {
          '@type': 'EducationalOrganization',
          name: 'Soundabode Academy',
          url: 'https://soundabode.com',
        },
        datePublished: selectedPost.publishedAt,
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'Music Production & DJ Blog | Learn Music Production India',
        description:
          "Expert tutorials from our electronic music school India. Learn DJ online and master sound engineering at India's top music production school blog.",
        publisher: {
          '@type': 'EducationalOrganization',
          name: 'Soundabode Academy',
          url: 'https://soundabode.com',
        },
      };

  if (articleSlug) {
    return (
      <div className={styles.pageContainer}>
        <SEO
          title={selectedPost ? `${selectedPost.metaTitle || selectedPost.title} | Soundabode Blog` : 'Article not found | Soundabode Blog'}
          description={selectedPost?.metaDescription || selectedPost?.excerpt || 'The requested Soundabode blog article is unavailable.'}
          keywords={selectedPost?.focusKeyword || 'Soundabode Blog'}
          canonical={selectedPost ? selectedPost.canonicalUrl || `https://soundabode.com/blog/${selectedPost.slug}` : `https://soundabode.com/blog/${articleSlug}`}
          ogImage={selectedPost?.ogImage || selectedPost?.coverImage}
          ogType="article"
          noindex={!selectedPost || selectedPost.noIndex || false}
          schema={blogSchema}
        />
        <Navbar activePage="blog" onNavigate={(page) => { if (page !== 'blog' && onNavigateHome) onNavigateHome(); }} />
        <main className={styles.articlePage}>
          {isLoadingPosts && !selectedPost ? (
            <p className={styles.articleLoading}>Loading article…</p>
          ) : selectedPost ? (
            <article className={styles.articleReader}>
              <a href="/blog" className={styles.backToBlog}>← All articles</a>
              <span className={styles.categoryLabel}>{selectedPost.category}</span>
              <h1 className={styles.articlePageTitle}>{selectedPost.title}</h1>
              <p className={styles.articlePageExcerpt}>{selectedPost.excerpt}</p>
              <div className={styles.modalMetaLine}>
                <span>By {selectedPost.author?.name || 'Soundabode Editorial'}</span>
                <span>•</span>
                <span>{selectedPost.publishedAt}</span>
                <span>•</span>
                <span>{selectedPost.readTimeMinutes} min read</span>
              </div>
              <img className={styles.articleHeroImage} src={safeImageUrl(selectedPost.coverImage)} alt={selectedPost.title} />
              <div className={styles.articleHTML} dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedPost.content || '') }} />
            </article>
          ) : (
            <section className={styles.articleNotFound}>
              <h1>Article not found</h1>
              <p>This article may have been removed or the link is incorrect.</p>
              <a href="/blog" className={styles.readLink}>Browse all articles →</a>
            </section>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <SEO
        title={
          selectedPost
            ? `${selectedPost.metaTitle || selectedPost.title} | Soundabode Blog`
            : 'Learn Music Production & DJ Tips | Soundabode Blog'
        }
        description={
          selectedPost
            ? selectedPost.metaDescription || selectedPost.excerpt
            : 'Expert tips and tutorials on music production, DJ performance, and sound engineering from the mentors at Soundabode Pune.'
        }
        keywords={selectedPost?.focusKeyword || "Music Production Tips, DJ Tutorials, Ableton Live Guide, Audio Engineering Blog, Soundabode Blog"}
        canonical={
          selectedPost
            ? selectedPost.canonicalUrl || `https://soundabode.com/blog/${selectedPost.slug}`
            : 'https://soundabode.com/blog'
        }
        ogImage={selectedPost ? selectedPost.ogImage || selectedPost.coverImage : undefined}
        ogType={selectedPost ? 'article' : 'website'}
        noindex={selectedPost?.noIndex || false}
        schema={blogSchema}
      />
      <Navbar
        activePage="blog"
        onNavigate={(page) => {
          if (page !== 'blog' && onNavigateHome) {
            onNavigateHome();
          }
        }}
      />

      <div className={styles.contentWrapper}>
        {/* Header Title Section */}
        <header className={styles.editorialHeader}>
          <div className={styles.headerTop}>
            <div>
              <h1 className={styles.pageTitle}>Discover Our Latest News</h1>
              <p className={styles.pageSubtitle}>
                Discover the achievements that set us apart. From groundbreaking projects to industry accolades, we take pride in our accomplishments.
              </p>
            </div>

            {/* Clean Integrated Search Bar */}
            <div className={styles.searchBar}>
              <svg
                className={styles.searchIcon}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search articles &amp; topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={styles.clearSearchBtn}
                >
                  &times;
                </button>
              )}
            </div>
          </div>
        </header>

        {/* FEATURED EDITORIAL HERO STORY */}
        {heroPost && !searchQuery && activeCategory === 'ALL' && (
          <section className={styles.featuredSection}>
            <a className={styles.featuredGrid} href={`/blog/${encodeURIComponent(heroPost.slug)}`}>
              <div className={styles.featuredImgCol}>
                <img
                  src={safeImageUrl(heroPost.coverImage)}
                  alt={heroPost.title}
                  className={styles.featuredImage}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
              <div className={styles.featuredContentCol}>
                <span className={styles.categoryLabel}>{heroPost.category}</span>
                <h2 className={styles.featuredTitle}>{heroPost.title}</h2>
                <p className={styles.featuredExcerpt}>{heroPost.excerpt}</p>
                <div className={styles.featuredMetaRow}>
                  <span className={styles.authorName}>
                    By {heroPost.author?.name || 'Soundabode Editorial'}
                  </span>
                  <span className={styles.bulletDot}>&bull;</span>
                  <span>{heroPost.publishedAt}</span>
                  <span className={styles.bulletDot}>&bull;</span>
                  <span>{heroPost.readTimeMinutes} min read</span>
                </div>
                <div className={styles.readLink}>
                  <span>Read Article</span>
                  <span className={styles.arrow}>&rarr;</span>
                </div>
              </div>
            </a>
          </section>
        )}

        {/* Category Navigation Tabs */}
        <nav className={styles.categoryNav} aria-label="Article categories">
          <div className={styles.categoryScroll}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`${styles.categoryTab} ${activeCategory === cat ? styles.categoryTabActive : ''}`}
              >
                {cat === 'ALL' ? 'All Articles' : cat}
              </button>
            ))}
          </div>
        </nav>

        {/* Main Content Layout */}
        <div className={styles.mainGrid}>
          {/* Main Article Feed */}
          <main className={styles.articleFeed}>
            {filteredPosts.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No articles found for "{searchQuery}".</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('ALL');
                  }}
                  className={styles.resetBtn}
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className={styles.feedGrid}>
                {filteredPosts.map((post) => (
                  <a key={post.id} className={styles.card} href={`/blog/${encodeURIComponent(post.slug)}`}>
                    <div className={styles.cardMedia}>
                      <img
                        src={safeImageUrl(post.coverImage)}
                        alt={post.title}
                        className={styles.cardImg}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className={styles.cardTag}>{post.category}</span>
                    </div>
                    <div className={styles.cardBody}>
                      <h3 className={styles.cardTitle}>{post.title}</h3>
                      <p className={styles.cardExcerpt}>{post.excerpt}</p>
                      <div className={styles.cardFooter}>
                        <span>{post.publishedAt}</span>
                        <span>&bull;</span>
                        <span>{post.readTimeMinutes} min read</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </main>

          {/* Right Sidebar */}
          <aside className={styles.sidebar}>
            {/* Trending Articles Block */}
            <div className={styles.sidebarSection}>
              <h4 className={styles.sidebarHeading}>Trending Guides</h4>
              <div className={styles.trendingList}>
                {latestSidebarPosts.map((post, index) => (
                  <a key={post.id} className={styles.trendingItem} href={`/blog/${encodeURIComponent(post.slug)}`}>
                    <span className={styles.trendingNum}>0{index + 1}</span>
                    <div className={styles.trendingInfo}>
                      <span className={styles.trendingDate}>{post.publishedAt}</span>
                      <h5 className={styles.trendingTitle}>{post.title}</h5>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Newsletter Subscription Box */}
            <div className={styles.newsletterBox}>
              <h4 className={styles.newsletterHeading}>Soundabode Newsletter</h4>
              <p className={styles.newsletterText}>
                Get bi-weekly production tips, Ableton presets, and studio workflow guides.
              </p>
              {newsletterSubmitted ? (
                <p className={styles.successMsg}>&check; You're subscribed!</p>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className={styles.newsletterForm}>
                  <input
                    type="email"
                    required
                    placeholder="Your email address"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    className={styles.emailInput}
                  />
                  <button type="submit" className={styles.submitEmailBtn}>
                    Subscribe
                  </button>
                </form>
              )}
            </div>
          </aside>
        </div>

        {/* FREQUENTLY ASKED QUESTIONS */}
        <section className={styles.faqSection}>
          <h2 className={styles.faqSectionTitle}>Frequently Asked Questions</h2>
          <div className={styles.faqList}>
            {blogFaqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className={`${styles.faqRow} ${isOpen ? styles.faqRowOpen : ''}`}
                >
                  <button
                    type="button"
                    className={styles.faqToggleBtn}
                    onClick={() => toggleFaq(index)}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.question}</span>
                    <span className={styles.faqIndicator}>{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && (
                    <div className={styles.faqContent}>
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
};

export default BlogPage;
