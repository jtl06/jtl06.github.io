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
  // Section heading rendered as a shell turn: the working directory, then the command.
  // The plain-language label stays available to screen readers.
  eleventyConfig.addShortcode("cmd", (command, label, { path = "~/", href = "", tag = "h2", id = "" } = {}) => {
    const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    // Color like the wheatgrass theme colors code: command as keyword, flags as constants, paths as variables.
    const tokens = command.split(" ").map((token, i) => {
      const kind = i === 0 ? "cmd__name" : token.startsWith("-") ? "cmd__flag" : "cmd__arg";
      return `<span class="${kind}">${escape(token)}</span>`;
    });
    const text = href ? `<a href="${escape(href)}">${tokens.join(" ")}</a>` : tokens.join(" ");
    const idAttr = id ? ` id="${escape(id)}"` : "";
    return `<${tag} class="cmd"${idAttr} aria-label="${escape(label)}"><span class="cmd__path" aria-hidden="true">${escape(path)}</span><span class="cmd__line" aria-hidden="true"><span class="cmd__sigil">$</span> ${text}</span></${tag}>`;
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
  eleventyConfig.addPassthroughCopy("js");
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
