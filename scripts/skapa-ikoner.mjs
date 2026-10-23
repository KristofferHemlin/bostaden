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

// Den neutrala delningsbilden: market i naturlig storlek mitt pa en yta i
// --yta-bas, 1200 x 630. Ingen text – ingenting som kan bara anvandarens
// innehall. Galler varje sida utom landningssidan.
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

// Landningssidans delningsbild (docs/design.md, "Sidans metadata"):
// hjaltebilden i samma webblasarram som pa sidan, centrerad pa --yta-bas.
// Skarmbilden ar 800 x 678 och delningsbilden 1200 x 630 – den skalas NED
// till ramens hojd med bibehallen proportion, aldrig strackt och aldrig upp.
const HJALTEBILD = "public/hero-920x780.jpg";
// Farger ur src/app/globals.css, som tal av samma skal som YTA_BAS.
const LINJE = "#d1c5b6";
const YTA_NEDSANKT = "#e4d8cc";
const SAND_MORK = "#b99a76";

async function landningssidansDelningsbild() {
  const B = 1200;
  const H = 630;
  const MARGINAL = 48;
  const LIST = 28; // ramens topplist, samma som h-7 pa sidan
  const { width: hb, height: hh } = await sharp(HJALTEBILD).metadata();
  const bildH = H - 2 * MARGINAL - LIST - 2; // 2 = ramens kant upptill och nedtill
  const bildB = Math.round((hb * bildH) / hh);
  if (bildH > hh) throw new Error("Skarmbilden ar for liten – den skulle skalas upp");
  const ramB = bildB + 2;
  const ramH = bildH + LIST + 2;
  const x = Math.round((B - ramB) / 2);
  const y = MARGINAL;
  const ram = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ramB}" height="${ramH}">
    <defs><clipPath id="r"><rect x="0.5" y="0.5" width="${ramB - 1}" height="${ramH - 1}" rx="12"/></clipPath></defs>
    <g clip-path="url(#r)">
      <rect width="${ramB}" height="${LIST + 1}" fill="${YTA_NEDSANKT}"/>
      <rect y="${LIST}" width="${ramB}" height="1" fill="${LINJE}"/>
      ${[0, 1, 2].map((i) => `<circle cx="${17 + i * 16}" cy="${LIST / 2 + 0.5}" r="5" fill="${SAND_MORK}"/>`).join("")}
    </g>
    <rect x="0.5" y="0.5" width="${ramB - 1}" height="${ramH - 1}" rx="12" fill="none" stroke="${LINJE}"/>
  </svg>`);
  const bild = await sharp(HJALTEBILD).resize(bildB, bildH, { kernel: "lanczos3" }).toBuffer();
  // Bildens nedre horn rundas som ramens, sa att den inte sticker ut.
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${bildB}" height="${bildH}">
    <path d="M0 0 H${bildB} V${bildH - 11} Q${bildB} ${bildH} ${bildB - 11} ${bildH} H11 Q0 ${bildH} 0 ${bildH - 11} Z" fill="#fff"/>
  </svg>`);
  const rundad = await sharp(bild).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  return sharp({ create: { width: B, height: H, channels: 3, background: YTA_BAS } })
    .composite([
      { input: ram, left: x, top: y },
      { input: rundad, left: x + 1, top: y + LIST + 1 },
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
  "public/delningsbild.jpg": await delningsbild(),
  "public/delningsbild-landningssida.jpg": await landningssidansDelningsbild(),
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
