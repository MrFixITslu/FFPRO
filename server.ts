import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import passport from './server/passport.js';
import authRoutes from './server/routes/auth.js';
import dataRoutes from './server/routes/data.js';
import aiRoutes from './server/routes/ai.js';
import { createServer as createViteServer } from 'vite';

// Auto-generate SESSION_SECRET and DATA_ENCRYPTION_KEY if not provided
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = crypto.randomBytes(48).toString('hex');
  console.log('[server] Automatically generated SESSION_SECRET');
}

if (!process.env.DATA_ENCRYPTION_KEY) {
  const keyFile = process.env.ENCRYPTION_KEY_FILE || path.join(process.cwd(), 'encryption.key');
  // Ensure parent directory exists
  const keyDir = path.dirname(keyFile);
  if (!fs.existsSync(keyDir)) {
    fs.mkdirSync(keyDir, { recursive: true });
  }
  if (fs.existsSync(keyFile)) {
    process.env.DATA_ENCRYPTION_KEY = fs.readFileSync(keyFile, 'utf8').trim();
    console.log('[server] Loaded persistent DATA_ENCRYPTION_KEY from encryption.key');
  } else {
    const key = crypto.randomBytes(32).toString('base64');
    fs.writeFileSync(keyFile, key, 'utf8');
    process.env.DATA_ENCRYPTION_KEY = key;
    console.log('[server] Automatically generated and persisted DATA_ENCRYPTION_KEY to encryption.key');
  }
}

// Map GEMINI_API_KEY to API_KEY for gemini routes if missing
if (!process.env.API_KEY && process.env.GEMINI_API_KEY) {
  process.env.API_KEY = process.env.GEMINI_API_KEY;
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Trust reverse proxy (Cloud Run, Nginx, etc.) to correctly detect req.secure and HTTPS
app.set('trust proxy', true);

// Helmet security configuration to allow embedding in the AI Studio iframe
app.use(helmet({
  contentSecurityPolicy: false,
  frameguard: false,
  crossOriginEmbedderPolicy: false,
}));

// Logger middleware
app.use(morgan('dev'));

// Payload parsing
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Instantiate session middleware ONCE at module level so we use a single persistent session store
const sessionSecret = process.env.SESSION_SECRET || 'fallback-secret-key-12345';
const sessionMiddleware = session({
  name: 'ffpro.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  }
});

// Dynamic express-session middleware wrapper: sets the cookie's Secure/SameSite
// attributes to match the ACTUAL connection security for this request, so the
// cookie the browser receives is one it will actually store and send back.
//
// `app.set('trust proxy', true)` above already makes `req.secure` correctly
// reflect the `X-Forwarded-Proto` header set by a TLS-terminating reverse
// proxy (Nginx, Cloud Run, etc.). We only add small, explicit fallbacks on
// top of that — never a blanket "host isn't literally 'localhost', so treat
// it as secure" rule. Forcing `secure: true` on a connection that is actually
// plain HTTP causes the browser to silently discard the Set-Cookie response
// (browsers never store/send Secure cookies over an insecure origin), which
// breaks the session on the very next request: login appears to succeed, but
// every request after it looks logged-out, kicking the user back to the
// login screen in an endless loop.
app.use((req, res, next) => {
  const xfp = req.headers['x-forwarded-proto'];
  const isCloudSandbox = !!(process.env.K_SERVICE || process.env.APP_URL);
  const isSecure = req.secure ||
    isCloudSandbox ||
    (typeof xfp === 'string' && xfp.split(',').map(s => s.trim().toLowerCase()).includes('https'));

  // Execute session middleware, then dynamically configure cookie secure and sameSite attributes
  sessionMiddleware(req, res, (err) => {
    if (err) return next(err);
    if (req.session && req.session.cookie) {
      req.session.cookie.secure = isSecure;
      req.session.cookie.sameSite = isSecure ? 'none' : 'lax';
    }
    next();
  });
});

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Mount Backend API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/ai', aiRoutes);

// Vite Integration
async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[server] Mounting Vite Dev Middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('[server] Serving static built assets from dist...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] Fire Finance Pro running on port ${PORT}`);
  });
}

bootstrap().catch(err => {
  console.error('[server] Fatal bootstrap error:', err);
  process.exit(1);
});
