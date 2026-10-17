// Säkerhetskopia av produktionen: databasen och alla bilagor.
//
//   npm run sakerhetskopiera                    kopierar, listar vad som skulle rensas
//   npm run sakerhetskopiera -- --radera-gamla  kopierar, rensar gamla kopior (se Rensning)
//
// Supabases gratisnivå har inga automatiska säkerhetskopior. Den 2026-09-29
// tömdes databasen av misstag och ingenting gick att återställa. Det här
// skriptet är den enda kopian som finns.
//
// ENBART LÄSNING. Det här är det enda undantaget från CLAUDE.md:s regel att
// produktionens adress aldrig lämnas till ett verktyg: pg_dump läser i en
// READ ONLY-transaktion, uppslagen mot databasen görs i en READ ONLY-
// transaktion, och Storage anropas bara med download. Lägg aldrig till något
// som skriver, ändrar eller skapar – varken i databasen eller i Storage.
// Det enda skriptet raderar är gamla kopior på den här datorn (se Rensning
// nedan) – aldrig något i produktionen.
//
// ─── Vad kopian innehåller ──────────────────────────────────────────────────
//
//   <katalog>/bostadsunderlag-2026-09-30_1412/
//     databas/public.sql   schema + innehåll i public (pg_dump, vanlig SQL)
//     databas/auth.sql     auth.users och auth.identities, om de går att läsa
//     bilagor/…            varje objekt i bucketen "bilagor", med sökvägen
//                          {bostad_id}/{kostnad_id}/{filnamn} bevarad
//     sammanfattning.txt   samma sammanfattning som skrivs ut i terminalen
//
// Läs tillbaka databasen med psql -f databas/public.sql mot en TOM databas –
// aldrig mot produktionen. Rollerna anon, authenticated och service_role måste
// finnas där först (de finns i varje Supabase-projekt). "schema public finns
// redan" är ofarligt. Provat mot en tom Postgres 17 2026-09-30.
//
// Katalogen ligger utanför repot: ~/Säkerhetskopior/bostadsunderlag som
// standard, eller SAKERHETSKOPIA_KATALOG. Kopiorna innehåller personuppgifter
// och fakturor och får aldrig hamna i git – skriptet vägrar skriva inuti repot.
//
// Under körningen heter katalogen "…-pagaende". Den byter namn först när allt
// är hämtat och kontrollerat; en körning som misslyckas lämnar "…-MISSLYCKAD".
// En katalog utan suffix är alltså alltid en fullständig kopia.
//
// ─── Slutkoder ──────────────────────────────────────────────────────────────
//
//   0  kopian är fullständig
//   1  kopian misslyckades – något gick inte att läsa eller hämta
//   2  kopian är tagen, men bilagor som databasen pekar på saknas i Storage.
//      Kopian är så fullständig den kan bli; felet ligger i produktionen.
//   3  kopian är tagen, men rensningen av gamla kopior misslyckades. De
//      ligger kvar längre än integritetspolicyn lovar – läs felet ovanför.
//
// ─── Körning: för hand, varje söndag ───────────────────────────────────────
//
// Kopieringen körs för hand varje söndag, av en människa som ser utfallet i
// terminalen. Inget launchd-jobb eller annat schemalagt jobb finns, och inget
// ska installeras – det gäller tills projektet flyttas till Supabase Pro, som
// tar egna kopior. (En tidigare version av den här kommentaren beskrev ett
// launchd-jobb som om det vore installerat. Det var det aldrig, och meningen
// fick både en granskning och en arbetsbeskrivning att utgå från en körning
// som inte fanns.)
//
//   npm run sakerhetskopiera -- --radera-gamla
//
// Slutkoden står sist i utskriften: allt annat än 0 betyder att något ska
// läsas. Söndagen hör ihop med rensningen: gränsen i
// src/lib/sakerhetskopior/rensning.ts räknas fram ur löftet i
// integritetspolicyn och KOPIERINGSINTERVALL_DAGAR. Körs kopieringen mer
// sällan än så håller policyns löfte inte längre – ändra då intervallet där.
//
// Första gången: kör utan --radera-gamla och läs listan över vad som skulle
// tas bort innan något raderas.
//
// ─── Rensning ───────────────────────────────────────────────────────────────
//
// Kopior äldre än RENSNINGSGRANS_DAGAR rensas efter varje lyckad kopia – både
// de här veckokopiorna och raderingskommandots radering-<tid>-<id>/. Tidigare
// rensades ingenting, med skälet att ett skript som raderar kopior kan radera
// den enda som var hel. Det valet gäller inte längre: en obegränsad kopia kan
// inte samexistera med ett löfte om radering, och integritetspolicyn lovar
// att uppgifterna försvinner ur kopiorna inom LOFTE_DAGAR efter att ett konto
// raderats. Risken att radera den enda hela kopian hanteras i stället så här:
//
//   - Rensningen körs bara efter att en ny kopia blivit hel, så det finns
//     alltid en färsk kopia när de gamla tas bort.
//   - Den sista hela veckokopian raderas aldrig, inte heller av
//     `npm run sakerhetskopior:rensa` (src/lib/sakerhetskopior/rensning.ts).
//
// Utan --radera-gamla är rensningen en torrkörning: listan skrivs ut, med
// antal och storlek, och ingenting raderas.
//
// ─── Förutsättningar ────────────────────────────────────────────────────────
//
// pg_dump i samma huvudversion som servern eller nyare (Supabase kör 17):
// brew install postgresql@17. Annan sökväg anges med PG_DUMP.
// .env måste innehålla DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL och
// SUPABASE_SERVICE_ROLE_KEY.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { sakerhetskopiekatalog } from "@/lib/sakerhetskopior/katalog";
import { rensaSakerhetskopior } from "@/lib/sakerhetskopior/rensning";

