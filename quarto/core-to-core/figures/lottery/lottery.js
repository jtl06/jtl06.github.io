/* Allocation lottery: allocate a line for one core pair and see what CAS handoff it gives. Each draw
   is one of c2cbench's 256 measured lines for that pair (diomedea, load clocks), so the default is a
   draw from the real distribution; "timed pick" draws 32 lines and keeps the fastest, as the timed
   placement does. Draws stack as dots over the faint histogram of all 256 lines.
   Data: the home picker's homes.json. No dependencies.
   Markup: <div data-lottery-src="homes.json">fallback</div>; the fallback stays until the data has loaded. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
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
  const K = 32, BIN = 0.5;
  const stat = (v) => {
    const n = v.length, m = v.reduce((a, b) => a + b, 0) / n;
    return { n, m, sd: n > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : 0 };
  };

  function mount(root, data) {
    root.classList.add("lt");
    root.innerHTML = "";
    const bar = html("div", "lt-bar", root);
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Core pair");
    const acts = html("div", "lt-acts", root);
    const mk = (label, fn, cls) => {
      const b = html("button", "lt-btn" + (cls ? " " + cls : ""), acts, label);
      b.type = "button";
      b.addEventListener("click", fn);
      return b;
    };
    const svg = el("svg", { class: "lt-svg", viewBox: "0 0 820 250", role: "img" }, root);
    const out = html("p", "lt-out", root);
    out.setAttribute("aria-live", "polite");
    let cur = 0, draws = [], picks = [], last = null;

    const chips = data.pairs.map((p, i) => {
      const b = html("button", "lt-chip", bar);
      b.type = "button";
      html("span", "lt-chip-v", b, `CPUs ${p.a}·${p.b}`);
      const v = p.lines.map((l) => l[1]);
      html("span", "lt-k", b, `${Math.min(...v).toFixed(0)}–${Math.max(...v).toFixed(0)} ns`);
      b.addEventListener("click", () => { cur = i; draws = []; picks = []; last = null; draw(); });
      return b;
    });
    const pickLine = (p) => p.lines[Math.floor(Math.random() * p.lines.length)];
    const allocate = (n) => {
      const p = data.pairs[cur];
      for (let i = 0; i < n; i++) { last = { kind: "default", line: pickLine(p) }; draws.push(last.line[1]); }
      draw();
    };
    const timed = (n) => {
      const p = data.pairs[cur];
      for (let i = 0; i < n; i++) {
        let best = null;
        for (let j = 0; j < K; j++) { const l = pickLine(p); if (!best || l[1] < best[1]) best = l; }
        last = { kind: "timed", line: best };
        picks.push(best[1]);
      }
      draw();
    };
    mk("allocate", () => allocate(1));
    mk("× 16", () => allocate(16));
    mk(`timed pick (fastest of ${K})`, () => timed(1), "lt-pla");
    mk("× 16", () => timed(16), "lt-pla");
    mk("reset", () => { draws = []; picks = []; last = null; draw(); }, "lt-reset");

    function draw() {
      chips.forEach((b, i) => { b.classList.toggle("is-active", i === cur); b.setAttribute("aria-pressed", i === cur ? "true" : "false"); });
      const p = data.pairs[cur];
      const v = p.lines.map((l) => l[1]);
      const lo = Math.floor(Math.min(...v) - 1), hi = Math.ceil(Math.max(...v) + 1);
      const L = 40, R = 808, T = 12, B = 206;
      const X = (ns) => L + (ns - lo) / (hi - lo) * (R - L);
      svg.innerHTML = "";
      svg.setAttribute("aria-label", `CPUs ${p.a} and ${p.b}: ${draws.length} allocations, ${picks.length} timed picks`);
      const step = hi - lo > 30 ? 10 : 5;
      for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) {
        el("line", { x1: X(t), x2: X(t), y1: T, y2: B, class: "lt-grid" }, svg);
        el("text", { x: X(t), y: B + 18, "text-anchor": "middle", class: "lt-tick" }, svg).textContent = t;
      }
      el("text", { x: (L + R) / 2, y: B + 38, "text-anchor": "middle", class: "lt-axis" }, svg).textContent = "CAS handoff, ns, one line";
      // faint histogram of all 256 lines, scaled to the plot height
      const nb = Math.ceil((hi - lo) / BIN), hist = new Array(nb).fill(0);
      for (const x of v) hist[Math.min(nb - 1, Math.floor((x - lo) / BIN))]++;
      const top = Math.max(...hist), bw = (R - L) / nb;
      hist.forEach((n, j) => { if (n) el("rect", { x: L + j * bw + 0.5, y: B - n / top * (B - T), width: Math.max(1, bw - 1), height: n / top * (B - T), class: "lt-all" }, svg); });
      el("line", { x1: L, x2: R, y1: B, y2: B, class: "lt-base" }, svg);
      // dots: defaults and timed picks stacked per bin; spacing shrinks if a stack gets tall
      const stacks = new Map();
      const all = [...draws.map((x) => [x, "lt-def"]), ...picks.map((x) => [x, "lt-pla"])];
      for (const [x] of all) { const j = Math.floor((x - lo) / BIN); stacks.set(j, (stacks.get(j) || 0) + 1); }
      const tall = Math.max(1, ...stacks.values()), dy = Math.min(7, (B - T - 6) / tall), r = Math.max(1.6, Math.min(3, dy / 2));
      const h = new Map();
      for (const [x, cls] of all) {
        const j = Math.floor((x - lo) / BIN), k = h.get(j) || 0;
        h.set(j, k + 1);
        el("circle", { cx: L + (j + 0.5) * bw, cy: B - 4 - k * dy, r, class: cls }, svg);
      }
      if (last) {
        const x = X(last.line[1]);
        el("line", { x1: x, x2: x, y1: T, y2: B, class: "lt-last" }, svg);
      }
      const best = Math.min(...v), sd = stat(draws), sp = stat(picks);
      const parts = [];
      if (last) parts.push(`${last.kind === "timed" ? "timed pick" : "allocation"}: ${last.line[1].toFixed(1)} ns, line homed on tile ${last.line[0]}`);
      if (draws.length) parts.push(`${draws.length} allocation${draws.length > 1 ? "s" : ""}: mean ${sd.m.toFixed(1)} ns${sd.n > 1 ? `, SD ${sd.sd.toFixed(1)}` : ""}`);
      if (picks.length) parts.push(`${picks.length} timed pick${picks.length > 1 ? "s" : ""}: mean ${sp.m.toFixed(1)} ns${sp.n > 1 ? `, SD ${sp.sd.toFixed(1)}` : ""}`);
      out.textContent = parts.length ? `${parts.join(" · ")} · best of all 256: ${best.toFixed(1)} ns`
        : `CPUs ${p.a} and ${p.b}: 256 measured lines, ${best.toFixed(1)}–${Math.max(...v).toFixed(1)} ns. Allocate a line, or time ${K} and keep the fastest.`;
    }
    draw();
  }

  for (const root of document.querySelectorAll("[data-lottery-src]")) {
    fetch(root.dataset.lotterySrc).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((d) => mount(root, d))
      .catch((e) => console.warn("lottery: keeping the static figure", e));
  }
})();
