/** @type {import('next').NextConfig} */
import path from 'path';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig = {
  // Optimize for production
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  transpilePackages: ['@repo/ui'],

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

export default withSentryConfig(nextConfig, {
  org: 'home-drx',
  project: 'tomai-landing',
  authToken: process.env['SENTRY_AUTH_TOKEN'],

  // Only print sourcemap-upload logs in CI — stays silent (and skips
  // upload) locally where SENTRY_AUTH_TOKEN is not set.
  silent: !process.env['CI'],

  // "home-drx" is an EU-region org: route the sourcemap upload API calls
  // through the EU domain (default sentryUrl is sentry.io/US).
  // https://docs.sentry.io/organization/data-storage-location/ (Using Data Storage Location APIs — EU: de.sentry.io)
  sentryUrl: 'https://de.sentry.io',
});
