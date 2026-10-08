// Koordinat titik untuk form /perjalanan, dimuat hanya di halaman itu (indeks pencarian tetap ringan).
// Urutan SAMA dengan daftar h, p, s di /data/search.json: elemen ke-i = entri ke-i. [lat, lng] 5 desimal (±1 m),
// null bila halte belum punya koordinat.
import { loadStops, loadStopCoords, loadPlaces } from "../../../lib/data.js";
import { stationList } from "../../../lib/rail.js";

const pt = c => (c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? [+c.lat.toFixed(5), +c.lng.toFixed(5)] : null);

export function GET() {
  const coords = loadStopCoords();
  const out = {
    h: Object.keys(loadStops()).map(id => pt(coords[id])),
    p: Object.values(loadPlaces()).map(pt),
    s: stationList().map(pt),
  };
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
}
