import { Router } from 'express';
import bcrypt from 'bcryptjs';
import passport from '../passport.js';
import { pool } from '../db.js';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || '/';

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

// --- Email + password ------------------------------------------------------
router.post('/register', async (req, res) => {
  const { email, username, password } = req.body || {};
  if (!email || !password || String(password).length < 8) {
    return res.status(400).json({ error: 'Email and a password of at least 8 characters are required.' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'An account with that email already exists. Try signing in instead.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await pool.query(
      `INSERT INTO users (email, username, password_hash, display_name, last_login_at)
       VALUES ($1, $2, $3, $4, now()) RETURNING *`,
      [email.toLowerCase(), username || null, passwordHash, username || email.split('@')[0]]
    );

    req.login(inserted.rows[0], (err) => {
      if (err) return res.status(500).json({ error: 'Account created, but failed to start a session. Please log in.' });
      res.status(201).json({ user: sanitizeUser(inserted.rows[0]) });
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
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
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
      res.json({ user: sanitizeUser(user) });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed.' });
    req.session.destroy(() => {
      res.clearCookie('ffpro.sid');
      res.json({ ok: true });
    });
  });
});

// --- Google ----------------------------------------------------------------
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}?auth=failed` }),
  (_req, res) => res.redirect(`${FRONTEND_URL}?auth=success`)
);

// --- Facebook ----------------------------------------------------------------
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: `${FRONTEND_URL}?auth=failed` }),
  (_req, res) => res.redirect(`${FRONTEND_URL}?auth=success`)
);

// --- Apple ----------------------------------------------------------------
// Apple's callback arrives as a POST (form_post response mode), not a GET.
router.get('/apple', passport.authenticate('apple'));
router.post(
  '/apple/callback',
  passport.authenticate('apple', { failureRedirect: `${FRONTEND_URL}?auth=failed` }),
  (_req, res) => res.redirect(`${FRONTEND_URL}?auth=success`)
);

export default router;
