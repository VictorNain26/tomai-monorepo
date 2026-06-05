/** @type {import('next').NextConfig} */
import path from 'path';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  transpilePackages: ['@repo/ui'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  env: {
    NEXT_TELEMETRY_DISABLED: '1',
  },
  // Workspace root explicite (monorepo) pour éviter les warnings de tracing.
  outputFileTracingRoot: path.join(process.cwd(), '../../'),
};

export default nextConfig;
