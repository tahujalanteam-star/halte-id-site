// Peta skematik jaringan kereta Jabodetabek (gaya peta transit: garis horizontal/vertikal/45°).
// Dipakai di bagian atas /kereta lewat src/components/RailDiagram.astro. Fungsi murni (tanpa akses file).
// Hanya lin yang digambar di sini; Whoosh & Walahar tidak digambar (cukup catatan transit di stasiunnya).
// Satuan kisi U px. Titik jalur: slug stasiun atau [x, y] (tikungan). Stasiun yang tidak punya posisi tetap
// (ANCHOR) disebar rata di antara titik tetap sebelum & sesudahnya. Posisi stasiun yang dipakai beberapa lin
// ditentukan oleh lin pertama yang melewatinya.

export const U = 36;

// Busur setengah lingkaran sisi barat lingkar Cikarang (BNI City → Tanah Abang → Duri → Angke → atas).
// Sudut dalam derajat, sumbu y ke bawah: 90° = bawah, 180° = kiri, 270° = atas.
const WEST = { cx: -7.6, cy: -3.2, R: 4.2 };
const onWest = deg => { const t = deg * Math.PI / 180; return [+(WEST.cx + WEST.R * Math.cos(t)).toFixed(4), +(WEST.cy + WEST.R * Math.sin(t)).toFixed(4)]; };
// titik-titik busur dari a0 ke a1 (tanpa ujung), tiap 3°
const westArc = (a0, a1) => { const out = []; for (let a = a0 + 3; a < a1 - 0.01; a += 3) out.push(onWest(a)); return out; };

// Posisi tetap (kisi). Ubah di sini untuk menyetel tata letak.
export const ANCHOR = {
  // KRL Bogor & Tanjung Priok: Jakarta Kota menghadap barat (lin masuk dari timur)
  "krl-jakarta-kota": [-1.6, -6.2], "krl-jayakarta": [0, -5.1], "krl-manggarai": [0, 1], "krl-cawang": [0, 5.2], "krl-duren-kalibata": [0, 7.2], "krl-citayam": [0, 18], "krl-bogor": [0, 21],
  "krl-nambo": [3.2, 18],
  // Lin Cikarang (lingkar): sudut membulat besar agar terbaca sebagai lingkar
  "krl-jatinegara": [4.5, 1], "krl-cikarang": [15.5, 1],
  "krl-bni-city": [-7, 1], "krl-sudirman": [-5, 1], "krl-tanah-abang": onWest(135), "krl-duri": onWest(180), "krl-angke": onWest(225), "krl-kampung-bandan": [2, -7.4],
  "krl-kramat": [4.5, -0.8],
  "krl-tangerang": [-21, -3.2], "krl-rawa-buaya": [-17, -3.2], "krl-batu-ceper": [-19, -3.2], "krl-bandara-soekarno-hatta": [-21, -7.2],
  "krl-tanjung-priuk": [6.5, -8.2],
  "krl-rangkasbitung": [-26, -0.23 + 5.2],
  "mrt-bundaran-hi": [-6, -1.3], "mrt-dukuh-atas": [-6, 0.45], "mrt-setiabudi": [-6, 2.6], "mrt-lebak-bulus": [-8, 13],
  "lrt-jabodebek-dukuh-atas": [-4.2, 1.8], "lrt-jabodebek-cikoko": [0.8, 6], "lrt-jabodebek-cawang": [3, 6], "lrt-jabodebek-harjamukti": [3, 10.5], "lrt-jabodebek-jatimulya": [11, 6],
  "lrt-jakarta-manggarai": [0.8, 0.2], "lrt-jakarta-matraman": [3.8, -1.5], "lrt-jakarta-pramuka": [5.6, -1.5], "lrt-jakarta-kelapa-gading": [9.5, -8.6],
};

