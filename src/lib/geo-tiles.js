// Petak (tile) koordinat untuk fitur "Halte terdekat": halte dibagi ke petak 0,05° (±5,5 km)
// sehingga browser cukup mengunduh petak di sekitar posisi pengguna, bukan seluruh 7.000+ halte.
import { loadStops, loadStopServices, loadRoutesIndex, compareCodes } from "./data.js";
import { coordOf } from "./stop-insights.js";

export const TILE_DEG = 0.05;
export const tileKey = (lat, lng) => `${Math.floor(lat / TILE_DEG)}_${Math.floor(lng / TILE_DEG)}`;

let _tiles = null;
// Map tileKey -> [[stopId, nama, lat, lng, isBrt, [routeId...]], ...]
export function geoTiles() {
  if (_tiles) return _tiles;
  const stops = loadStops();
  const svc = loadStopServices();
  const known = new Set(loadRoutesIndex().map(e => String(e.id)));
  _tiles = new Map();
  for (const [id, st] of Object.entries(stops)) {
    const c = coordOf(id);
    if (!c) continue;
    const k = tileKey(c.lat, c.lng);
    if (!_tiles.has(k)) _tiles.set(k, []);
    const routes = (svc[id] || []).filter(x => known.has(String(x))).sort(compareCodes);
    _tiles.get(k).push([id, st.name, +c.lat.toFixed(6), +c.lng.toFixed(6), st.type === "brt" ? 1 : 0, routes]);
  }
  return _tiles;
}
