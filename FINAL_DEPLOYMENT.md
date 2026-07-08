# FFPRO — final setup: Gemini removed, one container, proxy_network

This supersedes the earlier "three separate containers" file set — the
requirements changed (single container, no dedicated nginx for this app),
so ignore/delete `Dockerfile.nginx`, `Dockerfile.backend`, and `default.conf`
if you already copied those in. Just this set now.

## What changed and why

**1. Gemini/Google GenAI is fully removed**, not just disabled:
- Deleted: `services/geminiService.ts`, `components/MagicInput.tsx`,
  `components/BudgetAssistant.tsx`, `components/VerificationQueue.tsx`
  (all existed only to call Gemini).
- Cleaned: `App.tsx`, `components/Dashboard.tsx`, `components/Projections.tsx`,
  `services/bankApiService.ts` — every `@google/genai` import and API call
  removed. The two small AI-generated advice strings (Dashboard's insight
  line, Projections' strategic tip) now come from simple local math instead
  of an API call — same UI, no external dependency.
- `vite.config.ts`: removed the block that embedded `GEMINI_API_KEY` into
  the client-side bundle (that was also a standing security issue — anyone
  could've read the key out of your JS).
- `package.json` / `package-lock.json`: dependency removed. I rebuilt and
  typechecked locally — clean `tsc --noEmit`, clean `vite build`, and the
  JS bundle actually shrank from 1,078 KB to 783 KB.
- **What you lose functionally**: the "magic" receipt/voice/text auto-parse
  input, the floating AI chat advisor, and AI-simulated bank/investment
  sync (that last one was never wired to anything real — it asked Gemini
  to *invent* fake transactions, which wasn't something worth keeping in
  any form). **What still works**: manual transaction entry (now a plain
  "Add Transaction" button), all budgets/dashboards/projections/calendar/
  events, saving goals, investment tracking with manually-entered prices,
  login (email+password and OAuth if configured).

**2. One container, no nginx inside it.** You already have nginx (via
Nginx Proxy Manager) running as its own container in front of everything.
`server/src/index.js` now serves the built frontend directly via
`express.static` plus an SPA fallback, in the same process as the API —
so one container, one process, one port (`4000`), no supervisord, no
in-container nginx at all.

**3. The 8080-vs-4000 mismatch is gone because 8080 is gone.** There's no
nginx inside this container anymore to translate a published port into
4000. The app container joins `proxy_network` — the Docker network your
existing Nginx Proxy Manager container is already on — and NPM reaches it
directly by container name on port 4000. No host port is published at all.

## Files and where they go

| File | Destination |
|---|---|
| `Dockerfile` | `FFPRO/Dockerfile` (overwrite) |
| `docker-compose.yml` | `FFPRO/docker-compose.yml` (overwrite) |
| `App.tsx` | `FFPRO/App.tsx` (overwrite) |
| `index.js` | `FFPRO/server/src/index.js` (overwrite) |
| `vite.config.ts` | `FFPRO/vite.config.ts` (overwrite) |
| `package.json` | `FFPRO/package.json` (overwrite) |
| `package-lock.json` | `FFPRO/package-lock.json` (overwrite) |
| `bankApiService.ts` | `FFPRO/services/bankApiService.ts` (overwrite) |
| `Dashboard.tsx` | `FFPRO/components/Dashboard.tsx` (overwrite) |
| `Projections.tsx` | `FFPRO/components/Projections.tsx` (overwrite) |
| `gitignore.txt` | `FFPRO/.gitignore` (new) |
| `root-env.txt` | `FFPRO/.env` (overwrite) |
| `server-env.txt` | `FFPRO/server/.env` (overwrite — `TRUST_PROXY_HOPS` is now `1`, not `2`) |
| `index.html` | `FFPRO/index.html` (overwrite) |

**Then delete these — they're dead now:**
```bash
cd FFPRO
git rm --cached .env server/.env      # stop tracking secrets (see below)
rm -f components/MagicInput.tsx components/BudgetAssistant.tsx components/VerificationQueue.tsx services/geminiService.ts
rm -f Dockerfile.nginx Dockerfile.backend nginx/default.conf docker/supervisord.conf server/Dockerfile server/docker/supervisord.conf
```

## Secrets — still applies, do this regardless of the above

Your repo's `.env` and `server/.env` are committed to a **public** GitHub
repo with live secrets in them (Postgres password, session secret, data
encryption key). `root-env.txt`/`server-env.txt` above already contain
freshly generated replacements. Since this is a fresh install with no real
data yet, there's no extra migration step needed — just use the new values
as-is. See the earlier `APPLY_THESE_CHANGES.md` for the full explanation of
why this matters; the short version is: it's a public repo, rotate now,
don't wait.

## Docker network setup — do this before `docker compose up`

`proxy_network` needs to already exist and already have your Nginx Proxy
Manager container attached to it. Check:
```bash
docker network ls | grep proxy_network
```
If it doesn't exist yet:
```bash
docker network create proxy_network
```
Then attach your existing NPM container to it (find its name/id with
`docker ps`, then):
```bash
docker network connect proxy_network <your-npm-container-name>
```
If NPM is itself managed by a docker-compose file, the cleaner way is to
add `proxy_network` as an `external: true` network in *that* compose file
too, and attach the NPM service to it, then `docker compose up -d` there —
otherwise the manual `docker network connect` above works fine and
persists across restarts.

## Build and deploy

```bash
cd FFPRO
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=50 app
```
Look for the migration lines, then `FFPRO auth server listening on port 4000`.

## Nginx Proxy Manager — the actual fix for the 8080/4000 mismatch

- **Proxy Host** → Domain: `ffpro.v79sl.duckdns.org`
- **Forward Hostname/IP**: `ffpro_app` (the container name — NPM can resolve
  this by name now that both containers share `proxy_network`)
- **Forward Port**: `4000` (not 8080 — nothing in this stack listens on
  8080 anymore)
- **Scheme**: `http`
- **SSL tab**: request a Let's Encrypt cert for the domain, force SSL

## Verify end to end

Load `https://ffpro.v79sl.duckdns.org`, register a user, log out, log back
in, and refresh the page while logged in to confirm the session cookie
survives a refresh. If login redirects loop or cookies don't stick, the
first thing to check is that `TRUST_PROXY_HOPS=1` actually made it into
`server/.env` — a leftover `2` here is the most common cause of that
specific symptom now that nginx is out of the container.
