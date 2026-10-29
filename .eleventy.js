const fs = require("node:fs");
const path = require("node:path");

module.exports = function (eleventyConfig) {
  // Article bodies rendered outside Eleventy (Quarto, scripts/render-c2c.py).
  const renderedArticle = (file) => {
    const html = fs.readFileSync(path.join(__dirname, file), "utf8");
    const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    if (!body) throw new Error(`${file} has no rendered body; run its npm render script`);
    // The site layout owns the title, navigation, and metadata.
    return body[1].replace(/<header\b[^>]*id="title-block-header"[^>]*>[\s\S]*?<\/header>/i, "").trim();
  };
  eleventyConfig.addWatchTarget("quarto/cachemoney/index.html");
  eleventyConfig.addWatchTarget("quarto/core-to-core/index.html");
  eleventyConfig.addShortcode("renderedArticle", renderedArticle);
  eleventyConfig.addShortcode("cacheArticle", () => renderedArticle("quarto/cachemoney/index.html"));
  eleventyConfig.addFilter("sortByOrder", (items, key = "order") =>
    [...items].sort((a, b) => (a.data[key] ?? a.data.order ?? 0) - (b.data[key] ?? b.data.order ?? 0)),
  );
  eleventyConfig.addFilter("sortByDateDescending", (items) =>
    [...items].sort((a, b) => b.date - a.date),
  );
  eleventyConfig.addFilter("isoDate", (date) => date.toISOString().slice(0, 10));
  eleventyConfig.addFilter("readableDate", (date) =>
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date),
  );

  eleventyConfig.addPassthroughCopy("CNAME");
  eleventyConfig.addPassthroughCopy("robots.txt");
  eleventyConfig.addPassthroughCopy("styles");
  eleventyConfig.addPassthroughCopy("fonts");
  eleventyConfig.addPassthroughCopy("Media");
  eleventyConfig.addPassthroughCopy("Jacen_Li_Resume.pdf");
  eleventyConfig.addPassthroughCopy({ "quarto/cachemoney/share-v1.png": "cachemoney/share-v1.png" });
  eleventyConfig.addPassthroughCopy({ "quarto/cachemoney/share-v2.png": "cachemoney/share-v2.png" });
  // Core to core article: figures, animations, widget data and the four widgets (not their
  // prototype pages, old versions or the scripts that made the figures).
  const c2c = "quarto/core-to-core/figures";
  eleventyConfig.addPassthroughCopy({ [`${c2c}/*.{png,gif,webp,json}`]: "c2c/figures" });
  eleventyConfig.addPassthroughCopy({ [`${c2c}/images/*`]: "c2c/figures/images" });
  const widgetFiles = {
    explorer: "explorer.css,explorer.js,diomedea.json",
    homes: "homes.css,homes.js,homes.json",
    pool: "pool.css,pool.js",
    place: "place.css,place.js",
  };
  for (const [w, files] of Object.entries(widgetFiles)) {
    eleventyConfig.addPassthroughCopy({ [`${c2c}/${w}/{${files}}`]: `c2c/figures/${w}` });
  }
  eleventyConfig.addPassthroughCopy({ "quarto/core-to-core/share.png": "c2c/share.png" });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "_site",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
