// src/app/login/layout.tsx
import type { ReactNode } from "react";

export const metadata = {
  title: "Login | Império",
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content={[
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://www.recaptcha.net",
            "frame-src 'self' https://www.google.com https://www.recaptcha.net",
            "connect-src 'self' https://www.google.com https://www.gstatic.com https://www.recaptcha.net",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "img-src 'self' data: https:",
            "font-src 'self' https://fonts.gstatic.com data:",
          ].join('; ')}
        />
      </head>

      <div className="min-h-screen text-white bg-black">{children}</div>
    </>
  );
}
