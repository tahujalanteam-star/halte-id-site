// Peta internal halte.id — tahap 1: jaringan rute, halte, stasiun; klik untuk detail; cari.
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fold = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const onColor = hex => { const c = (hex || "#334155").replace("#", ""); const [r, g, b] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? "#161e2b" : "#fff"; };
const SITE = "https://halte.id";
const distM = (a, b) => { const k = Math.PI / 180, x = (b[0] - a[0]) * k * Math.cos((a[1] + b[1]) / 2 * k), y = (b[1] - a[1]) * k; return Math.hypot(x, y) * 6371000; };
const fmtM = m => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;

let N, map, marker = null, selRoute = null;
const ROUTE = new Map(), STATION = new Map(), hidden = new Set();
const routeBadge = id => { const r = ROUTE.get(id); if (!r) return `<span class="rb" style="background:#ccc">${esc(id)}</span>`; return `<button class="rb" data-route="${esc(r.id)}" title="${esc(r.name)}" style="background:${r.color};color:${onColor(r.color)}">${esc(r.label)}</button>`; };
const lineChip = l => `<span class="lc" style="border-color:${l.color};color:${l.color}" title="${esc(l.label)}">${esc(l.code)}</span>`;
const sortIds = ids => [...ids].sort((a, b) => String(a).localeCompare(String(b), "id", { numeric: true }));

fetch("/api/network.json").then(r => r.json()).then(init).catch(e => { $("#panel").innerHTML = `<p>Gagal memuat data: ${esc(e.message)}</p>`; });

function init(n) {
  N = n;
  n.routes.forEach(r => ROUTE.set(r.id, r));
  n.stations.forEach(s => STATION.set(s.slug, s));
  const count = k => n.routes.filter(r => r.cat === k).length;
  $("#cats").innerHTML = n.cats.filter(c => count(c.key)).map(c => `<label><input type="checkbox" data-cat="${c.key}" checked /> ${esc(c.label)} <small>${count(c.key)}</small></label>`).join("");
  $("#meta").textContent = `${n.routes.length} rute · ${Object.keys(n.stops).length} halte · ${n.stations.length} stasiun · data ${new Date(n.builtAt).toLocaleString("id-ID")}`;
  if (!window.MAPBOX_TOKEN) $("#panel").insertAdjacentHTML("afterbegin", `<p><b>Token Mapbox kosong.</b> Isi PUBLIC_MAPBOX_TOKEN di .env lalu jalankan ulang.</p>`);
  mapboxgl.accessToken = window.MAPBOX_TOKEN;
  map = new mapboxgl.Map({ container: "map", style: "mapbox://styles/mapbox/light-v11", center: [106.8456, -6.2088], zoom: 11.2, attributionControl: true });
  map.addControl(new mapboxgl.NavigationControl(), "top-right");
  map.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-right");
  map.on("load", addLayers);
  wireUi();
}

