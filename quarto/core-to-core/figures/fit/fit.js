/* Fit explorer: latency against route length d(B,H) + d(H,A), every core pair and every home on
   diomedea. Hover, tap or arrow through a route length; the side panel shows that length's full
   distribution against the fit. Data: fit.json (fit_data.py). No dependencies.
   Markup: <div data-fit-src="fit.json">fallback</div>; the fallback stays until the data has loaded. */
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
  const DX = { "chase-read": -0.12, cas: 0.12 };

  function mount(root, data) {
    root.classList.add("fx");
    root.innerHTML = "";
    const bar = html("div", "fx-bar", root);
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Benchmark");
    const on = {};
    const chips = data.modes.map((m) => {
      on[m.id] = true;
      const b = html("button", `fx-chip fx-${m.id}`, bar);
      b.type = "button";
      html("span", "fx-chip-v", b, m.name);
      html("span", "fx-k", b, `${m.c.toFixed(1)} + ${m.k.toFixed(2)} ns/hop`);
      b.addEventListener("click", () => {
        if (on[m.id] && Object.values(on).filter(Boolean).length === 1) return; // keep one on
        on[m.id] = !on[m.id];
        draw();
      });
      return [m.id, b];
    });

    const svg = el("svg", { class: "fx-svg", viewBox: "0 0 820 300", role: "img", tabindex: "0" }, root);
    svg.setAttribute("aria-label", "Latency against route length through the home; arrow keys pick a route length");
    const out = html("p", "fx-out", root);
    out.setAttribute("aria-live", "polite");

    const L = 50, R = 568, T = 22, B = 250, PL = 600, PR = 808;
    const Smin = 0, Smax = 22;
    const lo = Math.floor(Math.min(...data.modes.map((m) => m.lo)) / 5) * 5;
    const hi = Math.ceil(Math.max(...data.modes.map((m) => m.hi)) / 5) * 5;
    const X = (s) => L + (s - Smin) / (Smax - Smin) * (R - L);
    const Y = (ns) => B - (ns - lo) / (hi - lo) * (B - T);
    const all = [...new Set(data.modes.flatMap((m) => m.cols.map((c) => c.s)))].sort((a, b) => a - b);
    let pick = all[Math.floor(all.length / 3)];

    function draw() {
      chips.forEach(([id, b]) => { b.classList.toggle("is-active", on[id]); b.setAttribute("aria-pressed", on[id] ? "true" : "false"); });
      svg.innerHTML = "";
      for (let v = lo; v <= hi; v += 5) {
        el("line", { x1: L, x2: R, y1: Y(v), y2: Y(v), class: "fx-grid" }, svg);
        el("line", { x1: PL, x2: PR, y1: Y(v), y2: Y(v), class: "fx-grid" }, svg);
        el("text", { x: L - 8, y: Y(v) + 4, "text-anchor": "end", class: "fx-tick" }, svg).textContent = v;
      }
      for (let s = 0; s <= Smax; s += 2)
        el("text", { x: X(s), y: B + 18, "text-anchor": "middle", class: "fx-tick" }, svg).textContent = s;
      el("text", { x: (L + R) / 2, y: B + 38, "text-anchor": "middle", class: "fx-axis" }, svg).textContent = "route length d(B,H) + d(H,A), hops";
      el("text", { x: 14, y: (T + B) / 2, "text-anchor": "middle", class: "fx-axis", transform: `rotate(-90 14 ${(T + B) / 2})` }, svg).textContent = "ns";
      const sel = el("rect", { x: X(pick) - 0.5 * (X(1) - X(0)), y: T, width: X(1) - X(0), height: B - T, class: "fx-sel" }, svg);
      const w = (X(1) - X(0)) * 0.3;
      for (const m of data.modes) {
        if (!on[m.id]) continue;
        const g = el("g", { class: `fx-mode fx-${m.id}` }, svg);
        for (const c of m.cols) {
          const x = X(c.s + DX[m.id]);
          el("rect", { x: x - w / 2, y: Y(c.p90), width: w, height: Math.max(1, Y(c.p10) - Y(c.p90)), class: "fx-band" }, g);
          el("circle", { cx: x, cy: Y(c.mean), r: 3.6, class: "fx-dot" }, g);
        }
        el("line", { x1: X(0.5), x2: X(21.5), y1: Y(m.c + m.k * 0.5), y2: Y(m.c + m.k * 21.5), class: "fx-fit" }, g);
      }
      // hit targets: one column per route length
      for (const s of all) {
        const r = el("rect", { x: X(s) - 0.5 * (X(1) - X(0)), y: T, width: X(1) - X(0), height: B - T + 24, class: "fx-hit" }, svg);
        r.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") set(s); });
        r.addEventListener("click", () => set(s));
      }
      panel(sel);
    }

    function panel(sel) {
      sel.setAttribute("x", X(pick) - 0.5 * (X(1) - X(0)));
      const old = svg.querySelector(".fx-panel");
      if (old) old.remove();
      const g = el("g", { class: "fx-panel" }, svg);
      el("text", { x: PL, y: T - 8, class: "fx-ptitle" }, g).textContent = `${pick} hops`;
      el("text", { x: (PL + PR) / 2, y: B + 38, "text-anchor": "middle", class: "fx-axis" }, g).textContent = "pairs × homes";
      el("line", { x1: PL, x2: PL, y1: T, y2: B, class: "fx-base" }, g);
      const parts = [];
      for (const m of data.modes) {
        if (!on[m.id]) continue;
        const c = m.cols.find((q) => q.s === pick);
        if (!c) continue;
        const top = Math.max(...c.hist);
        const mg = el("g", { class: `fx-mode fx-${m.id}` }, g);
        const bh = Math.max(1, Y(lo) - Y(lo + data.bin) - 0.6);
        c.hist.forEach((n, j) => {
          if (!n) return;
          const v = m.lo + j * data.bin;
          el("rect", { x: PL + 1, y: Y(v + data.bin) + 0.3, width: n / top * (PR - PL - 4), height: bh, class: "fx-hbar" }, mg);
        });
        const f = m.c + m.k * pick;
        el("line", { x1: PL, x2: PR, y1: Y(f), y2: Y(f), class: "fx-fit" }, mg);
        parts.push(`${m.name}: ${c.n.toLocaleString()} pair·home samples, mean ${c.mean.toFixed(1)} ns against fit ${f.toFixed(1)}, 10–90% ${c.p10.toFixed(1)}–${c.p90.toFixed(1)}`);
      }
      out.textContent = `Route length ${pick} hops · ${parts.join(" · ")}`;
    }

    function set(s) {
      if (s === pick) return;
      pick = s;
      panel(svg.querySelector(".fx-sel"));
    }
    svg.addEventListener("keydown", (e) => {
      const i = all.indexOf(pick);
      if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); set(all[Math.min(all.length - 1, i + 1)]); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); set(all[Math.max(0, i - 1)]); }
      else if (e.key === "Home") { e.preventDefault(); set(all[0]); }
      else if (e.key === "End") { e.preventDefault(); set(all[all.length - 1]); }
    });
    draw();
  }

  for (const root of document.querySelectorAll("[data-fit-src]")) {
    fetch(root.dataset.fitSrc).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((d) => mount(root, d))
      .catch((e) => console.warn("fit explorer: keeping the static figure", e));
  }
})();
