"""Build a Substack-ready copy of Core to Core from quarto/core-to-core/article.md.

Writes quarto/core-to-core/substack/index.html (open it, click "Copy body", paste into the
Substack editor) and renders the placement table to figures/placement-table.png, since
Substack has no tables. Widgets become links to the interactive version on jacen.li; figures
use their published URLs, so the site must be deployed first.
usage: python3 scripts/substack-c2c.py   (or npm run substack:c2c)
"""
import html
import re
from pathlib import Path

import markdown

from substack_page import screenshot, write_page

REPO = Path(__file__).resolve().parent.parent
ROOT = REPO / "quarto" / "core-to-core"
OUT = ROOT / "substack"
SITE = "https://jacen.li"
URL = SITE + "/writings/core-to-core-is-not-core-to-core/"
FIG = SITE + "/c2c/figures/"
TABLE_PNG = "placement-table.png"

src = (ROOT / "article.md").read_text()
src = re.sub(r"<!--.*?-->\n?", "", src, flags=re.S)
title = re.search(r"^# (.+)$", src, flags=re.M).group(1)
src = re.sub(r"^# .+\n", "", src, count=1, flags=re.M)


# --- the placement table becomes an image -------------------------------------------------
def render_table(md_table: str) -> None:
    rows = [[c.strip() for c in line.strip().strip("|").split("|")]
            for line in md_table.strip().splitlines() if not re.match(r"^\|[-| ]+\|$", line.strip())]
    head, body = rows[0], rows[1:]
    th = "".join(f"<th>{html.escape(c)}</th>" for c in head)
    trs = []
    for r in body:
        sub = r[0].startswith("·")
        cells = [f'<td class="{"sub" if sub else "hw"}">{html.escape(r[0])}</td>']
        cells += [f'<td class="qty">{html.escape(c)}</td>' for c in r[1:]]
        trs.append(f"<tr>{''.join(cells)}</tr>")
    height = 24 + 40 + 34 * len(body) + 24
    font = (REPO / "fonts" / "IoskeleyMono-Regular.woff2").as_uri()
    page = f"""<!doctype html><meta charset="utf-8"><style>
@font-face {{ font-family: Ioskeley; src: url("{font}") format("woff2"); }}
html, body {{ margin: 0; background: #090a09; }}
body {{ width: 825px; height: {height}px; display: flex; justify-content: center; align-items: center;
  font: 13px/1 Ioskeley, monospace; color: #e3d6bc; }}
table {{ border-collapse: collapse; }}
th, td {{ padding: 0 9px; white-space: nowrap; text-align: right; border-bottom: 1px solid #202320; }}
th {{ height: 40px; color: #b4dba5; font-weight: 400; }}
td {{ height: 33px; }}
th:first-child, td:first-child {{ text-align: left; }}
.hw {{ color: #a3b6cf; }} .sub {{ color: #8f8776; padding-left: 18px; }} .qty {{ color: #6fc9be; }}
</style><table><thead><tr>{th}</tr></thead><tbody>{''.join(trs)}</tbody></table>"""
    screenshot(page, ROOT / "figures" / TABLE_PNG, 825, height, OUT)


OUT.mkdir(exist_ok=True)
table = re.search(r'<div class="table-scroll" markdown="1">\s*(.*?)\s*</div>', src, flags=re.S)
render_table(table.group(1))
src = src.replace(table.group(0),
                  f"![Fast address placement on five machines: median round trip, default and placed]({FIG}{TABLE_PNG})")

# --- interactive figures become links to the site -----------------------------------------
def widget_link(m: re.Match) -> str:
    label = m.group(1).removeprefix("Explore: ").strip()
    return f'<p><em>Interactive: <a href="{URL}">{html.escape(label)}</a> on jacen.li</em></p>'

src = re.sub(r'<details class="wide">\s*<summary>(.*?)</summary>.*?</details>', widget_link, src, flags=re.S)

body = markdown.markdown(src, extensions=["footnotes", "tables", "md_in_html", "fenced_code"])

# Image paragraphs -> figure with caption; html figures lose the site-only class.
body = re.sub(r'<p><img alt="([^"]*)" src="([^"]+)" ?/?></p>',
              r'<figure><img src="\2" alt="\1"><figcaption>\1</figcaption></figure>', body)
body = body.replace('<figure class="wide">', "<figure>")
body = re.sub(r'((?:src|href)=")figures/', r"\1" + FIG, body)  # GIFs stay GIFs (Substack plays them)

# Display math: one line of code.
body = re.sub(r"<p>\$\$\s*(.*?)\s*\$\$</p>", r"<p><code>\1</code></p>", body, flags=re.S)

# Footnotes: plain superscript numbers and a Notes list (in-page anchors do not survive the paste).
body = re.sub(r'<sup id="fnref:[^"]+"><a class="footnote-ref" href="#fn:[^"]+">(\d+)</a></sup>', r"<sup>\1</sup>", body)
body = re.sub(r'\s*<a class="footnote-backref"[^>]*>.*?</a>', "", body)
body = re.sub(r'<div class="footnote">\s*<hr ?/?>\s*<ol>', "<h2>Notes</h2>\n<ol>", body)
body = re.sub(r"</ol>\s*</div>\s*$", "</ol>", body.strip())
body = re.sub(r'<li id="fn:[^"]+">', "<li>", body)

summary = re.search(r'const summary =\s*"(.*?)";', (REPO / "src/writings/core-to-core-is-not-core-to-core.11tydata.js").read_text(), flags=re.S).group(1)

missing = [u for u in set(re.findall(re.escape(FIG) + r'[^"?#]+', body)) if not (ROOT / "figures" / u[len(FIG):]).is_file()]
if missing:
    raise SystemExit("substack-c2c: missing figures " + ", ".join(sorted(missing)))

write_page(OUT / "index.html", title, summary, URL, SITE + "/c2c/share.png", body, note=", with interactive figures")
print("wrote", (OUT / "index.html").relative_to(REPO), "and figures/" + TABLE_PNG)
