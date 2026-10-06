// Gambar pratinjau tautan (Open Graph, 1200×630) dibuat otomatis saat build.
// Satu template untuk semua: rute, halte BRT, stasiun, kawasan, dan gambar umum.
// satori mengubah "elemen" (objek mirip JSX) menjadi SVG, lalu resvg mengubahnya ke PNG.
import fs from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { octiPath } from "./octi.js";
import { readableText } from "./data.js";

export const OG_W = 1200, OG_H = 630;

const FONT_DIR = path.resolve(process.cwd(), "node_modules/@fontsource/plus-jakarta-sans/files");
let _fonts = null;
function fonts() {
  if (_fonts) return _fonts;
  const f = (subset, weight) => ({
    name: "Jakarta", weight, style: "normal",
    data: fs.readFileSync(path.join(FONT_DIR, `plus-jakarta-sans-${subset}-${weight}-normal.woff`)),
  });
  _fonts = [500, 700, 800].flatMap(w => [f("latin", w), f("latin-ext", w)]);
  return _fonts;
}

// Pembuat elemen ringkas: h("div", { style }, ...anak)
const h = (type, props = {}, ...children) => ({
  type, props: { ...props, children: children.flat().filter(c => c !== null && c !== undefined && c !== false) },
});

const C = { bg: "#f4f4f0", text: "#161e2b", sub: "#5c6575", border: "#e3e3dc", primary: "#2652d9" };

// Ikon (path SVG 24×24, sama dengan ikon di situs)
const ICONS = {
  pin: ["M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z", "M12 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6"],
  train: ["M7 3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z", "M4 11h16", "m8 21 2-4", "m16 21-2-4"],
  hub: ["M3 21h18", "M5 21V7l7-4 7 4v14", "M9 21v-5h6v5"],
};
const icon = (name, color, size) => h("svg", { width: size, height: size, viewBox: "0 0 24 24" },
  ...ICONS[name].map(d => h("path", { d, fill: "none", stroke: color, "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round" })));

// Panah dua arah pengganti "⇄" (tidak tersedia di font)
const swapArrow = (size, color) => h("svg", { width: size, height: size, viewBox: "0 0 24 24", style: { margin: `0 ${size * 0.22}px`, flexShrink: 0 } },
  h("path", { d: "M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4", fill: "none", stroke: color, "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round" }));

function titleSize(t) {
  const n = t.length;
  return n <= 16 ? 76 : n <= 26 ? 64 : n <= 40 ? 54 : n <= 60 ? 46 : 40;
}

// Judul; "A ⇄ B" dipecah supaya panahnya digambar sebagai ikon
function title(text) {
  const size = titleSize(text.replace(/\s*⇄\s*/g, " - "));
  const parts = text.split(/\s*⇄\s*/);
  const words = [];
  parts.forEach((p, i) => {
    const ws = p.split(/\s+/).filter(Boolean);
    const lastPart = i === parts.length - 1;
    ws.forEach((w, j) => words.push(h("span", { style: { marginRight: j === ws.length - 1 && !lastPart ? 0 : size * 0.24 } }, w)));
    if (!lastPart) words.push(swapArrow(size * 0.82, C.text));
  });
  return h("div", {
    style: { display: "flex", flexWrap: "wrap", alignItems: "center", fontSize: size, fontWeight: 800, lineHeight: 1.12, color: C.text, flex: 1, minWidth: 0, letterSpacing: -1 },
  }, ...words);
}

const chip = (label, color) => h("div", {
  style: {
    display: "flex", fontSize: 26, fontWeight: 700, padding: "10px 24px", borderRadius: 999, marginRight: 14,
    color: color ? readableText(color) : C.sub, background: color || "#ffffff", border: `2px solid ${color || C.border}`,
  },
}, label);

const brand = () => h("div", { style: { display: "flex", alignItems: "center" } },
  h("div", { style: { display: "flex", width: 52, height: 52, borderRadius: 14, background: C.primary, alignItems: "center", justifyContent: "center", marginRight: 14 } },
    h("svg", { width: 30, height: 30, viewBox: "0 0 24 24" },
      h("path", { d: "M3 17c4 0 4-10 9-10s5 10 9 10", fill: "none", stroke: "#fff", "stroke-width": 2.6, "stroke-linecap": "round" }),
      h("circle", { cx: 12, cy: 7, r: 1.6, fill: "#fff" }))),
  h("div", { style: { display: "flex", fontSize: 34, fontWeight: 800, color: C.text } }, h("span", {}, "halte"), h("span", { style: { color: C.primary } }, ".id")));

// Garis dekoratif 45° di kanan, warna mengikuti halaman
function lines(c1, c2) {
  // Diletakkan di bawah baris judul supaya tidak menimpa teks
  const A = octiPath([[220, 700], [220, 680], [460, 440], [700, 440]], 18);
  const B = octiPath([[700, 200], [600, 200], [460, 340], [460, 700]], 18);
  return h("svg", { width: 640, height: 630, viewBox: "0 0 640 630", style: { position: "absolute", right: -40, top: 0 } },
    h("path", { d: B, fill: "none", stroke: c2, "stroke-width": 22, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.16 }),
    h("path", { d: A, fill: "none", stroke: c1, "stroke-width": 22, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.2 }),
    h("circle", { cx: 460, cy: 440, r: 26, fill: "#ffffff", stroke: c1, "stroke-width": 12, opacity: 0.55 }));
}

// spec: { kicker, title, accent, accent2?, badge?: {text, color}, icon?: {name, color, bg}, chips: [{label, color?}] }
export function ogElement(spec) {
  const accent = spec.accent || C.primary;
  const lead = spec.badge
    ? h("div", {
        style: {
          display: "flex", alignItems: "center", justifyContent: "center", minWidth: 150, height: 150, padding: "0 28px", borderRadius: 32, marginRight: 30, flexShrink: 0,
          background: spec.badge.color, color: readableText(spec.badge.color), fontWeight: 800, fontSize: spec.badge.text.length > 4 ? 56 : 76,
        },
      }, spec.badge.text)
    : spec.icon
      ? h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", width: 150, height: 150, borderRadius: 36, marginRight: 30, flexShrink: 0, background: spec.icon.bg } },
          icon(spec.icon.name, spec.icon.color, 84))
      : null;
  return h("div", {
    style: { display: "flex", flexDirection: "column", width: OG_W, height: OG_H, padding: "64px 72px", background: C.bg, fontFamily: "Jakarta", position: "relative", overflow: "hidden" },
  },
    lines(accent, spec.accent2 || "#94a3b8"),
    brand(),
    h("div", { style: { display: "flex", marginTop: 64, fontSize: 26, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: spec.kickerColor || (readableText(accent) === "#ffffff" ? accent : C.sub) } }, spec.kicker),
    h("div", { style: { display: "flex", alignItems: "center", marginTop: 18, width: OG_W - 144 - 60 } }, lead, title(spec.title)),
    h("div", { style: { display: "flex", marginTop: "auto" } }, ...(spec.chips || []).slice(0, 4).map(c => chip(c.label, c.color))));
}

export async function renderOg(spec) {
  const svg = await satori(ogElement(spec), { width: OG_W, height: OG_H, fonts: fonts() });
  return new Resvg(svg, { fitTo: { mode: "width", value: OG_W } }).render().asPng();
}
