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
// Har bostaden fler an en medlem star overst att sammanstallningen galler hela
// bostaden och att var och en deklarerar sin andel av den (docs/design.md,
// "Samagande – medlemskapet"). Utan raden ser bada delagarna samma summa och
// for in hela beloppet var. En rad, inget stycke – skarmens uppgift ar tva tal.
//
// I en delad bostad ar andelarna inte satta forran de fragas vid forsaljningen.
// Da visas varken raden Agarandel eller rutan om den egna andelen, och beloppen
// raknas med 100 % – en andel fran tiden som ensam agare skulle annars halvera
// talen under en rad som sager hela bostaden (src/lib/samagande.ts).
//
// Ar lasarens egen andel kand – medlemmarnas andelar gar ihop – namnger raden
// den: det ar den andelen hen for in i sin deklaration. Raden ar text, inte
// matematik: beloppen ar fortfarande hela bostadens.

import Link from "next/link";
import {
  Friskrivning,
  Kort,
  Meddelanderuta,
  PRIMARKNAPP_KLASS,
  SEKUNDARKNAPP_KLASS,
  Skarm,
} from "@/components/skarm";
import {
  byggK6aExport,
  type K6aExport,
  type K6aExportrad,
  type K6aIndata,
} from "@/doman/export-k6a";
import { blankettTexter } from "@/doman/blankett";
import { slaUppRegelparameter } from "@/doman/regelparameter";
import { reparationsfonsterNamn } from "@/doman/regeltext";
import { behoverSkickForsaljning } from "@/doman/fragetradet";
import { bostadHeader } from "@/lib/bostad-header";
import { BILAGEPAKET_SYNLIGT } from "@/lib/bilagepaket/flagga";
import { hamtaBostadsdata } from "@/lib/doman-fran-db";
import { formateraKronor, isoDatum } from "@/lib/format";
import { hamtaAndelar } from "@/lib/andelar";
import {
  andelForUnderlag,
  arDeladBostad,
  formateraAndel,
  kandEgenAndel,
} from "@/lib/samagande";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ExportSida() {
  const { bostadId, agarandel } = await kravBostad();
  const [{ bostad, projekt, kostnader, kostnadRader, regelparametrar }, andelar] =
    await Promise.all([hamtaBostadsdata(bostadId), hamtaAndelar(bostadId)]);
  const medlemmar = andelar.medlemmar.length;
  const delad = arDeladBostad(medlemmar);
  const andel = andelForUnderlag(agarandel, medlemmar);
  const kandAndel = kandEgenAndel({
    egenAndel: agarandel,
    medlemsandelar: andelar.medlemmar.map((m) => m.andel),
  });
  const { bostadsnamn } = bostadHeader(bostad);

  // Enda skillnaden mellan upplatelseformerna i den har vyn: huvudblanketten som
  // de tva talen skrivs av till (produktspec 4.9, src/doman/blankett.ts).
  const texter = blankettTexter(bostad.upplatelseform);

  // Tidsfonstret for reparationer namns i forklaringen innan bostaden ar sald.
  // Talet ur regelparametern, aldrig bokstavligt (docs/design.md, Exportvyn);
  // utan forsaljningsdatum galler vardet for i dag.
  const fonsterAr = slaUppRegelparameter(
    regelparametrar,
    "reparationsfonster_ar",
    bostad.forsaljningsdatum
      ? isoDatum(bostad.forsaljningsdatum)
      : isoDatum(new Date()),
  );
  const fonsterNamn = reparationsfonsterNamn(fonsterAr);

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
      bostad: {
        upplatelseform: bostad.upplatelseform,
        tilltradesdatum: isoDatum(bostad.tilltradesdatum),
        forsaljningsdatum: bostad.forsaljningsdatum
          ? isoDatum(bostad.forsaljningsdatum)
          : null,
        nybyggd_vid_forvarv: bostad.nybyggd_vid_forvarv,
        ombildning_fran_hyresratt: bostad.ombildning_fran_hyresratt,
      },
      medlemskap: { agarandel: andel ?? 100 },
      projekt,
      kostnader,
      regelparametrar,
    };

    let ex: K6aExport;
    try {
      ex = byggK6aExport(indata);
    } catch (fel) {
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
    const kvittoNamn = new Map(
      kostnadRader.map((k) => [
        k.id,
        k.anteckning?.trim() || k.leverantor?.trim() || "Kvitto",
      ]),
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
        <Kort className="divide-y divide-linje">
          {delad ? (
            <p className="p-4 font-granssnitt text-sm text-text-primar">
              Sammanställningen gäller{" "}
              <span className="font-medium">hela bostaden</span>
              {kandAndel !== null
                ? `. Du äger ${formateraAndel(kandAndel)} – det är den andelen du för in i din deklaration.`
                : " – var och en deklarerar sin andel av den."}
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
            visaAvdragsgill={false}
            tomtText="Inga grundförbättringar registrerade."
          />

          <RutaCallout
            rubrik={texter.ruta4}
            underrad="Summa sida 1 – grundförbättringar"
            brutto={ex.ruta4_brutto}
            individuellt={ex.ruta4_individuellt}
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
              rubrik={texter.ruta5}
              underrad="Summa sida 2 – avdragsgill del efter förslitning"
              brutto={ex.ruta5_brutto}
              individuellt={ex.ruta5_individuellt}
              gemensam={gemensam}
              agarandel={ex.agarandel_procent}
              dampad={harAterstaende}
            />
          ) : null}
        </Kort>

        <Kort className="divide-y divide-linje">
          {ex.sald ? null : (
            <div className="p-4">
              <Meddelanderuta>
                {fonsterNamn.charAt(0).toUpperCase() + fonsterNamn.slice(1)} och
                förslitningen räknas bakåt från försäljningsdatumet, så den
                avdragsgilla delen på sida 2 går inte att beräkna förrän
                bostaden är markerad som såld. Sida 1 påverkas inte –
                grundförbättringar har ingen tidsgräns.
              </Meddelanderuta>
            </div>
          )}

          {/* Det som aterstar (docs/design.md, Exportvyn: "redovisar varje
              krona som lagts in"). En enda lista – hogar och kvitton – och
              konsekvensen sagd en gang ovanfor. Sida 1, sida 2 och den har
              listan ar tillsammans Totalt inlagt. */}
          {harAterstaende ? (
            <section className="p-4">
              <p className="font-granssnitt text-sm font-medium text-text-primar">
                Återstår
              </p>
              <p className="mt-1 font-granssnitt text-xs text-text-sekundar">
                Det här har du lagt in, men det ingår inte i talen ovan än.
              </p>
              <ul className="mt-2 divide-y divide-linje border-t border-linje">
                {ex.oklassificerade_hogar.map((h) => (
                  <AterstarRad
                    key={`hog-${h.namn}-${h.ar}`}
                    namn={h.namn}
                    orsak="Väntar på frågor"
                    ar={h.ar}
                    belopp={h.belopp_brutto}
                  />
                ))}
                {ex.aterstaende_kvitton.map((k) => (
                  <AterstarRad
                    key={`kvitto-${k.kostnad_id}`}
                    namn={kvittoNamn.get(k.kostnad_id) ?? "Kvitto"}
                    orsak={
                      k.orsak === "utan_betaldatum"
                        ? "Saknar betaldatum"
                        : "Hör inte till något projekt än"
                    }
                    ar={k.ar}
                    belopp={k.belopp_brutto}
                    href={
                      k.orsak === "utan_betaldatum"
                        ? `/kostnad/${k.kostnad_id}`
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
              <p className="mt-1 font-granssnitt text-xs text-text-sekundar">
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
                  <p className="mt-1.5 font-granssnitt text-xs text-text-sekundar">
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
      <p className="px-4 pt-4 font-granssnitt text-xs uppercase tracking-wide text-text-sekundar">
        {etikett}
      </p>
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
                          className="mt-0.5 block text-xs text-text-sekundar"
                        >
                          {v}
                        </span>
                      ))}
                      {r.forklaring ? (
                        <span className="mt-0.5 block text-xs text-text-sekundar">
                          {r.forklaring}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-text-sekundar">{r.ar}</td>
                    <td className="px-4 py-3 text-right text-text-primar">
                      {formateraKronor(r.belopp_brutto)}
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
  rubrik,
  underrad,
  brutto,
  individuellt,
  gemensam,
  agarandel,
  dampad,
}: {
  rubrik: string;
  underrad: string;
  brutto: number;
  individuellt: number;
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
          {rubrik}
        </span>
        <span
          className={`font-rubrik text-3xl tabular-nums ${
            dampad ? "text-text-sekundar" : "text-text-primar"
          }`}
        >
          {formateraKronor(gemensam ? individuellt : brutto)}
        </span>
      </div>
      <p className="mt-1 font-granssnitt text-xs text-text-sekundar">
        {underrad}
      </p>
      {gemensam ? (
        <p className="mt-1 font-granssnitt text-xs tabular-nums text-text-sekundar">
          Hela bostaden {formateraKronor(brutto)} · din andel {agarandel} %
        </p>
      ) : null}
    </section>
  );
}

/**
 * En rad i listan over det som aterstar: atgardsprick, namn och en dampad rad
 * med varfor det inte ar med, ar och belopp hogerstallt. Ett kvitto utan
 * betaldatum leder till kvittots skarm, dar datumet fylls i.
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
  belopp: number;
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
        <span className="mt-0.5 block text-xs text-text-sekundar">{orsak}</span>
      </span>
      <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
        {ar !== null ? <span className="text-text-sekundar">{ar}</span> : null}
        <span className="text-text-primar">{formateraKronor(belopp)}</span>
      </span>
    </li>
  );
}
