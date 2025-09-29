// layout.tsx
import { ReactNode } from "react";

export const metadata = {
  title: "Login | Império",
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      {children}
    </div>
  );
}
