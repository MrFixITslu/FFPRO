# Where each file goes in your FFPRO repo

    FFPRO/
    ├── Dockerfile              <- REPLACES the existing root Dockerfile
    ├── docker-compose.yml      <- REPLACES the existing one
    ├── .env                    <- NEW (sits next to docker-compose.yml)
    ├── .dockerignore           <- NEW
    ├── docker/
    │   └── supervisord.conf    <- NEW folder + file
    ├── nginx/
    │   └── default.conf        <- REPLACES the existing one
    └── server/
        ├── .env                <- NEW (fill in OAuth credentials if using them)
        └── Dockerfile          <- DELETE this file, it's no longer used

## Deploy

```bash
cd FFPRO
docker network create proxy_network 2>/dev/null || true
docker compose up -d --build
docker compose logs -f app
```

Then in Nginx Proxy Manager, add a Proxy Host:
- Domain: ffpro.v79sl.duckdns.org
- Forward Hostname: ffpro_app
- Forward Port: 80
- SSL tab: request Let's Encrypt cert, Force SSL

## Notes

- SESSION_SECRET, DATA_ENCRYPTION_KEY, and POSTGRES_PASSWORD in these files
  are freshly generated random values, unique to this deployment — safe to
  use as-is. Back up DATA_ENCRYPTION_KEY somewhere separate from the server
  (password manager, etc.) — it can't be recovered if lost, and losing it
  makes every account's synced data permanently unreadable.
- Leave the GOOGLE_/FACEBOOK_/APPLE_ credential fields blank if you're not
  setting up that login provider yet — the backend just disables that
  button and logs a warning, it won't crash.
