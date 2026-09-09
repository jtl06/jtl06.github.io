const article = require("../_data/cacheArticle.json");

module.exports = {
  layout: "base.njk",
  title: `${article.title} — Jacen Li`,
  listingTitle: article.title,
  summary: article.summary,
  permalink: "/writings/caches-and-interconnects/",
  date: "2026-09-08",
  homeLabel: "2026",
  nav: "writings",
  tags: ["writings"],
  isCacheArticle: true,
};
