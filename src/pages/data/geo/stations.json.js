// Stasiun kereta (operasional) untuk /terdekat: [slug, nama pendek, lat, lng, [warna, label moda], [[lin, label, warna]], [[pintu, lat, lng]]]
import { stationList, primaryMode, modeInfo, RAIL_LINES, LINE_BADGE, lineInfo } from "../../../lib/rail.js";
import { hasSchedule } from "../../../lib/schedule.js";

export function GET() {
  const out = stationList().map(s => {
    const m = modeInfo(primaryMode(s));
    return [s.slug, s.short, +s.lat.toFixed(6), +s.lng.toFixed(6), [m.color, m.short],
      (s.lines || []).filter(l => RAIL_LINES[l]).map(l => [l, LINE_BADGE[l] || lineInfo(l).short, lineInfo(l).color]),
      (s.entrances || []).map(e => [e.name, e.lat, e.lng]), hasSchedule(s.slug) ? 1 : 0];
  });
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
}