function fc(features) { return { type: "FeatureCollection", features }; }
function addLayers() {
  const routeF = [];
  for (const r of N.routes) r.dirs.forEach((d, i) => { if (d.line.length > 1) routeF.push({ type: "Feature", properties: { rid: r.id, cat: r.cat, color: r.color, dir: i }, geometry: { type: "LineString", coordinates: d.line } }); });
  const railF = N.rail.map(w => ({ type: "Feature", properties: { color: w.color, code: w.code }, geometry: { type: "LineString", coordinates: w.g } }));
  const stopF = Object.entries(N.stops).filter(([, s]) => s.c).map(([id, s]) => ({ type: "Feature", properties: { id, n: s.n, brt: s.t === "brt" ? 1 : 0 }, geometry: { type: "Point", coordinates: s.c } }));
  const stF = N.stations.map(s => ({ type: "Feature", properties: { slug: s.slug, n: s.n, color: s.lines[0]?.color || "#6b7381", open: s.open ? 1 : 0 }, geometry: { type: "Point", coordinates: s.c } }));
  map.addSource("routes", { type: "geojson", data: fc(routeF) });
  map.addSource("rail", { type: "geojson", data: fc(railF) });
  map.addSource("stops", { type: "geojson", data: fc(stopF) });
  map.addSource("stations", { type: "geojson", data: fc(stF) });
  const w = (a, b) => ["interpolate", ["linear"], ["zoom"], 10, a, 16, b];
  map.addLayer({ id: "rail", type: "line", source: "rail", paint: { "line-color": ["get", "color"], "line-width": w(2, 4), "line-opacity": 0.9 }, layout: { "line-cap": "round", "line-join": "round" } });
  map.addLayer({ id: "routes", type: "line", source: "routes", paint: { "line-color": ["get", "color"], "line-width": w(1.2, 3.2), "line-opacity": 0.55 }, layout: { "line-cap": "round", "line-join": "round" } });
  map.addLayer({ id: "routes-hl", type: "line", source: "routes", filter: ["==", ["get", "rid"], ""], paint: { "line-color": ["get", "color"], "line-width": w(4, 7), "line-opacity": 1 }, layout: { "line-cap": "round", "line-join": "round" } });
  map.addLayer({ id: "stops", type: "circle", source: "stops", minzoom: 11.5, paint: { "circle-radius": w(2, 5.5), "circle-color": ["case", ["==", ["get", "brt"], 1], "#2652d9", "#6b7381"], "circle-stroke-color": "#fff", "circle-stroke-width": 1 } });
  map.addLayer({ id: "stops-hl", type: "circle", source: "stops", filter: ["in", ["get", "id"], ["literal", []]], paint: { "circle-radius": w(3.5, 7), "circle-color": "#fff", "circle-stroke-color": "#161e2b", "circle-stroke-width": 2 } });
  map.addLayer({ id: "stations", type: "circle", source: "stations", paint: { "circle-radius": w(4, 8), "circle-color": "#fff", "circle-stroke-color": ["get", "color"], "circle-stroke-width": w(2, 3.5), "circle-opacity": ["case", ["==", ["get", "open"], 1], 1, 0.5] } });
  map.addLayer({ id: "station-labels", type: "symbol", source: "stations", minzoom: 12.5, layout: { "text-field": ["get", "n"], "text-size": 12, "text-offset": [0, 1.2], "text-anchor": "top", "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"] }, paint: { "text-color": "#161e2b", "text-halo-color": "#fff", "text-halo-width": 1.5 } });
  map.addLayer({ id: "stop-labels", type: "symbol", source: "stops", minzoom: 15, layout: { "text-field": ["get", "n"], "text-size": 11, "text-offset": [0, 1], "text-anchor": "top", "text-font": ["DIN Pro Regular", "Arial Unicode MS Regular"] }, paint: { "text-color": "#3a4252", "text-halo-color": "#fff", "text-halo-width": 1.3 } });

  const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });
  const near = (p, layers, r = 5) => map.queryRenderedFeatures([[p.x - r, p.y - r], [p.x + r, p.y + r]], { layers });
  map.on("mousemove", e => {
    const pts = near(e.point, ["stations", "stops"]);
    if (pts.length) { map.getCanvas().style.cursor = "pointer"; popup.setLngLat(e.lngLat).setHTML(esc(pts[0].properties.n)).addTo(map); return; }
    const ids = [...new Set(near(e.point, ["routes", "routes-hl"], 4).map(f => f.properties.rid))];
    map.getCanvas().style.cursor = ids.length ? "pointer" : "";
    if (ids.length) popup.setLngLat(e.lngLat).setHTML(sortIds(ids).slice(0, 12).map(id => esc(ROUTE.get(id)?.label || id)).join(" · ") + (ids.length > 12 ? " …" : "")).addTo(map);
    else popup.remove();
  });
  map.on("click", e => {
    const st = near(e.point, ["stations"]); if (st.length) return showStation(st[0].properties.slug);
    const sp = near(e.point, ["stops"]); if (sp.length) return showStop(sp[0].properties.id);
    const ids = sortIds(new Set(near(e.point, ["routes", "routes-hl"], 4).map(f => f.properties.rid)));
    if (ids.length === 1) return showRoute(ids[0]);
    if (ids.length > 1) {
      $("#panel").innerHTML = `<h2>${ids.length} rute di titik ini</h2><p class="sub">Pilih salah satu.</p><ul class="pick">${ids.map(id => `<li data-route="${esc(id)}">${routeBadge(id)} <span>${esc(ROUTE.get(id)?.name)}</span></li>`).join("")}</ul>`;
    }
  });
  applyFilters();
}

function applyFilters() {
  if (!map?.getLayer("routes")) return;
  const f = hidden.size ? ["!", ["in", ["get", "cat"], ["literal", [...hidden]]]] : null;
  map.setFilter("routes", f);
  const vis = (ids, on) => ids.forEach(id => map.setLayoutProperty(id, "visibility", on ? "visible" : "none"));
  vis(["stops", "stop-labels"], $("#f-stops").checked);
  vis(["rail", "stations", "station-labels"], $("#f-rail").checked);
}

function clearSel() {
  selRoute = null;
  if (marker) { marker.remove(); marker = null; }
  if (!map?.getLayer("routes-hl")) return;
  map.setFilter("routes-hl", ["==", ["get", "rid"], ""]);
  map.setFilter("stops-hl", ["in", ["get", "id"], ["literal", []]]);
  map.setPaintProperty("routes", "line-opacity", 0.55);
}
function pin(c) { if (marker) marker.remove(); marker = new mapboxgl.Marker({ color: "#2652d9" }).setLngLat(c).addTo(map); }

