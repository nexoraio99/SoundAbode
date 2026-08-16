import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import dns from 'dns';
import { randomBytes } from 'crypto';
import nodemailer from 'nodemailer';

// Graceful optional dependency loading — server starts even if not yet installed.
// Run `npm install` in /server to activate full security.
let helmet;
let rateLimit;
try {
  helmet = (await import('helmet')).default;
} catch {
  console.warn('[WARN] helmet not installed — HTTP security headers disabled. Run: npm install');
  helmet = null;
}
try {
  const mod = await import('express-rate-limit');
  rateLimit = mod.rateLimit;
} catch {
  console.warn('[WARN] express-rate-limit not installed — login rate limiting disabled. Run: npm install');
  rateLimit = null;
}

dotenv.config();

// Configure high-performance DNS resolution
try {
  if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch {
  // Fallback to system default DNS
}

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
let PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Require MONGODB_URI from environment — never hard-code credentials ────────
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('[FATAL] MONGODB_URI environment variable is not set. Set it in server/.env and restart.');
  process.exit(1);
}

// ─── Security Middleware ───────────────────────────────────────────────────────

// Helmet sets essential HTTP security headers (CSP, X-Frame-Options, HSTS, etc.)
if (helmet) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://images.unsplash.com',
            'https://images.pexels.com',
            'https://soundabode.com',
            'https://www.soundabode.com',
          ],
          connectSrc: ["'self'", 'https://script.google.com', 'https://*.mongodb.net', 'https://*.onrender.com', 'https://raw.githubusercontent.com', 'https://*.githubusercontent.com'],
          mediaSrc: ["'self'", 'data:', 'blob:', 'https:', 'https://raw.githubusercontent.com', 'https://*.githubusercontent.com'],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      frameguard: { action: 'deny' },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      noSniff: true,
      xssFilter: true,
    })
  );
} else {
  console.warn('[WARN] Skipping helmet — install it for production use.');
}

// Custom HTTP Security Headers Middleware — enforces essential security headers on all responses
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  next();
});

// CORS — restrict to configured origin(s) only
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'https://soundabode.com,https://www.soundabode.com,http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, health checks, curl)
      if (!origin) return callback(null, true);

      const isAllowed =
        ALLOWED_ORIGINS.includes(origin) ||
        ALLOWED_ORIGINS.includes('*') ||
        origin.endsWith('.pages.dev') ||
        origin.endsWith('.cloudflare.com') ||
        origin.includes('soundabode.com') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1');

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: origin '${origin}' is not allowed.`));
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  })
);

// Body size limit — prevents JSON body DoS attacks
app.use(express.json({ limit: '1mb' }));

// Rate limit on the auth endpoint — max 10 attempts per IP per 15 minutes
const authLimiter = rateLimit
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
    })
  : (_req, _res, next) => next(); // no-op fallback

// ─── In-memory session store ────────────────────────────────────────────────────
// Maps token → { email, name, role }.  Cleared on server restart (intentional for simple admin tool).
const activeSessions = new Map();

function createSession(user) {
  const token = randomBytes(32).toString('hex');
  activeSessions.set(token, user);
  return token;
}

// Auth middleware — validates Bearer token on protected routes
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  req.sessionUser = activeSessions.get(token);
  next();
}

// Admin-only middleware
function requireAdmin(req, res, next) {
  if (!req.sessionUser || req.sessionUser.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden. Admin access required.' });
  }
  next();
}

// ─── MongoDB Connection ────────────────────────────────────────────────────────
let isConnected = false;

function buildStandardFallbackUri(srvUri) {
  try {
    const match = srvUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)\/([^?]*)/);
    if (!match) return null;
    const [, user, pass, host, db] = match;
    const dbName = db || 'soundabode';
    const parts = host.split('.');
    const clusterPrefix = parts[0];
    const clusterHash = parts[1];
    const baseDomain = parts.slice(1).join('.');

    const node0 = `${clusterPrefix}-shard-00-00.${baseDomain}:27017`;
    const node1 = `${clusterPrefix}-shard-00-01.${baseDomain}:27017`;
    const node2 = `${clusterPrefix}-shard-00-02.${baseDomain}:27017`;
    const replicaSetName = `atlas-${clusterHash || clusterPrefix}-shard-0`;

    return `mongodb://${user}:${pass}@${node0},${node1},${node2}/${dbName}?ssl=true&replicaSet=${replicaSetName}&authSource=admin&retryWrites=true&w=majority`;
  } catch {
    return null;
  }
}

async function connectDB() {
  const options = {
    dbName: 'soundabode',
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10,
    minPoolSize: 2,
    socketTimeoutMS: 45000,
    family: 4,
  };

  const maskedUri = MONGODB_URI.replace(/:([^@]+)@/, (_, pwd) => `:${'*'.repeat(pwd.length)}@`);

  console.log('\n================ MONGODB ATLAS DIAGNOSTIC ================');
  console.log('[INFO] [ENV LOADED]:', Boolean(process.env.MONGODB_URI));
  console.log('[INFO] [TARGET URI]:', maskedUri);
  console.log('[INFO] [TIMESTAMP]:', new Date().toISOString());
  console.log('==========================================================\n');

  try {
    await mongoose.connect(MONGODB_URI, options);
    isConnected = true;
    console.log('[SUCCESS] Connected to MongoDB Atlas successfully.');
    await autoSeedIfEmpty();
  } catch (err) {
    console.error('[ERROR] MONGODB CONNECT FAILED!');
    console.error('  - Error Name:', err.name);
    console.error('  - Error Code:', err.code || 'N/A');
    console.error('  - Error Message:', err.message);
    console.error('  - Full Stack Trace:\n', err.stack);
    if (err.cause) {
      console.error('  - Error Cause:\n', err.cause);
    }

    if (err.message.includes('querySrv') || err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
      const fallbackUri = buildStandardFallbackUri(MONGODB_URI);
      if (fallbackUri) {
        try {
          const maskedFallback = fallbackUri.replace(/:([^@]+)@/, (_, pwd) => `:${'*'.repeat(pwd.length)}@`);
          console.log('[INFO] Trying Direct Atlas Seedlist Fallback URI:', maskedFallback);
          await mongoose.connect(fallbackUri, options);
          isConnected = true;
          console.log('[SUCCESS] Connected to MongoDB Atlas via Direct Seedlist Fallback!');
          await autoSeedIfEmpty();
          return;
        } catch (fallbackErr) {
          console.error('[ERROR] FALLBACK CONNECT ALSO FAILED:');
          console.error('  - Fallback Error Name:', fallbackErr.name);
          console.error('  - Fallback Error Message:', fallbackErr.message);
          console.error('  - Full Fallback Error:\n', fallbackErr);
        }
      }
    }

    console.warn('[WARN] Server running in API mode — MongoDB unavailable. All data endpoints will return empty.');
  }
}

connectDB();

