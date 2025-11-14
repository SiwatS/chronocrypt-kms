# ChronoCrypt KMS

A modern Key Management System built with Elysia and Next.js in a monorepo architecture.

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

## Tech Stack

### Backend
- **Elysia** - Fast and ergonomic Bun-based web framework
- **Bun** - JavaScript runtime and toolkit
- **TypeScript** - Type safety

### Frontend
- **Next.js 15** - React framework with App Router
- **React 18** - UI library
- **TypeScript** - Type safety

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
│   └── index.ts        # Main entry point
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

## API Endpoints

### Backend API

- `GET /` - API status and version
- `GET /health` - Health check
- `GET /api/keys` - List all keys
- `POST /api/keys` - Create a new key

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
