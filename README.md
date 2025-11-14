# ChronoCrypt KMS

A web-based Key Management System for temporal data access control, built with Elysia and Next.js. Based on the [@siwats/chronocrypt](https://github.com/SiwatINC/chronocrypt) library, it implements asymmetric time-based encryption (ECIES + AES-GCM) with zero-knowledge authorization.

## Architecture

This project uses a monorepo structure with the following components:

```
chronocrypt-kms/
├── apps/
│   ├── backend/        # Elysia API server
│   └── web/            # Next.js frontend
├── packages/           # Shared packages (future)
└── package.json        # Root workspace configuration
```

## Features

- **🔐 Temporal Access Control**: Time-slice based encryption with granular access authorization
- **🔒 Asymmetric Security**: DataSource has public key only - cannot decrypt even if compromised
- **✅ Access Request Workflow**: Submit, evaluate, and authorize access requests with policy enforcement
- **📊 Comprehensive Audit Logging**: Track all authorization activities with detailed audit trails
- **⚙️ Policy Management**: Extensible access control policies (whitelist, time-based, duration limits)
- **🔑 Key Management**: Secure master keypair handling with time-specific key derivation
- **📈 Statistics & Monitoring**: Real-time dashboards for system health and activity
- **🔍 Zero-Knowledge Authorization**: KeyHolder authorizes without seeing encrypted data

## Tech Stack

### Backend
- **@siwats/chronocrypt** - Asymmetric time-based encryption library
- **Elysia** - Fast and ergonomic Bun-based web framework
- **Bun** - JavaScript runtime and toolkit
- **TypeScript** - Type safety

### Frontend
- **Next.js 15** - React framework with App Router
- **React 18** - UI library
- **TypeScript** - Type safety

### Cryptography
- **ECIES** - Elliptic Curve Integrated Encryption Scheme
- **ECDH** - Elliptic Curve Diffie-Hellman (P-256/secp256r1)
- **HKDF** - HMAC-based Key Derivation Function (RFC 5869)
- **AES-GCM** - Advanced Encryption Standard - Galois/Counter Mode
- **AES-KW** - AES Key Wrap (RFC 3394)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18 or higher (for Next.js)
- **Bun** latest version (for Elysia backend)
- **npm** (comes with Node.js)

### Installing Bun

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"
```

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd chronocrypt-kms
```

### 2. Install dependencies

```bash
npm install
```

This will install dependencies for all workspaces (backend and web).

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` if needed. Default values should work for local development.

### 4. Start development servers

#### Option A: Start all services (recommended)

```bash
npm run dev
```

This will start both the backend (port 3001) and frontend (port 3000).

#### Option B: Start services individually

```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:web
```

### 5. Access the application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Backend Health**: http://localhost:3001/health

## Available Scripts

### Root Level

- `npm run dev` - Start all development servers
- `npm run dev:backend` - Start only the backend
- `npm run dev:web` - Start only the frontend
- `npm run build` - Build all applications
- `npm run build:backend` - Build only the backend
- `npm run build:web` - Build only the frontend
- `npm run clean` - Remove all node_modules

### Backend (apps/backend)

```bash
cd apps/backend
bun run dev      # Start development server
bun run build    # Build for production
bun run start    # Start production server
bun test         # Run tests
```

### Frontend (apps/web)

```bash
cd apps/web
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run linter
npm run type-check # Run TypeScript type checking
```

## Project Structure

### Backend (apps/backend)

```
apps/backend/
├── src/
│   ├── index.ts                # Main Elysia API server
│   └── services/
│       └── kms.ts             # KMS Service (wraps ChronoCrypt KeyHolder)
├── package.json
└── tsconfig.json
```

### Frontend (apps/web)

```
apps/web/
├── src/
│   └── app/
│       ├── layout.tsx    # Root layout
│       ├── page.tsx      # Home page
│       └── globals.css   # Global styles
├── next.config.ts
├── package.json
└── tsconfig.json
```

## API Documentation

### Base URL

```
http://localhost:3001
```

### Root & Health

- **GET /** - API information and available endpoints
- **GET /api/health** - System health check

### Access Request Management

- **POST /api/access-requests** - Submit a new access request
  ```json
  {
    "requesterId": "analyst-001",
    "timeRange": {
      "startTime": 1700000000000,
      "endTime": 1700003600000
    },
    "purpose": "Data analysis",
    "metadata": {}
  }
  ```

- **GET /api/access-requests** - List access requests
  - Query params: `requesterId`, `startTime`, `endTime`, `status`, `limit`, `offset`

### Audit Logs

- **GET /api/audit-logs** - Query audit logs with filtering
  - Query params: `eventType`, `actor`, `startTime`, `endTime`, `success`, `limit`, `offset`
  - Event types: `ACCESS_REQUEST`, `ACCESS_GRANTED`, `ACCESS_DENIED`, `KEY_GENERATION`, `KEY_DISTRIBUTION`, `DECRYPTION_ATTEMPT`

- **GET /api/audit-logs/stats** - Get audit log statistics

### Policy Management

- **GET /api/policies** - List all access control policies
- **GET /api/policies/:id** - Get a specific policy
- **POST /api/policies** - Create a new custom policy
- **DELETE /api/policies/:id** - Delete a custom policy
- **PUT /api/policies/:id/enable** - Enable a policy
- **PUT /api/policies/:id/disable** - Disable a policy

### Key Management

- **GET /api/keys/master-public** - Get master public key (for distribution to DataSources)
- **GET /api/keys/status** - Get key management system status

### Statistics

- **GET /api/stats** - Get system statistics for dashboard
  - Access requests (total, granted, denied, last 24h)
  - Policies (total, enabled, disabled)
  - Audit log (entries, success rate)
  - Key management (keys derived, average per request)

For detailed API documentation, see [ARCHITECTURE.md](ARCHITECTURE.md)

## Development

### Adding a new API endpoint (Backend)

Edit `apps/backend/src/index.ts`:

```typescript
app.get('/api/your-endpoint', () => {
  return { data: 'your data' };
});
```

### Adding a new page (Frontend)

Create a new file in `apps/web/src/app/`:

```typescript
// apps/web/src/app/your-page/page.tsx
export default function YourPage() {
  return <div>Your Page</div>;
}
```

### Shared packages (Future)

Create shared packages in the `packages/` directory:

```bash
mkdir -p packages/your-package
cd packages/your-package
npm init -y
```

Update root `package.json` workspaces if needed.

## Building for Production

### Build all applications

```bash
npm run build
```

### Run production servers

```bash
# Backend
cd apps/backend
bun run start

# Frontend
cd apps/web
npm run start
```

## Troubleshooting

### Port already in use

If ports 3000 or 3001 are already in use:

**Backend**: Edit `apps/backend/src/index.ts` and change the port in `.listen(3001)`

**Frontend**: Use a different port: `npm run dev:web -- -p 3002`

### Bun not found

Make sure Bun is installed and in your PATH:

```bash
bun --version
```

If not found, reinstall Bun or add it to your PATH.

### Dependencies not installing

Try cleaning and reinstalling:

```bash
npm run clean
npm install
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT

## Future Enhancements

- [ ] Database integration (PostgreSQL)
- [ ] Authentication & Authorization
- [ ] Key encryption/decryption endpoints
- [ ] Key rotation functionality
- [ ] Audit logging
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Docker support
- [ ] CI/CD pipeline
- [ ] Monitoring and observability
