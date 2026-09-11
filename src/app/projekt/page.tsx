// Steg 4: lista projekt, grupperade per ar-etikett. Varje rad ar klickbar och
// blir anvandarens att-gora-lista (produktspec 7).

import Link from "next/link";
import { KategoriInfo } from "./kategori-info";
import { Listrad, Skarm } from "@/components/skarm";
import { bidragForKostnad } from "@/doman/berakningar";
import { bostadHeader } from "@/lib/bostad-header";
import { hamtaBostadsdata } from "@/lib/doman-fran-db";
import { formateraKronor } from "@/lib/format";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProjektlistaSida() {
  const { bostadId } = await kravBostad();
  const { bostad, projektRader, kostnader } = await hamtaBostadsdata(bostadId);
  const { bostadsnamn } = bostadHeader(bostad);

  const rader = projektRader.map((p) => {
    let belopp = 0;
    for (const k of kostnader) {
      if (k.arkiverad || !k.betaldatum) continue;
      belopp += bidragForKostnad(k, p.id);
    }
    if (p.kategori === null) {
      // En hog fran klassificeringsgenomgangens fas 1 som annu inte klassificerats.
      return {
        id: p.id,
        namn: p.namn,
        ar: p.ar,
        belopp,
        status: "Behöver klassificeras",
        atgard: true,
      };
    }
    const kategoriText =
      p.kategori === "grundforbattring" ? "Grundförbättring" : "Reparation";
    return {
      id: p.id,
      namn: p.namn,
      ar: p.ar,
      belopp,
      status: kategoriText,
      atgard: false,
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
                  <Listrad
                    key={r.id}
                    href={`/projekt/${r.id}`}
                    namn={r.namn}
                    status={r.status}
                    atgard={r.atgard}
                    belopp={formateraKronor(r.belopp)}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </Skarm>
  );
}
