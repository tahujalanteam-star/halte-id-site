// Peta locality (gaya peta sekitar stasiun MRT Singapura): gambar dasar Mapbox Static + lapisan SVG buatan sendiri.
// Pusat & zoom ditentukan di sini (tidak "auto"), jadi posisi piksel setiap titik bisa dihitung persis dengan
// proyeksi Web Mercator yang sama dengan Mapbox (ubin 512 px). Lapisan: rel → lingkaran jalan kaki → kotak peron → halte → label.
import { loadRailGeo, loadStations } from "./data.js";
import { RAIL_LINES, lineInfo, isOpen } from "./rail.js";

export const LM_W = 760, LM_H = 520;
const RING_M = 600;          // lingkaran ±8 menit jalan kaki
const RING_PX = 205;         // jari-jari lingkaran 600 m di peta standar
const SAFE_X = 125;          // di ponsel (skala 0,72) ±125 px kiri-kanan terpotong
const UNDERGROUND = new Set(["mrt-bundaran-hi", "mrt-dukuh-atas", "mrt-setiabudi", "mrt-bendungan-hilir", "mrt-istora", "mrt-senayan"]);
// Panjang peron perkiraan (m): rangkaian terpanjang tiap moda
// Lebar kotak (m). Standar 24 m; stasiun besar dengan banyak jalur dibuat lebih lebar agar terbaca sebagai bangunan.
// Perkiraan kasar dari jumlah jalur; koreksi bila ada data denah yang lebih tepat.
const WIDE = {
  "krl-manggarai": 72,
  "kai-gambir": 48, "krl-jakarta-kota": 48, "krl-jatinegara": 48, "krl-tanah-abang": 48, "krl-duri": 48,
  "krl-pasar-senen": 48, "krl-kampung-bandan": 48, "krl-bekasi": 40, "krl-bogor": 40, "krl-cikarang": 40, "krl-depok": 40, "krl-tangerang": 40, "krl-rangkasbitung": 40, "krl-cawang": 40,
};
const platformWidth = slug => WIDE[slug] || 24;
const platformLen = slug => slug.startsWith("krl-") ? 240 : slug.startsWith("mrt-") ? 160 : slug.startsWith("lrt-jabodebek") ? 140 : slug.startsWith("lrt-jakarta") ? 120 : 200;

const world = (lat, lng, z) => {
  const ws = 512 * 2 ** z, s = Math.sin(lat * Math.PI / 180);
  return [(lng + 180) / 360 * ws, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * ws];
};
const meters = (a, b) => {
  const k = Math.PI / 180, x = (b.lng - a.lng) * k * Math.cos((a.lat + b.lat) / 2 * k), y = (b.lat - a.lat) * k;
  return Math.hypot(x, y) * 6371000;
};
const r1 = v => Math.round(v * 10) / 10;
// Batas lat/lng tiap ruas rel, dihitung sekali (saringan cepat sebelum proyeksi)
let _geo = null;
const railGeo = () => _geo ||= loadRailGeo().map(w => {
  const la = w.g.map(p => p[0]), ln = w.g.map(p => p[1]);
  return { ...w, bb: [Math.min(...la), Math.min(...ln), Math.max(...la), Math.max(...ln)] };
});
const overlap = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
function nearSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)), q = [a[0] + t * dx, a[1] + t * dy];
  return { d: Math.hypot(p[0] - q[0], p[1] - q[1]), q, dir: [dx, dy] };
}
// [1,3,4,5] → "1,3–5"
const numText = nums => {
  const out = [];
  for (let i = 0; i < nums.length;) {
    let j = i; while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    out.push(j > i ? `${nums[i]}–${nums[j]}` : String(nums[i])); i = j + 1;
  }
  return out.join(",");
};

