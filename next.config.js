/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep native / server-only packages out of the bundle.
  serverExternalPackages: ['better-sqlite3', '@prisma/client', 'prisma'],
};

module.exports = nextConfig;
