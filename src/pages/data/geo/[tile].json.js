// Satu petak halte untuk /terdekat. Lihat src/lib/geo-tiles.js
import { geoTiles } from "../../../lib/geo-tiles.js";

export function getStaticPaths() {
  return [...geoTiles().keys()].map(tile => ({ params: { tile } }));
}

export async function GET({ params }) {
  return new Response(JSON.stringify(geoTiles().get(params.tile) || []), { headers: { "Content-Type": "application/json" } });
}
