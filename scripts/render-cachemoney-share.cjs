// Run with Node.js, Playwright, and Chromium (or CHROME_PATH) available.
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

async function main() {
  const article = path.join(__dirname, "../quarto/cachemoney");
  const svg = await fs.readFile(path.join(article, "images/cache-interconnects/interconnects-paired.svg"), "utf8");
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1840, height: 579 }, deviceScaleFactor: 1 });
    // The original SVG embeds Excalifont; Chromium honors its @font-face rules.
    await page.setContent(`<style>html,body{margin:0;background:white}svg{display:block;width:1840px;height:579px}</style>${svg}`);
    await page.evaluate(async () => {
      await document.fonts.ready;
      if (![...document.fonts].some(font => font.family.includes("Excalifont") && font.status === "loaded")) {
        throw new Error("Embedded Excalifont did not load");
      }
    });
    await page.locator("svg").screenshot({ path: path.join(article, "share-v2.png") });
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