const BUCKET = "bilagor";
const SAMTIDIGA_NEDLADDNINGAR = 4;
const NEDLADDNINGSFORSOK = 3;

const PG_DUMP_KANDIDATER = [
  process.env.PG_DUMP,
  "/opt/homebrew/opt/postgresql@17/bin/pg_dump",
  "/usr/local/opt/postgresql@17/bin/pg_dump",
];

const REPOTS_ROT = path.resolve(import.meta.dirname, "..");

type Anslutning = { url: string; losenord: string };

type Lagringsobjekt = { namn: string; storlek: number };

class KopieringsFel extends Error {}

function kravMiljo(namn: string): string {
  const varde = process.env[namn]?.trim();
  if (!varde) throw new KopieringsFel(`${namn} saknas i .env.`);
  return varde;
}

// Lösenordet lämnas till pg_dump/psql via PGPASSWORD i stället för i
// adressen, så att det inte syns i processlistan.
function anslutning(): Anslutning {
  const url = new URL(kravMiljo("DIRECT_URL"));
  const losenord = decodeURIComponent(url.password);
  url.password = "";
  url.searchParams.delete("pgbouncer");
  return { url: url.toString(), losenord };
}

function hittaPgDump(): string {
  const hittad = PG_DUMP_KANDIDATER.find((p) => p && existsSync(p));
  if (!hittad) {
    throw new KopieringsFel(
      "pg_dump 17 hittades inte. Installera med `brew install postgresql@17` eller ange sökvägen i PG_DUMP.",
    );
  }
  return hittad;
}

