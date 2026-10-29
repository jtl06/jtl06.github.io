const title = "Core to Core is not Core to Core";
const summary =
  "Core to core latency depends on the physical address as well as the two cores: every transfer goes through the line's home on the mesh. How I found it, measured it, and used it.";
const url = "https://jacen.li/writings/core-to-core-is-not-core-to-core/";

module.exports = {
  layout: "base.njk",
  title: `${title} — Jacen Li`,
  listingTitle: title,
  summary,
  permalink: "/writings/core-to-core-is-not-core-to-core/",
  date: "2026-11-01",
  homeLabel: "2026",
  nav: "writings",
  tags: ["writings"],
  articleMeta: {
    title,
    summary,
    url,
    image: "https://jacen.li/c2c/share.png",
    imageWidth: 1200,
    imageHeight: 628,
    imageAlt: "Mesh of a 32-core Xeon, each tile labelled with the CPU 4 to CPU 6 handoff latency for a line homed there, from 43.1 to 68.8 ns.",
  },
  // Interactive figures: CSS in <head>, JS at the end of <body>, this page only.
  widgets: ["explorer", "homes", "pool", "place"].map((w) => `/c2c/figures/${w}/${w}`),
  widgetVersion: "20261029a",
};
