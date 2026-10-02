// Kommandot for kontoradering pa begaran (scripts/radera-konto.ts; beskrivning
// och anvandning star dar). Har ligger logiken, med in- och utdata utbytbara
// sa att tester/konto-raderingsplan.test.ts kan kora utskriftslaget och provar
// att ingenting raderas utan bekraftelse.

import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { raderaKonto } from "@/lib/konto/radera";
import { hamtaRaderingsplan, raderingsplanText, type Raderingsplan } from "@/lib/konto/raderingsplan";
import { bilagelager } from "@/lib/lagring/klient";

export interface Kommandomiljo {
  skriv: (rad: string) => void;
  skrivFel: (rad: string) => void;
  /** Katalogen kopian hamnar i. Anropas bara nar nagot ska kopieras. */
  kopiekatalog: (anvandareId: string) => string;
  /** Null nar det inte finns nagon terminal att fraga i. */
  fraga: ((text: string) => Promise<string>) | null;
}

/**
 * Skrivs ut nar nagon bostad raderas – i utskriftslaget och fore fragan.
 * Kopian kommandot tar ar bara bilagorna; det ska den som kor kommandot se i
 * terminalen, inte behova lasa i en kommentar.
 */
export const PAMINNELSE_UPPGIFTER = [
  "OBS: Kopian innehåller bara bilagorna. Kvittonas belopp, datum och",
  "klassificering följer inte med. Vill användaren ha dem: kör",
  "`npm run sakerhetskopiera` innan du raderar.",
];

/** Hamtar varje bilaga i bostaderna som raderas. Returnerar det som saknas. */
async function kopieraBilagor(plan: Raderingsplan, katalog: string): Promise<string[]> {
  const saknade: string[] = [];
  for (const bostad of plan.bostader.filter((b) => b.raderas)) {
    for (const bilaga of bostad.bilagor) {
      const mal = path.resolve(katalog, bilaga.lagringsnyckel);
      if (!mal.startsWith(katalog + path.sep)) {
        saknade.push(`${bilaga.lagringsnyckel}: nyckeln pekar ut ur katalogen`);
        continue;
      }
      const { data, error } = await bilagelager().download(bilaga.lagringsnyckel);
      if (error || !data) {
        saknade.push(`${bilaga.lagringsnyckel}: ${error?.message ?? "tomt svar"}`);
        continue;
      }
      const innehall = Buffer.from(await data.arrayBuffer());
      if (innehall.length !== bilaga.storlek) {
        saknade.push(`${bilaga.lagringsnyckel}: fick ${innehall.length} bytes, väntade ${bilaga.storlek}`);
        continue;
      }
      await mkdir(path.dirname(mal), { recursive: true });
      await writeFile(mal, innehall);
    }
  }
  return saknade;
}

/** Slutkod: 0 klart (eller utskrift), 1 fel, 2 avbrutet av den som kor. */
export async function koraRaderingskommando(argument: string[], miljo: Kommandomiljo): Promise<number> {
  const { skriv, skrivFel } = miljo;
  const radera = argument.includes("--radera");
  const epost = argument.find((a) => !a.startsWith("--"));
  if (!epost) {
    skrivFel("Ange adressen: npm run konto:radera -- anna@exempel.se [--radera]");
    return 1;
  }

  const plan = await hamtaRaderingsplan(epost);
  if (!plan) {
    skrivFel(`Ingen användare med adressen ${epost}. Ingenting raderat.`);
    return 1;
  }

  skriv(radera ? "Det här kommer att raderas:" : "Utskrift – ingenting raderas:");
  for (const rad of raderingsplanText(plan)) skriv(rad);
  const nagotRaderas = plan.bostader.some((b) => b.raderas);
  if (nagotRaderas) for (const rad of PAMINNELSE_UPPGIFTER) skriv(rad);
  if (!radera) {
    skriv("Kör med --radera för att kopiera bilagorna och radera.");
    return 0;
  }

  const attKopiera = plan.bostader.filter((b) => b.raderas).flatMap((b) => b.bilagor);
  if (attKopiera.length > 0) {
    const katalog = miljo.kopiekatalog(plan.anvandareId);
    skriv(`Kopierar ${attKopiera.length} bilagor till ${katalog} …`);
    await mkdir(katalog, { recursive: true });
    const saknade = await kopieraBilagor(plan, katalog);
    if (saknade.length > 0) {
      skrivFel(`${saknade.length} av ${attKopiera.length} bilagor kunde inte kopieras. INGENTING RADERAT.`);
      for (const s of saknade) skrivFel(`  ${s}`);
      skrivFel(`Det som gick att hämta ligger i ${katalog}.`);
      return 1;
    }
    skriv(`Alla ${attKopiera.length} bilagor kopierade till ${katalog}. Skicka dem till användaren innan du fortsätter.`);
  } else {
    skriv("Inga bilagor raderas – ingen kopia behövs.");
  }

  if (nagotRaderas) for (const rad of PAMINNELSE_UPPGIFTER) skriv(rad);
  if (!miljo.fraga) {
    skrivFel("Bekräftelsen kräver en terminal. INGENTING RADERAT.");
    return 2;
  }
  const svar = await miljo.fraga(`Skriv ${plan.epost} för att radera, eller tryck Enter för att avbryta: `);
  if (svar.trim().toLowerCase() !== plan.epost.trim().toLowerCase()) {
    skriv("Avbrutet. INGENTING RADERAT.");
    return 2;
  }

  const resultat = await raderaKonto(plan.anvandareId);
  if (!resultat.ok) {
    // Steget sager vad som hann ske: "databas" betyder att ingenting
    // raderades, "lagring" och "konto" att raderna redan ar borta.
    skrivFel(`Raderingen stannade i steget "${resultat.steg}": ${resultat.fel}`);
    return 1;
  }
  skriv("Kontot är raderat.");
  return 0;
}
