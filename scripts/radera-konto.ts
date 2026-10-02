// Kontoradering på begäran (docs/design.md, "Samägande – medlemskapet":
// "Kontoradering sker inte i appen, utan på begäran"). Appen har ingen
// raderingsknapp; den som svarar på mejlet kör det här.
//
//   npm run konto:radera -- anna@exempel.se            skriver bara ut
//   npm run konto:radera -- anna@exempel.se --radera   kopierar, frågar, raderar
//
// Utan --radera läser kommandot och skriver ut vad en radering skulle göra,
// en rad per bostad, och slutar. Ingenting ändras, ingenting hämtas.
//
// Med --radera, i den här ordningen – stannar ett steg, stannar allt:
//
//   1. Samma utskrift.
//   2. En kopia av bilagorna i varje bostad som raderas, utanför repot:
//      ~/Säkerhetskopior/bostadsunderlag/radering-<tid>-<id>/ eller under
//      SAKERHETSKOPIA_KATALOG. Varje fil jämförs mot den storlek Storage
//      angav vid uppladdningen. Saknas en enda fil raderas ingenting – den
//      som kör kommandot får veta vilka och kan skicka det som finns till
//      användaren innan något försvinner.
//   3. Du skriver adressen igen. Bara i en terminal; utan en avbryts det.
//   4. raderaKonto (src/lib/konto/radera.ts) – samma logik som knappen
//      hade: ensam medlem raderar bostaden med allt, fler medlemmar tar bara
//      bort medlemskapet. Den prövar det igen i sin egen transaktion.
//
// Kopian är det användaren kan få av sina filer. Kvittonas uppgifter –
// belopp, datum, klassificering – ingår inte i den; vill hon ha dem tas de
// med `npm run sakerhetskopiera` före raderingen.
//
// Kör med --conditions=react-server: raderingen och lagringsklienten är
// markerade "server-only".
//
// Slutkoder: 0 klart (eller utskrift), 1 något gick fel, ingenting raderat
// om inte annat sägs, 2 avbrutet av den som kör.

import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { koraRaderingskommando } from "@/lib/konto/radera-kommando";
import { prisma } from "@/lib/prisma";

const REPOTS_ROT = path.resolve(import.meta.dirname, "..");

function tidsstampel(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function kopiekatalog(anvandareId: string): string {
  const vald = process.env.SAKERHETSKOPIA_KATALOG?.trim();
  const rot = path.resolve(vald || path.join(homedir(), "Säkerhetskopior", "bostadsunderlag"));
  if (rot === REPOTS_ROT || rot.startsWith(REPOTS_ROT + path.sep)) {
    throw new Error(`Kopian får inte ligga i repot (${rot}). Den innehåller fakturor.`);
  }
  return path.join(rot, `radering-${tidsstampel(new Date())}-${anvandareId.slice(0, 8)}`);
}

async function fraga(text: string): Promise<string> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await terminal.question(text);
  } finally {
    terminal.close();
  }
}

koraRaderingskommando(process.argv.slice(2), {
  skriv: (rad) => console.log(rad),
  skrivFel: (rad) => console.error(rad),
  kopiekatalog,
  fraga: process.stdin.isTTY ? fraga : null,
})
  .then(async (kod) => {
    await prisma.$disconnect();
    process.exit(kod);
  })
  .catch(async (fel) => {
    console.error(fel instanceof Error ? fel.message : fel);
    console.error("Kommandot stannade på ett oväntat fel. Kör det utan --radera för att se vad som finns kvar innan du försöker igen.");
    await prisma.$disconnect();
    process.exit(1);
  });
