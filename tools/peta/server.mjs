// Peta interaktif internal tim halte.id (hanya untuk dijalankan lokal, TIDAK ikut build/deploy).
// Jalankan dari folder halte-id-site:  npm run peta   →  buka http://localhost:4400
// Data dibaca dari DATA_DIR yang sama dengan situs (lihat .env), token Mapbox dari PUBLIC_MAPBOX_TOKEN.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
process.chdir(ROOT);

// .env sederhana (KEY=VALUE); variabel yang sudah ada di environment tidak ditimpa
for (const f of [".env", ".env.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const TOKEN = process.env.PUBLIC_MAPBOX_TOKEN || "";
const PORT = Number(process.env.PETA_PORT || 4400);

// data.js membaca DATA_DIR saat diimpor, jadi impor setelah .env dibaca
const D = await import("../../src/lib/data.js");
const R = await import("../../src/lib/rail.js");

const r5 = v => Math.round(v * 1e5) / 1e5;
function buildNetwork() {
  const t0 = Date.now();
  const stops = D.loadStops(), services = D.loadStopServices(), coords = D.loadStopCoords();
  const routes = [];
  for (const e of D.loadRoutesIndex()) {
    let r = null; try { r = D.loadRoute(e.id); } catch { /* rute tanpa file */ }
    const geo = D.loadJalur(e.id);
    routes.push({
      id: e.id, label: D.routeLabel(e), name: e.route_name || "", cat: D.categoryOf(e), color: e.route_color || "#334155", slug: D.routeSlug(e),
      dirs: (r?.directions || []).map((d, i) => ({
        title: d.title || `Arah ${i + 1}`, stops: d.stop_ids || [],
        line: (D.getDirectionGeometry(geo, d.id, i)?.coordinates || []).map(([x, y]) => [r5(+x), r5(+y)]),
      })),
    });
  }
  const stopOut = {};
  for (const [id, s] of Object.entries(stops)) {
    const c = coords[id];
    stopOut[id] = { n: s.name, t: s.type, c: c && Number.isFinite(c.lng) ? [r5(c.lng), r5(c.lat)] : null, r: services[id] || [] };
  }
  const stations = Object.entries(D.loadStations()).filter(([, s]) => Number.isFinite(s.lat)).map(([slug, s]) => ({
    slug, n: s.name, c: [r5(s.lng), r5(s.lat)], open: R.isOpen(s),
    lines: R.sortLines(s.lines || []).map(k => ({ key: k, code: R.lineCode(k), color: R.RAIL_LINES[k].color, label: R.RAIL_LINES[k].label })),
  }));
  const rail = D.loadRailGeo().filter(w => w.l.some(k => R.RAIL_LINES[k])).map(w => {
    const k = R.sortLines(w.l)[0];
    return { k, code: R.lineCode(k), color: R.RAIL_LINES[k].color, g: w.g.map(([la, ln]) => [ln, la]) };
  });
  // Pola layanan kereta (urutan stasiun per arah) untuk cek A → B
  const railServices = [];
  for (const [key, L] of Object.entries(D.loadRailLines())) {
    if (!R.RAIL_LINES[key]) continue;
    for (const p of L.patterns || []) if ((p.stations || []).length > 1) railServices.push({ key, code: R.lineCode(key), color: R.RAIL_LINES[key].color, label: R.RAIL_LINES[key].label, name: p.name || "", stations: p.stations });
  }
  const places = Object.entries(D.loadPlaces()).filter(([, p]) => Number.isFinite(p.lat)).map(([slug, p]) => ({ slug, n: p.name, a: p.aliases || [], c: [r5(p.lng), r5(p.lat)] }));
  const cats = [...D.ROUTE_CATEGORIES, { key: "lainnya", label: "Rute Lainnya" }];
  console.log(`  data: ${routes.length} rute, ${Object.keys(stopOut).length} halte, ${stations.length} stasiun, ${rail.length} ruas rel, ${railServices.length} pola kereta, ${places.length} tempat (${Date.now() - t0} ms)`);
  return JSON.stringify({ routes, stops: stopOut, stations, rail, railServices, places, cats, builtAt: new Date().toISOString() });
}
const network = buildNetwork();

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json" };
http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/network.json") { res.writeHead(200, { "content-type": TYPES[".json"], "cache-control": "no-store" }); return res.end(network); }
  const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const full = path.join(HERE, "public", path.normalize(file).replace(/^(\.\.[/\\])+/, ""));
  if (!full.startsWith(path.join(HERE, "public")) || !fs.existsSync(full)) { res.writeHead(404); return res.end("Tidak ditemukan"); }
  let body = fs.readFileSync(full);
  if (file === "index.html") body = body.toString().replace("__MAPBOX_TOKEN__", TOKEN);
  res.writeHead(200, { "content-type": TYPES[path.extname(full)] || "application/octet-stream", "cache-control": "no-store" });
  res.end(body);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`\n  Peta internal halte.id → http://localhost:${PORT}`);
  if (!TOKEN) console.log("  ⚠ PUBLIC_MAPBOX_TOKEN kosong: isi di .env agar peta dasar tampil.");
  console.log("  Data dibaca sekali saat server dinyalakan; setelah data berubah, matikan (Ctrl+C) lalu jalankan ulang.\n");
});
