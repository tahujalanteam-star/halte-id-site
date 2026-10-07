// Perhitungan tarif kereta tanpa akses file: dipakai saat build (halaman stasiun/lin)
// dan di browser (kalkulator /kereta/tarif). Data "net" dibuat oleh buildFareNet() di rail.js.
//
// net = {
//   krl:  { rule: {base_fare, base_km, step_fare, step_km}, adj: { slug: [[slug, km], ...] } },
//   mrt:  { idx: { slug: i }, fares: [[...]] },
//   jab:  { idx: { slug: i }, fares: [[...]], cap: 10000 },   // LRT Jabodebek, matriks = jam sibuk
//   lrtj: { fare: 5000, stations: [slug, ...] },               // LRT Jakarta, tarif datar
// }

// Jarak rel terpendek dari satu stasiun ke semua stasiun KRL (Dijkstra sederhana; < 150 simpul)
export function krlDistances(adj, src) {
  const dist = { [src]: 0 };
  const done = new Set();
  if (!adj[src]) return dist;
  for (;;) {
    let u = null, best = Infinity;
    for (const k in dist) if (!done.has(k) && dist[k] < best) { best = dist[k]; u = k; }
    if (u === null) break;
    done.add(u);
    for (const [v, w] of adj[u] || []) {
      const nd = best + w;
      if (nd < (dist[v] ?? Infinity)) dist[v] = nd;
    }
  }
  return dist;
}

export function krlFareForKm(km, rule) {
  const extra = Math.max(0, km - rule.base_km);
  return rule.base_fare + Math.ceil(extra / rule.step_km - 1e-9) * rule.step_fare;
}

// Jaringan tarif yang dimiliki stasiun (satu stasiun bisa >1, mis. tidak ada saat ini, tapi aman)
export function fareNetworksOf(net, slug) {
  const out = [];
  if (net.krl?.adj?.[slug]) out.push("krl");
  if (net.mrt?.idx?.[slug] !== undefined) out.push("mrt");
  if (net.jab?.idx?.[slug] !== undefined) out.push("jab");
  if (net.lrtj?.stations?.includes(slug)) out.push("lrtj");
  return out;
}

// Tarif a → b dalam satu jaringan. Hasil: { network, fare, fareOff?, km? } atau null bila beda jaringan.
export function fareBetween(net, a, b, distCache) {
  if (!a || !b || a === b) return null;
  const na = fareNetworksOf(net, a), nb = fareNetworksOf(net, b);
  const n = na.find(x => nb.includes(x));
  if (!n) return null;
  if (n === "krl") {
    const d = (distCache || krlDistances(net.krl.adj, a))[b];
    if (!Number.isFinite(d)) return null;
    return { network: n, km: d, fare: krlFareForKm(d, net.krl.rule) };
  }
  if (n === "mrt") return { network: n, fare: net.mrt.fares[net.mrt.idx[a]][net.mrt.idx[b]] };
  if (n === "jab") {
    const fare = net.jab.fares[net.jab.idx[a]][net.jab.idx[b]];
    return { network: n, fare, fareOff: net.jab.cap ? Math.min(fare, net.jab.cap) : fare };
  }
  if (n === "lrtj") return { network: n, fare: net.lrtj.fare };
  return null;
}

export const rupiah = n => "Rp" + Math.round(n).toLocaleString("id-ID");