function showRoute(id) {
  const r = ROUTE.get(id); if (!r) return;
  clearSel(); selRoute = id;
  map.setFilter("routes-hl", ["==", ["get", "rid"], id]);
  map.setPaintProperty("routes", "line-opacity", 0.15);
  const ids = [...new Set(r.dirs.flatMap(d => d.stops))];
  map.setFilter("stops-hl", ["in", ["get", "id"], ["literal", ids]]);
  const pts = r.dirs.flatMap(d => d.line.length ? d.line : d.stops.map(s => N.stops[s]?.c).filter(Boolean));
  if (pts.length) { const b = new mapboxgl.LngLatBounds(pts[0], pts[0]); pts.forEach(p => b.extend(p)); map.fitBounds(b, { padding: 60, duration: 600 }); }
  const cat = N.cats.find(c => c.key === r.cat)?.label || "";
  $("#panel").innerHTML = `<div class="badges">${routeBadge(id)}</div><h2>${esc(r.name)}</h2><div class="sub">${esc(cat)} · ${ids.length} halte</div>
    <div class="links"><a href="${SITE}/rute/${esc(r.slug)}" target="_blank">Buka di halte.id ↗</a></div>
    ${r.dirs.map(d => `<div class="dir"><b>${esc(d.title)}</b>${d.line.length ? "" : `<span class="sub">(belum ada geometri)</span>`}<ol class="seq">${d.stops.map(s => `<li data-stop="${esc(s)}">${esc(N.stops[s]?.n || s)} ${N.stops[s]?.r?.length > 1 ? `<span class="x">+${N.stops[s].r.length - 1} rute</span>` : ""}</li>`).join("")}</ol></div>`).join("")}
    <button class="clear">Hapus sorotan</button>`;
}

function nearbyStops(c, radius, exclude) {
  return Object.entries(N.stops).filter(([id, s]) => s.c && id !== exclude).map(([id, s]) => ({ id, s, d: distM(c, s.c) })).filter(x => x.d <= radius).sort((a, b) => a.d - b.d);
}
function nearbyStations(c, radius) {
  return N.stations.map(s => ({ s, d: distM(c, s.c) })).filter(x => x.d <= radius).sort((a, b) => a.d - b.d);
}
const stopRow = x => `<li><span class="nm" data-stop="${esc(x.id)}">${esc(x.s.n)}</span><span class="d">${fmtM(x.d)}</span><div class="badges">${sortIds(x.s.r).map(routeBadge).join("")}</div></li>`;

function showStop(id) {
  const s = N.stops[id]; if (!s) return;
  clearSel();
  if (s.c) { pin(s.c); if (map.getZoom() < 15) map.flyTo({ center: s.c, zoom: 15.5 }); }
  const stn = s.c ? nearbyStations(s.c, 400) : [];
  const ns = s.c ? nearbyStops(s.c, 300, id).slice(0, 10) : [];
  $("#panel").innerHTML = `<h2>${esc(s.n)}</h2><div class="sub">${s.t === "brt" ? "Halte BRT" : "Halte non-BRT"}${s.c ? "" : " · koordinat belum ada"}</div>
    <div class="links"><button class="mini" data-from="h:${esc(id)}">Jadikan asal</button><button class="mini" data-to="h:${esc(id)}">Jadikan tujuan</button><button class="mini warn" data-block="h:${esc(id)}" data-toggle="1">Tandai gangguan</button><a href="${SITE}/halte/${esc(id)}" target="_blank">Buka di halte.id ↗</a>${s.c ? `<a href="https://www.google.com/maps/search/?api=1&query=${s.c[1]},${s.c[0]}" target="_blank">Google Maps ↗</a>` : ""}</div>
    <h3>${s.r.length} rute berhenti di sini</h3><div class="badges">${sortIds(s.r).map(routeBadge).join("") || `<span class="sub">Belum ada rute tercatat.</span>`}</div>
    ${stn.length ? `<h3>Stasiun ≤ 400 m</h3><ul class="near">${stn.map(x => `<li><span class="nm" data-station="${esc(x.s.slug)}">${esc(x.s.n)}</span><span class="d">${fmtM(x.d)}</span> ${x.s.lines.map(lineChip).join(" ")}</li>`).join("")}</ul>` : ""}
    ${ns.length ? `<h3>Halte lain ≤ 300 m</h3><ul class="near">${ns.map(stopRow).join("")}</ul>` : ""}`;
}

