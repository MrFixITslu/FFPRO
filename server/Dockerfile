FROM node:20-alpine

# Small, standard-library healthcheck script (avoids installing curl/wget).
RUN apk add --no-cache tini

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /run/secrets && chown -R node:node /app
USER node

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tini reaps zombie processes and forwards signals properly (needed for the
# graceful-shutdown handling in src/index.js to actually receive SIGTERM).
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "node scripts/migrate.js && node src/index.js"]
