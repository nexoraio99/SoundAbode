import React, { useState } from 'react';
import styles from './WhyChooseSoundabodeSection.module.css';

export const WhyChooseSoundabodeSection: React.FC = () => {
  const [showPerks, setShowPerks] = useState(true);

  return (
    <section className={styles.whyChooseSectionWrapper} aria-label="Why Choose Soundabode">
      <div className={styles.whyChooseContainer}>
        {/* Title */}
        <span className={styles.taglineRed}>THE SOUNDABODE ADVANTAGE</span>
        <h2 className={styles.whyChooseTitle}>
          WHY CHOOSE SOUND<span className={styles.accentRed}>ABODE</span>
        </h2>

        {/* Benefits & Perks Toggle Button */}
        <button
          onClick={() => setShowPerks((prev) => !prev)}
          className={styles.perksToggleBtn}
          aria-expanded={showPerks}
        >
          <span>More benefits &amp; perks</span>
          <span className={styles.toggleArrow}>{showPerks ? '▲' : '▼'}</span>
        </button>

        {/* Expandable Perks Container */}
        {showPerks && (
          <div className={styles.perksBox}>
            <ul className={styles.perksList}>
              <li>Learn on industry-grade hardware and VSTs (Arturia, Moog, Nord, Virus Ti)</li>
              <li>Guest masterclasses by top Indian electronic producers</li>
              <li>Exposure to real-world production environments</li>
              <li>Collaborate through Soundabode&apos;s producer network &amp; global community</li>
              <li>Free studio access + 1-month internship with real client projects</li>
              <li>Mentorship in career development, branding, and artist growth</li>
            </ul>
          </div>
        )}

        {/* 3 Bottom Cards */}
        <div className={styles.cardsGrid}>
          {/* Card 1 */}
          <div className={styles.benefitCard}>
            <div className={styles.cardIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <circle cx="8" cy="12" r="2.5" />
                <circle cx="16" cy="12" r="2.5" />
                <path d="M12 6v12" />
              </svg>
            </div>
            <h3 className={styles.cardTitle}>
              HANDS-ON STUDIO <span className={styles.accentRed}>TRAINING</span>
            </h3>
            <div className={styles.cardBody}>
              <p>100% hands-on studio training</p>
              <p>Access to India&apos;s most advanced production setups</p>
            </div>
            <button className={styles.learnMoreBtn}>
              <span>Learn more</span>
              <span className={styles.btnArrow}>→</span>
            </button>
          </div>

          {/* Card 2 */}
          <div className={styles.benefitCard}>
            <div className={styles.cardIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <h3 className={styles.cardTitle}>
              MENTORS &amp; <span className={styles.accentRed}>PERFORMANCE</span>
            </h3>
            <div className={styles.cardBody}>
              <p>Industry mentors &amp; touring DJs</p>
              <p>Real performance opportunities (Pune &amp; across India)</p>
            </div>
            <button className={styles.learnMoreBtn}>
              <span>Learn more</span>
              <span className={styles.btnArrow}>→</span>
            </button>
          </div>

          {/* Card 3 */}
          <div className={styles.benefitCard}>
            <div className={styles.cardIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </div>
            <h3 className={styles.cardTitle}>
              ARTIST SUPPORT &amp;<br />
              <span className={styles.accentRed}>FLEXIBILITY</span>
            </h3>
            <div className={styles.cardBody}>
              <p>Artist branding &amp; release support</p>
              <p>Online + offline learning modes</p>
            </div>
            <button className={styles.learnMoreBtn}>
              <span>Learn more</span>
              <span className={styles.btnArrow}>→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhyChooseSoundabodeSection;
