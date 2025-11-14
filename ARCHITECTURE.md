# ChronoCrypt KMS Architecture

## System Overview

ChronoCrypt KMS is a web-based Key Management System built on top of the `@siwats/chronocrypt` library. It provides a user-friendly interface for managing access control to time-sliced encrypted data using asymmetric encryption (ECIES + AES-GCM).

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js Frontend (Port 3000)                │
│  • Dashboard (stats, recent activity)                          │
│  • Access Request Form & Management                            │
│  • Policy Management UI                                        │
│  • Audit Log Viewer                                            │
│  • Key Management                                              │
└────────────────────────┬───────────────────────────────────────┘
                         │ REST API (JSON)
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Elysia Backend API (Port 3001)                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  KMS Core (Key Holder)                                    │ │
│  │  • Master keypair management                              │ │
│  │  • Access authorization                                   │ │
│  │  • Policy evaluation                                      │ │
│  │  • Time-specific key derivation                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Policy Engine                                            │ │
│  │  • Policy CRUD operations                                 │ │
│  │  • Custom policy compilation                              │ │
│  │  • Policy templates                                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Audit System                                             │ │
│  │  • Log all access activities                              │ │
│  │  • Query and filtering                                    │ │
│  │  • Statistics generation                                  │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                        │
│  • Audit logs (persistent)                                     │
│  • Access control policies                                     │
│  • User/requester management                                   │
│  • System configuration                                        │
│  • Master keypair (encrypted at rest)                          │
└─────────────────────────────────────────────────────────────────┘
```

## Security Model

### Three-Party Architecture

1. **DataSource (Untrusted Zone)**
   - Has public key only
   - Can encrypt temporal data
   - CANNOT decrypt (no private key)
   - Not managed by this KMS (external systems)

2. **KeyHolder/KMS (Trusted Zone)** ⭐ THIS APPLICATION
   - Holds master private key securely
   - Authorizes access requests
   - Derives time-specific private keys
   - Enforces access control policies
   - Never sees encrypted data content

3. **DataViewer (Controlled Zone)**
   - Requests access through KMS
   - Receives time-specific private keys
   - Can decrypt only authorized time periods
   - Not managed by this KMS (external systems)

## Backend API Design

### Base URL: `http://localhost:3001/api`

### 1. Access Request Management

#### POST /api/access-requests
Submit a new access request for time-sliced data.

**Request Body:**
```json
{
  "requesterId": "analyst-001",
  "timeRange": {
    "startTime": 1700000000000,
    "endTime": 1700003600000
  },
  "purpose": "Data analysis for Q4 report",
  "metadata": {
    "department": "Analytics",
    "project": "Q4-Review"
  }
}
```

**Response (Granted):**
```json
{
  "granted": true,
  "privateKeys": {
    "1700000000000": "<base64-encoded-key>",
    "1700001000000": "<base64-encoded-key>"
  },
  "metadata": {
    "keyCount": 2,
    "granularityMs": 1000
  }
}
```

**Response (Denied):**
```json
{
  "granted": false,
  "denialReason": "Access denied by policy: Requester not in whitelist"
}
```

#### GET /api/access-requests
List access requests from audit log.