// Jalur gambar per lin (bisa lebih dari satu potongan). shift: geser sejajar (px) agar lin yang berbagi rel tampil berdampingan.
// r: jari-jari tikungan (px). Tikungan tepat di stasiun dibiarkan tajam agar penanda tetap di garis.
export const LINES = [
  { key: "krl-bogor", shift: 2.6, paths: [
    ["krl-jakarta-kota", [0, -6.2], "krl-jayakarta", "krl-mangga-besar", "krl-sawah-besar", "krl-juanda", "krl-gondangdia", "krl-cikini", "krl-manggarai", "krl-tebet", "krl-cawang", "krl-duren-kalibata", "krl-pasar-minggu-baru", "krl-pasar-minggu", "krl-tanjung-barat", "krl-lenteng-agung", "krl-universitas-pancasila", "krl-universitas-indonesia", "krl-pondok-cina", "krl-depok-baru", "krl-depok", "krl-citayam", "krl-bojonggede", "krl-cilebut", "krl-bogor"],
    ["krl-citayam", "krl-cibinong", "krl-nambo"],
  ] },
  { key: "krl-cikarang", shift: -2.6, r: 42, paths: [
    ["krl-cikarang", "krl-metland-telagamurni", "krl-cibitung", "krl-tambun", "krl-bekasi-timur", "krl-bekasi", "krl-kranji", "krl-cakung", "krl-klender-baru", "krl-buaran", "krl-klender", "krl-jatinegara"],
    ["krl-jatinegara", "krl-matraman", "krl-manggarai", "krl-sudirman", "krl-bni-city", onWest(90), ...westArc(90, 135), "krl-tanah-abang", ...westArc(135, 180), "krl-duri", ...westArc(180, 225), "krl-angke", ...westArc(225, 270), onWest(270), "krl-kampung-bandan", [3.4, -7.4], [4.5, -6.3], "krl-rajawali", "krl-kemayoran", "krl-pasar-senen", "krl-gang-sentiong", "krl-kramat", "krl-pondok-jati", "krl-jatinegara"],
  ] },
  { key: "krl-tangerang", shift: -2.6, paths: [
    ["krl-duri", "krl-grogol", "krl-pesing", "krl-taman-kota", "krl-bojong-indah", "krl-rawa-buaya", "krl-kalideres", "krl-poris", "krl-batu-ceper", "krl-tanah-tinggi", "krl-tangerang"],
  ] },
  { key: "krl-bandara", shift: 2.6, r: 42, paths: [
    ["krl-manggarai", "krl-sudirman", "krl-bni-city", onWest(90), ...westArc(90, 135), onWest(135), ...westArc(135, 180), "krl-duri", "krl-rawa-buaya", "krl-batu-ceper", [-20, -4.2], [-21, -5.2], "krl-bandara-soekarno-hatta"],
  ] },
  { key: "krl-tanjung-priok", shift: -2.6, paths: [
    ["krl-jakarta-kota", [0.8, -6.2], "krl-kampung-bandan", [2.8, -8.2], "krl-ancol", "krl-tanjung-priuk"],
  ] },
  { key: "krl-rangkasbitung", shift: 0, paths: [
    ["krl-tanah-abang", "krl-palmerah", "krl-kebayoran", [-10.57 - 5.2, -0.23 + 5.2], "krl-pondok-ranji", "krl-jurangmangu", "krl-sudimara", "krl-rawa-buntu", "krl-serpong", "krl-cisauk", "krl-cicayur", "krl-jatake", "krl-parungpanjang", "krl-cilejit", "krl-daru", "krl-tenjo", "krl-tigaraksa", "krl-maja", "krl-citeras", "krl-rangkasbitung"],
  ] },
  { key: "mrt-utara-selatan", shift: 0, paths: [
    ["mrt-bundaran-hi", "mrt-dukuh-atas", [-6, 1.6], "mrt-setiabudi", "mrt-bendungan-hilir", "mrt-istora", "mrt-senayan", "mrt-asean", "mrt-blok-m", "mrt-blok-a", "mrt-haji-nawi", "mrt-cipete-raya", [-6, 11], "mrt-fatmawati", "mrt-lebak-bulus"],
  ] },
  { key: "lrt-cibubur", shift: -2.6, paths: [
    ["lrt-jabodebek-dukuh-atas", [-3.2, 1.8], [-2.6, 2.4], "lrt-jabodebek-setiabudi", "lrt-jabodebek-rasuna-said", "lrt-jabodebek-kuningan", [-2.6, 4.6], [-1.2, 6], "lrt-jabodebek-pancoran", "lrt-jabodebek-cikoko", "lrt-jabodebek-ciliwung", "lrt-jabodebek-cawang", "lrt-jabodebek-taman-mini", "lrt-jabodebek-kampung-rambutan", "lrt-jabodebek-ciracas", "lrt-jabodebek-harjamukti"],
  ] },
  { key: "lrt-bekasi", shift: 2.6, paths: [
    ["lrt-jabodebek-dukuh-atas", [-3.2, 1.8], [-2.6, 2.4], "lrt-jabodebek-setiabudi", "lrt-jabodebek-rasuna-said", "lrt-jabodebek-kuningan", [-2.6, 4.6], [-1.2, 6], "lrt-jabodebek-pancoran", "lrt-jabodebek-cikoko", "lrt-jabodebek-ciliwung", "lrt-jabodebek-cawang", "lrt-jabodebek-halim", "lrt-jabodebek-jatibening-baru", "lrt-jabodebek-cikunir-1", "lrt-jabodebek-cikunir-2", "lrt-jabodebek-bekasi-barat", "lrt-jabodebek-jatimulya"],
  ] },
  { key: "lrt-jakarta", shift: 0, paths: [
    ["lrt-jakarta-manggarai", [0.8, -0.1], "lrt-jakarta-proklamasi", [2.2, -1.5], "lrt-jakarta-matraman", "lrt-jakarta-pramuka", [6.5, -1.5], "lrt-jakarta-rawamangun", "lrt-jakarta-velodrome", [9.5, -4.5], "lrt-jakarta-equestrian", "lrt-jakarta-pulomas", "lrt-jakarta-boulevard-selatan", "lrt-jakarta-boulevard-utara", "lrt-jakarta-kelapa-gading"],
  ] },
];

