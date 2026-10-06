// Indeks pencarian beranda. Dipisah dari HTML agar beranda tetap ringan;
// baru diunduh saat kotak pencarian disentuh.
// Format ringkas: r = [label, nama, slug, warna, warnaTeks], h = [nama, id, brt],
// p = [nama, alias, slug, kategori], s = [nama, alias, slug, moda, warna]
import { loadRoutesIndex, loadStops, routeSlug, compareCodes, readableText, loadPlaces, placeCategoryLabel, routeLabel } from "../../lib/data.js";
import { stationList, primaryMode, modeInfo } from "../../lib/rail.js";

export async function GET() {
  const routes = loadRoutesIndex().slice().sort((a, b) => compareCodes(a.id, b.id));
  const out = {
    r: routes.map(r => { const c = r.route_color || "#334155"; return [routeLabel(r), r.route_name, routeSlug(r), c, readableText(c)]; }),
    h: Object.entries(loadStops()).map(([id, s]) => [s.name, id, s.type === "brt" ? 1 : 0]),
    p: Object.entries(loadPlaces()).map(([slug, p]) => [p.name, (p.aliases || []).join(" | "), slug, placeCategoryLabel(p.category)]),
    s: stationList().map(s => [s.name, s.short, s.slug, modeInfo(primaryMode(s)).short, modeInfo(primaryMode(s)).color]),
  };
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
}
