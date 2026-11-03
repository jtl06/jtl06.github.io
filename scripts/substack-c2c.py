"""Build a Substack-ready copy of Core to Core from quarto/core-to-core/article.md.

Writes quarto/core-to-core/substack/index.html (open it, click "Copy body", paste into the
Substack editor) and renders the placement table to figures/placement-table.png, since
Substack has no tables. Widgets become links to the interactive version on jacen.li; figures
use their published URLs, so the site must be deployed first.
usage: python3 scripts/substack-c2c.py   (or npm run substack:c2c)
"""
import html
import re
import subprocess
from pathlib import Path

import markdown

REPO = Path(__file__).resolve().parent.parent
ROOT = REPO / "quarto" / "core-to-core"
OUT = ROOT / "substack"
SITE = "https://jacen.li"
URL = SITE + "/writings/core-to-core-is-not-core-to-core/"
FIG = SITE + "/c2c/figures/"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
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
    tmp = OUT / "table.html"
    tmp.write_text(page)
    png = ROOT / "figures" / TABLE_PNG
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
                    f"--window-size=825,{height}", f"--screenshot={png}", tmp.as_uri()],
                   check=True, capture_output=True)
    tmp.unlink()


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

intro = f'<p><em>Originally published on <a href="{URL}">jacen.li</a>, with interactive figures.</em></p>'
summary = re.search(r'const summary =\s*"(.*?)";', (REPO / "src/writings/core-to-core-is-not-core-to-core.11tydata.js").read_text(), flags=re.S).group(1)

missing = []
for u in set(re.findall(re.escape(FIG) + r'[^"?#]+', body)):
    if not (ROOT / "figures" / u[len(FIG):]).is_file():
        missing.append(u)
if missing:
    raise SystemExit("substack-c2c: missing figures " + ", ".join(sorted(missing)))

(OUT / "index.html").write_text(f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} (Substack copy)</title>
<style>
body {{ max-width: 46rem; margin: 2rem auto; padding: 0 1rem; font: 17px/1.6 Georgia, serif; color: #222; background: #fff; }}
.panel {{ font: 14px/1.5 system-ui, sans-serif; background: #f4f1ea; border: 1px solid #ddd5c4; padding: 1rem 1.25rem; margin-bottom: 2rem; }}
.panel b {{ display: inline-block; min-width: 5.5rem; }}
button {{ font: inherit; padding: .4rem .9rem; cursor: pointer; }}
img {{ max-width: 100%; }} figure {{ margin: 1.5rem 0; }} figcaption {{ font-size: 14px; color: #666; }}
code {{ font-size: 15px; }} pre {{ overflow-x: auto; background: #f6f6f6; padding: .75rem; }}
</style></head><body>
<div class="panel">
<p><b>Title</b> {html.escape(title)}<br><b>Subtitle</b> {html.escape(summary)}</p>
<p><button id="copy">Copy body</button> <span id="status"></span></p>
<p>Paste into a new Substack post below the title. Check that every image and caption came through, then set the
post's social image to <a href="{SITE}/c2c/share.png">share.png</a>.</p>
</div>
<article id="body">
{intro}
{body}
</article>
<script>
document.getElementById("copy").onclick = () => {{
  const r = document.createRange(); r.selectNodeContents(document.getElementById("body"));
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  const ok = document.execCommand("copy");
  document.getElementById("status").textContent = ok ? "Copied." : "Select the body and copy it by hand.";
}};
</script>
</body></html>
""")
print("wrote", (OUT / "index.html").relative_to(REPO), "and figures/" + TABLE_PNG)
