// Engangsjobb: satter merkostnad_bas for projekt som besvarades innan
// kolumnen fanns. Se src/lib/merkostnad-bas.ts for skalen och skydden.
//
//   npm run merkostnad-bas:fyll-pa             torrt – listar, skriver inget
//   npm run merkostnad-bas:fyll-pa -- --skarpt skriver
//
// Kors INTE automatiskt nagonstans – bara pa uttrycklig begaran.

import { fyllPaMerkostnadBas } from "@/lib/merkostnad-bas";
import { prisma } from "@/lib/prisma";

async function main(): Promise<void> {
  const skarpt = process.argv.includes("--skarpt");
  const { rader, skrivna } = await fyllPaMerkostnadBas({ skarpt });

  console.log(skarpt ? "SKARPT LÄGE" : "TORRT LÄGE – ingenting skrivs");
  console.log(`${rader.length} projekt har en merkostnad men inget jämförelsetal.\n`);
  for (const r of rader) {
    console.log(`${r.id}  bostad ${r.bostadId}  "${r.namn}"  -> merkostnad_bas ${r.bas}`);
  }
  if (skarpt) console.log(`\n${skrivna} rader skrivna.`);
}

main()
  .catch((fel) => {
    console.error(fel);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
