import React, { useState, useEffect, useRef } from 'react';
import styles from './Navbar.module.css';
import { useResponsive } from '../../hooks/useResponsive';
import { QuickEnquiryModal } from './QuickEnquiryModal';

export interface NavbarProps {
  activePage?: 'home' | 'about' | 'courses' | 'blog' | 'contact';
  onNavigate?: (page: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activePage: propActivePage = 'home',
  onNavigate,
}) => {
  const [activePage, setActivePage] = useState<string>(propActivePage);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);
  const [hoveredSocialIndex, setHoveredSocialIndex] = useState<number | null>(null);
  const { isMobileOrTablet } = useResponsive();

  // Refs for Navbar Horizontal Dock physics
  const navContainerRef = useRef<HTMLDivElement>(null);
  const navItemRefs = useRef<(HTMLElement | null)[]>([]);
  const navTargetScales = useRef<number[]>([1, 1, 1, 1, 1]);
  const navCurrentScales = useRef<number[]>([1, 1, 1, 1, 1]);
  const navTargetYs = useRef<number[]>([0, 0, 0, 0, 0]);
  const navCurrentYs = useRef<number[]>([0, 0, 0, 0, 0]);

  // Refs for Vertical Social Dock physics
  const socialContainerRef = useRef<HTMLElement>(null);
  const socialItemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const socialTargetScales = useRef<number[]>([1, 1, 1]);
  const socialCurrentScales = useRef<number[]>([1, 1, 1]);
  const socialTargetXs = useRef<number[]>([0, 0, 0]);
  const socialCurrentXs = useRef<number[]>([0, 0, 0]);
  const socialTargetYs = useRef<number[]>([0, 0, 0]);
  const socialCurrentYs = useRef<number[]>([0, 0, 0]);

  useEffect(() => {
    if (!isMobileOrTablet) {
      setIsMobileMenuOpen(false);
    }
  }, [isMobileOrTablet]);

  useEffect(() => {
    setActivePage(propActivePage);
  }, [propActivePage]);

  // Auto-open Quick Enquiry Modal after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      const hasDismissed = sessionStorage.getItem('soundabode_enquiry_dismissed');
      if (!hasDismissed) {
        setIsEnquiryOpen(true);
      }
    }, 8000);

    return () => clearTimeout(timer);
  }, []);

  // Liquid-Smooth 60/120fps Spring Lerp Engine Loop
  useEffect(() => {
    if (isMobileOrTablet) return;
    let animFrameId: number;

    const updatePhysicsLoop = () => {
      // 1. Update Horizontal Navbar Dock Items
      navItemRefs.current.forEach((item, index) => {
        if (!item) return;

        navCurrentScales.current[index] +=
          (navTargetScales.current[index] - navCurrentScales.current[index]) * 0.18;
        navCurrentYs.current[index] +=
          (navTargetYs.current[index] - navCurrentYs.current[index]) * 0.18;

        const scale = navCurrentScales.current[index];
        const y = navCurrentYs.current[index];

        item.style.transform = `translate3d(0, ${y}px, 0) scale(${scale})`;
      });

      // 2. Update Vertical Social Dock Items (Scales, X float & Y vertical separation)
      socialItemRefs.current.forEach((item, index) => {
        if (!item) return;

        socialCurrentScales.current[index] +=
          (socialTargetScales.current[index] - socialCurrentScales.current[index]) * 0.18;
        socialCurrentXs.current[index] +=
          (socialTargetXs.current[index] - socialCurrentXs.current[index]) * 0.18;
        socialCurrentYs.current[index] +=
          (socialTargetYs.current[index] - socialCurrentYs.current[index]) * 0.18;

        const scale = socialCurrentScales.current[index];
        const x = socialCurrentXs.current[index];
        const y = socialCurrentYs.current[index];

        item.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
      });

      animFrameId = requestAnimationFrame(updatePhysicsLoop);
    };

    animFrameId = requestAnimationFrame(updatePhysicsLoop);

    return () => cancelAnimationFrame(animFrameId);
  }, []);

  const handleNavClick = (e: React.MouseEvent, page: string) => {
    e.preventDefault();
    setActivePage(page);
    setIsMobileMenuOpen(false);
    const targetPath = page === 'home' ? '/' : `/${page}`;

    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
      window.dispatchEvent(new Event('popstate'));
    }

    if (page === 'about' || page === 'courses') {
      const element = document.getElementById(page);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (onNavigate) {
      onNavigate(page);
    }
  };

  // Horizontal Navbar Magnetic Dock Physics (Cosine Curve)
  const handleNavMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMobileOrTablet) return;
    const mouseX = e.clientX;
    const maxDistance = 140;

    navItemRefs.current.forEach((item, index) => {
      if (!item) return;
      const rect = item.getBoundingClientRect();
      const itemCenterX = rect.left + rect.width / 2;
      const distance = Math.abs(mouseX - itemCenterX);

      if (distance < maxDistance) {
        const normDist = distance / maxDistance;
        const power = Math.cos(normDist * (Math.PI / 2));
        const targetScale = 1 + Math.pow(power, 2) * 0.32;
        const targetY = -Math.pow(power, 2) * 4;

        navTargetScales.current[index] = targetScale;
        navTargetYs.current[index] = targetY;
      } else {
        navTargetScales.current[index] = 1;
        navTargetYs.current[index] = 0;
      }
    });
  };

  const handleNavMouseLeave = () => {
    navTargetScales.current = [1, 1, 1, 1, 1];
    navTargetYs.current = [0, 0, 0, 0, 0];
  };

  // Vertical Social Media Magnetic Dock Physics (With Dynamic Vertical Separation)
  const handleSocialMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const mouseY = e.clientY;
    const maxDistance = 140;

    let hoverIdx = -1;
    let minCenterDist = Infinity;

    // Find nearest item
    socialItemRefs.current.forEach((item, index) => {
      if (!item) return;
      const rect = item.getBoundingClientRect();
      const itemCenterY = rect.top + rect.height / 2;
      const dist = Math.abs(mouseY - itemCenterY);
      if (dist < minCenterDist) {
        minCenterDist = dist;
        hoverIdx = index;
      }
    });

    socialItemRefs.current.forEach((item, index) => {
      if (!item) return;
      const rect = item.getBoundingClientRect();
      const itemCenterY = rect.top + rect.height / 2;
      const distance = Math.abs(mouseY - itemCenterY);

      if (distance < maxDistance) {
        const normDist = distance / maxDistance;
        const power = Math.cos(normDist * (Math.PI / 2));
        const targetScale = 1 + Math.pow(power, 2) * 0.25; // Balanced scale to fit within dock shell
        const targetX = -Math.pow(power, 2) * 5; // Outward float left

        // Dynamic vertical separation displacement to prevent icon overlap!
        let targetY = 0;
        if (hoverIdx !== -1) {
          if (index < hoverIdx) {
            targetY = -12 * (1 - normDist); // Push item above UP
          } else if (index > hoverIdx) {
            targetY = 12 * (1 - normDist); // Push item below DOWN
          }
        }

        socialTargetScales.current[index] = targetScale;
        socialTargetXs.current[index] = targetX;
        socialTargetYs.current[index] = targetY;
      } else {
        socialTargetScales.current[index] = 1;
        socialTargetXs.current[index] = 0;
        socialTargetYs.current[index] = 0;
      }
    });
  };

  const handleSocialMouseLeave = () => {
    setHoveredSocialIndex(null);
    socialTargetScales.current = [1, 1, 1];
    socialTargetXs.current = [0, 0, 0];
    socialTargetYs.current = [0, 0, 0];
  };

  return (
    <>
      {/* Floating Header Navigation */}
      <header className={styles.navHeaderWrapper}>
        <div
          ref={navContainerRef}
          className={styles.pillNav}
          onMouseMove={handleNavMouseMove}
          onMouseLeave={handleNavMouseLeave}
        >
          <a
            href="/"
            onClick={(e) => handleNavClick(e, 'home')}
            className={styles.brandLogo}
            aria-label="Soundabode Home"
          >
            <img
              src="/favicon-192x192.png"
              alt="Soundabode"
              className={styles.logoImg}
              width="32"
              height="32"
              decoding="async"
            />
          </a>

          {/* Desktop Nav Links */}
          <nav className={styles.navLinks}>
            {[
              { key: 'about', label: 'About', path: '/about' },
              { key: 'courses', label: 'Courses', path: '/courses' },
              { key: 'blog', label: 'Blog', path: '/blog' },
              { key: 'contact', label: 'Contact', path: '/contact' },
            ].map((link, idx) => (
              <a
                key={link.key}
                ref={(el) => {
                  navItemRefs.current[idx] = el;
                }}
                href={link.path}
                onClick={(e) => handleNavClick(e, link.key)}
                className={`${styles.navLink} ${activePage === link.key ? styles.navLinkActive : ''}`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className={styles.navRightActions}>
            <a
              ref={(el) => {
                navItemRefs.current[4] = el;
              }}
              href="tel:+919975016189"
              className={styles.phoneBtn}
              aria-label="Call Soundabode Admissions"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </a>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={styles.mobileMenuToggleBtn}
              aria-label="Toggle Mobile Menu"
            >
              {isMobileMenuOpen ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {isMobileMenuOpen && (
          <div className={styles.mobileMenuOverlay}>
            <nav className={styles.mobileNavLinks}>
              <a
                href="/"
                onClick={(e) => handleNavClick(e, 'home')}
                className={`${styles.mobileNavLink} ${activePage === 'home' ? styles.mobileNavLinkActive : ''}`}
              >
                Home
              </a>
              <a
                href="/about"
                onClick={(e) => handleNavClick(e, 'about')}
                className={`${styles.mobileNavLink} ${activePage === 'about' ? styles.mobileNavLinkActive : ''}`}
              >
                About
              </a>
              <a
                href="/courses"
                onClick={(e) => handleNavClick(e, 'courses')}
                className={`${styles.mobileNavLink} ${activePage === 'courses' ? styles.mobileNavLinkActive : ''}`}
              >
                Courses
              </a>
              <a
                href="/blog"
                onClick={(e) => handleNavClick(e, 'blog')}
                className={`${styles.mobileNavLink} ${activePage === 'blog' ? styles.mobileNavLinkActive : ''}`}
              >
                Blog
              </a>
              <a
                href="/contact"
                onClick={(e) => handleNavClick(e, 'contact')}
                className={`${styles.mobileNavLink} ${activePage === 'contact' ? styles.mobileNavLinkActive : ''}`}
              >
                Contact
              </a>
            </nav>
          </div>
        )}
      </header>

      {/* Floating Vertical Social Media Magnetic Dock (Fixed Right) */}
      <aside
        ref={socialContainerRef}
        className={styles.socialBar}
        aria-label="Social Links"
        onMouseMove={handleSocialMouseMove}
        onMouseLeave={handleSocialMouseLeave}
      >
        {[
          {
            name: 'Instagram',
            url: 'https://instagram.com/soundabode',
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            ),
          },
          {
            name: 'Facebook',
            url: 'https://facebook.com/soundabode',
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            ),
          },
          {
            name: 'WhatsApp',
            url: 'https://wa.me/919975016189',
            icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            ),
          },
        ].map((item, index) => (
          <div key={item.name} className={styles.socialDockItemWrapper}>
            {hoveredSocialIndex === index && (
              <div className={styles.dockTooltip}>{item.name}</div>
            )}
            <a
              ref={(el) => {
                socialItemRefs.current[index] = el;
              }}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialBtn}
              aria-label={item.name}
              onMouseEnter={() => setHoveredSocialIndex(index)}
            >
              {item.icon}
            </a>
          </div>
        ))}
      </aside>

      <QuickEnquiryModal
        isOpen={isEnquiryOpen}
        onClose={() => {
          sessionStorage.setItem('soundabode_enquiry_dismissed', 'true');
          setIsEnquiryOpen(false);
        }}
      />
    </>
  );
};

export default Navbar;