function showStation(slug) {
  const s = STATION.get(slug); if (!s) return;
  clearSel(); pin(s.c);
  if (map.getZoom() < 15) map.flyTo({ center: s.c, zoom: 15.5 });
  const ns = nearbyStops(s.c, 500).slice(0, 14);
  $("#panel").innerHTML = `<h2>${esc(s.n)}</h2><div class="sub">${s.open ? "Stasiun" : "Stasiun (belum/tidak beroperasi)"}</div>
    <div class="badges" style="margin-top:6px">${s.lines.map(l => `${lineChip(l)} <span class="sub">${esc(l.label)}</span>`).join("&nbsp; ")}</div>
    <div class="links"><button class="mini" data-from="s:${esc(slug)}">Jadikan asal</button><button class="mini" data-to="s:${esc(slug)}">Jadikan tujuan</button><button class="mini warn" data-block="s:${esc(slug)}" data-toggle="1">Tandai gangguan</button><a href="${SITE}/stasiun/${esc(slug)}" target="_blank">Buka di halte.id ↗</a></div>
    <h3>Halte ≤ 500 m</h3>${ns.length ? `<ul class="near">${ns.map(stopRow).join("")}</ul>` : `<p class="sub">Tidak ada halte dalam 500 m.</p>`}`;
}

// ---- cari
function search(q) {
  const f = fold(q.trim()); if (!f) return [];
  const out = [];
  for (const r of N.routes) {
    const lab = fold(r.label), idf = fold(r.id);
    const sc = lab === f || idf === f ? 0 : lab.startsWith(f) || idf.startsWith(f) ? 1 : fold(r.name).includes(f) ? 4 : -1;
    if (sc >= 0) out.push({ sc, kind: "r", id: r.id, html: `${routeBadge(r.id)} <span>${esc(r.name)}</span><small>rute</small>` });
  }
  const fs = f.replace(/^(stasiun|st\.?) (lrt |mrt )?/, "");
  for (const s of N.stations) { const n = fold(s.n).replace(/^stasiun (lrt |mrt )?/, ""); const sc = n.startsWith(fs) ? 2 : n.includes(fs) ? 3 : -1; if (sc >= 0) out.push({ sc, kind: "s", id: s.slug, html: `${s.lines.slice(0, 3).map(lineChip).join("")} <span>${esc(s.n)}</span><small>stasiun</small>` }); }
  for (const [id, s] of Object.entries(N.stops)) { const n = fold(s.n); const sc = n.startsWith(f) ? 2 : n.includes(f) ? 3 : -1; if (sc >= 0) out.push({ sc: sc + 0.5, kind: "h", id, html: `<span>${esc(s.n)}</span><small>${s.r.length} rute · halte</small>` }); }
  return out.sort((a, b) => a.sc - b.sc).slice(0, 25);
}
function wireUi() {
  const q = $("#q"), list = $("#results");
  let res = [], act = 0;
  const pick = it => { list.hidden = true; q.blur(); it.kind === "r" ? showRoute(it.id) : it.kind === "s" ? showStation(it.id) : showStop(it.id); };
  const render = () => { res = search(q.value); act = 0; list.innerHTML = res.map((it, i) => `<li data-i="${i}" class="${i === 0 ? "on" : ""}">${it.html}</li>`).join("") || `<li class="sub">Tidak ditemukan</li>`; list.hidden = !q.value.trim(); };
  q.addEventListener("input", render);
  q.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); act = (act + (e.key === "ArrowDown" ? 1 : -1) + res.length) % Math.max(res.length, 1); [...list.children].forEach((li, i) => li.classList.toggle("on", i === act)); }
    else if (e.key === "Enter" && res[act]) pick(res[act]);
    else if (e.key === "Escape") list.hidden = true;
  });
  list.addEventListener("click", e => { const li = e.target.closest("li[data-i]"); if (li) pick(res[+li.dataset.i]); });
  document.addEventListener("click", e => { if (!list.contains(e.target) && e.target !== q) list.hidden = true; });
  $("#filters").addEventListener("change", e => {
    const c = e.target.dataset.cat;
    if (c) e.target.checked ? hidden.delete(c) : hidden.add(c);
    applyFilters();
  });
  $("#panel").addEventListener("click", e => {
    if (e.target.closest("[data-from],[data-to],[data-show],[data-copy],[data-block]")) return;
    const t = e.target.closest("[data-route],[data-stop],[data-station],button.clear");
    if (!t) return;
    if (t.matches("button.clear")) { clearSel(); $("#panel").innerHTML = `<p class="hint">Klik halte, stasiun, atau garis rute di peta.</p>`; return; }
    if (t.dataset.route) return showRoute(t.dataset.route);
    if (t.dataset.station) return showStation(t.dataset.station);
    if (t.dataset.stop) {
      const s = N.stops[t.dataset.stop];
      // di daftar urutan halte rute: cukup terbang ke halte tanpa menghapus sorotan rute
      if (selRoute && t.closest("ol.seq")) { if (s?.c) { pin(s.c); map.flyTo({ center: s.c, zoom: 16 }); } return; }
      return showStop(t.dataset.stop);
    }
  });
}