// Posisi label yang disetel manual: e (kanan), w (kiri), n, s, ne, se, nw, sw
// Label miring seragam di lintasan mendatar panjang: "below45" (di bawah garis, seperti Pesing), "above45"
const BELOW = ["krl-cisauk", "krl-cicayur", "krl-jatake", "krl-parungpanjang", "krl-cilejit", "krl-daru", "krl-tenjo", "krl-tigaraksa", "krl-maja", "krl-citeras", "krl-rangkasbitung",
  "krl-grogol", "krl-pesing", "krl-taman-kota", "krl-bojong-indah", "krl-rawa-buaya", "krl-kalideres", "krl-poris", "krl-batu-ceper", "krl-tanah-tinggi", "krl-tangerang"];
export const LABEL = { ...Object.fromEntries(BELOW.map(s => [s, "below45"])), "lrt-jakarta-proklamasi": "se", "lrt-jakarta-matraman": "n", "lrt-jakarta-manggarai": "none", "krl-manggarai": "se", "krl-jakarta-kota": "w" };   // none: tanpa label (nama sama dengan stasiun di sebelahnya)

// Titik pindah antarstasiun (digambar sebagai penghubung abu-abu)
export const LINKS = [
  // Dukuh Atas: jalur pejalan kaki BNI City – (MRT Dukuh Atas) – Sudirman, dan jembatan Sudirman – LRT Dukuh Atas
  ["krl-bni-city", [-7, 0.45], "mrt-dukuh-atas", [-5, 0.45], "krl-sudirman"],
  ["krl-sudirman", "lrt-jabodebek-dukuh-atas"],
  ["krl-cawang", "lrt-jabodebek-cikoko"], ["krl-manggarai", "lrt-jakarta-manggarai"], ["krl-kramat", "lrt-jakarta-matraman"],
]
// Ikon di samping label stasiun
export const ICONS = { "krl-bandara-soekarno-hatta": "plane" };

