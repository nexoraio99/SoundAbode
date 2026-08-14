import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './QuickEnquiryModal.module.css';
import { InquiryService } from '../../services/inquiryService';

export interface QuickEnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCourse?: string;
}

const AVAILABLE_COURSES = [
  'DJ Training',
  'Music Production',
  'Audio Engineering',
];

export const QuickEnquiryModal: React.FC<QuickEnquiryModalProps> = ({
  isOpen,
  onClose,
  defaultCourse,
}) => {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string>(
    defaultCourse || AVAILABLE_COURSES[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [phoneErrorMsg, setPhoneErrorMsg] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setPhoneErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Please enter your Name *');
      return;
    }
    if (!phone.trim()) {
      setPhoneErrorMsg('Please enter your Contact Number *');
      return;
    }
    const phoneDigits = phone.trim().replace(/[\s\-\+\(\)]/g, '');
    if (!/^\d{7,15}$/.test(phoneDigits)) {
      setPhoneErrorMsg('Please enter a valid phone number (e.g. +91 9876543210)');
      return;
    }
    if (!selectedCourse) {
      setErrorMsg('Please select your Interested Course *');
      return;
    }

    setIsSubmitting(true);

    InquiryService.addInquiry({
      name: name.trim(),
      email: email.trim() || 'N/A',
      phone: phone.trim(),
      courseInterest: selectedCourse,
      message: `[Quick Pop-up Enquiry] Selected Course: ${selectedCourse}`,
      source: 'Pop-up Quick Enquiry Form',
    });

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 600);
  };

  const handleResetAndClose = () => {
    setName('');
    setEmail('');
    setPhone('');
    setSelectedCourse(defaultCourse || AVAILABLE_COURSES[0]);
    setIsSubmitted(false);
    setErrorMsg('');
    onClose();
  };

  return createPortal(
    <div className={styles.overlay} onClick={handleResetAndClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={handleResetAndClose}
          aria-label="Close enquiry modal"
        >
          &times;
        </button>

        {isSubmitted ? (
          <div className={styles.successBox}>
            <div className={styles.successIconCircle}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className={styles.successTitle}>Enquiry Submitted</h3>
            <p className={styles.successSubtext}>
              Thank you <strong>{name}</strong>! Our admissions team will contact you shortly on <strong>{phone}</strong> regarding <strong>{selectedCourse}</strong>.
            </p>
            <button type="button" className={styles.doneBtn} onClick={handleResetAndClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <div className={styles.modalHeader}>
              <div className={styles.brandRow}>
                <img src="/favicon-192x192.png" alt="Soundabode Logo" className={styles.logoImg} />
                <div>
                  <h2 className={styles.modalTitle}>Admissions Enquiry</h2>
                  <span className={styles.modalSubtext}>Soundabode Music &amp; DJ Academy</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              {errorMsg && <div className={styles.errorBox}>{errorMsg}</div>}

              {/* Field 1: Name* */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  NAME <span className={styles.reqStar}>*</span>
                </label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Your Full Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              {/* Field 2: Email (Optional) */}
              <div className={styles.formGroup}>
                <label className={styles.label}>EMAIL</label>
                <input
                  type="email"
                  className={styles.input}
                  placeholder="Email Address (Optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Field 3: Contact Number* */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  CONTACT NUMBER <span className={styles.reqStar}>*</span>
                </label>
                <input
                  type="tel"
                  className={styles.input}
                  placeholder="e.g. +91 9876543210 *"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setPhoneErrorMsg('');
                  }}
                  required
                />
                {phoneErrorMsg && (
                  <span style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.35rem', display: 'block', fontWeight: 500 }}>
                    {phoneErrorMsg}
                  </span>
                )}
              </div>

              {/* Field 4: Interested Courses* */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  INTERESTED COURSE <span className={styles.reqStar}>*</span>
                </label>
                <select
                  className={`${styles.input} ${styles.selectInput}`}
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select Course *
                  </option>
                  {AVAILABLE_COURSES.map((course) => (
                    <option key={course} value={course} className={styles.selectOption}>
                      {course}
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Enquiry'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default QuickEnquiryModal;
