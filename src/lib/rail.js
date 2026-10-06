// Stasiun kereta (KRL, MRT, LRT, Whoosh, KAI) dari data/stations.json.
// Format: { "<slug>": { name, short, modes[], lines[], status: "operasional"|"segera", lat, lng, osm } }
// Sumber koordinat: OpenStreetMap (ODbL). Jarak ke halte dihitung otomatis saat build.
import { loadStations, loadStops } from "./data.js";
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
  "lrt-jakarta": { label: "LRT Jakarta", short: "LRT Jakarta", color: "#f16227", ends: "Pegangsaan Dua – Manggarai" },
  "whoosh": { label: "Whoosh", short: "Whoosh", color: "#8c0023", ends: "Halim – Tegalluar" },
};
export const lineInfo = key => RAIL_LINES[key] || { label: key, short: key, color: "#6b7381", ends: "" };

export const primaryMode = st => MODE_ORDER.find(m => (st.modes || []).includes(m)) || (st.modes || [])[0] || "krl";
export const modeInfo = key => RAIL_MODES[key] || RAIL_MODES.krl;
export const isOpen = st => st.status !== "segera";
// "Stasiun MRT Blok M" → nama tampil di halaman; short dipakai di lencana
export const stationLabel = st => st.name;

export function stationList({ openOnly = true } = {}) {
  return Object.entries(loadStations())
    .filter(([, s]) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && (!openOnly || isOpen(s)))
    .map(([slug, s]) => ({ slug, ...s }));
}

// Stasiun di sekitar titik (operasional saja), terdekat dulu
export function stationsNearPoint(pt, { radius = 400, limit = 6, exclude = [] } = {}) {
  if (!pt) return [];
  const skip = new Set(exclude);
  return stationList()
    .filter(s => !skip.has(s.slug) && Math.abs(s.lat - pt.lat) < 0.02 && Math.abs(s.lng - pt.lng) < 0.02)
    .map(s => ({ ...s, distance: distanceM(pt, s) }))
    .filter(s => s.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

// Tipe transfer di stops.json (krl/mrt/lrt/kai) → moda stasiun yang cocok
const CURATED_MATCH = {
  krl: s => s.modes.includes("krl"),
  mrt: s => s.modes.includes("mrt"),
  lrt: s => s.modes.includes("lrt-jabodebek") || s.modes.includes("lrt-jakarta"),
  kai: s => s.modes.includes("kai") || (s.lines || []).includes("krl-bandara"),
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
export function stopsNearStation(st) {
  let near = stopsNearPoint(st, { radius: 500, limit: 8 });
  const farOnly = near.length === 0;
  if (farOnly) near = stopsNearPoint(st, { radius: 1500, limit: 3 });
  return { near, farOnly };
}
