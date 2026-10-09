// Peta internal halte.id
//  tahap 2: cek rute A → B (langsung, 1× & 2× transit; bus + kereta) dan "salin jawaban"
//  tahap 3: mode gangguan (tandai halte/stasiun terganggu → rute terdampak, alternatif, dan cek A → B menghindarinya)
// Memakai variabel global dari app.js: N, map, ROUTE, STATION, $, esc, fold, distM, fmtM, routeBadge, sortIds, clearSel.
(() => {
  const WALK_END = { h: 600, s: 800 };      // jalan kaki maksimal dari asal/ke tujuan (m, garis lurus)
  const WALK_XFER = 300;                    // jalan kaki maksimal saat pindah (m)
  const MIN_PER_KM = { bus: 3, rail: 1.5 }; // ±20 km/jam bus, ±40 km/jam kereta (hanya untuk mengurutkan)
  const DWELL = 0.5;                        // menit per halte/stasiun yang dilewati
  const XFER_PENALTY = 8;                   // bobot tiap transit
  const walkMin = m => m * 1.2 / 70;        // garis lurus × 1,2, ±70 m/menit
  const TOP = 4;                            // simpan maksimal 4 layanan terbaik per simpul
  let SV = null, NODE_SV = null, GRID = null;
  let from = null, to = null, marks = [], options = [];

  // ---- gangguan (disimpan di browser ini saja)
  let blocked = new Set();
  try { blocked = new Set(JSON.parse(localStorage.getItem("peta-gangguan") || "[]")); } catch { /* abaikan */ }
  let cut = true;                           // true = rute dianggap terputus di titik gangguan
  const saveBlocked = () => { try { localStorage.setItem("peta-gangguan", JSON.stringify([...blocked])); } catch { /* abaikan */ } };

  // ---- simpul: "h:<halte>" atau "s:<stasiun>"
  const nc = n => n[0] === "h" ? N.stops[n.slice(2)]?.c : STATION.get(n.slice(2))?.c;
  const nn = n => n[0] === "h" ? (N.stops[n.slice(2)]?.n || n.slice(2)) : (STATION.get(n.slice(2))?.n || n.slice(2));
  const nLabel = n => n[0] === "h" ? `Halte ${nn(n)}` : nn(n);
  const keyOf = s => SV[s].kind + ":" + SV[s].key;
  function setup() {
    if (SV) return;
    SV = [];
    for (const r of N.routes) r.dirs.forEach((d, i) => SV.push({ kind: "bus", key: r.id, dir: i, title: d.title, nodes: d.stops.map(s => "h:" + s) }));
    for (const p of N.railServices) SV.push({ kind: "rail", key: p.key, code: p.code, color: p.color, label: p.label, title: p.name, nodes: p.stations.map(s => "s:" + s) });
    // jarak kumulatif sepanjang layanan (garis lurus antarhalte; halte tanpa koordinat dianggap 400 m)
    for (const sv of SV) { sv.cum = [0]; for (let k = 1; k < sv.nodes.length; k++) { const a = nc(sv.nodes[k - 1]), b = nc(sv.nodes[k]); sv.cum.push(sv.cum[k - 1] + (a && b ? distM(a, b) : 400)); } }
    NODE_SV = new Map();
    SV.forEach((s, si) => s.nodes.forEach((n, pos) => { if (!NODE_SV.has(n)) NODE_SV.set(n, []); NODE_SV.get(n).push([si, pos]); }));
    GRID = new Map();
    for (const n of NODE_SV.keys()) { const c = nc(n); if (!c) continue; const k = `${Math.floor(c[0] / 0.003)},${Math.floor(c[1] / 0.003)}`; if (!GRID.has(k)) GRID.set(k, []); GRID.get(k).push(n); }
  }
  function nearNodes(c, r) {
    const out = [], cx = Math.floor(c[0] / 0.003), cy = Math.floor(c[1] / 0.003), span = Math.ceil(r / 300) + 1;
    for (let x = cx - span; x <= cx + span; x++) for (let y = cy - span; y <= cy + span; y++) for (const n of GRID.get(`${x},${y}`) || []) { const d = distM(c, nc(n)); if (d <= r) out.push([n, d]); }
    return out;
  }
  const ok = n => !blocked.has(n);
  // titik asal/tujuan → simpul yang bisa dicapai dengan jalan kaki (titik gangguan tidak dipakai)
  function endNodes(e) {
    const m = new Map();
    if (e.node && NODE_SV.has(e.node) && ok(e.node)) m.set(e.node, 0);
    for (const [n, d] of nearNodes(e.c, WALK_END.s)) if (ok(n) && d <= WALK_END[n[0]] && !(m.get(n) <= d)) m.set(n, d);
    return m;
  }
  const ride = (s, i, j) => (SV[s].cum[j] - SV[s].cum[i]) / 1000 * MIN_PER_KM[SV[s].kind] + (j - i) * DWELL;
  // susuri layanan maju/mundur; berhenti di titik gangguan bila rute dianggap terputus, lewati bila tidak
  function fwd(s, i, cb) { const nodes = SV[s].nodes; for (let k = i + 1; k < nodes.length; k++) { if (!ok(nodes[k])) { if (cut) return; continue; } cb(k); } }
  function back(s, j, cb) { const nodes = SV[s].nodes; for (let m = j - 1; m >= 0; m--) { if (!ok(nodes[m])) { if (cut) return; continue; } cb(m); } }
  // simpan TOP entri termurah per simpul, satu entri per layanan (kunci rute)
  function keep(map, n, e) {
    const a = map.get(n) || [];
    const same = a.findIndex(x => x.key === e.key);
    if (same >= 0) { if (a[same].cost <= e.cost) return; a[same] = e; } else a.push(e);
    a.sort((x, y) => x.cost - y.cost); if (a.length > TOP) a.length = TOP; map.set(n, a);
  }

  const PREMIUM = new Set(["krl-bandara", "whoosh"]);
  let allowed = () => true;
  function plan() {
    setup();
    const ends = new Set([from.node, to.node].filter(Boolean));
    allowed = s => SV[s].kind !== "rail" || !PREMIUM.has(SV[s].key) || SV[s].nodes.some(n => ends.has(n));
    const O = endNodes(from), D = endNodes(to);
    // 0× transit
    const direct = new Map();
    for (const [o, wo] of O) for (const [s, i] of NODE_SV.get(o) || []) if (allowed(s)) fwd(s, i, j => {
      const wd = D.get(SV[s].nodes[j]); if (wd === undefined) return;
      const cost = walkMin(wo) + ride(s, i, j) + walkMin(wd), key = keyOf(s);
      if (!direct.has(key) || direct.get(key).cost > cost) direct.set(key, { n: 0, cost, legs: [{ s, i, j }], walks: [wo, wd] });
    });
    // F: setelah naik 1 layanan dari asal; B: 1 layanan terakhir menuju tujuan
    const F = new Map(), B = new Map();
    for (const [o, wo] of O) for (const [s, i] of NODE_SV.get(o) || []) if (allowed(s)) fwd(s, i, k => keep(F, SV[s].nodes[k], { key: keyOf(s), s, i, k, cost: walkMin(wo) + ride(s, i, k), w: wo }));
    for (const [d, wd] of D) for (const [s, j] of NODE_SV.get(d) || []) if (allowed(s)) back(s, j, m => keep(B, SV[s].nodes[m], { key: keyOf(s), s, m, j, cost: ride(s, m, j) + walkMin(wd), w: wd }));
    // perluas dengan jalan kaki pindah ≤ WALK_XFER: Fw[y] = turun di x lalu jalan ke y; Bw[x] = jalan dari x ke y lalu naik
    const Fw = new Map(), Bw = new Map();
    for (const [x, fl] of F) { const c = nc(x); if (!c) continue; for (const [y, dxy] of nearNodes(c, WALK_XFER)) if (ok(y)) for (const f of fl) keep(Fw, y, { ...f, x, dxy, cost: f.cost + walkMin(dxy) + XFER_PENALTY }); }
    for (const [y, bl] of B) { const c = nc(y); if (!c) continue; for (const [x, dxy] of nearNodes(c, WALK_XFER)) if (ok(x)) for (const b of bl) keep(Bw, x, { ...b, y, dxy, cost: b.cost + walkMin(dxy) + XFER_PENALTY }); }
    // 1× transit
    const one = new Map();
    for (const [y, fl] of Fw) {
      const bl = B.get(y); if (!bl) continue;
      for (const f of fl) for (const b of bl) {
        if (f.key === b.key || direct.has(f.key) || direct.has(b.key)) continue;
        const key = f.key + ">" + b.key, cost = f.cost + b.cost;
        if (!one.has(key) || one.get(key).cost > cost) one.set(key, { n: 1, cost, legs: [{ s: f.s, i: f.i, j: f.k }, { s: b.s, i: b.m, j: b.j }], walks: [f.w, f.dxy, b.w] });
      }
    }
    // 2× transit: Fw → layanan tengah → Bw. Untuk tiap layanan tengah cukup satu kali susur dengan "awalan terbaik".
    const two = new Map();
    const useful = k => !direct.has(k);
    SV.forEach((sv, s) => {
      if (!allowed(s)) return;
      const mk = keyOf(s), k0 = MIN_PER_KM[sv.kind];
      const pot = p => sv.cum[p] / 1000 * k0 + p * DWELL;      // ride(s, m, n) = pot(n) - pot(m)
      let pre = [];                                             // ≤ TOP awalan terbaik: { f, m, v = f.cost - pot(m) }
      sv.nodes.forEach((node, p) => {
        if (!ok(node)) { if (cut) pre = []; return; }
        // turun di p → lanjut layanan terakhir
        const bl = Bw.get(node);
        if (bl && pre.length) for (const a of pre) for (const b of bl) {
          if (a.f.key === mk || b.key === mk || a.f.key === b.key || !useful(a.f.key) || !useful(b.key) || !useful(mk)) continue;
          if (one.has(a.f.key + ">" + b.key) || one.has(a.f.key + ">" + mk) || one.has(mk + ">" + b.key)) continue;   // sudah ada versi 1× transit
          const key = `${a.f.key}>${mk}>${b.key}`, cost = a.v + pot(p) + b.cost;
          if (!two.has(key) || two.get(key).cost > cost) two.set(key, { n: 2, cost, legs: [{ s: a.f.s, i: a.f.i, j: a.f.k }, { s, i: a.m, j: p }, { s: b.s, i: b.m, j: b.j }], walks: [a.f.w, a.f.dxy, b.dxy, b.w] });
        }
        // naik di p (setelah layanan pertama)
        const fl = Fw.get(node);
        if (fl) for (const f of fl) {
          if (f.key === mk) continue;
          const v = f.cost - pot(p), same = pre.findIndex(x => x.f.key === f.key);
          if (same >= 0) { if (pre[same].v > v) pre[same] = { f, m: p, v }; } else pre.push({ f, m: p, v });
          pre.sort((x, y) => x.v - y.v); if (pre.length > TOP) pre.length = TOP;
        }
      });
    });
    const sortC = m => [...m.values()].sort((a, b) => a.cost - b.cost);
    const d = sortC(direct).slice(0, 6), t1 = sortC(one), t2 = sortC(two);
    const best = Math.min(d[0]?.cost ?? Infinity, t1[0]?.cost ?? Infinity);
    const o1 = t1.filter(o => o.cost < (d[0]?.cost ?? Infinity) + 25).slice(0, d.length ? 4 : 6);
    const o2 = t2.filter(o => o.cost < best + (o1.length >= 2 || d.length ? 5 : 15)).slice(0, d.length || o1.length >= 3 ? 3 : 6);
    return [...d, ...o1, ...o2];
  }

  // ---- tampilan pilihan
  const legBadge = l => { const s = SV[l.s]; return s.kind === "bus" ? routeBadge(s.key) : `<span class="lc" style="border-color:${s.color};color:${s.color}">${esc(s.code)}</span>`; };
  const legName = l => { const s = SV[l.s]; return s.kind === "bus" ? `${ROUTE.get(s.key)?.label} (${ROUTE.get(s.key)?.name})` : `${s.key.startsWith("krl") && s.label.startsWith("Lin") ? "KRL " : ""}${s.label} (${s.code})`; };
  const unit = l => SV[l.s].kind === "bus" ? "halte" : "stasiun";
  const boardOf = l => SV[l.s].nodes[l.i], alightOf = l => SV[l.s].nodes[l.j];
  const TAG = ["langsung", "1× transit", "2× transit"];
  function optHtml(o, idx) {
    const L = o.legs, W = o.walks;
    const walk = (m, where) => m > 30 ? `<div class="w">jalan ±${fmtM(m)} ${where}</div>` : "";
    let h = `<li class="opt" data-opt="${idx}"><div class="oh">${L.map(legBadge).join(" → ")} <span class="tg">${TAG[o.n]}</span></div>`;
    h += walk(W[0], `ke ${esc(nLabel(boardOf(L[0])))}`);
    L.forEach((l, k) => {
      h += `<div class="lg">${legBadge(l)} naik di <b>${esc(nLabel(boardOf(l)))}</b>, turun di <b>${esc(nLabel(alightOf(l)))}</b> <span class="sub">(${l.j - l.i} ${unit(l)} · ±${fmtM(SV[l.s].cum[l.j] - SV[l.s].cum[l.i])}${SV[l.s].kind === "bus" ? ` · ${esc(SV[l.s].title)}` : ""})</span></div>`;
      if (k < L.length - 1) h += walk(W[k + 1], `ke ${esc(nLabel(boardOf(L[k + 1])))}`);
    });
    h += walk(W[W.length - 1], `ke ${esc(to.name)}`);
    return h + `<div class="acts"><button class="mini" data-show="${idx}">Lihat di peta</button><button class="mini" data-copy="${idx}">Salin jawaban</button></div></li>`;
  }
  const linkFor = l => SV[l.s].kind === "bus" ? `halte.id/rute/${ROUTE.get(SV[l.s].key)?.slug}` : `halte.id/stasiun/${boardOf(l).slice(2)}`;
  function answer(o) {
    const L = o.legs, W = o.walks;
    const atStart = boardOf(L[0]) === from.node;                 // asal = tempat naik: tak perlu disebut dua kali
    const legTxt = (l, named) => `naik ${legName(l)}${named ? "" : ` dari ${nLabel(boardOf(l))}`}, turun di ${nLabel(alightOf(l))}`;
    let t = atStart ? `Dari ${nLabel(from.node)} ${o.n ? "" : "bisa "}` : `Dari ${from.name}${W[0] > 30 ? `, jalan ±${fmtM(W[0])} ke ${nLabel(boardOf(L[0]))} lalu` : ""} `;
    t += legTxt(L[0], atStart || W[0] > 30) + ".";
    for (let k = 1; k < L.length; k++) {
      const wk = W[k] > 30;
      t += ` ${k === 1 ? "Setelah itu" : "Terakhir,"} ${wk ? `jalan ±${fmtM(W[k])} ke ${nLabel(boardOf(L[k]))} dan ` : ""}lanjut ${legTxt(L[k], wk)}.`;
    }
    if (W[W.length - 1] > 30) t += ` Dari situ jalan ±${fmtM(W[W.length - 1])} ke ${to.name}.`;
    return `${t}\n\nDetail: ${[...new Set(L.map(linkFor))].join(" · ")}`;
  }
  function clearMarks() { marks.forEach(m => m.remove()); marks = []; }
  function showOpt(o) {
    clearSel(); clearMarks();
    const rids = o.legs.filter(l => SV[l.s].kind === "bus").map(l => SV[l.s].key);
    if (rids.length) { map.setFilter("routes-hl", ["in", ["get", "rid"], ["literal", rids]]); map.setPaintProperty("routes", "line-opacity", 0.15); }
    const pts = [from.c, to.c];
    const add = (c, color) => { if (!c) return; marks.push(new mapboxgl.Marker({ color, scale: 0.75 }).setLngLat(c).addTo(map)); pts.push(c); };
    add(from.c, "#18885a"); add(to.c, "#c8372d");
    o.legs.forEach(l => { add(nc(boardOf(l)), "#2652d9"); add(nc(alightOf(l)), "#2652d9"); });
    const b = new mapboxgl.LngLatBounds(pts[0], pts[0]); pts.forEach(p => p && b.extend(p)); map.fitBounds(b, { padding: 70, duration: 600 });
  }
  function run() {
    if (!from || !to) { $("#pl-msg").textContent = "Isi asal dan tujuan dulu."; return; }
    $("#pl-msg").textContent = "";
    const t0 = performance.now();
    options = plan();
    const ms = Math.round(performance.now() - t0);
    const avoid = blocked.size ? ` · menghindari ${blocked.size} titik gangguan` : "";
    $("#panel").innerHTML = `<h2>${esc(from.name)} → ${esc(to.name)}</h2><div class="sub">jarak garis lurus ${fmtM(distM(from.c, to.c))} · ${options.length} pilihan · ${ms} ms${avoid}</div>` +
      (options.length ? `<ol class="opts">${options.map(optHtml).join("")}</ol>` : `<p>Tidak ada pilihan sampai 2× transit dalam batas jalan kaki ${WALK_END.h} m.</p>`) +
      `<div class="links"><a href="https://www.google.com/maps/dir/?api=1&origin=${from.c[1]},${from.c[0]}&destination=${to.c[1]},${to.c[0]}&travelmode=transit" target="_blank">Bandingkan di Google Maps ↗</a></div>` +
      `<p class="sub">Urutan berdasarkan perkiraan kasar (jarak tempuh, jumlah halte, jalan kaki, transit), bukan jadwal atau lalu lintas. Selalu cek gangguan di akun resmi sebelum menjawab.</p>`;
    if (options[0]) showOpt(options[0]);
  }

  // ---- mode gangguan
  function affected() {
    setup();
    const out = [];
    for (const n of blocked) {
      const rids = new Set((NODE_SV.get(n) || []).map(([s]) => keyOf(s)));
      // alternatif: layanan di simpul ≤ 300 m yang tidak lewat titik gangguan mana pun
      const alt = new Map();
      const c = nc(n);
      if (c) for (const [y, d] of nearNodes(c, WALK_XFER)) if (ok(y)) for (const [s] of NODE_SV.get(y) || []) {
        const k = keyOf(s); if (rids.has(k) || SV[s].nodes.some(z => blocked.has(z))) continue;
        if (!alt.has(k) || alt.get(k).d > d) alt.set(k, { s, y, d });
      }
      out.push({ n, rids: [...rids], alt: [...alt.values()].sort((a, b) => a.d - b.d) });
    }
    return out;
  }
  const keyBadge = k => { const [kind, id] = [k.slice(0, k.indexOf(":")), k.slice(k.indexOf(":") + 1)]; if (kind === "bus") return routeBadge(id); const sv = SV.find(x => x.kind === "rail" && x.key === id); return `<span class="lc" style="border-color:${sv.color};color:${sv.color}">${esc(sv.code)}</span>`; };
  function showAffected() {
    clearSel(); clearMarks();
    const list = affected();
    const rids = [...new Set(list.flatMap(a => a.rids).filter(k => k.startsWith("bus:")).map(k => k.slice(4)))];
    if (rids.length) { map.setFilter("routes-hl", ["in", ["get", "rid"], ["literal", rids]]); map.setPaintProperty("routes", "line-opacity", 0.15); }
    const pts = list.map(a => nc(a.n)).filter(Boolean);
    if (pts.length) { const b = new mapboxgl.LngLatBounds(pts[0], pts[0]); pts.forEach(p => b.extend(p)); map.fitBounds(b, { padding: 120, maxZoom: 15, duration: 600 }); }
    $("#panel").innerHTML = `<h2>Rute terdampak gangguan</h2><div class="sub">${blocked.size} titik · ${new Set(list.flatMap(a => a.rids)).size} layanan terdampak${cut ? " · rute dianggap terputus di titik gangguan" : " · bus dianggap tetap lewat, tidak berhenti"}</div>` +
      list.map(a => `<div class="gg-card"><b>${esc(nLabel(a.n))}</b> <button class="mini" data-block="${esc(a.n)}">Hapus</button>
        <h3>Terdampak (${a.rids.length})</h3><div class="badges">${a.rids.map(keyBadge).join("") || `<span class="sub">tidak ada</span>`}</div>
        <h3>Alternatif ≤ ${WALK_XFER} m</h3>${a.alt.length ? `<ul class="near">${a.alt.slice(0, 12).map(x => `<li>${keyBadge(keyOf(x.s))} <span class="nm" data-stop="${x.y[0] === "h" ? esc(x.y.slice(2)) : ""}">${esc(nLabel(x.y))}</span><span class="d">${fmtM(x.d)}</span></li>`).join("")}</ul>` : `<p class="sub">Tidak ada layanan lain dalam ${WALK_XFER} m.</p>`}</div>`).join("") +
      `<p class="sub">Untuk mencari jalan memutar dari A ke B, isi "Cek rute A → B": pencarian otomatis menghindari titik gangguan.</p>`;
  }
  function renderBlocked() {
    const box = $("#gangguan");
    box.hidden = !blocked.size;
    $("#gg-list").innerHTML = [...blocked].map(n => `<li>${esc(nLabel(n))} <button class="mini" data-block="${esc(n)}">×</button></li>`).join("");
    if (map.getLayer("blocked-stops")) {
      map.setFilter("blocked-stops", ["in", ["get", "id"], ["literal", [...blocked].filter(n => n[0] === "h").map(n => n.slice(2))]]);
      map.setFilter("blocked-stations", ["in", ["get", "slug"], ["literal", [...blocked].filter(n => n[0] === "s").map(n => n.slice(2))]]);
    }
    document.querySelectorAll("#panel [data-block]").forEach(b => { if (b.dataset.toggle) b.textContent = blocked.has(b.dataset.block) ? "Hapus tanda gangguan" : "Tandai gangguan"; });
  }
  function toggleBlock(n) {
    blocked.has(n) ? blocked.delete(n) : blocked.add(n);
    saveBlocked(); renderBlocked();
    if (from && to && $("#panel .opts")) run();
  }
  function addBlockedLayers() {
    if (map.getLayer("blocked-stops")) return;
    const paint = { "circle-radius": 9, "circle-color": "#c8372d", "circle-opacity": 0.85, "circle-stroke-color": "#fff", "circle-stroke-width": 2 };
    map.addLayer({ id: "blocked-stops", type: "circle", source: "stops", filter: ["in", ["get", "id"], ["literal", []]], paint });
    map.addLayer({ id: "blocked-stations", type: "circle", source: "stations", filter: ["in", ["get", "slug"], ["literal", []]], paint: { ...paint, "circle-radius": 11 } });
    renderBlocked();
  }

  // ---- input asal/tujuan (halte, stasiun, tempat)
  function endpointsSearch(q) {
    const f = fold(q.trim()); if (!f) return [];
    const out = [];
    const sc = n => { n = fold(n); return n.startsWith(f) ? 1 : n.includes(f) ? 2 : -1; };
    const fs = f.replace(/^(stasiun|st\.?) (lrt |mrt )?/, "");          // "stasiun manggarai" → "manggarai"
    const scS = n => { n = fold(n); return n.startsWith(fs) ? 1 : n.includes(fs) ? 2 : -1; };
    for (const s of N.stations) { const v = scS(s.n.replace(/^Stasiun (LRT |MRT )?/, "")); if (v >= 0) out.push({ v: v + (s.open ? 0 : 0.6), e: { node: "s:" + s.slug, name: s.n, c: s.c, k: s.open ? "stasiun" : "stasiun · belum beroperasi" } }); }
    for (const [id, s] of Object.entries(N.stops)) { if (!s.c) continue; const v = sc(s.n); if (v >= 0) out.push({ v: v + 0.3, e: { node: "h:" + id, name: s.n, c: s.c, k: "halte" } }); }
    for (const p of N.places) { const v = Math.min(...[p.n, ...p.a].map(sc).filter(x => x >= 0), 9); if (v < 9) out.push({ v: v + 0.2, e: { name: p.n, c: p.c, k: "tempat" } }); }
    return out.sort((a, b) => a.v - b.v).slice(0, 12).map(x => x.e);
  }
  function wireInput(input, list, set) {
    let res = [];
    input.addEventListener("input", () => {
      res = endpointsSearch(input.value);
      list.innerHTML = res.map((e, i) => `<li data-i="${i}">${esc(e.name)}<small>${e.k}</small></li>`).join("");
      list.hidden = !res.length;
    });
    input.addEventListener("keydown", e => { if (e.key === "Enter" && res[0]) { set(res[0]); list.hidden = true; } if (e.key === "Escape") list.hidden = true; });
    list.addEventListener("click", e => { const li = e.target.closest("li[data-i]"); if (li) { set(res[+li.dataset.i]); list.hidden = true; } });
    document.addEventListener("click", e => { if (!list.contains(e.target) && e.target !== input) list.hidden = true; });
  }
  const setFrom = e => { from = e; $("#pl-from").value = e.name; if (to) run(); };
  const setTo = e => { to = e; $("#pl-to").value = e.name; if (from) run(); };
  const fromNode = n => ({ node: n, name: nn(n), c: nc(n) });

  const ready = setInterval(() => {
    if (typeof N === "undefined" || !N || !map) return;
    clearInterval(ready);
    wireInput($("#pl-from"), $("#pl-from-list"), setFrom);
    wireInput($("#pl-to"), $("#pl-to-list"), setTo);
    $("#pl-go").addEventListener("click", run);
    $("#pl-swap").addEventListener("click", () => { [from, to] = [to, from]; $("#pl-from").value = from?.name || ""; $("#pl-to").value = to?.name || ""; if (from && to) run(); });
    $("#gg-cut").checked = cut;
    $("#gg-cut").addEventListener("change", e => { cut = e.target.checked; if (from && to && $("#panel .opts")) run(); });
    $("#gg-show").addEventListener("click", showAffected);
    $("#gg-clear").addEventListener("click", () => { blocked.clear(); saveBlocked(); renderBlocked(); clearSel(); });
    $("#gg-list").addEventListener("click", e => { const b = e.target.closest("[data-block]"); if (b) toggleBlock(b.dataset.block); });
    $("#panel").addEventListener("click", e => {
      const t = e.target.closest("[data-from],[data-to],[data-show],[data-copy],[data-block]"); if (!t) return;
      if (t.dataset.block) { toggleBlock(t.dataset.block); if (!t.dataset.toggle && $("#panel .gg-card")) showAffected(); return; }
      if (t.dataset.from) return setFrom(fromNode(t.dataset.from));
      if (t.dataset.to) return setTo(fromNode(t.dataset.to));
      const o = options[+(t.dataset.show ?? t.dataset.copy)]; if (!o) return;
      if (t.dataset.show !== undefined) return showOpt(o);
      const txt = answer(o);
      navigator.clipboard.writeText(txt).then(() => { t.textContent = "Tersalin ✓"; setTimeout(() => (t.textContent = "Salin jawaban"), 1500); }, () => prompt("Salin teks ini:", txt));
    });
    // tombol "Tandai gangguan" di panel halte/stasiun diberi label sesuai status
    new MutationObserver(() => renderBlocked()).observe($("#panel"), { childList: true });
    const wait = setInterval(() => { if (map.getSource("stops") && map.getSource("stations")) { clearInterval(wait); addBlockedLayers(); } }, 200);
    renderBlocked();
  }, 100);
})();
