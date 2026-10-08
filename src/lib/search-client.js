// Pencarian di browser: dipakai kotak cari beranda, halaman Tempat, dan halaman hasil /cari.
// Indeks /data/search.json diunduh sekali (lihat src/pages/data/search.json.js).

const fold = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const key = s => fold(s).replace(/[^a-z0-9]/g, "");
// Singkatan yang sering diketik → bentuk yang dipakai di data
const ABBR = { sdn: "sd negeri", smpn: "smp negeri", sman: "sma negeri", smkn: "smk negeri", mtsn: "mts negeri", univ: "universitas" };
const tokens = q => fold(q).split(/[^a-z0-9]+/).filter(Boolean).flatMap(t => (ABBR[t] || t).split(" "));

export const TYPES = {
  r: { label: "Rute Bus", one: "Rute" },
  s: { label: "Stasiun", one: "Stasiun" },
  h: { label: "Halte", one: "Halte" },
  p: { label: "Tempat", one: "Tempat" },
};

let data = null, loading = null, byKey = null;
// Cari entri dari path, mis. "halte/blok-m" atau "tempat/sma-negeri-8-jakarta" (null bila tidak ada)
export const findByKey = k => byKey?.get(k) || null;
// Semua entri satu jenis ("r", "s", "h", "p") dalam urutan search.json; null bila indeks belum dimuat
const _lists = {};
export const listOf = t => data ? (_lists[t] ||= data.filter(it => it.t === t)) : null;
export function loadIndex() {
  return (loading ||= fetch("/data/search.json").then(r => r.json()).then(d => {
    const prep = it => { it.f = fold(it.label); it.fa = fold(it.alias || ""); it.words = (it.f + " " + it.fa + " " + fold(it.kind || "")).split(/[^a-z0-9]+/).filter(Boolean); return it; };
    data = [
      ...d.r.map(([id, label, slug, c, on]) => ({ t: "r", id, label, url: `/rute/${slug}`, c, on, w: 0 })),
      ...d.s.map(([label, alias, slug, cat, c]) => ({ t: "s", label, alias, url: `/stasiun/${slug}`, cat, c, w: 1 })),
      ...d.h.map(([label, id, brt]) => ({ t: "h", label, url: `/halte/${id}`, brt, w: 2 })),
      ...d.p.map(([label, alias, slug, cat, kind, pop]) => ({ t: "p", label, alias, url: `/tempat/${slug}`, cat, kind: kind || cat, w: pop ? 1 : 3 })),
    ].map(prep);
    // i = urutan dalam jenisnya (sama dengan urutan di search.json dan /data/geo/titik.json); key = path tanpa "/"
    const seen = {};
    for (const it of data) { it.i = seen[it.t] = (seen[it.t] ?? -1) + 1; it.key = it.url.slice(1); }
    byKey = new Map(data.map(it => [it.key, it]));
    return data;
  }).catch(e => { loading = null; throw e; }));
}

// Skor kecocokan (kecil = lebih cocok), -1 = tidak cocok
function score(it, q, qk, toks) {
  if (it.id) {
    const idk = key(it.id);
    if (qk && idk === qk) return 0;
    if (qk && idk.startsWith(qk)) return 1;
  }
  if (it.f.startsWith(q)) return 2;
  if (it.f.includes(" " + q) || it.fa.startsWith(q) || it.fa.includes(" " + q)) return 3;
  if (it.f.includes(q) || it.fa.includes(q)) return 4;
  // Semua kata yang diketik muncul sebagai awal kata (urutan bebas), mis. "sdn 5 menteng"
  if (toks.length && toks.every(t => it.words.some(w => w.startsWith(t) || (/^\d+$/.test(t) && w.replace(/^0+/, "") === t.replace(/^0+/, ""))))) return 5;
  return -1;
}

export function search(query, { limit = Infinity } = {}) {
  if (!data) return null;
  const q = fold(query.trim()).replace(/\s+/g, " ");
  if (!q) return [];
  const qk = key(q), toks = tokens(q);
  const hits = [];
  for (const it of data) { const s = score(it, q, qk, toks); if (s >= 0) hits.push({ it, s }); }
  hits.sort((a, b) => a.s - b.s || a.it.w - b.it.w || a.it.label.length - b.it.label.length || a.it.label.localeCompare(b.it.label, "id"));
  return hits.slice(0, limit).map(h => h.it);
}

