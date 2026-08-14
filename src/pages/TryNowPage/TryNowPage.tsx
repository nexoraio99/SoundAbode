import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import styles from './TryNowPage.module.css';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import SoundabodeLiveConsole from '../../components/common/SoundabodeLiveConsole';
import SEO from '../../components/common/SEO';

export interface TryNowPageProps {
  onNavigateHome?: () => void;
}

const tryNowSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Soundabode Interactive DJ Console & Rekordbox Simulator',
  url: 'https://soundabode.com/try-now',
  description:
    'Test your DJ mixing skills live in your browser. Interactive DJ deck controls, beatmatching, performance pads, and audio mixing simulator.',
  applicationCategory: 'MultimediaApplication',
  operatingSystem: 'All',
  provider: {
    '@type': 'EducationalOrganization',
    name: 'Soundabode Academy',
    url: 'https://soundabode.com',
  },
};

/**
 * IMPORTANT: This is the pixel size SoundabodeLiveConsole is actually
 * designed/laid out at on desktop (i.e. whatever width its root container
 * targets there — check its own CSS, e.g. a `max-width` or `min-width` on
 * its root element). We scale against this FIXED reference size rather than
 * trying to auto-measure the live DOM node.
 *
 * Why: the console's root almost certainly has `width: 100%` (fills its
 * parent). If we put that inside a `width: max-content` wrapper to "measure
 * its natural size", the sizing becomes circular (100% of "my content size"
 * depends on "my content size") and most browsers just collapse it to
 * 0x0 — which is exactly why the console went blank. Scaling against a
 * known fixed canvas size sidesteps that entirely.
 *
 * Tune these two numbers to match your real desktop layout width/height.
 */
const CONSOLE_DESIGN_WIDTH_WITH_LIBRARY = 1180;
const CONSOLE_DESIGN_WIDTH_NO_LIBRARY = 1040;
const CONSOLE_DESIGN_HEIGHT_WITH_LIBRARY = 940;
const CONSOLE_DESIGN_HEIGHT_NO_LIBRARY = 560;

/**
 * Watches the available space in a stage frame and computes a scale factor
 * so a designWidth x designHeight canvas always fits inside it —
 * on any phone, tablet, or fullscreen size — without clipping.
 */
function useFitScale(
  stageRef: React.RefObject<HTMLDivElement>,
  rotated: boolean,
  designWidth: number,
  designHeight: number,
  padding = 16
) {
  const [scale, setScale] = useState(0.3);

  const recalc = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const stageRect = stage.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height) return;

    const availW = Math.max(stageRect.width - padding, 1);
    const availH = Math.max(stageRect.height - padding, 1);

    // After a 90deg rotation, the canvas's width occupies vertical space
    // and its height occupies horizontal space, so the available dimensions
    // need to be swapped when computing the fit.
    const fitW = rotated ? availH : availW;
    const fitH = rotated ? availW : availH;

    const nextScale = Math.min(fitW / designWidth, fitH / designHeight);
    setScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 0.3);
  }, [stageRef, rotated, designWidth, designHeight, padding]);

  useLayoutEffect(() => {
    recalc();

    const stage = stageRef.current;
    if (!stage) return;

    const ro = new ResizeObserver(() => recalc());
    ro.observe(stage);

    window.addEventListener('orientationchange', recalc);
    window.addEventListener('resize', recalc);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', recalc);
      window.removeEventListener('resize', recalc);
    };
  }, [recalc, stageRef]);

  return scale;
}

/**
 * Renders SoundabodeLiveConsole on a fixed-size design canvas
 * (designWidth x designHeight) and scales/rotates that whole canvas to
 * fit whatever frame it's placed in. Selecting dimensions based on showLibrary
 * prevents clipping when the track library panel is shown.
 */
const FitToFrameConsole: React.FC<{
  showLibrary: boolean;
  rotated: boolean;
  stageRef: React.RefObject<HTMLDivElement>;
}> = ({ showLibrary, rotated, stageRef }) => {
  const designWidth = showLibrary
    ? CONSOLE_DESIGN_WIDTH_WITH_LIBRARY
    : CONSOLE_DESIGN_WIDTH_NO_LIBRARY;
  const designHeight = showLibrary
    ? CONSOLE_DESIGN_HEIGHT_WITH_LIBRARY
    : CONSOLE_DESIGN_HEIGHT_NO_LIBRARY;
  const scale = useFitScale(stageRef, rotated, designWidth, designHeight);

  return (
    <div
      className={styles.consoleDesignCanvas}
      style={{
        width: designWidth,
        height: designHeight,
        transform: rotated
          ? `translate(-50%, -50%) rotate(90deg) scale(${scale})`
          : `translate(-50%, -50%) scale(${scale})`,
      }}
    >
      <SoundabodeLiveConsole showLibrary={showLibrary} />
    </div>
  );
};

