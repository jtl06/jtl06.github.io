"""Shared pieces for the Substack copy scripts (substack-c2c.py, substack-cache.py)."""
import html
import subprocess
from pathlib import Path

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def screenshot(page_html: str, png: Path, width: int, height: int, scratch: Path) -> None:
    """Render an HTML snippet to a PNG at 2x (width and height in CSS px)."""
    tmp = scratch / "_render.html"
    tmp.write_text(page_html)
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2",
                    f"--window-size={width},{height}", f"--screenshot={png}", tmp.as_uri()],
                   check=True, capture_output=True)
    tmp.unlink()


def write_page(out: Path, title: str, subtitle: str, url: str, social_image: str, body: str, note: str = "") -> None:
    """The copy page: title and subtitle to paste into Substack's fields, then the body and a copy button."""
    intro = f'<p><em>Originally published on <a href="{url}">jacen.li</a>{note}.</em></p>'
    out.write_text(f"""<!doctype html>
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
<p><b>Title</b> <span id="title">{html.escape(title)}</span><br><b>Subtitle</b> <span id="subtitle">{html.escape(subtitle)}</span></p>
<p><button id="copy">Copy body</button> <span id="status"></span></p>
<p>Paste into a new Substack post below the title. Check that every image and caption came through, then set the
post's social image to <a href="{social_image}">this image</a>.</p>
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
