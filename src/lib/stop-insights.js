// Informasi turunan untuk halaman halte & kawasan:
//  - konteks halte sebelum/sesudah per rute per arah (dari routes/*.json)
//  - halte terdekat (dari stop-coords.json)
//  - kelompok kawasan: halte bernama mirip yang berjarak <= GROUP_RADIUS_M
//    (mis. Kampung Melayu + Terminal Kampung Melayu + Flyover Kampung Melayu)
//
// Koreksi manual kawasan lewat data/stop-groups.json (semua opsional):
// {
//   "exclude": ["sbr-term-kampung-rambutan"],            // jangan masukkan halte ini ke kawasan mana pun
//   "extra":   { "kampung-melayu": ["halte-lain-id"] },   // tambahkan halte ke kawasan tempat halte kunci berada
//   "names":   { "terminal-kampung-melayu": "Terminal Kampung Melayu" }  // ganti nama kawasan (kunci = slug)
// }
import {
  loadStops, loadRoutesIndex, loadRoute, loadStopCoords, loadStopGroupOverrides, slugify,
} from "./data.js";

export const GROUP_RADIUS_M = 250;
export const NEARBY_RADIUS_M = 500;

const memo = new Map();
const once = (k, fn) => (memo.has(k) ? memo.get(k) : (memo.set(k, fn()), memo.get(k)));

export function distanceM(a, b) {
  const R = 6371000, toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m) {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

export function coordOf(stopId) {
  const c = loadStopCoords()[stopId];
  return c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? c : null;
}

// stopId -> [{ routeId, dirIndex, dirTitle, firstId, lastId, prevId, nextId, pos, total, dirCount }]
export function stopOccurrences() {
  return once("occ", () => {
    const occ = new Map();
    for (const e of loadRoutesIndex()) {
      let r;
      try { r = loadRoute(e.id); } catch { continue; }
      const dirs = r.directions || [];
      dirs.forEach((d, di) => {
        const ids = d.stop_ids || [];
        ids.forEach((sid, i) => {
          if (!occ.has(sid)) occ.set(sid, []);
          occ.get(sid).push({
            routeId: String(e.id), dirIndex: di, dirTitle: d.title, dirCount: dirs.length,
            firstId: ids[0], lastId: ids[ids.length - 1],
            prevId: i > 0 ? ids[i - 1] : null, nextId: i < ids.length - 1 ? ids[i + 1] : null,
            pos: i, total: ids.length,
          });
        });
      });
    }
    return occ;
  });
}

// Konteks per rute untuk satu halte: Map routeId -> occurrences (urut arah)
export function routeContext(stopId) {
  const map = new Map();
  for (const o of stopOccurrences().get(stopId) || []) {
    if (!map.has(o.routeId)) map.set(o.routeId, []);
    map.get(o.routeId).push(o);
  }
  for (const list of map.values()) list.sort((a, b) => a.dirIndex - b.dirIndex || a.pos - b.pos);
  return map;
}

// Halte lain dalam radius tertentu, terdekat dulu: [{ id, distance }]
export function nearbyStops(stopId, { radius = NEARBY_RADIUS_M, limit = 8, exclude = [] } = {}) {
  const me = coordOf(stopId);
  if (!me) return [];
  const skip = new Set([stopId, ...exclude]);
  const coords = loadStopCoords();
  const out = [];
  for (const [id, c] of Object.entries(coords)) {
    if (skip.has(id) || !Number.isFinite(c?.lat)) continue;
    if (Math.abs(c.lat - me.lat) > 0.01 || Math.abs(c.lng - me.lng) > 0.01) continue; // ~1 km, saringan cepat
    const d = distanceM(me, c);
    if (d <= radius) out.push({ id, distance: d });
  }
  return out.sort((a, b) => a.distance - b.distance).slice(0, limit);
}

// Nama dasar untuk pengelompokan: "Term. Kampung Melayu 4" -> "kampung melayu"
export function baseName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/\bps\b/g, "pasar").replace(/\bkp\b/g, "kampung").replace(/\bjln?\b/g, "jalan").replace(/\bgg\b/g, "gang")
    .replace(/\b(terminal|term|sbr|seberang|flyover|stasiun|st|halte)\b/g, " ")
    .replace(/\barah (barat|timur|utara|selatan)\b/g, " ")
    .replace(/\b(\d+|i{1,3}|iv|vi{0,3}|ix|x)\b/g, " ")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const titleCase = s => s.replace(/\b\w/g, ch => ch.toUpperCase());

