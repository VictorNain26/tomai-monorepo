/** @type {import('next').NextConfig} */
import path from 'path';
import process from 'process';

const nextConfig = {
  // Optimize for production
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Images configuration
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // Performance optimizations
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // Vercel-specific optimizations
  env: {
    NEXT_TELEMETRY_DISABLED: '1',
  },

  // Explicitly set workspace root to avoid warnings
  outputFileTracingRoot: path.join(process.cwd(), '../../'),
};

export default nextConfig;
