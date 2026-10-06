// Gambar Open Graph per halaman: /og/rute/<slug>.png, /og/halte/<id>.png (halte BRT),
// /og/stasiun/<slug>.png, /og/kawasan/<slug>.png, dan /og/umum.png untuk halaman lain.
// Daftar halaman yang punya gambar sendiri ada di src/lib/og-pages.js
import { renderOg } from "../../lib/og.js";
import { ogSpecs } from "../../lib/og-pages.js";

export function getStaticPaths() {
  return [...ogSpecs().keys()].map(p => ({ params: { path: p } }));
}

export async function GET({ params }) {
  const png = await renderOg(ogSpecs().get(params.path));
  return new Response(png, { headers: { "Content-Type": "image/png" } });
}
