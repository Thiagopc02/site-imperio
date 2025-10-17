// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { UserProvider } from "@/context/UserContext";
import { CartProvider } from "@/context/CartContext";
import "@/app/globals.css";

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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://site-imperio.vercel.app"),
  title: {
    default: "Império | Bebidas e Tabacos",
    template: "%s | Império",
  },
  description: "Distribuidora oficial de bebidas e tabacos em Campos Belos-GO.",
  applicationName: "Império",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Império",
  },
  themeColor: "#000000",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "Império",
    title: "Império | Bebidas e Tabacos",
    description: "Distribuidora oficial de bebidas e tabacos em Campos Belos-GO.",
    url: "/",
    images: [{ url: "/banner.jpg" }],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        {/* mobile first */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="font-sans antialiased text-white bg-black">
        <UserProvider>
          <CartProvider>{children}</CartProvider>
        </UserProvider>
      </body>
    </html>
  );
}
