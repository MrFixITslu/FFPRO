# ---- Stage 1: build the frontend ----
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: install backend deps ----
FROM node:20-alpine AS backend-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/ ./

# ---- Stage 3: final image — backend + built frontend, ONE process, no nginx ----
# There's no nginx in here on purpose: Nginx Proxy Manager (already installed,
# already running as its own container) sits directly in front of this one.
# Express itself serves the built frontend and answers /api/* — see the
# static-serving block added to server/src/index.js.
FROM node:20-alpine

RUN apk add --no-cache postgresql16-client tini

# Backend app + its production node_modules
COPY --from=backend-build /app/server /app/server

# Built frontend static files — server/src/index.js serves these from
# FRONTEND_DIST_PATH, which defaults to ../dist relative to the backend's
# working directory, i.e. exactly this path.
COPY --from=frontend-build /app/dist /app/dist

RUN chown -R node:node /app/server /app/dist
WORKDIR /app/server
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
# Wait for postgres, run migrations, then start the single Node process that
# serves both the API and the built frontend on PORT (4000 by default).
CMD ["sh", "-c", "until pg_isready -h postgres -U ffpro -q; do echo '[ffpro] waiting for postgres...'; sleep 1; done; node scripts/migrate.js && exec node src/index.js"]
