import React from 'react';
import styles from './PolicyPage.module.css';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import SEO from '../../components/common/SEO';

export type PolicyType = 'terms' | 'privacy' | 'refund' | 'shipping';

interface PolicyPageProps {
  initialPolicy?: PolicyType;
  onNavigateHome?: () => void;
  onSelectPolicy?: (policy: PolicyType) => void;
}

export const PolicyPage: React.FC<PolicyPageProps> = ({
  initialPolicy = 'terms',
  onNavigateHome,
  onSelectPolicy,
}) => {
  const [activePolicy, setActivePolicy] = React.useState<PolicyType>(initialPolicy);

  React.useEffect(() => {
    setActivePolicy(initialPolicy);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [initialPolicy]);

  const handleTabChange = (policy: PolicyType) => {
    setActivePolicy(policy);
    const path =
      policy === 'terms'
        ? '/terms'
        : policy === 'privacy'
        ? '/privacy'
        : policy === 'refund'
        ? '/refund-policy'
        : '/shipping-policy';

    window.history.pushState({}, '', path);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (onSelectPolicy) {
      onSelectPolicy(policy);
    }
  };

  const policyTitles: Record<PolicyType, string> = {
    terms: 'Terms and Conditions | Soundabode Academy',
    privacy: 'Privacy Policy | Soundabode Academy',
    refund: 'Cancellation & Refund Policy | Soundabode Academy',
    shipping: 'Shipping & Delivery Policy | Soundabode Academy',
  };

  return (
    <div className={styles.pageWrapper}>
      <SEO
        title={policyTitles[activePolicy]}
        description={`Read the official ${activePolicy} policy documentation for Soundabode Music Production & DJ Academy in Pune.`}
        canonical={`https://soundabode.com/${activePolicy === 'terms' ? 'terms' : activePolicy === 'privacy' ? 'privacy' : activePolicy === 'refund' ? 'refund-policy' : 'shipping-policy'}`}
      />
      <Navbar
        onNavigate={(page) => {
          if (page !== 'policy' && onNavigateHome) {
            onNavigateHome();
          }
        }}
      />

      <main className={styles.mainContent}>
        {/* HERO / HEADER */}
        <header className={styles.headerSection}>
          <div className={styles.taglineRed}>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                if (onNavigateHome) onNavigateHome();
              }}
            >
              Home
            </a>
            <span>/</span>
            <span>Legal &amp; Policies</span>
          </div>

          <h1 className={styles.mainHeading}>
            {activePolicy === 'terms' && 'Terms and Conditions'}
            {activePolicy === 'privacy' && 'Privacy Policy'}
            {activePolicy === 'refund' && 'Refund & Cancellation Policy'}
            {activePolicy === 'shipping' && 'Shipping & Delivery Policy'}
          </h1>

          <div className={styles.metaRow}>
            <span className={styles.metaItem}>Last updated: August 1, 2026</span>
            <span className={styles.metaDot}>•</span>
            <span className={styles.metaItem}>Soundabode Music Academy</span>
          </div>
        </header>

        {/* TOP SUB-NAV STRIP (Mobile friendly & quick navigation) */}
        <div className={styles.topNavStrip} aria-label="Legal Documents Navigation">
          <button
            onClick={() => handleTabChange('terms')}
            className={`${styles.navTabBtn} ${activePolicy === 'terms' ? styles.navTabBtnActive : ''}`}
          >
            Terms &amp; Conditions
          </button>
          <button
            onClick={() => handleTabChange('privacy')}
            className={`${styles.navTabBtn} ${activePolicy === 'privacy' ? styles.navTabBtnActive : ''}`}
          >
            Privacy Policy
          </button>
          <button
            onClick={() => handleTabChange('refund')}
            className={`${styles.navTabBtn} ${activePolicy === 'refund' ? styles.navTabBtnActive : ''}`}
          >
            Refund &amp; Cancellation
          </button>
          <button
            onClick={() => handleTabChange('shipping')}
            className={`${styles.navTabBtn} ${activePolicy === 'shipping' ? styles.navTabBtnActive : ''}`}
          >
            Shipping &amp; Delivery
          </button>
        </div>

        {/* TWO-COLUMN EDITORIAL LAYOUT */}
        <div className={styles.layoutGrid}>
          {/* DESKTOP SIDEBAR */}
          <aside className={styles.sidebar}>
            <div>
              <div className={styles.sidebarGroupTitle}>Legal Documents</div>
              <ul className={styles.sidebarNavList}>
                <li>
                  <button
                    onClick={() => handleTabChange('terms')}
                    className={`${styles.sidebarLink} ${activePolicy === 'terms' ? styles.sidebarLinkActive : ''}`}
                  >
                    Terms &amp; Conditions
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleTabChange('privacy')}
                    className={`${styles.sidebarLink} ${activePolicy === 'privacy' ? styles.sidebarLinkActive : ''}`}
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleTabChange('refund')}
                    className={`${styles.sidebarLink} ${activePolicy === 'refund' ? styles.sidebarLinkActive : ''}`}
                  >
                    Refund &amp; Cancellation
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleTabChange('shipping')}
                    className={`${styles.sidebarLink} ${activePolicy === 'shipping' ? styles.sidebarLinkActive : ''}`}
                  >
                    Shipping &amp; Delivery
                  </button>
                </li>
              </ul>
            </div>
          </aside>

          {/* MAIN DOCUMENT TEXT CONTENT */}
          <article className={styles.documentBody}>
            {activePolicy === 'terms' && (
              <div>
                <p className={styles.introParagraph}>
                  Welcome to Soundabode (“Soundabode,” “we,” “us,” “our”). These Terms and Conditions govern your use of the website soundabode.com and any enrollment in our DJ training, music production, audio engineering diploma programs, or related courses (collectively, the “Services”). By accessing this website or enrolling in any Soundabode program, you agree to these Terms.
                </p>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>1. About Us</h2>
                  <p className={styles.sectionParagraph}>
                    Soundabode is a music education academy based in Pimple Saudagar, Pune, India, offering DJ training, music production, and audio engineering diploma programs, including pathway programs affiliated with KLM Chennai and Berklee.
                  </p>

                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Entity Name</span>
                      <p className={styles.infoValue}>Soundabode Academy</p>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Studio Address</span>
                      <p className={styles.infoValue}>Vision 9, 2nd Floor, Kunal Icon Rd, Pimple Saudagar, Pune 411017</p>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Contact Email</span>
                      <p className={styles.infoValue}>
                        <a href="mailto:services@soundabode.com">services@soundabode.com</a>
                      </p>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Contact Phone</span>
                      <p className={styles.infoValue}>
                        <a href="tel:+919975016189">+91 99750 16189</a>
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>2. Eligibility</h2>
                  <p className={styles.sectionParagraph}>
                    Our courses are open to individuals who meet the minimum age and educational eligibility criteria specified for each program. Some programs require completion of Class 12 or equivalent. Enrollment on behalf of a minor requires parent or guardian consent.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>3. Enrollment and Fees</h2>
                  <ul className={styles.styledList}>
                    <li className={styles.styledListItem}>Course fees are as listed on soundabode.com or as communicated to you in writing at the time of enrollment.</li>
                    <li className={styles.styledListItem}>Enrollment is confirmed only upon receipt of full or partial payment as specified for that program.</li>
                    <li className={styles.styledListItem}>Fees may be paid via the payment gateway integrated on our website (Razorpay) or through other methods we specify.</li>
                    <li className={styles.styledListItem}>Course fees are subject to change without prior notice; changes will not affect learners already enrolled at a previously confirmed fee.</li>
                  </ul>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>4. Course Access and Delivery</h2>
                  <p className={styles.sectionParagraph}>
                    Depending on the program, instruction may be delivered in-person at our Pune facility, online, or in a hybrid format. Access details, schedules, and platform information will be shared after enrollment is confirmed. See our{' '}
                    <a href="/shipping-policy" onClick={(e) => { e.preventDefault(); handleTabChange('shipping'); }}>
                      Shipping and Delivery Policy
                    </a>{' '}
                    for details on how course access is provided.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>5. Code of Conduct</h2>
                  <p className={styles.sectionParagraph}>
                    Learners are expected to conduct themselves respectfully toward faculty, staff, and fellow learners. Soundabode reserves the right to suspend or terminate access for any learner who violates studio rules, engages in harassment, or disrupts the learning environment, without refund.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>6. Intellectual Property</h2>
                  <p className={styles.sectionParagraph}>
                    All course materials, curriculum content, recordings, and branding provided by Soundabode are the intellectual property of Soundabode (or its licensors, including affiliated institutions) and may not be copied, redistributed, resold, or used for commercial purposes without written permission.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>7. Equipment and Studio Use</h2>
                  <p className={styles.sectionParagraph}>
                    Learners using Soundabode’s studio equipment must do so responsibly. Any damage caused by misuse or negligence may be charged to the learner.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>8. Limitation of Liability</h2>
                  <p className={styles.sectionParagraph}>
                    Soundabode makes reasonable efforts to ensure course quality and accuracy of information but does not guarantee specific career outcomes, job placement, or certification recognition beyond what is explicitly stated for a given program. To the extent permitted by law, Soundabode is not liable for indirect or consequential losses arising from use of our Services.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>9. Third-Party Payment Processing</h2>
                  <p className={styles.sectionParagraph}>
                    Payments made through our website are processed via Razorpay and/or other licensed payment gateways. Soundabode does not store your card or payment credentials; these are handled directly by our payment gateway partner in accordance with their own security standards and policies.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>10. Refunds and Cancellations</h2>
                  <p className={styles.sectionParagraph}>
                    Refunds and cancellations are governed by our separate{' '}
                    <a href="/refund-policy" onClick={(e) => { e.preventDefault(); handleTabChange('refund'); }}>
                      Refund and Cancellation Policy
                    </a>.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>11. Changes to These Terms</h2>
                  <p className={styles.sectionParagraph}>
                    We may update these Terms from time to time. Continued use of the website or enrollment in a program after changes are posted constitutes acceptance of the revised Terms.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>12. Governing Law</h2>
                  <p className={styles.sectionParagraph}>
                    These Terms are governed by the laws of India, and any disputes will be subject to the exclusive jurisdiction of the courts in Pune, Maharashtra.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>13. Contact Us</h2>
                  <p className={styles.sectionParagraph}>
                    For any questions about these Terms, contact us at{' '}
                    <a href="mailto:services@soundabode.com">services@soundabode.com</a> or{' '}
                    <a href="tel:+919975016189">+91 99750 16189</a>.
                  </p>
                </div>
              </div>
            )}

            {activePolicy === 'privacy' && (
              <div>
                <p className={styles.introParagraph}>
                  Soundabode (“we,” “us,” “our”) respects your privacy and is committed to protecting the personal information you share with us through soundabode.com and during enrollment in our courses. This Privacy Policy explains what information we collect, how we use it, and your rights regarding it.
                </p>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>1. Information We Collect</h2>
                  <p className={styles.sectionParagraph}>
                    When you use our website, submit an enquiry, or enroll in a course, we may collect:
                  </p>
                  <ul className={styles.styledList}>
                    <li className={styles.styledListItem}><strong>Personal details:</strong> name, email address, phone number, date of birth, address.</li>
                    <li className={styles.styledListItem}><strong>Enrollment details:</strong> course selected, educational background, payment status.</li>
                    <li className={styles.styledListItem}><strong>Payment information:</strong> processed directly by our payment gateway (Razorpay); we do not store full card numbers or banking credentials on our servers.</li>
                    <li className={styles.styledListItem}><strong>Technical data:</strong> IP address, browser type, device information, and website usage data collected via cookies or analytics tools (e.g., Google Analytics, Meta Pixel).</li>
                  </ul>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>2. How We Use Your Information</h2>
                  <p className={styles.sectionParagraph}>We use the information we collect to:</p>
                  <ul className={styles.styledList}>
                    <li className={styles.styledListItem}>Process enrollments and payments.</li>
                    <li className={styles.styledListItem}>Communicate with you about your course, schedule, and academy updates.</li>
                    <li className={styles.styledListItem}>Respond to enquiries submitted via WhatsApp, contact forms, or lead forms.</li>
                    <li className={styles.styledListItem}>Improve our website, courses, and marketing (including Meta and Google Ads targeting).</li>
                    <li className={styles.styledListItem}>Comply with legal and regulatory requirements.</li>
                  </ul>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>3. Sharing of Information</h2>
                  <p className={styles.sectionParagraph}>We do not sell your personal information. We may share information with:</p>
                  <ul className={styles.styledList}>
                    <li className={styles.styledListItem}><strong>Payment processors:</strong> (e.g., Razorpay) to complete transactions.</li>
                    <li className={styles.styledListItem}><strong>Affiliated institutions:</strong> (e.g., KLM Chennai, Berklee pathway partners) where relevant to your enrollment in a pathway program.</li>
                    <li className={styles.styledListItem}><strong>Service providers:</strong> who support our website, communications, or marketing operations, under confidentiality obligations.</li>
                    <li className={styles.styledListItem}><strong>Legal authorities:</strong> where required by law.</li>
                  </ul>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>4. Cookies</h2>
                  <p className={styles.sectionParagraph}>
                    Our website may use cookies and similar tracking technologies to improve user experience and measure advertising performance. You can control cookie preferences through your browser settings.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>5. Data Security</h2>
                  <p className={styles.sectionParagraph}>
                    We take reasonable technical and organizational measures to protect your personal data against unauthorized access, loss, or misuse. However, no method of transmission over the internet is completely secure, and we cannot guarantee absolute security.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>6. Data Retention</h2>
                  <p className={styles.sectionParagraph}>
                    We retain personal information for as long as necessary to fulfill the purposes described in this policy, including maintaining enrollment records and complying with legal obligations.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>7. Your Rights</h2>
                  <p className={styles.sectionParagraph}>You may request to:</p>
                  <ul className={styles.styledList}>
                    <li className={styles.styledListItem}>Access the personal information we hold about you.</li>
                    <li className={styles.styledListItem}>Correct inaccurate information.</li>
                    <li className={styles.styledListItem}>Request deletion of your information, subject to our legal and record-keeping obligations.</li>
                  </ul>
                  <p className={styles.sectionParagraph}>
                    To exercise these rights, contact us at <a href="mailto:services@soundabode.com">services@soundabode.com</a>.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>8. Children’s Privacy</h2>
                  <p className={styles.sectionParagraph}>
                    Where a learner is a minor, we collect information only with parent or guardian consent as part of the enrollment process.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>9. Changes to This Policy</h2>
                  <p className={styles.sectionParagraph}>
                    We may update this Privacy Policy periodically. The “Last updated” date at the top reflects the most recent revision.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>10. Contact Us</h2>
                  <p className={styles.sectionParagraph}>
                    For privacy-related questions or requests, contact us at{' '}
                    <a href="mailto:services@soundabode.com">services@soundabode.com</a> or{' '}
                    <a href="tel:+919975016189">+91 99750 16189</a>.
                  </p>
                </div>
              </div>
            )}

            {activePolicy === 'refund' && (
              <div>
                <p className={styles.introParagraph}>
                  This policy explains how course cancellations and refund requests are handled for programs enrolled through soundabode.com.
                </p>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>1. Enrollment Confirmation</h2>
                  <p className={styles.sectionParagraph}>
                    Enrollment in a Soundabode program is confirmed once the required fee (in full or as a registration deposit, depending on the program) is received. A confirmation of enrollment will be sent via email or WhatsApp.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>2. Cancellation by the Learner</h2>
                  <ul className={styles.styledList}>
                    <li className={styles.styledListItem}>
                      <strong>Before the course start date:</strong> Learners who cancel at least 7 days before the course start date are eligible for a refund of fees paid, excluding any non-refundable registration or processing fee.
                    </li>
                    <li className={styles.styledListItem}>
                      <strong>Within 7 days of the course start date:</strong> Cancellations made closer to the start date are eligible for a partial refund or credit toward a future batch, at Soundabode’s discretion.
                    </li>
                    <li className={styles.styledListItem}>
                      <strong>After the course has started:</strong> Once classes have commenced and the learner has accessed course content or studio sessions, fees paid are non-refundable, except where required by law.
                    </li>
                  </ul>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>3. Cancellation or Rescheduling by Soundabode</h2>
                  <p className={styles.sectionParagraph}>
                    If Soundabode cancels or reschedules a batch due to insufficient enrollment, faculty unavailability, or other circumstances, learners will be offered the choice of:
                  </p>
                  <ul className={styles.styledList}>
                    <li className={styles.styledListItem}>A full refund of fees paid for that batch, or</li>
                    <li className={styles.styledListItem}>Transfer to the next available batch at no additional cost.</li>
                  </ul>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>4. Non-Refundable Items</h2>
                  <p className={styles.sectionParagraph}>
                    Registration fees, processing fees, and any charges explicitly marked as non-refundable at the time of enrollment are not eligible for refund under any circumstances.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>5. How to Request a Refund</h2>
                  <p className={styles.sectionParagraph}>
                    To request a cancellation or refund, email <a href="mailto:services@soundabode.com">services@soundabode.com</a> with your name, course enrolled, and payment reference (order ID/transaction ID from Razorpay). Requests are reviewed and processed within 5–7 business days.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>6. Refund Processing Time</h2>
                  <p className={styles.sectionParagraph}>
                    Approved refunds are processed to the original payment method via Razorpay within 5–7 business days of approval. Actual credit to your account may take additional time depending on your bank or card issuer.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>7. Payment Disputes</h2>
                  <p className={styles.sectionParagraph}>
                    For any payment-related issues such as failed transactions or duplicate charges, you may also contact Razorpay support directly, in addition to reaching out to us.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>8. Contact Us</h2>
                  <p className={styles.sectionParagraph}>
                    For questions about this policy, contact us at{' '}
                    <a href="mailto:services@soundabode.com">services@soundabode.com</a> or{' '}
                    <a href="tel:+919975016189">+91 99750 16189</a>.
                  </p>
                </div>
              </div>
            )}

            {activePolicy === 'shipping' && (
              <div>
                <p className={styles.introParagraph}>
                  Soundabode primarily offers educational services — DJ training, music production, and audio engineering diploma programs — delivered in-person at our Pune studio, online, or in a hybrid format. As such, this policy describes how course access and any related materials are delivered, rather than physical shipping.
                </p>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>1. No Physical Shipment for Course Enrollment</h2>
                  <p className={styles.sectionParagraph}>
                    Enrollment in a Soundabode program does not involve shipping of physical goods. Upon successful payment confirmation, access to your course is delivered electronically and/or confirmed for in-person attendance, as applicable to your program.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>2. Delivery of Course Access</h2>
                  <ul className={styles.styledList}>
                    <li className={styles.styledListItem}>
                      <strong>In-person/studio programs:</strong> Once payment is confirmed, you will receive a confirmation via email/WhatsApp with your batch schedule, studio address (Pimple Saudagar, Pune), and orientation details, typically within 24–48 hours of payment.
                    </li>
                    <li className={styles.styledListItem}>
                      <strong>Online or hybrid programs:</strong> You will receive login credentials or access links to our learning platform within 24 hours of successful payment confirmation.
                    </li>
                    <li className={styles.styledListItem}>
                      If you do not receive your confirmation or access details within the stated timeframe, please check your spam/junk folder before contacting us.
                    </li>
                  </ul>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>3. Physical Materials (If Applicable)</h2>
                  <p className={styles.sectionParagraph}>
                    If a specific program includes physical materials (e.g., printed certificates, merchandise, or course kits), these will be delivered to the address provided at enrollment via courier or in-person handover, and estimated delivery timelines will be communicated separately for that item.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>4. Delays</h2>
                  <p className={styles.sectionParagraph}>
                    While we aim to deliver access and confirmations promptly, delays may occasionally occur due to technical issues or high enrollment volume. We will notify you if any significant delay is expected.
                  </p>
                </div>

                <div className={styles.sectionBlock}>
                  <h2 className={styles.sectionHeading}>5. Contact Us</h2>
                  <p className={styles.sectionParagraph}>
                    For questions about accessing your course or program materials, contact us at{' '}
                    <a href="mailto:services@soundabode.com">services@soundabode.com</a> or{' '}
                    <a href="tel:+919975016189">+91 99750 16189</a>.
                  </p>
                </div>
              </div>
            )}
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PolicyPage;
