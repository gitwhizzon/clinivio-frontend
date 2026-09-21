/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['socket.io-client'],
  // This app never uses next/image — fully disabling image optimization
  // removes the /_next/image route's transform pipeline entirely, which is
  // where an unpatched AVIF-related RCE lives in this Next.js version (no
  // 14.x backport exists for it, only fixed in the 15.5.x line).
  images: { unoptimized: true },
  env: {
    // All backend routes are served from a single unified API service.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://api.megnim.com',
  },
};
module.exports = nextConfig;