// ─── SCHEMAS & MODELS ──────────────────────────────────────────────────────────
const inquirySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  courseInterest: { type: String, default: 'General Inquiry' },
  message: { type: String, default: '' },
  source: { type: String, default: 'Contact Form' },
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['NEW', 'CONTACTED', 'ENROLLED', 'ARCHIVED'], default: 'NEW' },
  notes: { type: String, default: '' },
});

const blogPostSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  slug: { type: String, required: true },
  excerpt: { type: String, default: '' },
  content: { type: String, default: '' },
  category: { type: String, default: 'PRODUCTION' },
  coverImage: { type: String, default: '' },
  readTimeMinutes: { type: Number, default: 5 },
  authorName: { type: String, default: 'Soundabode Team' },
  authorRole: { type: String, default: 'Academy Mentor' },
  authorAvatarUrl: { type: String, default: '' },
  isFeatured: { type: Boolean, default: false },
  tags: [{ type: String }],
  publishedAt: { type: String, default: () => new Date().toISOString() },
});

const studentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  course: { type: String, default: '' },
  batch: { type: String, default: '' },
  enrolledDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
  attendanceRecords: [
    {
      date: String,
      status: { type: String, enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] },
      notes: String,
    },
  ],
});

const admissionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  formNo: { type: String, required: true },
  formType: { type: String, enum: ['DJ', 'EMP'], default: 'DJ' },
  firstName: { type: String, required: true },
  lastName: { type: String, default: '' },
  cellPhone: { type: String, default: '' },
  workPhone: { type: String, default: '' },
  email: { type: String, default: '' },
  aadharNo: { type: String, default: '' },
  fatherName: { type: String, default: '' },
  address: { type: String, default: '' },
  courseOpted: { type: String, default: '' },
  tenure: { type: String, default: '' },
  fee: { type: String, default: '' },
  agreedToTerms: { type: Boolean, default: true },
  signatureName: { type: String, default: '' },
  submittedAt: { type: String, default: () => new Date().toISOString() },
  status: { type: String, enum: ['NEW', 'CONTACTED', 'ENROLLED', 'ARCHIVED'], default: 'NEW' },
});

const attendanceRecordSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  studentName: { type: String, default: '' },
  studentEmail: { type: String, default: '' },
  studentPhone: { type: String, default: '' },
  course: { type: String, default: '' },
  batch: { type: String, default: '' },
  date: { type: String, required: true },
  timeSlot: { type: String, default: '11:00 AM - 01:00 PM' },
  status: { type: String, enum: ['PRESENT', 'ABSENT', 'NA'], default: 'PRESENT' },
  comment: { type: String, default: '' },
  markedBy: { type: String, required: true },
  markedByName: { type: String, default: 'Staff' },
  markedByRole: { type: String, enum: ['admin', 'teacher'], default: 'teacher' },
  updatedAt: { type: String, default: () => new Date().toISOString() },
});

const issueSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, default: 'Bug / Technical Issue' },
  priority: { type: String, default: 'Medium' },
  reporterEmail: { type: String, default: '' },
  reporterName: { type: String, default: '' },
  reporterRole: { type: String, default: '' },
  systemInfo: {
    userAgent: { type: String, default: '' },
    screenResolution: { type: String, default: '' },
    activeTab: { type: String, default: '' },
    url: { type: String, default: '' },
    timestamp: { type: String, default: '' }
  },
  status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], default: 'OPEN' },
  developerNotes: { type: String, default: '' },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

const InquiryModel = mongoose.model('Inquiry', inquirySchema);
const BlogPostModel = mongoose.model('BlogPost', blogPostSchema);
const StudentModel = mongoose.model('Student', studentSchema);
const AdmissionModel = mongoose.model('Admission', admissionSchema);
const AttendanceRecordModel = mongoose.model('AttendanceRecord', attendanceRecordSchema);
const IssueModel = mongoose.model('Issue', issueSchema);

const INITIAL_STUDENT_SEED = [
  {
    id: 'std-001',
    name: 'Shailendra Chakravarthy',
    email: 'shailendrachakravarthy8@gmail.com',
    phone: '9866514403/9307031006',
    course: 'Complete DJ training course',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-01',
  },
  {
    id: 'std-002',
    name: 'Deeksha Vishwakarma',
    email: 'deekshavishwakarma705@gmail.com',
    phone: '8319948935/8819007910',
    course: 'Complete DJ training course',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-01',
  },
  {
    id: 'std-003',
    name: 'Sonal Shandilya',
    email: 'Sha.sonal@gmail.com',
    phone: '9798880002',
    course: 'Basic DJ training course',
    batch: 'Weekend Batch',
    enrolledDate: '2026-08-02',
  },
  {
    id: 'std-004',
    name: 'Ridhima Deshpande',
    email: 'ridhimadeshpande990@gmail.com',
    phone: '9527556666',
    course: 'Special 3 months rekordbox course - 50,000',
    batch: 'Special Batch',
    enrolledDate: '2026-08-03',
  },
  {
    id: 'std-005',
    name: 'Pranavadeep Bagul',
    email: 'pranavdeeponly@gmail.com',
    phone: '9322060312',
    course: 'Beginner electronic music production',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-04',
  },
  {
    id: 'std-006',
    name: 'Anuj Aware',
    email: 'anujawasare0457@gmail.com',
    phone: '8975066947',
    course: 'Basic DJ training',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-05',
  },
  {
    id: 'std-007',
    name: 'Chaitanya Jain',
    email: 'djchaitanyajain100@gmail.com',
    phone: '9172902597',
    course: 'Beginner electronic music production',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-06',
  },
  {
    id: 'std-008',
    name: 'Kush Kachoriya',
    email: 'Kk.wav.work@gmail.com',
    phone: '7046029474',
    course: 'Beginner electronic music production',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-07',
  },
  {
    id: 'std-009',
    name: 'Yogesh Kashid',
    email: 'kashidyogesh096@gmail.com',
    phone: '7875547537',
    course: 'Basic DJ training course plus DJ training crash course',
    batch: 'Crash Course Batch',
    enrolledDate: '2026-08-08',
  },
  {
    id: 'std-010',
    name: 'Rohit Govvilkar',
    email: 'rohietgovvilkar@gmail.com',
    phone: '8767607223',
    course: 'Basic training course',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-09',
  },
  {
    id: 'std-011',
    name: 'Devansh Prasad',
    email: 'regurgmusic@gmail.com',
    phone: '9381340066',
    course: 'Basic DJ training course',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-10',
  },
  {
    id: 'std-012',
    name: 'Tavjot Singh',
    email: 'tavjyotsingh76782222@gmail.com',
    phone: '7678115930',
    course: 'Complete DJ training course',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-11',
  },
  {
    id: 'std-013',
    name: 'Sharvil Sonawane',
    email: '',
    phone: '9158979991/9049499991',
    course: 'Beginner electronic music production',
    batch: 'Regular Batch',
    enrolledDate: '2026-08-12',
  },
];

