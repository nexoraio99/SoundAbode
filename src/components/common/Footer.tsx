import React from 'react';
import styles from './Footer.module.css';

export const Footer: React.FC = () => {
  const handleOpenCookieConsent = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof (window as unknown as { openCookieConsent?: () => void }).openCookieConsent === 'function') {
      (window as unknown as { openCookieConsent: () => void }).openCookieConsent();
    }
  };

  return (
    <footer className={styles.siteFooter}>
      <div className={styles.footerContainer}>
        {/* Main Footer Columns */}
        <div className={styles.footerColumns}>
          {/* Column 1: Brand */}
          <div className={`${styles.footerColumn} ${styles.brandColumn}`}>
            <h3 className={styles.footerLogo}>SOUNDABODE</h3>
            <p className={styles.footerTagline}>
              Professional Music Production &amp;<br />
              DJ Training Institute
            </p>
            <p className={styles.footerAddress}>
              Vision 9, 2nd Floor, Kunal Icon Rd,<br />
              Pimple Saudagar, Pune 411017
            </p>
          </div>

          {/* Column 2: Courses */}
          <div className={styles.footerColumn}>
            <h4>COURSES</h4>
            <ul>
              <li><a href="/courses?tab=emp">Music Production</a></li>
              <li><a href="/courses?tab=dj">DJ Performance</a></li>
              <li><a href="/courses/music-production/audio-engineering-diploma">Sound Engineering</a></li>
            </ul>
          </div>

          {/* Column 3: Admissions */}
          <div className={styles.footerColumn}>
            <h4>ADMISSIONS</h4>
            <ul>
              <li>
                <a href="/admission-dj">DJ Admission Form</a>
              </li>
              <li>
                <a href="/admission-emp">EMP Admission Form</a>
              </li>
              <li>
                <a href="/contact">Inquire Batch Dates</a>
              </li>
            </ul>
          </div>

          {/* Column 4: Quick Links */}
          <div className={styles.footerColumn}>
            <h4>QUICK LINKS</h4>
            <ul>
              <li><a href="/about">About</a></li>
              <li><a href="/contact">Contact</a></li>
              <li><a href="/blog">Blog</a></li>
              <li><a href="/try-now">Try Now</a></li>
              <li>
                <a href="https://razorpay.me/@soundabode" target="_blank" rel="noopener noreferrer">
                  Make Payment
                </a>
              </li>
            </ul>
          </div>

          {/* Column 5: Stay In Touch */}
          <div className={styles.footerColumn}>
            <h4>STAY IN TOUCH</h4>
            <ul className={styles.socialLinksText}>
              <li>
                <a href="https://www.instagram.com/soundabode" target="_blank" rel="noopener noreferrer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                  <span>Instagram</span>
                </a>
              </li>
              <li>
                <a href="https://www.youtube.com/@soundabode" target="_blank" rel="noopener noreferrer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
                    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
                  </svg>
                  <span>YouTube</span>
                </a>
              </li>
              <li>
                <a href="https://www.facebook.com/soundabode" target="_blank" rel="noopener noreferrer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                  </svg>
                  <span>Facebook</span>
                </a>
              </li>
              <li>
                <a href="https://wa.me/919975016189" target="_blank" rel="noopener noreferrer">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                  <span>WhatsApp</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Sub-footer Bottom Bar */}
        <div className={styles.footerBottom}>
          <p className={styles.copyright}>Copyright &copy; 2026 SoundAbode. All rights reserved.</p>
          <div className={styles.legalLinks}>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms &amp; Conditions</a>
            <a href="/refund-policy">Refund Policy</a>
            <a href="/shipping-policy">Shipping Policy</a>
            <button onClick={handleOpenCookieConsent} className={styles.cookieLinkBtn}>
              Cookie Consent
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
