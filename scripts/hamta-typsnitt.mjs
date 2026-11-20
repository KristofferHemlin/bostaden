// Hamtar appens typsnitt en gang till public/typsnitt/. Appen serverar dem
// sjalv – ingen sida hamtar nagot fran Googles servrar, sa Google far inte
// besokarnas IP-adresser (integritetspolicyn; 2026-11-20 lankade varje sida,
// aven landningssidan, till fonts.googleapis.com). Webblasarproven mater med
// samma filer, sa att sviten inte heller hamtar nagot over natet (CLAUDE.md,
// "En svit som hämtar något över nätet mäter inte bara koden").
//
// Vilka typsnitt och vikter bestams i KALLA (scripts/typsnittskalla.mjs), och skrivs overst i
// typsnitt.css. tester/typsnitt-lokalt.test.ts faller om filen och KALLA
// sager olika.
//
// Kor: node scripts/hamta-typsnitt.mjs

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KALLA } from "./typsnittskalla.mjs";

const ROT = new URL("..", import.meta.url).pathname;
const KATALOG = join(ROT, "public/typsnitt");

const adress = KALLA;

// Google valjer filformat efter anvandaragenten; en Chrome-agent ger woff2.
const AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const svar = await fetch(adress, { headers: { "user-agent": AGENT } });
if (!svar.ok) throw new Error(`Google Fonts svarade ${svar.status} för ${adress}`);
let css = await svar.text();

rmSync(KATALOG, { recursive: true, force: true });
mkdirSync(KATALOG, { recursive: true });

// En fil per unik adress. Namnet: familj och delmangd, ur kommentaren fore
// varje @font-face ("/* latin-ext */").
const namnFor = new Map();
for (const block of css.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([^}]+)\}/g)) {
  const [, delmangd, kropp] = block;
  const familj = kropp.match(/font-family: '([^']+)'/)[1].toLowerCase().replaceAll(" ", "-");
  const url = kropp.match(/url\((https:[^)]+\.woff2)\)/)[1];
  if (!namnFor.has(url)) namnFor.set(url, `${familj}-${delmangd}.woff2`);
}
if (namnFor.size === 0) throw new Error("inga woff2-filer i svaret – fel användaragent?");

for (const [url, namn] of namnFor) {
  const fil = await fetch(url);
  if (!fil.ok) throw new Error(`${url} svarade ${fil.status}`);
  writeFileSync(join(KATALOG, namn), Buffer.from(await fil.arrayBuffer()));
  css = css.replaceAll(url, namn);
}

writeFileSync(
  join(KATALOG, "typsnitt.css"),
  `/* Kalla: ${adress} */\n/* Skapad av scripts/hamta-typsnitt.mjs – andra inte for hand. */\n${css}`,
);
console.log(`${namnFor.size} filer i public/typsnitt/`);
