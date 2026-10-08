// Stasiun kereta (operasional) untuk /terdekat: [slug, nama pendek, lat, lng, [warna, label moda], [[lin, kode, warna, nama pendek]], [[pintu, lat, lng]]]
import { stationList, primaryMode, modeInfo, RAIL_LINES, sortLines, lineInfo } from "../../../lib/rail.js";
import { hasSchedule } from "../../../lib/schedule.js";

export function GET() {
  const out = stationList().map(s => {
    const m = modeInfo(primaryMode(s));
    return [s.slug, s.short, +s.lat.toFixed(6), +s.lng.toFixed(6), [m.color, m.short],
      sortLines(s.lines || []).map(l => [l, lineInfo(l).code, lineInfo(l).color, lineInfo(l).short]),
      (s.entrances || []).map(e => [e.name, e.lat, e.lng]), hasSchedule(s.slug) ? 1 : 0];
  });
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
}