/**
 * center: { lat, lng }            titik tengah peta (halte/stasiun/tempat/kawasan)
 * mainStation: slug | null        stasiun yang sedang dibuka (kotaknya disorot)
 * mainPoint: { lat, lng } | null  titik utama selain stasiun (halte/tempat), digambar biru
 * pins: [{ lat, lng, num, href, name }]  halte bernomor sesuai daftar di halaman
 */
export function localityMap({ center, mainStation = null, mainPoint = null, pins = [], token }) {
  if (!token || !center) return null;
  const W = LM_W, H = LM_H;
  // Zoom: lingkaran 600 m ±205 px; diperkecil bila ada halte bernomor yang lebih jauh
  const far = Math.max(RING_M, ...pins.map(p => meters(center, p) + 70));
  const mpp0 = 40075016.686 * Math.cos(center.lat * Math.PI / 180) / 512;
  const z = Math.floor(Math.log2(mpp0 / (far / RING_PX)) * 4) / 4;
  const mpp = mpp0 / 2 ** z;
  const [cx, cy] = world(center.lat, center.lng, z);
  const P = (lat, lng) => { const [x, y] = world(lat, lng, z); return [x - cx + W / 2, y - cy + H / 2]; };
  const inFrame = (p, m = 0) => p[0] >= -m && p[0] <= W + m && p[1] >= -m && p[1] <= H + m;

  // ---- rel: ruas di sekitar peta, digeser sejajar bila dipakai beberapa lin
  const ways = [];
  const padLat = (H / 2 + 80) * mpp / 110540, padLng = (W / 2 + 80) * mpp / (111320 * Math.cos(center.lat * Math.PI / 180));
  for (const w of railGeo()) {
    if (w.bb[0] > center.lat + padLat || w.bb[2] < center.lat - padLat || w.bb[1] > center.lng + padLng || w.bb[3] < center.lng - padLng) continue;
    const lines = w.l.filter(k => RAIL_LINES[k]);
    if (!lines.length) continue;
    const pts = w.g.map(([la, ln]) => P(la, ln));
    if (!pts.some(p => inFrame(p, 80))) continue;
    ways.push({ lines, pts });
  }
  const lines = [], codes = new Set();
  for (const w of ways) {
    const n = w.lines.length;
    w.lines.forEach((k, i) => {
      const off = (i - (n - 1) / 2) * 3.6;
      const pts = w.pts.map((p, j) => {
        const a = w.pts[Math.max(0, j - 1)], b = w.pts[Math.min(w.pts.length - 1, j + 1)];
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        return [r1(p[0] - dy / L * off), r1(p[1] + dx / L * off)];
      });
      lines.push({ color: lineInfo(k).color, d: "M" + pts.map(p => p.join(",")).join("L") });
      if (pts.some(p => inFrame(p))) codes.add(k);
    });
  }

  const occ = [];
  // ---- kotak peron
  const stations = [];
  for (const [slug, s] of Object.entries(loadStations())) {
    if (!isOpen(s) || !Number.isFinite(s.lat)) continue;
    const p = P(s.lat, s.lng);
    if (!inFrame(p, -6)) continue;
    const own = ways.filter(w => w.lines.some(l => (s.lines || []).includes(l)));
    const near = (own.length ? own : ways).map(w => {
      let best = null;
      for (let j = 0; j < w.pts.length - 1; j++) { const r = nearSeg(p, w.pts[j], w.pts[j + 1]); if (!best || r.d < best.d) best = r; }
      return best;
    }).filter(Boolean).sort((a, b) => a.d - b.d);
    let c = p, ang = 0;
    if (near.length && near[0].d < 60) {
      const close = near.filter(r => r.d <= near[0].d + 12);
      c = [close.reduce((s, r) => s + r.q[0], 0) / close.length, close.reduce((s, r) => s + r.q[1], 0) / close.length];
      ang = Math.atan2(near[0].dir[1], near[0].dir[0]);
    }
    const L = platformLen(slug) / mpp, ca = Math.cos(ang), sa = Math.sin(ang);
    let Wd = Math.max(platformWidth(slug) / mpp, 10);
    // Stasiun besar: lebar & posisi melintang disesuaikan agar semua jalur yang lewat (±60 m dari sumbu) tertutup kotak
    if (WIDE[slug] && own.length) {
      const reach = 60 / mpp, pad = 14 / mpp + 4;
      let lo = Infinity, hi = -Infinity;
      for (const w of own) for (let j = 0; j < w.pts.length - 1; j++) {
        const a = w.pts[j], b = w.pts[j + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4));
        for (let t = 0; t <= n; t++) {
          const x = a[0] + (b[0] - a[0]) * t / n - c[0], y = a[1] + (b[1] - a[1]) * t / n - c[1];
          const u = x * ca + y * sa, v = -x * sa + y * ca;
          if (Math.abs(u) <= L / 2 && Math.abs(v) <= reach) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
        }
      }
      if (hi >= lo) {
        const mid = (lo + hi) / 2;
        Wd = Math.max(Wd, hi - lo + 2 * pad);
        c = [c[0] - sa * mid, c[1] + ca * mid];
      }
    }
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [r1(c[0] + ca * u * L / 2 - sa * v * Wd / 2), r1(c[1] + sa * u * L / 2 + ca * v * Wd / 2)]);
    const xs = corners.map(q => q[0]), ys = corners.map(q => q[1]);
    const aabb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    occ.push(aabb);
    const own_lines = (s.lines || []).filter(l => RAIL_LINES[l]).sort((a, b) => lineInfo(a).code.localeCompare(lineInfo(b).code));
    own_lines.forEach(l => codes.add(l));
    stations.push({ slug, name: s.short || s.name, full: s.name, aabb, corners, under: UNDERGROUND.has(slug), main: slug === mainStation,
      badges: own_lines.map(l => ({ code: lineInfo(l).code, color: lineInfo(l).color })) });
  }

  // ---- halte: titik utama + halte bernomor (yang berimpit digabung jadi "1–3")
  const groups = [];
  const main = mainPoint ? { p: P(mainPoint.lat, mainPoint.lng), nums: [], main: true } : null;
  if (main) groups.push(main);
  for (const pin of [...pins].sort((a, b) => a.num - b.num)) {
    const p = P(pin.lat, pin.lng);
    if (!inFrame(p, -8)) continue;
    if (main && Math.hypot(main.p[0] - p[0], main.p[1] - p[1]) < 16) { main.nums.push(pin.num); continue; }
    const g = groups.find(g => !g.main && Math.hypot(g.p[0] - p[0], g.p[1] - p[1]) < 14);
    if (g) { g.nums.push(pin.num); g.p = [(g.p[0] * (g.nums.length - 1) + p[0]) / g.nums.length, (g.p[1] * (g.nums.length - 1) + p[1]) / g.nums.length]; g.names.push(pin.name); }
    else groups.push({ p, nums: [pin.num], href: pin.href, names: [pin.name] });
  }
  // gabungkan kelompok yang lambangnya masih bertumpuk (mis. "3" menempel "1,4,5")
  const pillW = g => { const t = numText([...g.nums].sort((a, b) => a - b)); return t.length <= 2 ? 20 : 10 + t.length * 7; };
  for (let changed = true; changed;) {
    changed = false;
    outer: for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i], b = groups[j];
      if (a.main || b.main) continue;
      if (Math.abs(a.p[0] - b.p[0]) < (pillW(a) + pillW(b)) / 2 + 2 && Math.abs(a.p[1] - b.p[1]) < 22) {
        const n = a.nums.length + b.nums.length;
        a.p = [(a.p[0] * a.nums.length + b.p[0] * b.nums.length) / n, (a.p[1] * a.nums.length + b.p[1] * b.nums.length) / n];
        a.nums = [...a.nums, ...b.nums].sort((x, y) => x - y); a.names = [...a.names, ...b.names];
        groups.splice(j, 1); changed = true; break outer;
      }
    }
  }
  const boxesAabb = [...occ];
  const pinsOut = groups.map(g => {
    let [x, y] = g.p;
    if (!g.main) for (let k = 0; k < 8; k++) {   // jangan menutupi kotak peron
      const hit = boxesAabb.find(b => x > b[0] - 10 && x < b[2] + 10 && y > b[1] - 10 && y < b[3] + 10);
      if (!hit) break;
      const dx = x - (hit[0] + hit[2]) / 2, dy = y - (hit[1] + hit[3]) / 2, L = Math.hypot(dx, dy) || 1;
      x += dx / L * 4; y += dy / L * 4;
    }
    const t = g.main ? (g.nums.length ? numText(g.nums) : "") : numText(g.nums);
    const w = t.length <= 2 ? 20 : 10 + t.length * 7;
    occ.push([x - w / 2, y - 10, x + w / 2, y + 10]);
    return { x: r1(x), y: r1(y), t, w: r1(w), main: !!g.main, href: g.href || null, title: g.names ? g.names.join(" · ") : "" };
  });

  // ---- lingkaran & labelnya
  const ring = { cx: W / 2, cy: H / 2, r: r1(RING_M / mpp) };
  // label di puncak lingkaran (tetap terlihat walau tepi kiri-kanan peta terpotong di ponsel)
  const ringLabel = { x: ring.cx, y: r1(Math.max(16, ring.cy - ring.r - 7)) };
  occ.push([ringLabel.x - 68, ringLabel.y - 14, ringLabel.x + 68, ringLabel.y + 4]);

  // ---- label stasiun: stasiun utama dulu, pilih posisi yang paling sedikit bertabrakan
  const labels = [];
  for (const s of [...stations].sort((a, b) => b.main - a.main)) {
    const bw = s.badges.reduce((t, b) => t + (b.code.length === 1 ? 22 : 28) + 3, 0);
    const lw = bw + 3 + s.name.length * (s.main ? 8.6 : 7.6), lh = 24;
    const [x0, y0, x1, y1] = s.aabb, mx = (x0 + x1) / 2, my = (y0 + y1) / 2, g = 6;
    const cands = [[x1 + g, my - lh / 2], [x0 - g - lw, my - lh / 2], [mx - lw / 2, y0 - g - lh], [mx - lw / 2, y1 + g],
      [x1 + g, y0 - g - lh], [x1 + g, y1 + g], [x0 - g - lw, y0 - g - lh], [x0 - g - lw, y1 + g]];
    let best = null;
    cands.forEach(([lx, ly], k) => {
      const r = [lx, ly, lx + lw, ly + lh];
      let sc = occ.reduce((t, o) => t + overlap(r, o), 0) + k * 0.5;
      if (lx < 4 || ly < 4 || lx + lw > W - 4 || ly + lh > H - 22) sc += 5000;
      if (lx < SAFE_X || lx + lw > W - SAFE_X) sc += 600;   // area yang terlihat di ponsel
      if (!best || sc < best.sc) best = { sc, r };
    });
    occ.push(best.r);
    labels.push({ x: r1(best.r[0]), y: r1(best.r[1]), name: s.name, full: s.full, slug: s.slug, main: s.main, badges: s.badges });
  }

  const base = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${center.lng.toFixed(6)},${center.lat.toFixed(6)},${z},0/${W}x${H}@2x?access_token=${token}`;
  return {
    W, H, z, url: base, urlDark: base.replace("/streets-v12/", "/dark-v11/"),
    lines, ring, ringLabel,
    boxes: stations.map(s => ({ points: s.corners.map(q => q.join(",")).join(" "), under: s.under, main: s.main, slug: s.slug, name: s.full })),
    pins: pinsOut, labels,
    codes: [...codes].sort((a, b) => lineInfo(a).code.localeCompare(lineInfo(b).code)),
    hasBoxes: stations.length > 0,
  };
}
