// Jadwal KRL per stasiun untuk widget "Kereta berikutnya" (dimuat saat halaman stasiun dibuka)
import { scheduleStations, scheduleJson } from "../../../lib/schedule.js";

export function getStaticPaths() {
  return scheduleStations().map(slug => ({ params: { slug } }));
}

export function GET({ params }) {
  return new Response(JSON.stringify(scheduleJson(params.slug)), { headers: { "Content-Type": "application/json" } });
}
