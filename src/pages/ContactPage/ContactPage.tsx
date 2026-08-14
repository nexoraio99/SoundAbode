import React, { useState } from 'react';
import styles from './ContactPage.module.css';
import Footer from '../../components/common/Footer';
import Navbar from '../../components/common/Navbar';
import SEO from '../../components/common/SEO';
import { InquiryService } from '../../services/inquiryService';

interface ContactPageProps {
  onNavigateHome?: () => void;
}

const contactSchema = {
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  name: 'Contact Soundabode | Best Music Production School India',
  description:
    'Contact our audio engineering school in Pune. Join the top DJ academy in India to learn music production and DJing. Book your free studio demo now.',
  url: 'https://soundabode.com/contact',
  mainEntity: {
    '@type': 'LocalBusiness',
    name: 'Soundabode Music Production & DJ Academy',
    telephone: '+919975016189',
    email: 'services@soundabode.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Shop 218, Vision 9 Mall, 2nd Floor, Kunal Icon Road',
      addressLocality: 'Pimple Saudagar',
      addressRegion: 'Maharashtra',
      postalCode: '411017',
      addressCountry: 'IN',
    },
  },
};

export const ContactPage: React.FC<ContactPageProps> = ({ onNavigateHome }) => {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    course: '',
    message: '',
  });

  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [phoneErrorMsg, setPhoneErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setPhoneErrorMsg('');

    const phoneDigits = formData.phone.trim().replace(/[\s\-\+\(\)]/g, '');
    if (!/^\d{7,15}$/.test(phoneDigits)) {
      setPhoneErrorMsg('Please enter a valid phone number (e.g. +91 9876543210)');
      return;
    }

    setIsSubmitting(true);
    
    // Save to InquiryService for real-time reflection in CMS Admin & Google Sheets
    InquiryService.addInquiry({
      name: formData.fullName || 'Anonymous Prospect',
      email: formData.email,
      phone: formData.phone,
      courseInterest: formData.course || 'General Admission Inquiry',
      message: formData.message,
      source: 'Contact Form',
    });

    setTimeout(() => {
      setIsSubmitting(false);
      setFormSubmitted(true);
    }, 600);
  };

  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const faqData = [
    {
      question: '1. Can I visit the Soundabode studio before enrolling?',
      answer:
        'Absolutely! We strongly encourage all prospective students to schedule a free personal demo session. You will be able to tour our acoustic-treated production suites, test our Pioneer CDJ setups, meet our certified mentors, and inspect our range of hardware synthesizers and analog processors.',
    },
    {
      question: '2. Who will conduct my personal studio tour?',
      answer:
        'Your demo and consultation will be led directly by one of our certified instructors or active touring DJs. This allows us to understand your specific musical goals, evaluate your current technical background, and recommend the best learning track for you.',
    },
    {
      question: '3. What are the timings of the academy?',
      answer:
        'Our studio operates from 11:00 AM to 9:00 PM throughout the week. We offer highly flexible class batches - including weekend slots and late-evening sessions - to accommodate students, working professionals, and independent creators.',
    },
    {
      question: '4. Are online courses available?',
      answer:
        'Yes! For students residing outside Pune, we offer live, interactive online batches for electronic music production and sound engineering. These courses feature the exact same certified modules and direct feedback pipelines as our offline studio classes.',
    },
  ];

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className={styles.pageContainer}>
      <SEO
        title="Contact Soundabode | DJ & Sound Engineering School Pune"
        description="Contact our audio engineering school in Pune. Join the top DJ academy in India to learn music production and DJing. Book your free studio demo now."
        keywords="Soundabode contact, DJ academy Pune, music production courses, audio engineering classes, Soundabode Pune, Soundabode contact number, music school Pune"
        canonical="https://soundabode.com/contact"
        schema={contactSchema}
      />
      <Navbar
        activePage="contact"
        onNavigate={(page) => {
          if (page !== 'contact' && onNavigateHome) {
            onNavigateHome();
          }
        }}
      />

      {/* Hero Title Section */}
      <section className={styles.heroSection}>
        <h1 className={styles.mainTitle}>CONNECT WITH US</h1>
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.95rem', maxWidth: '600px', margin: '-0.75rem auto 0 auto', lineHeight: '1.6' }}>
          Have questions or ready to schedule your free personal studio demo? Fill out the contact form below or reach us directly.
        </p>
      </section>

      {/* TOP SECTION: Split Contact Info & GET IN TOUCH Form */}
      <section className={styles.sectionContainer} id="contact-form" style={{ paddingTop: '0.5rem' }}>
        <div className={styles.contactSplitGrid}>
          {/* Left Column: Contact Metadata & Map */}
          <div className={styles.contactInfoCol}>
            <div className={styles.infoBlock}>
              <span className={styles.infoLabel}>EMAIL</span>
              <a href="mailto:services@soundabode.com" className={styles.infoValue} style={{ textDecoration: 'none' }}>
                services@soundabode.com
              </a>
            </div>

            <div className={styles.infoBlock}>
              <span className={styles.infoLabel}>PHONE</span>
              <a href="tel:+919975016189" className={styles.infoValue} style={{ textDecoration: 'none' }}>
                +91 997 501 6189
              </a>
            </div>

            <div className={styles.infoBlock}>
              <span className={styles.infoLabel}>LOCATION</span>
              <div className={styles.infoValue}>
                VISION 9, 2nd FLOOR<br />
                PIMPLE SAUDAGAR, PUNE<br />
                411017
              </div>
            </div>

            {/* Google Map Card */}
            <div className={styles.mapCardContainer}>
              <div className={styles.mapFrameWrapper}>
                <iframe
                  title="Soundabode Academy Location"
                  className={styles.mapFrame}
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3781.564757106437!2d73.7915433!3d18.5936746!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2b91807d4653f%3A0xb35a092b7fb25f19!2sVision%209%20Mall%2C%20Pimple%20Saudagar%2C%20Pune%2C%20Maharashtra%20411027!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin"
                  loading="lazy"
                  allowFullScreen
                />
              </div>
              <a
                href="https://share.google/8e2sFu7cKTcqs37B7"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.mapLink}
              >
                Open in Google Maps &rarr;
              </a>
            </div>
          </div>

          {/* Right Column: Inquiry Form Card */}
          <div className={styles.formCard}>
            <h2 className={styles.formHeader}>
              GET IN <span className={styles.textTouch}>TOUCH</span>
            </h2>

            {formSubmitted ? (
              <div className={styles.thankYouCard}>
                <div className={styles.successIconBadge}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className={styles.thankYouTitle}>INQUIRY RECEIVED</h3>
                <p className={styles.thankYouSubtext}>
                  Thank you for connecting with Soundabode. Our admissions team will review your request and get in touch within 24 hours.
                </p>
                <button
                  onClick={() => setFormSubmitted(false)}
                  className={styles.resetBtn}
                >
                  Send Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.contactForm}>
                {errorMessage && (
                  <div style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>
                    {errorMessage}
                  </div>
                )}
                <div className={styles.formGroup}>
                  <label htmlFor="fullName" className={styles.fieldLabel}>FULL NAME</label>
                  <input
                    type="text"
                    id="fullName"
                    required
                    placeholder="e.g. Rahul Sharma"
                    className={styles.inputField}
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="phone" className={styles.fieldLabel}>PHONE NUMBER</label>
                  <input
                    type="tel"
                    id="phone"
                    required
                    placeholder="e.g. +91 9876543210"
                    className={styles.inputField}
                    value={formData.phone}
                    onChange={(e) => {
                      setFormData({ ...formData, phone: e.target.value });
                      setPhoneErrorMsg('');
                    }}
                  />
                  {phoneErrorMsg && (
                    <span style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.35rem', display: 'block', fontWeight: 500 }}>
                      {phoneErrorMsg}
                    </span>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="email" className={styles.fieldLabel}>EMAIL</label>
                  <input
                    type="email"
                    id="email"
                    required
                    placeholder="rahul@example.com"
                    className={styles.inputField}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="course" className={styles.fieldLabel}>COURSE</label>
                  <select
                    id="course"
                    required
                    className={styles.selectField}
                    value={formData.course}
                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                  >
                    <option value="">Select a Course</option>
                    <option value="DJ Training">DJ Training</option>
                    <option value="Music Production">Music Production</option>
                    <option value="Audio Engineering">Audio Engineering</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="message" className={styles.fieldLabel}>MESSAGE (OPTIONAL)</label>
                  <textarea
                    id="message"
                    rows={4}
                    placeholder="Tell us about your musical experience and goals..."
                    className={styles.textareaField}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  />
                </div>

                <button type="submit" disabled={isSubmitting} className={styles.submitBtn}>
                  {isSubmitting ? 'Sending...' : 'Send Message →'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      {/* Introductory Context Cards Section */}
      <section className={styles.sectionContainer} style={{ paddingTop: '1rem', paddingBottom: '1rem' }}>
        <div className={styles.introCardsGrid}>
          <div className={styles.introCard}>
            Ready to take your musical skills to the next level? Whether you are looking to enroll in our certified Ableton Live music production courses, want to step behind Pioneer CDJ decks in our professional DJ training studio, or have custom inquiries about audio engineering and background scoring, the Soundabode Academy team is here to guide your journey.
          </div>
          <div className={`${styles.introCard} ${styles.introCardHighlighted}`}>
            Simply fill out the inquiry form above, and our admissions advisor will reach out to you within 24 hours to answer your questions, walk you through our curriculum modules, and schedule your free, hands-on personal demo session at our Pimple Saudagar studio in Pune. Additionally, we offer customized programs for corporate groups, independent content creators, and private masterclass batches. Let us build your signature sound together.
          </div>
        </div>
      </section>

      {/* HOW ENROLLMENT WORKS Section */}
      <section className={styles.sectionContainer}>
        <h2 className={styles.sectionTitle}>HOW ENROLLMENT WORKS</h2>

        <div className={styles.stepsGrid}>
          <div className={styles.stepCard}>
            <h3 className={styles.stepTitle}>Step 1: Enquire</h3>
            <p className={styles.stepDesc}>
              Fill out the contact form specifying your course preference, or call our admissions advisor directly at +91 997 501 6189 to discuss initial details.
            </p>
          </div>

          <div className={styles.stepCard}>
            <h3 className={styles.stepTitle}>Step 2: Studio Demo</h3>
            <p className={styles.stepDesc}>
              Schedule a visit. Tour our premium acoustic rooms, test Pioneer DJ gear and Ableton controllers, and sit down for personalized counseling.
            </p>
          </div>

          <div className={styles.stepCard}>
            <h3 className={styles.stepTitle}>Step 3: Custom Setup</h3>
            <p className={styles.stepDesc}>
              Select your custom batch schedule (weekday, weekend, or online slots) and customize your curriculum path based on your favorite music genre preferences.
            </p>
          </div>

          <div className={styles.stepCard}>
            <h3 className={styles.stepTitle}>Step 4: Launch</h3>
            <p className={styles.stepDesc}>
              Complete registration, get access to our private community channels and sample libraries, and begin your first practical studio module session.
            </p>
          </div>
        </div>
      </section>

      <div className={styles.divider} />

      {/* Section: ENROLLMENT & STUDIO VISIT FAQ */}
      <section className={styles.sectionContainer}>
        <h2 className={styles.sectionTitle}>STUDIO VISIT FAQ</h2>

        <div className={styles.faqAccordionContainer}>
          {faqData.map((item, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div
                key={index}
                className={`${styles.faqItem} ${isOpen ? styles.faqItemOpen : ''}`}
              >
                <button
                  type="button"
                  className={styles.faqHeader}
                  onClick={() => toggleFaq(index)}
                  aria-expanded={isOpen}
                >
                  <span>{item.question}</span>
                  <div className={styles.faqIcon}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>
                <div className={styles.faqBody}>
                  <p className={styles.faqAnswer}>{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default ContactPage;
