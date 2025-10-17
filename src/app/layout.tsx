// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";

import { UserProvider } from "@/context/UserContext";
import { CartProvider } from "@/context/CartContext";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

// ====== Config de domínio ======
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://imperiodistr3015.com.br";

// ====== SEO / Metadados ======
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Império | Bebidas & Tabacos",
    template: "%s | Império",
  },
  description:
    "Distribuidora oficial de bebidas e tabacos em Campos Belos-GO. Entrega rápida e preços imbatíveis.",
  applicationName: "Império",
  keywords: [
    "bebidas",
    "tabacaria",
    "distribuidora",
    "Campos Belos",
    "delivery",
    "destilados",
    "refrigerantes",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Império",
    title: "Império | Bebidas & Tabacos",
    description:
      "Distribuidora oficial de bebidas e tabacos em Campos Belos-GO.",
    images: [
      {
        url: "/banner.jpg",
        width: 1200,
        height: 630,
        alt: "Império - Bebidas & Tabacos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Império | Bebidas & Tabacos",
    description:
      "Distribuidora oficial de bebidas e tabacos em Campos Belos-GO.",
    images: ["/banner.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: SITE_URL,
  },
};

// Cor da barra do navegador (Android) e iOS status bar
export const viewport: Viewport = {
  themeColor: "#111111",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased text-white bg-black">
        <UserProvider>
          <CartProvider>{children}</CartProvider>
        </UserProvider>
      </body>
    </html>
  );
}
