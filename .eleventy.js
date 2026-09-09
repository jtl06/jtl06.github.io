const fs = require("node:fs");
const path = require("node:path");

module.exports = function (eleventyConfig) {
  const articlePath = path.join(__dirname, "quarto/cachemoney/index.html");
  eleventyConfig.addWatchTarget("quarto/cachemoney/index.html");
  eleventyConfig.addShortcode("cacheArticle", () => {
    const html = fs.readFileSync(articlePath, "utf8");
    const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    if (!body) throw new Error("Quarto article has no rendered body; run npm run render:cachemoney");
    // The site layout owns the title, navigation, and metadata.
    return body[1].replace(/<header\b[^>]*id="title-block-header"[^>]*>[\s\S]*?<\/header>/i, "").trim();
  });
  eleventyConfig.addFilter("sortByOrder", (items, key = "order") =>
    [...items].sort((a, b) => (a.data[key] ?? a.data.order ?? 0) - (b.data[key] ?? b.data.order ?? 0)),
  );
  eleventyConfig.addFilter("sortByDateDescending", (items) =>
    [...items].sort((a, b) => b.date - a.date),
  );
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
