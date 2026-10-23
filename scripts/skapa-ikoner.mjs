// Bygger appens ikoner, toppradens logotyp och delningsbilden ur EN kalla,
// public/kvittobo-logo.png (docs/design.md, "Ikoner, delning och metadata").
// Kors for hand nar kallan byts – utfilerna ar incheckade, bygget ror dem inte.
//
//   node scripts/skapa-ikoner.mjs
//
// Kallan ar 384 x 410 px och alltsa inte kvadratisk. Market centreras pa en
// kvadrat i --yta-bas – det strackts aldrig och beskars aldrig. Kvadratens
// sida ar kallans hojd (410), sa 512 ar en uppskalning med faktor 1,25.

import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const KALLA = "public/kvittobo-logo.png";
// --yta-bas i src/app/globals.css. Har som tal eftersom sharp inte laser CSS;
// tester/ikoner.test.ts haller dem lika.
const YTA_BAS = "#f0e9df";

// Toppraden visar logotypen som h-6/sm:h-7, alltsa hogst 28 CSS-pixlar.
// Tre gangers tathet tacker varje telefon som finns.
const TOPPRADEN_HOJD = 28 * 3;

const { width, height } = await sharp(KALLA).metadata();
const sida = Math.max(width, height);

async function kvadrat() {
  return sharp({
    create: { width: sida, height: sida, channels: 4, background: YTA_BAS },
  })
    .composite([
      {
        input: KALLA,
        left: Math.round((sida - width) / 2),
        top: Math.round((sida - height) / 2),
      },
    ])
    .png()
    .toBuffer();
}

async function ikon(storlek) {
  return sharp(await kvadrat())
    .resize(storlek, storlek, { kernel: "lanczos3" })
    .flatten({ background: YTA_BAS })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// En .ico med en enda PNG-post (tillatet sedan Windows Vista, och det alla
// webblasare laser). Sharp skriver inte ICO, men formatet ar 22 byte huvud.
function ico(png, storlek) {
  const huvud = Buffer.alloc(22);
  huvud.writeUInt16LE(0, 0); // reserverat
  huvud.writeUInt16LE(1, 2); // typ: ikon
  huvud.writeUInt16LE(1, 4); // antal bilder
  huvud.writeUInt8(storlek, 6);
  huvud.writeUInt8(storlek, 7);
  huvud.writeUInt8(0, 8); // ingen palett
  huvud.writeUInt8(0, 9);
  huvud.writeUInt16LE(1, 10); // plan
  huvud.writeUInt16LE(32, 12); // bitar per pixel
  huvud.writeUInt32LE(png.length, 14);
  huvud.writeUInt32LE(22, 18);
  return Buffer.concat([huvud, png]);
}

// Delningsbilden: market i naturlig storlek mitt pa en yta i --yta-bas,
// 1200 x 630. Ingen text – ingenting som kan bara anvandarens innehall.
async function delningsbild() {
  const B = 1200;
  const H = 630;
  return sharp({ create: { width: B, height: H, channels: 3, background: YTA_BAS } })
    .composite([
      {
        input: KALLA,
        left: Math.round((B - width) / 2),
        top: Math.round((H - height) / 2),
      },
    ])
    .flatten({ background: YTA_BAS })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

const ikon32 = await ikon(32);
const filer = {
  "src/app/favicon.ico": ico(ikon32, 32),
  "src/app/apple-icon.png": await ikon(180),
  "public/ikon-192.png": await ikon(192),
  "public/ikon-512.png": await ikon(512),
  "src/app/opengraph-image.jpg": await delningsbild(),
  "public/kvittobo-logo-toppraden.png": await sharp(KALLA)
    .resize({ height: TOPPRADEN_HOJD, kernel: "lanczos3" })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer(),
};

for (const [sokvag, innehall] of Object.entries(filer)) {
  await mkdir(sokvag.split("/").slice(0, -1).join("/"), { recursive: true });
  await writeFile(sokvag, innehall);
  console.log(`${sokvag}  ${innehall.length} byte`);
}
