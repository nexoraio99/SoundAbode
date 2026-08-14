import React from 'react';
import styles from './ProduceCreateReleaseSection.module.css';

export const ProduceCreateReleaseSection: React.FC = () => {
  return (
    <section className={styles.produceSectionWrapper} aria-label="Produce. Create. Release.">
      <div className={styles.produceContainer}>
        {/* Left Column: 2x2 Media Grid */}
        <div className={styles.produceLeftCol}>
          {/* Top Row: 3 Portrait Cards */}
          <div className={styles.mediaTopRow}>
            <div className={styles.mediaCardPortrait}>
              <img
                src="https://cdn.jsdelivr.net/gh/nexoraio99/cdn-soundabode-assets@main/modular-synthesis-the-ultimate-guide-featured.jpg"
                alt="Modular Synthesis Studio Setup"
                className={styles.mediaImgP1}
                width="400"
                height="300"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className={styles.mediaCardPortrait}>
              <img
                src="https://cdn.jsdelivr.net/gh/nexoraio99/cdn-soundabode-assets@main/techivation-v3YRMINX-Ik-unsplash.webp"
                alt="Studio Plugin Screen Production"
                className={styles.mediaImgP2}
                width="400"
                height="300"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className={styles.mediaCardPortrait}>
              <img
                src="https://cdn.jsdelivr.net/gh/nexoraio99/cdn-soundabode-assets@main/saubhagya-gandharv-36RU6_uA0nQ-unsplash.jpg"
                alt="Music Producer in Studio Session"
                className={styles.mediaImgP3}
                width="400"
                height="300"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>

          {/* Bottom Row: 1 Wide Studio Faders Banner Card */}
          <div className={styles.mediaBottomRow}>
            <div className={styles.mediaCardLandscape}>
              <img
                src="https://cdn.jsdelivr.net/gh/nexoraio99/cdn-soundabode-assets@main/9704167-midi-keyboard-headphones.jpg"
                alt="MIDI Keyboard with Headphones Music Production"
                className={styles.mediaImgWarm}
                width="800"
                height="400"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Text & CTA */}
        <div className={styles.produceRightCol}>
          <span className={styles.taglineRed}>ELECTRONIC MUSIC PRODUCTION</span>
          <h2 className={styles.produceTitle}>
            PRODUCE. CREATE.<br />
            <span className={styles.accentRed}>RELEASE.</span>
          </h2>

          <p className={styles.produceParagraph}>
            Dive into the world of Electronic Music Production with Soundabode where
            creativity meets technology. Learn Ableton Live from certified mentors. Craft
            your own sound from scratch. Mix &amp; master like the pros. Build your artist identity
            and release-ready tracks. From bedroom beats to festival feeds it all starts here.
            Join Soundabode, India&apos;s next-gen music production school built for artists who
            want more than tutorials they want results. Learn to produce across styles like
            Techno, Psytrance, Hip-Hop, House, Drum &amp; Bass, Dubstep, and EDM using
            Ableton Live, professional hardware, and real-world studio workflows.
          </p>

          <p className={styles.produceParagraph}>
            Go beyond music production, explore game music composition, background
            scoring for films, web series, and advertisements, sound design for YouTube
            creators. Our courses also empower classically trained musicians to start their
            own independent studio setups and transform their compositions into
            professional releases. Craft, compose and produce your signature sound
            through expert-led programs designed for aspiring producers, creators and
            YouTubers.
          </p>

          <button className={styles.learnMoreBtn}>
            <span>Learn More</span>
            <span className={styles.btnArrow}>→</span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default ProduceCreateReleaseSection;
