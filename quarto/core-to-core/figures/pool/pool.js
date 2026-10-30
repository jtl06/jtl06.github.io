/* Pool sweep: drag the number of lines per trial and watch the 1024 trial means tighten.
   Data: poolsweep.json (pool_data.py): per N, each trial's mean and best line, and a histogram of
   every line measured at that N (the grey layer, scaled to the same area as the 1024 trials, so
   N = 1 lands on top of it). The static figure inside the root
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
  const stats = (v) => {
    const n = v.length, m = v.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / (n - 1));
    const s = [...v].sort((a, b) => a - b);
    return { m, sd, med: s[n >> 1], p5: s[Math.round(0.05 * (n - 1))], p95: s[Math.round(0.95 * (n - 1))] };
  };

  function mount(root, data) {
    const Ns = Object.keys(data.trials).map(Number).sort((a, b) => a - b);
    const LO = 39, HI = 62, BIN = 0.25;
    const nb = Math.round((HI - LO) / BIN);
    root.classList.add("ps");
    root.innerHTML = "";
    const bar = html("div", "ps-bar", root);
    const lab = html("label", "ps-lab", bar);
    html("span", "ps-k", lab, "lines per trial");
    const val = html("span", "ps-n", lab, "");
    const slider = html("input", "ps-slider", lab);
    slider.type = "range"; slider.min = 0; slider.max = Ns.length - 1; slider.step = 1; slider.value = 0;
    slider.setAttribute("aria-label", "lines per trial");
    const ticks = html("div", "ps-ticks", bar);
    Ns.forEach((n) => html("span", null, ticks, String(n)));

    const svg = el("svg", { class: "ps-svg", viewBox: "0 0 820 250", role: "img" }, root);
    const L = 44, R = 808, T = 14, B = 206;
    const X = (ns) => L + (ns - LO) / (HI - LO) * (R - L);
    for (let v = 40; v <= 60; v += 5) {
      el("line", { x1: X(v), x2: X(v), y1: T, y2: B, class: "ps-grid" }, svg);
      el("text", { x: X(v), y: B + 19, "text-anchor": "middle", class: "ps-tick" }, svg).textContent = v;
    }
    el("text", { x: (L + R) / 2, y: B + 40, "text-anchor": "middle", class: "ps-axis" }, svg).textContent =
      "ns per handoff, one trial = one million handoffs over N lines";
    const ylab = el("text", { x: 12, y: (T + B) / 2, "text-anchor": "middle", class: "ps-axis", transform: `rotate(-90 12 ${(T + B) / 2})` }, svg);
    ylab.textContent = "trials";
    const raw = el("g", {}, svg);      // every line measured at this N, scaled to the trials' area
    const bars = el("g", {}, svg);
    const bestG = el("g", {}, svg);
    el("line", { x1: L, x2: R, y1: B, y2: B, class: "ps-base" }, svg);
    const out = html("p", "ps-out", root);
    out.setAttribute("aria-live", "polite");

    // y scale fixed across N, so the tightening is visible
    let top = 0;
    for (const n of Ns) {
      const c = new Array(nb).fill(0);
      for (const [m] of data.trials[n]) c[Math.min(nb - 1, Math.max(0, Math.floor((m - LO) / BIN)))]++;
      top = Math.max(top, ...c);
    }
    const Y = (k) => B - k / top * (B - T);
    function drawRaw(n) {
      raw.innerHTML = "";
      const c = data.lines && data.lines[n];
      if (!c) return;
      const total = c.reduce((a, b) => a + b, 0), k = data.trials[n].length / total, w = (R - L) / nb;
      c.forEach((m, j) => { if (m) el("rect", { x: L + j * w + 0.5, y: Y(m * k), width: Math.max(1, w - 1), height: B - Y(m * k), class: "ps-raw" }, raw); });
    }
    const key = html("div", "ps-key", root);
    html("span", "ps-key-raw", key, "individual lines measured at this N");
    html("span", "ps-key-mean", key, "what each trial reports: the mean of N lines");

    function show(i) {
      const n = Ns[i];
      val.textContent = n.toLocaleString();
      const rows = data.trials[n];
      drawRaw(n);
      const means = rows.map((r) => r[0]), bests = rows.map((r) => r[1]);
      const c = new Array(nb).fill(0);
      for (const m of means) c[Math.min(nb - 1, Math.max(0, Math.floor((m - LO) / BIN)))]++;
      bars.innerHTML = "";
      const w = (R - L) / nb;
      c.forEach((k, j) => {
        if (k) el("rect", { x: L + j * w + 0.5, y: Y(k), width: Math.max(1, w - 1), height: B - Y(k), class: "ps-bar" }, bars);
      });
      const sm = stats(means), sb = stats(bests);
      bestG.innerHTML = "";
      el("line", { x1: X(sb.med), x2: X(sb.med), y1: T + 6, y2: B, class: "ps-best" }, bestG);
      el("text", { x: X(sb.med), y: T + 2, "text-anchor": "middle", class: "ps-best-t" }, bestG).textContent = `best line ${sb.med.toFixed(1)}`;
      el("line", { x1: X(sm.m), x2: X(sm.m), y1: T + 6, y2: B, class: "ps-mean" }, bestG);
      el("text", { x: X(sm.m) + 5, y: T + 2, "text-anchor": "start", class: "ps-mean-t" }, bestG).textContent = `mean ${sm.m.toFixed(1)}`;
      out.textContent = n === 1
        ? `1 line per trial: each trial is one line, so the means are the raw values: ${sm.p5.toFixed(1)}–${sm.p95.toFixed(1)} ns (5th–95th), SD ${sm.sd.toFixed(2)}`
        : `${n.toLocaleString()} lines per trial: trial means ${sm.p5.toFixed(1)}–${sm.p95.toFixed(1)} ns (5th–95th), SD ${sm.sd.toFixed(2)} ns · best line in a trial ${sb.med.toFixed(1)} ns`;
      root.dataset.n = n;
    }
    slider.addEventListener("input", () => show(+slider.value));
    show(0);
  }

  for (const root of document.querySelectorAll("[data-pool-src]")) {
    fetch(root.dataset.poolSrc).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((d) => mount(root, d))
      .catch((e) => console.warn("pool sweep: keeping the static figure", e));
  }
})();
