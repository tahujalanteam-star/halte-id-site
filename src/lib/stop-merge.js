// Halte berseberangan ("Sbr. X", id sbr-x) yang berpasangan dengan halte X dan letaknya berdekatan
// digabung ke satu halaman: /halte/x/ menampilkan kedua sisi jalan, /halte/sbr-x/ dialihkan ke sana.
// Alasan: ±1.000 halaman Sbr. isinya hampir kembar dengan pasangannya (dinilai konten tipis oleh Google/AdSense).
// Data halte tidak diubah: rute tetap mencatat Sbr. sebagai halte sendiri, hanya halamannya yang digabung.
import { loadStops, loadStopCoords } from "./data.js";

export const SBR_MAX_M = 200;      // pasangan yang lebih jauh dari ini tetap punya halaman sendiri

const ok = c => c && Number.isFinite(c.lat) && Number.isFinite(c.lng);
const meters = (a, b) => {
  const k = Math.PI / 180, x = (b.lng - a.lng) * k * Math.cos((a.lat + b.lat) / 2 * k), y = (b.lat - a.lat) * k;
  return Math.hypot(x, y) * 6371000;
};

let _m = null;
// { toMain: Map(sbrId → id halte utama), partner: Map(id halte utama → sbrId) }
export function stopMerge() {
  if (_m) return _m;
  const stops = loadStops(), coords = loadStopCoords();
  const toMain = new Map(), partner = new Map();
  for (const id of Object.keys(stops)) {
    if (!id.startsWith("sbr-")) continue;
    const main = id.slice(4);
    if (!stops[main] || main.startsWith("sbr-")) continue;
    const a = coords[id], b = coords[main];
    if (!ok(a) || !ok(b) || meters(a, b) > SBR_MAX_M) continue;
    toMain.set(id, main);
    partner.set(main, id);
  }
  return (_m = { toMain, partner });
}

// id halaman tempat sebuah halte ditampilkan
export const pageStopId = id => stopMerge().toMain.get(id) || id;
// true bila halte ini tidak punya halaman sendiri (digabung ke pasangannya)
export const isMergedStop = id => stopMerge().toMain.has(id);
// halte Sbr. pasangan dari halte utama (null bila tidak ada)
export const partnerStop = id => stopMerge().partner.get(id) || null;
// tautan halaman halte, selalu dengan garis miring di akhir
export const stopHref = id => `/halte/${pageStopId(id)}/`;
