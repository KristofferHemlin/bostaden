// Steg 7: exportvyn. K6A-sammanstallningen (hjalpblankett SKV 2197) pa skarm –
// sida 1 med grundforbattringar, sida 2 med forbattrande reparationer inklusive
// kolumnen for avdragsgill del efter forslitning, och de tva summorna utpekade
// som ruta 4 och ruta 5. Ingen PDF, inga bilagor – det ar steg 9/14.
//
// Sidan gar alltid att oppna, aven innan bostaden ar sald (docs/design.md,
// Exportvyn). Utan forsaljningsdatum visas sida 1 komplett (grundforbattringar
// saknar tidsgrans) och sida 2 med sina rader men utan avdragsgill kolumn –
// femarsregeln och forslitningen utgar fran forsaljningsdatumet. "Markera som
// sald" ligger da som en knapp langst ned, aldrig som en sparr framfor sidan.
//
// All berakning bor i src/doman/export-k6a.ts. Har komponeras den bara. Ingen ny
// domanregel. Struktur och farger: docs/design.md (metrikblock-monstret ateranvands
// for ruta 4/5; inget rott/gront for status).
//
// Underlaget raknas med lasarens andel nar medlemmarnas andelar gar ihop –
// summan hogst 100 % – oavsett hur manga som delar bostaden (CLAUDE.md,
// "Agarandel"). Talet bredvid "Förs till" ar da hennes eget, och rutan om den
// egna andelen sager varfor bade hela bostadens belopp och andelen visas.
//
// Ingen rad ber henne sjalv ta sin andel. En sadan stod overst fram till
// 2026-10-20 – "Du äger 50 % – det är den andelen du för in i din
// deklaration." – skriven medan talet var hela bostadens. Nar talet lagades
// bad den henne ta 50 % av sina egna 50 % (docs/design.md, "Samägande –
// medlemskapet").
//
// Gar andelarna inte ihop finns ingen andel att lita pa: beloppen ar hela
// bostadens, och overst star att sammanstallningen galler hela bostaden och
// att var och en deklarerar sin andel av den. Varken raden Agarandel eller
// rutan om den egna andelen visas, och etiketten "Förs till K5" uteblir – den
// far bara sta bredvid ett tal som ar lasarens eget (rutorForLasaren).

import Link from "next/link";
import {
  Avdelningsrubrik,
  Friskrivning,
  Kort,
  Meddelanderuta,
  PRIMARKNAPP_KLASS,
  SEKUNDARKNAPP_KLASS,
  Skarm,
} from "@/components/skarm";
import {
  beloppIKolumnen,
  byggK6aExport,
  type K6aExport,
  VANTAR_PA_BOSTADSFRAGOR_TEXT,
  VantarPaBostadsfragor,
  type K6aExportrad,
  type K6aIndata,
} from "@/doman/export-k6a";
import {
  AVRUNDAT_TILL_HELA_KRONOR,
  blankettTexter,
  rutorForLasaren,
  type RutaForLasaren,
} from "@/doman/blankett";
import { projektnamnKarta } from "@/doman/genomgang";
import { slaUppRegelparameter } from "@/doman/regelparameter";
import { foreForsaljningForklaring } from "@/doman/regeltext";
import { behoverSkickForsaljning } from "@/doman/fragetradet";
import { bostadHeader } from "@/lib/bostad-header";
import { BILAGEPAKET_SYNLIGT } from "@/lib/bilagepaket/flagga";
import { hamtaBostadsdata, hamtaKostnaderMedBilaga, tillDomanBostad } from "@/lib/doman-fran-db";
import { formateraKronor, isoDatum } from "@/lib/format";
import { hamtaAndelar } from "@/lib/andelar";
import {
  andelForUnderlag,
  arDeladBostad,
} from "@/lib/samagande";
import { kravBostad } from "@/lib/session";
import { SAMMA_DEL_ANDRAD, SAMMA_DEL_OBESVARAD } from "@/doman/samma-del";
import { UnderlagetsVarningar } from "./underlagets-varningar";
import {
  ATERSTAR_INLEDNING,
  ATERSTAR_RUBRIK,
  aterstarRader,
  kvittonamn,
} from "@/lib/aterstar";

