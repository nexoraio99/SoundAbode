import React, { useState } from 'react';
import styles from './CourseDetailPage.module.css';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import SEO from '../../components/common/SEO';

export interface CourseData {
  slug: string;
  kicker: string;
  title: string;
  titleGradient: string;
  subtitle: string;
  description: string;
  category: 'music-production' | 'dj-training';
  levelNumber: string;
  metaPills: string[];
  duration: string;
  fee: string;
  deposit: string;
  mode: string;
  brochureUrl: string;
  heroAlbumImg: string;
  heroStudioImg: string;
  overviewDesc: string;
  overviewBullets: string[];
  objectivesBullets: string[];
  skillsPills: string[];
  curriculum: {
    title1: string;
    bullets1: string[];
    title2: string;
    bullets2: string[];
  }[];
  whySoundabodeBullets: string[];
  syllabusModules: { title: string; desc: string }[];
  tools: string[];
  faqs: { question: string; answer: string }[];
}

export const COURSE_REGISTRY: Record<string, CourseData> = {
  'beginner-course': {
    slug: 'beginner-course',
    kicker: 'Music Production · Level 1',
    title: 'Level 1 – Beginner: Music Production / Audio Workstation',
    titleGradient: 'Best Music Production Course in Pune for Beginners',
    subtitle: 'Transform your musical ideas into professional-quality tracks.',
    description:
      'At Soundabode, the Level 1 Music Production Course is the perfect starting point for aspiring producers, composers, and sound engineers. Learn how to turn creative sparks into full songs using Ableton Live and a solid foundation in music theory, sound design, and mixing.',
    category: 'music-production',
    levelNumber: 'Level 1',
    metaPills: [
      '3 months hands-on training',
      'Ableton Live workflow + studio practice',
      'Beginner-friendly · No prior experience',
    ],
    duration: '3 months',
    fee: '₹ 60,000',
    deposit: '₹ 35,000',
    mode: 'Weekday or Weekend batches',
    brochureUrl: 'mailto:services@soundabode.com?subject=Level%201%20Brochure%20Request',
    heroAlbumImg:
      'https://ik.imagekit.io/Nex1ora2/tr:f-auto,q-70/music-production-beginner-ableton-live-training-pune.jpg?updatedAt=1765478618544',
    heroStudioImg:
      'https://ik.imagekit.io/Nex1ora2/tr:f-auto,q-70/beginner-audio-workstation-course-mixing-basics.jpg?updatedAt=1765478611246',
    overviewDesc:
      'Over 3 months, you’ll master the workflow of a professional studio while producing your own tracks in genres like electronic, pop, hip-hop, and ambient.',
    overviewBullets: [
      'Hands-on learning inside Ableton Live with guided sessions.',
      'Structured projects that help you complete full songs, not just loops.',
      'Exposure to real-world studio practices and collaborative workflows.',
    ],
    objectivesBullets: [
      'Build a strong base in digital music production and audio engineering.',
      'Learn the full Ableton Live environment and creative workflow.',
      'Understand melody, harmony, rhythm, and song structure.',
      'Discover the fundamentals of sound design and mixing.',
      'Gain confidence to produce complete songs independently.',
    ],
    skillsPills: [
      'Ableton Live workflow',
      'Songwriting & arrangement',
      'Drum programming',
      'Synth & sound design',
      'Mixing basics',
      'Studio workflow',
    ],
    curriculum: [
      {
        title1: 'DAW Mastery – Ableton Live',
        bullets1: [
          'Navigating Ableton Live interface and views.',
          'MIDI & audio editing, clips, and warping.',
          'Track routing, groups and basic arrangement workflows.',
        ],
        title2: 'Music Theory For Producers',
        bullets2: [
          'Scales, chords, and chord progressions.',
          'Understanding rhythm, groove and timing.',
          'Song composition and common song structures.',
        ],
      },
      {
        title1: 'Sound Design & Beat-Making',
        bullets1: [
          'Synth programming (Wavetable, FM, Granular).',
          'Sampling, drum racks and groove creation.',
          'Designing basslines, leads, pads and textures.',
        ],
        title2: 'Mixing & Creative Skills',
        bullets2: [
          'Mixing basics: EQ, compression, reverb and delay.',
          'Balancing levels and creating space in the mix.',
          'Recording vocals/instruments and arranging your first original track.',
        ],
      },
    ],
    whySoundabodeBullets: [
      'India’s most hands-on electronic music academy.',
      'Learn from certified Ableton Live trainers & industry professionals.',
      'Unlimited studio practice time and 1-month internship included.',
      'Access to Soundabode Producer Community & collaborations.',
      'Free entry to major Pune concerts and music events.',
      'Personalized guidance for career growth and portfolio building.',
    ],
    syllabusModules: [
      {
        title: 'Module 1: DAW Setup & Ableton Live 12 Fundamentals',
        desc: 'Master Session & Arrangement view navigation, MIDI sequencing, signal routing, and project organization.',
      },
      {
        title: 'Module 2: Music Theory, Chords & Scales',
        desc: 'Understand major/minor scales, chord progressions, bassline writing, and melodic hooks tailored for electronic genres.',
      },
      {
        title: 'Module 3: Drum Programming & Rhythm Design',
        desc: 'Build punchy house, techno, hip-hop, and pop drum patterns using Impulse, Drum Racks, and velocity groove humanization.',
      },
      {
        title: 'Module 4: Sampling, Warping & Audio Manipulation',
        desc: 'Learn time-stretching, pitch shifting, audio warping, vocal chop production, and sample-based instrument creation.',
      },
      {
        title: 'Module 5: Song Arrangement & Composition Structure',
        desc: 'Transition from 8-bar loops to full 4-minute compositions. Design build-ups, drops, breaks, and arrangements.',
      },
      {
        title: 'Module 6: Final Track Completion & Internship Project',
        desc: 'Finish an original track from scratch. Receive direct mentor feedback and execute your first practical internship assignment.',
      },
    ],
    tools: [
      'Ableton Live 12 Suite',
      'Push 3 Controller',
      'Splice Sound Libraries',
      'Kontakt Essentials',
      'Arturia Analog Lab',
      'SoundGym Ear Training',
    ],
    faqs: [
      {
        question: 'Q1. Do I need any previous music experience?',
        answer: 'None at all! Level 1 starts from absolute zero. We cover DAW setup, music theory, and beat-making from the ground up.',
      },
      {
        question: 'Q2. Is software included with the course?',
        answer: 'We provide fully configured student workstations in our studio. You will also receive assistance setting up Ableton Live on your personal laptop.',
      },
      {
        question: 'Q3. What is the duration of Level 1?',
        answer: 'Level 1 runs for 3 months of core hands-on training.',
      },
    ],
  },
  'intermediate-course': {
    slug: 'intermediate-course',
    kicker: 'Music Production · Level 2',
    title: 'Level 2 – Intermediate: Pre-Degree in Electronic Music Production',
    titleGradient: 'Master Advanced Synthesis & Sound Design in Pune',
    subtitle: 'Go deeper into sound design, synth layering, and creative arrangement.',
    description:
      'Take your music production to professional heights. Level 2 focuses on advanced sound synthesis, Serum/Massive patch creation, frequency separation, dynamic compression, and release-ready EP production.',
    category: 'music-production',
    levelNumber: 'Level 2',
    metaPills: [
      '3 months hands-on training',
      'Advanced sound design + Serum/Arturia',
      'Pre-Degree Certificate in EMP',
    ],
    duration: '3 months',
    fee: '₹ 60,000',
    deposit: '₹ 35,000',
    mode: 'Weekday or Weekend batches',
    brochureUrl: 'mailto:services@soundabode.com?subject=Level%202%20Brochure%20Request',
    heroAlbumImg:
      'https://ik.imagekit.io/Nex1ora2/tr:f-auto,q-70/music-production-beginner-ableton-live-training-pune.jpg?updatedAt=1765478618544',
    heroStudioImg:
      'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=600&auto=format&fit=crop',
    overviewDesc:
      'Designed for producers who know the basics and want to craft signature sounds, release EP tracks on music labels, and tune lead vocals with precision tools.',
    overviewBullets: [
      'Deconstruct & code patches in Xfer Serum and Arturia V Collection.',
      'Master dynamic gain staging, sidechaining, and stereo width placement.',
      'Prepare 2 original EP tracks for record label submission.',
    ],
    objectivesBullets: [
      'Master subtractive, wavetable, and FM synthesis.',
      'Build signature synth leads, sub-basses, and atmospheric textures.',
      'Execute vocal tuning and pitch correction with Melodyne.',
      'Create high-energy build-ups and festival-ready drops.',
      'Establish clean headroom and frequency separation.',
    ],
    skillsPills: [
      'Serum synthesis',
      'Wavetable design',
      'Vocal tuning',
      'Stereo imaging',
      'Label pitching',
      'Mixing staging',
    ],
    curriculum: [
      {
        title1: 'Advanced Synthesis & Patch Design',
        bullets1: [
          'Custom wavetables, LFO modulations, and noise osc in Serum.',
          'Subtractive and FM synthesis routing in Arturia V Collection.',
          'Creating signature lead sounds and sub-bass stability.',
        ],
        title2: 'Frequency Balance & Layering',
        bullets2: [
          'Layering synths without frequency phase cancellation.',
          'Dynamic EQing with FabFilter Pro-Q 3.',
          'Spatial reverb diffusion and Haas delay effects.',
        ],
      },
    ],
    whySoundabodeBullets: [
      'Mentorship from active release artists and engineers.',
      'Access to commercial synth plugins and analog software.',
      'Direct feedback on label demo submissions.',
      'Full studio access for track mixing.',
    ],
    syllabusModules: [
      {
        title: 'Module 1: Advanced Wavetable Synthesis in Serum & Massive',
        desc: 'Custom wavetables, envelope shaping, LFO routing, and multi-filter FX chains.',
      },
      {
        title: 'Module 2: Layering & Frequency Balance',
        desc: 'Combine multiple synth leads, bass layers, and atmospheric pads seamlessly.',
      },
      {
        title: 'Module 3: High-Energy Arrangement & Drop Creation',
        desc: 'Risers, impact design, noise sweeps, and tension building for festival tracks.',
      },
      {
        title: 'Module 4: Vocal Tuning & Melodyne Processing',
        desc: 'Tune lead vocals using Melodyne, double-tracking, vocoders, and harmonies.',
      },
    ],
    tools: [
      'Xfer Serum',
      'Massive X',
      'Arturia V Collection',
      'Melodyne',
      'FabFilter Pro-Q 3',
      'Valhalla Reverbs',
    ],
    faqs: [
      {
        question: 'Q1. Can I join Level 2 directly without Level 1?',
        answer: 'Yes, if you have prior DAW knowledge and basic music theory, you can take a brief placement evaluation.',
      },
    ],
  },
  'audio-engineering-diploma': {
    slug: 'audio-engineering-diploma',
    kicker: 'Music Production · Level 3',
    title: 'Level 3 – Expert: Diploma in Audio Engineering',
    titleGradient: 'Commercial Audio Engineering & Studio Hardware in Pune',
    subtitle: 'Engineer the sound you imagine with studio-grade hardware and acoustics.',
    description:
      'Train on real analog synthesizers (Moog, Nord), Eurorack modular setups, acoustics, signal flow, Kontakt orchestral scoring, and commercial recording techniques in Pune.',
    category: 'music-production',
    levelNumber: 'Level 3',
    metaPills: [
      '3 Months intensive training',
      'Hardware Synths (Moog, Nord, Modular)',
      'Diploma in Audio Engineering',
    ],
    duration: '3 months',
    fee: '₹ 60,000',
    deposit: '₹ 35,000',
    mode: 'Onsite Studio (Pune)',
    brochureUrl: 'mailto:services@soundabode.com?subject=Level%203%20Brochure%20Request',
    heroAlbumImg:
      'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=600&auto=format&fit=crop',
    heroStudioImg:
      'https://ik.imagekit.io/Nex1ora2/tr:f-auto,q-70/JST_blogImages_liveSound_01.jpg',
    overviewDesc:
      'Step into acoustic control rooms, learn patchbay routing, capture vocals with Neumann microphones, and score music for films, games, and advertisements.',
    overviewBullets: [
      'Hands-on patching on Eurorack modular synths and Moog Subsequent 37.',
      'Acoustic treatment design, microphone placement, and signal chain preamps.',
      'Scoring for cinema and commercial video media using Kontakt 7.',
    ],
    objectivesBullets: [
      'Master analog audio hardware and console routing.',
      'Understand room acoustics and reflection control.',
      'Execute professional vocal tracking sessions.',
      'Compose background scores for commercial media.',
    ],
    skillsPills: [
      'Analog synths',
      'Modular patching',
      'Vocal tracking',
      'Room acoustics',
      'Film scoring',
      'Hardware preamps',
    ],
    curriculum: [
      {
        title1: 'Hardware Synths & Signal Flow',
        bullets1: [
          'Moog Sub 37 analog filter manipulation.',
          'Nord Lead 4 multi-timbral performance.',
          'Eurorack modular voltage routing.',
        ],
        title2: 'Recording & Commercial Media',
        bullets2: [
          'Vocal recording with Neumann TLM microphones.',
          'Scoring for films using Kontakt orchestral libraries.',
          'Binaural 3D spatial positioning.',
        ],
      },
    ],
    whySoundabodeBullets: [
      'Acoustically treated commercial recording facility.',
      'Real analog hardware synths and modular gear.',
      'Direct studio recording sessions with live artists.',
    ],
    syllabusModules: [
      {
        title: 'Module 1: Room Acoustics & Console Signal Flow',
        desc: 'Patchbays, preamps, reflection points, and studio acoustic design.',
      },
      {
        title: 'Module 2: Analog & Modular Synthesis',
        desc: 'Hands-on patching on Eurorack modules, Moog analog filters, and Nord Lead synths.',
      },
      {
        title: 'Module 3: Studio Recording & Vocal Tracking',
        desc: 'Microphone polar patterns, mic placement, preamps, and headphone cue mixes.',
      },
    ],
    tools: [
      'Moog Subsequent 37',
      'Nord Lead 4',
      'Eurorack Modular',
      'Kontakt 7 Ultimate',
      'Neumann TLM 103',
      'Universal Audio Apollo',
    ],
    faqs: [
      {
        question: 'Q1. Does Level 3 include hands-on hardware synth time?',
        answer: 'Yes! Students get dedicated hands-on hours on our Moog, Nord, and Eurorack modular hardware setups.',
      },
    ],
  },
  'mixing-mastering-course': {
    slug: 'mixing-mastering-course',
    kicker: 'Music Production · Level 4',
    title: 'Level 4 – Advanced: Mixing & Mastering Masterclass',
    titleGradient: 'Club & Streaming Loudness Mastering Standards',
    subtitle: 'Finish like a professional audio engineer with Ozone 11, FabFilter, and Waves.',
    description:
      'Master commercial audio polishing. Learn loudness targets (-14 LUFS for streaming, high dynamic range for clubs), bus processing, stem mastering, and iZotope RX 10 audio repair.',
    category: 'music-production',
    levelNumber: 'Level 4',
    metaPills: [
      '3 months training + 1 month internship',
      'iZotope Ozone 11 & FabFilter Suite',
      'Mixing & Mastering Specialist',
    ],
    duration: '3 months + 1 month internship',
    fee: '₹ 60,000',
    deposit: '₹ 35,000',
    mode: 'Onsite Studio / Hybrid',
    brochureUrl: 'mailto:services@soundabode.com?subject=Level%204%20Brochure%20Request',
    heroAlbumImg:
      'https://ik.imagekit.io/Nex1ora2/tr:f-auto,q-70/beginner-audio-workstation-course-mixing-basics.jpg?updatedAt=1765478611246',
    heroStudioImg:
      'https://ik.imagekit.io/Nex1ora2/tr:f-auto,q-70/music-production-beginner-ableton-live-training-pune.jpg?updatedAt=1765478618544',
    overviewDesc:
      'Achieve punchy low-end, crystal clear highs, and competitive commercial loudness without distortion across Spotify, Apple Music, and festival sound systems.',
    overviewBullets: [
      'Master stem sub-mixes, drum bus compression, and phase correction.',
      'Eliminate harshness and low-end mud using dynamic EQs.',
      'Deliver final WAV/MP3 stems for commercial releases.',
    ],
    objectivesBullets: [
      'Understand LUFS loudness and true peak limiting.',
      'Master Mid/Side processing and 3D soundstages.',
      'Execute audio restoration with iZotope RX 10.',
    ],
    skillsPills: [
      'Ozone 11 mastering',
      'Stem mixing',
      'LUFS optimization',
      'Dynamic EQ',
      'Bus compression',
      'Phase alignment',
    ],
    curriculum: [
      {
        title1: 'Master Mixing Architecture',
        bullets1: [
          'Sub-mix stem grouping and drum bus saturation.',
          'Dynamic EQing and spectral unmasking.',
          'Stereo width and Mid/Side balancing.',
        ],
        title2: 'Loudness & Final Delivery',
        bullets2: [
          'Mastering chains: EQ, Glue Compression, Peak Limiter.',
          'Platform targets: Spotify, Apple Music, Club Sound.',
          'Audio repair and de-clicking with iZotope RX.',
        ],
      },
    ],
    whySoundabodeBullets: [
      'Learn on commercial TC Electronic & SSL hardware metering.',
      'Mastering feedback on your actual song releases.',
      'Guaranteed studio internship handling commercial client mixes.',
    ],
    syllabusModules: [
      {
        title: 'Module 1: Master Mixing Architecture & Bus Grouping',
        desc: 'Organizing stem sub-mixes, drum bus processing, and phase correction.',
      },
      {
        title: 'Module 2: Multiband Dynamics & Spectral Balance',
        desc: 'Eliminating low-end mud and controlling dynamic range with precision EQs.',
      },
      {
        title: 'Module 3: Mastering Chains & Platform Optimization',
        desc: 'Targeting -14 LUFS for Spotify, Apple Music Digital Masters, and club systems.',
      },
    ],
    tools: [
      'iZotope Ozone 11',
      'iZotope RX 10',
      'FabFilter Pro-L 2',
      'Waves Mercury',
      'SSL G-Master Compressor',
      'TC Clarity M Meter',
    ],
    faqs: [
      {
        question: 'Q1. Will this course teach me how to master tracks for Spotify and Apple Music?',
        answer: 'Yes! Level 4 covers platform-specific target LUFS loudness, true peak headroom, and stem delivery.',
      },
    ],
  },
  'basic-dj-course': {
    slug: 'basic-dj-course',
    kicker: 'DJ Training · Level 1',
    title: 'Level 1 – Basic DJ Training Course',
    titleGradient: 'Pioneer CDJ Decks & Manual Beatmatching Masterclass in Pune',
    subtitle: 'Build your foundation in DJing: beatmatching, EQing, track structuring, and your first live set.',
    description:
      'Step behind professional Pioneer CDJ-3000 decks and DJM-900NXS2 mixers at Soundabode Pune. Learn manual beatmatching by ear (no sync buttons), phrase counting, Rekordbox management, and transition FX.',
    category: 'dj-training',
    levelNumber: 'Basic DJ',
    metaPills: [
      '2 Months hands-on training',
      'Pioneer CDJ-3000 & DJM-900NXS2',
      'Manual Beatmatching by Ear',
    ],
    duration: '2 months',
    fee: '₹ 35,000',
    deposit: '₹ 35,000',
    mode: 'Onsite DJ Studio (Pune)',
    brochureUrl: 'mailto:services@soundabode.com?subject=Basic%20DJ%20Brochure%20Request',
    heroAlbumImg:
      'https://ik.imagekit.io/Nex1ora2/tr:f-auto,q-70/JST_blogImages_liveSound_01.jpg',
    heroStudioImg:
      'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=600&auto=format&fit=crop',
    overviewDesc:
      'In this 2-month hands-on course, you will learn the core fundamentals of DJing from certified resident DJs. Master gear setup, cueing, EQ blending, and record a live 45-minute radio mix.',
    overviewBullets: [
      'Train on industry-standard Pioneer CDJ-3000 decks & DJM mixers.',
      'Master manual beatmatching by ear without relying on visual sync.',
      'Perform and record a full live 45-minute set reviewed by mentors.',
    ],
    objectivesBullets: [
      'Gain complete confidence operating Pioneer club gear.',
      'Understand track structure, intro/outro beats, and 32-bar phrases.',
      'Master smooth EQ low-cuts, volume faders, and transition sweeps.',
      'Organize music libraries in Rekordbox with cue points and memory loops.',
    ],
    skillsPills: [
      'Pioneer CDJ-3000',
      'Manual beatmatching',
      'Phrase counting',
      'EQ swapping',
      'Rekordbox prep',
      'Live set recording',
    ],
    curriculum: [
      {
        title1: 'Gear Setup & Beatmatching',
        bullets1: [
          'CDJ-3000 jog wheel tension, pitch faders, and cue points.',
          'Manual beatmatching by ear (pitch bending & tempo alignment).',
          'Rekordbox USB export and playlist management.',
        ],
        title2: 'Phrasing & EQ Mixing',
        bullets2: [
          '4/8/16/32 bar phrase matching and timing.',
          'Bass swapping, low-cut filtering, and volume faders.',
          'Applying Echo, Reverb, Flanger, and Roll FX.',
        ],
      },
    ],
    whySoundabodeBullets: [
      'Dedicated practice hours on Pioneer flagship hardware.',
      'Learn directly from active resident festival DJs.',
      'Recorded 45-minute live set evaluation.',
    ],
    syllabusModules: [
      {
        title: 'Module 1: Hardware Decks & Rekordbox Prep',
        desc: 'Pioneer CDJ layout, pitch faders, cue points, and USB playlist export.',
      },
      {
        title: 'Module 2: Manual Beat-Matching by Ear',
        desc: 'BPM matching, pitch bending, and tempo alignment without visual sync.',
      },
      {
        title: 'Module 3: Phrase Matching & Structure',
        desc: 'Understanding 32-bar phrases, intro/outro mixing, and seamless track transitions.',
      },
      {
        title: 'Module 4: Recorded Live 45-Minute Set',
        desc: 'Perform and record a live set evaluated by senior DJ instructors.',
      },
    ],
    tools: [
      'Pioneer CDJ-3000 Decks',
      'Pioneer DJM-900NXS2 Mixer',
      'Pioneer HDJ-X10 Headphones',
      'Rekordbox Software',
    ],
    faqs: [
      {
        question: 'Q1. Do I get practice time on the Pioneer CDJs outside class hours?',
        answer: 'Yes! Soundabode offers open practice studio hours for enrolled DJ students.',
      },
    ],
  },
  'pro-dj-course': {
    slug: 'pro-dj-course',
    kicker: 'DJ Training · Level 2',
    title: 'Level 2 – Pro DJ Training Course',
    titleGradient: 'Advanced Multi-Deck Club Performance & Acapella Mashups',
    subtitle: 'Advanced mixing, harmonic blending, 3-deck performance, and digital DJ setups.',
    description:
      'Elevate your DJ performance. Learn 3-deck mixing, live acapella mashups, harmonic key blending using Camelot system, hot cue routines, loop rolls, crowd reading, and promoter pitching in Pune.',
    category: 'dj-training',
    levelNumber: 'Pro DJ',
    metaPills: [
      '4 Months advanced training',
      '3-Deck Performance Workflow',
      'Pro DJ Performance Specialist',
    ],
    duration: '4 months',
    fee: '₹ 60,000',
    deposit: '₹ 35,000',
    mode: 'Onsite DJ Studio (Pune)',
    brochureUrl: 'mailto:services@soundabode.com?subject=Pro%20DJ%20Brochure%20Request',
    heroAlbumImg:
      'https://ik.imagekit.io/Nex1ora2/tr:f-auto,q-70/JST_blogImages_liveSound_01.jpg',
    heroStudioImg:
      'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=600&auto=format&fit=crop',
    overviewDesc:
      'Designed for DJs who want to command peak-time club sets, create live acapella mashups, build an electronic press kit (EPK), and secure club gigs.',
    overviewBullets: [
      'Perform 3-deck routines using Pioneer CDJ-3000 & DJM-V10 mixers.',
      'Blend vocals over custom instrumental tracks in real time.',
      'Build your Electronic Press Kit (EPK) and venue booking strategy.',
    ],
    objectivesBullets: [
      'Master multi-deck performance and hot cue routines.',
      'Perform live acapella mashups using harmonic key shifting.',
      'Understand crowd energy management and peak-time set programming.',
    ],
    skillsPills: [
      '3-Deck mixing',
      'Acapella mashups',
      'Harmonic blending',
      'Crowd reading',
      'EPK creation',
      'Gig pitching',
    ],
    curriculum: [
      {
        title1: 'Creative Performance & Mashups',
        bullets1: [
          '3-deck track layering and vocal acapella isolation.',
          'Hot cue tone play and instant loop rolls.',
          'Harmonic key shifting via Camelot wheel.',
        ],
        title2: 'Set Programming & Industry',
        bullets2: [
          'Warm-up vs peak-time set programming.',
          'EPK preparation, SoundCloud uploads, and social media branding.',
          'Trial set performance at partner venue clubs.',
        ],
      },
    ],
    whySoundabodeBullets: [
      'Direct venue partnerships with 30+ clubs across Pune & India.',
      'Mentorship from active resident festival DJs.',
      'Trial set booking opportunities for top performers.',
    ],
    syllabusModules: [
      {
        title: 'Module 1: Advanced Rekordbox Hot Cues & Loop Rolls',
        desc: 'Programming tone play, cue loops, and instant drop triggers.',
      },
      {
        title: 'Module 2: Live Acapella & Instrumental Mashups',
        desc: 'Blending vocals over instrumentals in real time using key shifting.',
      },
      {
        title: 'Module 3: Multi-Deck Performance (3 & 4 Decks)',
        desc: 'Managing three active decks simultaneously for drum loops and main tracks.',
      },
    ],
    tools: [
      'Pioneer CDJ-3000 (3 Decks)',
      'Pioneer DJM-V10 Mixer',
      'Rekordbox DJ Performance Mode',
      'Rane TWELVE Control',
    ],
    faqs: [
      {
        question: 'Q1. Does Soundabode assist with club booking opportunities?',
        answer: 'Yes! Soundabode partners with 30+ venues across Pune and India to showcase top graduates.',
      },
    ],
  },
  'advanced-dj-performance': {
    slug: 'advanced-dj-performance',
    kicker: 'DJ Training · Level 3',
    title: 'Level 3 – Professional DJ / Performance Path',
    titleGradient: 'Festival Mainstage & Hybrid Live DJ Set Performance',
    subtitle: 'Artist profile, mixtapes, Ableton Push sync, vinyl DVS scratching, and gig strategy.',
    description:
      'Master festival mainstage performances. Integrate Ableton Push 3, hardware drum machines, vinyl DVS turntablism, and Pioneer CDJs into a hybrid live DJ show in Pune.',
    category: 'dj-training',
    levelNumber: 'Level 3',
    metaPills: [
      'Mentored · Included in complete path',
      'Ableton Push 3 + Hardware Drums',
      'Hybrid Live DJ & Scratching',
    ],
    duration: 'Mentored · Included',
    fee: 'Included',
    deposit: 'Included',
    mode: 'Onsite DJ Studio (Pune)',
    brochureUrl: 'mailto:services@soundabode.com?subject=Level%203%20DJ%20Brochure%20Request',
    heroAlbumImg:
      'https://ik.imagekit.io/Nex1ora2/tr:f-auto,q-70/JST_blogImages_liveSound_01.jpg',
    heroStudioImg:
      'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=600&auto=format&fit=crop',
    overviewDesc:
      'Engineered for performing artists who want to merge live instrumentation with DJ sets, master vinyl scratching, and build a mainstage festival career.',
    overviewBullets: [
      'Link Ableton Push 3 with Pioneer CDJs via MIDI clock sync.',
      'Master baby scratches, cuts, transforms, and vinyl manipulation.',
      'Record a multi-camera video showcase reel for booking agencies.',
    ],
    objectivesBullets: [
      'Perform hybrid live sets combining synths, drum machines, and CDJs.',
      'Master vinyl DVS turntablism scratching techniques.',
      'Draft professional technical stage riders and booking agency pitches.',
    ],
    skillsPills: [
      'Hybrid live DJing',
      'Ableton Push 3',
      'Vinyl scratching',
      'Roland TR-8S',
      'Stage riders',
      'Agency pitching',
    ],
    curriculum: [
      {
        title1: 'Hybrid Setup & Hardware',
        bullets1: [
          'Ableton Push 3 sync with Pioneer Pro DJ Link.',
          'Roland drum machine live improvisational jamming.',
          'Custom MIDI controller mapping.',
        ],
        title2: 'Turntablism & Mainstage Set',
        bullets2: [
          'Technics SL-1200 turntablism and vinyl scratch cuts.',
          'Structuring high-impact 60-minute mainstage festival sets.',
          'Multi-camera showcase video recording.',
        ],
      },
    ],
    whySoundabodeBullets: [
      'Full access to Technics turntables & Roland hardware drums.',
      'Recorded video promo reel for festival booking agencies.',
      'Mentorship from international touring artists.',
    ],
    syllabusModules: [
      {
        title: 'Module 1: Hybrid Setup (Ableton Push + Pioneer Sync)',
        desc: 'Linking Ableton Live via MIDI clock to trigger live synths alongside CDJs.',
      },
      {
        title: 'Module 2: Turntablism Scratching & DVS Control',
        desc: 'Baby scratches, cuts, transforms, and vinyl manipulation on Technics turntables.',
      },
      {
        title: 'Module 3: Festival Mainstage Set Design & Video Reel',
        desc: 'Structuring high-impact 60-minute sets and recording multi-camera promo video.',
      },
    ],
    tools: [
      'Ableton Push 3',
      'Pioneer CDJ-3000 & DJM-V10',
      'Roland TR-8S Drum Machine',
      'Technics SL-1200MK7',
    ],
    faqs: [
      {
        question: 'Q1. Is this course designed for touring artists?',
        answer: 'Yes! Level 3 is engineered specifically for artists adding live elements and turntablism to their stage shows.',
      },
    ],
  },
};

