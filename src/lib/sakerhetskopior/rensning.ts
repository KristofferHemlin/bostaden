// Rensning av sakerhetskopiorna (scripts/rensa-sakerhetskopior.ts,
// scripts/sakerhetskopiera.ts). Integritetspolicyn, avsnitt 6: raderar du ditt
// konto forsvinner uppgifterna ur kopiorna nar dessa rensas, senast
// LOFTE_DAGAR efter raderingen. En obegransad kopia kan inte samexistera med
// ett loftet om radering, sa bada sorterna rensas:
//
//   bostadsunderlag-<tid>[-pagaende|-MISSLYCKAD]   veckokopiorna
//   radering-<tid>-<id>                            raderingskommandots kopior
//                                                  (src/lib/konto/radera-kommando.ts)
//
// Raderingskopian finns for att anvandaren ska hinna fa sina filer. Har hon
// inte hamtat dem innan gransen ar det ratt att de forsvinner – det ar hela
// poangen med en grans.
//
// Ett undantag: den sista HELA veckokopian raderas aldrig. Finns ingen hel
// veckokopia yngre an gransen har kopieringen slutat fungera, och da ar de
// gamla kopiorna de enda som finns. De sparras och rensningen sager det hogt
// i stallet – ett jobb som tyst raderar den enda kopian ar varre an ett som
// behaller den for lange. Loftet i policyn halls genom att kopieringen gar,
// inte genom att kopiorna forsvinner nar den inte gor det.
//
// Allt som inte kanns igen ror rensningen aldrig: andra filer, och
// symboliska lankar (som skulle kunna peka ut ur katalogen).

import { lstat, readdir, rm } from "node:fs/promises";
import path from "node:path";

// Gransen raknas fram, den gissas inte. Rensningen kors bara nar kopieringen
// kors – for hand varje sondag – sa en kopia som ar en dag yngre an gransen
// vid en korning hinner bli KOPIERINGSINTERVALL_DAGAR aldre innan nasta. For
// att loftet ska hallas maste gransen och intervallet tillsammans rymmas inom
// det: RENSNINGSGRANS_DAGAR + KOPIERINGSINTERVALL_DAGAR <= LOFTE_DAGAR
// (tester/sakerhetskopior-rensning.test.ts). Andras kadensen andras gransen
// med – ett utskrivet 23 hade blivit tyst fel.
//
// Att vara tidig kostar en vecka av marginalen och ingenting annat. Det har
// ar kopior av konton anvandaren bett oss radera.

/** Det integritetspolicyn lovar anvandaren (avsnitt 6). */
export const LOFTE_DAGAR = 30;
/** Hur ofta kopieringen, och darmed rensningen, kors. */
export const KOPIERINGSINTERVALL_DAGAR = 7;
/** Aldern da en kopia rensas. */
export const RENSNINGSGRANS_DAGAR = LOFTE_DAGAR - KOPIERINGSINTERVALL_DAGAR;

const DYGN_MS = 86_400_000;

export type Kopiesort = "veckokopia" | "raderingskopia";

export interface Kopia {
  namn: string;
  sort: Kopiesort;
  /** Nar kopian togs, ur katalognamnet (lokal tid, som skripten skriver den). */
  tagen: Date;
  /** Sant for en veckokopia utan suffix – bara de ar fullstandiga. Sant for
   *  en raderingskopia ocksa; den sparras aldrig och flaggan spelar ingen roll. */
  fullstandig: boolean;
}

const TID = String.raw`(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})`;
const VECKOKOPIA = new RegExp(`^bostadsunderlag-${TID}(-pagaende|-MISSLYCKAD)?$`);
const RADERINGSKOPIA = new RegExp(`^radering-${TID}-[0-9a-f]{8}$`, "i");

function tolkaTid(delar: string[]): Date | null {
  const [ar, man, dag, tim, min, sek] = delar.map(Number);
  const d = new Date(ar, man - 1, dag, tim, min, sek);
  // Avvisa datum som Date tyst rullar over (2026-13-40 blir annars ett giltigt datum).
  if (
    d.getFullYear() !== ar ||
    d.getMonth() !== man - 1 ||
    d.getDate() !== dag ||
    d.getHours() !== tim ||
    d.getMinutes() !== min ||
    d.getSeconds() !== sek
  ) {
    return null;
  }
  return d;
}

/** En katalogpost som rensningen kanner igen, eller null for allt annat. */
export function tolkaKopia(namn: string): Kopia | null {
  const vecka = VECKOKOPIA.exec(namn);
  if (vecka) {
    const tagen = tolkaTid(vecka.slice(1, 7));
    return tagen ? { namn, sort: "veckokopia", tagen, fullstandig: !vecka[7] } : null;
  }
  const radering = RADERINGSKOPIA.exec(namn);
  if (radering) {
    const tagen = tolkaTid(radering.slice(1, 7));
    return tagen ? { namn, sort: "raderingskopia", tagen, fullstandig: true } : null;
  }
  return null;
}

export interface Rensningsplan {
  /** Aldre an gransen och fria att radera. */
  raderas: Kopia[];
  /** Aldre an gransen, men behalls: ingen hel veckokopia yngre an gransen finns. */
  sparrade: Kopia[];
  /** Yngre an gransen. */
  behalls: Kopia[];
}

