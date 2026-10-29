/* Home picker: one core pair's per-line CAS histogram next to the mesh. Every home is shaded by its
   route length A -> H -> B; picking a home (tile, bar, or the menu) lights up its lines and its tile.
   Data: homes.json (homes_data.py). No dependencies.
   Markup: <div data-homes-src="homes.json" data-a="0" data-b="1"><img src="homes-hist.png" alt="..."></div>;
   the image is the fallback and is replaced only once the data has loaded. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const BIN = 0.5;                         // ns per histogram bin
  const LIGHT = [224, 236, 168], DARK = [79, 97, 32];   // ramp ends: short route light, long route dark
  const MAX_HOPS = 21;                     // longest route on this mesh (0 <-> 31 corner to corner, through a far home)

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
  const ramp = (hops) => {
    const f = Math.min(1, Math.max(0, (hops - 1) / (MAX_HOPS - 1)));
    return `rgb(${LIGHT.map((v, i) => Math.round(v + (DARK[i] - v) * f)).join(",")})`;
  };
  const median = (v) => {
    const s = [...v].sort((a, b) => a - b), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  };

  function mount(root, data) {
    const pos = {};
    for (const t of data.tiles) pos[t.cpu] = [t.row, t.col];
    const dist = (x, y) => Math.abs(pos[x][0] - pos[y][0]) + Math.abs(pos[x][1] - pos[y][1]);
    const pairs = data.pairs.slice().sort((p, q) => dist(p.a, p.b) - dist(q.a, q.b) || p.a - q.a);
    let lo = Infinity, hi = -Infinity;
    for (const p of pairs) for (const [, ns] of p.lines) { lo = Math.min(lo, ns); hi = Math.max(hi, ns); }
    lo = Math.floor(lo) - 1;
    hi = Math.ceil(hi) + 1;

    root.classList.add("hp");
    root.innerHTML = "";
    const bar = html("div", "hp-bar", root);
    const pairBox = html("div", "hp-pairs", bar);
    pairBox.setAttribute("role", "group");
    pairBox.setAttribute("aria-label", "Core pair");
    const body = html("div", "hp-body", root);
    const hist = el("svg", { class: "hp-hist", viewBox: "0 0 520 282", role: "img" }, body);
    const mesh = el("svg", { class: "hp-mesh", viewBox: "0 0 330 254", role: "group" }, body);
    const foot = html("div", "hp-foot", root);
    const pick = html("label", "hp-pick", foot);
    html("span", "hp-k", pick, "home");
    const select = html("select", "hp-select", pick);
    const out = html("p", "hp-out", foot);
    out.setAttribute("aria-live", "polite");
    const key = html("div", "hp-key", root);

    // ramp key
    const kv = el("svg", { viewBox: "0 0 300 34", class: "hp-key-svg", "aria-hidden": "true" }, key);
    const grad = el("linearGradient", { id: "hp-grad" }, el("defs", {}, kv));
    el("stop", { offset: "0", "stop-color": ramp(1) }, grad);
    el("stop", { offset: "1", "stop-color": ramp(MAX_HOPS) }, grad);
    el("rect", { x: 8, y: 6, width: 284, height: 8, rx: 2, fill: "url(#hp-grad)" }, kv);
    for (const [x, t, a] of [[8, "1 hop", "start"], [292, `${MAX_HOPS} hops`, "end"]])
      el("text", { x, y: 30, "text-anchor": a, class: "hp-tick" }, kv).textContent = t;
    html("span", "hp-key-t", key, "route A → H → B");

    let cur = null, sel = null, hover = null;

    pairs.forEach((p, i) => {
      const b = html("button", "hp-chip", pairBox);
      b.type = "button";
      html("span", "hp-chip-v", b, `${p.a} · ${p.b}`);
      html("span", "hp-k", b, `${dist(p.a, p.b)} hop${dist(p.a, p.b) === 1 ? "" : "s"}`);
      b.addEventListener("click", () => { setPair(i); });
      p.btn = b;
    });
    select.addEventListener("change", () => { sel = select.value === "" ? null : +select.value; hover = null; paint(); });
    root.addEventListener("keydown", (e) => { if (e.key === "Escape") { sel = null; hover = null; paint(); } });

    function setPair(i) {
      cur = pairs[i];
      for (const p of pairs) {
        p.btn.classList.toggle("is-active", p === cur);
        p.btn.setAttribute("aria-pressed", p === cur ? "true" : "false");
      }
      const by = {};
      for (const [h, ns] of cur.lines) (by[h] = by[h] || []).push(ns);
      cur.homes = Object.keys(by).map(Number).map((h) => ({
        h, ns: by[h], med: median(by[h]), up: dist(cur.a, h), down: dist(h, cur.b),
        hops: dist(cur.a, h) + dist(h, cur.b),
      }));
      cur.byHome = {};
      for (const x of cur.homes) cur.byHome[x.h] = x;
      cur.best = Math.min(...cur.homes.map((x) => x.med));
      cur.mean = cur.lines.reduce((s, l) => s + l[1], 0) / cur.lines.length;
      select.innerHTML = "";
      const none = html("option", null, select, "none");
      none.value = "";
      for (const x of cur.homes.slice().sort((p, q) => p.h - q.h)) {
        const o = html("option", null, select, `${x.h}  ·  ${x.med.toFixed(1)} ns  ·  ${x.hops} hops`);
        o.value = x.h;
      }
      if (sel != null && !cur.byHome[sel]) sel = null;
      drawHist();
      drawMesh();
      paint();
    }

    function drawHist() {
      hist.innerHTML = "";
      hist.setAttribute("aria-label", `CAS handoff per line for CPUs ${cur.a} and ${cur.b}, ${cur.lines.length} lines`);
      const L = 42, R = 512, T = 14, B = 238;
      const nb = Math.round((hi - lo) / BIN);
      const cols = Array.from({ length: nb }, () => []);
      const order = cur.homes.slice().sort((p, q) => p.hops - q.hops || p.h - q.h);
      for (const x of order) for (const ns of x.ns) cols[Math.min(nb - 1, Math.floor((ns - lo) / BIN))].push(x);
      const top = Math.max(...cols.map((c) => c.length));
      const ymax = Math.ceil(top * 1.1 / 5) * 5;
      const X = (ns) => L + (ns - lo) / (hi - lo) * (R - L);
      const Y = (n) => B - n / ymax * (B - T);
      const step = ymax > 40 ? 20 : ymax > 20 ? 10 : 5;
      for (let v = 0; v <= ymax; v += step) {
        el("line", { x1: L, x2: R, y1: Y(v), y2: Y(v), class: "hp-grid" }, hist);
        el("text", { x: L - 6, y: Y(v) + 4, "text-anchor": "end", class: "hp-tick" }, hist).textContent = v;
      }
      for (let v = Math.ceil(lo / 5) * 5; v <= hi; v += 5)
        el("text", { x: X(v), y: B + 19, "text-anchor": "middle", class: "hp-tick" }, hist).textContent = v;
      el("text", { x: (L + R) / 2, y: B + 40, "text-anchor": "middle", class: "hp-axis" }, hist).textContent =
        "CAS handoff (ns)";
      el("line", { x1: L, x2: R, y1: B, y2: B, class: "hp-base" }, hist);
      const w = (R - L) / nb;
      cur.segs = [];
      cols.forEach((c, i) => {
        // one segment per home in this bin, stacked short routes first
        let n = 0;
        const groups = [];
        for (const x of c) {
          const g = groups[groups.length - 1];
          if (g && g.x === x) g.k++;
          else groups.push({ x, k: 1 });
        }
        for (const g of groups) {
          const r = el("rect", {
            x: L + i * w + 0.75, width: Math.max(1, w - 1.5), y: Y(n + g.k) + 0.5, height: Math.max(0.5, Y(n) - Y(n + g.k) - 1),
            fill: ramp(g.x.hops), class: "hp-seg",
          }, hist);
          r.dataset.home = g.x.h;
          cur.segs.push(r);
          n += g.k;
        }
      });
      hist.onpointerover = (e) => { const h = e.target.dataset && e.target.dataset.home; if (h != null && e.pointerType === "mouse" && hover !== +h) { hover = +h; paint(); } };
      hist.onpointerleave = () => { if (hover != null) { hover = null; paint(); } };
      hist.onclick = (e) => { const h = e.target.dataset && e.target.dataset.home; if (h != null) toggle(+h); };
    }

    function drawMesh() {
      mesh.innerHTML = "";
      mesh.setAttribute("aria-label", "Mesh tiles; pick a home");
      const P = 40, S = 31, OX = 25, OY = 22;
      const cx = (c) => OX + c * P, cy = (r) => OY + r * P;
      for (let r = 0; r < data.rows; r++) el("line", { x1: cx(0), x2: cx(data.cols - 1), y1: cy(r), y2: cy(r), class: "hp-lat" }, mesh);
      for (let c = 0; c < data.cols; c++) el("line", { x1: cx(c), x2: cx(c), y1: cy(0), y2: cy(data.rows - 1), class: "hp-lat" }, mesh);
      cur.route = el("polyline", { class: "hp-route", points: "" }, mesh);
      for (const s of data.stops) {
        el("rect", { x: cx(s.col) - S / 2, y: cy(s.row) - S / 2, width: S, height: S, rx: 4, class: "hp-mc" }, mesh);
        el("text", { x: cx(s.col) - S / 2 + 3, y: cy(s.row) - S / 2 + 10, class: "hp-mc-t" }, mesh).textContent = s.label;
      }
      cur.tiles = {};
      for (const t of data.tiles) {
        const x = cur.byHome[t.cpu];
        const core = t.cpu === cur.a || t.cpu === cur.b;
        const g = el("g", { class: "hp-tile" + (core ? " is-core" : ""), tabindex: "0", role: "button" }, mesh);
        g.dataset.home = t.cpu;
        el("rect", { x: cx(t.col) - P / 2, y: cy(t.row) - P / 2, width: P, height: P, fill: "transparent", class: "hp-hit" }, g);
        el("rect", { x: cx(t.col) - S / 2, y: cy(t.row) - S / 2, width: S, height: S, rx: 4, fill: x ? ramp(x.hops) : "#161916" }, g);
        const dark = x && (x.hops - 1) / (MAX_HOPS - 1) > 0.5;
        if (dark) g.classList.add("is-dark");
        el("text", { x: cx(t.col) - S / 2 + 3.5, y: cy(t.row) - S / 2 + 11, class: "hp-num" }, g).textContent = t.cpu;
        if (core) el("text", { x: cx(t.col) + S / 2 - 3.5, y: cy(t.row) + S / 2 - 4, "text-anchor": "end", class: "hp-role" }, g)
          .textContent = t.cpu === cur.a ? "A" : "B";
        g.setAttribute("aria-label", x ? `home ${t.cpu}: ${x.med.toFixed(1)} ns, ${x.hops} hops` : `tile ${t.cpu}: no lines`);
        g.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse" && x && hover !== t.cpu) { hover = t.cpu; paint(); } });
        g.addEventListener("click", () => { if (x) toggle(t.cpu); });
        g.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && x) { e.preventDefault(); toggle(t.cpu); } });
        cur.tiles[t.cpu] = g;
      }
      cur.cxy = (cpu) => [cx(pos[cpu][1]), cy(pos[cpu][0])];
      mesh.onpointerleave = () => { if (hover != null) { hover = null; paint(); } };
    }

    function toggle(h) {
      sel = sel === h ? null : h;
      hover = null;
      paint();
    }

    // vertical first, then along the row (the mesh's routing)
    function route(a, b) {
      const [r0, c0] = pos[a], [r1, c1] = pos[b];
      return [[r0, c0], [r1, c0], [r1, c1]];
    }

    function paint() {
      const act = hover != null ? hover : sel;
      root.classList.toggle("has-pick", act != null);
      for (const r of cur.segs) r.classList.toggle("is-on", +r.dataset.home === act);
      for (const h in cur.tiles) {
        const g = cur.tiles[h];
        g.classList.toggle("is-on", +h === act);
        g.setAttribute("aria-pressed", +h === sel ? "true" : "false");
      }
      select.value = sel == null ? "" : String(sel);
      if (act == null) {
        cur.route.setAttribute("points", "");
        out.innerHTML = "";
        html("span", null, out, `best ${cur.best.toFixed(1)} ns · mean ${cur.mean.toFixed(1)} ns  `);
        html("span", "hp-hint", out, "pick a home");
        return;
      }
      const x = cur.byHome[act];
      const pts = [...route(cur.a, act), ...route(act, cur.b).slice(1)].map(([r, c]) => {
        const cpu = data.tiles.find((t) => t.row === r && t.col === c);
        return cpu ? cur.cxy(cpu.cpu) : [25 + c * 40, 22 + r * 40];
      });
      cur.route.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
      out.innerHTML = "";
      html("strong", null, out, `home ${act}`);
      html("span", null, out, `  ·  ${x.up} + ${x.down} hops  ·  ${x.med.toFixed(1)} ns`
        + `  ·  ${x.med - cur.best < 0.05 ? "best" : "+" + (x.med - cur.best).toFixed(1) + " vs best"}`);
    }

    setPair(Math.max(0, pairs.findIndex((p) => p.a === +root.dataset.a && p.b === +root.dataset.b)));
  }

  for (const root of document.querySelectorAll("[data-homes-src]")) {
    // whatever is inside the root (the static figure) stays until the data has loaded
    fetch(root.dataset.homesSrc).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((d) => mount(root, d))
      .catch((e) => console.warn("home picker: keeping the static figure", e));
  }
})();
