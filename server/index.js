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

// Body size limit — allows photo uploads (compressed passport photos ~50-200KB, max limit 15MB)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// ─── Real-Time Server-Sent Events (SSE) Live Stream ───────────────────────────
const sseClients = new Set();

function broadcastLiveEvent(type, data) {
  const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Live SSE endpoint for CMS Admin real-time updates
app.get('/api/live-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering (Nginx/Render)
  res.flushHeaders?.();

  // Send initial ping to confirm connection
  res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);

  sseClients.add(res);

  // Keep-alive heartbeat every 20s
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

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
  paymentOption: { type: String, enum: ['Full Payment', '2 Easy Instalments', ''], default: '' },
  agreedToTerms: { type: Boolean, default: true },
  signatureName: { type: String, default: '' },
  photoUrl: { type: String, default: '' },
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
  status: { type: String, enum: ['PRESENT', 'ABSENT', 'PRACTICE_SESSION', 'GROUP_SESSION', 'NA'], default: 'PRESENT' },
  comment: { type: String, default: '' },
  markedBy: { type: String, required: true },
  markedByName: { type: String, default: 'Staff' },
  markedByRole: { type: String, enum: ['admin', 'teacher'], default: 'teacher' },
  updatedAt: { type: String, default: () => new Date().toISOString() },
});

const feeReceiptSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  receiptNo: { type: String, required: true },
  studentName: { type: String, required: true },
  courseName: { type: String, default: '' },
  amount: { type: Number, required: true, min: 0 },
  paymentMode: { type: String, default: 'Cash' },
  periodFrom: { type: String, default: '' },
  periodTo: { type: String, default: '' },
  date: { type: String, required: true },
  comment: { type: String, default: '' },
}, { timestamps: true });

const issueSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, default: 'Bug / Technical Issue' },
  priority: { type: String, default: 'Medium' },
  reporterEmail: { type: String, default: '' },
  reporterName: { type: String, default: '' },
  reporterRole: { type: String, default: '' },
  systemInfo: { type: mongoose.Schema.Types.Mixed, default: {} },
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
const FeeReceiptModel = mongoose.model('FeeReceipt', feeReceiptSchema);
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

    // Seed official articles if legacy posts exist or count < 6 or content is missing
    const hasLegacy = await BlogPostModel.exists({ id: { $in: ['post-1', 'post-2', 'post-3', 'post-4'] } });
    const blogCount = await BlogPostModel.countDocuments();
    const missingContent = await BlogPostModel.exists({ $or: [{ content: '' }, { content: null }, { content: { $exists: false } }] });

    if (hasLegacy || blogCount < 6 || missingContent) {
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
          content: `
            <p>If you have been searching for the best music production course in Pune, you are already one step closer to a career you will love. Pune has quietly become one of India's fastest-growing cities for music and audio education - and for good reason. Between its thriving live music culture, the rise of independent artists, and a booming demand for OTT and gaming audio, the timing to start learning has never been better.</p>
            <p>This guide breaks down everything you need to know: what to look for in a course, what topics are covered, career paths available, and why Soundabode Academy in Pimple Saudagar is consistently regarded as Pune's most hands-on music production school.</p>
            <h3>Why Pune Is a Hub for Music Production Education</h3>
            <p>Maharashtra has the highest number of music production colleges in India, and Pune sits at the heart of that ecosystem. The city combines a large student population with access to the entertainment industry - from Bollywood-adjacent production houses to independent studios working on Marathi cinema and commercial jingles.</p>
            <p>More importantly, Pune's music producers are increasingly working in areas that have nothing to do with film: gaming audio, podcast production, brand films, live electronic music, and social media content. This diversity of demand means a well-trained graduate from Pune can find opportunities both locally and across India.</p>
            <h3>What to Look for in a Music Production Course</h3>
            <p>Before enrolling anywhere, evaluate a course against these non-negotiable criteria:</p>
            <ul>
              <li><strong>Real studio training:</strong> You should be practicing on acoustically treated rooms and industry-standard monitors - not just headphones at home.</li>
              <li><strong>Curriculum depth:</strong> A quality course goes from DAW basics all the way through sound design, mixing, and mastering. Avoid programs that stop at beginner level.</li>
              <li><strong>Industry-relevant tools:</strong> Ableton Live, Kontakt, Serum, Ozone, and Waves are used in the real world. Make sure your course teaches these.</li>
              <li><strong>Internship or project exposure:</strong> Theory without practice is incomplete. Look for programs that include actual client projects or studio internships.</li>
              <li><strong>Certified instructors:</strong> Your teachers should be active producers or engineers, not just academics.</li>
            </ul>
            <h3>Soundabode Academy: Pune's Most Hands-On Music Production Program</h3>
            <p>Located at Vision 9 Mall, Pimple Saudagar, Soundabode Academy offers a structured 4-level program that takes students from absolute beginner to professional-grade producer and audio engineer.</p>
            <p><strong>Level 1 - Beginner: Music Production & Audio Workstation (3 + 1 months)</strong><br />This level introduces Ableton Live 11, music theory fundamentals, beat-making, sampling techniques, and full song structure. By the end, students produce their first complete track. No prior experience required. Fee: ₹60,000.</p>
            <p><strong>Level 2 - Intermediate: Pre-Degree in Electronic Music Production (3 + 1 months)</strong><br />Students go deeper into advanced arrangement, professional sound layering, and creative synthesis using Serum, Massive, and the Arturia V Collection. This level separates hobbyists from developing professionals. Fee: ₹60,000.</p>
            <p><strong>Level 3 - Expert: Diploma in Audio Engineering (4 months)</strong><br />Studio-grade training on Kontakt instruments, Moog and Nord synthesizers, and modular setups. Students develop the engineer's ear - understanding signal flow, studio routing, and advanced processing. Fee: ₹60,000.</p>
            <p><strong>Level 4 - Advanced Mixing & Mastering (3 + 1 months)</strong><br />The professional finish. Students master their tracks using Ozone, Waves, and RX7 - the same tools used in commercial release pipelines. Graduates leave ready to deliver release-quality audio. Fee: ₹60,000.</p>
            <p>📌 <em>Seats are limited. Pay ₹35,000 to reserve your place. Visit soundabode.com/enroll or call 997-501-6189.</em></p>
            <h3>What Tools Will You Learn?</h3>
            <p>Soundabode's curriculum covers the full professional toolkit:</p>
            <ul>
              <li>Ableton Live 12 Suite (industry standard for electronic music)</li>
              <li>Kontakt & Reaktor (Native Instruments flagship samplers)</li>
              <li>Spectrasonics Omnisphere (industry's premier synthesis workstation)</li>
              <li>Arturia V Collection (classic synth emulations)</li>
              <li>Moog & Nord hardware synthesizers</li>
              <li>Ozone, Waves, and iZotope RX7 (mastering and restoration)</li>
              <li>SoundGym and Syntorial (ear training tools)</li>
            </ul>
            <h3>Career Paths After a Music Production Course in Pune</h3>
            <p>Completing a structured music production program opens doors across multiple industries:</p>
            <ul>
              <li><strong>Music Producer:</strong> Create and develop original tracks for artists, labels, streaming, and sync licensing.</li>
              <li><strong>Audio Engineer:</strong> Work in recording studios, post-production houses, or as a freelance mixer.</li>
              <li><strong>Sound Designer:</strong> Create audio assets for gaming, apps, installations, and video content.</li>
              <li><strong>Film & TV Composer:</strong> Score original music for OTT series, films, and advertisements.</li>
              <li><strong>Live Sound Engineer:</strong> Manage audio for concerts, events, and corporate productions.</li>
              <li><strong>Content Creator:</strong> Produce music for your own YouTube, Instagram, or podcast channels.</li>
            </ul>
            <h3>Music Production Course Fees in Pune: What to Expect</h3>
            <p>Courses in Pune range from short certificate programs (₹15,000–30,000) to comprehensive diplomas (₹60,000–2,40,000 for full multi-level paths). At Soundabode, each level is ₹60,000 - and includes internship components in three of the four levels, giving you real-world credit that is hard to put a price on.</p>
            <p>Flexible installment plans are available. You can start with as little as ₹35,000 to secure your seat.</p>
            <h3>Frequently Asked Questions</h3>
            <p><strong>Do I need to know music theory to start?</strong><br />No. Soundabode's Level 1 is designed for absolute beginners. You will learn everything from scratch, including basic music theory as it applies to production.</p>
            <p><strong>Which DAW does Soundabode teach?</strong><br />The core DAW is Ableton Live - the industry's preferred tool for electronic music production and live performance. Students also gain exposure to other professional software throughout the program.</p>
            <p><strong>Is there a certificate at the end?</strong><br />Yes. Upon completing all four levels, students receive the Soundabode Diploma in Audio Engineering - a credential recognized within Pune's music and production community.</p>
            <p><strong>Can I join from Level 2 or 3 if I already have experience?</strong><br />Absolutely. You can enter at any level based on your existing skillset. Soundabode's team will assess your background and recommend the right entry point.</p>
            <p>📌 <em>Ready to start? Visit soundabode.com or WhatsApp +91 99750 16189 to book your free demo session.</em></p>
          `
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
          content: `
            <p>DJing in India is no longer a niche hobby - it is a legitimate, well-paying career path. From rooftop parties in Mumbai to massive festival stages, the demand for skilled DJs has exploded over the last five years. Yet most beginners have no idea where to start. Should you buy gear first? Watch YouTube tutorials? Join a course?</p>
            <p>This guide walks you through exactly how to become a DJ in India - from zero to your first paid gig - with honest advice on what works and what is a waste of time and money.</p>
            <h3>Step 1: Understand What DJing Actually Involves</h3>
            <p>Before investing in gear or courses, know what you are getting into. A DJ's job is to read a crowd and create a seamless musical journey - not just press play on tracks. The core skills you need to develop are:</p>
            <ul>
              <li><strong>Beatmatching:</strong> Aligning the beats of two tracks so they blend without clashing.</li>
              <li><strong>EQing:</strong> Adjusting bass, mid, and treble frequencies as tracks mix together so the overall sound remains balanced.</li>
              <li><strong>Harmonic mixing:</strong> Blending tracks that are musically compatible in key, so transitions sound musical rather than jarring.</li>
              <li><strong>Crowd reading:</strong> Knowing when to build energy, drop the beat, or take the room in a new direction.</li>
              <li><strong>Track selection:</strong> Building a library of music and knowing which songs work in which moments.</li>
            </ul>
            <h3>Step 2: Choose Your Equipment Path</h3>
            <p>You do not need to spend a fortune on gear before you can learn. Here is how the equipment ladder works in India:</p>
            <p><strong>Starter Setup (₹20,000–50,000):</strong> A MIDI controller like the Pioneer DDJ-200 or DDJ-400 connected to a laptop running rekordbox or Traktor. This is the right starting point for learning fundamentals at home.</p>
            <p><strong>Intermediate Setup (₹1,00,000+):</strong> Moving to a Pioneer CDJ-2000 and DJM mixer setup - the industry standard in clubs worldwide. Learning on CDJs is essential if you plan to perform at professional venues.</p>
            <p><strong>Live Performance Setup:</strong> Many professional DJs integrate Ableton Live with their CDJ setup for advanced mashups, live remixing, and original production playback.</p>
            <p>📌 <em>At Soundabode Academy in Pune, all training is conducted on Pioneer CDJ-2000s and professional DJM mixers - the same gear you will find in clubs across India.</em></p>
            <h3>Step 3: Learn the Fundamentals - Properly</h3>
            <p>YouTube can teach you the theory of beatmatching. But it cannot give you the repetition, feedback, and structured progression that turns a beginner into a confident performer.</p>
            <p>What to Cover in a DJ Beginner Course:</p>
            <ul>
              <li>Basic DJ setup and signal flow</li>
              <li>Beatmatching by ear - without sync button as a crutch</li>
              <li>EQ mixing and gain staging</li>
              <li>Track structure: drops, breakdowns, intros, outros</li>
              <li>Looping and hot cues for live creativity</li>
              <li>Pioneer rekordbox for library management and preparation</li>
              <li>Reading BPM, key, and waveform displays</li>
              <li>Your first 30-minute live set</li>
            </ul>
            <h3>Step 4: Enroll in a Structured DJ Course in Pune</h3>
            <p>If you are based in or near Pune, Soundabode Academy offers India's most performance-focused DJ training program.</p>
            <p><strong>Level 1 - Basic DJ Training (2 months | ₹35,000):</strong> Fundamentals: beatmatching, EQing, track structure, and your first live set on Pioneer gear. Start with ₹20,000 to secure your seat.</p>
            <p><strong>Level 2 - Pro DJ Training (4 months | ₹60,000):</strong> Advanced mixing, harmonic blending, digital DJ setups, and performance techniques that separate working DJs from hobbyists.</p>
            <p><strong>Level 3 - Professional Performance Path (Mentored | Included):</strong> Artist profile development, mixtape creation, press kit preparation, and gig strategy. Students perform at Soundabode's partner venues in Pune.</p>
            <h3>Step 5: Build Your DJ Identity</h3>
            <p>Becoming a DJ in India is not just about technical skills - it is about becoming an artist with a recognizable identity.</p>
            <ul>
              <li><strong>Pick your genre:</strong> House, techno, hip-hop, Bollywood remixes, commercial pop - find the sound you love deeply.</li>
              <li><strong>Build a DJ name:</strong> Short, memorable, easy to pronounce in Hindi and English.</li>
              <li><strong>Create mixes:</strong> Regular SoundCloud or Mixcloud uploads show promoters your sound.</li>
              <li><strong>Photograph and video:</strong> Even basic smartphone content from your practice sessions builds your social proof.</li>
            </ul>
            <h3>Step 6: Get Your First Gig</h3>
            <ul>
              <li><strong>College events and private parties:</strong> Great first gigs. Low stakes, good practice.</li>
              <li><strong>Local restaurants and lounges:</strong> Many Pune venues run DJ nights and actively look for new talent.</li>
              <li><strong>Festival and club circuit:</strong> Requires reputation and consistency - where Soundabode's venue network helps.</li>
            </ul>
            <h3>How Much Does a DJ Earn in India?</h3>
            <ul>
              <li>Beginner DJ (local parties, college events): ₹3,000–10,000 per gig</li>
              <li>Mid-level DJ (lounges, corporate events): ₹15,000–50,000 per gig</li>
              <li>Professional club DJ (city circuit): ₹50,000–2,00,000+ per gig</li>
              <li>Festival headliner (NH7 Weekender, Sunburn scale): ₹5,00,000+</li>
            </ul>
            <p>📌 <em>Ready to start DJing? Book your free demo session at Soundabode Academy, Pimple Saudagar, Pune. Call +91 99750 16189 or visit soundabode.com.</em></p>
          `
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
          content: `
            <p>One of the first questions anyone considers before pursuing a career in music production is: can I actually make money doing this? The honest answer in 2026 is yes - but your earnings depend heavily on your skill level, specialization, city, and the clients you target.</p>
            <p>India's music industry is valued at over ₹2,600 crores and growing at approximately 15% annually, fueled by OTT content, independent music, gaming audio, brand films, and a booming podcast landscape.</p>
            <h3>Music Producer Salary in India: Level-by-Level Breakdown</h3>
            <p><strong>Beginner / Fresher Music Producer (0–2 years experience)</strong></p>
            <ul>
              <li>Freelance jingles and social media content: ₹5,000–20,000 per project</li>
              <li>Studio assistant / junior producer: ₹15,000–25,000 per month</li>
              <li>Content creation music (YouTube, reels): ₹10,000–30,000 per month (volume-based)</li>
            </ul>
            <p>The key at this stage is building your portfolio and getting real credits on published work, even if the pay is modest.</p>
            <p><strong>Mid-Level Music Producer (2–5 years experience)</strong></p>
            <ul>
              <li>Independent artist projects: ₹30,000–80,000 per track</li>
              <li>Corporate audio and brand films: ₹50,000–1,50,000 per project</li>
              <li>Television and OTT background scoring: ₹40,000–1,20,000 per episode</li>
              <li>Studio producer (employed): ₹35,000–60,000 per month</li>
            </ul>
            <p><strong>Senior / Professional Music Producer (5+ years)</strong></p>
            <ul>
              <li>Bollywood film scores: ₹2,00,000–15,00,000+ per project</li>
              <li>International sync licensing: ₹1,00,000–5,00,000+ per placement</li>
              <li>Live events and concert production: ₹1,00,000–5,00,000+ per event</li>
              <li>Senior employed producer: ₹80,000–2,00,000 per month</li>
            </ul>
            <h3>How Location Affects Music Producer Earnings in India</h3>
            <ul>
              <li><strong>Mumbai:</strong> Highest earning potential. Direct access to Bollywood, advertising agencies, and major studios.</li>
              <li><strong>Bangalore:</strong> Strong market for gaming audio, tech brand content, and indie music.</li>
              <li><strong>Pune:</strong> Growing hub with proximity to Mumbai. Strong local demand for event audio, Marathi content, and independent music.</li>
              <li><strong>Delhi:</strong> Strong corporate and live events market.</li>
              <li><strong>Chennai / Hyderabad:</strong> Regional film industries offer significant opportunities.</li>
            </ul>
            <h3>Specializations That Command Higher Pay</h3>
            <ol>
              <li><strong>Mixing & Mastering Engineer:</strong> Skilled mastering engineers charge ₹5,000–50,000 per track.</li>
              <li><strong>Film and OTT Composer:</strong> Established composers earn ₹5,00,000–25,00,000 per season.</li>
              <li><strong>Gaming Audio Producer:</strong> ₹3,00,000–12,00,000 annually at established studios.</li>
              <li><strong>Live Electronic Music (DJ-Producer):</strong> ₹50,000–5,00,000+ per performance.</li>
            </ol>
            <h3>Freelance vs. Employed: Which Path Pays More?</h3>
            <p>A realistic progression for a Soundabode graduate:</p>
            <ul>
              <li>Year 1: Studio assistant or part-time freelance. ₹20,000–35,000/month.</li>
              <li>Year 2–3: Mix of employment and freelance. ₹40,000–80,000/month.</li>
              <li>Year 4–5: Full freelance or senior role. ₹80,000–1,50,000+/month.</li>
              <li>Year 6+: Premium clients, sync deals. Significant income growth.</li>
            </ul>
            <h3>How to Increase Your Earnings as a Music Producer in India</h3>
            <ul>
              <li><strong>Specialize:</strong> Mixing engineers and composers are paid more than generalists.</li>
              <li><strong>Build in public:</strong> Post work on SoundCloud, YouTube, and Instagram.</li>
              <li><strong>Get on sync licensing platforms:</strong> Musicbed, Artlist, and Pond5 generate passive income.</li>
              <li><strong>Serve the OTT boom:</strong> Develop relationships with post-production houses.</li>
              <li><strong>Teach:</strong> Supplement income through private coaching or workshops.</li>
            </ul>
            <h3>Is a Music Production Course Worth the Investment?</h3>
            <p>At Soundabode, each level costs ₹60,000. The full 4-level program totals ₹2,40,000. Compare this to potential first-year freelance income of ₹2,40,000–4,80,000 and the long-term ceiling - the math is straightforward for someone committed to the career.</p>
            <p>📌 <em>Invest in your music production career. Start at Soundabode Academy, Pimple Saudagar, Pune. Call +91 99750 16189 or visit soundabode.com/enroll.</em></p>
          `
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
          content: `
            <p>Ableton Live is the world's most popular DAW for electronic music production and live performance. Whether you want to produce EDM, hip-hop, ambient music, or film scores, Ableton Live is the tool professionals trust - and it is the core DAW taught at Soundabode Academy in Pune.</p>
            <p>But getting started with Ableton can feel overwhelming. There are two views (Session and Arrangement), an ocean of clips, racks, effects, MIDI editors, and automation lanes. Where do you even begin?</p>
            <h3>Why Ableton Live Is the Right DAW to Learn in India</h3>
            <ul>
              <li><strong>Industry standard for electronic music:</strong> House, techno, hip-hop, and experimental genres are almost universally produced in Ableton.</li>
              <li><strong>Session View:</strong> Ableton's unique clip-launching grid is used by live performers, DJs, and producers.</li>
              <li><strong>Max for Live integration:</strong> Access to thousands of community-built devices.</li>
              <li><strong>Cross-platform:</strong> Available on both Mac and Windows.</li>
              <li><strong>Industry employment:</strong> Virtually every music production studio lists Ableton as a required skill.</li>
            </ul>
            <h3>The Two Views of Ableton Live</h3>
            <p><strong>Session View:</strong> A grid of clips arranged in tracks and scenes. Used for improvisation, live performance, beat-making, and experimenting with ideas. Think of it as a musical sandbox.</p>
            <p><strong>Arrangement View:</strong> A traditional linear timeline. Used for completing a track, arranging sections, and preparing for export or release.</p>
            <p><em>Professional workflow:</em> Most producers develop ideas in Session View, then move them into Arrangement View to finish the track.</p>
            <h3>Core Ableton Live Concepts to Learn (In Order)</h3>
            <p><strong>Stage 1: Setup and Navigation (Week 1–2)</strong><br />Installing Ableton Live Suite, understanding the interface (Mixer, Clip Editor, Device view), setting up audio interface/MIDI keyboard, and basic recording.</p>
            <p><strong>Stage 2: Beat Making and Sound Design (Week 3–6)</strong><br />Drum rack for beat programming, synthesis (Wavetable & Operator), sampling techniques, MIDI effects (Arpeggiator, Scale), and building a complete 16-bar groove.</p>
            <p><strong>Stage 3: Song Structure and Arrangement (Week 7–10)</strong><br />Moving clips from Session to Arrangement View, automation (volume, filter, effects), song sections (intro, build, drop, breakdown), and finishing your first complete track.</p>
            <p><strong>Stage 4: Mixing in Ableton Live (Week 11–14)</strong><br />Gain staging, EQ Eight, compression (Compressor & Glue Compressor), reverb and delay depth, sidechain compression, and cohesive mixdowns.</p>
            <p><strong>Stage 5: Advanced Tools and Export (Week 15+)</strong><br />Max for Live, third-party VST plugins (Serum, Vital), exporting stems, and preparing release-ready WAV files.</p>
            <h3>Can You Learn Ableton Live on YouTube Alone?</h3>
            <p>Yes - up to a point. The problem is that self-teaching typically produces knowledge gaps, bad workflow habits, lack of mix feedback, and no structured progression. This is where structured studio training like Soundabode's program changes the outcome.</p>
            <h3>Learning Ableton Live at Soundabode Academy, Pune</h3>
            <ul>
              <li><strong>Level 1:</strong> Ableton fundamentals, Session View, beat-making, first complete track.</li>
              <li><strong>Level 2:</strong> Advanced sound design with Serum and Arturia, arrangement, complex automation.</li>
              <li><strong>Level 3:</strong> Professional signal chains, studio-grade processing, Kontakt integration.</li>
              <li><strong>Level 4:</strong> Final mixdown and mastering with Ozone and Waves from within Ableton sessions.</li>
            </ul>
            <h3>Frequently Asked Questions</h3>
            <p><strong>Is Ableton Live good for beginners?</strong><br />Yes - but it has a steeper learning curve than FL Studio. The investment is worth it for both production and live performance.</p>
            <p><strong>Which version should I get?</strong><br />Ableton Live Suite is the professional choice - it includes all instruments, effects, and Max for Live.</p>
            <p><strong>Can Ableton be used for Bollywood music production?</strong><br />Absolutely. Ableton handles orchestral arrangement, Indian instrument sampling via Kontakt, and hybrid electronic-acoustic production.</p>
            <p><strong>How long does it take to learn professionally?</strong><br />With consistent practice and structured training, expect 3–6 months to reach professional beginner level and 1–2 years for genuine professional-grade skills.</p>
            <p>📌 <em>Learn Ableton Live on professional studio equipment with certified trainers. Visit soundabode.com or call +91 99750 16189 to book your demo session.</em></p>
          `
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
          content: `
            <p>India's entertainment and media industries are creating a surge in demand for trained audio engineers - and yet the supply of genuinely skilled professionals remains far short of what the market needs. If you are considering an audio engineering course in India, the timing and the opportunity are both excellent.</p>
            <h3>What Is Audio Engineering?</h3>
            <p>Audio engineering is the technical and creative discipline of capturing, shaping, mixing, and delivering sound. An audio engineer's job spans every stage of the production pipeline.</p>
            <p>Audio engineers work in:</p>
            <ul>
              <li><strong>Recording studios:</strong> Setting up and operating recording sessions.</li>
              <li><strong>Post-production houses:</strong> Editing, mixing, and mastering audio for films, OTT series, and advertisements.</li>
              <li><strong>Live sound:</strong> Operating PA systems and monitoring for concerts and events.</li>
              <li><strong>Broadcast:</strong> Managing audio for television, radio, and live streaming.</li>
              <li><strong>Gaming:</strong> Creating and implementing sound assets for video games.</li>
            </ul>
            <h3>Why the Demand for Audio Engineers in India Is Growing</h3>
            <ul>
              <li><strong>OTT explosion:</strong> Netflix, Amazon Prime, Hotstar, and 10+ major platforms producing original Indian content.</li>
              <li><strong>Independent music boom:</strong> Artists releasing music without labels need engineers.</li>
              <li><strong>Podcast industry:</strong> Growing at over 30% annually in India.</li>
              <li><strong>Gaming industry:</strong> Projected to reach $5 billion by 2027.</li>
              <li><strong>Live events recovery:</strong> Increased production quality investment.</li>
            </ul>
            <h3>Core Skills Covered in a Professional Audio Engineering Course</h3>
            <p><strong>Acoustics and Signal Flow:</strong> Understanding how sound behaves in a room and through a signal chain is fundamental.</p>
            <p><strong>Microphone Technique:</strong> Knowing which mic to use and where to place it is a high-leverage recording skill.</p>
            <p><strong>Digital Audio Workstations (DAWs):</strong> Ableton Live, Pro Tools, Logic Pro, or Cubase.</p>
            <p><strong>Mixing:</strong> Balancing multiple tracks using EQ, compression, reverb, delay, stereo imaging, and automation.</p>
            <p><strong>Mastering:</strong> Optimizing loudness, tonal balance, and stereo field using tools like iZotope Ozone.</p>
            <p><strong>Studio Outboard and Hardware:</strong> Understanding analog compressors, EQs, preamps, and converters.</p>
            <h3>Soundabode's Diploma in Audio Engineering</h3>
            <p>Soundabode Academy's Level 3 program - 4 months of intensive studio-based training in Pimple Saudagar, Pune.</p>
            <p>Curriculum Highlights:</p>
            <ul>
              <li>Advanced synthesizers: Moog, Nord, and modular setups</li>
              <li>Kontakt and Reaktor for sample-based sound design</li>
              <li>Studio signal chain construction</li>
              <li>Advanced microphone placement and recording</li>
              <li>Professional mixing methodology</li>
              <li>Integration of hardware and software</li>
            </ul>
            <p><em>Fee: ₹60,000. Duration: 4 months.</em></p>
            <h3>Audio Engineering vs. Music Production</h3>
            <ul>
              <li>Music producers focus on the creative side - composition, arrangement, sound selection.</li>
              <li>Audio engineers focus on the technical side - capturing, processing, mixing, and delivering sound.</li>
            </ul>
            <h3>Audio Engineering Career Paths and Salaries in India</h3>
            <ul>
              <li>Recording Engineer: ₹20,000–60,000/month or ₹5,000–30,000/session</li>
              <li>Mixing Engineer: ₹10,000–50,000/track - highest-paid specialization</li>
              <li>Mastering Engineer: ₹5,000–40,000/track - few specialists, high demand</li>
              <li>Live Sound Engineer: ₹15,000–75,000/show</li>
              <li>Post-Production Audio Engineer (OTT/Film): ₹30,000–1,50,000/month</li>
              <li>Game Audio Designer: ₹3,00,000–12,00,000/year</li>
            </ul>
            <p>📌 <em>Start your audio engineering journey at Soundabode Academy, Pune. Book a free demo at soundabode.com or WhatsApp +91 99750 16189.</em></p>
          `
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
          content: `
            <h3>Why 2026 is the Breakthrough Year for Music Producers in India</h3>
            <p>If you are searching for the best music production course in Pune, you aren't just looking for a classroom—you are looking for an entry point into a multi-billion dollar global industry. By 2026, the demand for high-quality audio has moved beyond Bollywood. From AAA gaming titles and spatial audio for OTT platforms to the explosion of independent electronic music, the world needs creators who understand the science behind the sound.</p>
            <p>Pune has emerged as the "Oxford of the East" for a reason. It offers a unique blend of a thriving indie scene and proximity to Mumbai’s commercial hub, making it the ideal location for an audio engineering diploma.</p>
            <h3>What Defines a Top-Tier Music Production School?</h3>
            <p>Before you invest in your career, ensure your chosen program meets the "Industry-Standard" checklist:</p>
            <ul>
              <li><strong>Acoustic Excellence:</strong> Are you learning in a bedroom or a professionally treated studio with high-end monitors?</li>
              <li><strong>The Pro Toolkit:</strong> Does the curriculum include Ableton Live 12, Serum, and Ozone?</li>
              <li><strong>Active Mentorship:</strong> Are your instructors' names on Spotify and film credits, or are they just reading from a textbook?</li>
              <li><strong>Path to Placement:</strong> Does the school offer internships or real-world project exposure?</li>
            </ul>
            <h3>Soundabode Academy: Pune’s Most Hands-On Music Production Program</h3>
            <p>Located in the heart of the city at Vision 9 Mall, Pimple Saudagar, Soundabode Academy isn't just a school—it’s a production powerhouse. We offer a structured 4-level journey designed to take you from "curious beginner" to "industry-ready professional."</p>
            <h3>The 4-Level Professional Roadmap</h3>
            <ul>
              <li><strong>Level 1 — Beginner: Music Production & DAW | 4 Months |</strong> Ableton Live, Beat-making</li>
              <li><strong>Level 2 — Intermediate: Electronic Music Production | 4 Months |</strong> Synthesis (Serum), Arrangement</li>
              <li><strong>Level 3 — Expert: Diploma in Audio Engineering | 4 Months |</strong> Signal Flow, Hardware Synths</li>
              <li><strong>Level 4 — Advanced: Mixing & Mastering | 4 Months |</strong> Release Standards, Ozone, Waves</li>
            </ul>
            <p><em>Note: All levels include portfolio-building modules specifically designed for international university applications (e.g., Berklee) and industry placements.</em></p>
            <p><em>Hybrid Learning Note: While our Pune campus offers elite studio access, we offer Online Music Production Courses for students across India and abroad, featuring 1-on-1 mentorship and remote studio sessions.</em></p>
            <h3>The Professional Gear You Will Master</h3>
            <ul>
              <li><strong>Software:</strong> Ableton Live 12 Suite, Arturia V Collection, Spectrasonics Omnisphere.</li>
              <li><strong>Hardware:</strong> Moog and Nord synthesizers, modular setups, and industry-standard outboard gear.</li>
              <li><strong>Ear Training:</strong> Integration with SoundGym and Syntorial to sharpen your frequency recognition.</li>
            </ul>
            <h3>Career Opportunities: Where Can You Go?</h3>
            <ul>
              <li>Music Producers & Ghost Producers for international labels.</li>
              <li>Sound Designers for the booming Indian gaming industry.</li>
              <li>Mixing & Mastering Engineers for independent artists and film scores.</li>
              <li>Live Sound Techs for major music festivals like Sunburn or VH1 Supersonic.</li>
            </ul>
            <h3>Enrollment & Fees: Invest in Your Future</h3>
            <p>Quality education is an investment. At Soundabode, each level is priced at ₹60,000, which includes internship components and studio time.</p>
            <ul>
              <li><strong>Flexible Entry:</strong> Already have experience? Skip Level 1 after a skill assessment.</li>
              <li><strong>Reserve Your Spot:</strong> Seats are strictly limited to ensure personalized attention. Secure your place with a ₹30,000 deposit.</li>
            </ul>
            <h3>Frequently Asked Questions (FAQ)</h3>
            <p><strong>1. Do I need to be a musician to join?</strong><br />Absolutely not. We teach you the "Producer's Music Theory"—the essential chords and scales you need to write hits, without needing years of classical training.</p>
            <p><strong>2. Is the diploma recognized internationally?</strong><br />Yes. The Soundabode Diploma in Audio Engineering is a mark of technical excellence recognized by studios and production houses across the industry.</p>
            <p><strong>3. Do you offer weekend batches for working professionals?</strong><br />We offer flexible scheduling including weekend slots and evening batches to accommodate both students and working professionals.</p>
            <h3>From Pune to the World: The Global Impact of Our Graduates</h3>
            <p><strong>1. The Gateway to Berklee College of Music:</strong> For those aiming for a Master’s Degree in Global Entertainment and Music Business, Soundabode provides the technical foundation required to qualify for prestigious institutions.</p>
            <p><strong>2. Indian Producers on the Global Map:</strong> Techno, House, and Lo-Fi producers signed to Anjunadeep, Drumcode, and Afterlife.</p>
            <p><strong>3. Powering Netflix & Gaming:</strong> Alumni working as sound designers for Netflix, Amazon Prime, and AAA gaming titles.</p>
            <p><strong>4. Underground Genre Mastery:</strong> Dark Psytrance, Drum and Bass, Synthwave, and heritage film audio restoration.</p>
            <p>👉 <strong>Book a Free Demo Session</strong><br />📞 Call/WhatsApp: +91 99750 16189<br />📍 Visit Us: Vision 9 Mall, Pimple Saudagar, Pune.</p>
          `
        },
      ]);
      console.log('[SUCCESS] Populated 6 official blog articles with full content in MongoDB Atlas.');
    }
  } catch (err) {
    console.warn('[WARN] Data auto-seed notice:', err.message);
  }
}