async function autoSeedIfEmpty() {
  try {
    // Seed initial enrolled students if collection is empty
    const studentCount = await StudentModel.countDocuments();
    if (studentCount === 0) {
      await StudentModel.insertMany(INITIAL_STUDENT_SEED);
      console.log(`[SUCCESS] Seeded ${INITIAL_STUDENT_SEED.length} enrolled students in MongoDB Atlas.`);
    }

    // Clean up any stray admission form entries accidentally stored in InquiryModel
    await InquiryModel.deleteMany({
      $or: [
        { courseInterest: { $regex: /\[ADMISSION FORM/i } },
        { message: { $regex: /Official Admission Form Application/i } },
      ],
    });

    // Ensure all inquiry documents in MongoDB Atlas have the 'source' field populated
    const unassignedInquiries = await InquiryModel.find({ $or: [{ source: { $exists: false } }, { source: '' }, { source: null }] });
    for (const inq of unassignedInquiries) {
      const detectedSource = (inq.message && inq.message.toLowerCase().includes('pop-up'))
        ? 'Pop-up Quick Enquiry Form'
        : 'Contact Form';
      await InquiryModel.updateOne({ _id: inq._id }, { $set: { source: detectedSource } });
    }

    // Deduplicate AdmissionModel entries
    const allAdmissions = await AdmissionModel.find();
    const seenSigs = new Set();
    const duplicateIds = [];
    for (const a of allAdmissions) {
      const sig = `${(a.email || '').toLowerCase()}_${(a.courseOpted || '').toLowerCase()}_${a.formType || 'DJ'}`;
      if (seenSigs.has(sig)) {
        duplicateIds.push(a._id);
      } else {
        seenSigs.add(sig);
      }
    }
    if (duplicateIds.length > 0) {
      await AdmissionModel.deleteMany({ _id: { $in: duplicateIds } });
      console.log(`[INFO] Deduplicated ${duplicateIds.length} duplicate admission entries in MongoDB Atlas.`);
    }

    // Seed official articles if legacy posts exist or count < 6
    const hasLegacy = await BlogPostModel.exists({ id: { $in: ['post-1', 'post-2', 'post-3', 'post-4'] } });
    const blogCount = await BlogPostModel.countDocuments();
    if (hasLegacy || blogCount < 6) {
      await BlogPostModel.deleteMany({});
      await BlogPostModel.insertMany([
        {
          id: "1775517370006",
          slug: "best-music-production-course-in-pune-2026",
          title: "Best Music Production Course in Pune 2026: The Complete Guide",
          excerpt: "Everything you need to know about music production training in Pune - from course structure and tools to career paths and fees.",
          category: "ACADEMY NEWS",
          authorName: "Soundabode",
          authorRole: "Academy Editorial",
          metaTitle: "Best Music Production Course in Pune 2026 | Soundabode",
          metaDescription: "Looking for the best music production course in Pune? Discover Soundabode Academy's 4-level program - Ableton Live, real studios & internships. Enroll now.",
          coverImage: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1200&auto=format&fit=crop",
          ogImage: "https://soundabode.com/Assets/og-music-production-pune.jpg",
          focusKeyword: "best music production course in pune",
          publishedAt: "2026-08-01",
          readTimeMinutes: 6,
          isFeatured: true,
          tags: ["Music Production", "Pune", "Ableton Live", "Audio Engineering"],
        },
        {
          id: "1775517372114",
          slug: "how-to-become-a-dj-in-india-2026",
          title: "How to Become a DJ in India in 2026: Step-by-Step Guide for Beginners",
          excerpt: "The complete roadmap from zero experience to your first paid gig - equipment, training, branding, and earning potential.",
          category: "DJING",
          authorName: "Soundabode",
          authorRole: "Academy Editorial",
          metaTitle: "How to Become a DJ in India 2026 | Soundabode Academy",
          metaDescription: "Want to become a DJ in India? Learn the exact steps, equipment, training, and career path to go from beginner to performing DJ. Soundabode's guide covers it all.",
          coverImage: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop",
          ogImage: "https://soundabode.com/Assets/og-dj-india.jpg",
          focusKeyword: "become a dj in india",
          publishedAt: "2026-08-02",
          readTimeMinutes: 7,
          isFeatured: true,
          tags: ["DJing", "Pioneer CDJ", "India DJ Career", "rekordbox"],
        },
        {
          id: "1775517373560",
          slug: "music-producer-salary-in-india-2026",
          title: "Music Producer Salary in India 2026: What You Can Realistically Earn",
          excerpt: "Honest, level-wise salary data for freelancers, studio producers, and film composers across Indian cities.",
          category: "PRODUCTION",
          authorName: "Soundabode",
          authorRole: "Academy Editorial",
          metaTitle: "Music Producer Salary in India 2026 | Soundabode Academy",
          metaDescription: "How much does a music producer earn in India in 2026? Get honest, level-wise salary data for freelancers, studio producers, and film composers across Indian cities.",
          coverImage: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop",
          ogImage: "https://soundabode.com/Assets/og-producer-salary.jpg",
          focusKeyword: "music producer salary in india",
          publishedAt: "2026-08-03",
          readTimeMinutes: 5,
          isFeatured: true,
          tags: ["Music Producer Salary", "Career Guide", "India Music Industry"],
        },
        {
          id: "1775517375303",
          slug: "how-to-learn-ableton-live-in-india-2026",
          title: "How to Learn Ableton Live in India 2026: The Beginner's Complete Guide",
          excerpt: "A structured learning path for India's most popular DAW - from first install to your first finished track.",
          category: "PRODUCTION",
          authorName: "Soundabode",
          authorRole: "Academy Editorial",
          metaTitle: "Learn Ableton Live in India 2026 | Soundabode Academy",
          metaDescription: "New to Ableton Live? Learn how to get started, what to study, and how professional training in Pune gives you a structured path from beginner to working producer.",
          coverImage: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1200&auto=format&fit=crop",
          ogImage: "https://soundabode.com/Assets/og-ableton-live.jpg",
          focusKeyword: "learn ableton live",
          publishedAt: "2026-08-04",
          readTimeMinutes: 6,
          isFeatured: true,
          tags: ["Ableton Live 12", "DAW Tutorial", "Music Production India"],
        },
        {
          id: "1775517376741",
          slug: "audio-engineering-course-in-india-2026",
          title: "Audio Engineering Course in India 2026: Career Scope, Skills & How to Get Started",
          excerpt: "Everything you need to know about audio engineering careers, skills, and India's best diploma program in Pune.",
          category: "ACADEMY NEWS",
          authorName: "Soundabode",
          authorRole: "Academy Editorial",
          metaTitle: "Audio Engineering Course in India 2026 | Soundabode",
          metaDescription: "Thinking about an audio engineering course in India? Discover the career scope, salary potential, top skills to learn, and Pune's best diploma program at Soundabode.",
          coverImage: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1200&auto=format&fit=crop",
          ogImage: "https://soundabode.com/Assets/og-audio-engineering.jpg",
          focusKeyword: "audio engineering course in india",
          publishedAt: "2026-08-05",
          readTimeMinutes: 7,
          isFeatured: true,
          tags: ["Audio Engineering", "Diploma", "Sound Design", "Pune Studio"],
        },
        {
          id: "1775556457040",
          slug: "best-music-production-course-in-india-2026-guide",
          title: "Best Music Production Course in India 2026",
          excerpt: "The Definitive Guide to Professional Audio Careers",
          category: "ACADEMY NEWS",
          authorName: "Soundabode",
          authorRole: "Academy Editorial",
          metaTitle: "Best Music Production Course in India 2026 | Soundabode",
          metaDescription: "Master Ableton Live, Sound Design, and Audio Engineering. Join Soundabode Academy's 4-level music production course in Pune or Online. Real studios & internships.",
          coverImage: "https://images.pexels.com/photos/4143420/pexels-photo-4143420.jpeg",
          ogImage: "https://images.pexels.com/photos/4143420/pexels-photo-4143420.jpeg",
          focusKeyword: "best music production course in india",
          publishedAt: "2026-08-05",
          readTimeMinutes: 8,
          isFeatured: true,
          tags: ["Music Production", "Ableton Live 12", "Berklee", "OTT Audio"],
        },
      ]);
      console.log('[SUCCESS] Populated 6 official blog articles in MongoDB Atlas.');
    }
  } catch (err) {
    console.warn('[WARN] Data auto-seed notice:', err.message);
  }
}

// ─── API ROUTES ────────────────────────────────────────────────────────────────

// AUTH ENDPOINTS
const PRESET_USERS = {
  'admin@soundabode.com': { name: 'Soundabode Admin', role: 'admin', passEnv: 'ADMIN_PASSCODE' },
  'ashu@soundabode.com': { name: 'Ashu', role: 'teacher', passEnv: 'ASHU_PASSCODE' },
  'vaibhav@soundabode.com': { name: 'Vaibhav', role: 'teacher', passEnv: 'VAIBHAV_PASSCODE' },
};

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, passcode } = req.body || {};
  const emailKey = (typeof email === 'string' ? email : '').trim().toLowerCase();
  const passAttempt = (typeof passcode === 'string' ? passcode : '').trim();

  if (!passAttempt) {
    return res.status(400).json({ error: 'Passcode is required.' });
  }

  const adminPass = process.env.ADMIN_PASSCODE;

  // Direct email+passcode match
  if (emailKey && PRESET_USERS[emailKey]) {
    const userConfig = PRESET_USERS[emailKey];
    const expectedPass = process.env[userConfig.passEnv];
    if (expectedPass && (passAttempt === expectedPass || passAttempt === adminPass)) {
      const userObj = { email: emailKey, name: userConfig.name, role: userConfig.role };
      const token = createSession(userObj);
      return res.json({ success: true, user: userObj, token });
    }
  }

  // Match by passcode value alone (no email provided)
  if (!emailKey) {
    for (const [userEmail, userConfig] of Object.entries(PRESET_USERS)) {
      const expectedPass = process.env[userConfig.passEnv];
      if (expectedPass && passAttempt === expectedPass) {
        const userObj = { email: userEmail, name: userConfig.name, role: userConfig.role };
        const token = createSession(userObj);
        return res.json({ success: true, user: userObj, token });
      }
    }
  }

  return res.status(401).json({ error: 'Invalid credentials. Check your email address and passcode.' });
});

