import React, { useRef, useEffect, useState } from 'react';
import styles from './ArtistCarouselSection.module.css';

export interface Artist {
  name: string;
  image: string;
}

const ARTISTS: Artist[] = [
  { name: 'Sumone', image: '/Artists/Sumone.jpg' },
  { name: 'Defpoint', image: '/Artists/defpoint-belgium.jpg' },
  { name: 'DJ Tanisha', image: '/Artists/DJ_Tanisha_vdpgxy.jpg' },
  { name: 'Homeboy', image: '/Artists/SKP06352-opt.jpg' },
  { name: 'DJ TEG', image: '/Artists/third-eye-groove-dj-teg.jpg' },
  { name: 'Problem Child', image: '/Artists/Problemchild.jpg' },
  { name: 'Yeti', image: '/Artists/Yeti.jpg' },
  { name: 'Redeye Music', image: '/Artists/Redeyemusic.jpeg' },
  { name: 'Jack Forest', image: '/Artists/jack-forest.jpg' },
  { name: 'Nihar', image: '/Artists/nihar-completely-twisted.jpg' },
];

// Tripled list to ensure seamless infinite looping on all screen sizes
const DISPLAY_ARTISTS = [...ARTISTS, ...ARTISTS, ...ARTISTS];

export const ArtistCarouselSection: React.FC = () => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !isVisible) return;

    // Smooth speed multiplier (1px per frame)
    const speed = 1;

    const animate = () => {
      if (!isPaused && track) {
        track.scrollLeft += speed;

        // When scroll reaches 1 full set of artists (1/3 of total scroll width), wrap back seamlessly
        const setWidth = track.scrollWidth / 3;
        if (setWidth > 0 && track.scrollLeft >= setWidth * 2) {
          track.scrollLeft -= setWidth;
        }
      }
      animFrameId.current = requestAnimationFrame(animate);
    };

    animFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [isPaused, isVisible]);

  const scrollLeft = () => {
    if (trackRef.current) {
      const track = trackRef.current;
      const setWidth = track.scrollWidth / 3;
      if (track.scrollLeft <= 10) {
        track.scrollLeft += setWidth;
      }
      track.scrollBy({ left: -320, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (trackRef.current) {
      const track = trackRef.current;
      const setWidth = track.scrollWidth / 3;
      if (track.scrollLeft >= setWidth * 2) {
        track.scrollLeft -= setWidth;
      }
      track.scrollBy({ left: 320, behavior: 'smooth' });
    }
  };

  return (
    <section className={styles.artistCarouselSectionWrapper} aria-label="Artists Showcase">
      <div className={styles.sectionHeaderBox}>
        <span className={styles.taglineRed}>ARTIST ROSTER &amp; ALUMNI</span>
        <h2 className={styles.sectionHeader}>PERFORMING <span className={styles.accentRed}>ARTISTS</span></h2>
      </div>

      <div
        className={styles.artistCarouselContainer}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Navigation Arrow Left */}
        <button
          onClick={scrollLeft}
          className={`${styles.carouselArrowBtn} ${styles.leftArrow}`}
          aria-label="Previous Artists"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Infinite Scrollable Track */}
        <div ref={trackRef} className={styles.artistScrollTrack}>
          {DISPLAY_ARTISTS.map((artist, idx) => (
            <div key={idx} className={styles.artistCard}>
              <img
                src={artist.image}
                alt={artist.name}
                className={styles.artistImg}
                width="300"
                height="400"
                loading="lazy"
                decoding="async"
              />
              <div className={styles.artistOverlay} />
              <h3 className={styles.artistName}>{artist.name}</h3>
            </div>
          ))}
        </div>

        {/* Navigation Arrow Right */}
        <button
          onClick={scrollRight}
          className={`${styles.carouselArrowBtn} ${styles.rightArrow}`}
          aria-label="Next Artists"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </section>
  );
};

export default ArtistCarouselSection;
