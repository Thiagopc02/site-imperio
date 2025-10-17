// app/sitemap.ts
import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://imperiodistr3015.com.br";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes = [
    "",                // /
    "/produtos",
    "/contato",
    "/sobre-nos",
    "/termos",
    "/privacidade",
    "/login",
    "/recuperar",
    "/(privado)/carrinho",
    "/(privado)/pedidos",
  ];

  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === "" || path === "/produtos" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/produtos" ? 0.9 : 0.6,
  }));
}