export const metadata = { title: "Deklarationsunderlag" };

export const dynamic = "force-dynamic";

export default async function ExportSida() {
  const { bostadId, anvandareId, agarandel } = await kravBostad();
  const [{ bostad, projekt, projektRader, kostnader, kostnadRader, regelparametrar }, andelar, kostnaderMedBilaga] =
    await Promise.all([
      hamtaBostadsdata(bostadId),
      hamtaAndelar(bostadId),
      hamtaKostnaderMedBilaga(bostadId),
    ]);
  const medlemmar = andelar.medlemmar.length;
  const delad = arDeladBostad(medlemmar);
  const medlemsandelar = andelar.medlemmar.map((m) => m.andel);
  const andel = andelForUnderlag({ egenAndel: agarandel, medlemsandelar });
  // Bekraftad vid forsaljningen och oforandrad sedan (src/app/forsaljning/andel).
  const egenBekraftad =
    andelar.medlemmar.find((m) => m.anvandareId === anvandareId)?.bekraftad ?? false;
  const { bostadsnamn } = bostadHeader(bostad);

  // Enda skillnaden mellan upplatelseformerna i den har vyn: huvudblanketten som
  // de tva talen skrivs av till (produktspec 4.9, src/doman/blankett.ts).
  const texter = blankettTexter(bostad.upplatelseform);

  // Tidsfonstret och troskeln namns i forklaringen innan bostaden ar sald.
  // Talen ur regelparametern, aldrig bokstavliga (docs/design.md, Exportvyn);
  // utan forsaljningsdatum galler vardet for i dag.
  const regeldatum = bostad.forsaljningsdatum
    ? isoDatum(bostad.forsaljningsdatum)
    : isoDatum(new Date());
  const fonsterAr = slaUppRegelparameter(regelparametrar, "reparationsfonster_ar", regeldatum);
  const troskelbelopp = slaUppRegelparameter(regelparametrar, "troskelbelopp", regeldatum);

  return (
    // Egna kort: uppgifterna, sida 1, sida 2 och det som aterstar ar innehall
    // av olika slag (docs/design.md, "Innehall av olika slag hor hemma i olika
    // kort"). Alla i samma kolumn.
    <Skarm bostadsnamn={bostadsnamn} rubrik="Deklarationsunderlag" egnaKort>
      {renderaInnehall()}
    </Skarm>
  );

  function renderaInnehall() {
    const indata: K6aIndata = {
      bostad: tillDomanBostad(bostad),
      medlemskap: { agarandel: andel ?? 100 },
      projekt,
      kostnader,
      kostnader_med_bilaga: kostnaderMedBilaga,
      regelparametrar,
    };

    let ex: K6aExport;
    try {
      ex = byggK6aExport(indata);
    } catch (fel) {
      // Obesvarade bostadsfragor med nagot klassificerat att rakna pa: hela
      // underlaget vantar, varken sida 1 eller sida 2 (src/doman/export-k6a.ts).
      if (fel instanceof VantarPaBostadsfragor) {
        return (
          <Kort>
            <div className="p-5">
              <Meddelanderuta>{VANTAR_PA_BOSTADSFRAGOR_TEXT}</Meddelanderuta>
              <Link href="/genomgang" className={`${PRIMARKNAPP_KLASS} mt-4`}>
                Svara på frågorna
              </Link>
            </div>
          </Kort>
        );
      }
      return (
        <Kort>
          <div className="p-5">
            <Meddelanderuta>
              Underlaget kunde inte beräknas: {(fel as Error).message}
            </Meddelanderuta>
            <Link href="/forsaljning" className={`${SEKUNDARKNAPP_KLASS} mt-4`}>
              Se över försäljningsuppgifterna
            </Link>
          </div>
        </Kort>
      );
    }

    const gemensam = ex.delagarvariant === "gemensam_med_andel";
    const rutor = rutorForLasaren(ex, bostad.upplatelseform, andel);
    // Summorna dampas nar underlaget ar ofullstandigt (docs/design.md,
    // Exportvyn): tva stora tal pa en skarm som heter Deklarationsunderlag ser
    // trasigt ut nar de anda inte galler. Full tyngd forst nar ingenting
    // aterstar – varken en oklassificerad hog eller ett kvitto utanfor
    // sidorna – sa att blicken gar till listan over det som aterstar.
    const harAterstaende =
      ex.oklassificerade_hogar.length > 0 || ex.aterstaende_kvitton.length > 0;
    // Klassificeringen ar vagen framat for hogar och for kvitton utan hog. Ett
    // kvitto utan betaldatum behover i stallet sitt datum, pa kvittots skarm.
    const behoverKlassificering =
      ex.oklassificerade_hogar.length > 0 ||
      ex.aterstaende_kvitton.some((k) => k.orsak === "utan_hog");
    const kvittoNamn = new Map(kostnadRader.map((k) => [k.id, kvittonamn(k)]));
    // En hog utan namn heter som i fas 1 (src/doman/genomgang.ts).
    const projektnamn = projektnamnKarta(projektRader, kostnadRader);
    const aterstar = aterstarRader(
      ex,
      (id) => kvittoNamn.get(id) ?? "Kvitto",
      (id) => projektnamn.get(id) ?? "Projekt",
    );
    // Fraga 7 (steg 4): atgarder med reparationsdel vars skick vid
    // forsaljningen annu inte ar bedomt. Samma urval som /forsaljning/skick
    // sjalv anvander (behoverSkickForsaljning) – bara en lank hit, inte en
    // egen lista, eftersom varje rad pa sida 2 redan visar sin varning
    // (docs/design.md, "Samma information star aldrig tva ganger").
    const atgarderUtanSkickForsaljning = ex.sald
      ? projekt.filter(behoverSkickForsaljning).length
      : 0;

    return (
      <>
        {/* Hal i underlaget som inte syns nagon annanstans (K6aExport.
            varningar) – overst, fore talen. */}
        <UnderlagetsVarningar varningar={ex.varningar} />

        <Kort className="divide-y divide-linje">
          {delad && andel === null ? (
            <p className="p-4 font-granssnitt text-sm text-text-primar">
              Sammanställningen gäller{" "}
              <span className="font-medium">hela bostaden</span> – var och en
              deklarerar sin andel av den.
            </p>
          ) : null}
          <section className="space-y-1 p-4 font-granssnitt text-sm text-text-sekundar">
            <div className="flex justify-between gap-3">
              <span>Försäljningsdatum</span>
              <span className="tabular-nums text-text-primar">
                {ex.genererad_for_datum ?? "Inte såld än"}
              </span>
            </div>
            {andel !== null ? (
              <div className="flex justify-between gap-3">
                <span>Ägarandel</span>
                <span className="tabular-nums text-text-primar">
                  {ex.agarandel_procent} %
                </span>
              </div>
            ) : null}
            {/* Bekraftelsen hor till forsaljningen. Den som inte bekraftat
                stoppas inte – talen raknas med den lagrade andelen – men far
                veta det, och vagen dit (docs/design.md, "Att bjuda in en
                delägare"). */}
            {ex.sald && andel !== null && !egenBekraftad ? (
              <div className="flex justify-between gap-3">
                <span>Inte bekräftad</span>
                <Link
                  href="/forsaljning/andel?nasta=export"
                  className="text-text-primar underline underline-offset-2 hover:text-accent-mork"
                >
                  Bekräfta ägarandelen
                </Link>
              </div>
            ) : null}
          </section>

          <div className="p-4">
            <Meddelanderuta>
              {gemensam
                ? "Din ägarandel är under 100 %. Sammanställningen visar både hela bostadens belopp och din andel, så att den andra delägaren kan använda samma underlag."
                : texter.inledning}
            </Meddelanderuta>
          </div>
        </Kort>

        <Kort className="divide-y divide-linje">
          <SidaBlock
            etikett="Sida 1 · Grundförbättringar"
            rader={ex.sida1.rader}
            gemensam={gemensam}
            // Samma tva kolumner som sida 2 (docs/design.md, Skarmuppbyggnad).
            // Sida 1 visar sin avdragsgilla kolumn aven fore forsaljningen –
            // en grundforbattring har ingen skickfaktor att vanta pa. Men den
            // ligger inte fast: troskeln provas pa bada slagen tillsammans,
            // och en reparation som faller ur femarsfonstret vid forsaljningen
            // kan ta ett ar under troskeln (src/doman/regeltext.ts,
            // foreForsaljningForklaring).
            visaAvdragsgill
            tomtText="Inga grundförbättringar registrerade."
          />

          <RutaCallout
            ruta={rutor.ruta4}
            underrad="Summa sida 1 – grundförbättringar"
            brutto={ex.ruta4_brutto}
            gemensam={gemensam}
            agarandel={ex.agarandel_procent}
            dampad={harAterstaende}
          />
        </Kort>

        <Kort className="divide-y divide-linje">
          <SidaBlock
            etikett="Sida 2 · Förbättrande reparationer"
            rader={ex.sida2.rader}
            gemensam={gemensam}
            visaAvdragsgill={ex.sald}
            tomtText="Inga förbättrande reparationer registrerade."
          />

          {ex.sald ? (
            <RutaCallout
              ruta={rutor.ruta5}
              underrad="Summa sida 2 – avdragsgill del efter förslitning"
              brutto={ex.ruta5_brutto}
              gemensam={gemensam}
              agarandel={ex.agarandel_procent}
              dampad={harAterstaende}
            />
          ) : null}
        </Kort>

        <Kort className="divide-y divide-linje">
          {ex.sald ? null : (
            <div className="p-4">
              <Meddelanderuta>{foreForsaljningForklaring(fonsterAr, troskelbelopp)}</Meddelanderuta>
            </div>
          )}

          {/* Det som aterstar (docs/design.md, Exportvyn: "redovisar varje
              krona som lagts in"). En enda lista – hogar och kvitton – och
              konsekvensen sagd en gang ovanfor. Sida 1, sida 2 och den har
              listan ar tillsammans Totalt inlagt. */}
          {harAterstaende ? (
            <section className="p-4">
              <p className="font-granssnitt text-sm font-medium text-text-primar">
                {ATERSTAR_RUBRIK}
              </p>
              <p className="mt-1 font-granssnitt text-sm text-text-sekundar">
                {ATERSTAR_INLEDNING}
              </p>
              {/* Samma rader och samma skal som i PDF:en (src/lib/aterstar.ts). */}
              <ul className="mt-2 divide-y divide-linje border-t border-linje">
                {aterstar.map((r) => (
                  <AterstarRad
                    key={r.nyckel}
                    namn={r.namn}
                    orsak={r.orsak}
                    ar={r.ar}
                    belopp={r.belopp}
                    href={
                      // Ett datum som saknas eller kan vara feltypat
                      // rattas pa kvittots skarm.
                      r.orsakKod === "utan_betaldatum" ||
                      r.orsakKod === "fore_tilltradet"
                        ? `/kostnad/${r.kostnadId}`
                        : r.orsakKod === "utan_belopp"
                          ? `/kostnad/nytt?utkast=${r.kostnadId}`
                          : undefined
                    }
                  />
                ))}
              </ul>
              {behoverKlassificering ? (
                <Link href="/genomgang" className={`${SEKUNDARKNAPP_KLASS} mt-3`}>
                  Berätta vad du gjort
                </Link>
              ) : null}
            </section>
          ) : null}

          {atgarderUtanSkickForsaljning > 0 ? (
            <section className="p-4">
              <p className="font-granssnitt text-sm font-medium text-text-primar">
                Skick vid försäljningen
              </p>
              <p className="mt-1 font-granssnitt text-sm text-text-sekundar">
                {atgarderUtanSkickForsaljning} projekt på sida 2 saknar
                bedömningen av skicket vid försäljningen, så den avdragsgilla
                delen är inte klar.
              </p>
              <Link
                href="/forsaljning/skick"
                className={`${SEKUNDARKNAPP_KLASS} mt-3`}
              >
                Bedöm skicket
              </Link>
            </section>
          ) : null}

          {ex.samma_del === "obesvarad" || ex.samma_del === "andrad" ? (
            // Fragan om samma del av bostaden (CLAUDE.md, "Samma byggnadsdel
            // reparerad två gånger"): overhoppad, eller besvarad for andra
            // projekt an dagens. Markeringarna galler anda – svaret ar
            // ofullstandigt, inte ogiltigt (src/doman/samma-del.ts).
            <section className="p-4">
              <p className="font-granssnitt text-sm font-medium text-text-primar">
                Samma del av bostaden
              </p>
              <p className="mt-1 font-granssnitt text-sm text-text-sekundar">
                {ex.samma_del === "andrad" ? SAMMA_DEL_ANDRAD : SAMMA_DEL_OBESVARAD}
              </p>
              <Link
                href="/forsaljning/samma-del"
                className={`${SEKUNDARKNAPP_KLASS} mt-3`}
              >
                Svara på frågan
              </Link>
            </section>
          ) : null}

          <div className="space-y-4 p-4">
            {/* Bilagepaketet som PDF (docs/produktspec.md avsnitt 8): dolt i
                granssnittet tills vidare via BILAGEPAKET_SYNLIGT. Koden, rutten
                och testerna ligger orort – bara knappen ar borta. Ingen
                hanvisning till zip-arkivet i dess stalle: exportvyns uppgift
                ar tva tal, och zip-arkivet forklaras i installningarna
                (docs/design.md, Exportvyn). */}
            {BILAGEPAKET_SYNLIGT ? (
              ex.sald ? (
                <Link href="/export/paket" className={PRIMARKNAPP_KLASS}>
                  Skapa bilagepaket (PDF)
                </Link>
              ) : (
                <div>
                  <span
                    aria-disabled
                    className={`${PRIMARKNAPP_KLASS} pointer-events-none opacity-60`}
                  >
                    Skapa bilagepaket (PDF)
                  </span>
                  <p className="mt-1.5 font-granssnitt text-sm text-text-sekundar">
                    Kräver att bostaden är markerad som såld.
                  </p>
                </div>
              )
            ) : null}

            {ex.sald ? (
              <Link href="/forsaljning" className={SEKUNDARKNAPP_KLASS}>
                Ändra försäljningsuppgifter
              </Link>
            ) : (
              <Link href="/forsaljning" className={PRIMARKNAPP_KLASS}>
                Markera som såld
              </Link>
            )}
            <Friskrivning />
          </div>
        </Kort>
      </>
    );
  }
}