// Latar: laut (Teluk Jakarta) & ruang terbuka hijau besar, dalam satuan kisi (skematis, bukan posisi persis)
export const BACKDROP = {
  sea: { name: "Teluk Jakarta", label: [-4, -10.3], pts: [[-60, -40], [80, -40], [80, -9.4], [8, -9.4], [7.2, -9.9], [-12, -9.9], [-13, -9.2], [-60, -9.2]] },
  parks: [
    { name: "Monas", x: -4.6, y: -4.4, w: 3, h: 2 },
    { name: "GBK", x: -9.4, y: 4.4, w: 2.4, h: 2 },
    { name: "TMII", x: 5.4, y: 8.6, w: 3, h: 1.7 },
    { name: "Kebun Raya Bogor", x: -5.2, y: 20.6, w: 4.4, h: 1.5 },
  ],
};

// Catatan transit ke kereta yang tidak digambar
export const NOTES = [{ at: "lrt-jabodebek-halim", text: "Transit Whoosh", code: "W", color: "#8c0023", href: "/kereta/whoosh" }];

// ---------------------------------------------------------------------------------------------
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const onSeg = (p, a, b) => Math.abs(dist(a, p) + dist(p, b) - dist(a, b)) < 0.5;
// Lin yang berbagi rel & stasiun (bukan titik pindah): penanda biasa, bukan penanda transit
const GROUP = { "lrt-cibubur": "lrt-jabodebek", "lrt-bekasi": "lrt-jabodebek" };

function offsetPolyline(pts, off) {
  if (!off) return pts;
  const n = pts.length, out = [];
  const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1; return [-dy / L, dx / L]; };
  for (let i = 0; i < n; i++) {
    const n1 = i > 0 ? nrm(pts[i - 1], pts[i]) : null, n2 = i < n - 1 ? nrm(pts[i], pts[i + 1]) : null;
    let m;
    if (n1 && n2) { const sx = n1[0] + n2[0], sy = n1[1] + n2[1], dot = Math.max(0.5, sx * n1[0] + sy * n1[1]); m = [sx / dot, sy / dot]; }
    else m = n1 || n2;
    out.push([pts[i][0] + m[0] * off, pts[i][1] + m[1] * off]);
  }
  return out;
}
function roundedPath(points, r, sharp = []) {
  const f = n => +n.toFixed(1);
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1], [cx, cy] = points[i], [nx, ny] = points[i + 1];
    const l1 = Math.hypot(cx - px, cy - py), l2 = Math.hypot(nx - cx, ny - cy);
    const cross = Math.abs((cx - px) * (ny - cy) - (cy - py) * (nx - cx));
    if (cross < 1e-6 || sharp[i]) { d += ` L${f(cx)} ${f(cy)}`; continue; }
    const k = Math.min(r, l1 / 2, l2 / 2);
    d += ` L${f(cx - (cx - px) / l1 * k)} ${f(cy - (cy - py) / l1 * k)} Q${f(cx)} ${f(cy)} ${f(cx + (nx - cx) / l2 * k)} ${f(cy + (ny - cy) / l2 * k)}`;
  }
  const [lx, ly] = points[points.length - 1];
  return d + ` L${f(lx)} ${f(ly)}`;
}

/**
 * stations: { slug: { short, name } } · lineInfo(key) → { color, code, label }
 * Hasil dalam px (sudah dikali U), siap digambar sebagai SVG.
 */
