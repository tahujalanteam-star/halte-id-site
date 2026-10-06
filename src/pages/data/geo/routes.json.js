// Info rute untuk /terdekat: { routeId: [slug, nama, warna, warnaTeks, kategori, label] }
import { loadRoutesIndex, routeSlug, readableText, categoryOf, routeLabel } from "../../../lib/data.js";

export async function GET() {
  const r = {};
  for (const e of loadRoutesIndex()) {
    const c = e.route_color || "#334155";
    r[e.id] = [routeSlug(e), e.route_name, c, readableText(c), categoryOf(e), routeLabel(e)];
  }
  return new Response(JSON.stringify(r), { headers: { "Content-Type": "application/json" } });
}
