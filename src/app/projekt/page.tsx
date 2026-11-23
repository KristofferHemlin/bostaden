// Projektlistan (produktspec 7, docs/design.md "Projektlistan"). Varje rad ar
// klickbar och blir anvandarens att-gora-lista.
//
// Ingen arsgruppering: ett projekt hor inte till ett ar, det ar kvittona som
// gor det (docs/design.md, "Listan grupperas inte på år"). Aret star pa
// raden, ur kvittonas betaldatum, och spanner projektet over ett arsskifte
// star bada. Ordningen ar nyast skapade forst – sparandet leder hit, och
// raden overst ar bekraftelsen.

import Link from "next/link";
import { KategoriInfo } from "./kategori-info";
import { Listrad, PRIMARKNAPP_KLASS, Skarm } from "@/components/skarm";
import {
  beloppForKostnad,
  projektSumma,
  rotForBelopp,
} from "@/doman/berakningar";
import { atgardKategoriText } from "@/doman/fragetradet";
import { projektnamnKarta } from "@/doman/genomgang";
import { slaUppRegelparameter } from "@/doman/regelparameter";
import { bostadHeader } from "@/lib/bostad-header";
import { hamtaBostadsdata } from "@/lib/doman-fran-db";
import { idagISverige } from "@/lib/datum";
import { formateraKronor, sparadDag } from "@/lib/format";
import { rotAvgarRad } from "@/lib/kvittolista";
import { projektarTextKarta } from "@/lib/projektar";
import { kravBostad } from "@/lib/session";

export const metadata = { title: "Projekt" };

export const dynamic = "force-dynamic";

// Fler an fem kvitton under ett projekt klipps, med en dampad rad om hur
// manga som aterstar (docs/design.md, "Listrader").
const MAX_KVITTON_VISADE = 5;

