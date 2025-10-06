// src/app/login/layout.tsx
import type { ReactNode } from "react";

export const metadata = {
  title: "Login | Império",
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-white bg-black">{children}</div>
  );
}
