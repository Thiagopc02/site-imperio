// layout.tsx
import { ReactNode } from "react";

export const metadata = {
  title: "Cadastro | Império",
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-white bg-black">
      {children}
    </div>
  );
}
