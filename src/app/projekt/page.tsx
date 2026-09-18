// Steg 4: lista projekt, grupperade per ar-etikett. Varje rad ar klickbar och
// blir anvandarens att-gora-lista (produktspec 7).

import Link from "next/link";
import { KategoriInfo } from "./kategori-info";
import { Listrad, Skarm } from "@/components/skarm";
import { beloppForKostnad, bidragForKostnad } from "@/doman/berakningar";
import { atgardKategoriText } from "@/doman/fragetradet";
import { bostadHeader } from "@/lib/bostad-header";
import { hamtaBostadsdata } from "@/lib/doman-fran-db";
import { formateraKronor, isoDatum } from "@/lib/format";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

// Fler an fem kvitton under ett projekt klipps, med en dampad rad om hur
// manga som aterstar (docs/design.md, "Listrader").
const MAX_KVITTON_VISADE = 5;

export default async function ProjektlistaSida() {
  const { bostadId } = await kravBostad();
  const { bostad, projektRader, kostnader, kostnadRader } =
    await hamtaBostadsdata(bostadId);
  const { bostadsnamn } = bostadHeader(bostad);

  const domanKostnadPerId = new Map(kostnader.map((k) => [k.id, k]));

  const rader = projektRader.map((p) => {
    let belopp = 0;
    for (const k of kostnader) {
      if (k.arkiverad || !k.betaldatum) continue;
      belopp += bidragForKostnad(k, p.id);
    }

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
        return {
          id: k.id,
          leverantor: k.leverantor,
          datum: datum ? isoDatum(datum) : null,
          belopp: beloppForKostnad(domanKostnad, p.id),
        };
      });

    return {
      id: p.id,
      namn: p.namn,
      ar: p.ar,
      belopp,
      // En hog fran klassificeringsgenomgangens fas 1 (atgardstyp = null) har
      // annu inte gatt igenom fragetradet – prickas som en atgard.
      status: atgardKategoriText(p.atgardstyp, p.battre_kvalitet),
      atgard: p.atgardstyp === null,
      kvitton,
    };
  });

  const perAr = new Map<number, typeof rader>();
  for (const r of rader) {
    const lista = perAr.get(r.ar) ?? [];
    lista.push(r);
    perAr.set(r.ar, lista);
  }
  const arSorterade = [...perAr.keys()].sort((a, b) => b - a);

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Projekt"
      rubrikExtra={rader.length > 0 ? <KategoriInfo /> : undefined}
    >
      {rader.length === 0 ? (
        <div className="p-5">
          <p className="font-rubrik text-lg text-text-primar">
            Inga projekt än
          </p>
          {/* Ingen primärknapp här. En primärknapp skulle säga att det finns en
              handling som är vägen framåt, och det gör det inte – grupperingar
              skapas inte som en egen uppgift utan uppstår ur klassificeringen.
              En textlänk till genomgången räcker (docs/design.md, "Tomma
              tillstånd": ingen knapp för att skapa en gruppering). */}
          <p className="mt-1 font-granssnitt text-sm text-text-dampad">
            Ett projekt samlar allt du gjort med en och samma sak – till exempel
            att måla sovrummet. Grupperingar skapas när du{" "}
            <Link
              href="/genomgang"
              className="underline hover:text-accent-mork"
            >
              klassificerar dina kvitton
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          {arSorterade.map((ar) => (
            <div key={ar} className="border-b border-linje last:border-b-0">
              <p className="px-4 pt-4 font-granssnitt text-xs uppercase tracking-wide text-text-dampad">
                {ar}
              </p>
              <div className="divide-y divide-linje">
                {perAr.get(ar)!.map((r) => (
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
                      status={r.status}
                      atgard={r.atgard}
                      belopp={formateraKronor(r.belopp)}
                    />
                    {r.kvitton.length > 0 ? (
                      <ul className="flex flex-col gap-1 px-4 pb-3">
                        {r.kvitton.slice(0, MAX_KVITTON_VISADE).map((k) => (
                          <li
                            key={k.id}
                            className="flex items-baseline justify-between gap-3 font-granssnitt text-sm text-text-dampad"
                          >
                            <span className="min-w-0 truncate">
                              {[k.leverantor, k.datum]
                                .filter((d): d is string => !!d)
                                .join(" · ") || "Kvitto"}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {formateraKronor(k.belopp)}
                            </span>
                          </li>
                        ))}
                        {r.kvitton.length > MAX_KVITTON_VISADE ? (
                          <li className="font-granssnitt text-xs text-text-dampad">
                            +{r.kvitton.length - MAX_KVITTON_VISADE} till
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </Skarm>
  );
}
