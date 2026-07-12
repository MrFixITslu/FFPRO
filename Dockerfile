# Multi-stage build to minimize container size and maximize speed
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (for better build caching)
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Run the build script
# This runs "vite build" for the frontend and "esbuild" for bundling server.ts
RUN npm run build

# --- Production Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built application assets and backend bundle from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# Expose the internal container port (Must match our reverse-proxy target)
EXPOSE 3000

# Start server using standard start command
CMD ["npm", "run", "start"]
