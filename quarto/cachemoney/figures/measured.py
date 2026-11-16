"""Measured figures for The Physicality of Cache, on diomedea (Xeon Gold 6314U, 6 by 8 mesh).

data-path.png     one core reading from one slice: the mesh stops whose ring counters saw the data
l3-distance.png   L3 hit latency from one core to every slice, for a central and a corner core
l3-cores.png      L3 hit latency of each core, averaged over all slices
                  (l3-distance-light.png and l3-cores-light.png: the same two on a white page, for Substack)
ring-traffic.png  data-ring traffic at each tile with all 32 cores loaded: any slice against nearby slices

Data: c2c-research results/diomedea/20261114-l3map (override with L3MAP) and, for data-path,
results/diomedea/20261020-meshmap (override with MESHMAP). Grid, font and colours
come from the Core to Core figure script, ../../core-to-core/figures/mesh.py.
Usage: python3 measured.py
"""
import contextlib
import csv
import gzip
import importlib.util
import os
from pathlib import Path

import numpy as np
from matplotlib.colors import LinearSegmentedColormap

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("mesh", HERE.parents[1] / "core-to-core" / "figures" / "mesh.py")
mesh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mesh)
plt = mesh.plt

L3MAP = Path(os.environ.get("L3MAP", Path.home() / "Documents/c2c-research/results/diomedea/20261114-l3map"))
MESHMAP = Path(os.environ.get("MESHMAP", Path.home() / "Documents/c2c-research/results/diomedea/20261020-meshmap"))
BG, TEXT, SUBTLE = mesh.BG, mesh.TEXT, mesh.SUBTLE
INK_DARK, INK_LIGHT = mesh.BG, mesh.TEXT   # ink on bright and on dark tiles, the same on either page colour
WHITE_PAGE = dict(BG="#ffffff", TEXT="#1c1f1a", SUBTLE="#6b665a", LATTICE="#d9d6cc")   # for Substack
LIT = "#3d4523"              # a stop whose ring counters saw traffic
S = 0.8                      # tile size, in tile pitches
SMALL, VALUE, LABEL = 7.0, 7.6, 8.6   # pt; 7 pt is 11 CSS px when the 1650 px figure is shown 825 px wide
BUSY, QUIET = "#e8957a", "#1b1815"    # traffic ramp ends
LATENCY = ["#a9bd52", "#c99a3e", "#a8452a"]   # latency ramp: fast green, amber, slow rust; lightness falls all the way
LATENCY_INK = 0.8                     # dark ink on a tile until this far along the latency ramp


@contextlib.contextmanager
def page(colours):
    """temporarily swap the page colours, here and in mesh.py"""
    g = globals()
    old = {k: (g.get(k), getattr(mesh, k)) for k in colours}
    for k, v in colours.items():
        if k in g:
            g[k] = v
        setattr(mesh, k, v)
    try:
        yield
    finally:
        for k, (here, there) in old.items():
            if k in g:
                g[k] = here
            setattr(mesh, k, there)


def panel(ax, tiles, rows, cols, value, ramp, lo, hi, fmt, mark=None, light=0.45):
    """one grid: every tile with a slice shaded and labelled by value[cpu]"""
    mesh.lattice(ax, rows, cols)
    mesh.mem_stops(ax, S, fontsize=SMALL)
    for (r, c), cpu in tiles.items():
        x, y = mesh.xy((r, c))
        f = (value[cpu] - lo) / (hi - lo)
        bright = (f < light) if ramp.name == "latency" else (f > 1 - light)
        ax.add_patch(mesh.FancyBboxPatch((x - S / 2, y - S / 2), S, S, boxstyle="round,pad=0,rounding_size=0.08",
                                         fc=ramp(f), ec=mesh.ROLE_B if cpu == mark else BG,
                                         lw=2.4 if cpu == mark else 1.0, zorder=3 if cpu == mark else 2))
        ax.text(x, y - 0.02, fmt(value[cpu]), color=INK_DARK if bright else INK_LIGHT, fontsize=VALUE, ha="center", va="center", zorder=5)


def colorbar(fig, ramp, lo, hi, ticks, labels):
    cb = fig.add_axes([0.3, 0.078, 0.4, 0.026])
    cb.imshow(np.linspace(0, 1, 256)[None, :], aspect="auto", cmap=ramp, extent=(lo, hi, 0, 1))
    cb.set_yticks([])
    cb.set_xticks(ticks, labels, color=TEXT, fontsize=LABEL)
    cb.tick_params(length=3, color=SUBTLE)
    for sp in cb.spines.values():
        sp.set_visible(False)


