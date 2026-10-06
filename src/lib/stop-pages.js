// Pembagian daftar halte per huruf awal. Huruf dengan halte sangat banyak (mis. S: "Simpang", "Sbr.")
// dipecah menjadi beberapa halaman berurutan agar tiap halaman tetap ringan.
import { loadStops } from "./data.js";

export const CHUNK = 600;
const letterOf = name => { const c = name.trim().charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; };
let _pages = null;

// [{ slug, letter, label, items: [[id, stop], ...], part, parts }]
export function stopLetterPages() {
  if (_pages) return _pages;
  const entries = Object.entries(loadStops()).sort((a, b) => a[1].name.localeCompare(b[1].name, "id", { numeric: true }));
  const byLetter = new Map();
  for (const e of entries) {
    const L = letterOf(e[1].name);
    if (!byLetter.has(L)) byLetter.set(L, []);
    byLetter.get(L).push(e);
  }
  _pages = [];
  for (const [L, items] of byLetter) {
    const parts = Math.ceil(items.length / CHUNK);
    const size = Math.ceil(items.length / parts);
    const chunks = Array.from({ length: parts }, (_, i) => items.slice(i * size, (i + 1) * size));
    const nm = e => e[1].name.trim();
    // Label rentang: dua kata pertama nama di batas halaman, mis. "Jln. Gaya–Jln. Otista"
    const words = x => { const w = x.split(/\s+/); let n = 2; while (n < w.length && /\.$/.test(w[n - 1])) n++; return w.slice(0, n).join(" "); };
    const diff = (x) => words(x);
    chunks.forEach((chunk, i) => {
      const base = L === "#" ? "0" : L.toLowerCase();
      const prevLast = i > 0 ? nm(chunks[i - 1][chunks[i - 1].length - 1]) : null;
      const nextFirst = i < parts - 1 ? nm(chunks[i + 1][0]) : null;
      _pages.push({
        slug: parts > 1 ? `${base}-${i + 1}` : base,
        letter: L,
        label: parts > 1 ? `${diff(nm(chunk[0]), prevLast)}–${diff(nm(chunk[chunk.length - 1]), nextFirst)}` : L === "#" ? "0–9" : L,
        items: chunk, part: i + 1, parts,
      });
    });
  }
  return _pages;
}