function SidaBlock({
  etikett,
  rader,
  gemensam,
  visaAvdragsgill,
  tomtText,
}: {
  etikett: string;
  rader: K6aExportrad[];
  gemensam: boolean;
  visaAvdragsgill: boolean;
  tomtText: string;
}) {
  return (
    <section>
      <Avdelningsrubrik className="px-4 pt-4">
        {etikett}
      </Avdelningsrubrik>
      {rader.length === 0 ? (
        <p className="px-4 py-3 font-granssnitt text-sm text-text-sekundar">
          {tomtText}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-granssnitt text-sm tabular-nums">
            <thead>
              <tr className="text-left text-text-sekundar">
                <th className="px-4 py-2 font-normal">Åtgärd</th>
                <th className="px-4 py-2 font-normal">År</th>
                <th className="px-4 py-2 text-right font-normal">Belopp</th>
                {visaAvdragsgill ? (
                  <th className="px-4 py-2 text-right font-normal">
                    Avdragsgill del
                  </th>
                ) : null}
                {gemensam ? (
                  <th className="px-4 py-2 text-right font-normal">
                    Din andel
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-linje border-t border-linje">
              {rader.map((r, i) => {
                // Vilket tal delagarens "Din andel"-kolumn visar: pa sida 2 ar
                // det den avdragsgilla delen (det som summeras till ruta 5), pa
                // sida 1 hela beloppet.
                const individuelltVarde = visaAvdragsgill
                  ? (r.avdragsgill_del_individuellt ?? 0)
                  : r.belopp_individuellt;
                return (
                  <tr key={`${r.atgard}-${r.ar}-${i}`} className="align-top">
                    <td className="px-4 py-3">
                      {/* Ingen orange prick pa nollrader (docs/design.md,
                          Exportvyn): pricken betyder att nagot kraver atgard, och
                          en rad som fallit pa en regel ar slutgiltig – forklaringen
                          under raden bar beskedet ensam. */}
                      <span className="flex items-center gap-1.5 text-text-primar">
                        {r.atgard}
                      </span>
                      {r.varningar.map((v) => (
                        <span
                          key={v}
                          className="mt-0.5 block text-sm text-text-sekundar"
                        >
                          {v}
                        </span>
                      ))}
                      {r.forklaring ? (
                        <span className="mt-0.5 block text-sm text-text-sekundar">
                          {r.forklaring}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-text-sekundar">{r.ar}</td>
                    <td className="px-4 py-3 text-right text-text-primar">
                      {formateraKronor(beloppIKolumnen(r))}
                    </td>
                    {visaAvdragsgill ? (
                      <td className="px-4 py-3 text-right text-text-primar">
                        {formateraKronor(r.avdragsgill_del_brutto ?? 0)}
                      </td>
                    ) : null}
                    {gemensam ? (
                      <td className="px-4 py-3 text-right text-text-sekundar">
                        {formateraKronor(individuelltVarde)}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RutaCallout({
  ruta,
  underrad,
  brutto,
  gemensam,
  agarandel,
  dampad,
}: {
  /** Etikett och tal ur rutorForLasaren: "Förs till" bara bredvid läsarens eget tal. */
  ruta: RutaForLasaren;
  underrad: string;
  brutto: number;
  gemensam: boolean;
  agarandel: number;
  /** Väntar något på frågor är talet ofullständigt och sätts i
   *  --text-sekundar i stället för --text-primar (docs/design.md, Exportvyn). */
  dampad: boolean;
}) {
  return (
    <section className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-granssnitt text-sm text-text-sekundar">
          {ruta.etikett}
        </span>
        <span
          className={`font-rubrik text-3xl tabular-nums ${
            dampad ? "text-text-sekundar" : "text-text-primar"
          }`}
        >
          {formateraKronor(ruta.belopp)}
        </span>
      </div>
      <p className="mt-1 font-granssnitt text-sm text-text-sekundar">
        {underrad}
      </p>
      {/* Blanketten tar hela kronor: talet ovan ar avrundat och skiljer sig
          darfor fran summan av raderna (CLAUDE.md, "Blanketten tar hela
          kronor"). Bara nar avrundningen andrat talet. */}
      {ruta.avrundat ? (
        <p className="mt-1 font-granssnitt text-sm text-text-sekundar">
          {AVRUNDAT_TILL_HELA_KRONOR}
        </p>
      ) : null}
      {gemensam ? (
        <p className="mt-1 font-granssnitt text-sm tabular-nums text-text-sekundar">
          Hela bostaden {formateraKronor(brutto)} · din andel {agarandel} %
        </p>
      ) : null}
    </section>
  );
}


/**
 * En rad i listan over det som aterstar: atgardsprick, namn och en dampad rad
 * med varfor det inte ar med, ar och belopp hogerstallt. Ett kvitto utan
 * betaldatum leder till kvittots skarm, dar datumet fylls i. Ett utkast med
 * bilaga leder till kompletteringen och visar INGET belopp – det finns inget,
 * och en nolla vore ett pahittat tal (docs/design.md, Skarmuppbyggnad).
 */
function AterstarRad({
  namn,
  orsak,
  ar,
  belopp,
  href,
}: {
  namn: string;
  orsak: string;
  ar: number | null;
  belopp: number | null;
  href?: string;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2 font-granssnitt text-sm">
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-text-primar">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
          />
          {href ? (
            <Link href={href} className="truncate underline hover:text-accent-mork">
              {namn}
            </Link>
          ) : (
            <span className="truncate">{namn}</span>
          )}
        </span>
        <span className="mt-0.5 block text-sm text-text-sekundar">{orsak}</span>
      </span>
      <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
        {ar !== null ? <span className="text-text-sekundar">{ar}</span> : null}
        {belopp !== null ? (
          <span className="text-text-primar">{formateraKronor(belopp)}</span>
        ) : null}
      </span>
    </li>
  );
}
