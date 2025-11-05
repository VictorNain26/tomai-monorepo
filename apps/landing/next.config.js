/** @type {import('next').NextConfig} */
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
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Vercel-specific optimizations
  env: {
    NEXT_TELEMETRY_DISABLED: '1',
  },
};

export default nextConfig;
