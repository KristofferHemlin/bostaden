// Kor utvalda provfiler och vagrar att se en tom korning som ett utfall
// (CLAUDE.md, "Ett misstag som upprepas rättas i kommandot, inte i
// uppmärksamheten"). Tre ganger hamnade tva filnamn som ETT argument, vitest
// hittade inga filer, och den tomma utskriften sag ut som att ingenting foll.
//
// Kommandot gor det felet omojligt i stallet for att be om vaksamhet:
//   1. varje argument maste vara en befintlig fil – "a.test.ts b.test.ts" som
//      ett argument ar ingen fil, och korningen stannar innan den borjar;
//   2. vitest far filerna som en lista, aldrig genom ett skal;
//   3. utfallet lases ur vitests JSON-rapport, och varje namngiven fil maste
//      finnas i den med minst ett kort prov – annars ar korningen ett fel,
//      inte ett gront besked.
// Utskriften ar en rad per fil och en per fallet prov, och exitkoden ar 0
// bara nar allt kordes och inget foll.
//
//   npm run prova -- tester/a.test.ts tester/b.test.ts
//   npm run prova -- --fa-falla tester/a.test.ts   (en brytning med flit:
//     exitkod 0 bara om nagot FOLL, sa att en brytning som inte fäller
//     nagot syns)

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const argv = process.argv.slice(2);
const faFalla = argv[0] === "--fa-falla";
const filer = faFalla ? argv.slice(1) : argv;

function avbryt(rad) {
  console.error(`prova: ${rad}`);
  process.exit(2);
}

if (filer.length === 0) avbryt("inga provfiler angivna.");
for (const f of filer) {
  let info;
  try {
    info = statSync(f);
  } catch {
    avbryt(`"${f}" finns inte. Är det två filnamn i ett argument?`);
  }
  if (!info.isFile()) avbryt(`"${f}" är ingen fil.`);
}

const katalog = mkdtempSync(path.join(tmpdir(), "prova-"));
const rapport = path.join(katalog, "utfall.json");
const vitest = path.join(process.cwd(), "node_modules", ".bin", "vitest");
const korning = spawnSync(vitest, ["run", ...filer, "--reporter=json", `--outputFile=${rapport}`], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

let utfall;
try {
  utfall = JSON.parse(readFileSync(rapport, "utf8"));
} catch {
  process.stderr.write(korning.stderr ?? "");
  process.stdout.write(korning.stdout ?? "");
  rmSync(katalog, { recursive: true, force: true });
  avbryt(`vitest lämnade ingen rapport (exitkod ${korning.status}).`);
}
rmSync(katalog, { recursive: true, force: true });

let saknas = false;
let fallna = 0;
for (const f of filer) {
  const abs = path.resolve(f);
  const fil = utfall.testResults.find((r) => r.name === abs);
  const prov = fil?.assertionResults ?? [];
  const korda = prov.filter((p) => p.status === "passed" || p.status === "failed");
  const foll = prov.filter((p) => p.status === "failed");
  fallna += foll.length;
  if (!fil || korda.length === 0) {
    saknas = true;
    console.log(`SAKNAS ${f}: inga prov kördes${fil?.message ? ` (${fil.message.split("\n")[0]})` : ""}`);
    continue;
  }
  console.log(`${foll.length > 0 ? "FÖLL " : "GRÖN "} ${f}: ${korda.length} körda, ${foll.length} föll`);
  for (const p of foll) {
    console.log(`  × ${p.fullName}`);
    const meddelande = (p.failureMessages?.[0] ?? "").split("\n")[0];
    if (meddelande) console.log(`    → ${meddelande.slice(0, 200)}`);
  }
}

if (saknas) process.exit(2);
if (faFalla) {
  if (fallna === 0) {
    console.log("prova: brytningen fällde ingenting.");
    process.exit(1);
  }
  process.exit(0);
}
process.exit(fallna > 0 ? 1 : 0);
