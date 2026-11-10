import fs from "node:fs";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import siteLinks from "./src/integrations/site-links.mjs";

// Ganti dengan domain asli halte.id sebelum deploy — Astro butuh ini untuk
// sitemap.xml dan URL kanonik absolut (penting untuk SEO).
const SITE_URL = process.env.SITE_URL || "https://halte.id";

// DATA_DIR dari .env belum masuk process.env saat file ini dibaca; baca manual agar data yang dipakai sama
if (!process.env.DATA_DIR && fs.existsSync(".env")) {
  const m = fs.readFileSync(".env", "utf8").match(/^DATA_DIR=(.*)$/m);
  if (m) process.env.DATA_DIR = m[1].trim();
}
// Halte Sbr. yang digabung ke halaman pasangannya (lihat src/lib/stop-merge.js)
const { stopMerge } = await import("./src/lib/stop-merge.js");
const merged = stopMerge().toMain;
const mergedPaths = new Set([...merged.keys()].map(id => `/halte/${id}/`));

export default defineConfig({
  site: SITE_URL,
  // /halte/sbr-x → halaman berisi meta refresh + canonical ke /halte/x/ (cadangan bila _redirects tidak berlaku)
  redirects: Object.fromEntries([...merged].map(([sbr, main]) => [`/halte/${sbr}`, { status: 301, destination: `/halte/${main}/` }])),
  integrations: [
    // halaman hasil pencarian & pengalihan Sbr. tidak masuk sitemap
    sitemap({ filter: page => !/\/cari\/?$/.test(page) && !mergedPaths.has(new URL(page).pathname.replace(/\/?$/, "/")) }),
    siteLinks({ merged }),
  ],
});
