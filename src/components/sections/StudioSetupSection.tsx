import React from 'react';
import styles from './StudioSetupSection.module.css';

export interface GearItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const GEAR_ITEMS: GearItem[] = [
  {
    title: 'DAW',
    description:
      'Ableton Live 12 Suite + Push 2 & Push 3 setup - the core of composition, arrangement and live performance.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    ),
  },
  {
    title: 'HARDWARE',
    description:
      'Pioneer Nexus, XDJ-RX3/RX & Native Instruments Traktor S4/S8 - industry-standard DJ rigs for real gig workflows.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    title: 'SYNTHS & CONTROLLERS',
    description:
      'Arturia MicroFreak, Novation LaunchKey/XL, Behringer racks, Roland drum machines, Soundcraft mixers, VCV & Nord for sound design and performance.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
        <circle cx="8" cy="6" r="2" fill="currentColor" />
        <circle cx="16" cy="12" r="2" fill="currentColor" />
        <circle cx="10" cy="18" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: 'AUDIO INTERFACE & MONITORS',
    description:
      'Universal Audio Apollo, KRK Rokit, Yamaha HS, Presonus, Scarlett & EVO - reliable I/O and reference monitors for production and mixing.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="3" />
        <circle cx="12" cy="7" r="2" />
        <circle cx="12" cy="15" r="4" />
      </svg>
    ),
  },
  {
    title: 'PLUGINS & TOOLS',
    description:
      'A curated plugin rack: Waves, iZotope, FabFilter, UAD, Native Instruments, Xfer and more for mixing, mastering and design.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    title: 'RECORDING GEAR',
    description:
      'Shure & Rode mics, Focusrite & Soundcraft preamps, and treated booths for pro recording sessions.',
    icon: (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        <circle cx="8.5" cy="12" r="2.5" />
      </svg>
    ),
  },
];

export const StudioSetupSection: React.FC = () => {
  return (
    <section className={styles.studioSetupSectionWrapper} aria-label="Studio Setup & Gear">
      <div className={styles.studioSetupContainer}>
        {/* Section Header */}
        <span className={styles.taglineRed}>HARDWARE & ENVIRONMENT</span>
        <h2 className={styles.sectionHeader}>
          STUDIO SETUP &amp; <span className={styles.accentRed}>GEAR</span>
        </h2>

        {/* 6 Cards Grid */}
        <div className={styles.gearGrid}>
          {GEAR_ITEMS.map((item, idx) => (
            <div key={idx} className={styles.gearCard}>
              <div className={styles.cardIconBox}>{item.icon}</div>
              <div className={styles.cardContent}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.cardDescription}>{item.description}</p>
              </div>
              <span className={styles.detailsBtn}>
                Details <span className={styles.arrow}>→</span>
              </span>
            </div>
          ))}
        </div>

        {/* Bottom CTA Button */}
        <button className={styles.bookTourBtn}>Book a Studio Tour</button>
      </div>
    </section>
  );
};

export default StudioSetupSection;