export function buildRailDiagram({ stations, lineInfo }) {
  const pos = {};
  for (const [s, p] of Object.entries(ANCHOR)) pos[s] = p;
  const servedBy = {}, dirOf = {};
  const SHIFT = Object.fromEntries(LINES.map(L => [L.key, L.shift || 0]));
  const segsAll = [];
  const lines = [];
  for (const L of LINES) {
    const info = lineInfo(L.key);
    for (const path of L.paths) {
      // 1) posisi stasiun yang belum tetap: disebar rata menurut panjang lintasan (melewati titik tikungan)
      //    di antara dua stasiun yang posisinya sudah tetap
      const isFixedSt = i => !Array.isArray(path[i]) && pos[path[i]];
      const P = i => Array.isArray(path[i]) ? path[i] : pos[path[i]];
      if (!isFixedSt(0) || !(Array.isArray(path[path.length - 1]) || pos[path[path.length - 1]])) throw new Error(`${L.key}: ujung jalur harus punya posisi tetap`);
      let a = 0;
      const draw = [P(0)], sharp = [true];
      for (let b = 1; b < path.length; b++) {
        if (Array.isArray(path[b])) { draw.push(path[b]); sharp.push(false); } else if (ANCHOR[path[b]] || b === path.length - 1) { draw.push(pos[path[b]]); sharp.push(true); }   // stasiun dari lin lain sudah berada di lintasan yang sama
        if (!(isFixedSt(b) || b === path.length - 1)) continue;
        const free = [], poly = [P(a)];
        for (let i = a + 1; i < b; i++) { if (Array.isArray(path[i])) poly.push(path[i]); else free.push(i); }
        poly.push(P(b));
        if (free.length) {
          const cum = [0]; for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + dist(poly[i - 1], poly[i]));
          const total = cum[cum.length - 1];
          free.forEach((idx, j) => {
            const t = total * (j + 1) / (free.length + 1);
            let k = 1; while (k < cum.length - 1 && cum[k] < t) k++;
            const u = (t - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1);
            const A = poly[k - 1], B = poly[k];
            pos[path[idx]] = [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u];
            dirOf[path[idx]] ||= [B[0] - A[0], B[1] - A[1]];
          });
        }
        a = b;
      }
      // buang titik kembar berurutan (ruas nol merusak geseran sejajar)
      const keep = draw.map((p, i) => i === 0 || dist(p, draw[i - 1]) > 1e-6);
      const pts = draw.filter((_, i) => keep[i]);
      const sharpK = sharp.filter((_, i) => keep[i]);
      for (const p of path) if (!Array.isArray(p)) (servedBy[p] ||= new Set()).add(L.key);
      const px = pts.map(([x, y]) => [x * U, y * U]);
      const off = offsetPolyline(px, L.shift || 0);
      lines.push({ key: L.key, color: info.color, d: roundedPath(off, L.r || 14, sharpK) });
      for (let i = 0; i < px.length - 1; i++) segsAll.push([px[i], px[i + 1], L.key]);
    }
  }
  // 2) penanda stasiun
  const st = Object.keys(servedBy).map(slug => {
    const [x, y] = pos[slug].map(v => v * U);
    const lk = [...servedBy[slug]];
    const linked = LINKS.some(l => l.includes(slug));
    const groups = new Set(lk.map(k => GROUP[k] || k));
    // arah lintasan di titik ini: mendatar bila semua ruas yang menyentuhnya mendatar
    const touch = segsAll.filter(([a, b]) => onSeg([x, y], a, b));
    const horiz = touch.length > 0 && touch.every(([a, b]) => Math.abs(a[1] - b[1]) < 0.5);
    const out = { slug, x, y, name: stations[slug]?.short || slug, lines: lk, inter: groups.size > 1 || linked, horiz, color: lineInfo(lk[0]).color };
    // Bentuk penanda: "dot" (1 lin), "bundle" (beberapa lin sejajar di rel yang sama → kapsul melintang berisi titik warna),
    // "codes" (lin bersilangan/bercabang → kapsul berisi kode lin)
    if (lk.length === 1) {
      out.kind = "dot";
      // geser titik ke garis yang digambar (lin yang digeser sejajar)
      const sh = SHIFT[lk[0]] || 0, own = touch.filter(t => t[2] === lk[0]);
      if (sh && own.length) {
        let nx = 0, ny = 0;
        for (const [a, b] of own) { const L = dist(a, b) || 1; nx += -(b[1] - a[1]) / L; ny += (b[0] - a[0]) / L; }
        const nl = Math.hypot(nx, ny) || 1;
        out.dx = +(nx / nl * sh).toFixed(2); out.dy = +(ny / nl * sh).toFixed(2);
      }
    }
    else {
      const d0 = touch[0] ? [touch[0][1][0] - touch[0][0][0], touch[0][1][1] - touch[0][0][1]] : [1, 0];
      const par = touch.every(([a, b]) => Math.abs(d0[0] * (b[1] - a[1]) - d0[1] * (b[0] - a[0])) < 1e-3 * Math.hypot(...d0) * dist(a, b) + 1e-6);
      if (par && touch.length) {
        const L0 = Math.hypot(...d0), n = [-d0[1] / L0, d0[0] / L0];
        const offs = lk.map(k => ({ k, o: SHIFT[k] || 0 })).sort((a, b) => a.o - b.o);
        const lo = offs[0].o, hi = offs[offs.length - 1].o, ext = 0;   // jarak tepi sama di semua sisi
        out.kind = "bundle";
        out.cap = { x1: +(x + n[0] * (lo - ext)).toFixed(1), y1: +(y + n[1] * (lo - ext)).toFixed(1), x2: +(x + n[0] * (hi + ext)).toFixed(1), y2: +(y + n[1] * (hi + ext)).toFixed(1) };
        out.dots = offs.map(({ k, o }) => ({ x: +(x + n[0] * o).toFixed(1), y: +(y + n[1] * o).toFixed(1), color: lineInfo(k).color }));
      } else {
        out.kind = "codes";
        const ks = [...new Set(lk)].sort((a, b) => lineInfo(a).code.localeCompare(lineInfo(b).code));
        const step = 15, w = ks.length * step;
        out.chips = ks.map((k, i) => ({ x: +(x - w / 2 + step / 2 + i * step).toFixed(1), y, code: lineInfo(k).code, color: lineInfo(k).color }));
        out.cap = { x1: +(x - w / 2 + step / 2).toFixed(1), y1: y, x2: +(x + w / 2 - step / 2).toFixed(1), y2: y };
      }
    }
    return out;
  });
  const links = LINKS.map(pl => pl.map(p => (Array.isArray(p) ? p : pos[p]).map(v => +(v * U).toFixed(1))));
  for (const pl of links) for (let i = 0; i < pl.length - 1; i++) segsAll.push([pl[i], pl[i + 1], "_link"]);
  // 3) label: pilih posisi dengan tabrakan paling sedikit (garis, penanda, label lain)
  const boxes = [];
  const segHit = (r) => {
    let s = 0;
    for (const [a, b] of segsAll) {
      // sampel titik di ruas
      const n = Math.max(2, Math.ceil(dist(a, b) / 6));
      for (let k = 0; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n; if (x > r[0] - 3 && x < r[2] + 3 && y > r[1] - 3 && y < r[3] + 3) s++; }
    }
    return s;
  };
  const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  for (const s of st) {
    if (s.cap) boxes.push([Math.min(s.cap.x1, s.cap.x2) - 9, Math.min(s.cap.y1, s.cap.y2) - 9, Math.max(s.cap.x1, s.cap.x2) + 9, Math.max(s.cap.y1, s.cap.y2) + 9]);
    else boxes.push([s.x - 9, s.y - 9, s.x + 9, s.y + 9]);
  }
  const order = [...st].sort((a, b) => (b.inter - a.inter) || a.name.length - b.name.length);
  for (const s of order) {
    if (LABEL[s.slug] === "none") { s.label = null; continue; }
    const fs = s.inter ? 11.5 : 10.5, w = s.name.length * fs * 0.56 + 2, h = fs + 2;
    // jarak label dari titik pusat: setengah ukuran penanda + celah
    const half = s.cap ? Math.max(Math.abs(s.cap.x2 - s.cap.x1), Math.abs(s.cap.y2 - s.cap.y1)) / 2 + 8 : 0;
    const g = (s.inter ? 9 : 7) + half * 0.9;
    const horiz = s.horiz;
    const cands = [];
    if (!horiz) cands.push(
      ["start", s.x + g, s.y, 0], ["end", s.x - g, s.y, 0],
      ["middle", s.x, s.y - g - h / 2 + 1, 0], ["middle", s.x, s.y + g + h / 2 - 1, 0],
      ["start", s.x + g * 0.8, s.y - g * 0.9, 0], ["start", s.x + g * 0.8, s.y + g * 0.9, 0], ["end", s.x - g * 0.8, s.y - g * 0.9, 0], ["end", s.x - g * 0.8, s.y + g * 0.9, 0]);
    // teks miring 45° (untuk lintasan mendatar yang rapat)
    cands.push(["start", s.x + 4, s.y - 6, -45], ["end", s.x - 4, s.y + 6, -45]);
    if (LABEL[s.slug] === "below45") cands.splice(0, cands.length, ["end", s.x - 4, s.y + 6 + (s.cap ? 4 : 0), -45]);
    if (LABEL[s.slug] === "above45") cands.splice(0, cands.length, ["start", s.x + 4, s.y - 6 - (s.cap ? 4 : 0), -45]);
    const force = { e: 0, w: 1, n: 2, s: 3, ne: 4, se: 5, nw: 6, sw: 7 }[LABEL[s.slug]];
    if (force !== undefined) cands.splice(0, cands.length, [["start", s.x + g, s.y, 0], ["end", s.x - g, s.y, 0], ["middle", s.x, s.y - g - h / 2 + 1, 0], ["middle", s.x, s.y + g + h / 2 - 1, 0],
      ["start", s.x + g * 0.8, s.y - g * 0.9, 0], ["start", s.x + g * 0.8, s.y + g * 0.9, 0], ["end", s.x - g * 0.8, s.y - g * 0.9, 0], ["end", s.x - g * 0.8, s.y + g * 0.9, 0]][force]);
    let best = null;
    cands.forEach(([anchor, lx, ly, rot], k) => {
      let shapes;
      if (!rot) { const x0 = anchor === "start" ? lx : anchor === "end" ? lx - w : lx - w / 2; shapes = [[x0, ly - h / 2, x0 + w, ly + h / 2]]; }
      else { const sg = anchor === "start" ? 1 : -1, c = Math.SQRT1_2; shapes = []; for (let t = 0; t <= w; t += 6) { const cx = lx + sg * t * c, cy = ly - sg * t * c; shapes.push([cx - 4, cy - 4, cx + 4, cy + 4]); } }
      let sc = k * 2 + (rot && !horiz ? 40 : 0);
      for (const r of shapes) { sc += segHit(r) * (rot ? 18 : 30); for (const b of boxes) sc += ov(r, b) * 3; }
      if (!best || sc < best.sc) best = { sc, anchor, lx, ly, rot, shapes };
    });
    boxes.push(...best.shapes);
    s.label = { x: +best.lx.toFixed(1), y: +(best.ly + (best.rot ? 0 : h * 0.34)).toFixed(1), anchor: best.anchor, fs, rot: best.rot };
  }
  
  const notes = NOTES.map(n => ({ ...n, x: pos[n.at][0] * U, y: pos[n.at][1] * U }));
  // batas gambar
  const xs = [...st.map(s => s.x), ...boxes.map(b => b[0]), ...boxes.map(b => b[2])], ys = [...st.map(s => s.y), ...boxes.map(b => b[1]), ...boxes.map(b => b[3])];
  const pad = 30, vb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad];
  for (const s of st) if (ICONS[s.slug]) s.icon = ICONS[s.slug];
  const backdrop = {
    sea: { name: BACKDROP.sea.name, lx: BACKDROP.sea.label[0] * U, ly: BACKDROP.sea.label[1] * U, pts: BACKDROP.sea.pts.map(([x, y]) => [x * U, y * U]) },
    parks: BACKDROP.parks.map(p => ({ name: p.name, x: p.x * U, y: p.y * U, w: p.w * U, h: p.h * U })),
  };
  return { lines, stations: st, links, notes, backdrop, viewBox: vb.map(v => +v.toFixed(1)) };
}

