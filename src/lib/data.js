import fs from "node:fs";
import path from "node:path";

// DATA_DIR controls where JSON data is read from.
//  - Local dev (default): data-sample/ — small fake dataset committed to this repo.
//  - CI/production: set DATA_DIR=data-real (see .github/workflows/deploy.yml),
//    after the private data repo has been checked out into that folder.
const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR || "data");

function readJSON(relPath, fallback = undefined) {
  let full = path.join(DATA_DIR, relPath);

  // Jika file dengan nama eksak tidak ditemukan, cari versi lain yang cocok tanpa membedakan huruf besar/kecil
  if (!fs.existsSync(full)) {
    const dir = path.dirname(full);
    const base = path.basename(full);

    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      const matchedFile = files.find(f => f.toLowerCase() === base.toLowerCase());
      if (matchedFile) {
        full = path.join(dir, matchedFile);
      }
    }
  }

  try {
    return JSON.parse(fs.readFileSync(full, "utf-8"));
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Gagal baca ${relPath} dari ${DATA_DIR}: ${err.message}`);
  }
}

// Cache per proses build: ribuan halaman memanggil loader yang sama,
// jadi file JSON cukup dibaca sekali.
const _cache = new Map();
function memo(key, fn) {
  if (!_cache.has(key)) _cache.set(key, fn());
  return _cache.get(key);
}

export function loadStops() {
  return memo("stops", () => readJSON("stops.json"));
}

export function loadRoutesIndex() {
  return memo("routes-index", () => readJSON("routes-index.json"));
}

export function loadRoute(id) {
  return memo(`route:${id}`, () => readJSON(`routes/${id}.json`));
}

export function loadStopServices() {
  return memo("stop-services", () => readJSON("stop-services.json", {}));
}

// Koordinat halte: { "<stopId>": { lng, lat, source, confidence } }. Opsional.
export function loadStopCoords() {
  return memo("stop-coords", () => readJSON("stop-coords.json", {}));
}

// Tempat penting (POI): { "<slug>": { name, aliases[], category, lat, lng } }. Opsional.
// Halte terdekat dihitung otomatis dari koordinat, tidak perlu ditautkan manual.
export function loadPlaces() {
  return memo("places", () => readJSON("places.json", {}));
}

// Stasiun kereta: { "<slug>": { name, short, modes[], lines[], status, lat, lng, osm } }. Opsional.
// Helper & katalog lin ada di src/lib/rail.js
export function loadStations() {
  return memo("stations", () => readJSON("stations.json", {}));
}

// Urutan stasiun per lin & pola layanan (scripts/build-rail-lines.py) dan aturan tarif kereta. Opsional.
export function loadRailLines() {
  return memo("rail-lines", () => readJSON("rail-lines.json", { lines: {} }).lines || {});
}
// Jadwal KRL (scripts/build-krl-schedule.py) & hari libur (SKB 3 Menteri). Opsional.
export function loadKrlSchedule() {
  return memo("krl-schedule", () => readJSON("krl-schedule.json", { trips: [] }));
}
export function loadRailSchedules() {
  return memo("rail-schedules", () => readJSON("rail-schedules.json", { stations: {}, sources: {} }));
}
export function loadHolidays() {
  return memo("holidays", () => readJSON("holidays.json", { libur_nasional: [], cuti_bersama: [] }));
}
// Titik pindah antarstasiun kereta yang ditulis manual (beda moda/lin). Opsional.
export function loadRailInterchanges() {
  return memo("rail-interchanges", () => readJSON("rail-interchanges.json", { hubs: [] }).hubs || []);
}
export function loadRailFares() {
  return memo("rail-fares", () => readJSON("rail-fares.json", {}));
}

export const PLACE_CATEGORIES = {
  "mal": "Pusat perbelanjaan",
  "rumah-sakit": "Rumah sakit",
  "kampus": "Kampus",
  "sekolah": "Sekolah",
  "stasiun": "Stasiun",
  "terminal": "Terminal",
  "wisata": "Wisata & olahraga",
  "kantor": "Perkantoran & instansi",
  "ibadah": "Tempat ibadah",
  "hotel": "Hotel",
  "pasar": "Pasar",
  "apartemen": "Apartemen & rusun",
};
export const placeCategoryLabel = c => PLACE_CATEGORIES[c] || "Tempat";
// Jenis rinci (field "subtype", dari scripts/apply-places-candidates.py), mis. "SD negeri" → "SD Negeri"
const KIND = { "internasional": "Sekolah internasional", "apartemen": "Apartemen", "rumah susun": "Rumah susun", "gedung perkantoran": "Gedung perkantoran", "instansi pemerintah": "Instansi pemerintah", "perguruan tinggi": "Perguruan tinggi" };
export const placeKindLabel = p => !p.subtype ? placeCategoryLabel(p.category)
  : KIND[p.subtype] || p.subtype.replace(/\b(negeri|swasta)\b/, w => w[0].toUpperCase() + w.slice(1)); // "SD negeri" → "SD Negeri"
// Tampil di halaman Tujuan Populer (/tempat)? Field "populer": true/false menimpa aturan bawaan:
// tempat kurasi manual tampil, tempat hasil impor OpenStreetMap ("source": "osm") tidak (tetap bisa dicari).
export const isPopularPlace = p => p.populer ?? p.source !== "osm";

// Koreksi manual kelompok kawasan (opsional), lihat src/lib/stop-insights.js
export function loadStopGroupOverrides() {
  return memo("stop-groups", () => readJSON("stop-groups.json", {}));
}

// Geometri jalur ada di folder routes-geo/ dengan nama file sama seperti routes/
// (mis. 1.json, 1a.json). readJSON sudah mencocokkan nama tanpa beda huruf besar/kecil.
export function loadJalur(id) {
  return readJSON(`routes-geo/${id}.json`, null);
}

// Ambil LineString satu arah dari file routes-geo.
// Format utama: { directions: { "dir-1": { geometry: { type:"LineString", coordinates } } } }
// (juga menerima GeoJSON LineString/Feature/FeatureCollection).
export function getDirectionGeometry(jalur, dirId, dirIndex = 0) {
  if (!jalur) return null;
  const byDir = jalur.directions?.[dirId]?.geometry;
  if (byDir?.coordinates?.length) return byDir;
  const pick = g => (g?.type === "LineString" && g.coordinates?.length ? g : null);
  if (jalur.type === "LineString") return dirIndex === 0 ? pick(jalur) : null;
  if (jalur.type === "Feature") return dirIndex === 0 ? pick(jalur.geometry) : null;
  if (jalur.type === "FeatureCollection") {
    const f = jalur.features?.find(f => f.properties?.direction === dirId) ?? jalur.features?.[dirIndex];
    return pick(f?.geometry);
  }
  return null;
}

// ---------- slug & sort helpers (ported from Transit Data Manager so
// ordering/slugging stays consistent between the admin tool and the site) ----------

export function slugify(str) {
  return (str || "")
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function routeSlug(entry) {
  const name = entry.route_name || entry.route_number || "";
  const nameSlug = slugify(name);
  const idSlug = slugify(entry.id);
  return nameSlug ? `${idSlug}-${nameSlug}` : idSlug;
}

function codeGroupAndKey(code) {
  const str = (code || "").trim();
  let m;
  if (/^\d+$/.test(str)) return { group: 0, num: parseInt(str, 10) || 0 };
  if ((m = /^(\d+)([A-Za-z]+)$/.exec(str))) return { group: 1, num: parseInt(m[1], 10) || 0, letters: m[2].toUpperCase() };
  if ((m = /^JAK\.?(\d+)([A-Za-z]*)$/i.exec(str))) return { group: 4, num: parseInt(m[1], 10) || 0, letters: m[2].toUpperCase() };
  if ((m = /^([A-Za-z])(\d+)$/.exec(str))) return { group: 2, letters: m[1].toUpperCase(), num: parseInt(m[2], 10) || 0 };
  if ((m = /^([A-Za-z]{2,})(\d+)$/.exec(str))) return { group: 3, letters: m[1].toUpperCase(), num: parseInt(m[2], 10) || 0 };
  if (/^[A-Za-z]+$/.test(str)) return { group: 6, letters: str.toUpperCase() };
  return { group: 5, letters: str.toUpperCase() };
}

export function compareCodes(codeA, codeB) {
  const a = codeGroupAndKey(codeA);
  const b = codeGroupAndKey(codeB);
  if (a.group !== b.group) return a.group - b.group;
  switch (a.group) {
    case 0:
      return a.num - b.num;
    case 1:
    case 4:
      return a.num - b.num || a.letters.localeCompare(b.letters);
    case 2:
    case 3:
      return a.letters.localeCompare(b.letters) || a.num - b.num;
    default:
      return a.letters < b.letters ? -1 : a.letters > b.letters ? 1 : 0;
  }
}

// ---------- cross-reference helpers ----------

// Map of route id -> { slug, entry } for quick lookups when linking stop
// badges / "routes serving this stop" lists back to their route pages.
export function buildRouteLookup(routesIndex) {
  const map = new Map();
  routesIndex.forEach(entry => {
    map.set(entry.id, { slug: routeSlug(entry), entry });
  });
  return map;
}

// Routes serving a given stop, sorted and resolved to {id, slug, route_name, route_color}.
export function routesForStop(stopId, stopServices, routeLookup) {
  const ids = (stopServices[stopId] || []).slice().sort(compareCodes);
  return ids
    .map(id => routeLookup.get(id))
    .filter(Boolean)
    .map(({ slug, entry }) => ({
      id: entry.id,
      slug,
      route_name: entry.route_name,
      route_color: entry.route_color,
      route_number: entry.route_number,
      category: entry.category,
    }));
}

// Teks lencana rute: Mikrotrans tampil "JAK.79" (route_number), ID tetap "JAK79" untuk URL & data.
export function routeLabel(r) {
  const n = String(r?.route_number || "");
  return /^JAK\./i.test(n) ? n : String(r?.id ?? "");
}

// ---- Warna lencana: pilih teks hitam/putih sesuai kecerahan warna rute (WCAG-ish).
export function readableText(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.4 ? "#1a1a1a" : "#ffffff";
}
// CSS custom properties untuk lencana/hero: --c (warna rute) & --on (warna teks di atasnya)
export function badgeVars(hex, fallback = "#334155") {
  const c = /^#[0-9a-f]{6}$/i.test(String(hex || "")) ? hex : fallback;
  return `--c:${c};--on:${readableText(c)};`;
}

// ---- Jenis layanan rute (field "category" di routes-index.json), urutan = urutan tampil.
export const ROUTE_CATEGORIES = [
  { key: "brt", label: "Koridor BRT" },
  { key: "pengumpan", label: "Angkutan Pengumpan" },
  { key: "royaltrans", label: "Royaltrans" },
  { key: "transjabodetabek", label: "Transjabodetabek" },
  { key: "rusun", label: "Rumah Susun" },
  { key: "mikrotrans", label: "Mikrotrans (JakLingko)" },
];
const CATEGORY_KEYS = new Set(ROUTE_CATEGORIES.map(c => c.key));
// Rute tanpa category (atau nilai tak dikenal) masuk "lainnya" dan tampil netral.
export function categoryOf(entry) {
  const c = String(entry?.category || "").toLowerCase();
  return CATEGORY_KEYS.has(c) ? c : "lainnya";
}
export function categoryLabel(key) {
  return ROUTE_CATEGORIES.find(c => c.key === key)?.label || "Rute Transjakarta";
}
// Kelompokkan list rute per jenis, urut sesuai ROUTE_CATEGORIES; kelompok kosong dibuang.
export function groupByCategory(list) {
  const groups = [...ROUTE_CATEGORIES, { key: "lainnya", label: "Rute Lainnya" }].map(c => ({ ...c, items: [] }));
  list.forEach(r => groups.find(g => g.key === categoryOf(r)).items.push(r));
  return groups.filter(g => g.items.length > 0);
}