// Change passcode — admin only
app.post('/api/auth/change-passcode', requireAuth, requireAdmin, (req, res) => {
  // Note: changing ADMIN_PASSCODE dynamically in-process is supported.
  // For permanent changes, update server/.env and restart.
  const { newPasscode } = req.body || {};
  const cleanedPasscode = typeof newPasscode === 'string' ? newPasscode.trim() : '';
  if (!cleanedPasscode) {
    return res.status(400).json({ error: 'New passcode cannot be empty.' });
  }
  // Update the runtime env value (in-process only; restarts reset to .env value)
  process.env.ADMIN_PASSCODE = cleanedPasscode;
  res.json({ success: true, message: 'Admin passcode updated for this session. Update server/.env to persist across restarts.' });
});

// Root Landing Route — public server welcome & API status
app.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({
    name: 'Soundabode Backend API',
    status: 'online',
    version: '1.0.0',
    mongodb: dbStatusMap[dbState] || 'unknown',
    endpoints: {
      health: '/api/health',
      posts: '/api/posts',
      testSheets: '/api/test-google-sheets',
    },
  });
});

// Health Check & DB Status — public (safe, no sensitive data)
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({
    status: 'ok',
    mongodb: dbStatusMap[dbState] || 'unknown',
    uriConfigured: Boolean(process.env.MONGODB_URI),
  });
});


