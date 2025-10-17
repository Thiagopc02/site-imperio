// src/app/sitemap.ts
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://site-imperio.vercel.app";
  const now = new Date();

  const paths = [
    "/", "/produtos", "/contato", "/carrinho", "/sobre-nos",
    "/privacidade", "/termos", "/historia", "/login", "/admin/login",
  ];

  return paths.map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: p === "/" ? "weekly" : "monthly",
    priority: p === "/" ? 1 : 0.7,
  }));
}
