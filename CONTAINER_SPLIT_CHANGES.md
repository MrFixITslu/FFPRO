# FFPRO — three separate containers (nginx / backend / postgres)

The repo as published only really builds **two** containers — one combined
image running nginx + the Node backend together via `supervisord`, plus
postgres. These new files split that combined image into a real third
container, so nginx, the backend, and postgres are each fully separate,
matching your actual deployment.

## Files and where they go

| File | Destination |
|---|---|
| `Dockerfile.nginx` | `FFPRO/Dockerfile.nginx` (new, repo root) |
| `Dockerfile.backend` | `FFPRO/Dockerfile.backend` (new, repo root — **replaces** `server/Dockerfile`, don't put it inside `server/`) |
| `default.conf` | `FFPRO/nginx/default.conf` (overwrite existing) |
| `docker-compose.yml` | `FFPRO/docker-compose.yml` (overwrite existing) |

You can delete `docker/supervisord.conf` and the old root `Dockerfile` and
`server/Dockerfile` afterward — nothing references them anymore, since
there's no longer a combined container that needs supervisord to keep two
processes alive.

## What actually changed

- **`Dockerfile.nginx`**: builds the frontend with Node, then copies the
  built `dist/` into a plain `nginx:1.27-alpine` image. No Node, no backend
  code, no supervisor in this container at all.
- **`Dockerfile.backend`**: installs backend deps only, runs as the `node`
  user (no root, no nginx). It still waits for Postgres and runs migrations
  before starting, same behavior as before, just via its own `CMD` instead
  of `supervisord`.
- **`nginx/default.conf`**: the one real functional change — `proxy_pass`
  now points to `http://backend:4000/api/` (the backend's Compose service
  name) instead of `http://127.0.0.1:4000/api/`. `127.0.0.1` only worked
  when both processes shared one container; across containers it has to be
  the service name, which Docker's internal DNS resolves automatically.
- **`docker-compose.yml`**: three services now — `postgres`, `backend`
  (builds from `Dockerfile.backend`, **no published port** — it's only
  reachable from `nginx` over the internal compose network, which is more
  secure than before, not less), and `nginx` (builds from `Dockerfile.nginx`,
  publishes `8080:80`, same as your current setup).

`TRUST_PROXY_HOPS=2` in `server/.env` does **not** need to change — it
counts network hops (NPM, then this nginx), not container boundaries, and
that's still two either way.

## Rebuild and redeploy

```bash
cd /path/to/FFPRO
docker compose down
docker compose build
docker compose up -d
docker compose ps
```

All three services should show healthy. Then check the backend actually
started and connected:
```bash
docker compose logs --tail=50 backend
```
Look for the migration lines followed by the server listening on port 4000.
If it can't resolve `postgres`, or `nginx` can't resolve `backend`, that
means they're not on the same Compose network — with a single
`docker-compose.yml` like this, Compose puts all three services on one
default network automatically, so that shouldn't happen unless something
external is overriding the network config.

## Still applies from before

The `.env` rotation, `.gitignore`, and `index.html` fixes from the earlier
round of files are independent of this container split and still need to
go in — this doesn't replace those, it's additive.
