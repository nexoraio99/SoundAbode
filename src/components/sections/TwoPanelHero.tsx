import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import styles from './TwoPanelHero.module.css';
import WhySoundabodeSection from './WhySoundabodeSection';
import Navbar from '../common/Navbar';
import { useResponsive } from '../../hooks/useResponsive';

// Register GSAP Plugin
gsap.registerPlugin(ScrollTrigger);

// ============================================================================
// TUNABLE ANIMATION CONSTANTS
// ============================================================================
const LEFT_X_PERCENT = -100;     // Target horizontal translation for left panel (%)
const RIGHT_X_PERCENT = 100;     // Target horizontal translation for right panel (%)
const SCALE_TARGET = 0.95;       // Subtle scale-down factor during panel separation
const SCROLL_DISTANCE = '+=120%'; // Short, compact pin duration for quick & snappy scrolling
const SCRUB_SPEED = 0.15;        // Instant 1:1 responsive scrub speed with zero scroll lag

export interface TwoPanelHeroProps {
  leftPanelVideo?: string;
  rightPanelVideo?: string;
}

export const TwoPanelHero: React.FC<TwoPanelHeroProps> = ({
  leftPanelVideo = '/dj-training.webm',
  rightPanelVideo = '/music-production.webm',
}) => {
  const { isMobileOrTablet } = useResponsive();
  const containerRef = useRef<HTMLDivElement>(null);
  const pinWrapperRef = useRef<HTMLDivElement>(null);
  const panelsContainerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const welcomeTitleRef = useRef<HTMLHeadingElement>(null);
  const welcomeContentRef = useRef<HTMLDivElement>(null);
  const overlaySectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // GSAP Animation Context for safe scoping and auto-cleanup
    const ctx = gsap.context(() => {
      const pinWrapper = pinWrapperRef.current;
      const panelsContainer = panelsContainerRef.current;
      const leftPanel = leftPanelRef.current;
      const rightPanel = rightPanelRef.current;
      const welcomeTitle = welcomeTitleRef.current;
      const welcomeContent = welcomeContentRef.current;
      const overlaySection = overlaySectionRef.current;

      if (!pinWrapper || !leftPanel || !rightPanel) return;

      // Shared ScrollTrigger Timeline for smooth split-screen & overlay reveal
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: pinWrapper,
          start: 'top top',
          end: SCROLL_DISTANCE,
          pin: true,
          scrub: SCRUB_SPEED,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // Initially enable pointer events on top split panels and position overlay section offscreen below
      if (panelsContainer) {
        timeline.set(panelsContainer, { pointerEvents: 'auto' }, 0);
      }
      if (overlaySection) {
        timeline.set(overlaySection, { pointerEvents: 'none', yPercent: 100, force3D: true }, 0);
      }

      // Initially hide welcome section when split panels are overlayed on top
      if (welcomeContent) {
        timeline.set(welcomeContent, { opacity: 0, scale: 0.95, y: 20, force3D: true }, 0);
      }

      // PHASE 1 (0.0 to 0.8): Left & Right Panels split open cleanly
      timeline.to(
        leftPanel,
        {
          xPercent: LEFT_X_PERCENT,
          scale: SCALE_TARGET,
          opacity: 0,
          transformOrigin: 'right center',
          force3D: true,
          ease: 'none',
          duration: 0.8,
        },
        0
      );

      timeline.to(
        rightPanel,
        {
          xPercent: RIGHT_X_PERCENT,
          scale: SCALE_TARGET,
          opacity: 0,
          transformOrigin: 'left center',
          force3D: true,
          ease: 'none',
          duration: 0.8,
        },
        0
      );

      // Reveal Welcome Section as split panels move apart
      if (welcomeContent) {
        timeline.to(
          welcomeContent,
          {
            opacity: 1,
            scale: 1,
            y: 0,
            force3D: true,
            ease: 'none',
            duration: 0.8,
          },
          0
        );
      }

      // Subtle Welcome Title reveal
      if (welcomeTitle) {
        timeline.fromTo(
          welcomeTitle,
          {
            scale: 0.95,
          },
          {
            scale: 1,
            force3D: true,
            ease: 'none',
            duration: 0.8,
          },
          0
        );
      }

      // Disable pointer events on split panels once open so Welcome section elements are interactive
      if (panelsContainer) {
        timeline.set(panelsContainer, { pointerEvents: 'none' }, 0.8);
      }

      // PHASE 2 (0.8 to 1.1): Welcome Section Reading & Action Hold Window

      // PHASE 3 (1.1 to 1.9): Slide "LEARN. MIX. PERFORM." overlay section UP smoothly
      if (overlaySection) {
        timeline.set(overlaySection, { pointerEvents: 'auto' }, 1.1);
        timeline.to(
          overlaySection,
          {
            yPercent: 0,
            force3D: true,
            ease: 'none',
            duration: 0.8,
          },
          1.1
        );
      }

      // Fade out welcome content cleanly as the overlay section slides UP over it
      if (welcomeContent) {
        timeline.to(
          welcomeContent,
          {
            opacity: 0,
            scale: 0.95,
            force3D: true,
            ease: 'none',
            duration: 0.7,
          },
          1.15
        );
      }

      // PHASE 4 (2.0 to 2.2): Brief steady hold on "LEARN. MIX. PERFORM." before unpinning
    }, containerRef);

    // Refresh ScrollTrigger calculations
    ScrollTrigger.refresh();

    return () => {
      ctx.revert();
    };
  }, []);

  // Interactive 3D Parallax Tilt Handler for Welcome Heading
  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (isMobileOrTablet || !welcomeTitleRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    gsap.to(welcomeTitleRef.current, {
      rotateY: x * 8,
      rotateX: -y * 6,
      duration: 0.5,
      ease: 'power2.out',
      transformPerspective: 1000,
      transformOrigin: 'center center',
    });
  };

  const handleMouseLeave = () => {
    if (!welcomeTitleRef.current) return;
    gsap.to(welcomeTitleRef.current, {
      rotateY: 0,
      rotateX: 0,
      duration: 0.6,
      ease: 'power2.out',
    });
  };

  return (
    <div ref={containerRef} className={styles.heroSectionWrapper}>
      <Navbar activePage="home" />

      {/* Pinned Hero Viewport Container */}
      <div ref={pinWrapperRef} className={styles.pinContainer}>
        {/* Layer 0 (Bottom): Revealed Welcome Section */}
        <section
          className={styles.welcomeSection}
          aria-label="Welcome to Soundabode"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div ref={welcomeContentRef} className={styles.welcomeContent}>
            {/* Clean, High-Impact Welcome Title */}
            <h1 ref={welcomeTitleRef} className={styles.welcomeTitle}>
              <span className={styles.taglineRed}>WELCOME TO</span>
              <span className={styles.welcomeMain}>SOUND<span className={styles.accentRed}>ABODE</span></span>
            </h1>

            <div className={styles.welcomeBody}>
              <p>
                At Soundabode, we live and breathe music. Our DJ and Electronic Music Production
                courses are designed for creators who want to move quickly from that first spark of
                inspiration to releasing their own tracks or rocking their first performance.
              </p>
              <p>
                We&apos;re not just teachers we&apos;re producers, DJs, and music lovers who&apos;ve been exactly where
                you are. If you&apos;re ready to create, perform, and make your sound heard, this is where it
                begins.
              </p>
            </div>

            <a
              href="/courses"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/courses');
                window.dispatchEvent(new Event('popstate'));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={styles.joinUsBtn}
            >
              JOIN US
            </a>

            {/* Infinite Marquee Carousel (Left-to-Right) */}
            <div className={styles.brandTickerWrapper}>
              <div className={styles.brandTickerTrack}>
                {[0, 1].map((groupIndex) => (
                  <div key={groupIndex} className={styles.brandTickerGroup}>
                    {[
                      { name: 'Pioneer DJ', url: 'https://res.cloudinary.com/di5bqvkma/image/upload/c_scale,w_100,q_auto,f_auto/v1761233575/pioneer_yjfm6n.png' },
                      { name: 'Rekordbox', url: 'https://res.cloudinary.com/di5bqvkma/image/upload/c_scale,w_100,q_auto,f_auto/v1761233576/rekordbox_rlqqen.png' },
                      { name: 'Yamaha', url: 'https://res.cloudinary.com/di5bqvkma/image/upload/c_scale,w_100,q_auto,f_auto/v1761233578/yamaha_aiyqca.png' },
                      { name: 'Arturia', url: 'https://res.cloudinary.com/di5bqvkma/image/upload/c_scale,w_100,q_auto,f_auto/v1761233570/arthuria_ere2uy.png' },
                      { name: 'Ableton', url: 'https://res.cloudinary.com/di5bqvkma/image/upload/c_scale,w_100,q_auto,f_auto/v1761233570/abelton_ndfgg8.png' },
                      { name: 'Pioneer DJ', url: 'https://res.cloudinary.com/di5bqvkma/image/upload/c_scale,w_100,q_auto,f_auto/v1761233575/pioneer_yjfm6n.png' },
                      { name: 'Rekordbox', url: 'https://res.cloudinary.com/di5bqvkma/image/upload/c_scale,w_100,q_auto,f_auto/v1761233576/rekordbox_rlqqen.png' },
                      { name: 'Yamaha', url: 'https://res.cloudinary.com/di5bqvkma/image/upload/c_scale,w_100,q_auto,f_auto/v1761233578/yamaha_aiyqca.png' },
                      { name: 'Arturia', url: 'https://res.cloudinary.com/di5bqvkma/image/upload/c_scale,w_100,q_auto,f_auto/v1761233570/arthuria_ere2uy.png' },
                      { name: 'Ableton', url: 'https://res.cloudinary.com/di5bqvkma/image/upload/c_scale,w_100,q_auto,f_auto/v1761233570/abelton_ndfgg8.png' },
                    ].map((brand, idx) => (
                      <div key={idx} className={styles.brandCard}>
                        <img
                          src={brand.url}
                          alt={brand.name}
                          className={styles.partnerLogoImg}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Layer 1 (Middle): Overlay Section ("Why Soundabode Academy?") */}
        <WhySoundabodeSection ref={overlaySectionRef} />

        {/* Layer 2 (Top): Two Split Poster Panels */}
        <div ref={panelsContainerRef} className={styles.panelsContainer}>
          {/* Left Panel - DJ Courses */}
          <div
            ref={leftPanelRef}
            className={`${styles.panel} ${styles.leftPanel}`}
          >
            {leftPanelVideo && (
              <video
                className={styles.panelVideo}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
              >
                <source src={leftPanelVideo} type="video/webm" />
              </video>
            )}
            <div className={styles.panelOverlay} />
            <div className={styles.panelInner}>
              <h2 className={styles.heroHeading}>
                DROP BEATS.<br />
                COMMAND<br />
                <span className={styles.accentRed}>CROWDS.</span>
              </h2>
              <p className={styles.heroDescription}>
                Step behind the decks with Soundabode&apos;s DJ Courses where rhythm meets mastery.
                Learn to mix, scratch, and perform like the pros with industry standard Pioneer gear
                and real-world club techniques.
              </p>
              <button
                className={styles.exploreBtn}
                onClick={() => {
                  window.history.pushState({}, '', '/courses?tab=dj');
                  window.dispatchEvent(new Event('popstate'));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                EXPLORE COURSES
              </button>
            </div>
          </div>

          {/* Right Panel - Music Production Courses */}
          <div
            ref={rightPanelRef}
            className={`${styles.panel} ${styles.rightPanel}`}
          >
            {rightPanelVideo && (
              <video
                className={styles.panelVideo}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
              >
                <source src={rightPanelVideo} type="video/webm" />
              </video>
            )}
            <div className={styles.panelOverlay} />
            <div className={styles.panelInner}>
              <h2 className={styles.heroHeading}>
                CREATE SOUNDS<br />
                THAT MOVE THE<br />
                <span className={styles.accentRed}>WORLD.</span>
              </h2>
              <p className={styles.heroDescription}>
                Craft your own sonic identity with Soundabode&apos;s Music Production &amp; Audio Engineering Courses in Pune.
                Master sound design, arrangement, and mixing from the first note to your final release.
              </p>
              <button
                className={styles.exploreBtn}
                onClick={() => {
                  window.history.pushState({}, '', '/courses?tab=emp');
                  window.dispatchEvent(new Event('popstate'));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                EXPLORE COURSES
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TwoPanelHero;
