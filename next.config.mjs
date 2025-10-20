/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // não travar o build por causa do ESLint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // não travar o build por causa de erros de tipo no TS
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
