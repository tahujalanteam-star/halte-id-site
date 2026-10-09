// Terminal bus dengan beberapa jalur yang berdampingan (jarak antarjalur hanya beberapa meter).
// Di peta locality, semua jalur satu terminal digambar sebagai satu penanda; detailnya ada di denah
// skematis (src/components/TerminalDiagram.astro). Rute per jalur diambil dari stop-services.json.
//
// Pintu (akses penumpang ke lorong bawah tanah):
//   side   "top" | "bottom"  sisi denah
//   x      posisi tengah kotak nomor di denah (0–760)
//   from   arah datang penumpang: "left" | "right" | "below" | "above" (digambar sebagai panah merah)
//   label  keterangan singkat di bawah/atas pintu (boleh kosong; pintu bersebelahan bisa berbagi label)
export const TERMINALS = {
  "blok-m": {
    name: "Terminal Blok M",
    // urutan dari utara (atas) ke selatan (bawah) = urutan di denah
    jalur: [
      { stop: "blok-m", n: 1 },
      { stop: "blok-m-jalur-2", n: 2 },
      { stop: "blok-m-jalur-3", n: 3 },
      { stop: "blok-m-jalur-4", n: 4 },
      { stop: "blok-m-jalur-5", n: 5 },
      { stop: "blok-m-jalur-6", n: 6 },
    ],
    road: "Jl. Palatehan",                       // jalan di sisi atas (utara)
    busIn: "dari Jl. Panglima Polim",
    busOut: "ke Jl. Sultan Hasanudin",
    doors: [
      { n: 1, side: "bottom", x: 58, from: "below", label: "dekat Blok M Hub" },
      { n: 2, side: "bottom", x: 132, from: "left", label: "Blok M Square", labelX: 210 },
      { n: 3, side: "bottom", x: 288, from: "right" },
      { n: 4, side: "bottom", x: 640, from: "below", label: "sisi timur" },
      { n: 5, side: "top", x: 548, from: "left" },
      { n: 6, side: "top", x: 600, from: "right" },
    ],
    walk: "← ke Stasiun MRT Blok M (Exit E/F), lewat trotoar ke arah barat",
    note: "Bus menurunkan penumpang sebelum tangga turun, lalu maju dan menaikkan penumpang di antara kedua tangga. Semua pintu masuk menuju lorong bawah tanah. Denah skematis, tidak berskala.",
  },
};

const BY_STOP = new Map();
for (const [key, t] of Object.entries(TERMINALS)) for (const j of t.jalur) BY_STOP.set(j.stop, key);
export const terminalOfStop = stopId => BY_STOP.get(stopId) || null;
