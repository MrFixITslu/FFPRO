# FFPRO — Deploying with real Google / Facebook / Apple sign-in + cloud sync

This app was originally a fully client-side SPA with a fake "type any username
over 2 characters" login and browser-only data. This adds:

- A real Node/Express + PostgreSQL backend
- Email + password registration/login (bcrypt-hashed passwords)
- "Continue with Google" / "Continue with Facebook" / "Continue with Apple"
- Secure httpOnly session cookies (no tokens sitting in localStorage)
- **Per-account cloud data sync** — transactions, budgets, goals, etc. are now
  saved to your account (encrypted) and follow you across devices/browsers,
  instead of being stuck in one browser's localStorage.

Everything ships in three containers: `postgres`, `backend` (auth + data
sync API), and `web` (nginx serving the built frontend + reverse-proxying
`/api` to `backend`).

## How data sync works (and why it's safe to share a browser)

- Each account's app data (transactions, budgets, goals, etc.) is stored as a
  single **AES-256-GCM encrypted blob** per user, keyed by a key derived from
  a server-side master key (`DATA_ENCRYPTION_KEY`) — so a raw database leak
  alone doesn't expose anyone's finances.
- Saves use **optimistic concurrency** (a version counter): if you edit the
  same account from two devices at once, the second save is rejected with a
  conflict instead of silently overwriting the first, and the app reloads the
  newer copy.
- On login/logout, the app checks which account last owned the data cached in
  that browser and wipes it if it doesn't match — so if two people use the
  same browser, the second person never sees (or overwrites) the first
  person's data, even if the first person forgot to log out.
- The local "Connect Local SSD" vault backup feature still works as before,
  independent of cloud sync — it's just an optional on-disk backup.

---

## 1. One-time OAuth setup

Do this once per provider. You'll end up with a Client ID/Secret for each,
which go into `server/.env`.

### 1a. Google

1. Go to https://console.cloud.google.com/ and create (or pick) a project.
2. **APIs & Services → OAuth consent screen** — set it up as "External",
   fill in app name/support email, and add your domain under authorized
   domains.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**
   - Authorized redirect URIs: `https://your-domain.com/api/auth/google/callback`
4. Copy the **Client ID** and **Client Secret** into `server/.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_CALLBACK_URL=https://your-domain.com/api/auth/google/callback
   ```

### 1b. Facebook

1. Go to https://developers.facebook.com/apps and create an app
   (type: "Consumer" or "Business", either works for login).
2. Add the **Facebook Login** product.
3. Under **Facebook Login → Settings**, add to "Valid OAuth Redirect URIs":
   `https://your-domain.com/api/auth/facebook/callback`
4. Under **Settings → Basic**, copy the **App ID** and **App Secret**, and
   add your domain to "App Domains".
5. While the app is in "Development" mode, only accounts you add as
   testers/developers can log in — submit for **App Review** (Login
   permission) before going live to the public.
6. Fill in `server/.env`:
   ```
   FACEBOOK_APP_ID=...
   FACEBOOK_APP_SECRET=...
   FACEBOOK_CALLBACK_URL=https://your-domain.com/api/auth/facebook/callback
   ```

### 1c. Apple (the fiddly one)

Sign in with Apple requires a paid **Apple Developer Program** membership
($99/yr) and a few more moving pieces than the other two:

1. **developer.apple.com → Certificates, Identifiers & Profiles → Identifiers**
   - Create an **App ID** (if you don't have one) with "Sign In with Apple"
     capability enabled.
   - Create a **Services ID** — this is what you actually use as the OAuth
     "client ID". Example: `com.yourcompany.ffpro.web`.
   - Edit that Services ID → configure "Sign In with Apple" → set:
     - Domain: `your-domain.com`
     - Return URL: `https://your-domain.com/api/auth/apple/callback`
2. **Keys** → create a new key, enable "Sign In with Apple", associate it
   with your App ID. Download the `.p8` private key file — **you can only
   download it once**, so save it somewhere safe.
3. Note down:
   - **Team ID** (top right of the Apple Developer portal)
   - **Key ID** (shown when you create the key)
   - **Services ID** (e.g. `com.yourcompany.ffpro.web`)
4. Put the downloaded `.p8` file at `server/secrets/apple_private_key.p8` in
   this repo (that folder is git-ignored and gets mounted read-only into the
   backend container).
5. Fill in `server/.env`:
   ```
   APPLE_CLIENT_ID=com.yourcompany.ffpro.web
   APPLE_TEAM_ID=...
   APPLE_KEY_ID=...
   APPLE_PRIVATE_KEY_PATH=/run/secrets/apple_private_key.p8
   APPLE_CALLBACK_URL=https://your-domain.com/api/auth/apple/callback
   ```

Apple's callback arrives as a `POST` (not a redirect with a `?code=`), which
the backend already handles (`POST /api/auth/apple/callback`).

---

## 2. Configure environment files

```bash
cp server/.env.example server/.env
# edit server/.env: SESSION_SECRET, DATABASE_URL, FRONTEND_URL, and the
# provider credentials from step 1
```

Generate a strong session secret and the data-encryption key:
```bash
openssl rand -base64 48   # SESSION_SECRET
openssl rand -base64 32   # DATA_ENCRYPTION_KEY — must be exactly this length
```

**Back up `DATA_ENCRYPTION_KEY` somewhere safe and separate from the
database** (password manager, secrets vault, etc.). If it's lost, every
account's synced data becomes permanently undecryptable — there is no
recovery path by design, since that's what makes the encryption meaningful.

If you don't want Postgres's default password, also create a root `.env`
next to `docker-compose.yml` with:
```
POSTGRES_PASSWORD=some_other_strong_password
```
(and update `DATABASE_URL` in `server/.env` to match).

---

## 3. Build and run

```bash
docker compose build
docker compose up -d
docker compose logs -f backend   # confirm migrations ran + server started
```

This exposes the app on **port 8080** of the host (`web` service). The
`backend` and `postgres` services are not published to the host — only
reachable from inside the compose network.

---

## 4. Put your existing Nginx in front (TLS)

Since you're already running Nginx directly on the Linux app server, point
it at the `web` container instead of terminating TLS inside Docker:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;   # this nginx IS the TLS endpoint, so $scheme is correct here
        proxy_cookie_path / /;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

Reload: `sudo nginx -t && sudo systemctl reload nginx`.

**Important — this was a real bug we caught and fixed:** the *docker* Nginx
(`nginx/default.conf` in this repo) forwards whatever `X-Forwarded-Proto`
your *host* Nginx sends it, rather than overwriting it with its own scheme
(which would always say `http`, since the docker container never speaks TLS
directly). Get this wrong anywhere in the chain and the backend will think
every request is plaintext HTTP — logins will appear to succeed (200/201
responses) but the browser will never actually receive a session cookie, so
nobody stays signed in. We verified this end-to-end against a live backend
+ Postgres before shipping this. If you insert any *additional* proxy/CDN
layer in front of host Nginx, make sure it also sets `X-Forwarded-Proto`
correctly, and adjust `TRUST_PROXY_HOPS` in `server/.env` to match the total
number of hops.

Make sure `FRONTEND_URL` and all three `*_CALLBACK_URL` values in
`server/.env` use this public `https://your-domain.com` — the OAuth
providers redirect the browser to the *public* callback URL, not to
`localhost` or the internal Docker network.

The `web` container's port is published as `127.0.0.1:8080:80` (not
`0.0.0.0:8080`), so it's only reachable from the host itself — the public
internet can only reach it through your host Nginx's TLS listener.

---

## 5. Local development (no Docker)

```bash
# terminal 1 — backend
cd server
cp .env.example .env   # point DATABASE_URL at a local/dev Postgres
npm install
npm run migrate
npm run dev             # http://localhost:4000

# terminal 2 — frontend
npm install
npm run dev              # http://localhost:3000, proxies /api -> :4000
```

For local OAuth testing, register `http://localhost:4000/api/auth/<provider>/callback`
as an *additional* redirect URI with each provider (Apple requires HTTPS even
for testing, so it's easiest to verify Apple in a staging environment with a
real domain).

---

## 6. What changed in this pass (data sync + production hardening)

**New: per-account cloud sync**
- `server/src/crypto.js`, `server/src/routes/data.js`,
  `server/migrations/002_user_data.sql` — encrypted per-user data storage
  with optimistic-concurrency saves.
- `services/dataSyncService.ts` — frontend client for it.
- `App.tsx` — loads/saves your data from the cloud automatically, resolves
  conflicts, clears local state on logout, and wipes stale local data if a
  different account signs in on the same browser.

**Bugs fixed**
- `investmentGoals` was read from localStorage but never saved back — any
  investment goal you added was silently lost on refresh.
- The "Dashboard" and "Wealth Forecast" nav tabs were shown to every user,
  but their content only rendered for the admin account — non-admins could
  click into a blank screen. Both tabs are now hidden for non-admins.
- **Secure cookies were silently never set in the real deployment
  topology.** The docker Nginx was overwriting `X-Forwarded-Proto` with its
  own (always-`http`) scheme instead of forwarding the value your host
  Nginx set, so the backend always thought the connection was plaintext and
  refused to issue a `Secure` session cookie — logins would appear to
  succeed but nobody would actually stay signed in. Fixed in
  `nginx/default.conf`; verified against a live backend + Postgres.