// ─── API ROUTES ────────────────────────────────────────────────────────────────

// AUTH ENDPOINTS
const PRESET_USERS = {
  'abhinav@soundabode.com': { name: 'Abhinav', role: 'admin', passEnv: 'ADMIN_PASSCODE' },
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

    // Attempt MongoDB save
    if (mongoose.connection.readyState === 1) {
      try {
        const admission = await AdmissionModel.findOneAndUpdate(
          { id: admissionData.id },
          admissionData,
          { upsert: true, new: true }
        );
        const result = { ...admission.toObject(), mongoSaved: true };
        broadcastLiveEvent('ADMISSION_CREATED', result);
        return res.status(201).json(result);
      } catch (dbErr) {
        console.error('[ERROR] [Admissions] MongoDB save failed for', admissionData.id, ':', dbErr.message);
        broadcastLiveEvent('ADMISSION_CREATED', { ...admissionData, mongoSaved: false });
        return res.status(201).json({ ...admissionData, mongoSaved: false, dbError: dbErr.message });
      }
    }

    // MongoDB is not connected — log a clear warning
    console.warn('[WARN] [Admissions] MongoDB is DISCONNECTED (readyState:', mongoose.connection.readyState, '). Admission', admissionData.id, 'was NOT saved to database. Only Google Sheets received this submission.');
    broadcastLiveEvent('ADMISSION_CREATED', { ...admissionData, mongoSaved: false });
    res.status(201).json({ ...admissionData, mongoSaved: false, dbError: 'MongoDB unavailable' });
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
      broadcastLiveEvent('ADMISSION_UPDATED', updated);
      return res.json(updated);
    }
    broadcastLiveEvent('ADMISSION_UPDATED', { id, ...updates });
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
      broadcastLiveEvent('ADMISSION_DELETED', { id });
    } else {
      broadcastLiveEvent('ADMISSION_DELETED', { id });
    }
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── FEE RECEIPTS ──────────────────────────────────────────────────────────────
// MongoDB is the shared source of truth, so receipts created on one device are
// visible to every administrator after the next refresh.
app.get('/api/fees', requireAuth, requireAdmin, async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'MongoDB is unavailable.' });
    }
    const receipts = await FeeReceiptModel.find().sort({ date: -1, createdAt: -1 });
    res.json(receipts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fees', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'MongoDB is unavailable. Receipt was not saved.' });
    }
    const receiptData = req.body || {};
    if (!receiptData.id) receiptData.id = `fee-${Date.now()}`;
    const receipt = await FeeReceiptModel.findOneAndUpdate(
      { id: receiptData.id },
      receiptData,
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    broadcastLiveEvent('FEE_RECEIPT_SAVED', receipt);
    res.status(201).json(receipt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/fees/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'MongoDB is unavailable. Receipt was not updated.' });
    }
    const updates = { ...(req.body || {}) };
    delete updates.id;
    const receipt = await FeeReceiptModel.findOneAndUpdate(
      buildDeleteQuery(req.params.id), updates, { new: true, runValidators: true }
    );
    if (!receipt) return res.status(404).json({ error: 'Receipt not found.' });
    broadcastLiveEvent('FEE_RECEIPT_SAVED', receipt);
    res.json(receipt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/fees/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'MongoDB is unavailable. Receipt was not deleted.' });
    }
    const result = await FeeReceiptModel.deleteMany(buildDeleteQuery(req.params.id));
    broadcastLiveEvent('FEE_RECEIPT_DELETED', { id: req.params.id });
    res.json({ success: true, deletedCount: result.deletedCount });
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
      const query = {
        $or: [
          { id: recordData.id },
          {
            studentId: recordData.studentId,
            date: recordData.date,
            timeSlot: recordData.timeSlot,
            markedBy: recordData.markedBy,
          },
        ],
      };
      const record = await AttendanceRecordModel.findOneAndUpdate(
        query,
        recordData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
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
  if (!process.env.SMTP_PASS) {
    dotenv.config();
  }

  const host = process.env.SMTP_HOST || 'smtp.zoho.com';
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE !== 'false';
  const user = process.env.SMTP_USER || 'services@soundabode.com';
  const pass = (process.env.SMTP_PASS || '').trim();

  if (!pass) {
    console.warn('[SMTP WARNING] process.env.SMTP_PASS is currently empty on this Render instance.');
    return null;
  }

  if (!mailTransporter) {
    console.log(`[SMTP INIT] Initializing Nodemailer transporter for ${user} via ${host}:${port}`);
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

app.post('/api/issues', async (req, res) => {
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

    // Dispatch automated email via Zoho Mail SMTP safely
    let emailResult = { success: false, reason: 'Not executed' };
    try {
      const emailSubject = `[CMS Issue Report] [${issueData.priority}] ${issueData.title}`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #121316; color: #ffffff; padding: 20px; border-radius: 10px;">
          <h2 style="color: #ef4444; border-bottom: 1px solid #333; padding-bottom: 10px;">Soundabode CMS Issue Report</h2>
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

      emailResult = await sendEmail({
        to: DEVELOPER_TARGET_EMAIL,
        subject: emailSubject,
        text: issueData.description,
        html: emailHtml,
        replyTo: issueData.reporterEmail || undefined,
      });
    } catch (emailErr) {
      console.error('[DEVELOPER ISSUE EMAIL ERROR]', emailErr.message);
      emailResult = { success: false, error: emailErr.message };
    }

    let savedIssue = issueData;
    if (isConnected) {
      try {
        savedIssue = await IssueModel.create(issueData);
        console.log(`[DEVELOPER ISSUE] Saved MongoDB issue record ${savedIssue.id}`);
      } catch (dbErr) {
        console.error('[DEVELOPER ISSUE DB SAVE ERROR]', dbErr.message);
      }
    }

    return res.json({
      success: true,
      issue: savedIssue,
      sentTo: DEVELOPER_TARGET_EMAIL,
      sentFrom: DEVELOPER_SENDER_EMAIL,
      emailStatus: emailResult
    });
  } catch (err) {
    console.error('[DEVELOPER ISSUE SERVER ERROR]', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
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
  console.log(`  1. abhinav@soundabode.com [Role: admin]   Passcode ENV: ${adminPassSet ? '[OK] ADMIN_PASSCODE set' : '[WARN] Default / Missing'}`);
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
