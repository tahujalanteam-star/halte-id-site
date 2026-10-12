// Data untuk peta locality di browser (/terdekat): geometri rel, stasiun beroperasi, katalog lin, dan terminal.
// Dimuat hanya saat pengguna membuka peta. Perhitungan petanya ada di src/lib/locality-core.js.
import { localityContext } from "../../../lib/locality-map.js";
import { RAIL_LINES, lineInfo } from "../../../lib/rail.js";
import { TERMINALS } from "../../../lib/terminals.js";

const round = v => Math.round(v * 1e6) / 1e6;

export function GET() {
  const c = localityContext();
  const out = {
    rail: c.railGeo.map(w => ({ l: w.l.filter(k => RAIL_LINES[k]), g: w.g.map(p => [round(p[0]), round(p[1])]) })).filter(w => w.l.length),
    stations: Object.fromEntries(Object.entries(c.stations).map(([slug, s]) => [slug, { name: s.name, short: s.short, lat: round(s.lat), lng: round(s.lng), lines: (s.lines || []).filter(k => RAIL_LINES[k]) }])),
    lines: Object.fromEntries(Object.keys(RAIL_LINES).map(k => { const L = lineInfo(k); return [k, { color: L.color, code: L.code, label: L.label }]; })),
    terminals: Object.fromEntries(Object.entries(TERMINALS).map(([key, t]) => [key, { name: t.name, stops: t.jalur.map(j => j.stop) }])),
  };
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
}