// Clear All Data — admin only
app.delete('/api/clear-all-data', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await InquiryModel.deleteMany({});
      await StudentModel.deleteMany({});
      await AdmissionModel.deleteMany({});
      await BlogPostModel.deleteMany({});
    }
    res.json({ success: true, message: 'All data purged successfully from MongoDB Atlas.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GOOGLE SHEETS FORWARDER ───────────────────────────────────────────────────
const recentForwardedLeads = new Map();

async function forwardToGoogleSheets(rawPayload) {
  if (!rawPayload || typeof rawPayload !== 'object') return;

  const payload = {
    name: typeof rawPayload.name === 'string' ? rawPayload.name : '',
    fullName: typeof rawPayload.fullName === 'string' ? rawPayload.fullName : '',
    firstName: typeof rawPayload.firstName === 'string' ? rawPayload.firstName : '',
    lastName: typeof rawPayload.lastName === 'string' ? rawPayload.lastName : '',
    phone: typeof rawPayload.phone === 'string' ? rawPayload.phone : '',
    cellPhone: typeof rawPayload.cellPhone === 'string' ? rawPayload.cellPhone : '',
    email: typeof rawPayload.email === 'string' ? rawPayload.email : '',
    course: typeof rawPayload.course === 'string' ? rawPayload.course : '',
    courseInterest: typeof rawPayload.courseInterest === 'string' ? rawPayload.courseInterest : '',
    courseOpted: typeof rawPayload.courseOpted === 'string' ? rawPayload.courseOpted : '',
    source: typeof rawPayload.source === 'string' ? rawPayload.source : '',
    message: typeof rawPayload.message === 'string' ? rawPayload.message : '',
    formNo: typeof rawPayload.formNo === 'string' ? rawPayload.formNo : '',
    submittedAt: typeof rawPayload.submittedAt === 'string' ? rawPayload.submittedAt : '',
    studentId: typeof rawPayload.studentId === 'string' ? rawPayload.studentId : '',
    date: typeof rawPayload.date === 'string' ? rawPayload.date : '',
    timeSlot: typeof rawPayload.timeSlot === 'string' ? rawPayload.timeSlot : '',
    status: typeof rawPayload.status === 'string' ? rawPayload.status : '',
  };

  const rawSheetsUrl = (process.env.GOOGLE_SHEETS_URL || process.env.VITE_GOOGLE_SHEETS_URL || '').trim();

  if (!rawSheetsUrl || !rawSheetsUrl.startsWith('https://script.google.com/macros/s/')) {
    console.info('[INFO] [Google Sheets] Notice: GOOGLE_SHEETS_URL is not set or invalid.');
    return;
  }

  let validatedUrl = null;
  try {
    const parsed = new URL(rawSheetsUrl);
    if (parsed.protocol === 'https:' && parsed.hostname === 'script.google.com' && parsed.pathname.startsWith('/macros/s/')) {
      validatedUrl = parsed;
    } else {
      console.warn('[WARN] [Google Sheets] Blocked untrusted URL destination.');
      return;
    }
  } catch {
    return;
  }

  if (!validatedUrl) return;

  // Deduplication signature (30 second window)
  const isAttendance = payload.studentId && payload.date && payload.timeSlot;
  const leadId = typeof rawPayload.id === 'string' ? rawPayload.id : '';
  const cleanEmail = payload.email && payload.email !== 'N/A' ? payload.email : '';
  const cleanPhone = payload.phone || '';
  const cleanName = payload.name || payload.fullName || payload.firstName || '';
  
  const signature = isAttendance
    ? `att-${payload.studentId}-${payload.date}-${payload.timeSlot}-${payload.status}`
    : (leadId
      ? `lead-id-${leadId}`
      : `lead-${cleanPhone || cleanEmail || cleanName}-${payload.source || payload.course}`);

  const now = Date.now();
  const lastForward = recentForwardedLeads.get(signature);
  if (lastForward && now - lastForward < 30000) {
    console.log(`[INFO] [Server Google Sheets] Suppressed duplicate forward for (${signature}) within 30s`);
    return;
  }
  recentForwardedLeads.set(signature, now);

  if (recentForwardedLeads.size > 100) {
    for (const [k, ts] of recentForwardedLeads.entries()) {
      if (now - ts > 30000) recentForwardedLeads.delete(k);
    }
  }

  const leadName =
    payload.name ||
    payload.fullName ||
    `${payload.firstName} ${payload.lastName}`.trim() ||
    'Anonymous Prospect';
  const leadPhone = payload.phone || payload.cellPhone;
  const leadEmail = payload.email;
  const leadCourse =
    payload.course || payload.courseInterest || payload.courseOpted || 'General Inquiry';
  const leadSource =
    payload.source ||
    (payload.message.includes('Pop-up') ? 'Pop-up Quick Enquiry Form' : 'Contact Form');

  console.log('[INFO] [Server] New lead received:', leadName, leadPhone, leadCourse);

  const jsonPayload = {
    fullName: String(leadName),
    name: String(leadName),
    phone: String(leadPhone),
    email: String(leadEmail),
    course: String(leadCourse),
    interest: String(leadCourse),
    courseInterest: String(leadCourse),
    source: String(leadSource),
    message: String(payload.message),
    formNo: String(payload.formNo),
    submittedAt: String(payload.submittedAt || new Date().toISOString()),
  };

  try {
    const fetchFn = globalThis.fetch || (typeof fetch !== 'undefined' ? fetch : null);
    if (!fetchFn) {
      console.error('[ERROR] [Google Sheets] Native fetch API is not available in Node environment.');
      return;
    }
    const response = await fetchFn(validatedUrl.href, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(jsonPayload),
      redirect: 'follow',
    });

    const responseText = await response.text();
    console.log('[SUCCESS] [Google Sheets] Apps Script Output Status:', response.status, String(responseText));
  } catch (err) {
    console.error('[ERROR] [Google Sheets Error]:', err.message);
  }
}

// ─── INQUIRIES / LEADS ─────────────────────────────────────────────────────────
app.get('/api/test-google-sheets', async (req, res) => {
  const sheetsUrl = process.env.GOOGLE_SHEETS_URL || process.env.VITE_GOOGLE_SHEETS_URL;
  if (!sheetsUrl) {
    return res.status(400).json({
      success: false,
      error: 'GOOGLE_SHEETS_URL is not set in server/.env.',
    });
  }

  await forwardToGoogleSheets({
    name: 'Test Prospect',
    phone: '9999999999',
    email: 'test@soundabode.com',
    courseInterest: 'DJ Training Course',
    source: 'Test Trigger Route',
  });

  res.json({
    success: true,
    message: 'Test lead dispatched to Google Sheets! Check server console log.',
    sheetsUrl,
  });
});

app.get('/api/test-attendance-sheets', async (req, res) => {
  const sheetsUrl = process.env.GOOGLE_SHEETS_URL || process.env.VITE_GOOGLE_SHEETS_URL;
  if (!sheetsUrl) {
    return res.status(400).json({
      success: false,
      error: 'GOOGLE_SHEETS_URL is not set in server/.env.',
    });
  }

  await forwardToGoogleSheets({
    name: 'Rahul Sharma',
    phone: '9876543210',
    email: 'rahul@example.com',
    courseInterest: 'DJ Training (Batch A)',
    source: 'Student Attendance (PRESENT)',
    message: 'Date: 2026-08-14 | Slot: 11:00 AM - 01:00 PM | Status: PRESENT | Marked By: Ashu | Comments: Test attendance log',
    sheetName: 'attendence',
  });

  res.json({
    success: true,
    message: 'Test attendance record dispatched to Google Sheets! Check server console log.',
    sheetsUrl,
  });
});

app.get('/api/inquiries', requireAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const inquiries = await InquiryModel.find().sort({ submittedAt: -1 });
      return res.json(inquiries);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inquiries', async (req, res) => {
  // Public endpoint — contact form submissions (no auth required)
  try {
    const inquiryData = req.body;
    if (!inquiryData.id) inquiryData.id = `inq-${Date.now()}`;
    if (!inquiryData.submittedAt) inquiryData.submittedAt = new Date().toISOString();
    if (!inquiryData.status) inquiryData.status = 'NEW';

    // Forward to Google Sheets server-side
    forwardToGoogleSheets(inquiryData);

    if (mongoose.connection.readyState === 1) {
      const inquiry = new InquiryModel(inquiryData);
      await inquiry.save();
      return res.status(201).json(inquiry);
    }
    res.status(201).json(inquiryData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/inquiries/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    if (mongoose.connection.readyState === 1) {
      const updated = await InquiryModel.findOneAndUpdate({ id }, updates, { new: true });
      return res.json(updated);
    }
    res.json({ id, ...updates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function buildDeleteQuery(id) {
  const cleanId = String(id || '').trim();
  const conditions = [{ id: cleanId }];
  if (mongoose.Types.ObjectId.isValid(cleanId)) {
    conditions.push({ _id: new mongoose.Types.ObjectId(cleanId) });
    conditions.push({ _id: cleanId });
  }
  return { $or: conditions };
}

app.delete('/api/inquiries/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (mongoose.connection.readyState === 1) {
      const result = await InquiryModel.deleteMany(buildDeleteQuery(id));
      console.log(`[DELETE] Deleted ${result.deletedCount} inquiry(ies) matching ${id}`);
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMISSIONS ────────────────────────────────────────────────────────────────
app.get('/api/admissions', requireAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const admissions = await AdmissionModel.find().sort({ submittedAt: -1 });
      return res.json(admissions);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admissions', async (req, res) => {
  // Public endpoint — admission form submissions
  try {
    const admissionData = req.body;
    if (!admissionData.id) admissionData.id = `adm-${Date.now()}`;
    if (!admissionData.submittedAt) admissionData.submittedAt = new Date().toISOString();
    if (!admissionData.status) admissionData.status = 'NEW';

    // Forward to Google Sheets server-side
    forwardToGoogleSheets({
      ...admissionData,
      source: `Official Admission Form (${admissionData.formType || 'DJ/EMP'})`,
    });

    if (mongoose.connection.readyState === 1) {
      const admission = await AdmissionModel.findOneAndUpdate(
        { id: admissionData.id },
        admissionData,
        { upsert: true, new: true }
      );
      return res.status(201).json(admission);
    }
    res.status(201).json(admissionData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admissions/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    if (mongoose.connection.readyState === 1) {
      const updated = await AdmissionModel.findOneAndUpdate({ id }, updates, { new: true });
      if (updated && updates.status === 'ENROLLED') {
        const studentName = `${updated.firstName} ${updated.lastName}`.trim();
        await StudentModel.findOneAndUpdate(
          { email: updated.email || studentName },
          {
            id: `std-${Date.now()}`,
            name: studentName,
            email: updated.email || '',
            phone: updated.cellPhone || '',
            course: updated.courseOpted || 'DJ Training Course',
            batch: `${updated.formType === 'DJ' ? 'Regular DJ Studio Batch' : 'Regular EMP Studio Batch'}`,
            enrolledDate: new Date().toISOString().split('T')[0],
          },
          { upsert: true, new: true }
        );
      }
      return res.json(updated);
    }
    res.json({ id, ...updates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admissions/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (mongoose.connection.readyState === 1) {
      const result = await AdmissionModel.deleteMany(buildDeleteQuery(id));
      console.log(`[DELETE] Deleted ${result.deletedCount} admission(s) matching ${id}`);
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ATTENDANCE ────────────────────────────────────────────────────────────────
app.get('/api/attendance', requireAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const records = await AttendanceRecordModel.find().sort({ updatedAt: -1 });
      return res.json(records);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance', async (req, res) => {
  try {
    const recordData = req.body;
    if (!recordData.id) recordData.id = `att-${Date.now()}`;
    if (!recordData.updatedAt) recordData.updatedAt = new Date().toISOString();

    if (mongoose.connection.readyState === 1) {
      const record = await AttendanceRecordModel.findOneAndUpdate(
        { id: recordData.id },
        recordData,
        { upsert: true, new: true }
      );
      return res.status(201).json(record);
    }
    res.status(201).json(recordData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/attendance', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await AttendanceRecordModel.deleteMany({});
      return res.json({ success: true, message: 'All attendance records purged.' });
    }
    res.json({ success: true, message: 'Local attendance cleared.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/attendance/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (mongoose.connection.readyState === 1) {
      const result = await AttendanceRecordModel.deleteMany(buildDeleteQuery(id));
      console.log(`[DELETE] Deleted ${result.deletedCount} attendance record(s) matching ${id}`);
      return res.json({ success: true, deletedCount: result.deletedCount, id });
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── BLOG POSTS ────────────────────────────────────────────────────────────────
app.get('/api/posts', async (req, res) => {
  // Public endpoint — blog posts visible to site visitors
  try {
    if (mongoose.connection.readyState === 1) {
      const posts = await BlogPostModel.find().sort({ publishedAt: -1 });
      return res.json(posts);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/posts', requireAuth, async (req, res) => {
  try {
    const postData = req.body;
    if (mongoose.connection.readyState === 1) {
      const post = await BlogPostModel.findOneAndUpdate({ id: postData.id }, postData, {
        upsert: true,
        new: true,
      });
      return res.status(201).json(post);
    }
    res.status(201).json(postData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/posts/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (mongoose.connection.readyState === 1) {
      const result = await BlogPostModel.deleteMany(buildDeleteQuery(id));
      console.log(`[DELETE] Deleted ${result.deletedCount} blog post(s) matching ${id}`);
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STUDENTS ──────────────────────────────────────────────────────────────────
app.get('/api/students', requireAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      let students = await StudentModel.find();
      if (!students || students.length === 0) {
        await StudentModel.insertMany(INITIAL_STUDENT_SEED);
        students = await StudentModel.find();
      }
      return res.json(students);
    }
    res.json(INITIAL_STUDENT_SEED);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students', requireAuth, async (req, res) => {
  try {
    const studentData = req.body;
    if (!studentData.id) studentData.id = `std-${Date.now()}`;
    if (mongoose.connection.readyState === 1) {
      const student = await StudentModel.findOneAndUpdate({ id: studentData.id }, studentData, {
        upsert: true,
        new: true,
      });
      return res.status(201).json(student);
    }
    res.status(201).json(studentData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/students/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name } = req.query;
    if (mongoose.connection.readyState === 1) {
      const cleanId = String(id || '').trim();
      const queryConditions = [
        { id: cleanId },
        { name: cleanId },
        { email: cleanId },
      ];

      if (email && typeof email === 'string') {
        queryConditions.push({ email: email.trim() });
      }
      if (name && typeof name === 'string') {
        queryConditions.push({ name: name.trim() });
      }
      if (mongoose.Types.ObjectId.isValid(cleanId)) {
        queryConditions.push({ _id: new mongoose.Types.ObjectId(cleanId) });
        queryConditions.push({ _id: cleanId });
      }

      const result = await StudentModel.deleteMany({ $or: queryConditions });
      console.log(`[DELETE] Deleted ${result.deletedCount} student(s) matching id/email/name: ${id} / ${email || ''} / ${name || ''}`);
      return res.json({ success: true, deletedCount: result.deletedCount, id });
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DEVELOPER ISSUES ENDPOINTS ──────────────────────────────────────────────
app.get('/api/issues', requireAuth, async (req, res) => {
  try {
    if (isConnected) {
      const issues = await IssueModel.find().sort({ createdAt: -1 }).lean();
      return res.json({ success: true, issues });
    }
    res.json({ success: true, issues: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ZOHO MAIL SMTP TRANSPORTER ──────────────────────────────────────────────
let mailTransporter = null;

function getMailTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.zoho.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE !== 'false';
  const user = process.env.SMTP_USER || 'services@soundabode.com';
  const pass = process.env.SMTP_PASS || '';

  if (!pass) {
    return null;
  }

  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });
  }
  return mailTransporter;
}

async function sendEmail({ to, subject, text, html, replyTo }) {
  const transporter = getMailTransporter();
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'services@soundabode.com';
  const fromName = process.env.SMTP_FROM_NAME || 'Soundabode Studios';

  if (!transporter) {
    console.warn(`[SMTP NOTICE] Email to ${to} queued/logged locally. (Set SMTP_PASS in server/.env to enable live Zoho Mail sending)`);
    return { success: false, mode: 'local_logged', reason: 'SMTP_PASS not set in environment' };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text,
      html: html || text,
      replyTo: replyTo || fromEmail,
    });
    console.log(`[SMTP SUCCESS] Sent email to ${to} [MessageID: ${info.messageId}]`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[SMTP ERROR] Failed sending to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

const DEVELOPER_TARGET_EMAIL = process.env.DEVELOPER_TARGET_EMAIL || 'devangdhakate22@gmail.com';
const DEVELOPER_SENDER_EMAIL = process.env.SMTP_FROM_EMAIL || 'services@soundabode.com';

app.post('/api/issues', requireAuth, async (req, res) => {
  try {
    const { title, description, category, priority, systemInfo, reporterEmail, reporterName, reporterRole, id } = req.body || {};
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required.' });
    }

    const issueId = id || `issue_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const user = req.sessionUser || {};

    const issueData = {
      id: issueId,
      title: String(title).trim(),
      description: String(description).trim(),
      category: category || 'Bug / Technical Issue',
      priority: priority || 'Medium',
      reporterEmail: reporterEmail || user.email || '',
      reporterName: reporterName || user.name || '',
      reporterRole: reporterRole || user.role || '',
      systemInfo: systemInfo || {},
      status: 'OPEN',
      createdAt: new Date().toISOString()
    };

    console.log(`[DEVELOPER ISSUE DISPATCH] Target: ${DEVELOPER_TARGET_EMAIL} | From: ${DEVELOPER_SENDER_EMAIL} | Issue: "${issueData.title}" by ${issueData.reporterName} (${issueData.reporterEmail})`);

    // Dispatch automated email via Zoho Mail SMTP
    const emailSubject = `[CMS Issue Report] [${issueData.priority}] ${issueData.title}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #121316; color: #ffffff; padding: 20px; border-radius: 10px;">
        <h2 style="color: #ef4444; border-bottom: 1px solid #333; padding-bottom: 10px;">🚨 Soundabode CMS Issue Report</h2>
        <p><strong>Title:</strong> ${escapeHtml(issueData.title)}</p>
        <p><strong>Category:</strong> ${escapeHtml(issueData.category)}</p>
        <p><strong>Priority:</strong> <span style="background: #ef4444; color: #fff; padding: 3px 8px; border-radius: 4px; font-weight: bold;">${escapeHtml(issueData.priority)}</span></p>
        <p><strong>Reporter:</strong> ${escapeHtml(issueData.reporterName)} (${escapeHtml(issueData.reporterEmail)}) — <em>Role: ${escapeHtml(issueData.reporterRole)}</em></p>
        <hr style="border-color: #333;" />
        <h3 style="color: #cbd5e1;">Issue Details:</h3>
        <div style="background: #191b1f; padding: 12px; border-radius: 6px; white-space: pre-wrap; color: #f1f5f9;">${escapeHtml(issueData.description)}</div>
        <h3 style="color: #cbd5e1; margin-top: 15px;">System Diagnostics:</h3>
        <div style="background: #191b1f; padding: 10px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #94a3b8;">
          Active Tab: ${escapeHtml(issueData.systemInfo?.activeTab || 'N/A')}<br />
          Browser: ${escapeHtml(issueData.systemInfo?.userAgent || 'N/A')}<br />
          Screen: ${escapeHtml(issueData.systemInfo?.screenResolution || 'N/A')}<br />
          Timestamp: ${escapeHtml(issueData.systemInfo?.timestamp || new Date().toISOString())}
        </div>
      </div>
    `;

    const emailResult = await sendEmail({
      to: DEVELOPER_TARGET_EMAIL,
      subject: emailSubject,
      text: issueData.description,
      html: emailHtml,
      replyTo: issueData.reporterEmail || undefined,
    });

    if (isConnected) {
      const saved = await IssueModel.create(issueData);
      console.log(`[DEVELOPER ISSUE] Created MongoDB issue record ${saved.id}`);
      return res.json({ success: true, issue: saved, sentTo: DEVELOPER_TARGET_EMAIL, sentFrom: DEVELOPER_SENDER_EMAIL, emailStatus: emailResult });
    }

    res.json({ success: true, issue: issueData, sentTo: DEVELOPER_TARGET_EMAIL, sentFrom: DEVELOPER_SENDER_EMAIL, emailStatus: emailResult });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STUDENT EMAIL REMINDERS ENDPOINT ──────────────────────────────────────
app.post('/api/students/send-reminder', requireAuth, async (req, res) => {
  try {
    const { studentEmail, studentName, subject, message, reminderType, courseName } = req.body || {};
    if (!studentEmail || !subject || !message) {
      return res.status(400).json({ error: 'Student email, subject, and message are required.' });
    }

    const typeTitle = reminderType === 'FEE_PAYMENT' ? 'Fee Payment Reminder'
      : reminderType === 'ATTENDANCE' ? 'Class Attendance Notice'
      : reminderType === 'CLASS_SCHEDULE' ? 'Class Schedule Update'
      : 'Studio Announcement';

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #08090a; color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #222;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #e11d48; margin: 0; font-size: 24px; letter-spacing: 1px;">SOUNDABODE STUDIOS</h2>
          <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">${escapeHtml(typeTitle)}</p>
        </div>

        <p style="font-size: 15px; color: #f1f5f9;">Dear <strong>${escapeHtml(studentName || 'Student')}</strong>,</p>

        <div style="background: #121316; border-left: 4px solid #e11d48; padding: 16px; margin: 16px 0; border-radius: 4px; color: #e2e8f0; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(message)}</div>

        ${courseName ? `<p style="font-size: 13px; color: #94a3b8;"><strong>Course:</strong> ${escapeHtml(courseName)}</p>` : ''}

        <hr style="border-color: #222; margin: 24px 0;" />
        <div style="font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">
          <strong>Soundabode Studios & Academy</strong><br />
          Shop 218, Vision 9 Mall, Pimple Saudagar, Pune – 411017<br />
          Phone: +91 9975016189 | Email: <a href="mailto:services@soundabode.com" style="color: #e11d48;">services@soundabode.com</a>
        </div>
      </div>
    `;

    const emailResult = await sendEmail({
      to: String(studentEmail).trim(),
      subject: String(subject).trim(),
      text: String(message),
      html: htmlBody,
    });

    console.log(`[STUDENT REMINDER] Sent ${reminderType || 'GENERAL'} reminder to ${studentEmail} by ${req.sessionUser?.name || 'Admin'}`);
    return res.json({
      success: true,
      message: `Reminder email dispatched to ${studentEmail}`,
      emailResult,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/issues/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, developerNotes } = req.body || {};

    if (isConnected) {
      const updated = await IssueModel.findOneAndUpdate(
        { $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] },
        { $set: { ...(status ? { status } : {}), ...(developerNotes !== undefined ? { developerNotes } : {}), updatedAt: new Date().toISOString() } },
        { new: true }
      );
      return res.json({ success: true, issue: updated });
    }
    res.json({ success: true, id, status, developerNotes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/issues/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (isConnected) {
      await IssueModel.deleteOne({ $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] });
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Server Startup & Dashboard ────────────────────────────────────────────────
function printStartupDashboard(port) {
  const sheetsUrl = (process.env.GOOGLE_SHEETS_URL || process.env.VITE_GOOGLE_SHEETS_URL || '').trim();
  const sheetsConfigured = Boolean(sheetsUrl && sheetsUrl.startsWith('https://script.google.com/macros/s/'));
  const mongoConfigured = Boolean(process.env.MONGODB_URI);

  const adminPassSet = Boolean(process.env.ADMIN_PASSCODE);
  const ashuPassSet = Boolean(process.env.ASHU_PASSCODE);
  const vaibhavPassSet = Boolean(process.env.VAIBHAV_PASSCODE);

  console.log('\n' + '='.repeat(80));
  console.log('               SOUNDABODE BACKEND API - CONNECTED MODULES MATRIX             ');
  console.log('='.repeat(80));

  console.log('\n[SERVER & ENVIRONMENT]');
  console.log(`  Production Domain: https://soundabode.com`);
  console.log(`  Local Server URL : http://localhost:${port}`);
  console.log(`  Health Endpoint  : http://localhost:${port}/api/health`);
  console.log(`  Environment      : ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Node.js Version  : ${process.version}`);
  console.log(`  Process ID (PID) : ${process.pid}`);

  console.log('\n[SECURITY & CONFIGURATION]');
  console.log(`  Helmet Headers   : ${helmet ? '[OK] Active (Security Headers & CSP Enabled)' : '[WARN] Disabled (helmet not installed)'}`);
  console.log(`  Security Headers : [OK] Active (nosniff, DENY, HSTS, Permissions-Policy, Referrer-Policy)`);
  console.log(`  Auth Rate Limit  : ${rateLimit ? '[OK] Active (10 attempts / 15 min)' : '[WARN] Disabled (express-rate-limit not installed)'}`);
  console.log(`  CORS Origins     : ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`  MongoDB Atlas    : ${mongoConfigured ? '[OK] URI Configured' : '[ERROR] MONGODB_URI Missing'}`);
  console.log(`  Google Sheets    : ${sheetsConfigured ? '[OK] Connected Webhook Target' : '[WARN] Not Configured or Invalid URL'}`);

  console.log('\n[PRESET USER ACCOUNTS & AUTHENTICATION]');
  console.log(`  1. admin@soundabode.com   [Role: admin]   Passcode ENV: ${adminPassSet ? '[OK] ADMIN_PASSCODE set' : '[WARN] Default / Missing'}`);
  console.log(`  2. ashu@soundabode.com    [Role: teacher] Passcode ENV: ${ashuPassSet ? '[OK] ASHU_PASSCODE set' : '[WARN] Default / Missing'}`);
  console.log(`  3. vaibhav@soundabode.com [Role: teacher] Passcode ENV: ${vaibhavPassSet ? '[OK] VAIBHAV_PASSCODE set' : '[WARN] Default / Missing'}`);

  console.log('\n[DATABASE SCHEMAS & MONGOOSE MODELS]');
  console.log('  1. Inquiry          -> Model: Inquiry          (Leads, Contact & Pop-up Inquiries)');
  console.log('  2. BlogPost         -> Model: BlogPost         (CMS News Articles & Guides)');
  console.log('  3. Student          -> Model: Student          (Enrolled Students Roster)');
  console.log('  4. Admission        -> Model: Admission        (DJ & EMP Admission Applications)');
  console.log('  5. AttendanceRecord -> Model: AttendanceRecord (Class Attendance Sheet Logs)');

  console.log('\n[CONNECTED API ENDPOINTS]');
  console.log('  --- AUTHENTICATION ---');
  console.log('  POST   /api/auth/login              [PUBLIC] -> User Login & Session Token Dispatch');
  console.log('  POST   /api/auth/change-passcode    [ADMIN]  -> Update Admin Runtime Passcode');
  console.log('');
  console.log('  --- SYSTEM DIAGNOSTICS ---');
  console.log('  GET    /api/health                  [PUBLIC] -> Check Server & MongoDB Connection Status');
  console.log('  DELETE /api/clear-all-data          [ADMIN]  -> Purge All MongoDB Collections');
  console.log('');
  console.log('  --- LEAD INQUIRIES ---');
  console.log('  GET    /api/inquiries               [AUTH]   -> Fetch All Lead Inquiries');
  console.log('  POST   /api/inquiries               [PUBLIC] -> Submit Contact / Pop-Up Lead');
  console.log('  PATCH  /api/inquiries/:id           [AUTH]   -> Update Lead Status & Notes');
  console.log('  DELETE /api/inquiries/:id           [AUTH]   -> Delete Single Lead Record');
  console.log('');
  console.log('  --- ADMISSION APPLICATIONS ---');
  console.log('  GET    /api/admissions              [AUTH]   -> Fetch All Admission Applications');
  console.log('  POST   /api/admissions              [PUBLIC] -> Submit Official DJ/EMP Admission Form');
  console.log('  PATCH  /api/admissions/:id          [AUTH]   -> Update Application & Auto-Enroll Student');
  console.log('  DELETE /api/admissions/:id          [AUTH]   -> Delete Admission Record');
  console.log('');
  console.log('  --- ATTENDANCE SYSTEM ---');
  console.log('  GET    /api/attendance              [AUTH]   -> Fetch Attendance Sheet Records');
  console.log('  POST   /api/attendance              [PUBLIC] -> Mark/Sync Attendance Record');
  console.log('  DELETE /api/attendance              [ADMIN]  -> Purge All Attendance Sheet Records');
  console.log('  DELETE /api/attendance/:id          [AUTH]   -> Delete Single Attendance Record');
  console.log('');
  console.log('  --- CMS & BLOG POSTS ---');
  console.log('  GET    /api/posts                   [PUBLIC] -> Fetch Published Blog Articles');
  console.log('  POST   /api/posts                   [AUTH]   -> Create or Update Blog Article');
  console.log('  DELETE /api/posts/:id               [AUTH]   -> Delete Blog Article');
  console.log('');
  console.log('  --- STUDENT MANAGEMENT ---');
  console.log('  GET    /api/students                [AUTH]   -> Fetch Enrolled Students List');
  console.log('  POST   /api/students                [AUTH]   -> Create or Update Student Record');
  console.log('  DELETE /api/students/:id            [AUTH]   -> Delete Student Record');
  console.log('');
  console.log('  --- GOOGLE SHEETS WEBHOOK INTEGRATIONS ---');
  console.log('  GET    /api/test-google-sheets      [PUBLIC] -> Test Lead Forwarding to Google Sheets');
  console.log('  GET    /api/test-attendance-sheets  [PUBLIC] -> Test Attendance Forwarding to Google Sheets');
  console.log('='.repeat(80) + '\n');
}

function startServer(portToUse) {
  const host = process.env.HOST || '0.0.0.0';
  const server = app.listen(portToUse, host, () => {
    printStartupDashboard(portToUse);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[WARN] Port ${portToUse} is in use. Trying port ${portToUse + 1}...`);
      startServer(portToUse + 1);
    } else {
      console.error('[ERROR] Server error:', err);
    }
  });
}

startServer(PORT);
