import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Ganti dengan domain asli halte.id sebelum deploy — Astro butuh ini untuk
// sitemap.xml dan URL kanonik absolut (penting untuk SEO).
const SITE_URL = process.env.SITE_URL || "https://halte-id.pages.dev";

export default defineConfig({
  site: SITE_URL,
  integrations: [sitemap()],
});
