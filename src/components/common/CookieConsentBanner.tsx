import React, { useState, useEffect } from 'react';
import styles from './CookieConsentBanner.module.css';

const STORAGE_KEY = 'sa_cookie_consent';

export const CookieConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'accepted' || saved === 'rejected') {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
    } catch {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted');
    } catch {
      // Ignore
    }
    setIsVisible(false);
  };

  const handleReject = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'rejected');
    } catch {
      // Ignore
    }
    setIsVisible(false);
  };

  const handleOpenBanner = () => {
    setIsVisible(true);
  };

  // Expose global window function for footer link trigger
  useEffect(() => {
    (window as unknown as { openCookieConsent?: () => void }).openCookieConsent = handleOpenBanner;
  }, []);

  if (!isVisible) return null;

  return (
    <div className={styles.cookieBanner} role="dialog" aria-label="Cookie consent">
      <div className={styles.cookieText}>
        <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
            <path d="M8.5 8.5v.01" />
            <path d="M16 15.5v.01" />
            <path d="M12 12v.01" />
            <path d="M11 17v.01" />
            <path d="M7 14v.01" />
          </svg>
          WE USE COOKIES
        </strong>
        <p>
          We use cookies to track ad performance and improve your experience. By clicking{' '}
          <em>Accept</em>, you consent to our use of cookies for analytics and advertising. See
          our <a href="#privacy">Privacy Policy</a>.
        </p>
      </div>
      <div className={styles.cookieActions}>
        <button onClick={handleReject} className={styles.rejectBtn} aria-label="Reject non-essential cookies">
          Reject
        </button>
        <button onClick={handleAccept} className={styles.acceptBtn} aria-label="Accept all cookies">
          Accept All
        </button>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
