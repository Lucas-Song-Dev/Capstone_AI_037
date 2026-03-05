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
}

module.exports = nextConfig

