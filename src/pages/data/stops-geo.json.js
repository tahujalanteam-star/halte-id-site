// Indeks ringkas untuk fitur "Halte terdekat" (diunduh hanya saat tombol ditekan).
// { r: { routeId: [slug, nama, warna, warnaTeks, kategori] },
//   s: [[stopId, nama, lat, lng, isBrt(0/1), [routeId, ...]], ...] }
import { loadStops, loadRoutesIndex, loadStopServices, routeSlug, readableText, categoryOf, compareCodes } from "../../lib/data.js";
import { coordOf } from "../../lib/stop-insights.js";

export async function GET() {
  const stops = loadStops();
  const svc = loadStopServices();
  const idx = loadRoutesIndex();
  const known = new Set(idx.map(e => String(e.id)));
  const r = {};
  for (const e of idx) {
    const c = e.route_color || "#334155";
    r[e.id] = [routeSlug(e), e.route_name, c, readableText(c), categoryOf(e)];
  }
  const s = [];
  for (const [id, st] of Object.entries(stops)) {
    const c = coordOf(id);
    if (!c) continue;
    const routes = (svc[id] || []).filter(x => known.has(String(x))).sort(compareCodes);
    s.push([id, st.name, +c.lat.toFixed(6), +c.lng.toFixed(6), st.type === "brt" ? 1 : 0, routes]);
  }
  return new Response(JSON.stringify({ r, s }), { headers: { "Content-Type": "application/json" } });
}
