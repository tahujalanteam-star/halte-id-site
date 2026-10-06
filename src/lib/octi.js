// Garis dekoratif gaya peta transit resmi (MRT Singapura, peta integrasi Jakarta):
// hanya segmen horizontal, vertikal, dan diagonal 45°, dengan tikungan membulat.
// points: [[x, y], ...] — tiap segmen harus lurus/diagonal 45°; r = jari-jari tikungan.
export function octiPath(points, r = 14) {
  if (points.length < 2) return "";
  const f = n => +n.toFixed(2);
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1], [cx, cy] = points[i], [nx, ny] = points[i + 1];
    const l1 = Math.hypot(cx - px, cy - py), l2 = Math.hypot(nx - cx, ny - cy);
    const k = Math.min(r, l1 / 2, l2 / 2);
    const ax = cx - ((cx - px) / l1) * k, ay = cy - ((cy - py) / l1) * k;
    const bx = cx + ((nx - cx) / l2) * k, by = cy + ((ny - cy) / l2) * k;
    d += ` L${f(ax)} ${f(ay)} Q${f(cx)} ${f(cy)} ${f(bx)} ${f(by)}`;
  }
  const [lx, ly] = points[points.length - 1];
  return d + ` L${f(lx)} ${f(ly)}`;
}
