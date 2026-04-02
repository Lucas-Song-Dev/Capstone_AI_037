/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  typescript: {
    ignoreBuildErrors: true, // Temporarily disabled to diagnose build hang
  },
  eslint: {
    ignoreDuringBuilds: true, // Temporarily disabled to diagnose build hang
  },
  /**
   * Local dev only: browser uses same-origin `/api/*` (see `src/lib/api.ts`).
   * Next.js has no Python routes, so proxy to FastAPI (default http://127.0.0.1:8000).
   * Production (Vercel) uses root vercel.json rewrites instead; NODE_ENV !== development skips this.
   */
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') {
      return [];
    }
    const raw = process.env.API_PROXY_URL;
    if (raw === '0' || raw === 'false') {
      return [];
    }
    const target = (typeof raw === 'string' && raw.trim() !== '' ? raw : 'http://127.0.0.1:8000').replace(
      /\/$/,
      ''
    );
    return [{ source: '/api/:path*', destination: `${target}/api/:path*` }];
  },
};

module.exports = nextConfig;
