// Builds the virtual file tree for the optional terminal console (js/console.js)
// from the same collections that drive the listing pages.

const slug = (url) => url.split("/").filter(Boolean).pop();

// A page is a directory you can cd into (it navigates there) and cat (its summary).
const page = (item, extra = {}) => ({
  type: "page",
  title: item.data.listingTitle,
  label: item.data.listingLabel || item.data.homeLabel || "",
  summary: item.data.summary || "",
  short: item.data.homeSummary || "",
  url: item.url,
  ...extra,
});

const dir = (url, children) => ({ type: "dir", url, children });

const files = (items = []) =>
  Object.fromEntries(
    [...items]
      .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
      .map((item) => [slug(item.url), page(item)]),
  );

class FileTree {
  data() {
    return {
      permalink: "/fs.json",
      eleventyExcludeFromCollections: true,
    };
  }

  render({ collections }) {
    const writings = [...(collections.writings || [])].sort((a, b) => b.date - a.date);

    const tree = dir("/", {
      projects: dir("/projects/", {
        ...files(collections.selectedProjects),
        misc: dir("/projects/misc/", files(collections.miscProjects)),
      }),
      oss: dir("/projects/#open-source", files(collections.openSourceProjects)),
      keyboards: dir("/keyboards/", files(collections.keyboardProjects)),
      writings: dir(
        "/writings/",
        Object.fromEntries(writings.map((item) => [slug(item.url), page(item, { label: String(item.date.getUTCFullYear()) })])),
      ),
      machines: {
        type: "page",
        title: "machines",
        label: "",
        summary: "Home lab hardware.",
        url: "/machines/",
      },
      about: {
        type: "page",
        title: "about",
        label: "",
        summary: "ECE student at the University of Washington working on low-level hardware/software systems.",
        lines: [
          "github    https://github.com/jtl06",
          "linkedin  https://www.linkedin.com/in/jacen-li/",
          "email     jacenli@icloud.com",
        ],
        url: "/about/",
      },
      resume: {
        type: "page",
        title: "resume",
        label: "",
        summary: "Experience, skills, and projects.",
        url: "/resume/",
      },
      "resume.pdf": {
        type: "file",
        title: "resume",
        label: "PDF",
        summary: "Experience, skills, and projects.",
        url: "/Jacen_Li_Resume.pdf",
      },
    });

    return JSON.stringify(tree);
  }
}

module.exports = FileTree;
