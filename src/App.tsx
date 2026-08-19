import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import Preloader from './components/common/Preloader';
import Footer from './components/common/Footer';
import CookieConsentBanner from './components/common/CookieConsentBanner';
import TwoPanelHero from './components/sections/TwoPanelHero';
import ProduceCreateReleaseSection from './components/sections/ProduceCreateReleaseSection';
import ArtistCarouselSection from './components/sections/ArtistCarouselSection';
import TestimonialSection from './components/sections/TestimonialSection';
import StudioSetupSection from './components/sections/StudioSetupSection';
import WhyChooseSoundabodeSection from './components/sections/WhyChooseSoundabodeSection';
import FaqSection from './components/sections/FaqSection';
import SEO from './components/common/SEO';
import { PolicyType } from './pages/PolicyPages/PolicyPage';

const ContactPage = lazy(() => import('./pages/ContactPage/ContactPage').then((m) => ({ default: m.ContactPage })));
const BlogPage = lazy(() => import('./pages/BlogPage/BlogPage').then((m) => ({ default: m.BlogPage })));
const CoursesPage = lazy(() => import('./pages/CoursesPage/CoursesPage').then((m) => ({ default: m.CoursesPage })));
const CourseDetailPage = lazy(() => import('./pages/CoursesPage/CourseDetailPage').then((m) => ({ default: m.CourseDetailPage })));
const AboutPage = lazy(() => import('./pages/AboutPage/AboutPage').then((m) => ({ default: m.AboutPage })));
const CmsAdminPage = lazy(() => import('./pages/CmsAdminPage/CmsAdminPage'));
const PolicyPage = lazy(() => import('./pages/PolicyPages/PolicyPage').then((m) => ({ default: m.PolicyPage })));
const AdmissionPage = lazy(() => import('./pages/AdmissionPage/AdmissionPage').then((m) => ({ default: m.AdmissionPage })));
const TryNowPage = lazy(() => import('./pages/TryNowPage/TryNowPage').then((m) => ({ default: m.TryNowPage })));

type RoutePage =
  | 'home'
  | 'contact'
  | 'blog'
  | 'blog-article'
  | 'courses'
  | 'course-detail'
  | 'about'
  | 'cms-admin'
  | 'terms'
  | 'privacy'
  | 'refund-policy'
  | 'shipping-policy'
  | 'admission-dj'
  | 'admission-emp'
  | 'try-now';

const getRouteFromLocation = (): { page: RoutePage; slug?: string } => {
  const path = window.location.pathname.toLowerCase().replace(/\/$/, '');
  const hash = window.location.hash.toLowerCase();

  if (path === '/try-now' || path === '/rekordbox' || path === '/rekordbox-trial' || path === '/dj-console' || hash === '#try-now' || hash === '#rekordbox') return { page: 'try-now' };
  if (path === '/cms-admin' || hash === '#cms-admin') return { page: 'cms-admin' };
  if (path === '/admission-dj' || path === '/admission/dj' || path === '/dj-admission') return { page: 'admission-dj' };
  if (path === '/admission-emp' || path === '/admission/emp' || path === '/emp-admission') return { page: 'admission-emp' };
  if (path === '/about' || hash === '#about') return { page: 'about' };
  if (path === '/contact' || hash === '#contact') return { page: 'contact' };
  if (path.startsWith('/blog/')) return { page: 'blog-article', slug: path.split('/').pop() || '' };
  if (path === '/blog' || hash === '#blog') return { page: 'blog' };
  if (path === '/terms' || path === '/terms-and-conditions' || hash === '#terms') return { page: 'terms' };
  if (path === '/privacy' || path === '/privacy-policy' || hash === '#privacy') return { page: 'privacy' };
  if (path === '/refund-policy' || path === '/refund-and-cancellation-policy') return { page: 'refund-policy' };
  if (path === '/shipping-policy' || path === '/shipping-and-delivery-policy') return { page: 'shipping-policy' };
  if (path.startsWith('/courses/')) {
    const slug = path.split('/').pop() || 'beginner-course';
    return { page: 'course-detail', slug };
  }
  if (path === '/courses' || hash === '#courses') return { page: 'courses' };
  return { page: 'home' };
};

