// Run with Node.js and sharp installed (or available through NODE_PATH).
const path = require("node:path");
const sharp = require("sharp");

async function main() {
  const article = path.join(__dirname, "../quarto/cachemoney");
  const diagram = await sharp(path.join(article, "images/cache-interconnects/interconnects-paired.svg"))
    .resize({ width: 1080, height: 350, fit: "contain", background: "#ffffff" })
    .png().toBuffer();
  const heading = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#0f1110"/>
    <text x="60" y="78" font-family="sans-serif" font-size="23" fill="#a8b35f">JACEN LI / SYSTEMS NOTES</text>
    <text x="60" y="151" font-family="sans-serif" font-weight="700" font-size="54" fill="#d8d2c5">Caches &amp; Interconnects</text>
    <text x="60" y="199" font-family="sans-serif" font-size="25" fill="#b8b3a8">How CPU structure shapes data access and performance</text>
    <text x="60" y="607" font-family="sans-serif" font-size="20" fill="#a8b35f">jacen.li/cachemoney</text>
  </svg>`);
  await sharp(heading).composite([{ input: diagram, left: 60, top: 225 }])
    .png().toFile(path.join(article, "share-v1.png"));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
