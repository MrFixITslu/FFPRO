FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 4000

# Run pending migrations, then start the server.
CMD ["sh", "-c", "node scripts/migrate.js && node src/index.js"]