export function planeraRensning(
  kopior: Kopia[],
  nu: Date,
  dagar: number = RENSNINGSGRANS_DAGAR,
): Rensningsplan {
  const gamla = (k: Kopia) => nu.getTime() - k.tagen.getTime() >= dagar * DYGN_MS;
  const behalls = kopior.filter((k) => !gamla(k));
  const farskHel = behalls.some((k) => k.sort === "veckokopia" && k.fullstandig);

  const raderas: Kopia[] = [];
  const sparrade: Kopia[] = [];
  for (const k of kopior.filter(gamla)) {
    if (k.sort === "veckokopia" && !farskHel) sparrade.push(k);
    else raderas.push(k);
  }
  return { raderas, sparrade, behalls };
}

/** Summan av filstorlekarna under en katalog. Foljer aldrig symboliska lankar. */
async function storlek(sokvag: string): Promise<number> {
  const info = await lstat(sokvag);
  if (info.isSymbolicLink()) return 0;
  if (!info.isDirectory()) return info.size;
  let summa = 0;
  for (const post of await readdir(sokvag)) summa += await storlek(path.join(sokvag, post));
  return summa;
}

export function storlekText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} kB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function antalKopior(n: number): string {
  return n === 1 ? "1 kopia" : `${n} kopior`;
}

function alderDagar(k: Kopia, nu: Date): number {
  return Math.floor((nu.getTime() - k.tagen.getTime()) / DYGN_MS);
}

export interface Rensningsresultat {
  /** Antal kopior som faktiskt raderades. Alltid 0 i en torrkorning. */
  raderade: number;
  /** Antal gamla veckokopior som behalls for att ingen farsk hel kopia finns. */
  sparrade: number;
}

/**
 * Rensar `rot`. Utan `radera` ar det en torrkorning: listan over vad som
 * skulle tas bort skrivs ut, med antal och sammanlagd storlek, och ingenting
 * raderas. Med `radera` tas det bort.
 */
export async function rensaSakerhetskopior(
  rot: string,
  { radera, nu = new Date(), skriv }: { radera: boolean; nu?: Date; skriv: (rad?: string) => void },
): Promise<Rensningsresultat> {
  const kopior: Kopia[] = [];
  for (const post of await readdir(rot)) {
    const kopia = tolkaKopia(post);
    if (!kopia) continue;
    // Bara riktiga kataloger direkt under rot – aldrig en lank som kan peka
    // nagon annanstans.
    const info = await lstat(path.join(rot, post));
    if (info.isSymbolicLink() || !info.isDirectory()) continue;
    kopior.push(kopia);
  }

  const plan = planeraRensning(kopior, nu);
  const storlekar = new Map<string, number>();
  for (const k of plan.raderas) storlekar.set(k.namn, await storlek(path.join(rot, k.namn)));
  const totalt = [...storlekar.values()].reduce((s, b) => s + b, 0);

  skriv(`Rensning av säkerhetskopior äldre än ${RENSNINGSGRANS_DAGAR} dagar i ${rot}`);
  skriv();
  if (plan.raderas.length === 0) {
    skriv("Inget att ta bort.");
  } else {
    skriv(radera ? "Tas bort:" : "Skulle tas bort:");
    for (const k of [...plan.raderas].sort((a, b) => a.tagen.getTime() - b.tagen.getTime())) {
      const sort = k.sort === "veckokopia" ? (k.fullstandig ? "veckokopia" : "ofullständig veckokopia") : "raderingskopia";
      skriv(`  ${k.namn}  ${sort}, ${alderDagar(k, nu)} dagar, ${storlekText(storlekar.get(k.namn) ?? 0)}`);
    }
    skriv(`Sammanlagt ${antalKopior(plan.raderas.length)}, ${storlekText(totalt)}.`);
  }
  skriv(`Behålls: ${antalKopior(plan.behalls.length)} yngre än ${RENSNINGSGRANS_DAGAR} dagar.`);

  if (plan.sparrade.length > 0) {
    skriv();
    skriv(
      `SPÄRRAT: ${antalKopior(plan.sparrade.length)} äldre än ${RENSNINGSGRANS_DAGAR} dagar behålls, eftersom det inte finns någon hel veckokopia som är yngre. Kopieringen har slutat fungera – ta en ny kopia (npm run sakerhetskopiera). Tills dess ligger uppgifter kvar längre än integritetspolicyn lovar.`,
    );
    for (const k of plan.sparrade) skriv(`  ${k.namn}  ${alderDagar(k, nu)} dagar`);
  }

  if (!radera) {
    skriv();
    skriv("Torrkörning: ingenting är raderat. Kör med --radera för att ta bort det som listats.");
    return { raderade: 0, sparrade: plan.sparrade.length };
  }

  let raderade = 0;
  for (const k of plan.raderas) {
    await rm(path.join(rot, k.namn), { recursive: true });
    raderade++;
  }
  skriv();
  skriv(`Raderat: ${antalKopior(raderade)}, ${storlekText(totalt)}.`);
  return { raderade, sparrade: plan.sparrade.length };
}
