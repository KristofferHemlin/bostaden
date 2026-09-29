// Seedar ENDAST tabellen regelparameter – tröskelbeloppet, femårsfönstret och
// de bakre tidsgränserna. Ingen bostad, inget konto, inga kvitton.
//
//   npm run db:seed-regelparameter            -> torrt: loggar vad som skulle göras
//   npm run db:seed-regelparameter -- --skarpt -> skriver
//
// Skrevs efter att produktionen tömdes 2026-09-29 (CLAUDE.md, "Databasen delas
// med produktionen"): regelparametrarna är regler, inte testdata, och ska
// aldrig behöva läggas in för hand igen.
//
// Värdena kommer från SEED_REGELPARAMETRAR i src/doman/seeddata.ts, samma
// källa som prisma/seed.ts och domäntesterna använder – talen står inte en
// gång till här.
//
// Idempotent och additiv: en parameter som redan finns med samma nyckel och
// giltig_fran hoppas över, även om värdet skiljer sig (det loggas då som en
// avvikelse att titta på). Ingenting raderas och ingenting skrivs över – en
// versionerad parameter ändras genom en ny rad med ny giltighetsperiod, inte
// genom att den gamla skrivs om.

import { PrismaClient } from "@prisma/client";
import { SEED_REGELPARAMETRAR } from "../src/doman/seeddata";

const skarpt = process.argv.includes("--skarpt");
const prisma = new PrismaClient();

/** "YYYY-MM-DD" -> Date vid midnatt UTC. Kolumnerna är @db.Date. */
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (datum: Date) => datum.toISOString().slice(0, 10);

async function main() {
  const befintliga = await prisma.regelparameter.findMany();
  let attSkapa = 0;
  let avvikelser = 0;

  for (const p of SEED_REGELPARAMETRAR) {
    const finns = befintliga.find(
      (b) => b.nyckel === p.nyckel && iso(b.giltig_fran) === p.giltig_fran,
    );
    if (finns) {
      const samma =
        finns.varde === p.varde &&
        finns.enhet === p.enhet &&
        (finns.giltig_till ? iso(finns.giltig_till) : null) === p.giltig_till;
      if (samma) {
        console.log(`finns redan   ${p.nyckel} från ${p.giltig_fran}`);
      } else {
        avvikelser++;
        console.log(
          `AVVIKER       ${p.nyckel} från ${p.giltig_fran}: databasen har ${finns.varde} ${finns.enhet}, seeden ${p.varde} ${p.enhet} – rörs inte`,
        );
      }
      continue;
    }

    attSkapa++;
    console.log(
      `${skarpt ? "skapar " : "skulle skapa"}  ${p.nyckel} = ${p.varde} ${p.enhet}, från ${p.giltig_fran}${p.giltig_till ? ` till ${p.giltig_till}` : ""}`,
    );
    if (skarpt) {
      await prisma.regelparameter.create({
        data: {
          nyckel: p.nyckel,
          varde: p.varde,
          enhet: p.enhet,
          giltig_fran: d(p.giltig_fran),
          giltig_till: p.giltig_till ? d(p.giltig_till) : null,
          kalla: "CLAUDE.md, Domänregler",
        },
      });
    }
  }

  console.log(
    `${skarpt ? "Klart" : "Torrkörning"}: ${attSkapa} att skapa, ${SEED_REGELPARAMETRAR.length - attSkapa - avvikelser} fanns redan, ${avvikelser} avviker.` +
      (skarpt ? "" : " Kör med --skarpt för att skriva."),
  );
  if (avvikelser > 0) process.exitCode = 1;
}

main()
  .catch((fel) => {
    console.error(fel);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
