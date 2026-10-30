/* Placement: rigtorp::SPSCQueue round trips per core pair, default vs placed lines, 10 rounds per
   pair (every queue rebuilt each round), on five machines. Data: placement.json. Pick a machine;
   hover or tap a pair. The faint bands are the 10 rounds' range. The static figure inside the root
   stays until the data has loaded. No dependencies. */
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
  const psd = (v) => { const mu = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / v.length); };
  const median = (v) => { const s = [...v].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

  function mount(root, data) {
    root.classList.add("pl");
    root.innerHTML = "";
    const bar = html("div", "pl-bar", root);
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Machine");
    const svg = el("svg", { class: "pl-svg", viewBox: "0 0 820 300", role: "img" }, root);
    const out = html("p", "pl-out", root);
    out.setAttribute("aria-live", "polite");
    let cur = 0, pick = null;
    const chips = data.machines.map((m, i) => {
      const b = html("button", "pl-chip", bar);
      b.type = "button";
      html("span", "pl-chip-v", b, m.short || m.name);
      const ch = median(m.pairs.map((p) => p.placed.median / p.default.median - 1));
      html("span", "pl-k", b, `${m.pairs.length} pairs · ${(ch * 100).toFixed(0)}%`);
      b.addEventListener("click", () => { cur = i; pick = null; draw(); });
      return b;
    });

    function draw() {
      chips.forEach((b, i) => { b.classList.toggle("is-active", i === cur); b.setAttribute("aria-pressed", i === cur ? "true" : "false"); });
      const m = data.machines[cur];
      const pairs = m.pairs.slice().sort((p, q) => p.default.median - q.default.median);
      svg.innerHTML = "";
      svg.setAttribute("aria-label", `${m.name}: round trip per pair, default and placed`);
      const L = 60, R = 808, T = 12, B = 262;
      const allv = pairs.flatMap((p) => [...p.default.rounds, ...p.placed.rounds, p.default.median, p.placed.median]);
      const lo = Math.floor(Math.min(...allv) / 50) * 50;
      const hi = Math.ceil(Math.max(...allv) / 50) * 50;
      const X = (ns) => L + (ns - lo) / (hi - lo) * (R - L);
      const step = hi - lo > 300 ? 100 : 50;
      for (let v = lo; v <= hi; v += step) {
        el("line", { x1: X(v), x2: X(v), y1: T, y2: B, class: "pl-grid" }, svg);
        el("text", { x: X(v), y: B + 18, "text-anchor": "middle", class: "pl-tick" }, svg).textContent = v;
      }
      el("text", { x: (L + R) / 2, y: B + 36, "text-anchor": "middle", class: "pl-axis" }, svg).textContent = "rigtorp::SPSCQueue round trip, ns";
      const rowH = (B - T) / pairs.length;
      pairs.forEach((p, k) => {
        const y = T + rowH * (k + 0.5);
        const g = el("g", { class: "pl-row", tabindex: "0", role: "button" }, svg);
        g.dataset.i = k;
        el("rect", { x: 0, y: y - rowH / 2, width: 820, height: rowH, fill: "transparent" }, g);
        el("text", { x: L - 8, y: y + 3.5, "text-anchor": "end", class: "pl-pair" }, g).textContent = `${p.a}·${p.b}`;
        for (const [key, cls] of [["default", "pl-def"], ["placed", "pl-pla"]]) {
          const r = p[key].rounds;
          el("line", { x1: X(Math.min(...r)), x2: X(Math.max(...r)), y1: y, y2: y, class: `pl-rng ${cls}` }, g);
        }
        el("line", { x1: X(p.default.median), x2: X(p.placed.median), y1: y, y2: y, class: "pl-link" }, g);
        el("circle", { cx: X(p.default.median), cy: y, r: 4, class: "pl-def" }, g);
        el("circle", { cx: X(p.placed.median), cy: y, r: 4, class: "pl-pla" }, g);
        g.setAttribute("aria-label", `CPUs ${p.a} and ${p.b}: ${p.default.median.toFixed(0)} to ${p.placed.median.toFixed(0)} ns`);
        const set = () => { pick = k; paint(pairs); };
        g.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") set(); });
        g.addEventListener("click", set);
        g.addEventListener("focus", set);
        g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); set(); } });
      });
      svg.addEventListener("pointerleave", () => { pick = null; paint(pairs); });
      paint(pairs);
    }

    function paint(pairs) {
      const m = data.machines[cur];
      for (const g of svg.querySelectorAll(".pl-row")) g.classList.toggle("is-on", +g.dataset.i === pick);
      if (pick == null) {
        const ch = median(pairs.map((p) => p.placed.median / p.default.median - 1));
        const d = median(pairs.map((p) => p.default.median)), pl = median(pairs.map((p) => p.placed.median));
        const t = median(pairs.map((p) => p.placed.p999 / p.default.p999 - 1));
        const r2r = (v) => median(pairs.map((p) => psd(p[v].rounds)));
        const nr = pairs[0].default.rounds.length;
        const won = pairs.reduce((s, p) => s + p.placed.rounds.filter((x, i) => x < p.default.rounds[i]).length, 0);
        out.textContent = `${m.name}: ${pairs.length} producer · consumer pairs × ${nr} rounds, round trip ${d.toFixed(0)} → ${pl.toFixed(0)} ns (${(ch * 100).toFixed(0)}% median, ${(t * 100).toFixed(0)}% at p99.9); placed faster in ${won} of ${pairs.length * nr} rounds; run-to-run SD per pair ${r2r("default").toFixed(0)} → ${r2r("placed").toFixed(0)} ns. Hover a pair.`;
        return;
      }
      const p = pairs[pick];
      const rng = (r) => `${Math.min(...r).toFixed(0)}–${Math.max(...r).toFixed(0)}`;
      out.textContent = `producer CPU ${p.a}, consumer CPU ${p.b}: median ${p.default.median.toFixed(0)} → ${p.placed.median.toFixed(0)} ns (${((p.placed.median / p.default.median - 1) * 100).toFixed(0)}%) · p99 ${p.default.p99.toFixed(0)} → ${p.placed.p99.toFixed(0)} · p99.9 ${p.default.p999.toFixed(0)} → ${p.placed.p999.toFixed(0)} · over ${p.default.rounds.length} rounds ${rng(p.default.rounds)} → ${rng(p.placed.rounds)} (SD ${psd(p.default.rounds).toFixed(0)} → ${psd(p.placed.rounds).toFixed(0)})`;
    }
    draw();
  }

  for (const root of document.querySelectorAll("[data-place-src]")) {
    fetch(root.dataset.placeSrc).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((d) => mount(root, d))
      .catch((e) => console.warn("placement: keeping the static figure", e));
  }
})();
