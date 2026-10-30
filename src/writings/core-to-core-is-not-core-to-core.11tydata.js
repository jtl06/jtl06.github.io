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
  date: "2026-10-29",
  homeLabel: "2026",
  nav: "writings",
  tags: ["writings"],
  articleMeta: {
    title,
    summary,
    url,
    image: "https://jacen.li/c2c/share.png",
    imageWidth: 1200,
    imageHeight: 630,
    imageAlt: "Histogram of CAS handoff latency for 256 lines between CPUs 0 and 1 on a 32-core Xeon, 41 to 60 ns, with the homes of the fastest, middle and slowest lines marked on the mesh.",
  },
  // Interactive figures: CSS in <head>, JS at the end of <body>, this page only.
  widgets: ["explorer", "fit", "homes", "pool", "lottery", "place"].map((w) => `/c2c/figures/${w}/${w}`),
  widgetVersion: "20261029b",
};
