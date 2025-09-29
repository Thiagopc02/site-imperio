import { ReactNode } from "react";

export const metadata = {
  title: "Recuperar Senha | Império",
};

export default function RecuperarLayout({ children }: { children: ReactNode }) {
  return <>{children}</>; // Sem <div> com classes extras
}
