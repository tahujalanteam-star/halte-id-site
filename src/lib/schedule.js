// Jadwal keberangkatan KRL per stasiun dari data/krl-schedule.json.
// Satu kelompok per arah laju (dikelompokkan menurut stasiun berhenti berikutnya), seperti papan per peron.
import { loadKrlSchedule, loadHolidays, loadStations, loadRailSchedules } from "./data.js";
import { lineInfo, RAIL_LINES } from "./rail.js";

const toMin = s => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const short = slug => loadStations()[slug]?.short || slug;

let _index = null;
// slug → [{ trip, pos, min }] ; menit bisa ≥ 1440 untuk perjalanan yang melewati tengah malam
function index() {
  if (_index) return _index;
  _index = new Map();
  for (const trip of loadKrlSchedule().trips || []) {
    let prev = -1, add = 0;
    const mins = trip.stops.map(([, t]) => { let m = toMin(t) + add; if (m < prev - 600) { add += 1440; m += 1440; } prev = m; return m; });
    trip.stops.forEach(([slug], pos) => {
      if (!_index.has(slug)) _index.set(slug, []);
      _index.get(slug).push({ trip, pos, min: mins[pos] });
    });
  }
  return _index;
}

export const hasSchedule = slug => index().has(slug) || !!loadRailSchedules().stations?.[slug];

const _cache = new Map();
export function stationSchedule(slug) {
  if (_cache.has(slug)) return _cache.get(slug);
  const sb = stationBasedSchedule(slug);
  if (sb) { _cache.set(slug, sb); return sb; }
  const occ = (index().get(slug) || []).filter(o => o.pos < o.trip.stops.length - 1); // kereta yang berakhir di sini tidak dihitung
  if (!occ.length) { _cache.set(slug, null); return null; }
  const groups = new Map();
  for (const o of occ) {
    const next = o.trip.stops[o.pos + 1][0];
    if (!groups.has(next)) groups.set(next, []);
    groups.get(next).push(o);
  }
  // Kelompok kecil yang stasiun berikutnya ada di 3 pemberhentian ke depan kelompok lain digabung
  // (kereta yang melewati satu stasiun, mis. Manggarai → Jatinegara tanpa berhenti di Matraman)
  const entries = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const ahead = (list, n) => list.some(o => o.trip.stops.slice(o.pos + 1, o.pos + 4).some(([x]) => x === n));
  for (let i = 0; i < entries.length; i++) for (let j = entries.length - 1; j > i; j--) {
    if (ahead(entries[i][1], entries[j][0]) || ahead(entries[j][1], entries[i][0])) { entries[i][1].push(...entries[j][1]); entries.splice(j, 1); }
  }
  const dirs = entries.map(([next, list]) => {
    list.sort((a, b) => a.min - b.min);
    const destCount = new Map();
    for (const o of list) { const d = o.trip.stops.at(-1)[0]; destCount.set(d, (destCount.get(d) || 0) + 1); }
    const dests = [...destCount.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
    const trains = list.map(o => ({ min: o.min, dest: o.trip.stops.at(-1)[0], line: o.trip.line, days: o.trip.weekday_only ? 1 : 0, ka: o.trip.ka }));
    return {
      next, nextName: short(next), dests, destNames: dests.map(short),
      label: `Menuju ${dests.slice(0, 3).map(short).join(" / ")}${dests.length > 3 ? " dll." : ""}`,
      ...dirStats(trains),
    };
  }).sort((a, b) => b.trains.length - a.trains.length);
  const out = { dirs, mode: "KRL", sourceName: "KAI Commuter", date: loadKrlSchedule().valid_from, dateKind: "berlaku" };
  _cache.set(slug, out);
  return out;
}

// days: 0 = setiap hari, 1 = hari kerja saja, 2 = Sabtu/Minggu/libur saja
function dirStats(trains) {
  const wd = trains.filter(t => t.days !== 2), hol = trains.filter(t => t.days !== 1);
  return {
    lines: [...new Set(trains.map(t => t.line))], trains,
    weekdayOnlyCount: trains.filter(t => t.days === 1).length, holidayOnlyCount: trains.filter(t => t.days === 2).length,
    firstWeekday: wd[0], lastWeekday: wd.at(-1), firstHoliday: hol[0], lastHoliday: hol.at(-1),
    countWeekday: wd.length, countHoliday: hol.length,
  };
}

// MRT Jakarta & LRT Jakarta: jadwal per stasiun per arah (data/rail-schedules.json, scripts/build-rail-schedules.py)
function stationBasedSchedule(slug) {
  const R = loadRailSchedules();
  const raw = R.stations?.[slug];
  if (!raw?.length) return null;
  const dirs = raw.map(d => {
    const trains = d.trains.map(([min, dest, days]) => ({ min, dest, line: d.line, days }));
    const destCount = new Map();
    for (const t of trains) destCount.set(t.dest, (destCount.get(t.dest) || 0) + 1);
    const dests = [...destCount.entries()].sort((a, b) => b[1] - a[1]).map(([x]) => x);
    return { next: d.next, nextName: short(d.next), dests, destNames: dests.map(short),
      label: `Menuju ${dests.slice(0, 3).map(short).join(" / ")}`, ...dirStats(trains) };
  });
  const src = R.sources?.[raw[0].line] || {};
  return { dirs, mode: raw[0].line.startsWith("mrt") ? "MRT" : "LRT", sourceName: src.name || "operator", date: src.fetched_at, dateKind: "diambil", url: src.url };
}

export const fmtMin = m => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// Data ringkas untuk widget "Kereta berikutnya" (dimuat browser dari /data/jadwal/<slug>.json)
export function scheduleJson(slug) {
  const s = stationSchedule(slug);
  if (!s) return null;
  const H = loadHolidays();
  const names = [], lines = [];
  const ni = slug => { const n = short(slug); let i = names.indexOf(n); if (i < 0) { names.push(n); i = names.length - 1; } return i; };
  const li = key => { let i = lines.findIndex(l => l[0] === key); if (i < 0) { const L = lineInfo(key); lines.push([key, key.startsWith("mrt") ? "MRT" : L.short, L.color]); i = lines.length - 1; } return i; };
  return {
    v: 2, src: s.sourceName,
    hol: (H.libur_nasional || []).map(h => h.date), cuti: (H.cuti_bersama || []).map(h => h.date),
    names, lines,
    dirs: s.dirs.map(d => ({ to: d.label, nx: d.nextName, sp: d.holidayOnlyCount > 0 ? 1 : 0, t: d.trains.map(t => [t.min, ni(t.dest), li(t.line), t.days]) })),
  };
}

export function scheduleStations() {
  return [...new Set([...index().keys(), ...Object.keys(loadRailSchedules().stations || {})])].filter(s => stationSchedule(s));
}
export { RAIL_LINES };
