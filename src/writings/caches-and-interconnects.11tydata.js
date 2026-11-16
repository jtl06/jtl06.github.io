const article = require("../_data/cacheArticle.json");

module.exports = {
  layout: "base.njk",
  // Search/browser title; the headline on the page stays article.title.
  title: `${article.title}: CPU caches, L3 slices and mesh interconnects — Jacen Li`,
  listingTitle: article.title,
  summary: article.summary,
  permalink: "/writings/caches-and-interconnects/",
  date: "2026-09-08",
  updated: "2026-11-15",   // rewritten with the measured L3 map
  homeLabel: "2026",
  nav: "writings",
  tags: ["writings"],
  isCacheArticle: true,
  // Interactive figure: CSS in <head>, JS at the end of <body>, this page only.
  widgets: ["/cachemoney/figures/l3map/l3map"],
  widgetVersion: "20261115c",
};
