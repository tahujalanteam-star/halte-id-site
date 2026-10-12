// Peta locality untuk halaman statis (dipakai saat build). Inti perhitungan ada di locality-core.js
// agar halaman /terdekat bisa memakainya juga di browser.
import { loadRailGeo, loadStations } from "./data.js";
import { RAIL_LINES, lineInfo, isOpen } from "./rail.js";
import { TERMINALS, terminalOfStop } from "./terminals.js";
import { buildLocalityMap } from "./locality-core.js";

export { LM_W, LM_H } from "./locality-core.js";

let _ctx = null;
export const localityContext = () => _ctx ||= {
  railGeo: loadRailGeo(),
  stations: Object.fromEntries(Object.entries(loadStations()).filter(([, s]) => isOpen(s))),
  isRailLine: k => !!RAIL_LINES[k],
  lineInfo, terminalOfStop, terminals: TERMINALS,
};

export const localityMap = opts => buildLocalityMap(opts, localityContext());
