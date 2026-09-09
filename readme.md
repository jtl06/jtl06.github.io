Personal portfolio site — [jacen.li](https://jacen.li)

Static site built with [Eleventy](https://www.11ty.dev/) and hosted on GitHub Pages.

## Development

Install dependencies:

```sh
npm install
```

Run the local dev server:

```sh
npm run serve
```

Build the production site:

```sh
npm run build
```

Editable pages live in `src/`. Generated output is written to `_site/` and deployed by GitHub Actions.

## Quarto articles

**Caches & Interconnects** is published at `/writings/caches-and-interconnects/`,
listed on the homepage and Writings index. `/cachemoney/` redirects there while
preserving query strings and section anchors. The source snapshot and diagrams
remain in `quarto/cachemoney/`. The original authoring file is
`/Users/jacenli/Jacen/cachemoney.qmd`; edits there are not automatically synced.
Copy its body (without its project front matter or duplicate H1) and referenced
diagrams into the snapshot, preserving the snapshot's render configuration.

After updating the repo snapshot, use Quarto 1.6.40 to render it:

```sh
npm run render:cachemoney
npm run build
```

Commit the refreshed `quarto/cachemoney/index.html` alongside source changes.
Eleventy extracts its body, removes Quarto's title block, and wraps it in the shared
site layout. The diagrams remain embedded with their original Excalidraw fonts.
The rendered HTML is a build input, not a standalone published route; GitHub Pages
does not need Quarto installed. Article spacing is in `styles/main.css`; the Quarto
CSS only affects its standalone local render.

Metadata lives in `src/_data/cacheArticle.json` and the shared
`src/_includes/cache-article-meta.njk`, used by both the article and its old URL.
`share-v2.png` is a separate public PNG
for link previews; regenerate it with `node scripts/render-cachemoney-share.cjs`
using Node.js with Playwright and Chromium available (or set `CHROME_PATH` to a
Chrome executable). This exports the original diagram without framing and waits
for its embedded Excalifont to load. Commit the generated image. The robots rules
allow crawling `/writings/` and `/cachemoney/` so the article can be indexed and
preview services can fetch it. The old redirect has `noindex`; the article does not.
