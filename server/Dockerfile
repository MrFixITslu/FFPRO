# ---- Stage 1: build frontend ----
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

# ---- Stage 3: final image — nginx + node backend, run together via supervisord ----
FROM node:20-alpine

RUN apk add --no-cache nginx supervisor postgresql16-client tini

# Frontend static files
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Backend app + its production node_modules
COPY --from=backend-build /app/server /app/server
RUN chown -R node:node /app/server

# Nginx: serves the frontend and proxies /api to the backend over localhost
# (both processes live in this container now, so no "backend" service DNS name).
COPY nginx/default.conf /etc/nginx/http.d/default.conf
RUN mkdir -p /run/nginx

# Supervisor: keeps nginx and the backend running as sibling processes,
# restarts either one if it dies, without one crash taking down the container.
COPY docker/supervisord.conf /etc/supervisord.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["supervisord", "-c", "/etc/supervisord.conf", "-n"]
