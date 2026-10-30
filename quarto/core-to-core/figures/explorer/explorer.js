// Mesh explorer: pick two of writer (A), reader (B) and home (H) on the tile
// grid; every tile is shaded by the latency it would give in the third role.
// With all three set, the transfer's four steps are drawn along the mesh, and
// "play" animates them in order. In CAS mode the request and snoop are drawn
// as already in flight: the waiting core's request is queued at the home while
// the other core still holds the line, so only data and forward are exposed.
// Mounts on every element with [data-mesh-explorer] (or #mesh-explorer);
// data-src points at the JSON from c2c-research/analysis/explorer_data.py.
// Put the static figure (an <img>) inside the element: it is replaced only once the data has loaded.
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const U = 100; // grid pitch, viewBox units
  const S = 50; // tile size; the whole U x U cell is the click target
  const ROLES = ["A", "B", "H"];
  const NAME = { A: "writer", B: "reader", H: "home" };
  const MODES = { chase: "one-way read", cas: "CAS handoff" };
  // The four steps of a transfer: from, to, colour, name, (unused), caption.
  // Each step's lane offsets are chosen per transfer in nest().
  const STEPS = [
    ["B", "H", "--external", "request", null, "B asks H for the line"],
    ["H", "A", "--date", "snoop", null, "H asks A for it"],
    ["A", "H", "--accent", "data", null, "A sends it to H"],
    ["H", "B", "--cursor", "forward", null, "H sends it to B"],
  ];
  // CAS: the first two steps happen during the previous handoff
  const CAS_TEXT = [
    "already in flight from the last handoff",
    "already waiting at A",
  ];
  const HOP_MS = 170; // playback: time per hop, plus a fixed pause per step
  const STEP_MS = 420;

  const svg = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const html = (tag, cls, text, parent) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, t) => "#" + a.map((x, i) => Math.round(x + (b[i] - x) * t).toString(16).padStart(2, "0")).join("");

  function mount(root, data) {
    const css = getComputedStyle(root);
    const tok = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    const C = {
      bg: tok("--background", "#090a09"),
      surface: tok("--surface", "#111311"),
      border: tok("--border", "#202320"),
      text: tok("--text", "#e3d6bc"),
      subtle: tok("--subtle", "#8f8776"),
      A: tok("--mx-a", "#e8957a"), // writer: orange
      B: tok("--mx-b", "#4c9fe0"), // reader: blue, both apart from the green shading and the route colours
      H: tok("--mx-home", "#fff3c4"),
      fast: hex(tok("--accent", "#a9bd52")),
      slow: hex(tok("--mx-slow", "#1e2318")),
    };
    const stepColor = STEPS.map(([, , v]) => tok(v, "#a9bd52"));
    const n = data.tiles.length;
    const pos = {};
    const at = {};
    for (const [cpu, r, c] of data.tiles) {
      pos[cpu] = [r, c];
      at[r + "," + c] = cpu;
    }
    const dist = (x, y) => Math.abs(pos[x][0] - pos[y][0]) + Math.abs(pos[x][1] - pos[y][1]);
    const st = {
      A: +(root.dataset.a ?? 0), B: +(root.dataset.b ?? 1), H: null,
      active: "H", mode: "chase", hover: null, step: null, touched: false, play: null,
    };
    const reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const value = (t) => {
      const v = data[st.mode][(t.A * n + t.B) * n + t.H];
      return v < 0 ? null : v / 10;
    };

    root.classList.add("mx");
    root.textContent = "";
    const bar = html("div", "mx-bar", null, root);
    const chips = {};
    for (const r of ROLES) {
      const b = html("button", "mx-chip", null, bar);
      b.type = "button";
      b.addEventListener("click", () => {
        st.active = r;
        draw();
      });
      chips[r] = b;
    }
    const modes = html("div", "mx-modes", null, bar);
    const modeButtons = {};
    for (const m in MODES) {
      const b = html("button", "mx-mode", MODES[m], modes);
      b.type = "button";
      b.addEventListener("click", () => {
        st.mode = m;
        st.play = null;
        draw();
      });
      modeButtons[m] = b;
    }

    // drawing: tiles at (col * U, row * U); measured non-CHA stops (memory controllers) labelled
    const top = -U / 2;
    const mem = {};
    for (const s of data.stops || []) mem[s.row + "," + s.col] = s.label;
    const box = svg("svg", { viewBox: `${-U / 2} ${top} ${data.cols * U} ${data.rows * U - top - U / 2}`, class: "mx-svg", role: "img" }, root);
    box.setAttribute("aria-label", `Mesh of ${data.machine}: ${data.rows} rows by ${data.cols} columns of tiles`);
    const defs = svg("defs", {}, box);
    stepColor.forEach((col, i) => {
      const m = svg("marker", { id: `mx-arrow-${i}`, viewBox: "0 0 10 10", refX: 6, refY: 5, markerWidth: 3.4, markerHeight: 3.4, orient: "auto-start-reverse" }, defs);
      svg("path", { d: "M0,0 L10,5 L0,10 z", fill: col }, m);
    });
    const links = svg("g", {}, box);
    const line = (x1, y1, x2, y2) => svg("line", { x1, y1, x2, y2, stroke: C.border, "stroke-width": 2 }, links);
    for (let r = 0; r < data.rows; r++)
      for (let c = 0; c < data.cols; c++) {
        if (c + 1 < data.cols) line(c * U, r * U, (c + 1) * U, r * U);
        if (r + 1 < data.rows) line(c * U, r * U, c * U, (r + 1) * U);
      }
    const tilesG = svg("g", {}, box);
    const routeG = svg("g", { "pointer-events": "none" }, box);
    const textG = svg("g", { "pointer-events": "none" }, box); // labels stay readable over routes
    const tiles = {};
    let leaveFrame = 0;
    for (let r = 0; r < data.rows; r++)
      for (let c = 0; c < data.cols; c++) {
        const cpu = at[r + "," + c];
        const x = c * U - S / 2;
        const y = r * U - S / 2;
        if (cpu == null) {
          // a stop with no CHA: a labelled memory controller, otherwise just the lattice crossing
          if (mem[r + "," + c]) {
            svg("rect", { x, y, width: S, height: S, rx: 7, fill: C.bg, stroke: "#4a463d", "stroke-width": 1.5 }, tilesG);
            const t = svg("text", { x: x + 5, y: y + 14, class: "mx-cpu", fill: C.subtle }, textG);
            t.textContent = mem[r + "," + c];
          }
          continue;
        }
        const g = svg("g", { class: "mx-tile", tabindex: 0, role: "button" }, tilesG);
        svg("rect", { x: c * U - U / 2, y: r * U - U / 2, width: U, height: U, fill: "transparent" }, g);
        const rect = svg("rect", { x, y, width: S, height: S, rx: 7 }, g);
        // CPU number in the corner, role letter in the centre
        const label = svg("text", { x: x + 5, y: y + 14, class: "mx-cpu" }, textG);
        label.textContent = cpu;
        const roles = svg("text", { x: c * U, y: r * U + 11, class: "mx-role", "text-anchor": "middle" }, textG);
        const val = svg("text", { x: c * U, y: r * U + 6, class: "mx-val", "text-anchor": "middle" }, textG);
        g.addEventListener("click", () => pick(cpu));
        g.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick(cpu);
          }
        });
        g.addEventListener("pointerenter", (e) => {
          if (e.pointerType === "mouse" && !(st.play && !st.play.done)) {
            cancelAnimationFrame(leaveFrame);
            st.hover = cpu;
            if (st.play) st.play = null;
            draw();
          }
        });
        g.addEventListener("pointerleave", () => {
          if (st.hover !== cpu || (st.play && !st.play.done)) return;
          // clear on the next frame, so moving straight onto a neighbouring tile never draws a blank frame
          leaveFrame = requestAnimationFrame(() => {
            if (st.hover === cpu) {
              st.hover = null;
              draw();
            }
          });
        });
        tiles[cpu] = { rect, label, roles, val, g };
      }

    const out = html("div", "mx-out", null, root);
    const main = html("p", "mx-main", null, out);
    const detail = html("p", "mx-detail", null, out);
    const steps = html("div", "mx-steps", null, out);
    const playButton = html("button", "mx-step mx-play", "▶ play", steps);
    playButton.type = "button";
    playButton.addEventListener("click", () => (st.play && !st.play.done ? stop() : start()));
    const stepButtons = STEPS.map(([, , , name], i) => {
      const b = html("button", "mx-step", null, steps);
      b.type = "button";
      const sw = html("i", null, null, b);
      sw.style.background = stepColor[i];
      sw.style.borderTopColor = stepColor[i];
      html("span", "mx-step-t", name, b);
      const set = (v) => () => {
        st.step = v;
        draw();
      };
      b.addEventListener("pointerenter", set(i));
      b.addEventListener("pointerleave", set(null));
      b.addEventListener("focus", set(i));
      b.addEventListener("blur", set(null));
      b.setAttribute("aria-label", name);
      return b;
    });
    const cap = html("p", "mx-cap", null, out);
    cap.setAttribute("aria-live", "polite");
    const scale = html("div", "mx-scale", null, out);
    const ramp = html("div", "mx-ramp", null, scale);
    const rampLo = html("span", null, null, ramp);
    const rampBar = html("i", null, null, ramp);
    rampBar.style.background = `linear-gradient(90deg, ${mix(C.slow, C.fast, 1)}, ${mix(C.slow, C.fast, 0)})`;
    const rampHi = html("span", null, null, ramp);
    const sum = html("span", "mx-sum", null, ramp);
    const hint = html("p", "mx-hint", null, out);
    if (data.clocks) html("p", "mx-note", data.machine.replace(/\s*\(.*\)/, ""), root);

    const missing = () => ROLES.filter((r) => st[r] == null);
    const free = () => {
      const m = missing();
      return m.length === 1 ? m[0] : m.length === 0 ? st.active : null;
    };
    const valid = (role, cpu) => !((role === "A" && cpu === st.B) || (role === "B" && cpu === st.A));

    function pick(cpu) {
      st.play = null;
      const r = st.active;
      if ((r === "A" && cpu === st.B) || (r === "B" && cpu === st.A)) [st.A, st.B] = [st.B, st.A];
      else st[r] = cpu;
      st.touched = true;
      const m = missing();
      if (m.length) st.active = m[0];
      draw();
    }

    function route(src, dst) {
      // cells visited: along the column first, then the row
      const [r0, c0] = pos[src];
      const [r1, c1] = pos[dst];
      const pts = [[c0, r0]];
      for (let r = r0; r !== r1; ) pts.push([c0, (r += Math.sign(r1 - r0))]);
      for (let c = c0; c !== c1; ) pts.push([(c += Math.sign(c1 - c0)), r1]);
      return pts;
    }

    const ghost = (i) => st.mode === "cas" && i < 2; // in flight before the handoff

    // a step's path: stop centres plus an offset, trimmed to start and end at tile edges
    function raw(t, i, dx, dy) {
      const [f, to] = STEPS[i];
      const pts = route(t[f], t[to]).map(([c, r]) => [c * U + dx, r * U + dy]);
      if (pts.length > 1) {
        const pull = (p, q, d) => {
          const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
          return [p[0] + ((q[0] - p[0]) / len) * d, p[1] + ((q[1] - p[1]) / len) * d];
        };
        pts[0] = pull(pts[0], pts[1], S / 2 + 2);
        pts[pts.length - 1] = pull(pts[pts.length - 1], pts[pts.length - 2], S / 2 + 6);
      }
      return pts;
    }
    // Lanes: each step has one x offset (used on vertical links) and one y offset
    // (horizontal links). Steps sharing a link sit exactly GAP apart and each
    // link's bundle stays near centred; among the best x and y choices, the pair
    // with the fewest crossings wins.
    const GAP = 8;
    const LANES = [-3, -2, -1, 0, 1, 2, 3].map((k) => (k * GAP) / 2);
    const crosses = (p, q, r, u) => {
      if (Math.abs((q[0] - p[0]) * (u[1] - r[1]) - (q[1] - p[1]) * (u[0] - r[0])) < 1e-9) return false; // parallel
      const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      return d(r, u, p) * d(r, u, q) <= 1e-9 && d(p, q, r) * d(p, q, u) <= 1e-9; // touching counts
    };
    function lanes(t, axis, keep = 15) {
      const links = {};
      STEPS.forEach(([f, to], i) => {
        const pts = route(t[f], t[to]);
        for (let k = 1; k < pts.length; k++) {
          const [c0, r0] = pts[k - 1];
          const [c1, r1] = pts[k];
          if ((c0 === c1) !== (axis === 0)) continue;
          const key = axis === 0 ? `${c0}:${Math.min(r0, r1)}` : `${r0}:${Math.min(c0, c1)}`;
          (links[key] = links[key] || new Set()).add(i);
        }
      });
      const bundles = Object.values(links).map((v) => [...v]);
      const out = [];
      const offs = [0, 0, 0, 0];
      const walk = (i) => {
        if (i < 4) {
          for (const o of LANES) {
            offs[i] = o;
            walk(i + 1);
          }
          return;
        }
        let pen = 0;
        for (const b of bundles) {
          const o = b.map((j) => offs[j]).sort((x, y) => x - y);
          for (let k = 1; k < o.length; k++) {
            if (o[k] - o[k - 1] < GAP - 1e-9) return; // would overlap
            pen += 10 * (o[k] - o[k - 1] - GAP) ** 2;
          }
          pen += (o.reduce((x, y) => x + y, 0) / o.length) ** 2;
        }
        out.push([pen, offs.slice()]);
      };
      walk(0);
      return out.sort((x, y) => x[0] - y[0]).slice(0, keep);
    }
    const nestCache = {};
    function nest(t) {
      const key = `${t.A},${t.B},${t.H}`;
      if (nestCache[key]) return nestCache[key];
      let best = null;
      for (const [px, xs] of lanes(t, 0))
        for (const [py, ys] of lanes(t, 1)) {
          const ps = STEPS.map((_, i) => raw(t, i, xs[i], ys[i]));
          let k = 0;
          for (let i = 0; i < ps.length; i++)
            for (let j = i + 1; j < ps.length; j++)
              for (let a = 1; a < ps[i].length; a++)
                for (let b = 1; b < ps[j].length; b++) if (crosses(ps[i][a - 1], ps[i][a], ps[j][b - 1], ps[j][b])) k++;
          if (!best || k < best.k || (k === best.k && px + py < best.pen)) best = { k, pen: px + py, ps };
        }
      return (nestCache[key] = best.ps);
    }
    const path = (t, i) => nest(t)[i];

    // the first fraction p of a path, and the point where it stops
    function cut(pts, p) {
      const seg = pts.slice(1).map((q, k) => Math.hypot(q[0] - pts[k][0], q[1] - pts[k][1]));
      let left = p * seg.reduce((x, y) => x + y, 0);
      const out = [pts[0]];
      for (let k = 0; k < seg.length; k++) {
        if (left >= seg[k]) {
          out.push(pts[k + 1]);
          left -= seg[k];
          continue;
        }
        const f = seg[k] ? left / seg[k] : 0;
        out.push([pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f]);
        break;
      }
      return out;
    }

    // upto: steps before it are complete, step `upto` is drawn to fraction p
    function drawRoute(t, upto = STEPS.length, p = 1) {
      routeG.textContent = "";
      STEPS.forEach((s, i) => {
        if (i > upto || (i === upto && p <= 0)) return;
        const frac = i < upto ? 1 : p;
        const full = path(t, i);
        const on = st.play || st.step == null || st.step === i;
        const col = stepColor[i];
        if (full.length === 1) {
          // same tile: no mesh hop
          svg("circle", { cx: full[0][0], cy: full[0][1], r: 12, fill: "none", stroke: col, "stroke-width": 3, "stroke-opacity": on ? 0.9 : 0.15 }, routeG);
          return;
        }
        const pts = cut(full, frac);
        const line = pts.map((q) => q.join(",")).join(" ");
        if (on) svg("polyline", { points: line, fill: "none", stroke: C.bg, "stroke-width": 7, "stroke-opacity": 0.8, "stroke-linejoin": "round", "stroke-linecap": "round" }, routeG);
        svg("polyline", {
          points: line, fill: "none", stroke: col,
          "stroke-width": on && st.step != null && !st.play ? 4.5 : 3,
          "stroke-opacity": on ? (ghost(i) ? 0.75 : 1) : 0.15,
          "stroke-dasharray": ghost(i) ? "7 6" : "none",
          "stroke-linejoin": "round", "stroke-linecap": "round",
          "marker-end": on && frac >= 1 ? `url(#mx-arrow-${i})` : "",
        }, routeG);
        if (frac < 1) {
          const [x, y] = pts[pts.length - 1];
          svg("circle", { cx: x, cy: y, r: 7, fill: col, stroke: C.bg, "stroke-width": 2 }, routeG);
        }
      });
    }

    // playback: the steps in order, each taking time in proportion to its hops
    function start() {
      const t = { A: st.A, B: st.B, H: st.H, ...(st.hover != null && free() ? { [free()]: st.hover } : {}) };
      if (ROLES.some((r) => t[r] == null)) return;
      const dur = STEPS.map(([f, to]) => (reduced ? 900 : STEP_MS + HOP_MS * dist(t[f], t[to])));
      st.play = { t, dur, t0: performance.now(), i: 0, p: 0, done: false };
      st.step = null;
      tick();
    }
    function stop() {
      if (st.play) st.play.done = true;
      st.play = null;
      draw();
    }
    function tick() {
      const pl = st.play;
      if (!pl || pl.done) return;
      let e = performance.now() - pl.t0;
      let i = 0;
      while (i < STEPS.length && e > pl.dur[i]) e -= pl.dur[i++];
      if (i >= STEPS.length) {
        pl.done = true;
        pl.i = STEPS.length;
        draw();
        return;
      }
      pl.i = i;
      pl.p = reduced ? 1 : Math.min(1, e / (pl.dur[i] - STEP_MS / 2)); // a short rest at each stop
      draw();
      requestAnimationFrame(tick);
    }

    function draw() {
      for (const r of ROLES) {
        chips[r].innerHTML = "";
        html("span", "mx-chip-k", `${r} · ${NAME[r]}`, chips[r]).style.color = C[r];
        chips[r].style.setProperty("--mx-role", C[r]);
        html("span", "mx-chip-v", st[r] == null ? "–" : "CPU " + st[r], chips[r]);
        chips[r].classList.toggle("is-active", st.active === r);
        chips[r].setAttribute("aria-pressed", st.active === r);
      }
      for (const m in modeButtons) {
        modeButtons[m].classList.toggle("is-active", st.mode === m);
        modeButtons[m].setAttribute("aria-pressed", st.mode === m);
      }
      const fr = free();
      const shade = {};
      if (fr)
        for (const cpu in tiles) {
          const c = +cpu;
          if (!valid(fr, c)) continue;
          const v = value({ ...st, [fr]: c });
          if (v != null) shade[c] = v;
        }
      const vals = Object.values(shade);
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      const preview = fr && st.hover != null && shade[st.hover] != null ? { ...st, [fr]: st.hover } : null;
      const t = st.play ? st.play.t : preview || (missing().length === 0 ? st : null);
      let best = null;
      for (const c in shade) if (best == null || shade[c] < shade[best]) best = +c;

      for (const cpu in tiles) {
        const c = +cpu;
        const o = tiles[c];
        const v = shade[c];
        let fill = C.surface;
        let ink = C.text;
        if (v != null) {
          const f = hi > lo ? (hi - v) / (hi - lo) : 1; // 1 = fastest
          fill = mix(C.slow, C.fast, f);
          ink = f > 0.55 && !t ? C.bg : C.text; // faded under a route: light text
        }
        o.rect.setAttribute("fill", fill);
        o.rect.setAttribute("fill-opacity", t && v != null ? 0.45 : 1);
        const shown = t || st;
        const rs = ROLES.filter((r) => shown[r] === c);
        o.rect.setAttribute("stroke", rs.length ? C[rs[0]] : "none");
        o.rect.setAttribute("stroke-width", rs.length ? 4 : 0);
        o.label.setAttribute("fill", ink);
        o.label.setAttribute("fill-opacity", rs.length || st.hover === c ? 1 : 0.7);
        o.roles.textContent = rs.join("");
        // latency in the tile, as in the static figure; not on role tiles (the readout has that value)
        o.val.textContent = v != null && !rs.length ? v.toFixed(1) : "";
        o.val.setAttribute("fill", ink);
        o.val.setAttribute("fill-opacity", t ? 0.3 : 0.95);
        o.roles.setAttribute("fill", rs.length ? (ink === C.bg ? C.bg : C[rs[0]]) : "none");
        o.g.setAttribute("aria-label", `CPU ${c}` + (v != null ? `: ${v.toFixed(1)} ns as ${NAME[fr]}` : ""));
      }

      if (t) {
        if (st.play) drawRoute(t, st.play.i, st.play.p);
        else drawRoute(t);
        const v = value(t);
        const da = dist(t.A, t.H);
        const db = dist(t.H, t.B);
        const [k0, k1] = data[st.mode + "Fit"];
        main.textContent = `${t.A} → ${t.H} → ${t.B}: ${v == null ? "no data" : v.toFixed(1) + " ns"}`;
        detail.textContent = `${da} + ${db} hops · fit ${(k0 + k1 * (da + db)).toFixed(1)} ns`;
        STEPS.forEach(([f, to, , name], i) => {
          const cur = st.play && !st.play.done ? st.play.i === i : st.step == null || st.step === i;
          stepButtons[i].classList.toggle("is-dim", !cur && (st.step != null || (st.play && !st.play.done)));
          stepButtons[i].classList.toggle("is-ghost", ghost(i));
        });
        steps.style.visibility = "";
        playButton.textContent = st.play && !st.play.done ? "■ stop" : st.play ? "▶ replay" : "▶ play";
        // captions: the current step during playback, the critical path at the end
        const hops = STEPS.map(([f, to]) => dist(t[f], t[to]));
        const k = data.chaseFit[1] / 2; // ns per mesh traversal, from the chase fit
        if (st.play && !st.play.done) {
          const i = st.play.i;
          const [f, to, , name, , text] = STEPS[i];
          const where = hops[i] ? `${hops[i]} hop${hops[i] > 1 ? "s" : ""}` : "same tile";
          const who = (r) => `${r === "H" ? "home" : "CPU"} ${t[r]}`;
          cap.textContent = `${i + 1}/4 ${name}, ${where}: ${ghost(i) ? CAS_TEXT[i] : text}`;
          cap.hidden = false;
        } else if (st.play) {
          const crit = st.mode === "cas" ? [2, 3] : [0, 1, 2, 3];
          const n = crit.reduce((x, i) => x + hops[i], 0);
          const names = crit.map((i) => STEPS[i][3]).join(" → ");
          cap.textContent = `critical path ${n} hops ≈ ${(n * k).toFixed(1)} of ${v == null ? "?" : v.toFixed(1)} ns`;
          cap.hidden = false;
        } else cap.hidden = true;
      } else {
        routeG.textContent = "";
        main.textContent = `pick ${fr || st.active}`;
        detail.textContent = "\u00a0"; // keep the line: the readout's height must not change with hover
        steps.style.visibility = "hidden";
        cap.hidden = true;
      }
      ramp.hidden = !(fr && vals.length);
      if (fr && vals.length) {
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        rampLo.textContent = `${fr} · ${NAME[fr]}  ${lo.toFixed(1)}`;
        rampHi.textContent = `${hi.toFixed(1)} ns`;
        sum.textContent = `best ${best} · mean ${mean.toFixed(1)}`;
      }
      hint.hidden = st.touched;
      hint.textContent = `click a tile to set ${st.active}`;
    }
    draw();
  }

  function init() {
    for (const el of document.querySelectorAll("[data-mesh-explorer], #mesh-explorer")) {
      if (el.dataset.mxMounted) continue;
      el.dataset.mxMounted = "1";
      const src = el.dataset.src || "figures/explorer/diomedea.json";
      // whatever is inside the element (the static figure) stays until the data has loaded
      fetch(src)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d) => mount(el, d))
        .catch((e) => console.warn(`mesh explorer: keeping the static figure (${src}: ${e})`));
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
