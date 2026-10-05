// Utilitas peta statis Mapbox.
// Static Images API membatasi URL maks. 8.192 karakter. Jalur hasil Directions API
// bisa ribuan titik, jadi garis dikirim sebagai "encoded polyline" (jauh lebih ringkas
// daripada GeoJSON) dan disederhanakan bertahap sampai URL-nya muat.
// File GeoJSON sumber tidak diubah.

const MAX_URL = 8000; // sisakan ruang di bawah batas 8.192

// Ramer–Douglas–Peucker (iteratif), toleransi dalam derajat
export function simplify(coords, tol) {
  if (!tol || coords.length < 3) return coords;
  const keep = new Uint8Array(coords.length);
  keep[0] = keep[coords.length - 1] = 1;
  const stack = [[0, coords.length - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = coords[a], [bx, by] = coords[b];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let maxD = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = coords[i];
      let t = L ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > t2) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return coords.filter((_, i) => keep[i]);
}

// Google encoded polyline (presisi 5); input [lng, lat]
export function encodePolyline(coords) {
  let out = "", pLat = 0, pLng = 0;
  const enc = v => {
    v = v < 0 ? ~(v << 1) : v << 1;
    let s = "";
    while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
    return s + String.fromCharCode(v + 63);
  };
  for (const [lng, lat] of coords) {
    const la = Math.round(lat * 1e5), ln = Math.round(lng * 1e5);
    out += enc(la - pLat) + enc(ln - pLng);
    pLat = la; pLng = ln;
  }
  return out;
}

// URL peta statis untuk satu garis rute + penanda awal (hijau) & akhir (merah)
export function routeMapUrl(geometry, { color = "#D90429", token, width = 800, height = 360 } = {}) {
  const coords = geometry?.coordinates;
  if (!token || !coords || coords.length < 2) return null;
  const hex = String(color).replace("#", "").slice(0, 6) || "D90429";
  const [sLng, sLat] = coords[0], [eLng, eLat] = coords[coords.length - 1];
  const pins = `pin-s+16a34a(${sLng.toFixed(5)},${sLat.toFixed(5)}),pin-s+dc2626(${eLng.toFixed(5)},${eLat.toFixed(5)})`;
  const base = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/`;
  const tail = `/auto/${width}x${height}@2x?padding=40&access_token=${token}`;
  // ~0,5 m, 1 m, 2 m, 5 m, 10 m, 20 m, 50 m, 100 m
  for (const tol of [0, 0.000005, 0.00001, 0.00002, 0.00005, 0.0001, 0.0002, 0.0005, 0.001]) {
    const line = encodeURIComponent(encodePolyline(simplify(coords, tol)));
    const url = `${base}path-5+${hex}-0.9(${line}),${pins}${tail}`;
    if (url.length <= MAX_URL) return url;
  }
  return null;
}
