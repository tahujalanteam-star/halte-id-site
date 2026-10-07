// Stasiun kereta (KRL, MRT, LRT, Whoosh, KAI) dari data/stations.json.
// Format: { "<slug>": { name, short, modes[], lines[], status: "operasional"|"segera", lat, lng, osm } }
// Sumber koordinat: OpenStreetMap (ODbL). Jarak ke halte dihitung otomatis saat build.
import { loadStations, loadStops, loadRailLines, loadRailFares } from "./data.js";
import { krlDistances, fareBetween, fareNetworksOf } from "./rail-fare-core.js";
import { distanceM, coordOf, stopsNearPoint } from "./stop-insights.js";

// Warna lencana moda konsisten dengan lencana transfer di halaman rute.
export const RAIL_MODES = {
  "krl": { label: "KRL Commuter Line", short: "KRL", color: "#db6300" },
  "mrt": { label: "MRT Jakarta", short: "MRT", color: "#db0000" },
  "lrt-jabodebek": { label: "LRT Jabodebek", short: "LRT", color: "#c2185b" },
  "lrt-jakarta": { label: "LRT Jakarta", short: "LRT", color: "#c2185b" },
  "whoosh": { label: "Kereta Cepat Whoosh", short: "Whoosh", color: "#8c0023" },
  "kai": { label: "Kereta Antarkota KAI", short: "KAI", color: "#1e3a8a" },
};
export const MODE_ORDER = ["mrt", "lrt-jakarta", "lrt-jabodebek", "krl", "whoosh", "kai"];

export const RAIL_LINES = {
  "krl-bogor": { label: "Lin Bogor", short: "Bogor", color: "#e30a16", ends: "Jakarta Kota – Bogor/Nambo" },
  "krl-cikarang": { label: "Lin Cikarang", short: "Cikarang", color: "#0084d8", ends: "Cikarang – Kampung Bandan (lingkar)" },
  "krl-rangkasbitung": { label: "Lin Rangkasbitung", short: "Rangkasbitung", color: "#16812b", ends: "Tanah Abang – Rangkasbitung" },
  "krl-tangerang": { label: "Lin Tangerang", short: "Tangerang", color: "#6b4226", ends: "Duri – Tangerang" },
  "krl-tanjung-priok": { label: "Lin Tanjung Priok", short: "Tanjung Priok", color: "#dd0067", ends: "Jakarta Kota – Tanjung Priok" },
  "krl-bandara": { label: "KA Bandara", short: "Bandara", color: "#2e2f70", ends: "Manggarai – Bandara Soekarno-Hatta" },
  "krl-walahar": { label: "Commuter Line Walahar", short: "Walahar", color: "#6d6e70", ends: "Cikarang – Purwakarta" },
  "mrt-utara-selatan": { label: "MRT Lin Utara–Selatan", short: "Utara–Selatan", color: "#ce0037", ends: "Lebak Bulus – Bundaran HI" },
  "lrt-cibubur": { label: "LRT Lin Cibubur", short: "Cibubur", color: "#20409a", ends: "Dukuh Atas – Harjamukti" },
  "lrt-bekasi": { label: "LRT Lin Bekasi", short: "Bekasi", color: "#0e6938", ends: "Dukuh Atas – Jatimulya" },
  "lrt-jakarta": { label: "LRT Jakarta", short: "LRT Jakarta", color: "#f16227", ends: "Kelapa Gading – Manggarai" },
  "whoosh": { label: "Whoosh", short: "Whoosh", color: "#8c0023", ends: "Halim – Tegalluar" },
};
// Label ringkas untuk lencana transfer di halaman rute bus
export const LINE_BADGE = {
  "krl-bogor": "KRL Bogor", "krl-cikarang": "KRL Cikarang", "krl-rangkasbitung": "KRL Rangkasbitung", "krl-tangerang": "KRL Tangerang",
  "krl-tanjung-priok": "KRL Tj. Priok", "krl-bandara": "KA Bandara", "krl-walahar": "KRL Walahar", "mrt-utara-selatan": "MRT",
  "lrt-cibubur": "LRT Cibubur", "lrt-bekasi": "LRT Bekasi", "lrt-jakarta": "LRT Jakarta", "whoosh": "Whoosh",
};
export const lineInfo = key => RAIL_LINES[key] || { label: key, short: key, color: "#6b7381", ends: "" };

export const primaryMode = st => MODE_ORDER.find(m => (st.modes || []).includes(m)) || (st.modes || [])[0] || "krl";
export const modeInfo = key => RAIL_MODES[key] || RAIL_MODES.krl;
// status: "operasional" | "segera" (belum dibuka) | "tutup" (sudah tidak melayani, lihat replaced_by)
export const isOpen = st => !st.status || st.status === "operasional";
// "Stasiun MRT Blok M" → nama tampil di halaman; short dipakai di lencana
export const stationLabel = st => st.name;

