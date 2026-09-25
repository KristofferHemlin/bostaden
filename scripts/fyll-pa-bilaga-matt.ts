// Engangsjobb: fyller pa bredd/hojd for bilagor som laddades upp innan matten
// borjade lagras (docs/produktspec.md, "PDF-sidor renderas i webbläsaren":
// "Befintliga bilagor saknar måtten och fylls på med ett engångsjobb med
// logg, samma mönster som visningsversionen").
//
//   npm run bilaga-matt:fyll-pa
//
// Gar igenom bilagor med bredd = null, laddar ner originalet och lasker dess
// matt – for en bild via sharp (src/lib/lagring/bildmatt.ts), for en PDF ur
// forsta sidans /MediaBox (src/lib/lagring/pdf-sidor.ts). Ingen rendering av
// nagot slag, precis som pdf-sidantalet.
//
// Loggar varje rad – lyckad eller misslyckad – sa att en bilaga som inte gick
// att mata syns i stallet for att tyst forbli utan matt. Idempotent: en rad
// som redan har bredd satt hoppas over, sa skriptet gar att kora om utan att
// gora om det som redan ar klart.
//
// Kors INTE automatiskt nagonstans – bara pa uttrycklig begaran (kommandot
// ovan). En bilaga utan matt fungerar anda: granssnittet reserverar da ett
// staende format i stallet (src/app/kostnad/[id]/bilagor.tsx).
//
// npm-scriptet kor med --conditions=react-server, av samma skal som
// visningsversion:fyll-pa och pdf-sidor:fyll-pa: modulerna vi ateranvander
// (klient.ts, bildmatt.ts, pdf-sidor.ts) ar markerade "server-only".

import { prisma } from "@/lib/prisma";
import { bilagelager } from "@/lib/lagring/klient";
import { lasBildmatt } from "@/lib/lagring/bildmatt";
import { heicTillJpeg } from "@/lib/lagring/miniatyr";
import { kannIgenFormat } from "@/lib/lagring/bilaga-regler";
import { lasPdfInfo } from "@/lib/lagring/pdf-sidor";

async function main(): Promise<void> {
  const kandidater = await prisma.bilaga.findMany({
    where: { bredd: null },
    select: { id: true, lagringsnyckel: true, mimetyp: true, filnamn: true },
    orderBy: { skapad_at: "asc" },
  });

  console.log(`${kandidater.length} bilagor utan matt hittade.\n`);

  let lyckade = 0;
  let hoppade = 0;
  let misslyckade = 0;

  for (const bilaga of kandidater) {
    const format = kannIgenFormat(bilaga.mimetyp, bilaga.filnamn);
    if (!format) {
      hoppade++;
      console.log(`HOPPAR ${bilaga.lagringsnyckel} (okänt format)`);
      continue;
    }

    try {
      const { data: blob, error } = await bilagelager().download(
        bilaga.lagringsnyckel,
      );
      if (error || !blob) throw error ?? new Error("kunde inte hämta originalet");
      const original = Buffer.from(await blob.arrayBuffer());

      let bredd: number;
      let hojd: number;
      if (format.andelse === "pdf") {
        const info = await lasPdfInfo(original);
        bredd = info.bredd;
        hojd = info.hojd;
      } else {
        // HEIC maste avkodas till JPG forst – sharp lasker inte formatet direkt.
        const underlag = format.kraverMiniatyr
          ? await heicTillJpeg(original)
          : original;
        const matt = await lasBildmatt(underlag);
        bredd = matt.bredd;
        hojd = matt.hojd;
      }

      await prisma.bilaga.update({
        where: { id: bilaga.id },
        data: { bredd, hojd },
      });

      lyckade++;
      console.log(`OK     ${bilaga.lagringsnyckel} (${bredd}×${hojd})`);
    } catch (fel) {
      misslyckade++;
      const text = fel instanceof Error ? fel.message : String(fel);
      console.error(`FEL    ${bilaga.lagringsnyckel}: ${text}`);
    }
  }

  console.log(
    `\nKlart: ${lyckade} bilagor fick matt, ${misslyckade} misslyckade, ${hoppade} hoppade över.`,
  );
  if (misslyckade > 0) {
    console.log(
      "De misslyckade bilagorna fungerar fortfarande – originalet är sparat och orört, och förhandsvisningen reserverar ett stående format tills vidare. Kör skriptet igen för att försöka på nytt; redan klara rader görs inte om.",
    );
  }
}

main()
  .catch((fel) => {
    console.error(fel);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
