import fs from "node:fs";
import path from "node:path";

// DATA_DIR controls where JSON data is read from.
//  - Local dev (default): data-sample/ — small fake dataset committed to this repo.
//  - CI/production: set DATA_DIR=data-real (see .github/workflows/deploy.yml),
//    after the private data repo has been checked out into that folder.
const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR || "data");

function readJSON(relPath, fallback = undefined) {
  const full = path.join(DATA_DIR, relPath);
  try {
    return JSON.parse(fs.readFileSync(full, "utf-8"));
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Gagal baca ${relPath} dari ${DATA_DIR}: ${err.message}`);
  }
}

export function loadStops() {
  return readJSON("stops.json");
}

export function loadRoutesIndex() {
  return readJSON("routes-index.json");
}

export function loadRoute(id) {
  return readJSON(`routes/${id}.json`);
}

export function loadStopServices() {
  return readJSON("stop-services.json", {});
}

export function loadJalur(id) {
  return readJSON(`routes/${id}-jalur.json`, null);
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
  if ((m = /^JAK(\d+)$/i.exec(str))) return { group: 4, num: parseInt(m[1], 10) || 0 };
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
    case 4:
      return a.num - b.num;
    case 1:
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
    }));
}
