import { Router } from 'express';
import bcrypt from 'bcryptjs';
import passport from '../passport.js';
import { pool } from '../db.js';

const router = Router();
const FRONTEND_URL = (process.env.FRONTEND_URL || '/').replace(/\/$/, '');
const AVAILABLE_OAUTH_PROVIDERS = [];

// FIX: Add password validation function
function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return 'Password must contain at least one special character (!@#$%^&*).';
  }
  return null;
}

// FIX: Sanitize display names
function sanitizeDisplayName(name) {
  if (!name) return null;
  const trimmed = String(name).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 100) return trimmed.substring(0, 100);
  return trimmed;
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  AVAILABLE_OAUTH_PROVIDERS.push('google');
}
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  AVAILABLE_OAUTH_PROVIDERS.push('facebook');
}
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID) {
  AVAILABLE_OAUTH_PROVIDERS.push('apple');
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
  };
}

// --- Session status -------------------------------------------------------
router.get('/me', (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

router.get('/session-state', (req, res) => {
  res.json({ authenticated: !!req.user, user: sanitizeUser(req.user) });
});

router.get('/providers', (_req, res) => {
  res.json({ providers: AVAILABLE_OAUTH_PROVIDERS });
});

function ensureOAuthProvider(req, res, next, provider) {
  if (!AVAILABLE_OAUTH_PROVIDERS.includes(provider)) {
    return res.status(503).json({ error: `${provider} authentication is not configured.` });
  }
  return next();
}

// --- Email + password ------------------------------------------------------
router.post('/register', async (req, res) => {
  const { email, username, password } = req.body || {};
  
  // FIX: Add password strength validation
  const passwordError = validatePasswordStrength(password);
  if (!email || passwordError) {
    return res.status(400).json({ error: passwordError || 'Email is required.' });
  }

  try {
    // FIX: Ensure case-insensitive email uniqueness
    const existing = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'An account with that email already exists. Try signing in instead.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    // FIX: Sanitize display name
    const sanitizedUsername = sanitizeDisplayName(username);
    const displayName = sanitizedUsername || email.split('@')[0];
    
    const inserted = await pool.query(
      `INSERT INTO users (email, username, password_hash, display_name, last_login_at)
       VALUES (LOWER($1), $2, $3, $4, now()) RETURNING *`,
      [email, sanitizedUsername, passwordHash, displayName]
    );

    req.login(inserted.rows[0], (err) => {
      if (err) return res.status(500).json({ error: 'Account created, but failed to start a session. Please log in.' });
      res.status(201).json({ 
        user: sanitizeUser(inserted.rows[0])
      });
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That email or username is already taken.' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // FIX: Use case-insensitive email lookup
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    const user = rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: 'Failed to start a session.' });
      res.json({ 
        user: sanitizeUser(user)
      });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout passport error:', err);
      return res.status(500).json({ error: 'Logout failed.' });
    }
    // FIX: Use async/await-compatible destroy with proper error handling
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error('Session destroy error:', destroyErr);
        // Still clear cookie and return success even if destroy fails
      }
      const host = req.headers.host || '';
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
      const xfp = req.headers['x-forwarded-proto'];
      const isCloudSandbox = !!(process.env.K_SERVICE || process.env.APP_URL);
      const isSecure = req.secure || 
        isCloudSandbox ||
        (!isLocalhost) || 
        (typeof xfp === 'string' && xfp.split(',').map(s => s.trim().toLowerCase()).includes('https'));

      res.clearCookie('ffpro.sid', { 
        path: '/', 
        httpOnly: true, 
        secure: isSecure, 
        sameSite: isSecure ? 'none' : 'lax' 
      });
      res.json({ ok: true });
    });
  });
});

// --- Google ----------------------------------------------------------------
router.get('/google', (req, res, next) => ensureOAuthProvider(req, res, next, 'google'), passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get(
  '/google/callback',
  (req, res, next) => ensureOAuthProvider(req, res, next, 'google'),
  passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}/?auth=failed` }),
  (_req, res) => res.redirect(`${FRONTEND_URL}/?auth=success`)
);

// --- Facebook ----------------------------------------------------------------
router.get('/facebook', (req, res, next) => ensureOAuthProvider(req, res, next, 'facebook'), passport.authenticate('facebook', { scope: ['email'] }));
router.get(
  '/facebook/callback',
  (req, res, next) => ensureOAuthProvider(req, res, next, 'facebook'),
  passport.authenticate('facebook', { failureRedirect: `${FRONTEND_URL}/?auth=failed` }),
  (_req, res) => res.redirect(`${FRONTEND_URL}/?auth=success`)
);

// --- Apple ----------------------------------------------------------------
// Apple's callback arrives as a POST (form_post response mode), not a GET.
router.get('/apple', (req, res, next) => ensureOAuthProvider(req, res, next, 'apple'), passport.authenticate('apple'));
router.post(
  '/apple/callback',
  (req, res, next) => ensureOAuthProvider(req, res, next, 'apple'),
  passport.authenticate('apple', { failureRedirect: `${FRONTEND_URL}/?auth=failed` }),
  (_req, res) => res.redirect(`${FRONTEND_URL}/?auth=success`)
);

export default router;
