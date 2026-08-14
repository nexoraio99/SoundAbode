import React, { useState } from 'react';
import styles from './FaqSection.module.css';

export interface FaqItemData {
  number: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItemData[] = [
  {
    number: '01',
    question: 'What is the best music production school in Pune?',
    answer:
      'Soundabode is Pune\'s most comprehensive music production school, offering a 4-level certified program from beginner to professional on Ableton Live 12. Students train in a fully equipped, acoustically treated studio in Pimple Saudagar, with real studio projects, internships, and placement support.',
  },
  {
    number: '02',
    question: 'Which is the top DJ academy in India for beginners?',
    answer:
      'Soundabode is recognized as one of India\'s top DJ academies, offering structured DJ training at Basic and Pro levels on industry-standard Pioneer CDJs, Rekordbox, and Traktor. Based in Pune with online DJ courses available across India, Soundabode trains beginners from zero to performance-ready.',
  },
  {
    number: '03',
    question: 'Can I learn music production online in India from Soundabode?',
    answer:
      'Yes. Soundabode offers both online and offline modes for all music producer courses. Students across India can join live online sessions for music production, audio engineering, and DJ training without relocating to Pune.',
  },
  {
    number: '04',
    question: 'What does a certified DJ course at Soundabode include?',
    answer:
      'Soundabode\'s certified DJ course covers beatmatching, EQing, track selection, harmonic blending, Rekordbox workflow, and live performance technique. Level 1 runs for 2 months (₹35,000) and Level 2 for 4 months (₹60,000). Students train exclusively on Pioneer CDJs and mixers.',
  },
  {
    number: '05',
    question: 'What is the fee for a music production course in Pune?',
    answer:
      'Soundabode\'s music production course fees are ₹60,000 per level, with 4 levels available. Students can begin with a seat deposit of ₹35,000 and pay the balance in flexible installments. Each level includes a 1-month studio internship.',
  },
  {
    number: '06',
    question: 'Is Soundabode a certified audio engineering school in India?',
    answer:
      'Yes. Soundabode is a certified audio engineering school in Pune offering a structured Diploma in Audio Engineering across 4 levels. Students graduate with a recognized certification in music production, sound engineering, and audio engineering - valid across India.',
  },
  {
    number: '07',
    question: 'Does Soundabode teach electronic music production in India?',
    answer:
      'Yes. Soundabode specializes in Techno, Psytrance, House, Drum & Bass, Dubstep, Hip-Hop, and EDM production using Ableton Live and professional hardware. Students learn genre-specific sound design, arrangement, and mixing from working producers.',
  },
  {
    number: '08',
    question: 'What is the difference between the Basic and Pro DJ courses at Soundabode?',
    answer:
      'The Basic DJ Training course (2 months, ₹35,000) covers DJ fundamentals - beatmatching, EQing, track structure, and your first live set on Pioneer CDJs. The Pro DJ Training course (4 months, ₹60,000) goes deeper into advanced mixing, harmonic blending, digital DJ setups, artist branding, and gig strategy.',
  },
  {
    number: '09',
    question: 'Does Soundabode offer placement support after the course?',
    answer:
      'Yes. Soundabode provides placement support through its venue network, artist branding guidance, and real gig opportunities at partner clubs and events across Pune. Music production students benefit from internships with real client projects.',
  },
  {
    number: '10',
    question: 'Can classically trained musicians join Soundabode\'s music production school?',
    answer:
      'Absolutely. Soundabode\'s music production school is designed for musicians of all backgrounds - including classically trained artists who want to set up their own studio, produce original compositions, or score for film, web series, and games.',
  },
  {
    number: '11',
    question: 'Where is Soundabode\'s DJ academy located in Pune?',
    answer:
      'Soundabode\'s DJ academy and music production school is located at Vision 9, 2nd Floor, Kunal Icon Road, Pimple Saudagar, Pune 411017. The studio is easily accessible from Wakad, Baner, Hinjewadi, and central Pune.',
  },
  {
    number: '12',
    question: 'Which genres can I learn at Soundabode\'s electronic music school?',
    answer:
      'Soundabode covers Techno, Psytrance, Progressive, House, Tech House, Drum & Bass, Dubstep, Hip-Hop, Trap, EDM, and Underground electronic genres. Students are encouraged to explore outside their comfort zone through genre rotations.',
  },
];

export const FaqSection: React.FC = () => {
  const [openIndices, setOpenIndices] = useState<number[]>([0]);
  const [showAll, setShowAll] = useState(false);

  const toggleItem = (index: number) => {
    setOpenIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const visibleItems = showAll ? FAQ_ITEMS : FAQ_ITEMS.slice(0, 6);

  return (
    <section className={styles.faqSectionWrapper} aria-label="Frequently Asked Questions">
      <div className={styles.faqContainer}>
        {/* Left Column: Heading & Contact Info */}
        <div className={styles.faqLeftCol}>
          <div className={styles.taglineRed}>GOT QUESTIONS?</div>
          <h2 className={styles.faqHeading}>
            FREQUENTLY ASKED <span className={styles.accentRed}>QUESTIONS</span>
          </h2>
          <p className={styles.faqSubtext}>
            Find answers to common questions about our DJ training, music production courses, studio hardware, and certification programs.
          </p>

          <div className={styles.contactCtaCard}>
            <h3 className={styles.ctaCardTitle}>Need direct guidance?</h3>
            <p className={styles.ctaCardText}>
              Speak directly with our lead mentors or book a free personal studio tour in Pune.
            </p>
            <a
              href="/contact"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/contact');
                window.dispatchEvent(new Event('popstate'));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={styles.ctaBtn}
            >
              Talk to a Mentor →
            </a>
          </div>
        </div>

        {/* Right Column: Accordion List */}
        <div className={styles.faqRightCol}>
          <div className={styles.faqList}>
            {visibleItems.map((item, idx) => {
              const isOpen = openIndices.includes(idx);
              return (
                <div
                  key={idx}
                  className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ''}`}
                >
                  <button
                    onClick={() => toggleItem(idx)}
                    className={styles.faqHead}
                    aria-expanded={isOpen}
                  >
                    <span className={styles.faqNumber}>{item.number}</span>
                    <span className={styles.faqTitle}>{item.question}</span>
                    <span className={styles.faqIcon}>+</span>
                  </button>

                  {isOpen && (
                    <div className={styles.faqBody}>
                      <p>{item.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setShowAll(!showAll)}
            className={styles.showMoreBtn}
          >
            {showAll ? 'Show Fewer Questions ↑' : `Show All ${FAQ_ITEMS.length} Questions (${FAQ_ITEMS.length - 6} More) ↓`}
          </button>
        </div>
      </div>
    </section>
  );
};

export default FaqSection;
