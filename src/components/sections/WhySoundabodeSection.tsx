import React, { forwardRef } from 'react';
import styles from './WhySoundabodeSection.module.css';

export interface WhySoundabodeSectionProps {
  className?: string;
  style?: React.CSSProperties;
}

export const WhySoundabodeSection = forwardRef<HTMLElement, WhySoundabodeSectionProps>(
  ({ className = '', style = {} }, ref) => {
    return (
      <section
        ref={ref}
        className={`${styles.whyAcademyOverlaySection} ${className}`}
        style={style}
        aria-label="Learn. Mix. Perform."
      >
        <div className={styles.whyAcademyContent}>
          {/* Left Column: Text & CTA */}
          <div className={styles.whyAcademyLeftCol}>
            <span className={styles.taglineRed}>DJ TRAINING ACADEMY</span>
            <h2 className={styles.whyAcademyTitle}>
              LEARN. MIX.<br />
              <span className={styles.accentRed}>PERFORM.</span>
            </h2>

            <p className={styles.whyAcademyParagraph}>
              Turn your passion for music into real-world DJ skills with Soundabode&apos;s pro DJ
              courses from beginner decks to club-ready sets. Hands-on training on industry
              standard gear. Learn beatmatching, mixing, and live performance. Mentorship
              from real performing DJs. Flexible batches for creators, students &amp; night owls.
              Master Pioneer CDJs, Rekordbox &amp; Traktor while performing across genres like
              Techno, Psytrance, House, Hip-Hop &amp; Club music.
            </p>

            <p className={styles.whyAcademyParagraph}>
              Learn from India&apos;s touring DJs. Join India&apos;s fastest growing DJ community
              powered by Native Instrument&apos;s Traktor + Pioneer DJ. Start your DJ journey
              today at Soundabode where artists are made, not born. Join our DJ training
              courses in Pune, India or take an online DJ course.
            </p>

            <button className={styles.learnMoreBtn}>
              <span>Learn More</span>
              <span className={styles.btnArrow}>→</span>
            </button>
          </div>

          {/* Right Column: 2x2 Media Grid */}
          <div className={styles.whyAcademyRightCol}>
            {/* Top Row: 3 Portrait Cards */}
            <div className={styles.mediaTopRow}>
              <div className={styles.mediaCardPortrait}>
                <img
                  src="https://cdn.jsdelivr.net/gh/nexoraio99/cdn-soundabode-assets@main/gianni-scognamiglio--K0ZDdohOBk-unsplash.webp"
                  alt="DJ performing on stage"
                  className={styles.mediaImg}
                  width="400"
                  height="300"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className={styles.mediaCardPortrait}>
                <img
                  src="https://cdn.jsdelivr.net/gh/nexoraio99/cdn-soundabode-assets@main/marcel-strauss-GS9M4vHCwq4-unsplash.webp"
                  alt="DJ mixing on decks"
                  className={styles.mediaImg}
                  width="400"
                  height="300"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className={styles.mediaCardPortrait}>
                <img
                  src="https://cdn.jsdelivr.net/gh/nexoraio99/cdn-soundabode-assets@main/redd-francisco-viW03nMV670-unsplash.webp"
                  alt="DJ live performance"
                  className={styles.mediaImg}
                  width="400"
                  height="300"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>

            {/* Bottom Row: 1 Wide Banner Card */}
            <div className={styles.mediaBottomRow}>
              <div className={styles.mediaCardLandscape}>
                <img
                  src="https://cdn.jsdelivr.net/gh/nexoraio99/cdn-soundabode-assets@main/romina-veliz-DGKJzOmjyS4-unsplash.webp"
                  alt="DJ crowd energy and performance"
                  className={styles.mediaImgLandscape}
                  width="800"
                  height="400"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }
);

WhySoundabodeSection.displayName = 'WhySoundabodeSection';

export default WhySoundabodeSection;
