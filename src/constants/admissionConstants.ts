// Shared admission constants used by both AdmissionFormModal and CmsAdminPage
// Single source of truth — do NOT duplicate these in component files.

export const DJ_COURSES = [
  { id: 'dj-basic', name: 'Basic DJ Training Course (Level 01)', tenure: '2 Months', fee: '35,000 INR' },
  { id: 'dj-pro', name: 'Professional DJ Training Course (Level 02 - Only Applicable After Level 01)', tenure: '2 Months', fee: '25,000 INR' },
  { id: 'dj-complete', name: 'Complete DJ Training Course (Level 01 + Level 02)', tenure: '4 Months', fee: '60,000 INR' },
];

export const EMP_COURSES = [
  { id: 'emp-beginner', name: 'Beginner Electronic Music Production', tenure: '3 Months', fee: '60,000 INR' },
  { id: 'emp-intermediate', name: 'Intermediate (Pre-Degree Course) Electronic Music Production', tenure: '3 Months', fee: '60,000 INR' },
  { id: 'emp-expert', name: 'Expert (Diploma) Audio Engineering / Sound Design', tenure: '3 Months', fee: '60,000 INR' },
  { id: 'emp-mixing', name: 'Mixing & Mastering Course', tenure: '3+1 Months', fee: '60,000 INR' },
  { id: 'emp-diploma-all', name: 'Diploma in Audio Engineering (All Four Levels Together)', tenure: '13 Months', fee: '2,40,000 INR' },
];

export const DJ_DISCLAIMER = [
  'A student has to complete Basic DJ Training Course (Level 01) first in order to join Professional DJ Training Course.',
  'Our main aim is to help our students understand the art of mixing music. We have all essential tools in our studio workspace to help ease the process. We do not provide permission to carry or use any studio equipment out the studio.',
  'Full payment in advance has to be made in order to join any courses offered by SoundAbode Studios. Payment once made is non-refundable.',
  'Students have to maintain strict decorum when in Studio. Any kind of damage of equipment / property of SoundAbode Studios will result in full compensation to be paid by trainee to SoundAbode Studios.',
  'We do not provide any placement guarantees.',
  'We do not provide any extra studio time after the course tenure paid for by the student gets over. It is requested to follow your attendance strictly and in unavoidable circumstance student can reschedule their class time at least a day prior to class.',
  'As an alumnus your success story will automatically become a part of Soundabode and will be used at various places as our success story.',
];

export const EMP_DISCLAIMER = [
  'A student has to go through basic course first in order to join Professional or Advanced Courses.',
  'Our main aim is to help our students understand the art of music production. We have all essential tools in our studio workspace to help ease the process. We do not provide permission to carry or use any studio equipment outside our premises.',
  'Full payment in advance has to be made in order to join any EMP courses offered by SoundAbode Studios. Payment once made is non-refundable.',
  'Students have to maintain strict decorum when in Studio. Any kind of damage of equipment / property of SoundAbode Studios will result in full compensation to be paid by trainee to SoundAbode Studios.',
  'We only provide licensed software and libraries. Full copyright is given to student to make use of the same.',
  'Internship program works parallel to the course tenure. It is mandatory for trainees pursuing Diploma Audio Engineering.',
  'As an alumnus your success story will automatically become a part of Soundabode and will be used at various places as our success story.',
];
