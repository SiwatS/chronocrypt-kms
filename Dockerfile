# ChronoCrypt KMS - Single Container with nginx + PM2
# Runs both backend (Bun) and frontend (Next.js) in one container

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy workspace files
COPY package.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/web/tsconfig.json ./apps/web/
COPY apps/web/next.config.ts ./apps/web/

# Install dependencies
WORKDIR /app/apps/web
RUN npm install

# Copy source
COPY apps/web ./

# Build Next.js
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 2: Backend Setup
FROM oven/bun:1 AS backend-builder

WORKDIR /app

# Copy backend files
COPY apps/backend/package.json ./apps/backend/
COPY apps/backend/tsconfig.json ./apps/backend/

# Install backend dependencies
WORKDIR /app/apps/backend
RUN bun install --production

# Copy backend source
COPY apps/backend ./

# Generate Prisma Client
RUN bun run db:generate || true

# Stage 3: Final Runtime Image
FROM node:20-alpine

# Install required packages
RUN apk add --no-cache \
    nginx \
    bash \
    curl \
    && npm install -g pm2 bun \
    && mkdir -p /var/log/nginx /var/log/pm2 /run/nginx

# Create app directory
WORKDIR /app

# Copy built frontend from builder
COPY --from=frontend-builder /app/apps/web/.next ./apps/web/.next
COPY --from=frontend-builder /app/apps/web/public ./apps/web/public
COPY --from=frontend-builder /app/apps/web/package.json ./apps/web/
COPY --from=frontend-builder /app/apps/web/next.config.ts ./apps/web/
COPY --from=frontend-builder /app/apps/web/node_modules ./apps/web/node_modules

# Copy backend from builder
COPY --from=backend-builder /app/apps/backend ./apps/backend

# Copy backend source (needed for runtime)
COPY apps/backend/src ./apps/backend/src
COPY apps/backend/prisma ./apps/backend/prisma

# Copy root config files
COPY ecosystem.config.js ./
COPY nginx.conf /etc/nginx/nginx.conf
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://postgres:password@localhost:5432/chronocrypt_kms"

# Expose nginx port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost/api/health || exit 1

# Start services
CMD ["./docker-entrypoint.sh"]