- Server shutdown could hang for the full 10s failsafe on `docker compose
  down`/restart because idle keep-alive connections (e.g. from Nginx's
  upstream pool) block Node's `server.close()` from ever firing. Now closes
  idle connections immediately on `SIGTERM` for fast, clean restarts.
- "Purge data" only cleared the browser's local storage — the cloud copy
  would silently restore the "purged" data on next login. Now clears both.
- The `web` container's port was published on all interfaces
  (`0.0.0.0:8080`), letting anyone on the internet bypass your host Nginx
  and hit the app directly over plain HTTP. Now bound to `127.0.0.1:8080`.

**Production hardening**
- `express.json()`'s default 100kb body limit would have rejected any
  reasonably-sized finance dataset — raised to 5MB (matching the app-level
  payload cap in `routes/data.js`).
- `trust proxy` was set assuming a single reverse-proxy hop; the real
  topology (host Nginx → docker Nginx → backend) has two. Now configurable
  via `TRUST_PROXY_HOPS` (defaults to 2) instead of hardcoded.
- Added `Sec-Fetch-Site`-based same-origin enforcement on login/register/
  logout and all `/api/data` routes as defense-in-depth against CSRF, on
  top of `SameSite=Lax` cookies and the absence of any CORS allow-list.
- Added a write-rate limiter on `/api/data` and boot-time validation that
  `SESSION_SECRET`, `DATABASE_URL`, and `DATA_ENCRYPTION_KEY` are all
  present and well-formed (fails fast instead of misbehaving at runtime).
- Backend now runs as a non-root user in Docker, uses `npm ci` against a
  committed lockfile for reproducible builds, runs under `tini` for correct
  signal handling, and exposes a container-level `HEALTHCHECK`.
- Nginx now sends baseline hardening headers, gzip-compresses responses,
  disables its version banner, and never caches `index.html` (so app
  updates roll out immediately) while long-caching hashed static assets.
- Structured request logging (`morgan`) and a graceful-shutdown handler
  (drains in-flight requests, closes the DB pool) were added to the backend.

## 7. Production checklist

Before pointing real users at this:

- [ ] `server/.env` has a unique `SESSION_SECRET` and `DATA_ENCRYPTION_KEY`
      (not the placeholders), and both are backed up outside the DB.
- [ ] `DATABASE_URL` uses a non-default Postgres password
      (`POSTGRES_PASSWORD` in a root `.env`, not `ffpro_password`).
- [ ] All three `*_CALLBACK_URL` values and `FRONTEND_URL` point at your
      real `https://` domain, matching what's registered with each provider.
- [ ] Host Nginx terminates TLS and forwards `X-Forwarded-Proto: https` —
      confirm by registering a test account and checking the browser
      actually stores a `ffpro.sid` cookie (DevTools → Application →
      Cookies), not just that the API call returned 200.
- [ ] `docker compose ps` shows all three services healthy
      (`docker compose ps` reports `healthy`, not just `running`).
- [ ] Facebook app has passed App Review for the Login permission if it'll
      be used by people outside your test-user list.
- [ ] If using Apple: the `.p8` key at `server/secrets/apple_private_key.p8`
      is readable by the container's non-root user — `chmod 644` it if the
      backend logs a key-read error on boot.
- [ ] `docker compose logs backend` on a fresh boot shows no `FATAL:` lines.
- [ ] A test transaction added on one browser shows up after logging into
      the same account from a different browser (proves cloud sync end to
      end).
- [ ] The Postgres volume (`ffpro_pgdata`) is included in your backup
      routine — it's the only copy of everyone's encrypted data.

## 8. Known follow-ups (not done here, flagging for later)

- **Password reset via email** isn't implemented (the old "forgot password"
  flow was tied to the fake local-only auth and doesn't make sense anymore).
  Needs an email provider (e.g. SES/Postmark) if you want it.
- **No field-level merge on sync conflicts** — if the same account is edited
  on two devices within the same few-second window, the loser's edits are
  discarded (the app tells the user this happened and reloads the winner's
  data). Fine for a single person using multiple devices sequentially; not
  built for true simultaneous multi-device editing.
- **No Content-Security-Policy** — the frontend loads Tailwind, Font
  Awesome, and Google Fonts from CDNs and uses inline styles, so a strict
  CSP would need frontend changes to avoid breaking the app. Currently
  relying on the other headers (X-Frame-Options, X-Content-Type-Options,
  HSTS at the host Nginx) instead.
- The Apple strategy's exact callback signature can vary slightly between
  `passport-apple` versions — after wiring up real credentials, test that
  flow first since it's the most fragile of the three.

