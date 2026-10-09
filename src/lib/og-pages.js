// Isi gambar Open Graph untuk tiap jenis halaman. Kunci = path gambar tanpa "/og/" dan ".png".
import {
  loadStops, loadRoutesIndex, loadRoute, loadStopServices, routeSlug, routeLabel, categoryOf, categoryLabel,
} from "./data.js";
import { stopGroups } from "./stop-insights.js";
import { stationList, stationsForStop, stopsNearStation, primaryMode, modeInfo, lineInfo, sortLines, RAIL_MODES } from "./rail.js";

const MODE_CHIP = { mrt: ["MRT", "#db0000"], krl: ["KRL", "#db6300"], lrt: ["LRT", "#c2185b"], kai: ["KAI", "#1e3a8a"] };
const fmt = n => n.toLocaleString("id-ID");

let _specs = null;
export function ogSpecs() {
  if (_specs) return _specs;
  const stops = loadStops();
  const services = loadStopServices();
  const index = loadRoutesIndex();
  const specs = new Map();

  specs.set("umum", {
    kicker: "Transjakarta · KRL · MRT · LRT",
    title: "Panduan Bus & Kereta Jabodetabek",
    accent: "#2652d9", accent2: "#db6300",
    chips: [{ label: `${fmt(index.length)} rute` }, { label: `${fmt(Object.keys(stops).length)} halte` }, { label: "Lin kereta & stasiun" }],
  });

  for (const e of index) {
    let route = null;
    try { route = loadRoute(e.id); } catch {}
    const ids = new Set((route?.directions || []).flatMap(d => d.stop_ids));
    const modes = [...new Set([...ids].flatMap(id => (stops[id]?.transfers || []).map(t => t.type)))].filter(t => MODE_CHIP[t]);
    const sch = route?.timetable?.schedules?.[0];
    const color = e.route_color || "#2652d9";
    specs.set(`rute/${routeSlug(e)}`, {
      kicker: categoryLabel(categoryOf(e)),
      title: e.route_name || routeLabel(e),
      accent: color,
      badge: { text: routeLabel(e), color },
      chips: [
        e.stops_count ? { label: `${e.stops_count} halte` } : null,
        sch ? { label: `${sch.first_departure} – ${sch.last_departure}` } : null,
        ...modes.slice(0, 2).map(m => ({ label: MODE_CHIP[m][0], color: MODE_CHIP[m][1] })),
      ].filter(Boolean),
    });
  }

  for (const [id, s] of Object.entries(stops)) {
    if (s.type !== "brt") continue;
    const n = (services[id] || []).length;
    const rail = stationsForStop(id);
    const m = rail[0] ? modeInfo(primaryMode(rail[0])) : null;
    specs.set(`halte/${id}`, {
      kicker: "Halte BRT",
      title: s.name,
      accent: "#2652d9", accent2: m?.color || "#94a3b8",
      icon: { name: "pin", color: "#2652d9", bg: "#e7ecfb" },
      chips: [
        { label: `${n} rute berhenti di sini` },
        // stasiun terdekat: kode lin (A, B, C, ...) + nama & jarak; tanpa kode lin → nama moda
        ...(rail[0] ? sortLines(rail[0].lines || []).slice(0, 3).map(l => ({ code: lineInfo(l).code, color: lineInfo(l).color })) : []),
        rail[0] && !sortLines(rail[0].lines || []).length && m ? { label: `Transit ${m.short}`, color: m.color } : null,
        rail[0] ? { label: `${rail[0].name.replace(/^Stasiun /, "St. ")} ${Math.round(rail[0].distance / 10) * 10} m` } : null,
      ].filter(Boolean),
    });
  }

  for (const st of stationList()) {
    const m = modeInfo(primaryMode(st));
    const { near } = stopsNearStation(st);
    specs.set(`stasiun/${st.slug}`, {
      kicker: `Stasiun ${(st.modes || []).map(k => RAIL_MODES[k]?.short).filter(Boolean).join(" · ")}`,
      title: st.name,
      accent: m.color, kickerColor: m.color,
      icon: { name: "train", color: "#ffffff", bg: m.color },
      chips: [
        ...sortLines(st.lines || []).slice(0, 5).map(l => ({ code: lineInfo(l).code, color: lineInfo(l).color })),
        // satu lin: tulis juga namanya agar tetap terbaca bagi yang belum hafal kode
        ...(sortLines(st.lines || []).length === 1 ? [{ label: lineInfo(sortLines(st.lines)[0]).label, color: lineInfo(sortLines(st.lines)[0]).color }] : []),
        { label: `${near.length} halte Transjakarta terdekat` },
      ],
    });
  }

  for (const g of stopGroups().groups) {
    const routes = new Set(g.stopIds.flatMap(id => services[id] || []));
    specs.set(`kawasan/${g.slug}`, {
      kicker: g.hasTerminal ? "Terminal & kawasan transit" : "Kawasan transit",
      title: g.name,
      accent: "#2652d9", accent2: "#16a34a",
      icon: { name: "hub", color: "#2652d9", bg: "#e7ecfb" },
      chips: [{ label: `${g.stopIds.length} halte` }, { label: `${routes.size} rute` }],
    });
  }
  return (_specs = specs);
}

// Path gambar untuk sebuah halaman (dipakai BaseLayout); null = pakai gambar umum
export function ogImageFor(kind, key) {
  const k = `${kind}/${key}`;
  return ogSpecs().has(k) ? `/og/${k}.png` : "/og/umum.png";
}
