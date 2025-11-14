#!/bin/bash
set -e

echo "🚀 Starting ChronoCrypt KMS..."

# Create log directories
mkdir -p /var/log/pm2 /var/log/nginx

# Test nginx configuration
echo "✓ Testing nginx configuration..."
nginx -t

# Start nginx in background
echo "✓ Starting nginx..."
nginx

# Wait for nginx to start
sleep 2

# Generate Prisma Client if needed
if [ -f "/app/apps/backend/prisma/schema.prisma" ]; then
    echo "✓ Generating Prisma Client..."
    cd /app/apps/backend
    bun run db:generate || echo "⚠ Prisma generation skipped"
    cd /app
fi

# Start PM2 with ecosystem file
echo "✓ Starting PM2 processes..."
pm2-runtime start ecosystem.config.js --env production

# Keep container running
tail -f /dev/null
