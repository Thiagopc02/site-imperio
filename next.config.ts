// next.config.ts
import type { NextConfig } from 'next';

const csp = [
  // regra base
  "default-src 'self' https://*.vercel.app",
  // scripts do Google / reCAPTCHA / Firebase UI
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://apis.google.com https://www.recaptcha.net https://accounts.google.com",
  // estilos (Google Fonts, inline do Next/Tailwind)
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // imagens e data URIs
  "img-src 'self' data: blob: https://www.google.com https://www.gstatic.com",
  // fontes
  "font-src 'self' data: https://fonts.gstatic.com",
  // iframes (recaptcha e contas Google)
  "frame-src https://www.google.com https://www.recaptcha.net https://recaptcha.google.com https://accounts.google.com",
  // conexões XHR/fetch usadas no login
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://firestore.googleapis.com https://firebasestorage.googleapis.com https://oauth2.googleapis.com https://accounts.google.com",
  // reforços
  "base-uri 'self'",
  "form-action 'self' https://www.google.com",
  "frame-ancestors 'self'"
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: {} },

  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],
};

export default nextConfig;
