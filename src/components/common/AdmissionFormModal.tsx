import React, { useState, useEffect } from 'react';
import styles from './AdmissionFormModal.module.css';
import { AdmissionService, AdmissionSubmission } from '../../services/admissionService';
import { DJ_COURSES, EMP_COURSES, DJ_DISCLAIMER, EMP_DISCLAIMER } from '../../constants/admissionConstants';

interface AdmissionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormType?: 'DJ' | 'EMP';
}



export const AdmissionFormModal: React.FC<AdmissionFormModalProps> = ({
  isOpen,
  onClose,
  initialFormType = 'DJ',
}) => {
  const [formType, setFormType] = useState<'DJ' | 'EMP'>(initialFormType);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [cellPhone, setCellPhone] = useState('');
  const [workPhone, setWorkPhone] = useState('');
  const [email, setEmail] = useState('');
  const [aadharNo, setAadharNo] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [address, setAddress] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [paymentOption, setPaymentOption] = useState<'Full Payment' | '2 Easy Instalments'>('Full Payment');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedAdmission, setSubmittedAdmission] = useState<AdmissionSubmission | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const photoInputRef = React.useRef<HTMLInputElement | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select an image file (JPG, PNG, WEBP) for the photo.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Photo file size should be less than 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const res = evt.target?.result as string;
      if (res) setPhotoUrl(res);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    setFormType(initialFormType);
  }, [initialFormType]);

  useEffect(() => {
    const courses = formType === 'DJ' ? DJ_COURSES : EMP_COURSES;
    if (courses.length > 0) {
      setSelectedCourseId(courses[0].id);
    }
  }, [formType]);

  const [activeFormNo, setActiveFormNo] = useState<string>('');

  useEffect(() => {
    // Sync with remote admissions and calculate sequence for current series
    AdmissionService.getAllAdmissions();
    setActiveFormNo(AdmissionService.getNextFormNumber(formType));

    const unsubscribe = AdmissionService.subscribe(() => {
      setActiveFormNo(AdmissionService.getNextFormNumber(formType));
    });

    return () => unsubscribe();
  }, [formType]);

  if (!isOpen) return null;

  const currentCourses = formType === 'DJ' ? DJ_COURSES : EMP_COURSES;
  const currentDisclaimer = formType === 'DJ' ? DJ_DISCLAIMER : EMP_DISCLAIMER;
  const selectedCourseObj = currentCourses.find((c) => c.id === selectedCourseId) || currentCourses[0];
  const [cellPhoneErrorMsg, setCellPhoneErrorMsg] = useState('');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setCellPhoneErrorMsg('');

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage('Please enter Trainee First Name and Last Name.');
      return;
    }
    if (!cellPhone.trim() || !email.trim()) {
      setErrorMessage('Please provide a valid Cell Phone and Email address.');
      return;
    }
    const cellDigits = cellPhone.trim().replace(/[\s\-\+\(\)]/g, '');
    if (!/^\d{7,15}$/.test(cellDigits)) {
      setCellPhoneErrorMsg('Please enter a valid phone number (e.g. +91 9876543210)');
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
    } catch {
      setErrorMessage('Failed to submit admission form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };



  const handleResetAndClose = () => {
    document.body.classList.remove('is-printing-admission-form');
    setSubmittedAdmission(null);
    setErrorMessage('');
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleResetAndClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitleGroup}>
            <h3>SoundAbode Studios - Admission Form</h3>
            <span className={styles.formBadge}>{activeFormNo}</span>
          </div>
          <button className={styles.closeBtn} onClick={handleResetAndClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        {/* Tab Switcher */}
        {!submittedAdmission && (
          <div className={styles.tabsBar}>
            <button
              type="button"
              className={`${styles.tabBtn} ${formType === 'DJ' ? styles.activeTab : ''}`}
              onClick={() => setFormType('DJ')}
            >
              DJ Training Form
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${formType === 'EMP' ? styles.activeTab : ''}`}
              onClick={() => setFormType('EMP')}
            >
              EMP Production Form
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {submittedAdmission ? (
            <div className={styles.successBox}>
              <h4 className={styles.successTitle}>Admission Form Submitted</h4>
              <p className={styles.successSubtext}>
                Admission form for <strong>{submittedAdmission.firstName} {submittedAdmission.lastName}</strong> ({submittedAdmission.courseOpted} - <strong>{submittedAdmission.paymentOption || 'Full Payment'}</strong>) has been filed successfully.
              </p>
              <div className={styles.refCode}>Form Reference: {submittedAdmission.formNo}</div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className={styles.submitBtn} onClick={handleResetAndClose}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form id="admissionForm" onSubmit={handleFormSubmit}>
              {errorMessage && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '4px',
                    fontSize: '0.82rem',
                    marginBottom: '1rem',
                    fontWeight: 600,
                  }}
                >
                  {errorMessage}
                </div>
              )}

              {/* Printable Document Paper View */}
              <div className={styles.formDocument}>
                {/* Header matching Physical Document */}
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
                      placeholder="e.g. +91 9876543210 *"
                      value={cellPhone}
                      onChange={(e) => {
                        setCellPhone(e.target.value);
                        setCellPhoneErrorMsg('');
                      }}
                      required
                    />
                    {cellPhoneErrorMsg && (
                      <span style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.35rem', display: 'block', fontWeight: 500 }}>
                        {cellPhoneErrorMsg}
                      </span>
                    )}
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
            </form>
          )}
        </div>

        {/* Modal Actions Footer */}
        {!submittedAdmission && (
          <div className={styles.modalFooter}>
            <div className={styles.actionBtnsRight} style={{ marginLeft: 'auto' }}>
              <button type="button" className={styles.cancelBtn} onClick={handleResetAndClose}>
                Cancel
              </button>
              <button
                type="submit"
                form="admissionForm"
                className={styles.submitBtn}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Admission Form'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdmissionFormModal;
