// Rapikan tautan internal di HTML hasil build (sekali jalan setelah build selesai):
//  1. Semua tautan halaman diberi garis miring di akhir (/halte/blok-m → /halte/blok-m/), sama dengan URL
//     yang disajikan Cloudflare Pages dan dicatat sitemap. Tanpa ini setiap klik Googlebot kena satu pengalihan.
//  2. Tautan ke halte Sbr. yang digabung diarahkan langsung ke halaman pasangannya (src/lib/stop-merge.js).
//  3. Tulis dist/_redirects: pengalihan 301 permanen /halte/sbr-x/ → /halte/x/ (batas Cloudflare: 2.000 baris).
// Teks di dalam <script> tidak disentuh; tautan yang dibuat JavaScript dirapikan di sumbernya.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKIP = /^\/(_astro|data|og|fonts)\//;

export function makeFixHref(merged) {
  return url => {
    if (!url.startsWith("/") || url.startsWith("//")) return url;
    const i = url.search(/[?#]/);
    let p = i < 0 ? url : url.slice(0, i);
    const rest = i < 0 ? "" : url.slice(i);
    if (SKIP.test(p)) return url;
    const sbr = p.match(/^\/halte\/(sbr-[^/]+)\/?$/);
    if (sbr && merged.has(sbr[1])) p = `/halte/${merged.get(sbr[1])}/`;
    const last = p.split("/").pop();
    if (p !== "/" && !p.endsWith("/") && !last.includes(".")) p += "/";
    return p + rest;
  };
}

function* htmlFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(p);
    else if (e.name.endsWith(".html")) yield p;
  }
}

export default function siteLinks({ merged }) {
  return {
    name: "halte-id-site-links",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const fix = makeFixHref(merged);
        let files = 0, changed = 0;
        for (const f of htmlFiles(out)) {
          files++;
          const src = fs.readFileSync(f, "utf8");
          // pisahkan blok <script>…</script> agar kode JavaScript tidak ikut diubah
          const parts = src.split(/(<script\b[\s\S]*?<\/script>)/i);
          const res = parts.map((s, k) => k % 2 ? s : s.replace(/\bhref="([^"]*)"/g, (m, u) => `href="${fix(u)}"`)).join("");
          if (res !== src) { fs.writeFileSync(f, res); changed++; }
        }
        const lines = [...merged].map(([sbr, main]) => `/halte/${sbr}/ /halte/${main}/ 301`);
        const redirFile = path.join(out, "_redirects");
        const prev = fs.existsSync(redirFile) ? fs.readFileSync(redirFile, "utf8").trimEnd() + "\n" : "";
        fs.writeFileSync(redirFile, prev + lines.join("\n") + "\n");
        logger.info(`tautan internal dirapikan di ${changed}/${files} halaman; ${lines.length} pengalihan halte Sbr. ditulis ke _redirects`);
        if (lines.length > 2000) logger.warn("_redirects melebihi batas 2.000 baris Cloudflare Pages");
      },
    },
  };
}