export const TryNowPage: React.FC<TryNowPageProps> = ({ onNavigateHome }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscapeRotated, setIsLandscapeRotated] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLibraryMobile, setShowLibraryMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOrientationChange = () => {
      const isMobileDevice = window.innerWidth < 768 || window.innerHeight < 768;
      const isPortrait = window.innerHeight > window.innerWidth;
      setIsMobile(isMobileDevice);
      if (isMobileDevice && isPortrait) {
        setIsLandscapeRotated(true);
      } else {
        setIsLandscapeRotated(false);
      }
    };

    handleOrientationChange();
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);
    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const isFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      if (!isFs && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    const target = containerRef.current || document.documentElement;
    if (!isFullscreen) {
      setIsFullscreen(true);
      if (target.requestFullscreen) {
        target.requestFullscreen().catch(() => { });
      } else if ((target as any).webkitRequestFullscreen) {
        try {
          (target as any).webkitRequestFullscreen();
        } catch { }
      } else if ((target as any).msRequestFullscreen) {
        try {
          (target as any).msRequestFullscreen();
        } catch { }
      }
    } else {
      setIsFullscreen(false);
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
      } else if ((document as any).webkitExitFullscreen) {
        try {
          (document as any).webkitExitFullscreen();
        } catch { }
      } else if ((document as any).msExitFullscreen) {
        try {
          (document as any).msExitFullscreen();
        } catch { }
      }
    }
  };

  const rotated = isMobile && isLandscapeRotated;

  return (
    <div className={styles.pageWrapper}>
      <SEO
        title="Interactive DJ Console & Rekordbox Simulator | Soundabode"
        description="Try Soundabode's interactive DJ console and Rekordbox trial simulator. Test your DJing and track mixing skills live online in your browser."
        keywords="Virtual DJ Console, Rekordbox Trial, Online DJ Mixer, Interactive DJ Simulator, Soundabode Console"
        canonical="https://soundabode.com/try-now"
        schema={tryNowSchema}
      />
      <Navbar
        activePage="courses"
        onNavigate={(page) => {
          if (page !== 'courses' && onNavigateHome) {
            onNavigateHome();
          }
        }}
      />

      <header className={styles.heroHeader}>
        <div className={styles.eyebrow}>SOUNDABODE INTERACTIVE DJ STUDIO</div>
        <h1 className={styles.title}>
          TRY OUR <span className={styles.accentRed}>LIVE DJ CONSOLE</span>
        </h1>
        <p className={styles.subtitle}>
          Test your DJ mixing skills live in your browser! Experience real-time deck controls, beatmatching, performance drum pads, and full audio mixing on Soundabode&apos;s virtual studio console.
        </p>
      </header>

      <main className={styles.mainContent}>
        <div>
          <div className={styles.sectionHeaderRow}>
            <h2 className={styles.sectionTitle}>
              <span>SOUNDABODE LIVE CONSOLE</span>
              <span className={styles.badge}>INTERACTIVE</span>
            </h2>

            <div className={styles.mobileControls}>
              {isMobile && (
                <>
                  <button
                    type="button"
                    className={`${styles.mobileToggleBtn} ${showLibraryMobile ? styles.activeToggle : ''}`}
                    onClick={() => setShowLibraryMobile((prev) => !prev)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                    <span>{showLibraryMobile ? 'Hide Tracks' : 'Tracks'}</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.mobileToggleBtn} ${isLandscapeRotated ? styles.activeToggle : ''}`}
                    onClick={() => setIsLandscapeRotated((prev) => !prev)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    <span>{isLandscapeRotated ? 'Landscape ON' : 'Landscape'}</span>
                  </button>
                </>
              )}
              <button
                type="button"
                className={`${styles.mobileToggleBtn} ${isFullscreen ? styles.activeToggle : ''}`}
                onClick={toggleFullscreen}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
                <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
              </button>
            </div>
          </div>

          <div
            ref={containerRef}
            className={isFullscreen ? styles.fullscreenActiveOverlay : ''}
          >
            {isFullscreen && (
              <button
                type="button"
                className={styles.exitFullscreenFloatingBtn}
                onClick={toggleFullscreen}
                aria-label="Exit Fullscreen Mode"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>Exit Fullscreen</span>
              </button>
            )}

            {rotated ? (
              <div className={styles.landscapeViewportFrame} ref={stageRef}>
                <div className={styles.landscapeNoticeBanner}>
                  <span>LANDSCAPE MODE — Playable Dual-Deck View</span>
                </div>
                <FitToFrameConsole
                  showLibrary={showLibraryMobile}
                  rotated
                  stageRef={stageRef}
                />
              </div>
            ) : (
              <div className={styles.uprightStageFrame} ref={stageRef}>
                <FitToFrameConsole
                  showLibrary={showLibraryMobile || !isMobile}
                  rotated={false}
                  stageRef={stageRef}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TryNowPage;