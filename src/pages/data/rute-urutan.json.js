// Urutan halte/stasiun untuk cek "langsung" di /perjalanan (dimuat hanya di halaman itu).
// r[k] = [indeks rute di daftar r /data/search.json, judul arah, [indeks halte di daftar h /data/search.json, ...]]
// k[k] = [kunci lin, label badge, warna, nama lin, [indeks stasiun di daftar s /data/search.json, ...]]  (satu entri per pola + arah)
import { loadRoutesIndex, loadRoute, loadStops, compareCodes, loadRailLines } from "../../lib/data.js";
import { stationList, railLines, lineInfo, LINE_BADGE } from "../../lib/rail.js";

export function GET() {
  const hIndex = new Map(Object.keys(loadStops()).map((id, i) => [id, i]));
  const routes = loadRoutesIndex().slice().sort((a, b) => compareCodes(a.id, b.id)); // urutan sama dengan search.json
  const r = [];
  routes.forEach((entry, ri) => {
    for (const d of loadRoute(entry.id)?.directions || []) {
      const seq = (d.stop_ids || []).map(id => hIndex.get(id)).filter(i => i !== undefined);
      if (seq.length > 1) r.push([ri, d.title || "", seq]);
    }
  });
  const sIndex = new Map(stationList().map((s, i) => [s.slug, i]));
  const raw = loadRailLines();
  const k = [];
  for (const { key } of railLines()) {
    const L = lineInfo(key), seen = new Set();
    for (const p of raw[key]?.patterns || []) {
      const seq = p.stations.map(s => sIndex.get(s)).filter(i => i !== undefined);
      const sig = seq.join(",");
      if (seq.length > 1 && !seen.has(sig)) { seen.add(sig); k.push([key, LINE_BADGE[key] || L.short, L.color, L.label, seq]); }
    }
  }
  return new Response(JSON.stringify({ r, k }), { headers: { "Content-Type": "application/json" } });
}
