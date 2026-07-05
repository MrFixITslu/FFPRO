# FFPRO — Deploying with real Google / Facebook / Apple sign-in

This app was originally a fully client-side SPA with a fake "type any username
over 2 characters" login. This adds a real Node/Express + PostgreSQL backend
that handles:

- Email + password registration/login (bcrypt-hashed passwords)
- "Continue with Google" / "Continue with Facebook" / "Continue with Apple"
- Secure httpOnly session cookies (no tokens sitting in localStorage)

Everything ships in three containers: `postgres`, `backend` (the new auth
API), and `web` (nginx serving the built frontend + reverse-proxying `/api`
to `backend`).

Your app's financial data (transactions, budgets, etc.) still lives in the
browser's localStorage / the optional local vault folder, exactly as before —
only the *authentication* layer is now real. If you later want that data
synced per-account across devices, that's a separate project (a REST API +
DB tables for each data type) — happy to help with that next.

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

Generate a strong session secret:
```bash
openssl rand -base64 48
```

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

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

Reload: `sudo nginx -t && sudo systemctl reload nginx`.

Make sure `FRONTEND_URL` and all three `*_CALLBACK_URL` values in
`server/.env` use this public `https://your-domain.com` — the OAuth
providers redirect the browser to the *public* callback URL, not to
`localhost` or the internal Docker network.

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

## 6. What changed in the repo

- `server/` — new Express + PostgreSQL backend (registration, login, Google/
  Facebook/Apple OAuth, sessions).
- `components/Login.tsx` — rebuilt with real register/login form + OAuth
  buttons instead of the old fake check.
- `services/authService.ts` — new frontend client for the auth API.
- `App.tsx` — auth state now comes from the backend session (`/api/auth/me`)
  instead of a `localStorage` flag.
- `vite.config.ts` — dev-time proxy of `/api` to the backend.
- `Dockerfile`, `nginx/default.conf`, `docker-compose.yml` — containerized
  deployment for frontend+nginx, backend, and Postgres.

## 7. Known follow-ups (not done here, flagging for later)

- **Password reset via email** isn't implemented (the old "forgot password"
  flow was tied to the fake local-only auth and doesn't make sense anymore).
  Needs an email provider (e.g. SES/Postmark) if you want it.
- **Per-user data sync**: financial data still lives in the browser only.
  Two people logging into the same browser will currently share the same
  local data. Worth a follow-up if multiple people will use the same device.
- The Apple strategy's exact callback signature can vary slightly between
  `passport-apple` versions — after wiring up real credentials, test that
  flow first since it's the most fragile of the three.