export const App: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState(getRouteFromLocation);
  const hasTrackedInitialPageView = useRef(false);

  // The base Pixel snippet in index.html tracks the first load. Because this is
  // a single-page app, track each subsequent client-side navigation as well.
  useEffect(() => {
    if (!hasTrackedInitialPageView.current) {
      hasTrackedInitialPageView.current = true;
      return;
    }
    const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq;
    fbq?.('track', 'PageView');
  }, [currentRoute.page, currentRoute.slug]);

  useEffect(() => {
    const syncRoute = () => {
      const route = getRouteFromLocation();
      setCurrentRoute(route);

      // Auto upgrade legacy hashes to clean path URLs
      if (window.location.hash === '#contact') {
        window.history.replaceState({}, '', '/contact');
      } else if (window.location.hash === '#blog') {
        window.history.replaceState({}, '', '/blog');
      } else if (window.location.hash === '#courses') {
        window.history.replaceState({}, '', '/courses');
      } else if (window.location.hash === '#cms-admin') {
        window.history.replaceState({}, '', '/CMS-Admin');
      } else if (window.location.hash === '#terms') {
        window.history.replaceState({}, '', '/terms');
      } else if (window.location.hash === '#privacy') {
        window.history.replaceState({}, '', '/privacy');
      }
    };

    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);

    // Global click listener for internal navigation links
    const handleGlobalClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      if (target) {
        const href = target.getAttribute('href');
        if (!href) return;

        const lowerHref = href.toLowerCase();

        if (lowerHref === '/try-now' || lowerHref === '/rekordbox' || lowerHref === '/rekordbox-trial' || lowerHref === '/dj-console') {
          e.preventDefault();
          window.history.pushState({}, '', '/try-now');
          window.dispatchEvent(new Event('popstate'));
          setCurrentRoute({ page: 'try-now' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (lowerHref === '/cms-admin' || lowerHref === '/cms-admin/') {
          e.preventDefault();
          window.history.pushState({}, '', '/CMS-Admin');
          window.dispatchEvent(new Event('popstate'));
          setCurrentRoute({ page: 'cms-admin' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (lowerHref === '/admission-dj' || lowerHref === '/admission/dj' || lowerHref === '/dj-admission') {
          e.preventDefault();
          window.history.pushState({}, '', '/admission-dj');
          window.dispatchEvent(new Event('popstate'));
          setCurrentRoute({ page: 'admission-dj' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (lowerHref === '/admission-emp' || lowerHref === '/admission/emp' || lowerHref === '/emp-admission') {
          e.preventDefault();
          window.history.pushState({}, '', '/admission-emp');
          window.dispatchEvent(new Event('popstate'));
          setCurrentRoute({ page: 'admission-emp' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (href === '/contact' || href === '#contact') {
          e.preventDefault();
          window.history.pushState({}, '', '/contact');
          window.dispatchEvent(new Event('popstate'));
          setCurrentRoute({ page: 'contact' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (lowerHref.startsWith('/blog/')) {
          e.preventDefault();
          const slug = href.split('/').pop() || '';
          window.history.pushState({}, '', href);
          window.dispatchEvent(new Event('popstate'));
          setCurrentRoute({ page: 'blog-article', slug });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (href === '/blog' || href === '#blog') {
          e.preventDefault();
          window.history.pushState({}, '', '/blog');
          window.dispatchEvent(new Event('popstate'));
          setCurrentRoute({ page: 'blog' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (href === '/terms' || href === '/terms-and-conditions' || href === '#terms') {
          e.preventDefault();
          window.history.pushState({}, '', '/terms');
          window.dispatchEvent(new Event('popstate'));
          setCurrentRoute({ page: 'terms' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (href === '/privacy' || href === '/privacy-policy' || href === '#privacy') {
          e.preventDefault();
          window.history.pushState({}, '', '/privacy');
          window.dispatchEvent(new Event('popstate'));
          setCurrentRoute({ page: 'privacy' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (href === '/refund-policy' || href === '/refund-and-cancellation-policy') {
          e.preventDefault();
          window.history.pushState({}, '', '/refund-policy');
          window.dispatchEvent(new Event('popstate'));
          setCurrentRoute({ page: 'refund-policy' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (href === '/shipping-policy' || href === '/shipping-and-delivery-policy') {
          e.preventDefault();
          window.history.pushState({}, '', '/shipping-policy');
          window.dispatchEvent(new Event('popstate'));
          setCurrentRoute({ page: 'shipping-policy' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (lowerHref.startsWith('/courses') && !lowerHref.startsWith('/courses/')) {
          e.preventDefault();
          window.history.pushState({}, '', href);
          window.dispatchEvent(new Event('popstate'));
          setCurrentRoute({ page: 'courses' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (href.startsWith('/courses/')) {
          e.preventDefault();
          const slug = href.split('/').pop() || 'beginner-course';
          window.history.pushState({}, '', href);
          window.dispatchEvent(new Event('popstate'));
          setCurrentRoute({ page: 'course-detail', slug });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (href === '/about' || href === '#about') {
          e.preventDefault();
          window.history.pushState({}, '', '/about');
          window.dispatchEvent(new Event('popstate'));
          setCurrentRoute({ page: 'about' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (href === '/') {
          if (currentRoute.page !== 'home') {
            e.preventDefault();
            window.history.pushState({}, '', '/');
            window.dispatchEvent(new Event('popstate'));
            setCurrentRoute({ page: 'home' });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      }
    };

    document.addEventListener('click', handleGlobalClick);

    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [currentRoute]);

  const navigateTo = (page: RoutePage) => {
    const path = page === 'home' ? '/' : page === 'cms-admin' ? '/CMS-Admin' : `/${page}`;
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('popstate'));
    setCurrentRoute({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main style={{ backgroundColor: '#06070a', minHeight: '100vh', margin: 0, padding: 0 }}>
      <Preloader />

      <Suspense fallback={null}>
        {currentRoute.page === 'cms-admin' ? (
          <CmsAdminPage onNavigate={(p) => navigateTo(p as RoutePage)} />
        ) : currentRoute.page === 'admission-dj' ? (
          <AdmissionPage formType="DJ" onNavigateHome={() => navigateTo('home')} />
        ) : currentRoute.page === 'admission-emp' ? (
          <AdmissionPage formType="EMP" onNavigateHome={() => navigateTo('home')} />
        ) : currentRoute.page === 'about' ? (
          <AboutPage onNavigateHome={() => navigateTo('home')} />
        ) : currentRoute.page === 'contact' ? (
          <ContactPage onNavigateHome={() => navigateTo('home')} />
        ) : currentRoute.page === 'blog' || currentRoute.page === 'blog-article' ? (
          <BlogPage onNavigateHome={() => navigateTo('home')} articleSlug={currentRoute.page === 'blog-article' ? currentRoute.slug : undefined} />
        ) : currentRoute.page === 'terms' ||
          currentRoute.page === 'privacy' ||
          currentRoute.page === 'refund-policy' ||
          currentRoute.page === 'shipping-policy' ? (
          <PolicyPage
            initialPolicy={
              currentRoute.page === 'terms'
                ? 'terms'
                : currentRoute.page === 'privacy'
                ? 'privacy'
                : currentRoute.page === 'refund-policy'
                ? 'refund'
                : 'shipping'
            }
            onNavigateHome={() => navigateTo('home')}
            onSelectPolicy={(policy) => {
              const pMap: Record<PolicyType, RoutePage> = {
                terms: 'terms',
                privacy: 'privacy',
                refund: 'refund-policy',
                shipping: 'shipping-policy',
              };
              setCurrentRoute({ page: pMap[policy] });
            }}
          />
        ) : currentRoute.page === 'course-detail' ? (
          <CourseDetailPage
            courseSlug={currentRoute.slug || 'beginner-course'}
            onNavigateHome={() => navigateTo('home')}
            onNavigateCourses={() => navigateTo('courses')}
          />
        ) : currentRoute.page === 'courses' ? (
          <CoursesPage onNavigateHome={() => navigateTo('home')} />
        ) : currentRoute.page === 'try-now' ? (
          <TryNowPage onNavigateHome={() => navigateTo('home')} />
        ) : (
          <>
          <SEO
            title="Best Music Production & DJ School India | Soundabode Pune"
            description="Soundabode is India’s most practical music academy offering certified Ableton Live Music Production, DJ Training, Audio Engineering, Film Scoring and Sound Design programs in Pune."
            keywords="Soundabode, Music Production Academy Pune, DJ School India, Audio Engineering Courses, EDM Production Classes, Film Scoring India, Ableton Live Training"
            canonical="https://soundabode.com/"
            schema={{
              '@context': 'https://schema.org',
              '@type': 'EducationalOrganization',
              name: 'Soundabode',
              url: 'https://soundabode.com/',
              logo: 'https://soundabode.com/Assets/og-soundabode-cover.jpg',
              description: 'Soundabode is India’s most practical academy for Music Production, DJing & Audio Engineering with industry-grade studios and real-world training.',
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'Shop No. 218, 2nd Floor, Vision 9 Mall, Kunal Icon Road, Pimple Saudagar',
                addressLocality: 'Pune',
                addressRegion: 'Maharashtra',
                postalCode: '411017',
                addressCountry: 'IN',
              },
              sameAs: [
                'https://www.instagram.com/soundabode',
                'https://www.facebook.com/soundabode',
                'https://www.youtube.com/@soundabode',
              ],
            }}
          />
          <TwoPanelHero />
          <div className="deferRender">
            <ProduceCreateReleaseSection />
            <ArtistCarouselSection />
            <TestimonialSection />
            <StudioSetupSection />
            <WhyChooseSoundabodeSection />
            <FaqSection />
          </div>
          <Footer />
        </>
      )}
      </Suspense>

      <CookieConsentBanner />
    </main>
  );
};

export default App;
