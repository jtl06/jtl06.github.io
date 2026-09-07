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

## Temporary Quarto preview

`/cachemoney/` is an unlisted preview of **Caches & Interconnects**. The source
snapshot and its six diagrams live in `quarto/cachemoney/`. The original authoring
file is `/Users/jacenli/Jacen/cachemoney.qmd`; edits there are not automatically synced.

After updating the repo snapshot, use Quarto 1.6.40 to render it:

```sh
npm run render:cachemoney
npm run build
```

Commit the refreshed `quarto/cachemoney/index.html` alongside source changes. That
self-contained HTML embeds the styles and diagrams, so GitHub Pages builds do not
need Quarto. The page requests no search-engine indexing and is outside the Writings
collection and site navigation. It is still publicly accessible at its URL.
