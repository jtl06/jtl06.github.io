// .eleventy.js

module.exports = function(eleventyConfig) {

  // Shortcode for current year
  // You can use this in your templates like: {% year %}
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // Passthrough copy for static assets
  // This tells Eleventy to copy these files/folders directly to the output directory
  eleventyConfig.addPassthroughCopy("input/css"); // Assuming your CSS is in input/css
  // eleventyConfig.addPassthroughCopy("input/img");  // If you have an images folder
  // eleventyConfig.addPassthroughCopy("input/js");   // If you have a JavaScript folder

  // Configuration object
  return {
    // Specify input and output directories relative to the project root
    dir: {
      input: "input",       // Your source files (templates, markdown, etc.)
      includes: "_includes",  // For layouts, partials
      data: "_data",        // For global data files
      output: "_site"       // Where the final static site will be built
    },

    // Set Nunjucks as the templating engine for Markdown and HTML files
    // This allows you to use Nunjucks features (like variables, filters, shortcodes)
    // within your .md and .html files.
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",

    // You can add other configurations here if needed
  };
};