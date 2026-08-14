import React from 'react';
import styles from './AboutPage.module.css';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import SEO from '../../components/common/SEO';

export interface AboutPageProps {
  onNavigateHome?: () => void;
}

const aboutSchema = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'About Soundabode | Music Production & DJ Academy India',
  url: 'https://soundabode.com/about',
  description:
    'Learn at our electronic music school India. Soundabode is a premier audio engineering school and music producer course online provider for rising artists.',
  mainEntity: {
    '@type': 'EducationalOrganization',
    name: 'Soundabode',
    url: 'https://soundabode.com/',
    logo: 'https://soundabode.com/Assets/og-soundabode-cover.jpg',
    description:
      'Soundabode is India’s most practical academy for Music Production, DJing & Audio Engineering with industry-grade studios and real-world training.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Shop No. 218, 2nd Floor, Vision 9 Mall, Kunal Icon Road, Pimple Saudagar',
      addressLocality: 'Pune',
      addressRegion: 'Maharashtra',
      postalCode: '411017',
      addressCountry: 'IN',
    },
    sameAs: [
      'https://www.instagram.com/soundabode',
      'https://www.facebook.com/soundabode',
      'https://www.youtube.com/@soundabode',
    ],
    knowsAbout: [
      'Music Production',
      'Electronic Music',
      'Techno Production',
      'Psytrance Production',
      'Hip-Hop Beat Making',
      'House & EDM Production',
      'DJ Training',
      'Audio Engineering',
      'Mixing & Mastering',
      'Film Scoring',
      'Game Audio Design',
      'Sound Engineering',
      'Electronic Music Production',
    ],
    founder: {
      '@type': 'Person',
      name: 'Abhinav Agarwal',
      jobTitle: 'Founder & Music Producer',
    },
  },
};

interface TeamMember {
  name: string;
  role: string;
  badge: string;
  bio: string;
  image: string;
  skills: string[];
  objectPosition?: string;
}

const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'Abhinav',
    role: 'Founder & Lead Music Production Mentor',
    badge: 'Founder',
    bio: 'Pioneer in electronic music education in Pune with over 10+ years of studio experience. Passionate about empowering artists to craft unique sonic signatures without cookie-cutter formulas.',
    image: 'https://raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/IMG_1400.JPG',
    objectPosition: 'center 15%',
    skills: ['Ableton Live 12', 'Studio Architecture', 'Track Arrangement'],
  },
  {
    name: 'Vaibhav',
    role: 'Lead DJ Training & Performance Mentor',
    badge: 'Lead DJ Instructor',
    bio: 'Veteran performance DJ skilled across analog vinyl, Traktor Pro, and flagship Pioneer CDJ-3000 decks. Focuses on ear matching, bar-to-bar phrasing, and high-energy stage presence.',
    image: 'https://raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/Vaibhav.JPG',
    objectPosition: 'center 85%',
    skills: ['Beat Matching', 'Pioneer Rekordbox', 'Live Performance'],
  },
  {
    name: 'Ashutosh',
    role: 'Senior Audio Engineering & Sound Design Mentor',
    badge: 'Audio Engineering Mentor',
    bio: 'Audio engineering and sound design specialist with deep expertise in analog synthesis, vocal production, and commercial mixing & mastering pipelines.',
    image: 'https://wsrv.nl/?url=raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/IMG_7935.HEIC',
    skills: ['Sound Design', 'Mixing & Mastering', 'Hardware Synths'],
  },
];

interface AchievementItem {
  title: string;
  badge: string;
  description: string;
}