// ---------------------------------------------------------------------------------------------
// Penyaji SVG (string) dari hasil buildRailDiagram. lineInfo(key) → { label, color, code }
const esc = v => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
export function renderRailDiagramSvg(m, lineInfo) {
  return `<svg class="rd-svg" viewBox="${m.viewBox.join(" ")}" role="img" aria-label="Peta jaringan kereta Jabodetabek">
<g class="rd-bg"><rect class="land" x="-4000" y="-4000" width="8000" height="8000"/><polygon class="sea" points="${m.backdrop.sea.pts.map(p => p.join(",")).join(" ")}"/><text class="sea-t" x="${m.backdrop.sea.lx}" y="${m.backdrop.sea.ly}">${m.backdrop.sea.name}</text>${m.backdrop.parks.map(p => `<rect class="park" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="16"/><text class="park-t" x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + 4}">${p.name}</text>`).join("")}</g>
<g class="rd-links">${m.links.map(pl => `<polyline points="${pl.map(p => p.join(",")).join(" ")}"/>`).join("")}</g>
<g class="rd-lines">${m.lines.map(l => `<a href="/kereta/${l.key}" class="rd-line" data-line="${l.key}"><title>${esc(lineInfo(l.key).label)}</title><path d="${l.d}" stroke="${l.color}"/></a>`).join("")}</g>
<g class="rd-st">${m.stations.map(s => {
  let mk;
  if (s.kind === "dot") mk = s.inter ? `<circle class="ring" cx="${s.x}" cy="${s.y}" r="5.6"/>` : `<circle cx="${+(s.x + (s.dx || 0)).toFixed(1)}" cy="${+(s.y + (s.dy || 0)).toFixed(1)}" r="3.4" stroke="${s.color}"/>`;
  else if (s.kind === "bundle") mk = `<line class="cap-o" x1="${s.cap.x1}" y1="${s.cap.y1}" x2="${s.cap.x2}" y2="${s.cap.y2}"/><line class="cap-i" x1="${s.cap.x1}" y1="${s.cap.y1}" x2="${s.cap.x2}" y2="${s.cap.y2}"/>` + s.dots.map(d => `<circle class="dt" cx="${d.x}" cy="${d.y}" r="2.2" style="fill:${d.color}"/>`).join("");
  else mk = `<line class="cap-o big" x1="${s.cap.x1}" y1="${s.cap.y1}" x2="${s.cap.x2}" y2="${s.cap.y2}"/><line class="cap-i big" x1="${s.cap.x1}" y1="${s.cap.y1}" x2="${s.cap.x2}" y2="${s.cap.y2}"/>` + s.chips.map(c => `<circle class="chip" cx="${c.x}" cy="${c.y}" r="6.4" stroke="${c.color}"/><text class="code" x="${c.x}" y="${c.y + 2.6}" fill="${c.color}">${c.code}</text>`).join("");
  return `<a href="/stasiun/${s.slug}" class="${s.inter ? "is-inter" : ""}"><title>${esc(s.name)}</title>${mk}${s.label ? `<text x="${s.label.x}" y="${s.label.y}" text-anchor="${s.label.anchor}" font-size="${s.label.fs}"${s.label.rot ? ` transform="rotate(${s.label.rot} ${s.label.x} ${s.label.y})" dominant-baseline="middle"` : ""}>${esc(s.name)}</text>` : ""}${s.icon && s.label ? (() => { const w = s.name.length * s.label.fs * 0.56; const ix = s.label.anchor === "start" ? s.label.x + w + 4 : s.label.anchor === "end" ? s.label.x + 4 : s.label.x + w / 2 + 4; return `<g class="rd-ico" transform="translate(${ix.toFixed(1)},${(s.label.y - 11).toFixed(1)}) scale(0.58)"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></g>`; })() : ""}</a>`;
}).join("")}</g>
<g class="rd-notes">${m.notes.map(n => `<a href="${n.href || "#"}"><title>${esc(n.text)}</title><g transform="translate(${n.x + 8},${n.y + 12})"><rect x="0" y="0" width="${n.text.length * 5.9 + 26}" height="17" rx="8.5"/><circle cx="8.5" cy="8.5" r="6" stroke="${n.color}"/><text x="8.5" y="11.6" class="c" fill="${n.color}">${n.code}</text><text x="18" y="12">${n.text}</text></g></a>`).join("")}</g>
</svg>`;
}