function kor(
  program: string,
  argument: string[],
  losenord: string,
): Promise<string> {
  return new Promise((losa, avvisa) => {
    const barn = spawn(program, argument, {
      env: { ...process.env, PGPASSWORD: losenord, PGCONNECT_TIMEOUT: "20" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let ut = "";
    let fel = "";
    barn.stdout.on("data", (d) => (ut += d));
    barn.stderr.on("data", (d) => (fel += d));
    barn.on("error", avvisa);
    barn.on("close", (kod) => {
      if (kod === 0) losa(ut);
      else
        avvisa(
          new KopieringsFel(
            `${path.basename(program)} avslutades med kod ${kod}: ${fel.trim()}`,
          ),
        );
    });
  });
}

// pg_dump läser i en READ ONLY-transaktion och skriver ingenting i databasen.
async function dumpa(
  pgDump: string,
  db: Anslutning,
  fil: string,
  urval: string[],
): Promise<void> {
  await kor(
    pgDump,
    ["--dbname", db.url, "--file", fil, "--no-password", ...urval],
    db.losenord,
  );
}

// Ett uppslag i en uttryckligen skrivskyddad transaktion. Resultatet kommer
// tillbaka som en rad JSON.
async function lasJson<T>(
  pgDump: string,
  db: Anslutning,
  fraga: string,
): Promise<T> {
  const psql = path.join(path.dirname(pgDump), "psql");
  const ut = await kor(
    psql,
    [
      "--dbname",
      db.url,
      "--no-password",
      "--no-psqlrc",
      "--tuples-only",
      "--no-align",
      "--quiet",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "BEGIN READ ONLY",
      "-c",
      fraga,
      "-c",
      "ROLLBACK",
    ],
    db.losenord,
  );
  return JSON.parse(ut.trim()) as T;
}

// Radantal räknas ur själva dumpfilen, inte ur databasen: det är kopian som
// ska vara fullständig. I pg_dumps COPY-format är varje rad exakt en rad text
// – radbrytningar i data skrivs som \n.
function raknaRader(sql: string): Map<string, number> {
  const antal = new Map<string, number>();
  let aktuell: string | null = null;
  for (const rad of sql.split("\n")) {
    if (aktuell === null) {
      const traff = /^COPY (\S+) .* FROM stdin;$/.exec(rad);
      if (traff) {
        aktuell = traff[1];
        antal.set(aktuell, 0);
      }
    } else if (rad === "\\.") {
      aktuell = null;
    } else {
      antal.set(aktuell, antal.get(aktuell)! + 1);
    }
  }
  return antal;
}

function sakerSokvag(rot: string, namn: string): string {
  const mal = path.resolve(rot, namn);
  if (!mal.startsWith(rot + path.sep)) {
    throw new KopieringsFel(`Objektnamnet pekar ut ur katalogen: ${namn}`);
  }
  return mal;
}

async function hamtaBilagor(
  objekt: Lagringsobjekt[],
  katalog: string,
): Promise<{ hamtade: number; bytes: number; fel: string[] }> {
  const supabase = createClient(
    kravMiljo("NEXT_PUBLIC_SUPABASE_URL"),
    kravMiljo("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  let hamtade = 0;
  let bytes = 0;
  const fel: string[] = [];
  let nasta = 0;

  async function hamtaEn(o: Lagringsobjekt): Promise<void> {
    let senasteFel = "";
    for (let forsok = 1; forsok <= NEDLADDNINGSFORSOK; forsok++) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(o.namn);
      if (error || !data) {
        senasteFel = error?.message ?? "tomt svar";
        continue;
      }
      const innehall = Buffer.from(await data.arrayBuffer());
      // Storleken jämförs mot Storages egen uppgift. En avbruten överföring
      // som ändå gav ett svar ska inte passera som en hämtad fil.
      if (innehall.length !== o.storlek) {
        senasteFel = `fick ${innehall.length} bytes, Storage anger ${o.storlek}`;
        continue;
      }
      const mal = sakerSokvag(katalog, o.namn);
      await mkdir(path.dirname(mal), { recursive: true });
      await writeFile(mal, innehall);
      hamtade++;
      bytes += innehall.length;
      return;
    }
    fel.push(`${o.namn}: ${senasteFel}`);
  }

  async function arbetare(): Promise<void> {
    while (nasta < objekt.length) {
      const o = objekt[nasta++];
      await hamtaEn(o);
    }
  }

  await Promise.all(
    Array.from({ length: SAMTIDIGA_NEDLADDNINGAR }, arbetare),
  );
  return { hamtade, bytes, fel };
}

function tidsstampel(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function storlekText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} kB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function valjRotkatalog(): string {
  try {
    return sakerhetskopiekatalog(REPOTS_ROT);
  } catch (e) {
    throw new KopieringsFel((e as Error).message);
  }
}

async function main(): Promise<number> {
  const argument = process.argv.slice(2);
  const okanda = argument.filter((a) => a !== "--radera-gamla");
  if (okanda.length > 0) {
    throw new KopieringsFel(
      `Okänt argument: ${okanda.join(" ")}. Använd --radera-gamla för att rensa, inget för att bara lista.`,
    );
  }
  const raderaGamla = argument.includes("--radera-gamla");
  const start = Date.now();
  const db = anslutning();
  const pgDump = hittaPgDump();
  const rot = valjRotkatalog();

  const namn = `bostadsunderlag-${tidsstampel(new Date())}`;
  const pagaende = path.join(rot, `${namn}-pagaende`);
  const databaskatalog = path.join(pagaende, "databas");
  const bilagekatalog = path.join(pagaende, "bilagor");
  await mkdir(databaskatalog, { recursive: true });
  await mkdir(bilagekatalog, { recursive: true });

  const rader: string[] = [];
  const skriv = (s = "") => {
    rader.push(s);
    console.log(s);
  };
  const varningar: string[] = [];

  try {
    skriv(`Säkerhetskopia ${namn}`);
    skriv();

    // ── Databasen ──
    const publicFil = path.join(databaskatalog, "public.sql");
    await dumpa(pgDump, db, publicFil, ["--schema=public"]);

    const authFil = path.join(databaskatalog, "auth.sql");
    let authLast = true;
    try {
      await dumpa(pgDump, db, authFil, [
        "--table=auth.users",
        "--table=auth.identities",
      ]);
    } catch (e) {
      authLast = false;
      varningar.push(
        `auth.users kunde inte läsas och saknas i kopian: ${(e as Error).message}`,
      );
    }

    const publicRader = raknaRader(await readFile(publicFil, "utf8"));
    const authRader = authLast
      ? raknaRader(await readFile(authFil, "utf8"))
      : new Map<string, number>();

    if (publicRader.size === 0) {
      throw new KopieringsFel(
        "Dumpen av public innehåller inga tabeller. Kopian är tom.",
      );
    }

    skriv("Databas – rader per tabell");
    const allaTabeller = [...publicRader, ...authRader];
    const bredd = Math.max(...allaTabeller.map(([t]) => t.length));
    for (const [tabell, antal] of allaTabeller) {
      skriv(`  ${tabell.padEnd(bredd)}  ${String(antal).padStart(7)}`);
    }
    const dumpstorlek =
      (await stat(publicFil)).size +
      (authLast ? (await stat(authFil)).size : 0);
    skriv(`  Dumpfilerna: ${storlekText(dumpstorlek)}`);
    skriv();

    // ── Bilagorna ──
    // Listan hämtas ur storage.objects, inte ur Storage-API:ts list, som bara
    // går en katalognivå åt gången och lätt missar något.
    const objekt = await lasJson<Lagringsobjekt[]>(
      pgDump,
      db,
      `SELECT coalesce(json_agg(json_build_object(
         'namn', name,
         'storlek', coalesce((metadata->>'size')::bigint, -1)
       ) ORDER BY name), '[]')
       FROM storage.objects WHERE bucket_id = '${BUCKET}'`,
    );

    const { hamtade, bytes, fel } = await hamtaBilagor(objekt, bilagekatalog);

    skriv(`Bilagor – bucketen "${BUCKET}"`);
    skriv(`  Objekt i Storage: ${objekt.length}`);
    skriv(`  Hämtade:          ${hamtade}`);
    skriv(`  Total storlek:    ${storlekText(bytes)}`);
    skriv();

    if (fel.length > 0) {
      skriv("Hämtningen misslyckades för:");
      for (const f of fel) skriv(`  ${f}`);
      throw new KopieringsFel(
        `${fel.length} av ${objekt.length} bilagor kunde inte hämtas.`,
      );
    }

    // Varje bekräftad bilaga i databasen ska ha sitt original i kopian. Saknas
    // ett är beviset borta i produktionen, och det ska synas nu – inte den dag
    // kopian behövs.
    const nycklar = await lasJson<string[]>(
      pgDump,
      db,
      `SELECT coalesce(json_agg(lagringsnyckel ORDER BY lagringsnyckel), '[]')
       FROM public.bilaga WHERE uppladdning_bekraftad`,
    );
    const hamtadeNamn = new Set(objekt.map((o) => o.namn));
    const saknade = nycklar.filter((n) => !hamtadeNamn.has(n));
    if (saknade.length > 0) {
      varningar.push(
        `${saknade.length} bilagor finns i databasen men inte i Storage:\n` +
          saknade.map((n) => `    ${n}`).join("\n"),
      );
    }

    const totalt = dumpstorlek + bytes;
    skriv(`Kopians storlek: ${storlekText(totalt)}`);
    skriv(`Tid: ${((Date.now() - start) / 1000).toFixed(1)} s`);

    for (const v of varningar) {
      skriv();
      skriv(`VARNING: ${v}`);
    }

    const klar = path.join(rot, namn);
    await writeFile(
      path.join(pagaende, "sammanfattning.txt"),
      rader.join("\n") + "\n",
    );
    await rename(pagaende, klar);
    skriv();
    skriv(`Sparad i ${klar}`);

    // Rensningen kors forst nu, nar en ny hel kopia finns. Misslyckas den ar
    // kopian anda tagen – men gamla kopior ligger kvar langre an policyn
    // lovar, och det ska synas i slutkoden.
    skriv();
    try {
      await rensaSakerhetskopior(rot, { radera: raderaGamla, skriv });
    } catch (e) {
      skriv(`RENSNINGEN MISSLYCKADES: ${(e as Error).message}`);
      return 3;
    }

    return saknade.length > 0 ? 2 : 0;
  } catch (e) {
    const misslyckad = path.join(rot, `${namn}-MISSLYCKAD`);
    await writeFile(
      path.join(pagaende, "sammanfattning.txt"),
      rader.join("\n") + `\n\nFEL: ${(e as Error).message}\n`,
    ).catch(() => {});
    await rename(pagaende, misslyckad).catch(() => {});
    throw e;
  }
}

main()
  .then((kod) => process.exit(kod))
  .catch((e) => {
    console.error(
      `\nSÄKERHETSKOPIAN MISSLYCKADES: ${e instanceof Error ? e.message : e}`,
    );
    process.exit(1);
  });