export default async function ProjektlistaSida() {
  const { bostadId } = await kravBostad();
  const { bostad, projektRader, kostnader, kostnadRader, regelparametrar } =
    await hamtaBostadsdata(bostadId);
  const { bostadsnamn } = bostadHeader(bostad);

  // Tidsfonstret for reparationer, som informationsknappen namner. Ur
  // regelparametern for forsaljningsdatumet eller, fore forsaljningen, i dag.
  const fonsterAr = slaUppRegelparameter(
    regelparametrar,
    "reparationsfonster_ar",
    bostad.forsaljningsdatum
      ? sparadDag(bostad.forsaljningsdatum)
      : idagISverige(),
  );

  const domanKostnadPerId = new Map(kostnader.map((k) => [k.id, k]));
  // En hog utan namn heter som i fas 1 (src/doman/genomgang.ts).
  const projektnamn = projektnamnKarta(projektRader, kostnadRader);

  // Nyast skapade forst, med id som andra nyckel: tva projekt med samma
  // tidsstampel far aldrig en ordning som avgors av slumpen (CLAUDE.md,
  // "Lika tidsstämplar är ingen ordning"). Fragan i hamtaBostadsdata ror vi
  // inte – underlaget laser samma rader.
  const iOrdning = [...projektRader].sort(
    (a, b) => b.skapad_at.getTime() - a.skapad_at.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
  );

  const arText = projektarTextKarta(projektRader, kostnadRader);

  const rader = iOrdning.map((p) => {
    // Allt som kopplats hit, aven utan betaldatum – samma tal som projektets
    // egen sida (projektSumma).
    const belopp = projektSumma(kostnader, p.id);

    // Projektlistan visar sina kvitton (docs/design.md, "Listrader"): direkt
    // under namnet, med leverantor, datum och belopp – annars ar raden ett
    // belopp utan forklaring. Beloppet ar det PA PAPPRET (beloppForKostnad),
    // inte den ROT-reducerade bidraget ovan (docs/design.md, "Samma belopp
    // ska se likadant ut overallt") – annars star samma kvitto med tva olika
    // summor pa samma skarm, precis den bugg regeln finns for att undvika.
    const kvitton = kostnadRader
      .filter((k) =>
        k.rader.some((r) => r.fordelningar.some((f) => f.projekt_id === p.id)),
      )
      .sort((a, b) => {
        const da = a.betaldatum ?? a.dokumentdatum;
        const db = b.betaldatum ?? b.dokumentdatum;
        return (da?.getTime() ?? 0) - (db?.getTime() ?? 0);
      })
      .map((k) => {
        const domanKostnad = domanKostnadPerId.get(k.id)!;
        const datum = k.betaldatum ?? k.dokumentdatum;
        const belopp = beloppForKostnad(domanKostnad, p.id);
        return {
          id: k.id,
          leverantor: k.leverantor,
          datum: datum ? sparadDag(datum) : null,
          belopp,
          // ROT som avgar fran just den har delen av kvittot – raden minus
          // ROT ar vad den bidrar med till projektets summa ovan
          // (docs/design.md, Listrader: "ROT-raden hor till kvittoraden,
          // overallt den visas").
          rotRad: rotAvgarRad(rotForBelopp(domanKostnad, belopp)),
        };
      });

    return {
      id: p.id,
      namn: projektnamn.get(p.id) ?? p.namn,
      // Aren ur kvittonas betaldatum, samma harledning som varje annan
      // skarm (projektarTextKarta): "2025–2026" over ett arsskifte.
      // Inget ar utan betalt kvitto – aldrig etiketten projekt.ar.
      arText: arText.get(p.id) ?? null,
      harKvitton: kvitton.length > 0,
      belopp,
      // En hog fran klassificeringsgenomgangens fas 1 (atgardstyp = null) har
      // annu inte gatt igenom fragetradet – prickas som en atgard.
      status: atgardKategoriText(p.atgardstyp, p.battre_kvalitet),
      atgard: p.atgardstyp === null,
      kvitton,
    };
  });


  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Projekt"
      rubrikExtra={
        rader.length > 0 ? <KategoriInfo fonsterAr={fonsterAr} /> : undefined
      }
    >
      {rader.length === 0 ? (
        // Tomlaget ar det vanliga (docs/design.md, "Projektlistan"): en
        // rubrik som ar en uppmaning, en rad om varfor, och knappen i full
        // bredd. Projektsidan ar vagen in – till 2026-11-13 hade den ingen
        // knapp alls, eftersom projekt da uppstod ur grupperingen.
        <div className="p-5">
          <p className="font-rubrik text-lg text-text-primar">
            Berätta vad du gjort
          </p>
          <p className="mt-1 font-granssnitt text-sm text-text-sekundar">
            Ett projekt samlar allt du gjort med en och samma sak – till exempel
            att måla sovrummet. Du beskriver vad du gjorde och väljer sedan
            vilka kvitton som hörde dit.
          </p>
          <Link href="/projekt/nytt" className={`${PRIMARKNAPP_KLASS} mt-4`}>
            Skapa projekt
          </Link>
        </div>
      ) : (
        <>
          {/* Primarknappen fore listan, som pa kvittolistan: listan vaxer med
              aren och knappen ska inte krava att man scrollar forbi den. */}
          <div className="border-b border-linje p-4">
            <Link href="/projekt/nytt" className={PRIMARKNAPP_KLASS}>
              Skapa projekt
            </Link>
          </div>
          <div className="divide-y divide-linje">
                {rader.map((r) => (
                  // Utstrackt lank (docs/design.md, "Listrader"): kortet – rad
                  // OCH kvittolistan under – ska vara en enda klickyta, inte
                  // bara den ovre halvan. `relative` har gor kortet till den
                  // forfader som Listrads `::after` (via `strackt`) tacker.
                  // Hovringen (`hover:bg-yta-hover`) sitter pa SAMMA element
                  // – inte `group-hover` pa en inre rad, som bara skulle lysa
                  // upp Listrads egen (mindre) box trots att hela kortet
                  // svarar pa ett tryck (docs/design.md, "Listrader": "mark-
                  // eringen hor pa samma element som bar group och relative").
                  // Ingen `group`-klass behovs: har ar det elementet som
                  // hovras som ocksa ska fargas, sa en vanlig `hover:`-variant
                  // racker – `group-hover` pa sig sjalv skulle aldrig traffa,
                  // eftersom Tailwind genererar den regeln som en efterkommare
                  // (`.group:hover .group-hover\:x`), aldrig elementet sjalvt.
                  <div key={r.id} className="relative hover:bg-yta-hover">
                    <Listrad
                      href={`/projekt/${r.id}`}
                      strackt
                      namn={r.namn}
                      // Aret pa raden, fore vad det raknas som.
                      status={[r.arText, r.status].filter(Boolean).join(" · ")}
                      atgard={r.atgard}
                      // Ett projekt utan kvitton har inget belopp – "0 kr"
                      // vore ett matt tal (docs/design.md, Projektlistan).
                      belopp={r.harKvitton ? formateraKronor(r.belopp) : undefined}
                      beloppSaknas="Inga kvitton än"
                    />
                    {r.kvitton.length > 0 ? (
                      <ul className="flex flex-col gap-1 px-4 pb-3">
                        {r.kvitton.slice(0, MAX_KVITTON_VISADE).map((k) => (
                          <li
                            key={k.id}
                            className="font-granssnitt text-sm text-text-sekundar"
                          >
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="min-w-0 truncate">
                                {[k.leverantor, k.datum]
                                  .filter((d): d is string => !!d)
                                  .join(" · ") || "Kvitto"}
                              </span>
                              <span className="shrink-0 tabular-nums">
                                {formateraKronor(k.belopp)}
                              </span>
                            </div>
                            {/* Under namnet, aldrig under beloppet
                                (docs/design.md, Listrader). */}
                            {k.rotRad ? (
                              <p className="mt-0.5 text-sm">{k.rotRad}</p>
                            ) : null}
                          </li>
                        ))}
                        {r.kvitton.length > MAX_KVITTON_VISADE ? (
                          <li className="font-granssnitt text-sm text-text-sekundar">
                            +{r.kvitton.length - MAX_KVITTON_VISADE} till
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </div>
                ))}
          </div>
        </>
      )}
    </Skarm>
  );
}