interface CourseDetailPageProps {
  courseSlug: string;
  onNavigateHome?: () => void;
  onNavigateCourses?: () => void;
}

export const CourseDetailPage: React.FC<CourseDetailPageProps> = ({
  courseSlug,
  onNavigateHome,
  onNavigateCourses,
}) => {
  const course = COURSE_REGISTRY[courseSlug] || COURSE_REGISTRY['beginner-course'];
  const [openSyllabusIndex, setOpenSyllabusIndex] = useState<number | null>(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const isEmp = course.category === 'music-production';
  const empLevels = [
    { name: 'Level 1', slug: 'beginner-course' },
    { name: 'Level 2', slug: 'intermediate-course' },
    { name: 'Level 3', slug: 'audio-engineering-diploma' },
    { name: 'Level 4', slug: 'mixing-mastering-course' },
  ];
  const djLevels = [
    { name: 'Level 1', slug: 'basic-dj-course' },
    { name: 'Level 2', slug: 'pro-dj-course' },
    { name: 'Level 3', slug: 'advanced-dj-performance' },
  ];
  const activeLevels = isEmp ? empLevels : djLevels;

  const navigateToRoute = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEnrollClick = () => {
    navigateToRoute('/contact');
  };

  const handleCoursesClick = () => {
    if (onNavigateCourses) {
      onNavigateCourses();
    } else {
      navigateToRoute('/courses');
    }
  };

  const courseSchema = [
    {
      '@context': 'https://schema.org',
      '@type': 'Course',
      '@id': `https://soundabode.com/courses/${course.slug}#course`,
      name: `${course.title} - Soundabode Pune`,
      description: course.description,
      provider: {
        '@type': 'EducationalOrganization',
        '@id': 'https://soundabode.com/#academy',
        name: 'Soundabode Academy',
        url: 'https://soundabode.com',
      },
      courseMode: ['onsite', 'online'],
      educationalLevel: course.levelNumber,
      teaches: course.skillsPills,
      timeRequired: course.duration,
      educationalCredentialAwarded: course.title,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://soundabode.com/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Courses',
          item: 'https://soundabode.com/courses',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: course.title,
          item: `https://soundabode.com/courses/${course.slug}`,
        },
      ],
    },
  ];

  return (
    <div className={styles.pageContainer}>
      <SEO
        title={`${course.title} | Soundabode Pune`}
        description={course.description}
        keywords={`Soundabode, ${course.title}, ${course.skillsPills.join(', ')}, Music Production Pune`}
        canonical={`https://soundabode.com/courses/${course.slug}`}
        schema={courseSchema}
      />
      <Navbar
        activePage="courses"
        onNavigate={(page) => {
          if (page === 'home' && onNavigateHome) {
            onNavigateHome();
          } else if (page === 'courses' && onNavigateCourses) {
            onNavigateCourses();
          }
        }}
      />

      <main className={styles.container} role="main">
        {/* BREADCRUMB */}
        <nav className={styles.breadcrumb} aria-label="Breadcrumb navigation">
          <span className={styles.breadcrumbLink} onClick={() => onNavigateHome && onNavigateHome()}>
            Home
          </span>
          <span className={styles.breadcrumbSeparator}>/</span>
          <span className={styles.breadcrumbLink} onClick={handleCoursesClick}>
            Courses
          </span>
          <span className={styles.breadcrumbSeparator}>/</span>
          <span style={{ color: '#ffffff', fontWeight: 600 }}>{course.levelNumber}</span>
        </nav>

        {/* HERO SECTION */}
        <section className={styles.hero} aria-label="Course Header">
          <div>
            <div className={styles.heroKicker}>{course.kicker}</div>
            <h1 className={styles.heroHeading}>
              {course.title}
              <span className={styles.gradientText}>{course.titleGradient}</span>
            </h1>
            <p className={styles.heroSubtitle}>{course.subtitle}</p>
            <p className={styles.heroDesc}>{course.description}</p>

            <div className={styles.heroMetaRow}>
              {course.metaPills.map((pill, idx) => (
                <span key={idx} className={styles.metaPill}>
                  {pill}
                </span>
              ))}
            </div>

            <div className={styles.ctaRow}>
              <button type="button" onClick={handleEnrollClick} className={styles.btnPrimary}>
                ENROLL NOW
              </button>
              {activeLevels.map((lvl) => {
                const isActive = lvl.slug === course.slug;
                return (
                  <button
                    key={lvl.slug}
                    type="button"
                    className={`${styles.btnOutline} ${isActive ? styles.btnActive : ''}`}
                    onClick={() => navigateToRoute(`/courses/${course.category}/${lvl.slug}`)}
                  >
                    {lvl.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className={styles.consolePromoCard} role="region" aria-label="Interactive Soundabode Live DJ Console">
              <div className={styles.consoleCardHeader}>
                <div className={styles.consoleTag}>
                  <span>VIRTUAL STUDIO ENGINE</span>
                </div>
                <span className={styles.modelTag}>DDJ-FLX4</span>
              </div>

              <div className={styles.consoleCardContent}>
                <h3 className={styles.consoleCardTitle}>Try Interactive DJ Console</h3>
                <p className={styles.consoleCardDesc}>
                  Practice real-time track mixing, beatmatching, and 3-band EQ controls live in your browser.
                </p>
              </div>

              <button
                type="button"
                className={styles.consoleCardBtn}
                onClick={() => navigateToRoute('/try-now')}
              >
                <span>Launch Live Console</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* OVERVIEW + QUICK FACTS */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>COURSE OVERVIEW</h2>
            <p className={styles.sectionSubtitle}>
              In this program, you’ll explore every key aspect of music creation - from building melodies and beats to recording, editing, and arranging your complete project.
            </p>
          </div>

          <div className={styles.twoColumn}>
            <div className={styles.card}>
              <p className={styles.muted} style={{ marginTop: 0 }}>
                {course.overviewDesc}
              </p>
              <ul className={styles.bullets}>
                {course.overviewBullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>

            <div className={styles.card}>
              <h3>QUICK FACTS</h3>
              <div className={styles.detailsGrid}>
                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>DURATION</div>
                  <div className={styles.detailValue}>{course.duration}</div>
                </div>
                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>FEE</div>
                  <div className={styles.detailValue}>{course.fee}</div>
                </div>
                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>START WITH</div>
                  <div className={styles.detailValue}>{course.deposit}</div>
                </div>
                <div className={styles.detailItem}>
                  <div className={styles.detailLabel}>MODE</div>
                  <div className={styles.detailValue}>{course.mode}</div>
                </div>
              </div>

              <a
                href={course.brochureUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.brochureLink}
              >
                Download Complete Course Brochure (PDF)
              </a>
            </div>
          </div>
        </section>

        {/* COURSE OBJECTIVES */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>COURSE OBJECTIVES</h2>
            <p className={styles.sectionSubtitle}>
              Clear learning goals so you know exactly what you’ll be able to do by the end of {course.levelNumber}.
            </p>
          </div>

          <div className={styles.grid2}>
            <div className={styles.card}>
              <ul className={styles.bullets}>
                {course.objectivesBullets.map((obj, idx) => (
                  <li key={idx}>{obj}</li>
                ))}
              </ul>
            </div>

            <div className={styles.card}>
              <h3>SKILLS YOU’LL WORK TOWARD</h3>
              <div className={styles.pillRow}>
                {course.skillsPills.map((s, idx) => (
                  <span key={idx} className={styles.pill}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* WHAT YOU WILL LEARN */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>WHAT YOU’LL LEARN (CONDENSED OVERVIEW)</h2>
            <p className={styles.sectionSubtitle}>
              A module-wise look at the core topics covered inside the {course.levelNumber} course.
            </p>
          </div>

          <div className={styles.grid2}>
            {course.curriculum.map((curr, idx) => (
              <div key={idx} className={styles.card}>
                <h3>{curr.title1}</h3>
                <ul className={styles.bullets}>
                  {curr.bullets1.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>

                <h3 style={{ marginTop: '16px' }}>{curr.title2}</h3>
                <ul className={styles.bullets}>
                  {curr.bullets2.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* WHY SOUNDABODE */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>WHY CHOOSE SOUNDABODE</h2>
            <p className={styles.sectionSubtitle}>
              A training environment built like a modern electronic music studio - not just a classroom.
            </p>
          </div>

          <div className={styles.card}>
            <ul className={styles.bullets}>
              {course.whySoundabodeBullets.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* DETAILED SYLLABUS ACCORDION */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>DETAILED COURSE SYLLABUS</h2>
            <p className={styles.sectionSubtitle}>Explore the step-by-step module breakdown.</p>
          </div>

          <div className={styles.accordionList}>
            {course.syllabusModules.map((mod, idx) => {
              const isOpen = openSyllabusIndex === idx;
              return (
                <div key={idx} className={styles.accordionItem}>
                  <button
                    type="button"
                    className={styles.accordionHeader}
                    onClick={() => setOpenSyllabusIndex(isOpen ? null : idx)}
                  >
                    <span>{mod.title}</span>
                    <span>{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && <div className={styles.accordionBody}>{mod.desc}</div>}
                </div>
              );
            })}
          </div>
        </section>

        {/* TOOLS & SOFTWARE */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>TOOLS &amp; GEAR YOU WILL MASTER</h2>
          </div>

          <div className={styles.pillRow}>
            {course.tools.map((tool, idx) => (
              <span key={idx} className={styles.pill} style={{ fontSize: '13px', padding: '8px 14px' }}>
                {tool}
              </span>
            ))}
          </div>
        </section>

        {/* FAQS */}
        {course.faqs.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>FREQUENTLY ASKED QUESTIONS</h2>
            </div>

            <div className={styles.accordionList}>
              {course.faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={idx} className={styles.accordionItem}>
                    <button
                      type="button"
                      className={styles.accordionHeader}
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    >
                      <span>{faq.question}</span>
                      <span>{isOpen ? '−' : '+'}</span>
                    </button>
                    {isOpen && <div className={styles.accordionBody}>{faq.answer}</div>}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* BOTTOM CALLOUT */}
        <section className={styles.enrollBottom}>
          <div>
            <h3 className={styles.enrollBottomTitle}>READY TO START YOUR MUSIC CAREER?</h3>
            <div className={styles.muted} style={{ marginTop: '4px' }}>
              Pay ₹35,000 to reserve your seat. Flexible installments available.
            </div>
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={handleEnrollClick} className={styles.btnPrimary}>
              ENROLL NOW
            </button>
            <button type="button" onClick={handleCoursesClick} className={styles.btnOutline}>
              VIEW ALL COURSES
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CourseDetailPage;
