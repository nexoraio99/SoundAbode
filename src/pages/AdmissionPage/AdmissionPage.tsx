import React, { useState } from 'react';
import styles from './AdmissionPage.module.css';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import SEO from '../../components/common/SEO';
import { AdmissionService, AdmissionSubmission } from '../../services/admissionService';
import { DJ_COURSES, EMP_COURSES, DJ_DISCLAIMER, EMP_DISCLAIMER } from '../../constants/admissionConstants';

interface AdmissionPageProps {
  formType: 'DJ' | 'EMP';
  onNavigateHome?: () => void;
}

export const AdmissionPage: React.FC<AdmissionPageProps> = ({ formType, onNavigateHome }) => {
  const currentCourses = formType === 'DJ' ? DJ_COURSES : EMP_COURSES;
  const currentDisclaimer = formType === 'DJ' ? DJ_DISCLAIMER : EMP_DISCLAIMER;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [cellPhone, setCellPhone] = useState('');
  const [workPhone, setWorkPhone] = useState('');
  const [email, setEmail] = useState('');
  const [aadharNo, setAadharNo] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [address, setAddress] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(currentCourses[0].id);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [paymentOption, setPaymentOption] = useState<'Full Payment' | '2 Easy Instalments'>('Full Payment');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedAdmission, setSubmittedAdmission] = useState<AdmissionSubmission | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const photoInputRef = React.useRef<HTMLInputElement | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select an image file (JPG, PNG, WEBP) for the photo.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Photo file size should be less than 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const rawDataUrl = evt.target?.result as string;
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.88);
          setPhotoUrl(compressed);
        } else {
          setPhotoUrl(rawDataUrl);
        }
      };
      img.onerror = () => {
        setPhotoUrl(rawDataUrl);
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const selectedCourseObj = currentCourses.find((c) => c.id === selectedCourseId) || currentCourses[0];
  const activeFormNo = AdmissionService.getNextFormNumber(formType);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const idParam = params.get('id');
      const formNoParam = params.get('formNo');

      if (idParam) {
        const found = AdmissionService.getAdmissionById(idParam);
        if (found) setSubmittedAdmission(found);
      } else if (formNoParam) {
        const found = AdmissionService.getAdmissionByFormNo(formNoParam);
        if (found) setSubmittedAdmission(found);
      }
    }
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage('Please enter Trainee First Name and Last Name.');
      return;
    }
    if (!cellPhone.trim() || !email.trim()) {
      setErrorMessage('Please provide a valid Cell Phone and Email address.');
      return;
    }
    if (!fatherName.trim() || !address.trim() || !aadharNo.trim()) {
      setErrorMessage("Please complete Father's Name, Aadhar/ID No, and Address details.");
      return;
    }
    if (!agreedToTerms) {
      setErrorMessage('You must agree to the SoundAbode Studios terms & conditions.');
      return;
    }

    setIsSubmitting(true);

    try {
      const submission = AdmissionService.submitAdmissionForm({
        formType,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        cellPhone: cellPhone.trim(),
        workPhone: workPhone.trim(),
        email: email.trim(),
        aadharNo: aadharNo.trim(),
        fatherName: fatherName.trim(),
        address: address.trim(),
        courseOpted: selectedCourseObj.name,
        tenure: selectedCourseObj.tenure,
        fee: selectedCourseObj.fee,
        paymentOption,
        agreedToTerms: true,
        signatureName: signatureName.trim() || `${firstName.trim()} ${lastName.trim()}`,
        photoUrl: photoUrl || undefined,
      });

      setSubmittedAdmission(submission);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setErrorMessage('Failed to submit admission form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };



  const admissionSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${formType === 'DJ' ? 'DJ Training' : 'Music Production'} Admission & Enrolment Agreement`,
    description:
      'Official enrolment agreement and admission form for Soundabode DJ & Music Production Academy in Pune.',
    url: `https://soundabode.com/admission-${formType.toLowerCase()}`,
    publisher: {
      '@type': 'EducationalOrganization',
      name: 'Soundabode Academy',
      url: 'https://soundabode.com',
    },
  };

  return (
    <div className={styles.pageWrapper}>
      <SEO
        title={`${formType === 'DJ' ? 'DJ Training' : 'Music Production'} Admission Form & Agreement | Soundabode`}
        description="Official DJ & Music Production Enrolment Agreement & Admission Form for Soundabode Pune. Select your course level, review terms, and submit your enrolment agreement."
        keywords={`Soundabode Admission, ${formType} Course Enrolment, Music School Registration, Soundabode Pune`}
        canonical={`https://soundabode.com/admission-${formType.toLowerCase()}`}
        schema={admissionSchema}
      />
      <Navbar />

      {/* Hero Header Banner */}
      <section className={styles.heroHeader}>
        <div className={styles.headerContainer}>
          <a
            href="/"
            className={styles.backLink}
            onClick={(e) => {
              if (onNavigateHome) {
                e.preventDefault();
                onNavigateHome();
              }
            }}
          >
            &larr; Back to Home
          </a>

          <div className={styles.headerTopRow}>
            <h1 className={styles.pageTitle}>
              {formType === 'DJ' ? 'DJ Training' : 'EMP Production'} Admission Form
            </h1>
            <span className={styles.formBadge}>{activeFormNo}</span>
          </div>

          <p className={styles.headerSubtext}>
            Official SoundAbode Studios admission application form for {formType === 'DJ' ? 'Disk Jockey Performance & Mixing' : 'Electronic Music Production & Audio Engineering'}.
          </p>
        </div>
      </section>

      {/* Main Form Container */}
      <main className={styles.mainContainer}>
        {submittedAdmission ? (
          <div className={styles.successBox}>
            <h2 className={styles.successTitle}>Admission Form Filed Successfully</h2>
            <p className={styles.successSubtext}>
              Applicant: <strong>{submittedAdmission.firstName} {submittedAdmission.lastName}</strong> | Course: <strong>{submittedAdmission.courseOpted}</strong> ({submittedAdmission.fee}) | Payment: <strong>{submittedAdmission.paymentOption || 'Full Payment'}</strong>
            </p>
            <div className={styles.refCode}>Form Reference: {submittedAdmission.formNo}</div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>

              <button
                type="button"
                className={styles.printBtn}
                onClick={() => {
                  const shareUrl = `${window.location.origin}/admission-${submittedAdmission.formType.toLowerCase()}?id=${submittedAdmission.id}`;
                  navigator.clipboard.writeText(shareUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 3000);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                {copiedLink ? 'Link Copied!' : 'Copy Shareable Link'}
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Soundabode Studios Official Admission Form (${submittedAdmission.formNo})\nStudent: ${submittedAdmission.firstName} ${submittedAdmission.lastName}\nCourse: ${submittedAdmission.courseOpted}\nView Form: ${window.location.origin}/admission-${submittedAdmission.formType.toLowerCase()}?id=${submittedAdmission.id}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.printBtn}
                style={{ textDecoration: 'none' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Share on WhatsApp
              </a>

              <button
                type="button"
                className={styles.submitBtn}
                onClick={() => {
                  if (onNavigateHome) onNavigateHome();
                  else window.location.href = '/';
                }}
              >
                Return to Home
              </button>
            </div>
          </div>
        ) : (
          <form id="pageAdmissionForm" onSubmit={handleFormSubmit}>
            {errorMessage && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '0.75rem 1rem',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  marginBottom: '1.25rem',
                  fontWeight: 600,
                }}
              >
                {errorMessage}
              </div>
            )}

            {/* Authentic Printable Document Paper View */}
            <div className={styles.formDocument}>
              {/* Header with Official SoundAbode Logo */}
              <div className={styles.docHeader}>
                <div className={styles.docBrandHeader}>
                  <img
                    src="/favicon-192x192.png"
                    alt="SoundAbode Logo"
                    className={styles.docLogoImg}
                  />
                  <div>
                    <h2 className={styles.docTitleH2}>Training Form</h2>
                    <span className={styles.docCourseSubtitle}>
                      {formType === 'DJ' ? 'Disk Jockey Training Course' : 'Electronic Music Production'}
                    </span>
                    <div className={styles.docFormNoSub}>Form No. {activeFormNo}</div>
                  </div>
                </div>
                <div className={styles.docHeaderRight}>

                  {/* PASSPORT PHOTO 1.5in x 2in UPLOAD FRAME */}
                  <input
                    type="file"
                    ref={photoInputRef}
                    accept="image/*"
                    onChange={handlePhotoChange}
                    style={{ display: 'none' }}
                  />
                  <div
                    className={`${styles.passportPhotoWrapper} ${styles.passportPhotoWrapperUploadable}`}
                    onClick={() => photoInputRef.current?.click()}
                    title="Click to upload applicant passport photo (1.5in x 2in)"
                  >
                    {photoUrl ? (
                      <>
                        <img src={photoUrl} alt="Applicant Photo" className={styles.passportPhotoImg} />
                        <button
                          type="button"
                          className={styles.passportPhotoRemoveBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoUrl('');
                          }}
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <div className={styles.passportPhotoPlaceholder}>
                        <svg className={styles.passportPhotoIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                        <span className={styles.passportPhotoLabel}>Upload Photo</span>
                        <span className={styles.passportPhotoSub}>1.5" × 2" Size</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Trainee Info Section Bar */}
              <div className={styles.sectionHeaderBar}>Trainee Info</div>

              <div className={styles.fieldGrid}>
                <div className={styles.formGroup}>
                  <label>
                    First Name <span className={styles.reqStar}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>
                    Last Name <span className={styles.reqStar}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>
                    Cell Phone <span className={styles.reqStar}>*</span>
                  </label>
                  <input
                    type="tel"
                    className={styles.formInput}
                    placeholder="Cell Phone Number"
                    value={cellPhone}
                    onChange={(e) => setCellPhone(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Work Phone</label>
                  <input
                    type="tel"
                    className={styles.formInput}
                    placeholder="Work Phone (Optional)"
                    value={workPhone}
                    onChange={(e) => setWorkPhone(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>
                    Email <span className={styles.reqStar}>*</span>
                  </label>
                  <input
                    type="email"
                    className={styles.formInput}
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>
                    Aadhar / ID Proof No. <span className={styles.reqStar}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="Government Aadhar / ID No."
                    value={aadharNo}
                    onChange={(e) => setAadharNo(e.target.value)}
                    required
                  />
                </div>

                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label>
                    Father's Name <span className={styles.reqStar}>*</span>
                  </label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="Father's Full Name"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    required
                  />
                </div>

                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label>
                    Address / ID Proof Details <span className={styles.reqStar}>*</span>
                  </label>
                  <textarea
                    className={`${styles.formInput} ${styles.formTextarea}`}
                    placeholder="Full Residential Address and ID Proof details..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Course Opting For Section Bar */}
              <div className={styles.sectionHeaderBar}>Course Opting For</div>

              <div className={styles.tableResponsive}>
                <table className={styles.courseTable}>
                  <thead>
                    <tr>
                      <th className={styles.colSelect}>Select</th>
                      <th>Course Option</th>
                      <th className={styles.colTenure}>Tenure</th>
                      <th className={styles.colFee}>Fee Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentCourses.map((c) => {
                      const isSelected = c.id === selectedCourseId;
                      return (
                        <tr
                          key={c.id}
                          className={`${styles.courseTableRow} ${isSelected ? styles.selectedRow : ''
                            }`}
                          onClick={() => setSelectedCourseId(c.id)}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <div className={styles.checkboxSquare}>
                              {isSelected ? (
                                <span className={styles.checkedMarkText}>✓</span>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <strong>{c.name}</strong>
                            {isSelected && (
                              <span className={styles.selectedBadgePrint}> (SELECTED)</span>
                            )}
                          </td>
                          <td>{c.tenure}</td>
                          <td>
                            <strong>{c.fee}</strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Disclaimer & Rules */}
              <div className={styles.sectionHeaderBar} style={{ marginTop: '1.5rem' }}>
                Disclaimer &amp; Studio Rules
              </div>

              <ol className={styles.disclaimerList}>
                {currentDisclaimer.map((rule, idx) => (
                  <li key={idx}>{rule}</li>
                ))}
              </ol>

              {/* Agreement Clause */}
              <div className={styles.agreementBox}>
                <p className={styles.agreementParagraph}>
                  I <strong>{firstName || '____________________'} {lastName || ''}</strong> hereby agree with the terms and conditions laid down by SoundAbode Studios for <strong>{selectedCourseObj.name}</strong> and therefore paying in:
                </p>

                <div className={styles.paymentToggleGroup}>
                  <button
                    type="button"
                    className={`${styles.paymentToggleOption} ${paymentOption === 'Full Payment' ? styles.paymentToggleActive : ''}`}
                    onClick={() => setPaymentOption('Full Payment')}
                  >
                    <span className={styles.toggleRadioIcon}>
                      {paymentOption === 'Full Payment' ? '✓' : ''}
                    </span>
                    <span>Full Payment</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.paymentToggleOption} ${paymentOption === '2 Easy Instalments' ? styles.paymentToggleActive : ''}`}
                    onClick={() => setPaymentOption('2 Easy Instalments')}
                  >
                    <span className={styles.toggleRadioIcon}>
                      {paymentOption === '2 Easy Instalments' ? '✓' : ''}
                    </span>
                    <span>2 Easy Instalments</span>
                  </button>
                </div>

                <div className={styles.fieldGrid} style={{ marginBottom: '0.85rem' }}>
                  <div className={styles.formGroup}>
                    <label style={{ fontSize: '0.78rem' }}>
                      Student Signature (Typed Name) <span className={styles.reqStar}>*</span>
                    </label>
                    <input
                      type="text"
                      className={styles.formInput}
                      placeholder="Type Full Legal Name"
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <label className={styles.agreedLabel}>
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    required
                  />
                  I confirm that I have read and agree to abide by all the terms, conditions, and studio rules laid down by SoundAbode Studios.
                </label>
              </div>

              {/* Document Footer Branding */}
              <div className={styles.docFooterBranding}>
                <div className={styles.addressText}>
                  <strong>VISION 9 MALL, SHOP 218</strong>, PIMPLE SAUDAGAR, PUNE – 411017<br />
                  PH: 9975016189 | EMAIL: SERVICES@SOUNDABODE.COM | WWW.SOUNDABODE.COM
                </div>
              </div>
            </div>

            {/* Page Form Actions */}
            <div className={styles.formActionsBar}>
              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Admission Form'}
              </button>
            </div>
          </form>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default AdmissionPage;