const STUDENT_ACHIEVEMENTS: AchievementItem[] = [
  {
    title: 'OTT Scoring',
    badge: 'OTT Platforms',
    description: '16-year old prodigies crafting background scores for major OTT streaming platforms.',
  },
  {
    title: 'Game Soundtracks',
    badge: 'Gaming',
    description: 'Epic soundtracks and audio design for popular iOS and Android mobile games.',
  },
  {
    title: 'Professional Mixing',
    badge: 'Record Labels',
    description: 'Mixing & mastering projects for international record labels and renowned electronic artists.',
  },
  {
    title: 'Ad & Film Scores',
    badge: 'Commercials',
    description: 'Ad and short film background scores that captivate audiences and drive brand sales.',
  },
  {
    title: 'Audio Restoration',
    badge: 'Remastering',
    description: 'Audio restoration & remastering that resurrect vintage and damaged tracks like magic.',
  },
  {
    title: 'Live Sound',
    badge: 'Events',
    description: 'Corporate events & high-capacity society shows powered by pro-level live sound engineering.',
  },
  {
    title: 'Voice Production',
    badge: 'Voiceover',
    description: 'Voiceovers & audiobooks produced with pristine clarity that hook listeners from start to finish.',
  },
];

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigateHome }) => {
  return (
    <div className={styles.pageContainer}>
      <SEO
        title="Best Music Production School India | About Soundabode Pune"
        description="Meet the mentors at Soundabode India. Premier audio engineering school and music producer course online provider for rising artists."
        keywords="Soundabode, Music Production Academy Pune, DJ School India, Audio Engineering Courses, EDM Production Classes, Film Scoring India, Ableton Live Training"
        canonical="https://soundabode.com/about"
        schema={aboutSchema}
      />
      <Navbar
        activePage="about"
        onNavigate={(page) => {
          if (page !== 'about' && onNavigateHome) {
            onNavigateHome();
          }
        }}
      />

      <main className={styles.mainContainer} role="main">
        {/* HERO HEADER SECTION */}
        <section aria-label="About Soundabode Header" className={styles.aboutHeader}>
          <div className={styles.taglineRed}>About Soundabode</div>
          <h1 className={styles.mainHeading}>Hands-On Music Production &amp; DJ Academy</h1>
          <p className={styles.heroSubtext}>
            Founded by working producers and performance artists, Soundabode provides intensive, studio-focused mentorship in Pune. We equip aspiring producers, sound designers, and DJs with the technical skills and hardware mastery needed to craft professional audio.
          </p>
        </section>

        {/* SECTION 2: OUR STORY */}
        <section className={styles.storyGrid} aria-label="Our Story">
          <div className={styles.storyVisualCard}>
            <img
              src="https://raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/0_g0NOIUGhP8tiTPq4.jpg"
              alt="Soundabode Recording Studio Setup"
              className={styles.storyImg}
              loading="eager"
            />
          </div>

          <div className={styles.storyContent}>
            <div className={styles.taglineRed}>Our Origin</div>
            <h2 className={styles.sectionHeading}>Built for Modern Electronic Creators</h2>
            <p className={styles.paragraphText}>
              Established in 2019 in Pune, Soundabode was created to fill a major gap in traditional audio education. Classical programs often emphasize theory while treating modern digital production and stage performance as secondary. We designed an immersive workspace tailored specifically for electronic creators.
            </p>
            <p className={styles.paragraphText}>
              Our practical curriculum guides students from foundational acoustics to advanced synthesis, track arrangement, mixing, and stage performance across genres like Techno, Psytrance, Hip-Hop, House, and Ambient soundscapes.
            </p>
          </div>
        </section>

        {/* SECTION 3: FOUR PILLARS OF AUDIO EDUCATION */}
        <section className={styles.pillarsSection} aria-label="Four Pillars of Audio Education">
          <div className={styles.taglineRed}>Methodology</div>
          <h2 className={styles.sectionHeading}>Our Core Mentorship Pillars</h2>
          <p className={styles.sectionLeadText}>
            We emphasize active creation, critical ear training, and direct hardware interaction over passive lectures.
          </p>

          <div className={styles.pillarsGrid}>
            <div className={styles.pillarCard}>
              <div className={styles.pillarNumber}>01</div>
              <h3 className={styles.pillarTitle}>Hands-On Studio Workflow</h3>
              <p className={styles.pillarBody}>
                Students build tracks from day one. Theoretical concepts in synthesis, EQ, and dynamics are immediately applied in calibrated studio environments.
              </p>
            </div>

            <div className={styles.pillarCard}>
              <div className={styles.pillarNumber}>02</div>
              <h3 className={styles.pillarTitle}>Small-Batch Mentorship</h3>
              <p className={styles.pillarBody}>
                Classes are intentionally capped to ensure personalized 1-on-1 feedback, track critique, and genre-specific guidance for every student.
              </p>
            </div>

            <div className={styles.pillarCard}>
              <div className={styles.pillarNumber}>03</div>
              <h3 className={styles.pillarTitle}>Industry Standard Hardware</h3>
              <p className={styles.pillarBody}>
                Train on flagship Pioneer CDJs, Ableton Live 12, analog synthesis hardware, and high-fidelity acoustic monitoring systems.
              </p>
            </div>

            <div className={styles.pillarCard}>
              <div className={styles.pillarNumber}>04</div>
              <h3 className={styles.pillarTitle}>Music Business &amp; Distribution</h3>
              <p className={styles.pillarBody}>
                Learn how to register track copyrights, pitch to record labels, self-distribute on streaming platforms, and secure venue bookings.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 4: STUDENT OUTCOMES */}
        <section className={styles.achievementsSection} aria-label="Student Outcomes">
          <div className={styles.taglineRed}>Student Achievements</div>
          <h2 className={styles.sectionHeading}>Real-World Industry Outcomes</h2>
          <p className={styles.sectionLeadText}>
            Our alumni apply their studio skills across music production, live performance, and commercial sound:
          </p>

          <div className={styles.achievementsGrid}>
            {STUDENT_ACHIEVEMENTS.map((item) => (
              <div key={item.title} className={styles.achievementCard}>
                <div className={styles.achievementHeader}>
                  <h3 className={styles.achievementTitle}>{item.title}</h3>
                  <span className={styles.achievementBadge}>{item.badge}</span>
                </div>
                <p className={styles.achievementText}>{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 5: OUR SPACE */}
        <section className={styles.spaceSection} aria-label="Our Space Purpose Built For Sound">
          <div className={styles.spaceGrid}>
            <div className={styles.spaceTextCol}>
              <div className={styles.taglineRed}>Studio &amp; Acoustics</div>
              <h2 className={styles.sectionHeading}>Purpose-Built Studio Environment</h2>
              <p className={styles.paragraphText}>
                Precision monitoring and treated acoustics are vital for producing professional mixes. Our production suites feature acoustic treatment designed for linear frequency response, hardware synths, Arturia and Korg controllers, dynamic microphones, and studio monitors from Yamaha and KRK.
              </p>
              <p className={styles.paragraphText}>
                For DJ performance training, our dedicated setup features club-standard Pioneer CDJ decks and mixers. Students gain muscle memory on physical gear, Rekordbox database prep, and bar-phrasing techniques.
              </p>
            </div>

            <div className={styles.spaceVisualWrapper}>
              <img
                src="https://wsrv.nl/?url=raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/IMG_8958.HEIC"
                alt="Pioneer CDJ DJ Decks and Studio Suite at Soundabode"
                className={styles.spaceBannerImg}
              />
            </div>
          </div>
        </section>

        {/* SECTION 6: MENTORS */}
        <section className={styles.teamSectionWrapper} aria-label="Meet Our Instructors">
          <div className={styles.taglineRedCenter}>Instructors</div>
          <h2 className={styles.teamHeading}>Meet Our Mentors</h2>
          <p className={styles.teamSubtitle}>
            Active producers and performance DJs committed to your creative and technical development.
          </p>

          <div className={styles.teamGrid2Col}>
            {TEAM_MEMBERS.map((member) => (
              <article key={member.name} className={styles.teamMemberCard}>
                <div className={styles.memberImgBox}>
                  <img
                    src={member.image}
                    alt={`${member.name} - ${member.role}`}
                    className={styles.memberPhoto}
                    style={member.objectPosition ? { objectPosition: member.objectPosition } : undefined}
                    loading="lazy"
                  />
                  <div className={styles.memberBadge}>{member.badge}</div>
                </div>

                <div className={styles.memberContent}>
                  <h3 className={styles.memberName}>{member.name}</h3>
                  <div className={styles.memberRole}>{member.role}</div>
                  <p className={styles.memberBio}>{member.bio}</p>

                  <div className={styles.skillPillsRow}>
                    {member.skills.map((skill) => (
                      <span key={skill} className={styles.skillPillDark}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* SECTION 7: CLOSING CALLOUT */}
        <section className={styles.closingCalloutBox} aria-label="Soundabode Callout">
          <h2 className={styles.closingQuote}>
            Ready to Take Your Sound to the Next Level?
          </h2>
          <p className={styles.paragraphText} style={{ color: '#94a3b8', marginBottom: '1.5rem', textAlign: 'center' }}>
            Join our upcoming music production or DJ cohort in Pune and master studio-grade workflows.
          </p>

          <ul className={styles.closingBullets}>
            <li>Train on professional studio hardware &amp; DAWs</li>
            <li>Receive 1-on-1 project critiques from active mentors</li>
            <li>Build a portfolio of release-ready tracks &amp; DJ mixes</li>
          </ul>

          <a
            href="/courses"
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, '', '/courses');
              window.dispatchEvent(new Event('popstate'));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={styles.closingCtaBtn}
          >
            Explore Courses &amp; Programs
          </a>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AboutPage;
