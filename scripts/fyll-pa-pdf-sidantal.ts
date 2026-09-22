// Engangsjobb: fyller pa sidantal for PDF-bilagor som laddades upp innan
// flersidesvyn fanns (docs/design.md, "Bilagor": "En PDF med flera sidor
// visas med alla sidor").
//
//   npm run pdf-sidor:fyll-pa
//
// Gar igenom PDF-bilagor med sidantal = null, laddar ner originalet och lasker
// bara dess sidtrad – ingen rendering (src/lib/lagring/pdf-sidor.ts). Sjalva
// sidorna renderas i webblasaren nar bilagan visas (src/lib/pdfjs-klient.ts),
// och behover darfor inte fyllas pa i efterhand.
//
// Loggar varje rad – lyckad eller misslyckad – sa att en PDF som inte gick att
// lasa syns i stallet for att tyst forbli utan sidantal. Idempotent: en rad
// som redan har sidantal satt hoppas over.
//
// Kors INTE automatiskt nagonstans – bara pa uttrycklig begaran (kommandot
// ovan). En PDF utan sidantal fungerar anda: granssnittet faller da tillbaka
// pa dokumentikonen och en lank till originalet (src/app/kostnad/[id]/bilagor.tsx).
//
// npm-scriptet kor med --conditions=react-server, av samma skal som
// visningsversion:fyll-pa: modulerna vi ateranvander (klient.ts, pdf-sidor.ts)
// ar markerade "server-only".

import { prisma } from "@/lib/prisma";
import { bilagelager } from "@/lib/lagring/klient";
import { raknaPdfSidor } from "@/lib/lagring/pdf-sidor";

async function main(): Promise<void> {
  const kandidater = await prisma.bilaga.findMany({
    where: { sidantal: null, mimetyp: "application/pdf" },
    select: { id: true, lagringsnyckel: true },
    orderBy: { skapad_at: "asc" },
  });

  console.log(`${kandidater.length} PDF-bilagor utan sidantal hittade.\n`);

  let lyckade = 0;
  let misslyckade = 0;

  for (const bilaga of kandidater) {
    try {
      const { data: blob, error } = await bilagelager().download(
        bilaga.lagringsnyckel,
      );
      if (error || !blob) throw error ?? new Error("kunde inte hämta originalet");
      const original = Buffer.from(await blob.arrayBuffer());

      const sidantal = await raknaPdfSidor(original);

      await prisma.bilaga.update({
        where: { id: bilaga.id },
        data: { sidantal },
      });

      lyckade++;
      console.log(`OK     ${bilaga.lagringsnyckel} (${sidantal} sidor)`);
    } catch (fel) {
      misslyckade++;
      const text = fel instanceof Error ? fel.message : String(fel);
      console.error(`FEL    ${bilaga.lagringsnyckel}: ${text}`);
    }
  }

  console.log(
    `\nKlart: ${lyckade} PDF:er fick sidantal, ${misslyckade} misslyckade.`,
  );
  if (misslyckade > 0) {
    console.log(
      "De misslyckade PDF:erna fungerar fortfarande – originalet är sparat och orört, och visas med dokumentikonen tills vidare. Kör skriptet igen för att försöka på nytt; redan klara rader görs inte om.",
    );
  }
}

main()
  .catch((fel) => {
    console.error(fel);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
