import type { NextConfig } from 'next';

const config: NextConfig = {
  // tell Next.js where Prisma schema lives in the monorepo
  env: {
    PRISMA_SCHEMA_PATH: '../../prisma/schema.prisma',
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};

export default config;
