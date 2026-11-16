"""Export the L3 map widget's data: L3 hit latency from every core to every slice on diomedea
(c2c-research results/diomedea/20261114-l3map/map-matrix.csv, load clocks) and the tile layout.
Values are rounded here, once, so the widget and the static figures (../measured.py) print the same digits.
usage: python3 l3map_data.py  ->  l3map.json"""
import csv
import json
from pathlib import Path

import numpy as np

R = Path.home() / "Documents/c2c-research"
M = np.loadtxt(R / "results/diomedea/20261114-l3map/map-matrix.csv", delimiter=",")   # M[core][slice], ns
layout = R / "machines/diomedea/coremap.layout.csv"
r1 = lambda v: float(f"{v:.1f}")

tiles = [{"cpu": int(r["cpu"]), "row": int(r["row"]), "col": int(r["col"])} for r in csv.DictReader(open(layout))]
out = {
    "machine": "Xeon Gold 6314U (diomedea)",
    "clocks": "load clocks: turbo, performance governor, mesh at its maximum",
    "source": "c2c-research results/diomedea/20261114-l3map",
    "rows": 6, "cols": 8,
    "tiles": tiles,
    "stops": [{"row": r, "col": c, "label": "MC"} for r, c in [(2, 0), (4, 0), (2, 7), (4, 7)]],
    "ns": [[r1(v) for v in row] for row in M],          # ns[core][slice]; slice n is on CPU n's tile
    "mean": [r1(row.mean()) for row in M],              # per core, over the 32 slices
}
json.dump(out, open(Path(__file__).with_name("l3map.json"), "w"), separators=(",", ":"))
print("wrote l3map.json: slices %.1f to %.1f ns; core means %.1f (CPU %d) to %.1f (CPU %d)" % (
    M.min(), M.max(), M.mean(1).min(), M.mean(1).argmin(), M.mean(1).max(), M.mean(1).argmax()))
print("check: CPU 0 -> slice 3 %.1f, CPU 3 -> slice 0 %.1f" % (out["ns"][0][3], out["ns"][3][0]))
