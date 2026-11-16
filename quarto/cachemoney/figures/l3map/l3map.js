/* L3 map: L3 hit latency on the Xeon's mesh, two views of one matrix.
   Cache map: from the chosen core to every slice. Core map: each core's average over all slices.
   Click, tap or press Enter on a tile to choose the core; arrow keys move between tiles.
   Data: l3map.json (l3map_data.py). No dependencies.
   Markup: <div data-l3map-src="l3map.json" data-core="10"><img ...></div>; the images are the fallback
   and are replaced only once the data has loaded. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const RAMP = [[169, 189, 82], [201, 154, 62], [168, 69, 42]];   // fast green, amber, slow rust, as in the static figures (measured.py)
  const INK = 0.8;                                                // dark ink on a tile until this far along the ramp
  const PITCH = 44, TILE = 40, PAD = 3;

  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const html = (tag, cls, parent, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  const rgb = (c) => `rgb(${c.join(",")})`;
  const ramp = (f) => {
    const x = Math.min(1, Math.max(0, f)) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(x));
    return rgb(RAMP[i].map((v, k) => Math.round(v + (RAMP[i + 1][k] - v) * (x - i))));
  };
  const ns = (v) => v.toFixed(1);

  function mount(root, data) {
    const N = data.tiles.length;
    const pos = {};
    for (const t of data.tiles) pos[t.cpu] = [t.row, t.col];
    const cx = (c) => PAD + TILE / 2 + c * PITCH, cy = (r) => PAD + TILE / 2 + r * PITCH;
    const W = 2 * PAD + TILE + (data.cols - 1) * PITCH, H = 2 * PAD + TILE + (data.rows - 1) * PITCH;
    const all = data.ns.flat();
    const range = { cache: [Math.min(...all), Math.max(...all)], core: [Math.min(...data.mean), Math.max(...data.mean)] };

    let mode = "cache", core = +root.dataset.core || 0, hover = null;
    if (!(core in pos)) core = data.tiles[0].cpu;

    root.classList.add("l3m");
    root.innerHTML = "";
    const bar = html("div", "l3m-bar", root);
    const modes = html("div", "l3m-modes", bar);
    modes.setAttribute("role", "group");
    modes.setAttribute("aria-label", "View");
    const btn = {};
    for (const [m, label] of [["cache", "Cache map"], ["core", "Core map"]]) {
      btn[m] = html("button", "l3m-mode", modes, label);
      btn[m].type = "button";
      btn[m].addEventListener("click", () => { mode = m; hover = null; paint(); });
    }
    const pick = html("label", "l3m-pick", bar);
    html("span", "l3m-k", pick, "core");
    const select = html("select", "l3m-select", pick);
    for (const t of data.tiles.slice().sort((a, b) => a.cpu - b.cpu)) {
      const o = html("option", null, select, `CPU ${t.cpu}`);
      o.value = t.cpu;
    }
    select.addEventListener("change", () => { core = +select.value; hover = null; paint(); });

    const svg = el("svg", { class: "l3m-mesh", viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": "Mesh tiles" }, root);
    for (let r = 0; r < data.rows; r++) el("line", { class: "l3m-lat", x1: cx(0), y1: cy(r), x2: cx(data.cols - 1), y2: cy(r) }, svg);
    for (let c = 0; c < data.cols; c++) el("line", { class: "l3m-lat", x1: cx(c), y1: cy(0), x2: cx(c), y2: cy(data.rows - 1) }, svg);
    for (const s of data.stops) {
      el("rect", { class: "l3m-mc", x: cx(s.col) - TILE / 2, y: cy(s.row) - TILE / 2, width: TILE, height: TILE, rx: 4 }, svg);
      el("text", { class: "l3m-mc-t", x: cx(s.col), y: cy(s.row) + 4.5, "text-anchor": "middle" }, svg).textContent = s.label;
    }
    const tiles = {};
    for (const t of data.tiles) {
      const g = el("g", { class: "l3m-tile", tabindex: "0", role: "button" }, svg);
      const rect = el("rect", { x: cx(t.col) - TILE / 2, y: cy(t.row) - TILE / 2, width: TILE, height: TILE, rx: 4 }, g);
      const num = el("text", { class: "l3m-num", x: cx(t.col), y: cy(t.row) + 4.8, "text-anchor": "middle" }, g);
      tiles[t.cpu] = { g, rect, num };
      g.addEventListener("click", () => { core = t.cpu; hover = null; paint(); });
      g.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { hover = t.cpu; paint(); } });
      g.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse" && hover === t.cpu) { hover = null; paint(); } });
      g.addEventListener("focus", () => { hover = t.cpu; paint(); });
      g.addEventListener("blur", () => { if (hover === t.cpu) { hover = null; paint(); } });
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); core = t.cpu; paint(); return; }
        const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
        if (!d) return;
        e.preventDefault();
        // the nearest tile in that direction, preferring the same row or column
        let best = null, score = Infinity;
        for (const o of data.tiles) {
          const dr = o.row - t.row, dc = o.col - t.col;
          const along = dr * d[0] + dc * d[1], across = Math.abs(dr * d[1]) + Math.abs(dc * d[0]);
          if (along > 0 && along + 3 * across < score) { score = along + 3 * across; best = o.cpu; }
        }
        if (best != null) tiles[best].g.focus();
      });
    }

    const key = html("div", "l3m-key", root);
    const lo = html("span", "l3m-tick", key);
    const rampBar = html("span", "l3m-ramp", key);
    rampBar.style.background = `linear-gradient(to right, ${RAMP.map(rgb).join(", ")})`;
    const hi = html("span", "l3m-tick", key);
    const keyText = html("span", "l3m-key-t", key);
    const out = html("p", "l3m-out", root);
    out.setAttribute("aria-live", "polite");

    function paint() {
      const cache = mode === "cache";
      const val = (cpu) => (cache ? data.ns[core][cpu] : data.mean[cpu]);
      const [a, b] = range[mode];
      for (const m in btn) {
        btn[m].classList.toggle("is-active", m === mode);
        btn[m].setAttribute("aria-pressed", m === mode ? "true" : "false");
      }
      select.value = core;
      for (const cpu in tiles) {
        const t = tiles[cpu], v = val(cpu), f = (v - a) / (b - a);
        t.rect.setAttribute("fill", ramp(f));
        t.num.textContent = ns(v);
        t.g.classList.toggle("is-dark", f >= INK);
        t.g.classList.toggle("is-core", +cpu === core);
        t.g.setAttribute("aria-label", cache ? `Slice ${cpu}: ${ns(v)} ns from CPU ${core}. Choose CPU ${cpu}.` : `CPU ${cpu}: average ${ns(v)} ns. Choose CPU ${cpu}.`);
      }
      lo.textContent = ns(a);
      hi.textContent = `${ns(b)} ns`;
      keyText.textContent = cache ? `L3 hit from CPU ${core} to each slice` : "each core's average over all 32 slices";
      const row = data.ns[core];
      if (hover != null && cache && hover !== core) out.innerHTML = `CPU ${core} to slice ${hover}: <strong>${ns(row[hover])} ns</strong>`;
      else if (hover != null && !cache && hover !== core) out.innerHTML = `CPU ${hover}: average <strong>${ns(data.mean[hover])} ns</strong>`;
      else out.innerHTML = `CPU ${core}: own slice <strong>${ns(row[core])} ns</strong>, farthest <strong>${ns(Math.max(...row))} ns</strong>, average <strong>${ns(data.mean[core])} ns</strong> <span class="l3m-hint">· pick a tile to change the core</span>`;
    }
    paint();
  }

  for (const root of document.querySelectorAll("[data-l3map-src]")) {
    fetch(root.dataset.l3mapSrc).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((d) => mount(root, d))
      .catch(() => {});   // the static figures stay
  }
})();
