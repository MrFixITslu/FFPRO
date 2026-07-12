import 'dotenv/config';
import http from 'http';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import passport from './passport.js';
import { pool } from './db.js';
import { assertEncryptionConfigured } from './crypto.js';
import { sameOriginOnly } from './middleware/sameOriginOnly.js';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import aiRoutes from './routes/ai.js';

// Fail fast on boot rather than on the first request if config is missing.
for (const key of ['SESSION_SECRET', 'DATABASE_URL']) {
  if (!process.env[key]) {
    console.error(`FATAL: ${key} is not set. Refusing to start.`);
    process.exit(1);
  }
}
try {
  assertEncryptionConfigured();
} catch (err) {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
}

const app = express();
const PgSession = connectPgSimple(session);

// How many reverse-proxy hops sit between the browser and this process.
// Default topology: browser -> host Nginx (TLS) -> docker "web" Nginx -> here.
// That's 2 hops. If you point host Nginx directly at the backend container
// instead, change this to 1. Getting this wrong skews rate-limiting and
// anything else that reads req.ip.
const TRUST_PROXY_HOPS = Number(process.env.TRUST_PROXY_HOPS || 2);
app.set('trust proxy', TRUST_PROXY_HOPS);

app.disable('x-powered-by');

// CORS Configuration (FIX: Add explicit CORS headers)
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  maxAge: 86400
};
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', corsOptions.origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
    res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
    return res.sendStatus(200);
  }
  next();
});

app.use(helmet({
  // The frontend pulls Tailwind/Font Awesome/fonts from CDNs and uses inline
  // styles, so a strict default-src CSP would break it without a larger
  // frontend change. Left off deliberately — see DEPLOYMENT.md "Follow-ups".
  contentSecurityPolicy: false,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '5mb' })); // holds a full finance dataset, not just form fields
app.use(express.urlencoded({ extended: true, limit: '1mb' })); // Apple's form_post callback

app.use(
  session({
    store: new PgSession({ pool, tableName: 'session', createTableIfMissing: true }),
    name: 'ffpro.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Health check — deliberately before auth/rate-limiting, and cheap.
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Brute-force protection on credential endpoints.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use(['/api/auth/login', '/api/auth/register', '/api/auth/logout'], sameOriginOnly);

// Generous but bounded write limiter for data sync (client autosaves are
// debounced client-side, so normal use is a handful of requests per minute).
const dataWriteLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use('/api/data', sameOriginOnly);
app.use('/api/data', (req, res, next) => (req.method === 'GET' ? next() : dataWriteLimiter(req, res, next)));

app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/ai', aiRoutes);

// Fallback error handler — never leak stack traces to clients.
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong.' });
});

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
server.listen(PORT, () => console.log(`FFPRO auth server listening on port ${PORT}`));

// Let Docker's `stop` (SIGTERM) drain in-flight requests and close the DB
// pool cleanly instead of killing connections mid-write.
function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    try {
      await pool.end();
    } finally {
      process.exit(0);
    }
  });
  // server.close() only stops accepting new connections — it won't fire its
  // callback until every open socket (including idle keep-alives, e.g. from
  // nginx's upstream connection pool) closes on its own. Force those closed
  // immediately so a normal shutdown takes milliseconds, not the full
  // failsafe timeout below.
  server.closeIdleConnections?.();
  setTimeout(() => {
    console.warn('Shutdown taking too long, forcing exit.');
    process.exit(1);
  }, 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
