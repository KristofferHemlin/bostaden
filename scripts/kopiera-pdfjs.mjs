// Kopierar pdf.js browser-byggena till public/ sa att de kan laddas som rena
// ES-moduler i webblasaren. Det moderna pdf.mjs gar inte att bunta med Next:s
// webpack ("Object.defineProperty called on non-object" i __webpack_require__.r),
// sa i stallet importeras filen fran /pdfjs/ vid korning (webpackIgnore).
//
// Kors automatiskt via npm-scripten "predev" och "prebuild". Filerna ar
// versionsstyrda av pdfjs-dist i package.json och gitignoreas under public/pdfjs.

import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rot = join(dirname(fileURLToPath(import.meta.url)), "..");
const fran = join(rot, "node_modules", "pdfjs-dist", "build");
const till = join(rot, "public", "pdfjs");

mkdirSync(till, { recursive: true });
for (const namn of ["pdf.min.mjs", "pdf.worker.min.mjs"]) {
  copyFileSync(join(fran, namn), join(till, namn));
  console.log(`kopierade ${namn} -> public/pdfjs/${namn}`);
}
