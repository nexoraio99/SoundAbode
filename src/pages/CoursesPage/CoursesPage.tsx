import React, { useState, useEffect } from 'react';
import styles from './CoursesPage.module.css';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import AnimatedCounter from '../../components/common/AnimatedCounter';
import SEO from '../../components/common/SEO';

interface CoursesPageProps {
  onNavigateHome?: () => void;
}

const getInitialTab = (): 'emp' | 'dj' => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') || params.get('category');
    const hash = window.location.hash.toLowerCase();
    if (tabParam === 'dj' || hash === '#dj') {
      return 'dj';
    }
  }
  return 'emp';
};

export const CoursesPage: React.FC<CoursesPageProps> = ({ onNavigateHome }) => {
  const [activeTab, setActiveTab] = useState<'emp' | 'dj'>(getInitialTab);

  useEffect(() => {
    const syncTabFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') || params.get('category');
      const hash = window.location.hash.toLowerCase();
      if (tabParam === 'dj' || hash === '#dj') {
        setActiveTab('dj');
      } else if (tabParam === 'emp' || hash === '#emp') {
        setActiveTab('emp');
      }
    };

    syncTabFromUrl();
    window.addEventListener('popstate', syncTabFromUrl);
    window.addEventListener('hashchange', syncTabFromUrl);
    return () => {
      window.removeEventListener('popstate', syncTabFromUrl);
      window.removeEventListener('hashchange', syncTabFromUrl);
    };
  }, []);

  const handleTabSwitch = (tab: 'emp' | 'dj') => {
    setActiveTab(tab);
    window.history.pushState({}, '', `/courses?tab=${tab}`);
  };
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const testimonials = [
    {
      quote:
        "I've had an incredible experience at Soundabode. The instructors here are not just passionate, they're deeply experienced and truly know what they're teaching. From understanding the basics of beat matching to mastering bar-to-bar flow, every session is packed with knowledge that comes from real world experience. I can safely say if you're here to learn production or mixing and you're serious about music, rhythm and the art of mixing, this is the place to be. What truly sets them apart from the rest is, the fact that they emphasise on different genres of music, which allows one to try genres out of their comfort zone's and not feel restricted to just try one style of music.",
      author: 'Tanisha Railkar',
      role: 'Tech House Producer',
    },
    {
      quote:
        "I recently completed a DJ course and I couldn't be happier with my experience. The course was well-structured and covered all the basics of DJing, from beatmatching to EQing to reading the crowd. The instructor was knowledgeable, patient, and always willing to answer my questions. By the end of the course, I felt confident enough to start playing gigs and experimenting with my own style. I highly recommend this course to anyone who wants to learn how to DJ or improve their skills. SOUNDABODE - THE BEST.",
      author: 'Anmol Bhat',
      role: 'DJ Student',
    },
    {
      quote:
        "I recently completed my level course with Sound Abode, and I couldn't be happier with my experience. I must highlight the instructor, Mr. Harsh who is exceptionally knowledgeable and passionate about music production. His personalized attention really supports your growth as an artist. The curriculum is well-organized, covering everything from basic to advanced techniques making it suitable for all ages.",
      author: 'Sudarsan Venkata Chilakalapalli',
      role: 'Art Director Creative House',
    },
  ];

  const empFaqs = [
    {
      q: 'Q1. Which is the best music production course in Pune?',
      a: "Soundabode's 4-level program is Pune's most complete pathway from beginner to professional - taught on Ableton Live and industry-standard gear.",
    },
    {
      q: 'Q2. Do I need musical background to start?',
      a: 'No. Level 1 is designed for absolute beginners and will teach you everything step by step.',
    },
    {
      q: 'Q3. Do you offer internships?',
      a: 'Yes. Each level includes an internship with live studio projects and real client work.',
    },
    {
      q: 'Q4. What certificate will I receive?',
      a: 'After completing all levels, you’ll earn the Soundabode Diploma in Audio Engineering.',
    },
    {
      q: 'Q5. Can I enroll for only one level?',
      a: 'Absolutely. You can join at any level depending on your existing skillset.',
    },
  ];

  const djFaqs = [
    {
      q: "Q1. What's the best DJ course in Pune?",
      a: "Soundabode's multi-level DJ program is India's most practical and performance-driven DJ training, focused on real gigs and industry exposure.",
    },
    {
      q: 'Q2. Can I enroll without any prior music knowledge?',
      a: 'Absolutely. Level 1 is perfect for complete beginners.',
    },
    {
      q: 'Q3. Do I get to perform live?',
      a: "Yes! Students perform at Soundabode's partner venues and exclusive student nights.",
    },
    {
      q: 'Q4. Is the training on Pioneer CDJs?',
      a: 'Yes, all sessions are conducted on industry-standard Pioneer CDJs and mixers.',
    },
    {
      q: 'Q5. Do you provide placement or gigs?',
      a: 'Yes! We connect certified students with direct gig opportunities at partner clubs in Pune.',
    },
  ];

  const faqs = activeTab === 'dj' ? djFaqs : empFaqs;

  const handleNextTestimonial = () => {
    setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  const handlePrevTestimonial = () => {
    setActiveTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex(openFaqIndex === idx ? null : idx);
  };

  const navigateToRoute = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  // Structured Data Schema for SEO
  const jsonLdSchema = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: 'Soundabode Music Production & DJ Academy',
    url: 'https://soundabode.com/courses',
    description: 'Soundabode is Pune’s premier sound engineering and music production school offering certified Ableton Live and DJ courses.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Shop 218, 2nd Floor, Vision 9 Mall, Kunal Icon Road',
      addressLocality: 'Pimple Saudagar, Pune',
      postalCode: '411017',
      addressCountry: 'IN',
    },
  };

  return (
    <div className={styles.pageContainer}>
      <SEO
        title="Music Production & DJ Courses Pune | Soundabode Academy"
        description="Explore professional DJ training, audio engineering diplomas, and Ableton Live electronic music production courses at Soundabode Pune."
        keywords="Soundabode, DJ Academy India, Music Production Courses Pune, Ableton Live Training, Audio Engineering Diploma, Learn DJ Online"
        canonical="https://soundabode.com/courses"
        schema={jsonLdSchema}
      />

      <Navbar
        activePage="courses"
        onNavigate={(page) => {
          if (page !== 'courses' && onNavigateHome) {
            onNavigateHome();
          }
        }}
      />

      <main className={styles.container} id="main-content">
        {/* HERO SECTION */}
        <section className={styles.hero} aria-label="Course Admissions Overview">
          <div>
            <p className={styles.sectionEyebrow}>Soundabode Academy - Pune</p>
            <h1 className={styles.heroHeading}>
              India’s Most Hands-On Music{' '}
              <span className={styles.gradientText}>Production, Audio Engineering &amp; DJ Courses</span>
            </h1>
            <p className={styles.heroSubtitle}>
              One Academy, two Power Paths, choose yours with infinite music careers. Become the artist the world remembers
            </p>

            <div className={styles.ctaRow}>
              <button
                type="button"
                className={activeTab === 'emp' ? styles.btnPrimary : styles.btnOutline}
                onClick={() => setActiveTab('emp')}
                aria-pressed={activeTab === 'emp'}
              >
                Explore EMP
              </button>
              <button
                type="button"
                className={activeTab === 'dj' ? styles.btnPrimary : styles.btnOutline}
                onClick={() => setActiveTab('dj')}
                aria-pressed={activeTab === 'dj'}
              >
                DJ Training
              </button>
            </div>

            <section className={styles.stats} aria-label="Academy Achievements">
              <div className={styles.stat}>
                <div className={styles.statNum}>
                  <AnimatedCounter end={500} suffix="+" />
                </div>
                <div className={styles.statLabel}>Students trained since 2019</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statNum}>
                  <AnimatedCounter end={200} suffix="+" />
                </div>
                <div className={styles.statLabel}>Industry projects completed</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statNum}>
                  <AnimatedCounter end={30} suffix="+" />
                </div>
                <div className={styles.statLabel}>Partner venues across India</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statNum}>
                  <AnimatedCounter end={4} />
                </div>
                <div className={styles.statLabel}>Structured course levels</div>
              </div>
            </section>
          </div>

          <div>
            <div className={styles.consolePromoCard} role="region" aria-label="Interactive Soundabode Live DJ Console">
              <div className={styles.consoleCardHeader}>
                <div className={styles.consoleTag}>
                  <span>VIRTUAL STUDIO ENGINE</span>
                </div>
                <span className={styles.modelTag}>DDJ-FLX4</span>
              </div>

              <div className={styles.consoleCardContent}>
                <h3 className={styles.consoleCardTitle}>Try Interactive DJ Console</h3>
                <p className={styles.consoleCardDesc}>
                  Practice real-time track mixing, beatmatching, and 3-band EQ controls live in your browser.
                </p>
              </div>

              <button
                type="button"
                className={styles.consoleCardBtn}
                onClick={() => navigateToRoute('/try-now')}
              >
                <span>Launch Live Console</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* TABS SWITCHER */}
        <div className={styles.tabs} role="tablist" aria-label="Course Category Selection">
          <button
            type="button"
            id="tab-emp"
            className={`${styles.tabBtn} ${activeTab === 'emp' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabSwitch('emp')}
            role="tab"
            aria-selected={activeTab === 'emp'}
            aria-controls="panel-emp"
          >
            EMP Music Production
          </button>
          <button
            type="button"
            id="tab-dj"
            className={`${styles.tabBtn} ${activeTab === 'dj' ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabSwitch('dj')}
            role="tab"
            aria-selected={activeTab === 'dj'}
            aria-controls="panel-dj"
          >
            DJ Training
          </button>
        </div>

        {/* EMP PANEL */}
        {activeTab === 'emp' ? (
          <section id="panel-emp" className={styles.section} role="tabpanel" aria-labelledby="tab-emp">
            <div className={`${styles.section} ${styles.sectionNarrow}`}>
              <div className={styles.introCard}>
                <h2 className={styles.sectionTitle}>Music Production &amp; Audio Engineering Courses in Pune</h2>
                <p className={styles.sectionLead}>
                  <strong>Learn. Create. Mix. Master. - Become a Complete Music Producer at Soundabode.</strong>
                </p>
                <p className={styles.muted}>
                  Welcome to <strong>Soundabode</strong>, Pune's most comprehensive and hands-on academy for{' '}
                  <strong>music production and sound engineering</strong>.
                </p>
                <p className={styles.muted}>
                  Our 4 level program takes you from a beginner who loves music to a fully skilled{' '}
                  <strong>producer, sound designer, and mastering engineer</strong>, capable of creating industry-standard audio for music, film, games, and streaming platforms.
                </p>
                <p className={styles.muted}>
                  Whether you are starting out or upgrading your existing skills, <strong>Soundabode gives you the edge</strong> through professional studio training, advanced technology, and real-world industry exposure.
                </p>
              </div>
            </div>

            <div className={styles.sectionDivider} />

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>The Complete Learning Path</h3>
              <p className={styles.sectionSubtitle}>
                Four structured levels that take you from absolute beginner to professional producer and audio engineer.
              </p>

              <div className={styles.levelsGrid}>
                {/* Level 1 */}
                <article
                  className={styles.levelCard}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToRoute('/courses/music-production/beginner-course')}
                  onKeyDown={(e) => handleKeyDown(e, () => navigateToRoute('/courses/music-production/beginner-course'))}
                >
                  <div className={styles.levelBadge} aria-hidden="true">1</div>
                  <div className={styles.levelContent}>
                    <h4 className={styles.levelTitle}>
                      LEVEL 1 - BEGINNER: MUSIC PRODUCTION / AUDIO WORKSTATION
                    </h4>
                    <p className={styles.levelSubtitle}>
                      <strong>Build your foundation.</strong> Learn Ableton Live 11, music theory, beat-making, sampling, and song structure. Create your first track and understand the full production workflow.
                    </p>
                    <div className={styles.levelMetaRow}>
                      <span className={styles.levelLink}>Explore Level 1</span>
                      <span>3 months</span>
                    </div>
                  </div>
                </article>

                {/* Level 2 */}
                <article
                  className={styles.levelCard}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToRoute('/courses/music-production/intermediate-course')}
                  onKeyDown={(e) => handleKeyDown(e, () => navigateToRoute('/courses/music-production/intermediate-course'))}
                >
                  <div className={styles.levelBadge} aria-hidden="true">2</div>
                  <div className={styles.levelContent}>
                    <h4 className={styles.levelTitle}>
                      LEVEL 2 - INTERMEDIATE: PRE-DEGREE IN ELECTRONIC MUSIC PRODUCTION
                    </h4>
                    <p className={styles.levelSubtitle}>
                      <strong>Go deeper into sound design and production.</strong> Master advanced arrangement, layering, and creative plug-ins like Serum, Massive, and Arturia.
                    </p>
                    <div className={styles.levelMetaRow}>
                      <span className={styles.levelLink}>Explore Level 2</span>
                      <span>3 months</span>
                    </div>
                  </div>
                </article>

                {/* Level 3 */}
                <article
                  className={styles.levelCard}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToRoute('/courses/music-production/audio-engineering-diploma')}
                  onKeyDown={(e) => handleKeyDown(e, () => navigateToRoute('/courses/music-production/audio-engineering-diploma'))}
                >
                  <div className={styles.levelBadge} aria-hidden="true">3</div>
                  <div className={styles.levelContent}>
                    <h4 className={styles.levelTitle}>
                      LEVEL 3 - EXPERT: DIPLOMA IN AUDIO ENGINEERING
                    </h4>
                    <p className={styles.levelSubtitle}>
                      <strong>Engineer the sound you imagine.</strong> Train on studio-grade synths, modular setups, and Kontakt instruments.
                    </p>
                    <div className={styles.levelMetaRow}>
                      <span className={styles.levelLink}>Explore Level 3</span>
                      <span>3 months</span>
                    </div>
                  </div>
                </article>

                {/* Level 4 */}
                <article
                  className={styles.levelCard}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToRoute('/courses/music-production/mixing-mastering-course')}
                  onKeyDown={(e) => handleKeyDown(e, () => navigateToRoute('/courses/music-production/mixing-mastering-course'))}
                >
                  <div className={styles.levelBadge} aria-hidden="true">4</div>
                  <div className={styles.levelContent}>
                    <h4 className={styles.levelTitle}>
                      LEVEL 4 - ADVANCED MIXING &amp; MASTERING
                    </h4>
                    <p className={styles.levelSubtitle}>
                      <strong>Finish like a professional.</strong> Perfect your tracks with Ozone, Waves, and RX7.
                    </p>
                    <div className={styles.levelMetaRow}>
                      <span className={styles.levelLink}>Explore Level 4</span>
                      <span>3 + 1 months internship</span>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>
        ) : (
          /* DJ PANEL */
          <section id="panel-dj" className={styles.section} role="tabpanel" aria-labelledby="tab-dj">
            {/* Top Enrollment Callout Banner */}
            <div className={styles.enrollBottom} style={{ marginBottom: '24px' }}>
              <div>
                <h3 className={styles.enrollBottomTitle}>READY TO START YOUR MUSIC CAREER?</h3>
                <div className={styles.muted} style={{ marginTop: '4px' }}>
                  Pay ₹35,000 to reserve your seat. Flexible installments available.
                </div>
              </div>
              <div className={styles.actions}>
                <button type="button" onClick={() => navigateToRoute('/contact')} className={styles.btnPrimary}>
                  ENROLL NOW
                </button>
                <button type="button" onClick={() => navigateToRoute('/contact')} className={styles.btnOutline}>
                  CONTACT US
                </button>
              </div>
            </div>

            <div className={`${styles.section} ${styles.sectionNarrow}`}>
              <div className={styles.introCard}>
                <h2 className={styles.sectionTitle}>DJ TRAINING COURSES IN PUNE</h2>
                <p className={styles.sectionLead}>Learn to mix, perform and master the art of DJing with Soundabode.</p>
                <p className={styles.muted}>
                  Welcome to <strong>Soundabode</strong>, Pune's most advanced and performance driven DJ academy.
                </p>
              </div>
            </div>

            <div className={styles.sectionDivider} />

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>THE COMPLETE DJ LEARNING PATH</h3>

              <div className={styles.levelsGrid}>
                {/* DJ Level 1 */}
                <article
                  className={styles.levelCard}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToRoute('/courses/dj-training/basic-dj-course')}
                  onKeyDown={(e) => handleKeyDown(e, () => navigateToRoute('/courses/dj-training/basic-dj-course'))}
                >
                  <div className={styles.levelBadge} aria-hidden="true">1</div>
                  <div className={styles.levelContent}>
                    <h4 className={styles.levelTitle}>LEVEL 1 - BASIC DJ TRAINING COURSE</h4>
                    <p className={styles.levelSubtitle}>
                      <strong>Build your foundation in DJing:</strong> beatmatching, EQing, track structuring, and your first live set.
                    </p>
                    <div className={styles.levelMetaRow}>
                      <span className={styles.levelLink}>Explore Level 1</span>
                      <span>2 months · ₹35,000</span>
                    </div>
                  </div>
                </article>

                {/* DJ Level 2 */}
                <article
                  className={styles.levelCard}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToRoute('/courses/dj-training/pro-dj-course')}
                  onKeyDown={(e) => handleKeyDown(e, () => navigateToRoute('/courses/dj-training/pro-dj-course'))}
                >
                  <div className={styles.levelBadge} aria-hidden="true">2</div>
                  <div className={styles.levelContent}>
                    <h4 className={styles.levelTitle}>LEVEL 2 - PRO DJ TRAINING COURSE</h4>
                    <p className={styles.levelSubtitle}>
                      <strong>Advanced mixing, harmonic blending and digital DJ setups.</strong>
                    </p>
                    <div className={styles.levelMetaRow}>
                      <span className={styles.levelLink}>Explore Level 2</span>
                      <span>4 months · ₹60,000</span>
                    </div>
                  </div>
                </article>

                {/* DJ Level 3 */}
                <article
                  className={styles.levelCard}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigateToRoute('/courses/dj-training/advanced-dj-performance')}
                  onKeyDown={(e) => handleKeyDown(e, () => navigateToRoute('/courses/dj-training/advanced-dj-performance'))}
                >
                  <div className={styles.levelBadge} aria-hidden="true">3</div>
                  <div className={styles.levelContent}>
                    <h4 className={styles.levelTitle}>LEVEL 3 - PROFESSIONAL DJ / PERFORMANCE PATH</h4>
                    <p className={styles.levelSubtitle}>
                      <strong>Artist profile, mixtapes and gig strategy.</strong>
                    </p>
                    <div className={styles.levelMetaRow}>
                      <span className={styles.levelLink}>Explore Level 3</span>
                      <span>Mentored · Included</span>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </section>
        )}

        {/* TESTIMONIALS SECTION */}
        <section className={styles.testimonials} aria-label="Student testimonials">
          <h2 className={styles.testimonialsTitle}>WHAT THEY SAID</h2>

          <div className={styles.testimonialContainer} aria-live="polite">
            <div className={styles.testimonialBox}>
              <p className={styles.quote}>"{testimonials[activeTestimonial].quote}"</p>
              <h3 className={styles.author}>{testimonials[activeTestimonial].author}</h3>
              <p className={styles.role}>{testimonials[activeTestimonial].role}</p>
            </div>
          </div>

          <div className={styles.controls}>
            <button
              type="button"
              className={styles.controlBtn}
              onClick={handlePrevTestimonial}
              aria-label="Previous testimonial"
            >
              &#10094;
            </button>
            <div className={styles.dots} role="tablist" aria-label="Testimonial slides">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`${styles.dot} ${idx === activeTestimonial ? styles.dotActive : ''}`}
                  onClick={() => setActiveTestimonial(idx)}
                  aria-label={`Slide ${idx + 1} of ${testimonials.length}`}
                  aria-selected={idx === activeTestimonial}
                />
              ))}
            </div>
            <button
              type="button"
              className={styles.controlBtn}
              onClick={handleNextTestimonial}
              aria-label="Next testimonial"
            >
              &#10095;
            </button>
          </div>
        </section>

        <div className={styles.sectionDivider} />

        {/* WHY SOUNDABODE & TOOLS GRID */}
        <div className={styles.section}>
          <div className={styles.whyGrid}>
            <div className={styles.cardBlock}>
              <h3>
                {activeTab === 'dj'
                  ? 'WHY CHOOSE SOUNDABODE DJ ACADEMY'
                  : "WHY SOUNDABODE IS INDIA'S LEADING MUSIC PRODUCTION ACADEMY"}
              </h3>
              <ul>
                {activeTab === 'dj' ? (
                  <>
                    <li>
                      <strong>Train on Pioneer CDJs, Traktor &amp; Ableton Live</strong>
                    </li>
                    <li>
                      <strong>Unlimited studio practice with mentorship</strong>
                    </li>
                    <li>
                      <strong>Live club &amp; partner venue performances</strong>
                    </li>
                    <li>
                      <strong>Artist branding, EPK &amp; gig strategy</strong>
                    </li>
                    <li>
                      <strong>Guest masterclasses &amp; touring DJs</strong>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <strong>Professional Studio-Based Training</strong> - Every session takes place in a real, acoustically treated studio.
                    </li>
                    <li>
                      <strong>Certified Ableton and Industry Trainers</strong> - Learn directly from engineers, producers, and artists.
                    </li>
                    <li>
                      <strong>Hands-On Curriculum</strong> - Taught through live demos, assignments, and projects.
                    </li>
                    <li>
                      <strong>Internships and Industry Projects</strong> - Practical experience with real clients.
                    </li>
                    <li>
                      <strong>Global Exposure</strong> - Collaborate through LANDR, Splice, and alumni network.
                    </li>
                  </>
                )}
              </ul>
            </div>

            <div className={styles.cardBlock}>
              <h4>{activeTab === 'dj' ? 'TOOLS & TECHNOLOGY' : 'TOOLS & SOFTWARE YOU WILL TRAIN ON'}</h4>
              <div className={styles.toolsList}>
                {activeTab === 'dj' ? (
                  <>
                    <div className={styles.toolItem}>Pioneer CDJ-2000 / XDJ-XZ</div>
                    <div className={styles.toolItem}>DJM &amp; Allen &amp; Heath Mixers</div>
                    <div className={styles.toolItem}>Traktor &amp; Rekordbox</div>
                    <div className={styles.toolItem}>Ableton Live (Performance)</div>
                    <div className={styles.toolItem}>MIDI Controllers &amp; FX</div>
                    <div className={styles.toolItem}>Native Instruments Gear</div>
                  </>
                ) : (
                  <>
                    <div className={styles.toolItem}>Ableton Live 12 Suite</div>
                    <div className={styles.toolItem}>Kontakt &amp; Reaktor</div>
                    <div className={styles.toolItem}>Spectrasonics Omnisphere</div>
                    <div className={styles.toolItem}>Arturia V Collection</div>
                    <div className={styles.toolItem}>Moog &amp; Nord Synths</div>
                    <div className={styles.toolItem}>Ozone, RX7, Waves</div>
                    <div className={styles.toolItem}>SoundGym</div>
                    <div className={styles.toolItem}>Syntorial &amp; ISO Tools</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* WHO THIS COURSE IS FOR (DJ TRAINING ONLY) */}
        {activeTab === 'dj' && (
          <div className={styles.section}>
            <div className={styles.cardBlock} style={{ width: '100%' }}>
              <h3>WHO THIS COURSE IS FOR</h3>
              <ul>
                <li>Aspiring DJs &amp; club performers</li>
                <li>Music producers who want to perform live</li>
                <li>Event &amp; nightlife professionals</li>
                <li>Artists building a DJ brand</li>
              </ul>
            </div>
          </div>
        )}

        {/* COURSE STRUCTURE & DURATION */}
        <div className={styles.section} id="pricing">
          <h3 className={styles.sectionTitle}>
            {activeTab === 'dj' ? 'COURSE OPTIONS & DURATION' : 'COURSE STRUCTURE & DURATION'}
          </h3>
          <p className={styles.sectionSubtitle}>
            {activeTab === 'dj'
              ? 'Choose your training path according to your career goals and performance aspirations.'
              : 'Each level builds upon the last, creating a clear and complete path from beginner to professional.'}
          </p>

          <p style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1rem', textAlign: 'justify', textJustify: 'inter-word', maxWidth: '860px', marginLeft: 'auto', marginRight: 'auto' }}>
            {activeTab === 'dj' ? (
              <>
                DJ training course fees at Soundabode start at <strong>₹35,000</strong> for 2 months of intensive hands-on instruction. Flexible installment options available. All students train on industry-standard Pioneer CDJ setups with full studio practice privileges.
              </>
            ) : (
              <>
                Music production course fees at Soundabode start at <strong>₹35,000</strong> (seat deposit) with full course fees of <strong>₹60,000 per level</strong>. The Basic DJ Training course is available for <strong>₹35,000</strong> for 2 months. Flexible installment plans are available for all programs. Soundabode is Pune's most affordable certified audio engineering program with full studio access and internship included in every level.
              </>
            )}
          </p>

          <div className={styles.pricing}>
            <table className={styles.pricingTable} aria-label="Course fee schedule">
              <thead>
                <tr>
                  <th scope="col" className={styles.colLevel}>LEVEL</th>
                  <th scope="col" className={styles.colTitle}>COURSE</th>
                  <th scope="col" className={styles.colDuration}>DURATION</th>
                  <th scope="col" className={styles.colFee}>FEE</th>
                </tr>
              </thead>
              <tbody>
                {activeTab === 'dj' ? (
                  <>
                    <tr>
                      <td className={styles.colLevel}>1</td>
                      <td className={styles.colTitle}>Basic DJ Training</td>
                      <td className={styles.colDuration}>2 months</td>
                      <td className={styles.colFee}>₹35,000</td>
                    </tr>
                    <tr>
                      <td className={styles.colLevel}>2</td>
                      <td className={styles.colTitle}>Pro DJ Training</td>
                      <td className={styles.colDuration}>4 months</td>
                      <td className={styles.colFee}>₹60,000</td>
                    </tr>
                    <tr>
                      <td className={styles.colLevel}>3</td>
                      <td className={styles.colTitle}>Performance Path</td>
                      <td className={styles.colDuration}>Mentored</td>
                      <td className={styles.colFee}>Included</td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr>
                      <td className={styles.colLevel}>1</td>
                      <td className={styles.colTitle}>Beginner - Music Production / Audio Workstation</td>
                      <td className={styles.colDuration}>3 months</td>
                      <td className={styles.colFee}>₹60,000</td>
                    </tr>
                    <tr>
                      <td className={styles.colLevel}>2</td>
                      <td className={styles.colTitle}>Intermediate - Pre-Degree</td>
                      <td className={styles.colDuration}>3 months</td>
                      <td className={styles.colFee}>₹60,000</td>
                    </tr>
                    <tr>
                      <td className={styles.colLevel}>3</td>
                      <td className={styles.colTitle}>Expert - Diploma in Audio Engineering</td>
                      <td className={styles.colDuration}>3 months</td>
                      <td className={styles.colFee}>₹60,000</td>
                    </tr>
                    <tr>
                      <td className={styles.colLevel}>4</td>
                      <td className={styles.colTitle}>Advanced - Mixing &amp; Mastering</td>
                      <td className={styles.colDuration}>3 + 1 months internship</td>
                      <td className={styles.colFee}>₹60,000</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          <p className={styles.muted} style={{ marginTop: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <em>
              💳 Start with <strong>₹20,000</strong>. Easy installments available.
            </em>
          </p>
        </div>

        {/* DOWNLOAD BROCHURES & LOCATION */}
        <div className={styles.section}>
          <div className={styles.whyGrid}>
            <div className={styles.cardBlock}>
              <h4>DOWNLOAD COURSE BROCHURES</h4>
              <div className={styles.brochures}>
                <a href="mailto:services@soundabode.com?subject=Brochure Request" target="_blank" rel="noopener noreferrer">
                  {activeTab === 'dj' ? 'DJ Training Brochure' : 'Music Production & Audio Engineering Brochure'}
                </a>
              </div>
            </div>

            <div className={styles.cardBlock}>
              <h4>LOCATION &amp; CONTACT</h4>
              <div className={styles.muted} style={{ marginTop: '6px', fontSize: '13px', lineHeight: '1.6' }}>
                <strong style={{ color: '#ffffff' }}>Soundabode Academy</strong><br />
                Shop 218, 2nd Floor, Vision 9 Mall, Kunal Icon Road,<br />
                Pimple Saudagar, Pune 411017<br />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  997-501-6189
                </span><br />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  services@soundabode.com
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FREQUENTLY ASKED QUESTIONS */}
        <div className={`${styles.section} ${styles.faq}`} id="faq">
          <h3 className={styles.sectionTitle}>FREQUENTLY ASKED QUESTIONS</h3>

          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            const faqHeaderId = `faq-header-${idx}`;
            const faqBodyId = `faq-answer-${idx}`;

            return (
              <div key={idx} className={styles.faqItem}>
                <div
                  id={faqHeaderId}
                  className={styles.faqQuestion}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  aria-controls={faqBodyId}
                  onClick={() => toggleFaq(idx)}
                  onKeyDown={(e) => handleKeyDown(e, () => toggleFaq(idx))}
                >
                  <span>{faq.q}</span>
                  <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
                </div>
                {isOpen && (
                  <div id={faqBodyId} className={styles.faqAnswer} role="region" aria-labelledby={faqHeaderId}>
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* BOTTOM ENROLL CALLOUT */}
        <section className={styles.enrollBottom} aria-label="Course Enrollment Callout">
          <div>
            <h3 className={styles.enrollBottomTitle}>READY TO START YOUR MUSIC CAREER?</h3>
            <div className={styles.muted} style={{ marginTop: '4px' }}>
              Pay ₹35,000 to reserve your seat. Flexible installments available.
            </div>
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={() => navigateToRoute('/contact')} className={styles.btnPrimary}>
              ENROLL NOW
            </button>
            <button type="button" onClick={() => navigateToRoute('/contact')} className={styles.btnOutline}>
              CONTACT US
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CoursesPage;
