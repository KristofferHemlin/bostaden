// Steg 7: exportvyn. K6A-sammanstallningen (hjalpblankett SKV 2197) pa skarm –
// sida 1 med grundforbattringar, sida 2 med forbattrande reparationer inklusive
// kolumnen for avdragsgill del efter forslitning, och de tva summorna utpekade
// som ruta 4 och ruta 5. Ingen PDF, inga bilagor – det ar steg 9/14.
//
// All berakning bor i src/doman/export-k6a.ts. Har komponeras den bara. Ingen ny
// domanregel. Struktur och farger: docs/design.md (metrikblock-monstret ateranvands
// for ruta 4/5; inget rott/gront for status).

import Link from "next/link";
import {
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
import { bostadHeader } from "@/lib/bostad-header";
import { hamtaBostadsdata } from "@/lib/doman-fran-db";
import { formateraKronor, isoDatum } from "@/lib/format";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ExportSida() {
  const { bostadId, agarandel } = await kravBostad();
  const { bostad, projekt, kostnader, regelparametrar } =
    await hamtaBostadsdata(bostadId);
  const { bostadsnamn, andrarad } = bostadHeader(bostad);

  const insamlingslage = bostad.upplatelseform === "fastighet";
  const sald = bostad.forsaljningsdatum !== null;

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      andrarad={andrarad}
      rubrik="Deklarationsunderlag"
      bakLank={{ href: "/", text: "Översikt" }}
    >
      {renderaInnehall()}
    </Skarm>
  );

  function renderaInnehall() {
    if (insamlingslage) {
      return (
        <div className="p-5">
          <Meddelanderuta>
            Bostaden körs i insamlingsläge (fastighet). Fastighetsreglerna är inte
            implementerade ännu, så avdragsstatus och export är avstängda.
            Kostnader, projekt och årssummor fungerar som vanligt.
          </Meddelanderuta>
          <Link href="/" className={`${SEKUNDARKNAPP_KLASS} mt-4`}>
            Till översikten
          </Link>
        </div>
      );
    }

    if (!sald) {
      return (
        <div className="p-5">
          <p className="font-rubrik text-lg text-text-primar">
            Bostaden är inte såld än
          </p>
          <p className="mt-1 font-granssnitt text-sm text-text-dampad">
            Sammanställningen bygger på försäljningsåret – femårsfönstret för
            reparationer räknas bakåt därifrån. Markera bostaden som såld med
            datum, så genereras underlaget här.
          </p>
          <Link href="/forsaljning" className={`${PRIMARKNAPP_KLASS} mt-4`}>
            Markera som såld
          </Link>
        </div>
      );
    }

    const indata: K6aIndata = {
      bostad: {
        upplatelseform: bostad.upplatelseform,
        tilltradesdatum: isoDatum(bostad.tilltradesdatum),
        forsaljningsdatum: bostad.forsaljningsdatum
          ? isoDatum(bostad.forsaljningsdatum)
          : null,
      },
      medlemskap: { agarandel },
      projekt,
      kostnader,
      regelparametrar,
    };

    let ex: K6aExport;
    try {
      ex = byggK6aExport(indata);
    } catch (fel) {
      return (
        <div className="p-5">
          <Meddelanderuta>
            Underlaget kunde inte beräknas: {(fel as Error).message}
          </Meddelanderuta>
          <Link href="/forsaljning" className={`${SEKUNDARKNAPP_KLASS} mt-4`}>
            Se över försäljningsuppgifterna
          </Link>
        </div>
      );
    }

    const gemensam = ex.delagarvariant === "gemensam_med_andel";
    const varningar = [...new Set(ex.varningar)];

    return (
      <>
        <section className="space-y-1 border-b border-linje p-4 font-granssnitt text-sm text-text-dampad">
          <div className="flex justify-between gap-3">
            <span>Försäljningsdatum</span>
            <span className="tabular-nums text-text-primar">
              {ex.genererad_for_datum}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Ägarandel</span>
            <span className="tabular-nums text-text-primar">
              {ex.agarandel_procent} %
            </span>
          </div>
        </section>

        <div className="border-b border-linje p-4">
          <Meddelanderuta>
            {gemensam
              ? "Din ägarandel är under 100 %. Sammanställningen visar både hela bostadens belopp och din andel, så att den andra delägaren kan använda samma underlag."
              : "Sammanställningen följer hjälpblankett SKV 2197 (K6A). Den lämnas inte in – spara den. Bilagepaketet som PDF kommer i ett senare steg."}
          </Meddelanderuta>
        </div>

        <SidaBlock
          etikett="Sida 1 · Grundförbättringar"
          rader={ex.sida1.rader}
          gemensam={gemensam}
          visaAvdragsgill={false}
          tomtText="Inga grundförbättringar registrerade."
        />

        <RutaCallout
          rubrik="Förs till K6, ruta 4"
          underrad="Summa sida 1 – grundförbättringar"
          brutto={ex.ruta4_brutto}
          individuellt={ex.ruta4_individuellt}
          gemensam={gemensam}
          agarandel={ex.agarandel_procent}
        />

        <SidaBlock
          etikett="Sida 2 · Förbättrande reparationer"
          rader={ex.sida2.rader}
          gemensam={gemensam}
          visaAvdragsgill
          tomtText="Inga förbättrande reparationer registrerade."
        />

        <RutaCallout
          rubrik="Förs till K6, ruta 5"
          underrad="Summa sida 2 – avdragsgill del efter förslitning"
          brutto={ex.ruta5_brutto}
          individuellt={ex.ruta5_individuellt}
          gemensam={gemensam}
          agarandel={ex.agarandel_procent}
        />

        {ex.oklassificerade_hogar.length > 0 ? (
          <section className="border-b border-linje p-4">
            <p className="font-granssnitt text-sm font-medium text-text-primar">
              Behöver klassificeras
            </p>
            <p className="mt-1 font-granssnitt text-xs text-text-dampad">
              De här högarna är grupperade men har inte gått igenom frågorna, så
              de ingår inte i talen ovan. Kör klassificeringsgenomgången för att
              ta med dem.
            </p>
            <ul className="mt-2 divide-y divide-linje border-t border-linje">
              {ex.oklassificerade_hogar.map((h) => (
                <li
                  key={`${h.namn}-${h.ar}`}
                  className="flex items-baseline justify-between gap-3 py-2 font-granssnitt text-sm"
                >
                  <span className="flex items-center gap-1.5 text-text-primar">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    />
                    {h.namn}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
                    <span className="text-text-sekundar">{h.ar}</span>
                    <span className="text-text-primar">
                      {formateraKronor(h.belopp_brutto)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/genomgang" className={`${SEKUNDARKNAPP_KLASS} mt-3`}>
              Till klassificeringen
            </Link>
          </section>
        ) : null}

        {varningar.length > 0 ? (
          <section className="border-b border-linje p-4">
            <p className="font-granssnitt text-sm font-medium text-text-primar">
              Gå igenom innan du skriver av talen
            </p>
            <ul className="mt-2 space-y-1.5">
              {varningar.map((v) => (
                <li
                  key={v}
                  className="flex gap-2 font-granssnitt text-sm text-text-sekundar"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                  />
                  {v}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="p-4">
          <Link href="/forsaljning" className={SEKUNDARKNAPP_KLASS}>
            Ändra försäljningsuppgifter
          </Link>
        </div>
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
    <section className="border-b border-linje">
      <p className="px-4 pt-4 font-granssnitt text-xs uppercase tracking-wide text-text-dampad">
        {etikett}
      </p>
      {rader.length === 0 ? (
        <p className="px-4 py-3 font-granssnitt text-sm text-text-dampad">
          {tomtText}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-granssnitt text-sm tabular-nums">
            <thead>
              <tr className="text-left text-text-dampad">
                <th className="px-4 py-2 font-normal">Åtgärd</th>
                <th className="px-4 py-2 font-normal">År</th>
                <th className="px-4 py-2 text-right font-normal">Belopp</th>
                {visaAvdragsgill ? (
                  <th className="px-4 py-2 text-right font-normal">
                    Avdragsgill del
                  </th>
                ) : null}
                {gemensam ? (
                  <th className="px-4 py-2 text-right font-normal">Din andel</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-linje border-t border-linje">
              {rader.map((r, i) => {
                const attgora = r.belopp_brutto === 0;
                // Vilket tal delagarens "Din andel"-kolumn visar: pa sida 2 ar
                // det den avdragsgilla delen (det som summeras till ruta 5), pa
                // sida 1 hela beloppet.
                const individuelltVarde = visaAvdragsgill
                  ? r.avdragsgill_del_individuellt ?? 0
                  : r.belopp_individuellt;
                return (
                  <tr key={`${r.atgard}-${r.ar}-${i}`} className="align-top">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-text-primar">
                        {attgora ? (
                          <span
                            aria-hidden
                            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                          />
                        ) : null}
                        {r.atgard}
                      </span>
                      {r.underlagsstyrka === "svagt" ? (
                        <span className="mt-0.5 block text-xs text-text-dampad">
                          underlag saknas
                        </span>
                      ) : null}
                      {r.varningar.map((v) => (
                        <span
                          key={v}
                          className="mt-0.5 block text-xs text-text-dampad"
                        >
                          {v}
                        </span>
                      ))}
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
}: {
  rubrik: string;
  underrad: string;
  brutto: number;
  individuellt: number;
  gemensam: boolean;
  agarandel: number;
}) {
  return (
    <section className="border-b border-linje p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-granssnitt text-sm text-text-sekundar">
          {rubrik}
        </span>
        <span className="font-rubrik text-3xl tabular-nums text-text-primar">
          {formateraKronor(gemensam ? individuellt : brutto)}
        </span>
      </div>
      <p className="mt-1 font-granssnitt text-xs text-text-dampad">{underrad}</p>
      {gemensam ? (
        <p className="mt-1 font-granssnitt text-xs tabular-nums text-text-dampad">
          Hela bostaden {formateraKronor(brutto)} · din andel {agarandel} %
        </p>
      ) : null}
    </section>
  );
}