export function stationList({ openOnly = true } = {}) {
  return Object.entries(loadStations())
    .filter(([, s]) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && (!openOnly || isOpen(s)))
    .map(([slug, s]) => ({ slug, ...s }));
}

// Jarak ke stasiun memakai pintu masuk terdekat bila stasiun punya beberapa akses
// (stations.json "entrances": [{ name, lat, lng }], mis. BNI City dari Jl. Sudirman & Jl. KH Mas Mansyur)
export function withAccess(pt, s) {
  let best = { distance: distanceM(pt, s), entrance: null, at: { lat: s.lat, lng: s.lng } };
  for (const e of s.entrances || []) {
    const d = distanceM(pt, e);
    if (d < best.distance) best = { distance: d, entrance: e.name, at: { lat: e.lat, lng: e.lng } };
  }
  return { ...s, ...best };
}

// Stasiun di sekitar titik (operasional saja), terdekat dulu
export function stationsNearPoint(pt, { radius = 400, limit = 6, exclude = [] } = {}) {
  if (!pt) return [];
  const skip = new Set(exclude);
  return stationList()
    .filter(s => !skip.has(s.slug) && Math.abs(s.lat - pt.lat) < 0.02 && Math.abs(s.lng - pt.lng) < 0.02)
    .map(s => withAccess(pt, s))
    .filter(s => s.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

// Tipe transfer di stops.json (krl/mrt/lrt/kai) → moda stasiun yang cocok
export const CURATED_MATCH = {
  krl: s => s.modes.includes("krl"),
  mrt: s => s.modes.includes("mrt"),
  lrt: s => s.modes.includes("lrt-jabodebek") || s.modes.includes("lrt-jakarta"),
  // "kai" di stops.json = kereta antarkota (Gambir, Pasar Senen, ...) dan Whoosh (line "Whoosh")
  kai: s => s.modes.includes("kai") || s.modes.includes("whoosh"),
};

export const TRANSIT_RADIUS_M = 350;

// Stasiun yang bisa dicapai dari sebuah halte.
// - Dalam 350 m: selalu tampil.
// - Halte dengan transfer kereta tercatat manual (stops.json "transfers"): stasiun moda itu
//   sampai 700 m ikut tampil dan diberi label "Terintegrasi".
export function stationsForStop(stopId) {
  const me = coordOf(stopId);
  if (!me) return [];
  const curated = [...new Set((loadStops()[stopId]?.transfers || []).map(t => t.type))].filter(t => CURATED_MATCH[t]);
  const all = stationsNearPoint(me, { radius: 700, limit: 12 });
  const out = [];
  for (const s of all) {
    const integrated = curated.some(t => CURATED_MATCH[t](s));
    if (s.distance <= TRANSIT_RADIUS_M || integrated) out.push({ ...s, integrated });
  }
  // Untuk transfer tercatat, cukup stasiun terdekat per moda bila jaraknya > radius biasa
  const seenMode = new Set();
  return out.filter(s => {
    if (s.distance <= TRANSIT_RADIUS_M) { seenMode.add(primaryMode(s)); return true; }
    const m = primaryMode(s);
    if (seenMode.has(m)) return false;
    seenMode.add(m);
    return true;
  }).slice(0, 5);
}

// Halte terdekat dari stasiun: 500 m, atau 3 terdekat dalam 1,5 km bila tidak ada
// Stasiun dengan beberapa pintu: halte dihitung dari pintu terdekat masing-masing
export function stopsNearStation(st) {
  const points = [st, ...(st.entrances || [])];
  const merge = radius => {
    const best = new Map();
    for (const p of points) for (const n of stopsNearPoint(p, { radius, limit: 8 }))
      if (!best.has(n.id) || n.distance < best.get(n.id).distance) best.set(n.id, { ...n, entrance: p === st ? null : p.name, from: { lat: p.lat, lng: p.lng } });
    return [...best.values()].sort((a, b) => a.distance - b.distance).slice(0, 8);
  };
  let near = merge(500);
  const farOnly = near.length === 0;
  if (farOnly) near = merge(1500).slice(0, 3);
  return { near, farOnly };
}

// ---------------------------------------------------------------------------
// Lin kereta (data/rail-lines.json) & tarif (data/rail-fares.json)
// ---------------------------------------------------------------------------
const _m = new Map();
const memo = (k, fn) => (_m.has(k) ? _m.get(k) : (_m.set(k, fn()), _m.get(k)));

export const stationShort = slug => loadStations()[slug]?.short || slug;
const isLoop = p => p.stations[0] === p.stations[p.stations.length - 1];

// Jaringan tarif berbasis jarak KRL tidak mencakup KA Bandara (tarif sendiri) dan Walahar
const KRL_FARE_LINES = ["krl-bogor", "krl-cikarang", "krl-rangkasbitung", "krl-tangerang", "krl-tanjung-priok"];
export const FARE_NETWORKS = {
  krl: { label: "KRL Commuter Line", short: "KRL", color: RAIL_MODES.krl.color },
  mrt: { label: "MRT Jakarta", short: "MRT", color: RAIL_MODES.mrt.color },
  jab: { label: "LRT Jabodebek", short: "LRT Jabodebek", color: RAIL_MODES["lrt-jabodebek"].color },
  lrtj: { label: "LRT Jakarta", short: "LRT Jakarta", color: RAIL_MODES["lrt-jakarta"].color },
};

export function railLines() {
  return memo("lines", () => {
    const raw = loadRailLines();
    return Object.keys(RAIL_LINES).filter(k => raw[k]?.patterns?.length).map(key => {
      const pats = raw[key].patterns;
      const main = pats.filter(p => p.main);
      const all = new Set(pats.flatMap(p => p.stations));
      const longest = (main.length ? main : pats).reduce((a, b) => (b.km.at(-1) > a.km.at(-1) ? b : a));
      return { key, mode: raw[key].mode, ...lineInfo(key), patterns: pats, main: main.length ? main : pats.slice(0, 1),
        stationCount: all.size, lengthKm: longest.km.at(-1) };
    });
  });
}
export const railLine = key => railLines().find(l => l.key === key);

export function buildFareNet() {
  return memo("net", () => {
    const F = loadRailFares(), raw = loadRailLines(), st = loadStations();
    const net = {};
    if (F.krl?.type === "distance_step") {
      const adj = {};
      const add = (a, b, w) => {
        if (!(w > 0)) return;
        const row = (adj[a] ||= []);
        const e = row.find(x => x[0] === b);
        if (e) e[1] = Math.min(e[1], w); else row.push([b, +w.toFixed(3)]);
      };
      for (const k of KRL_FARE_LINES) for (const p of raw[k]?.patterns || [])
        for (let i = 1; i < p.stations.length; i++) {
          const w = p.km[i] - p.km[i - 1];
          add(p.stations[i - 1], p.stations[i], w); add(p.stations[i], p.stations[i - 1], w);
        }
      const { base_fare, base_km, step_fare, step_km } = F.krl;
      net.krl = { rule: { base_fare, base_km, step_fare, step_km }, adj };
    }
    const idx = list => Object.fromEntries(list.map((s, i) => [s, i]));
    if (F.mrt?.type === "matrix") net.mrt = { idx: idx(F.mrt.stations), fares: F.mrt.fares };
    if (F["lrt-jabodebek"]?.type === "matrix") {
      const cap = (F["lrt-jabodebek"].periods || []).map(p => p.cap).filter(Boolean)[0] || null;
      net.jab = { idx: idx(F["lrt-jabodebek"].stations), fares: F["lrt-jabodebek"].fares, cap };
    }
    if (F["lrt-jakarta"]?.type === "flat")
      net.lrtj = { fare: F["lrt-jakarta"].fare, stations: Object.keys(st).filter(s => st[s].modes?.includes("lrt-jakarta") && isOpen(st[s])) };
    return net;
  });
}

const _dist = new Map();
export function krlDistFrom(slug) {
  const net = buildFareNet();
  if (!net.krl) return {};
  if (!_dist.has(slug)) _dist.set(slug, krlDistances(net.krl.adj, slug));
  return _dist.get(slug);
}
export function railFare(a, b) {
  const net = buildFareNet();
  return fareBetween(net, a, b, net.krl?.adj?.[a] ? krlDistFrom(a) : undefined);
}
export const stationFareNetworks = slug => fareNetworksOf(buildFareNet(), slug);

// Semua tujuan dari satu stasiun per jaringan tarif, urut jarak/urutan lin
export function fareTableFrom(slug) {
  const net = buildFareNet(), st = loadStations();
  return stationFareNetworks(slug).map(n => {
    let dests;
    if (n === "krl") dests = Object.keys(net.krl.adj);
    else if (n === "mrt") dests = Object.keys(net.mrt.idx);
    else if (n === "jab") dests = Object.keys(net.jab.idx);
    else dests = net.lrtj.stations;
    const rows = dests.filter(d => d !== slug && st[d] && isOpen(st[d])).map(d => ({ slug: d, name: st[d].short, ...railFare(slug, d) }))
      .filter(r => r.fare);
    if (n === "krl") rows.sort((a, b) => a.km - b.km);
    else if (n !== "lrtj") rows.sort((a, b) => a.fare - b.fare || a.name.localeCompare(b.name));
    return { network: n, ...FARE_NETWORKS[n], rows };
  });
}

// Stasiun sebelum/sesudah di tiap lin. Pola dengan pasangan (sebelum, sesudah) sama digabung,
// mis. Lin Bogor arah Bogor & arah Nambo di Manggarai → "Menuju Bogor / Nambo".
// Pola lingkar penuh (Lin Cikarang) tidak dipakai bila ada pola lurus yang mencakup stasiun.
export function neighborsOnLines(slug) {
  const out = [];
  for (const line of railLines()) {
    const linear = line.patterns.filter(p => !isLoop(p));
    const pool = linear.some(p => p.stations.includes(slug)) ? linear : line.patterns;
    // Satu baris per arah laju: dikelompokkan menurut stasiun berikutnya. Dua kelompok digabung bila stasiun
    // berikutnya yang satu ada di 3 stasiun ke depan kelompok lain (pola OSM yang melewatkan satu stasiun).
    let groups = [];
    let lastOnly = null;
    for (const p of pool) p.stations.forEach((s, pos) => {
      if (s !== slug) return;
      if (pos === p.stations.length - 1) { lastOnly ||= { p, pos }; return; }
      const next = p.stations[pos + 1];
      let g = groups.find(x => x.next === next);
      if (!g) groups.push(g = { next, items: [] });
      g.items.push({ p, pos });
    });
    const ahead = (g, n) => g.items.some(({ p, pos }) => p.stations.slice(pos + 1, pos + 4).includes(n));
    for (let i = 0; i < groups.length; i++) for (let j = groups.length - 1; j > i; j--) {
      if (ahead(groups[i], groups[j].next) || ahead(groups[j], groups[i].next)) {
        groups[i].items.push(...groups[j].items); groups.splice(j, 1);
      }
    }
    const rows = [];
    for (const g of groups) {
      // pola terpanjang ke arah itu (yang punya stasiun sebelumnya) jadi acuan hitungan & ujung
      const score = x => (x.pos > 0 ? 1000 : 0) + x.p.stations.length - x.pos;
      const ref = g.items.reduce((a, b) => (score(b) > score(a) ? b : a));
      const ends = [...new Set(g.items.map(x => x.p.stations.at(-1)))].map(stationShort);
      rows.push({ prev: ref.pos > 0 ? ref.p.stations[ref.pos - 1] : null, next: ref.p.stations[ref.pos + 1], ref, ends,
        total: ref.p.stations.length, pos: ref.pos, stations: ref.p.stations, km: ref.p.km });
    }
    if (!rows.length && lastOnly) rows.push({ prev: lastOnly.p.stations[lastOnly.pos - 1], next: null, isLast: true, ends: [stationShort(slug)], total: lastOnly.p.stations.length, pos: lastOnly.pos, stations: lastOnly.p.stations, km: lastOnly.p.km });
    if (!rows.length) continue;
    rows.sort((a, b) => b.total - a.total);
    out.push({ line, rows });
  }
  return out;
}

// Lencana transfer kereta untuk satu halte (dipakai di halaman rute bus):
// transfer tercatat (stops.json: krl/mrt/lrt/kai) → stasiun terdekat moda itu → satu lencana per lin, menuju halaman lin.
// Kereta antarkota (tanpa lin komuter) → penanda "KAI" tanpa tautan.
export function railBadgesForStop(stopId) {
  const types = [...new Set((loadStops()[stopId]?.transfers || []).map(t => t.type))].filter(t => CURATED_MATCH[t]);
  if (!types.length) return { badges: [], handled: new Set() };
  const near = stationsForStop(stopId);
  const out = [], seen = new Set(), handled = new Set();
  for (const t of types) {
    const st = near.find(s => CURATED_MATCH[t](s));
    if (!st) continue;
    handled.add(t);
    const lines = (st.lines || []).filter(l => RAIL_LINES[l] && (t !== "kai" || l === "whoosh"));
    if (!lines.length) {
      // Kereta antarkota (Gambir, Pasar Senen) tidak punya halaman lin: cukup penanda "KAI" tanpa tautan
      if (t === "kai" && !seen.has("kai")) { seen.add("kai"); out.push({ text: "KAI", href: null, color: RAIL_MODES.kai.color, title: `Kereta antarkota · ${st.name}` }); }
      continue;
    }
    for (const l of lines) {
      if (seen.has(l)) continue;
      seen.add(l);
      out.push({ text: LINE_BADGE[l] || lineInfo(l).short, href: `/kereta/${l}`, color: lineInfo(l).color, title: `${lineInfo(l).label} · ${st.name}` });
    }
  }
  return { badges: out, handled };
}