def two_panels(fam):
    fig, axes = plt.subplots(1, 2, figsize=(7.2, 3.52), dpi=mesh.DPI)
    fig.patch.set_facecolor(BG)
    plt.rcParams["font.family"] = fam
    fig.subplots_adjust(left=0.012, right=0.988, top=0.995, bottom=0.118, wspace=0.035)
    return fig, axes


def under(ax, cols, rows, line1, line2):
    ax.text((cols - 1) / 2, -(rows - 1) - 0.72, line1, color=TEXT, fontsize=LABEL, ha="center", va="top")
    ax.text((cols - 1) / 2, -(rows - 1) - 1.14, line2, color=SUBTLE, fontsize=SMALL + 0.4, ha="center", va="top")
    ax.set_ylim(-(rows - 0.5) - 1.0, 0.5)


def distance(fam, tiles, rows, cols, cpus=(10, 31), suffix=""):
    """L3 hit latency from one core to each slice: a core in the middle of the die and one in a corner."""
    M = np.loadtxt(L3MAP / "map-matrix.csv", delimiter=",")
    lo, hi = M[list(cpus)].min(), M[list(cpus)].max()
    ramp = LinearSegmentedColormap.from_list("latency", LATENCY)
    fig, axes = two_panels(fam)
    for ax, cpu in zip(axes, cpus):
        row = M[cpu]
        panel(ax, tiles, rows, cols, row, ramp, lo, hi, lambda v: f"{v:.1f}", mark=cpu, light=LATENCY_INK)
        under(ax, cols, rows, f"from CPU {cpu}", f"{row.min():.1f} to {row.max():.1f} ns")
    colorbar(fig, ramp, lo, hi, [lo, hi], [f"{lo:.1f}", f"{hi:.1f} ns"])
    out = HERE / f"l3-distance{suffix}.png"
    fig.savefig(out, facecolor=BG)
    plt.close(fig)
    print(f"wrote {out}: " + ", ".join(f"CPU {c} {M[c].min():.1f}-{M[c].max():.1f} (spread {M[c].max() - M[c].min():.1f})" for c in cpus))


def cores(fam, tiles, rows, cols, suffix=""):
    """L3 hit latency of each core, averaged over the 32 slices: one panel, centred in the usual canvas."""
    M = np.loadtxt(L3MAP / "map-matrix.csv", delimiter=",")
    mean = M.mean(axis=1)
    lo, hi = mean.min(), mean.max()
    ramp = LinearSegmentedColormap.from_list("latency", LATENCY)
    fig, axes = two_panels(fam)
    ax, box = axes[0], axes[0].get_position()
    axes[1].remove()
    ax.set_position([0.5 - box.width / 2, box.y0, box.width, box.height])   # one panel, in the middle
    panel(ax, tiles, rows, cols, mean, ramp, lo, hi, lambda v: f"{v:.1f}", light=LATENCY_INK)
    best, worst = int(mean.argmin()), int(mean.argmax())
    under(ax, cols, rows, "average over all 32 slices", f"CPU {best} {lo:.1f} ns, CPU {worst} {hi:.1f} ns")
    colorbar(fig, ramp, lo, hi, [lo, hi], [f"{lo:.1f}", f"{hi:.1f} ns"])
    out = HERE / f"l3-cores{suffix}.png"
    fig.savefig(out, facecolor=BG)
    plt.close(fig)
    print(f"wrote {out}: core means {lo:.1f} (CPU {best}) to {hi:.1f} (CPU {worst})")


def traffic(fam, tiles, rows, cols):
    """Data (BL) ring in-use per second at each tile with all 32 cores loaded, global against local."""
    def ring(mode):
        return {int(r["cha"]): float(r["in_use_per_s"]) / 1e6 for r in csv.DictReader(open(L3MAP / f"ring-bl-{mode}.csv"))}

    def latency(mode):
        v = [float(r["ns_per_load"]) for r in csv.DictReader(open(L3MAP / f"all-{mode}.csv"))]
        return sum(v) / len(v)

    data = {m: ring(m) for m in ("global", "local")}
    hi = max(max(d.values()) for d in data.values())
    ramp = LinearSegmentedColormap.from_list("traffic", [QUIET, BUSY])           # busiest is brightest
    fig, axes = two_panels(fam)
    names = {"global": "any slice on the die", "local": "slices next to the core"}
    for ax, mode in zip(axes, ("global", "local")):
        d = data[mode]
        panel(ax, tiles, rows, cols, d, ramp, 0, hi, lambda v: f"{v:.0f}", light=0.5)
        under(ax, cols, rows, names[mode], f"{sum(d.values()) / 1e3:.1f} billion in total, {latency(mode):.1f} ns per access")
    colorbar(fig, ramp, 0, hi, [0, hi], ["0", f"{hi:.0f} million ring slots in use per second"])
    out = HERE / "ring-traffic.png"
    fig.savefig(out, facecolor=BG)
    plt.close(fig)
    tot = {m: sum(d.values()) for m, d in data.items()}
    print(f"wrote {out}: global {tot['global'] / 1e3:.2f} G/s, local {tot['local'] / 1e3:.2f} G/s, ratio {tot['global'] / tot['local']:.2f}x; "
          f"latency {latency('global'):.1f} vs {latency('local'):.1f} ns")


