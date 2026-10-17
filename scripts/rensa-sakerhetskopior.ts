// Rensar sakerhetskopior aldre an RENSNINGSGRANS_DAGAR (src/lib/sakerhetskopior/rensning.ts).
//
//   npm run sakerhetskopior:rensa                torrkorning – listar, raderar inget
//   npm run sakerhetskopior:rensa -- --radera    raderar det som listats
//
// Bade veckokopiorna och raderingskommandots radering-<tid>-<id>/ omfattas.
// Den sista hela veckokopian raderas aldrig; se rensning.ts for varfor.
//
// Samma rensning kors efter varje lyckad kopia i scripts/sakerhetskopiera.ts.
// Det har kommandot ar for att se listan, eller rensa utan att ta en ny kopia.
//
// Slutkoder: 0 klart, 1 fel, 3 gamla kopior sparrade – kopieringen har slutat
// fungera och uppgifter ligger kvar langre an integritetspolicyn lovar.

import { existsSync } from "node:fs";
import path from "node:path";
import { sakerhetskopiekatalog } from "@/lib/sakerhetskopior/katalog";
import { rensaSakerhetskopior } from "@/lib/sakerhetskopior/rensning";

const REPOTS_ROT = path.resolve(import.meta.dirname, "..");

async function main(): Promise<number> {
  const argument = process.argv.slice(2);
  const okanda = argument.filter((a) => a !== "--radera");
  if (okanda.length > 0) {
    console.error(`Okänt argument: ${okanda.join(" ")}. Använd --radera för att radera, inget för en torrkörning.`);
    return 1;
  }
  const rot = sakerhetskopiekatalog(REPOTS_ROT);
  if (!existsSync(rot)) {
    console.log(`Katalogen ${rot} finns inte – inga kopior att rensa.`);
    return 0;
  }
  const { sparrade } = await rensaSakerhetskopior(rot, {
    radera: argument.includes("--radera"),
    skriv: (rad = "") => console.log(rad),
  });
  return sparrade > 0 ? 3 : 0;
}

main()
  .then((kod) => process.exit(kod))
  .catch((e) => {
    console.error(`\nRENSNINGEN MISSLYCKADES: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