**Query Parameters:**
- `requesterId` (optional): Filter by requester
- `startTime` (optional): Start of time range
- `endTime` (optional): End of time range
- `status` (optional): granted, denied, all
- `limit` (optional): Max results (default: 50)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "requests": [
    {
      "id": "audit-1700000000-abc123",
      "timestamp": 1700000000000,
      "requesterId": "analyst-001",
      "timeRange": {
        "startTime": 1700000000000,
        "endTime": 1700003600000
      },
      "purpose": "Data analysis",
      "status": "granted",
      "keyCount": 2
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### 2. Audit Log Management

#### GET /api/audit-logs
Query audit logs with filtering.

**Query Parameters:**
- `eventType` (optional): ACCESS_REQUEST, ACCESS_GRANTED, ACCESS_DENIED, KEY_GENERATION, KEY_DISTRIBUTION, DECRYPTION_ATTEMPT
- `actor` (optional): Filter by actor
- `startTime` (optional): Start of time range
- `endTime` (optional): End of time range
- `success` (optional): true, false
- `limit` (optional): Max results (default: 100)
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "entries": [
    {
      "id": "audit-1700000000-abc123",
      "timestamp": 1700000000000,
      "eventType": "ACCESS_REQUEST",
      "actor": "analyst-001",
      "target": "key-holder-main",
      "timeRange": {
        "startTime": 1700000000000,
        "endTime": 1700003600000
      },
      "success": true,
      "details": {
        "purpose": "Data analysis",
        "metadata": {}
      }
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

#### GET /api/audit-logs/stats
Get audit log statistics.

**Response:**
```json
{
  "totalEntries": 150,
  "entriesByType": {
    "ACCESS_REQUEST": 25,
    "ACCESS_GRANTED": 20,
    "ACCESS_DENIED": 5,
    "KEY_GENERATION": 20,
    "KEY_DISTRIBUTION": 20,
    "DECRYPTION_ATTEMPT": 60
  },
  "entriesByActor": {
    "analyst-001": 50,
    "analyst-002": 30,
    "admin": 70
  },
  "successRate": 0.95,
  "timeRange": {
    "earliest": 1700000000000,
    "latest": 1700086400000
  }
}
```

#### POST /api/audit-logs/export
Export audit logs.

**Request Body:**
```json
{
  "format": "csv",
  "filters": {
    "eventType": "ACCESS_REQUEST",
    "startTime": 1700000000000,
    "endTime": 1700086400000
  }
}
```

**Response:**
- CSV or JSON file download

### 3. Policy Management

#### GET /api/policies
List all access control policies.

**Response:**
```json
{
  "policies": [
    {
      "id": "allow-all",
      "name": "Allow All",
      "type": "built-in",
      "priority": -1000,
      "enabled": true,
      "description": "Allows all access requests (for development)"
    },
    {
      "id": "whitelist-analysts",
      "name": "Analyst Whitelist",
      "type": "custom",
      "priority": 100,
      "enabled": true,
      "description": "Only allow analysts-001 through analyst-010",
      "config": {
        "allowedRequesters": ["analyst-001", "analyst-002"]
      }
    }
  ]
}
```

#### GET /api/policies/:id
Get a specific policy.

#### POST /api/policies
Create a new custom policy.

**Request Body:**
```json
{
  "name": "Time-Based Restriction",
  "type": "time-based",
  "priority": 50,
  "config": {
    "maxDurationMs": 3600000,
    "allowedHoursUtc": [9, 10, 11, 12, 13, 14, 15, 16, 17]
  },
  "description": "Limit requests to 1 hour max during business hours"
}
```

**Response:**
```json
{
  "id": "policy-1700000000-xyz789",
  "name": "Time-Based Restriction",
  "type": "time-based",
  "priority": 50,
  "enabled": true,
  "createdAt": 1700000000000
}
```

#### PUT /api/policies/:id
Update a policy.

#### DELETE /api/policies/:id
Delete a custom policy (built-in policies cannot be deleted).

#### PUT /api/policies/:id/enable
Enable a policy.

#### PUT /api/policies/:id/disable
Disable a policy.

### 4. Key Management

#### GET /api/keys/master-public
Get the master public key (for distribution to DataSources).

**Response:**
```json
{
  "publicKey": {
    "kty": "EC",
    "crv": "P-256",
    "x": "MKBCTNIcKUSDii11ySs3526iDZ8AiTo7Tu6KPAqv7D4",
    "y": "4Etl6SRW2YiLUrN5vfvVHuhp7x8PxltmWWlbbM4IFyM",
    "ext": true
  },
  "algorithm": "ECDH",
  "curve": "P-256",
  "createdAt": 1700000000000
}
```

#### GET /api/keys/status
Get key management system status.

**Response:**
```json
{
  "masterKeyStatus": "active",
  "keyAlgorithm": "EC P-256",
  "keyCreatedAt": 1700000000000,
  "keyRotationScheduled": null,
  "totalKeysDerivied": 1500,
  "secureStorage": "enabled"
}
```

#### POST /api/keys/rotate
Initiate master key rotation (admin only).

### 5. System & Health

#### GET /api/health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": 1700000000000,
  "components": {
    "keyHolder": "operational",
    "auditLog": "operational",
    "policyEngine": "operational",
    "database": "operational"
  }
}
```

#### GET /api/stats
Get system statistics for dashboard.

**Response:**
```json
{
  "accessRequests": {
    "total": 150,
    "granted": 120,
    "denied": 30,
    "last24Hours": 25
  },
  "policies": {
    "total": 5,
    "enabled": 4,
    "disabled": 1
  },
  "auditLog": {
    "totalEntries": 500,
    "successRate": 0.92
  },
  "keyManagement": {
    "totalKeysDerivied": 1500,
    "averageKeysPerRequest": 10
  }
}
```

## Frontend Design

### Technology Stack
- Next.js 15 (App Router)
- React 18
- TypeScript
- TailwindCSS (to be added)
- shadcn/ui components (to be added)
- Recharts for data visualization

### Pages

#### 1. Dashboard (`/`)
- Key metrics cards (requests, policies, audit entries)
- Recent access requests table (last 10)
- Access request trends chart (7 days)
- System health status

#### 2. Access Requests (`/access-requests`)
- **Submit New Request** (form)
  - Requester ID input
  - Time range picker (start/end)
  - Purpose textarea
  - Additional metadata (JSON)
- **Request History** (table)
  - Columns: Timestamp, Requester, Time Range, Purpose, Status, Actions
  - Filters: Status, Requester, Date range
  - View details modal
  - Export to CSV

#### 3. Policies (`/policies`)
- **Policy List** (cards or table)
  - Policy name, type, priority, status (enabled/disabled)
  - Actions: Edit, Enable/Disable, Delete
- **Create Policy** (form or wizard)
  - Policy template selector
  - Configuration based on template
  - Test policy against sample requests
- **Policy Templates**
  - Requester Whitelist
  - Time-Based Restrictions
  - Purpose Validation
  - Duration Limits
  - Business Hours Only

#### 4. Audit Logs (`/audit-logs`)
- **Audit Table**
  - Columns: Timestamp, Event Type, Actor, Target, Status, Details
  - Filters: Event type, Actor, Date range, Success/Failure
  - Real-time updates (optional WebSocket)
- **Statistics Dashboard**
  - Event type distribution (pie chart)
  - Access trends over time (line chart)
  - Success rate gauge
- **Export**
  - CSV/JSON download
  - Filter-based export

#### 5. Key Management (`/keys`)
- **Master Key Status**
  - Algorithm, Curve, Created At
  - NOT the key itself (security)
- **Public Key Export**
  - Display public key JWK
  - Copy to clipboard
  - Download as file
- **Key Rotation** (admin only)
  - Schedule rotation
  - Rotation history

#### 6. Settings (`/settings`)
- System configuration
- User management (future)
- Security settings

## Database Schema (PostgreSQL + Prisma)

### Tables

```prisma
model AuditLog {
  id         String   @id
  timestamp  BigInt
  eventType  String
  actor      String
  target     String?
  startTime  BigInt?
  endTime    BigInt?
  success    Boolean
  details    Json?
  createdAt  DateTime @default(now())

  @@index([timestamp])
  @@index([eventType])
  @@index([actor])
}

model Policy {
  id          String   @id @default(cuid())
  name        String
  type        String
  priority    Int      @default(0)
  enabled     Boolean  @default(true)
  config      Json?
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([priority])
  @@index([enabled])
}

model MasterKey {
  id              String   @id @default(cuid())
  algorithm       String
  curve           String
  publicKeyJwk    Json
  privateKeyJwk   Json     // Encrypted at rest
  createdAt       DateTime @default(now())
  rotatedAt       DateTime?
  active          Boolean  @default(true)

  @@index([active])
}

model Requester {
  id          String   @id @default(cuid())
  requesterId String   @unique
  name        String?
  department  String?
  email       String?
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([requesterId])
  @@index([enabled])
}
```

## Security Considerations

### 1. Master Private Key Storage
- Store encrypted at rest using environment encryption key
- Consider HSM or secure enclave for production
- Never expose private key via API
- Implement key rotation capability

### 2. API Authentication
- Implement JWT-based authentication
- Role-based access control (admin, viewer, requester)
- API rate limiting
- CORS configuration

### 3. Audit Logging
- All operations must be logged
- Immutable audit log
- Regular audit log review
- Long-term audit log retention

### 4. Access Control Policies
- Default-deny policy
- Least privilege principle
- Policy version control
- Policy testing before activation

### 5. Data Protection
- HTTPS only
- Secure headers (HSTS, CSP)
- Input validation and sanitization
- SQL injection prevention (Prisma ORM)

## Deployment

### Development
```bash
npm install
npm run dev
```

### Production
```bash
npm run build
npm run start
```

### Environment Variables
```bash
# Backend
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/chronocrypt_kms
MASTER_KEY_ENCRYPTION_KEY=<strong-encryption-key>

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Future Enhancements

1. **Real-time Dashboard**
   - WebSocket for live updates
   - Real-time audit log streaming

2. **Advanced Policy Builder**
   - Visual policy builder
   - Policy simulation
   - Policy versioning

3. **Multi-tenancy**
   - Organization support
   - Tenant isolation

4. **Key Rotation Automation**
   - Scheduled key rotation
   - Zero-downtime rotation
   - Key version management

5. **Integration Features**
   - LDAP/AD integration for requesters
   - SIEM integration for audit logs
   - Slack/email notifications

6. **Compliance**
   - SOC 2 compliance features
   - GDPR compliance tools
   - Compliance reporting

## References

- ChronoCrypt Library: https://github.com/SiwatINC/chronocrypt
- ECIES: Elliptic Curve Integrated Encryption Scheme
- HKDF: RFC 5869
- AES-GCM: NIST SP 800-38D