// Kelompok kawasan: [{ slug, name, stopIds, hasTerminal }], plus Map stopId -> group
export function stopGroups() {
  return once("groups", () => {
    const stops = loadStops();
    const ov = loadStopGroupOverrides() || {};
    const excluded = new Set(ov.exclude || []);
    const buckets = new Map();
    for (const id of Object.keys(stops)) {
      if (excluded.has(id) || !coordOf(id)) continue;
      const b = baseName(stops[id].name);
      if (b.length < 3) continue;
      if (!buckets.has(b)) buckets.set(b, []);
      buckets.get(b).push(id);
    }
    // union-find per nama dasar
    const parent = new Map();
    const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const union = (a, b) => parent.set(find(a), find(b));
    for (const ids of buckets.values()) {
      if (ids.length < 2) continue;
      ids.forEach(id => parent.set(id, id));
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++)
          if (distanceM(coordOf(ids[i]), coordOf(ids[j])) <= GROUP_RADIUS_M) union(ids[i], ids[j]);
    }
    const comps = new Map();
    for (const id of parent.keys()) {
      const r = find(id);
      if (!comps.has(r)) comps.set(r, []);
      comps.get(r).push(id);
    }
    // tambahan manual
    const extra = ov.extra || {};
    const groups = [];
    for (const ids of comps.values()) {
      for (const [key, adds] of Object.entries(extra)) if (ids.includes(key)) adds.forEach(a => !ids.includes(a) && stops[a] && ids.push(a));
      if (ids.length < 2) continue;
      const isTerminal = id => /\b(terminal|term\.)/i.test(stops[id].name);
      const hasBrt = ids.some(id => stops[id].type === "brt");
      const hasTerminal = ids.some(isTerminal);
      if (!hasBrt && !hasTerminal) continue; // pasangan bus stop biasa cukup tampil di "Halte terdekat"
      const pool = ids.filter(id => stops[id].type === "brt");
      const label = (pool.length ? pool : ids)
        .map(id => stops[id].name.replace(/^(terminal|term\.)\s*/i, "").replace(/\bPs\.\s*/g, "Pasar ").replace(/\s+(\d+|i{1,3}|iv)$/i, "").trim())
        .sort((a, b) => a.length - b.length)[0];
      const defName = hasTerminal ? `Terminal ${titleCase(label)}` : `Kawasan ${label}`;
      const slug = slugify(hasTerminal ? defName : label);
      const name = (ov.names || {})[slug] || defName;
      ids.sort((a, b) => (stops[b].type === "brt") - (stops[a].type === "brt") || stops[a].name.localeCompare(stops[b].name, "id", { numeric: true }));
      groups.push({ slug, name, stopIds: ids, hasTerminal });
    }
    // slug unik
    const seen = new Map();
    for (const g of groups) {
      const n = (seen.get(g.slug) || 0) + 1;
      seen.set(g.slug, n);
      if (n > 1) g.slug = `${g.slug}-${n}`;
    }
    groups.sort((a, b) => a.name.localeCompare(b.name, "id"));
    const byStop = new Map();
    groups.forEach(g => g.stopIds.forEach(id => byStop.set(id, g)));
    return { groups, byStop };
  });
}

// Arah mata angin dari a ke b (8 arah, bahasa Indonesia)
export function compassDir(a, b) {
  const toRad = x => (x * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  const deg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return ["utara", "timur laut", "timur", "tenggara", "selatan", "barat daya", "barat", "barat laut"][Math.round(deg / 45) % 8];
}

// URL gambar peta statis Mapbox.
// main/others: [{ lng, lat, label? }] — label (1–99 atau huruf) tampil di dalam pin,
// dipakai agar nomor di peta cocok dengan nomor di daftar halte.
export function staticStopMap({ main = [], others = [], token, width = 760, height = 320 }) {
  if (!token) return null;
  const pin = (size, color, c) => `pin-${size}${c.label != null ? `-${String(c.label).toLowerCase()}` : ""}+${color}(${c.lng.toFixed(5)},${c.lat.toFixed(5)})`;
  const pins = [
    ...others.slice(0, 18).map(c => pin("s", "64748b", c)),
    ...main.slice(0, 12).map(c => pin("l", "2563eb", c)),
  ];
  if (!pins.length) return null;
  const view = pins.length === 1 ? `${main[0].lng.toFixed(5)},${main[0].lat.toFixed(5)},16` : "auto";
  const pad = view === "auto" ? "&padding=50" : "";
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pins.join(",")}/${view}/${width}x${height}@2x?access_token=${token}${pad}`;
}
