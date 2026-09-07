module.exports = function (eleventyConfig) {
  eleventyConfig.addFilter("sortByOrder", (items) =>
    [...items].sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0)),
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
  eleventyConfig.addPassthroughCopy({ "quarto/cachemoney/index.html": "cachemoney/index.html" });

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
