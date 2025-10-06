// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Cabeçalhos globais (inclui CSP)
  async headers() {
    // Content Security Policy – liberar somente o essencial p/ Firebase Auth + reCAPTCHA v2
    const csp = [
      "default-src 'self'",
      // gsi/client (Google One-Tap/Popup), recaptcha e libs Google
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://*.gstatic.com https://apis.google.com https://www.recaptcha.net",
      // estilos inline e Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.google.com https://*.gstatic.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      // APIs que o Firebase Auth usa no login e troca de token
      "connect-src 'self' https://*.googleapis.com https://*.google.com https://*.gstatic.com https://www.recaptcha.net",
      // iframes/frames do Google (popup/gsi + recaptcha)
      "frame-src 'self' https://*.google.com https://www.recaptcha.net https://recaptcha.google.com",
      // evitar clickjacking
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self' https://*.google.com",
      // web workers (se usar)
      "worker-src 'self' blob:"
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // ajuste a Permissions-Policy ao que precisa de verdade
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
