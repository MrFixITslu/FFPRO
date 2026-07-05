import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import AppleStrategy from 'passport-apple';
import { pool } from './db.js';

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, username, display_name, avatar_url FROM users WHERE id = $1',
      [id]
    );
    done(null, rows[0] || false);
  } catch (err) {
    done(err);
  }
});

/**
 * Finds an existing user for a given OAuth identity, links the identity to an
 * existing account with the same verified email, or creates a brand new user.
 */
async function findOrCreateOAuthUser({ provider, providerId, email, displayName, avatarUrl }) {
  const linked = await pool.query(
    `SELECT u.* FROM oauth_accounts oa
     JOIN users u ON u.id = oa.user_id
     WHERE oa.provider = $1 AND oa.provider_user_id = $2`,
    [provider, providerId]
  );
  if (linked.rows[0]) {
    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [linked.rows[0].id]);
    return linked.rows[0];
  }

  let user = null;
  if (email) {
    const byEmail = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    user = byEmail.rows[0] || null;
  }

  if (!user) {
    const inserted = await pool.query(
      `INSERT INTO users (email, display_name, avatar_url, last_login_at)
       VALUES ($1, $2, $3, now()) RETURNING *`,
      [
        (email || `${provider}_${providerId}@no-email.ffpro.local`).toLowerCase(),
        displayName || null,
        avatarUrl || null,
      ]
    );
    user = inserted.rows[0];
  } else {
    await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  }

  await pool.query(
    `INSERT INTO oauth_accounts (user_id, provider, provider_user_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (provider, provider_user_id) DO NOTHING`,
    [user.id, provider, providerId]
  );

  return user;
}

// --- Google -------------------------------------------------------------
// Only registered if credentials are present, so the server still boots
// (with that button effectively disabled) if a provider hasn't been set up yet.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await findOrCreateOAuthUser({
            provider: 'google',
            providerId: profile.id,
            email: profile.emails?.[0]?.value,
            displayName: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
} else {
  console.warn('[auth] Google OAuth not configured — GOOGLE_CLIENT_ID/SECRET missing.');
}

// --- Facebook -------------------------------------------------------------
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL,
        profileFields: ['id', 'displayName', 'emails', 'photos'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await findOrCreateOAuthUser({
            provider: 'facebook',
            providerId: profile.id,
            email: profile.emails?.[0]?.value,
            displayName: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
} else {
  console.warn('[auth] Facebook OAuth not configured — FACEBOOK_APP_ID/SECRET missing.');
}

// --- Apple ------------------------------------------------------------
// Sign in with Apple only sends the user's name/email on the FIRST authorization
// (as a JSON string in req.body.user) — after that you only get a stable `sub`.
// We capture the name on first login; subsequent logins just match on provider id.
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID) {
  passport.use(
    new AppleStrategy(
      {
        clientID: process.env.APPLE_CLIENT_ID, // Services ID, e.g. com.yourcompany.ffpro.web
        teamID: process.env.APPLE_TEAM_ID,
        keyID: process.env.APPLE_KEY_ID,
        privateKeyLocation: process.env.APPLE_PRIVATE_KEY_PATH, // path to the .p8 key file
        callbackURL: process.env.APPLE_CALLBACK_URL,
        scope: ['name', 'email'],
        passReqToCallback: true,
      },
      async (req, _accessToken, _refreshToken, idToken, profile, done) => {
        try {
          let displayName;
          if (req.body?.user) {
            try {
              const parsed = JSON.parse(req.body.user);
              displayName = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(' ');
            } catch {
              // Apple didn't send a parseable name payload — safe to ignore.
            }
          }
          const email = profile?.email || idToken?.email;
          const providerId = profile?.id || idToken?.sub;
          const user = await findOrCreateOAuthUser({
            provider: 'apple',
            providerId,
            email,
            displayName,
            avatarUrl: null,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    )
  );
} else {
  console.warn('[auth] Apple Sign In not configured — APPLE_CLIENT_ID/TEAM_ID/KEY_ID missing.');
}

export default passport;