def paths(fam, tiles, rows, cols, pairs=((5, 26), (31, 1)), floor=0.010):
    """One core reading and writing lines kept in one slice (20 ms, 24 lines in one L2 set, so they
    cycle through that slice). Lit stops: data-ring in-use above `floor` cycles per ns over idle.
    Arrows: the two routes the layout predicts, each along its column first, then along the row."""
    from matplotlib.lines import Line2D
    from matplotlib.patches import Patch

    pos = {cpu: rc for rc, cpu in tiles.items()}
    seen = {p: {} for p in pairs}
    for r in csv.DictReader(gzip.open(MESHMAP / "coloc.csv.gz", "rt")):
        p = (int(r["a"]), int(r["cha_a"]))
        if r["phase"] == "colocate" and p in seen:
            e = float(r["active"]) / float(r["active_ns"]) - float(r["idle"]) / float(r["idle_ns"])
            seen[p][int(r["cha"])] = max(seen[p].get(int(r["cha"]), 0.0), e)
    fig, axes = two_panels(fam)
    for ax, (core, home) in zip(axes, pairs):
        lit = {c for c, e in seen[(core, home)].items() if e > floor}
        routes = [(mesh.yx_route(pos[home], pos[core]), mesh.DATA), (mesh.yx_route(pos[core], pos[home]), mesh.FORWARD)]
        on_route = {tiles[rc] for cells, _ in routes for rc in cells if rc in tiles}
        assert lit <= on_route, f"traffic off the predicted routes for {core}, {home}: {sorted(lit - on_route)}"
        mesh.lattice(ax, rows, cols)
        mesh.mem_stops(ax, S, fontsize=SMALL)
        for (r, c), cpu in tiles.items():
            x, y = mesh.xy((r, c))
            edge = mesh.ROLE_B if cpu == core else mesh.KEYWORD if cpu == home else None
            ax.add_patch(mesh.FancyBboxPatch((x - S / 2, y - S / 2), S, S, boxstyle="round,pad=0,rounding_size=0.08",
                                             fc=LIT if cpu in lit else mesh.TILE, ec=edge or BG, lw=2.4 if edge else 1.0,
                                             zorder=3 if edge else 2))
            if edge:
                ax.text(x, y - 0.02, "core" if cpu == core else "home", color=TEXT, fontsize=VALUE, ha="center", va="center", zorder=6)
        for cells, col in routes:
            mesh.arrow_route(ax, mesh.trim([mesh.xy(rc) for rc in cells], S / 2 + 0.03, S / 2 + 0.05), col, lw=2.6, z=4)
        under(ax, cols, rows, f"CPU {core}, home slice {home}", f"data seen at {len(lit)} stops")
    handles = [Line2D([0], [0], color=mesh.DATA, lw=2.6, label="data to the core"),
               Line2D([0], [0], color=mesh.FORWARD, lw=2.6, label="evicted lines back to the home"),
               Patch(fc=LIT, ec="none", label="ring counter saw data")]
    fig.legend(handles=handles, loc="center", bbox_to_anchor=(0.5, 0.062), ncol=3, frameon=False, labelcolor=TEXT,
               handlelength=1.8, columnspacing=2.2, prop={"family": fam, "size": LABEL})
    out = HERE / "data-path.png"
    fig.savefig(out, facecolor=BG)
    plt.close(fig)
    print(f"wrote {out}: " + ", ".join(f"CPU {c} slice {h}: {sum(e > floor for e in seen[(c, h)].values())} stops" for c, h in pairs))


def main():
    fam = mesh.font()
    tiles, rows, cols = mesh.load()
    paths(fam, tiles, rows, cols)
    distance(fam, tiles, rows, cols)
    cores(fam, tiles, rows, cols)
    with page(WHITE_PAGE):   # the same two figures on a white page
        distance(fam, tiles, rows, cols, suffix="-light")
        cores(fam, tiles, rows, cols, suffix="-light")
    traffic(fam, tiles, rows, cols)


if __name__ == "__main__":
    main()
