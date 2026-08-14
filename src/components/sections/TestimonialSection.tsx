import React from 'react';
import styles from './TestimonialSection.module.css';

export interface TestimonialItem {
  quote: string;
  name: string;
  role: string;
  initials: string;
  isVerified?: boolean;
}

const ROW_1_ITEMS: TestimonialItem[] = [
  {
    quote: "I've had an incredible experience at Soundabode. The instructors here are deeply experienced. Every session is packed with real world knowledge!",
    name: "Tanisha Railkar",
    role: "Tech House Producer",
    initials: "TR",
    isVerified: true,
  },
  {
    quote: "I recently completed the DJ course and couldn't be happier. From beatmatching to reading the crowd. SOUNDABODE - THE BEST!",
    name: "Anmol Bhat",
    role: "DJ Student",
    initials: "AB",
    isVerified: true,
  },
  {
    quote: "Joined Soundabode with zero knowledge of music. Both trainers Harsh & Vaibhav have excellent knowledge. Truly fantastic musicians!",
    name: "Mandar Dhotre",
    role: "DJ Student",
    initials: "MD",
    isVerified: false,
  },
  {
    quote: "From day one, the vibe here has felt like home! Taught me everything from old-school mixing to pro-level DJing.",
    name: "Jack Forest",
    role: "Club DJ",
    initials: "JF",
    isVerified: true,
  },
];

const ROW_2_ITEMS: TestimonialItem[] = [
  {
    quote: "Needed proper direction in music production. Mentors Abhinav sir & Vrishan show constant support. Definitely worth it!",
    name: "Ansh Agrawal",
    role: "Music Production Student",
    initials: "AA",
    isVerified: true,
  },
  {
    quote: "Amazing learning experience! Able to continue my full-time job while learning DJing. Highly recommended for working professionals!",
    name: "Vineet Babar",
    role: "DJ Student",
    initials: "VB",
    isVerified: false,
  },
  {
    quote: "Completed my course with Soundabode, couldn't be happier. Suitable for all ages. Mr. Abhinav & team foster a positive learning environment!",
    name: "Sudarsan V. Chilakalapalli",
    role: "Art Director",
    initials: "SC",
    isVerified: true,
  },
  {
    quote: "Every session is packed with real world experience. If you are serious about mixing and rhythm, Soundabode is the place to be.",
    name: "Tanisha Railkar",
    role: "Tech House Producer",
    initials: "TR",
    isVerified: true,
  },
];

const TestimonialCard: React.FC<{ item: TestimonialItem }> = ({ item }) => {
  return (
    <div className={styles.card}>
      <p className={styles.quoteText}>&ldquo;{item.quote}&rdquo;</p>

      <div className={styles.cardFooter}>
        <div className={styles.authorGroup}>
          <div className={styles.avatar}>
            <span>{item.initials}</span>
          </div>
          <div className={styles.authorMeta}>
            <div className={styles.nameRow}>
              <span className={styles.authorName}>{item.name}</span>
              {item.isVerified && (
                <svg className={styles.verifiedBadge} width="14" height="14" viewBox="0 0 24 24" fill="#ef4444">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              )}
            </div>
            {item.role && <span className={styles.authorRole}>{item.role}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export const TestimonialSection: React.FC = () => {
  return (
    <section className={styles.wallOfLoveWrapper} aria-label="Wall of Love">
      {/* Header */}
      <div className={styles.headerBox}>
        <span className={styles.subTagline}>THE FEEDBACK LOOP</span>
        <h2 className={styles.mainTitle}>
          WHAT HAPPENS AFTER YOU <span className={styles.accentRed}>JOIN</span>
        </h2>
      </div>

      {/* Row 1 Marquee */}
      <div className={styles.marqueeRow}>
        <div className={`${styles.marqueeTrack} ${styles.trackLeft}`}>
          {[...ROW_1_ITEMS, ...ROW_1_ITEMS, ...ROW_1_ITEMS].map((item, idx) => (
            <TestimonialCard key={`r1-${idx}`} item={item} />
          ))}
        </div>
      </div>

      {/* Row 2 Marquee */}
      <div className={styles.marqueeRow}>
        <div className={`${styles.marqueeTrack} ${styles.trackRight}`}>
          {[...ROW_2_ITEMS, ...ROW_2_ITEMS, ...ROW_2_ITEMS].map((item, idx) => (
            <TestimonialCard key={`r2-${idx}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialSection;
