import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  typescript: {
    // Skip type checking during build (we have a separate type-check script)
    // This prevents Next.js from type-checking backend files copied for Eden Treaty
    ignoreBuildErrors: true,
  },
  eslint: {
    // Skip linting during build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
