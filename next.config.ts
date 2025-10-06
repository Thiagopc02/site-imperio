// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: {} },

  // Envia headers em TODAS as rotas (páginas e APIs)
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        // --- Segurança base
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        // Permissões de hardware (ajuste conforme necessidade)
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },

        // --- CSP (libera somente o necessário p/ Firebase Auth + reCAPTCHA v2 + Google Sign-In)
        {
          key: 'Content-Security-Policy',
          value: [
            // Base
            "default-src 'self'",
            // Scripts do app + Google + reCAPTCHA + GSI (alguns SDKs exigem inline/eval)
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://apis.google.com",
            // Conexões XHR/fetch (Firebase Auth, SecureToken, Google APIs, reCAPTCHA)
            "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net",
            // Imagens (inclui data: para ícones inline)
            "img-src 'self' data: https://www.google.com https://www.gstatic.com",
            // Estilos (o Tailwind in-JS pode precisar de inline)
            "style-src 'self' 'unsafe-inline'",
            // Fontes locais e data:
            "font-src 'self' data:",
            // iframes do Google (GSI, reCAPTCHA, contas)
            "frame-src 'self' https://www.google.com https://recaptcha.google.com https://accounts.google.com",
            // Para navegadores que ainda usam child-src
            "child-src https://www.google.com https://recaptcha.google.com https://accounts.google.com",
            // Form actions (não é obrigatório, mas ajuda ao reCAPTCHA)
            "form-action 'self' https://www.google.com",
            // Evita que outros sites controlem base URL
            "base-uri 'self'",
          ].join('; '),
        },
      ],
    },
  ],
}

export default nextConfig
