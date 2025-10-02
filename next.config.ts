// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // antes era `true`; hoje deve ser um objeto (vazio já serve)
    serverActions: {},
  },
};

export default nextConfig;