const ICON = {
  p: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-5h6v5"/></svg>',
  s: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14"/><path d="m8 21 2-4M16 21l-2-4"/></svg>',
  h: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
};
const subOf = it => it.t === "r" ? "Rute" : it.t === "p" ? `${it.kind} · lihat halte terdekat` : it.t === "s" ? `Stasiun ${it.cat} · lihat halte terdekat` : (it.brt ? "Halte BRT" : "Halte");

// <a> satu hasil (dipakai dropdown dan halaman hasil)
export function resultLink(it) {
  const a = document.createElement("a");
  a.href = it.url;
  const tag = document.createElement("span");
  if (it.t === "r") {
    tag.className = "badge-bus";
    tag.style.setProperty("--c", it.c);
    tag.style.setProperty("--on", it.on);
    tag.textContent = it.id;
  } else {
    tag.className = "res-pin" + (it.t === "p" ? " is-place" : it.t === "s" ? " is-rail" : it.brt ? " is-brt" : "");
    if (it.t === "s") tag.style.setProperty("--m", it.c);
    tag.innerHTML = ICON[it.t];
  }
  const text = document.createElement("span");
  text.className = "res-text";
  text.innerHTML = "<b></b><small></small>";
  text.querySelector("b").textContent = it.label;
  text.querySelector("small").textContent = subOf(it);
  a.append(tag, text);
  return a;
}

export const resultsUrl = q => `/cari?q=${encodeURIComponent(q.trim())}`;

// Saran saat mengetik. Panah atas/bawah memilih saran; Enter membuka saran terpilih,
// atau halaman hasil lengkap bila belum ada yang dipilih.
// Mode pilih (onPick): saran tidak membuka halaman, tetapi diserahkan ke onPick(item); Enter memilih saran
// terpilih atau yang teratas. filter(item) membatasi jenis saran (mis. tanpa rute untuk form perjalanan).
export function attachSuggest(input, list, { max = 8, onPick = null, filter = null } = {}) {
  let shown = [];
  let active = -1;
  const links = () => [...list.querySelectorAll("a")];
  const setActive = i => {
    const ls = links();
    active = ls.length ? (i + ls.length) % ls.length : -1;
    ls.forEach((a, j) => a.classList.toggle("is-active", j === active));
    if (active >= 0) ls[active].scrollIntoView({ block: "nearest" });
  };
  const msg = text => { const li = document.createElement("li"); li.className = "empty"; li.textContent = text; list.appendChild(li); };
  const render = () => {
    const q = input.value.trim();
    list.innerHTML = ""; active = -1;
    if (!q) { list.hidden = true; return; }
    let all = search(q);
    if (!all) { loadIndex().then(render, () => {}); msg("Memuat data…"); list.hidden = false; return; }
    if (filter) all = all.filter(filter);
    if (!all.length) msg(onPick ? "Tidak ditemukan. Coba nama halte, stasiun, atau tempat lain." : "Tidak ditemukan. Coba nomor rute, nama halte, atau ejaan lain.");
    shown = all.slice(0, max);
    shown.forEach((it, j) => { const li = document.createElement("li"); const a = resultLink(it); a.dataset.j = j; li.appendChild(a); list.appendChild(li); });
    if (all.length && !onPick) {
      const li = document.createElement("li");
      li.className = "res-all";
      const a = document.createElement("a");
      a.href = resultsUrl(q);
      a.textContent = all.length > max ? `Lihat semua ${all.length} hasil untuk “${q}” →` : `Buka halaman hasil untuk “${q}” →`;
      li.appendChild(a); list.appendChild(li);
    }
    list.hidden = false;
  };
  input.addEventListener("input", render);
  input.addEventListener("focus", () => { loadIndex().catch(() => {}); if (input.value.trim()) render(); });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (list.hidden) render();
      e.preventDefault(); setActive(active + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const ls = links();
      if (onPick) { const it = shown[active >= 0 ? active : 0]; if (it) { list.hidden = true; onPick(it); } }
      else if (active >= 0 && ls[active]) location.href = ls[active].href;
      else if (input.value.trim()) location.href = resultsUrl(input.value);
    } else if (e.key === "Escape") { list.hidden = true; active = -1; }
  });
  if (onPick) list.addEventListener("click", e => {
    const a = e.target.closest("a[data-j]");
    if (!a) return;
    e.preventDefault(); list.hidden = true; onPick(shown[+a.dataset.j]);
  });
  document.addEventListener("click", e => { if (!list.contains(e.target) && e.target !== input) list.hidden = true; });
  return { render };
}
