// Engangsjobb: fyller pa visningsnyckel for bildbilagor som laddades upp
// innan visningsversionen fanns (produktspec avsnitt 9, "Visningsversion").
//
//   npm run visningsversion:fyll-pa
//
// Gar igenom bildbilagor (JPG/PNG/HEIC) utan visningsnyckel, laddar ner
// originalet, skalar fram en visningsversion (~2000px JPG) och sparar den vid
// sidan om originalet. Originalet ror sig aldrig.
//
// Loggar varje rad – lyckad eller misslyckad – sa att en bilaga som inte gick
// att konvertera syns i stallet for att tyst forbli utan. Idempotent: en rad
// som redan har visningsnyckel hoppas over, sa skriptet gar att kora om utan
// att gora om det som redan ar klart – kor det igen efter att ha atgardat
// vad som fick tidigare forsok att misslyckas.
//
// Kors INTE automatiskt nagonstans – bara pa uttrycklig begaran (kommandot
// ovan). En bilaga utan visningsversion fungerar anda: signeradBilagelank
// faller da tillbaka pa miniatyren eller originalet (src/lib/lagring/bilagor.ts).
//
// npm-scriptet kor med --conditions=react-server: modulerna vi ateranvander
// har (klient.ts, miniatyr.ts, visning.ts) ar markerade med "server-only", som
// annars kastar nar de laddas utanfor Next – den flaggan far paketet att
// falla tillbaka pa sin tomma variant i stallet, precis som Next sjalv gor.

import { prisma } from "@/lib/prisma";
import { bilagelager } from "@/lib/lagring/klient";
import { kannIgenFormat, visningsnyckel } from "@/lib/lagring/bilaga-regler";
import { heicTillJpeg } from "@/lib/lagring/miniatyr";
import { skalaTillVisningsversion } from "@/lib/lagring/visning";

async function main(): Promise<void> {
  const kandidater = await prisma.bilaga.findMany({
    where: { visningsnyckel: null, mimetyp: { not: "application/pdf" } },
    select: { id: true, lagringsnyckel: true, mimetyp: true, filnamn: true },
    orderBy: { skapad_at: "asc" },
  });

  console.log(`${kandidater.length} bilagor utan visningsversion hittade.\n`);

  let lyckade = 0;
  let hoppade = 0;
  let misslyckade = 0;

  for (const bilaga of kandidater) {
    const format = kannIgenFormat(bilaga.mimetyp, bilaga.filnamn);
    if (!format || format.andelse === "pdf") {
      hoppade++;
      console.log(`HOPPAR ${bilaga.lagringsnyckel} (okänt eller ej bildformat)`);
      continue;
    }

    try {
      const { data: blob, error } = await bilagelager().download(
        bilaga.lagringsnyckel,
      );
      if (error || !blob) throw error ?? new Error("kunde inte hämta originalet");
      const original = Buffer.from(await blob.arrayBuffer());

      // HEIC maste avkodas till JPG forst – sharp lasker inte formatet direkt.
      const underlag = format.kraverMiniatyr
        ? await heicTillJpeg(original)
        : original;
      const jpeg = await skalaTillVisningsversion(underlag);

      const nyckel = visningsnyckel(bilaga.lagringsnyckel);
      const { error: uppladdningsfel } = await bilagelager().upload(
        nyckel,
        jpeg,
        { contentType: "image/jpeg", upsert: true },
      );
      if (uppladdningsfel) throw uppladdningsfel;

      await prisma.bilaga.update({
        where: { id: bilaga.id },
        data: { visningsnyckel: nyckel },
      });

      lyckade++;
      console.log(`OK     ${bilaga.lagringsnyckel}`);
    } catch (fel) {
      misslyckade++;
      const text = fel instanceof Error ? fel.message : String(fel);
      console.error(`FEL    ${bilaga.lagringsnyckel}: ${text}`);
    }
  }

  console.log(
    `\nKlart: ${lyckade} visningsversioner skapade, ${misslyckade} misslyckade, ${hoppade} hoppade över.`,
  );
  if (misslyckade > 0) {
    console.log(
      "De misslyckade bilagorna fungerar fortfarande – originalet är sparat och orört. Kör skriptet igen (t.ex. efter en nätverksstörning) för att försöka på nytt; redan klara rader görs inte om.",
    );
  }
}

main()
  .catch((fel) => {
    console.error(fel);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
