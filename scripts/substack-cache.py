"""Build a Substack-ready copy of The Physicality of Cache from quarto/cachemoney/cachemoney.qmd.

Writes quarto/cachemoney/substack/index.html (open it, click "Copy body", paste into Substack) and
renders the Excalidraw SVGs to quarto/cachemoney/figures/*.png, served at /cachemoney/figures/,
since Substack does not take SVG. Collapsible examples are flattened. Deploy the site first.
usage: python3 scripts/substack-cache.py   (or npm run substack:cache)
"""
import json
import re
from pathlib import Path

import markdown

from substack_page import screenshot, write_page

REPO = Path(__file__).resolve().parent.parent
ROOT = REPO / "quarto" / "cachemoney"
OUT = ROOT / "substack"
FIGS = ROOT / "figures"
SITE = "https://jacen.li"
FIG = SITE + "/cachemoney/figures/"
meta = json.loads((REPO / "src/_data/cacheArticle.json").read_text())

src = (ROOT / "cachemoney.qmd").read_text()
src = re.sub(r"\A---\n.*?\n---\n", "", src, flags=re.S)  # Quarto front matter
src = re.sub(r"<!--.*?-->\n?", "", src, flags=re.S)
OUT.mkdir(exist_ok=True)
FIGS.mkdir(exist_ok=True)


def svg_to_png(m: re.Match) -> str:
    svg, alt = m.group(1), m.group(2)
    name = Path(svg).stem + ".png"
    w, h = map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', (ROOT / svg).read_text()[:2000]).groups())
    width = 825
    height = round(width * h / w)
    page = (f'<!doctype html><style>html,body{{margin:0;background:#fff}}img{{display:block;width:{width}px;height:{height}px}}</style>'
            f'<img src="{(ROOT / svg).as_uri()}">')
    screenshot(page, FIGS / name, width, height, OUT)
    return f'<figure><img src="{FIG}{name}" alt="{alt}"></figure>'


# ![](images/x.svg){.class fig-alt="..."}  ->  hosted PNG
src = re.sub(r'!\[\]\((images/[^)]+\.svg)\)\{[^}]*fig-alt="([^"]*)"[^}]*\}', svg_to_png, src)

# The interactive L3 map  ->  its static figures on a white page (figures/measured.py), each with its own caption.
def widget_figures(m: re.Match) -> str:
    out = []
    for img in re.findall(r"<img [^>]*>", m.group(0)):
        caption = re.search(r'data-caption="([^"]*)"', img).group(1)
        img = re.sub(r' data-caption="[^"]*"', "", img)
        img = re.sub(r'(/cachemoney/figures/[\w-]+)\.png', r"\1-light.png", img)
        out.append(f"<figure>\n{img}\n<figcaption>{caption}</figcaption>\n</figure>")
    return "\n\n".join(out)


src = re.sub(r'<figure class="wide">\s*<div data-l3map-src=.*?</figure>', widget_figures, src, flags=re.S)

# <details><summary>Example: ...</summary> ... </details>  ->  a bold lead-in and the content inline
src = re.sub(r"<details[^>]*>\s*<summary>(.*?)</summary>\s*(.*?)\s*</details>",
             lambda m: f"**{m.group(1)}**\n\n{m.group(2)}", src, flags=re.S)

# Quarto heading anchors ({#id}) are site-only.
src = re.sub(r"[ \t]*\{#[^}\n]*\}[ \t]*$", "", src, flags=re.M)

# Relative links to other articles point at the site.
src = src.replace("](../core-to-core-is-not-core-to-core/)", f"]({SITE}/writings/core-to-core-is-not-core-to-core/)")

body = markdown.markdown(src, extensions=["footnotes", "tables", "fenced_code"])

# Footnotes: plain superscript numbers and a Notes list (in-page anchors do not survive the paste).
body = re.sub(r'<sup id="fnref:[^"]+"><a class="footnote-ref" href="#fn:[^"]+">(\d+)</a></sup>', r"<sup>\1</sup>", body)
body = re.sub(r'\s*<a class="footnote-backref"[^>]*>.*?</a>', "", body)
body = re.sub(r'<div class="footnote">\s*<hr ?/?>\s*<ol>', "<h2>Notes</h2>\n<ol>", body)
body = re.sub(r"</ol>\s*</div>\s*$", "</ol>", body.strip())
body = re.sub(r'<li id="fn:[^"]+">', "<li>", body)
body = body.replace("&#160;</p>", "</p>")
body = body.replace("<p><figure>", "<figure>").replace("</figure></p>", "</figure>")
# Measured figures are already PNGs served by the site (figures/measured.py); drop the site-only attributes.
body = body.replace('<figure class="wide">', "<figure>").replace(' data-external="1"', "")
body = body.replace('src="/cachemoney/figures/', f'src="{FIG}')

missing = [u for u in set(re.findall(re.escape(FIG) + r'[^"?#]+', body)) if not (FIGS / u[len(FIG):]).is_file()]
if missing or re.search(r'(src|href)="(?!https?:|mailto:)', body):
    raise SystemExit(f"substack-cache: missing figures {missing} or a relative link left in the body")

write_page(OUT / "index.html", meta["title"], meta["summary"], meta["url"], meta["image"], body)
print("wrote", (OUT / "index.html").relative_to(REPO), "and", len(list(FIGS.glob("*.png"))), "figures")
