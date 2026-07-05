import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import passport from './passport.js';
import { pool } from './db.js';
import authRoutes from './routes/auth.js';

if (!process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET is not set. Refusing to start.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set. Refusing to start.');
  process.exit(1);
}

const app = express();
const PgSession = connectPgSimple(session);

// We sit behind nginx (and possibly another reverse proxy in front of that),
// so trust the X-Forwarded-* headers it sets for correct secure-cookie behavior.
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // needed for Apple's form_post callback

app.use(
  session({
    store: new PgSession({ pool, tableName: 'session', createTableIfMissing: true }),
    name: 'ffpro.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Basic brute-force protection on the credential endpoints.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use('/api/auth', authRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`FFPRO auth server listening on port ${PORT}`));
