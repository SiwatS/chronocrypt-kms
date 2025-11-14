# Prisma Database Setup

This directory contains the Prisma schema and migrations for the ChronoCrypt KMS persistent storage.

## Prerequisites

- PostgreSQL 12 or higher
- Bun or Node.js

## Quick Start

### 1. Install PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Docker:**
```bash
docker run --name chronocrypt-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=chronocrypt_kms \
  -p 5432:5432 \
  -d postgres:15
```

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE chronocrypt_kms;
CREATE USER chronocrypt WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE chronocrypt_kms TO chronocrypt;
\q
```

### 3. Configure Environment

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and set your DATABASE_URL
nano .env
```

Example DATABASE_URL:
```
DATABASE_URL="postgresql://chronocrypt:your-secure-password@localhost:5432/chronocrypt_kms?schema=public"
```

### 4. Run Migrations

```bash
# Generate Prisma Client
bun run db:generate

# Push schema to database (for development)
bun run db:push

# OR create and run migrations (for production)
bun run db:migrate
```

### 5. Seed Database

```bash
# Run seed script to create default data
bun run db:seed
```

## Database Schema

### Tables

#### audit_logs
Stores all KMS audit events for compliance and tracking.

- `id` - Unique identifier
- `timestamp` - Event timestamp (BigInt for high precision)
- `eventType` - Type of event (ACCESS_REQUEST, ACCESS_GRANTED, etc.)
- `actor` - Entity performing the action
- `target` - Target entity (optional)
- `startTime`/`endTime` - Time range for access requests
- `success` - Whether the action succeeded
- `details` - Additional JSON metadata
- `createdAt` - Database insertion time

**Indexes:** timestamp, eventType, actor, createdAt

#### policies
Access control policies for authorization.

- `id` - Unique identifier
- `name` - Policy name
- `type` - Policy type (whitelist, time-based, duration-limit, etc.)
- `priority` - Evaluation priority (higher = first)
- `enabled` - Whether policy is active
- `config` - Policy-specific configuration (JSON)
- `description` - Human-readable description
- `createdAt`/`updatedAt` - Timestamps

**Indexes:** priority, enabled, type

#### access_requests
Historical record of all access requests.

- `id` - Unique identifier
- `requesterId` - Who requested access
- `startTime`/`endTime` - Requested time range
- `purpose` - Purpose of the request
- `metadata` - Additional request data (JSON)
- `granted` - Whether access was granted
- `denialReason` - Reason if denied
- `keyCount` - Number of keys provided
- `createdAt` - When request was made

**Indexes:** requesterId, createdAt, granted

#### requesters
Registered users/systems that can request access.

- `id` - Unique identifier (CUID)
- `requesterId` - External requester identifier (unique)
- `name` - Display name
- `department` - Department/team
- `email` - Contact email
- `enabled` - Whether requester can make requests
- `metadata` - Additional data (JSON)
- `createdAt`/`updatedAt` - Timestamps

**Indexes:** requesterId, enabled

#### master_keys
Encrypted master keypair storage (for key rotation).

- `id` - Unique identifier
- `algorithm` - Encryption algorithm (EC)
- `curve` - Elliptic curve (P-256)
- `publicKeyJwk` - Public key in JWK format (JSON)
- `privateKeyJwk` - Private key encrypted (JSON)
- `createdAt` - When key was generated
- `rotatedAt` - When key was rotated
- `active` - Whether this is the active key

**Indexes:** active

## Available Commands

### Development

```bash
# Generate Prisma Client
bun run db:generate

# Push schema changes to database (no migration files)
bun run db:push

# Open Prisma Studio (database GUI)
bun run db:studio

# Seed database with default data
bun run db:seed
```

### Production

```bash
# Create a new migration
bun run db:migrate

# Apply pending migrations
prisma migrate deploy

# Generate Prisma Client
prisma generate
```

## Prisma Studio

Prisma Studio provides a visual interface for your database:

```bash
bun run db:studio
```

Then open: http://localhost:5555

## Migrations

### Creating Migrations

When you change the schema:

```bash
# 1. Update prisma/schema.prisma
# 2. Create migration
bun run db:migrate

# 3. Name your migration
# Example: "add_requester_table"
```

### Migration Files

Migrations are stored in `prisma/migrations/` with the format:
```
YYYYMMDDHHMMSS_migration_name/
├── migration.sql
```

### Applying Migrations

**Development:**
```bash
bun run db:migrate
```

**Production:**
```bash
prisma migrate deploy
```

## Backup and Restore

### Backup Database

```bash
# Backup to file
pg_dump -U chronocrypt chronocrypt_kms > backup.sql

# Backup with Docker
docker exec chronocrypt-postgres pg_dump -U postgres chronocrypt_kms > backup.sql
```

### Restore Database

```bash
# Restore from file
psql -U chronocrypt chronocrypt_kms < backup.sql

# Restore with Docker
docker exec -i chronocrypt-postgres psql -U postgres chronocrypt_kms < backup.sql
```

## Troubleshooting

### Connection Issues

**Error: Can't reach database server**

1. Check PostgreSQL is running:
   ```bash
   # macOS
   brew services list | grep postgresql

   # Linux
   sudo systemctl status postgresql

   # Docker
   docker ps | grep postgres
   ```

2. Verify DATABASE_URL in `.env`
3. Check firewall/network settings
4. Ensure database exists

### Migration Conflicts

**Error: Migration failed**

1. Check current migration status:
   ```bash
   prisma migrate status
   ```

2. Reset database (development only):
   ```bash
   prisma migrate reset
   ```

3. Resolve conflicts manually or:
   ```bash
   prisma migrate resolve --rolled-back "migration_name"
   ```

### Schema Out of Sync

**Error: Schema not in sync**

```bash
# Development: Push schema
bun run db:push

# Production: Run migrations
prisma migrate deploy
```

## Performance Optimization

### Indexes

The schema includes indexes on frequently queried fields:
- Audit logs: timestamp, eventType, actor
- Policies: priority, enabled
- Access requests: requesterId, createdAt, granted

### Query Optimization

Use Prisma's query optimization features:

```typescript
// Select specific fields
prisma.auditLog.findMany({
  select: {
    id: true,
    timestamp: true,
    eventType: true,
  }
});

// Use pagination
prisma.auditLog.findMany({
  take: 100,
  skip: 0,
  orderBy: { timestamp: 'desc' }
});
```

### Connection Pooling

For production, configure connection pooling in DATABASE_URL:

```
DATABASE_URL="postgresql://user:password@localhost:5432/chronocrypt_kms?schema=public&connection_limit=10&pool_timeout=20"
```

## Security Best Practices

1. **Use Strong Passwords**
   - Database user passwords should be strong and unique
   - Store credentials in environment variables, never in code

2. **Encrypt Private Keys**
   - Master private keys are stored encrypted
   - Use MASTER_KEY_ENCRYPTION_KEY environment variable
   - Rotate encryption keys periodically

3. **Network Security**
   - Use SSL/TLS for database connections in production
   - Restrict PostgreSQL access to specific IPs
   - Use firewall rules

4. **Regular Backups**
   - Automate daily backups
   - Test restore procedures
   - Store backups securely off-site

5. **Audit Log Retention**
   - Implement retention policies
   - Archive old logs
   - Maintain immutability

## Production Deployment

### Environment Variables

```bash
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public&sslmode=require"
MASTER_KEY_ENCRYPTION_KEY="strong-random-key-from-secrets-manager"
NODE_ENV="production"
```

### Deployment Steps

1. **Setup Database**
   ```bash
   # Create production database
   createdb chronocrypt_kms_prod
   ```

2. **Run Migrations**
   ```bash
   prisma migrate deploy
   ```

3. **Generate Client**
   ```bash
   prisma generate
   ```

4. **Seed Initial Data** (optional)
   ```bash
   bun run db:seed
   ```

5. **Start Application**
   ```bash
   bun run start
   ```

### Monitoring

Monitor database performance:

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check slow queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## References

- [Prisma Documentation](https://www.prisma.io/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [ChronoCrypt KMS Architecture](../../ARCHITECTURE.md)
