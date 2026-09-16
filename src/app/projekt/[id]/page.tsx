// Steg 4: oppna ett projekt. Visar fragetradets svar och de kostnader som
// kopplats hit. Harifran lagger man till en kostnad. Fraga 8:s fritext
// (`motivering`) visas som en egen rad nar den ar ifylld – den ar det enda
// som bar bevisningen nar kvitto saknas.

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Listrad,
  PRIMARKNAPP_KLASS,
  SEKUNDARKNAPP_KLASS,
  Skarm,
} from "@/components/skarm";
import { bidragForKostnad } from "@/doman/berakningar";
import { atgardKategoriText, SKICK_ORD } from "@/doman/fragetradet";
import type { Atgardstyp } from "@/doman/typer";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { formateraKronor } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

// Fraga 2-4:s svar, sammanfattat till en rad (produktspec 4.1).
const ATGARDSTYP_TEXT: Record<Atgardstyp, string> = {
  nybyggnad: "Byggde något nytt",
  planlosning: "Ändrade planlösningen",
  nytt_tillagg: "Satte in något nytt",
  utbytt: "Bytte ut något som fanns",
};

export default async function ProjektSida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { bostadId } = await kravBostad();

  const projekt = await prisma.projekt.findFirst({
    where: { id, bostad_id: bostadId },
  });
  if (!projekt) notFound();

  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
  });
  const { bostadsnamn } = bostadHeader(bostad);

  const kostnadRader = await prisma.kostnad.findMany({
    where: {
      bostad_id: bostadId,
      rader: { some: { fordelningar: { some: { projekt_id: id } } } },
    },
    include: { rader: { include: { fordelningar: true } } },
    orderBy: { betaldatum: "asc" },
  });
  const kostnader = kostnadRader.map(tillDomanKostnad);

  const oklassificerad = projekt.atgardstyp === null;
  const kategoriText = atgardKategoriText(
    projekt.atgardstyp,
    projekt.battre_kvalitet,
  );
  // Reparationsdelen (och darmed skickfragorna) finns bara vid ett utbyte
  // (produktspec 4.1: en ren grundforbattring har inget "fore" att jamfora mot).
  const harReparationsdel = projekt.atgardstyp === "utbytt";

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik={projekt.namn}
      bakLank={{ href: "/projekt", text: "Projekt" }}
    >
      <section className="space-y-2 border-b border-linje p-4 font-granssnitt text-sm">
        <Rad etikett="Kategori" varde={kategoriText} atgard={oklassificerad} />
        <Rad etikett="År (etikett)" varde={String(projekt.ar)} />
        {oklassificerad ? null : (
          <>
            <Rad etikett="Vad gjordes" varde={ATGARDSTYP_TEXT[projekt.atgardstyp!]} />
            {projekt.atgardstyp === "utbytt" ? (
              <Rad
                etikett="Kvalitet"
                varde={
                  projekt.battre_kvalitet
                    ? `Bättre – merkostnad ${formateraKronor(projekt.merkostnad ?? 0)}`
                    : "Liknande som tidigare"
                }
              />
            ) : null}
            {harReparationsdel ? (
              <Rad
                etikett="Skick vid förvärvet"
                varde={
                  projekt.skick_forvarv !== null
                    ? `${projekt.skick_forvarv} – ${SKICK_ORD[projekt.skick_forvarv]}`
                    : "Inte besvarat"
                }
              />
            ) : null}
            {harReparationsdel ? (
              <Rad
                etikett="Skick vid försäljningen"
                varde={
                  projekt.skick_forsaljning !== null
                    ? `${projekt.skick_forsaljning} – ${SKICK_ORD[projekt.skick_forsaljning]}`
                    : "Inte bekräftat än"
                }
                atgard={projekt.skick_forsaljning === null}
              />
            ) : null}
          </>
        )}
        {oklassificerad ? (
          <p className="pt-1 text-text-sekundar">
            Den här högen är grupperad men har inte gått igenom frågorna. Den
            räknas inte in i underlaget förrän den klassificerats.
          </p>
        ) : null}
        {projekt.motivering ? (
          <p className="pt-1 text-text-sekundar">{projekt.motivering}</p>
        ) : null}
      </section>

      <section>
        <p className="px-4 pt-4 font-granssnitt text-xs uppercase tracking-wide text-text-dampad">
          Kopplade kostnader
        </p>
        {kostnader.length === 0 ? (
          <p className="px-4 py-3 font-granssnitt text-sm text-text-dampad">
            Inga kostnader kopplade än.
          </p>
        ) : (
          <div className="divide-y divide-linje">
            {kostnader.map((k) => {
              const original = kostnadRader.find((x) => x.id === k.id)!;
              return (
                <Listrad
                  key={k.id}
                  namn={original.leverantor ?? "Kvitto"}
                  status={
                    k.betaldatum
                      ? `Betald ${k.betaldatum}`
                      : "Obetald – räknas inte in än"
                  }
                  atgard={!k.betaldatum}
                  belopp={formateraKronor(bidragForKostnad(k, id))}
                />
              );
            })}
          </div>
        )}
        <div className="flex flex-col gap-2 p-4">
          {oklassificerad ? (
            <Link href="/genomgang/fragor" className={PRIMARKNAPP_KLASS}>
              Klassificera högen
            </Link>
          ) : null}
          {/* Inmatningen kopplar inte till en gruppering (docs/design.md,
              "Inmatningen har fem falt, inget mer"); kvittot hamnar i
              genomgangen dar det kopplas. */}
          <Link
            href="/kostnad/nytt"
            className={oklassificerad ? SEKUNDARKNAPP_KLASS : PRIMARKNAPP_KLASS}
          >
            Lägg till kvitto
          </Link>
          <Link
            href={`/projekt/${id}/redigera`}
            className={SEKUNDARKNAPP_KLASS}
          >
            Ändra projektet
          </Link>
        </div>
      </section>
    </Skarm>
  );
}

function Rad({
  etikett,
  varde,
  atgard,
}: {
  etikett: string;
  varde: string;
  atgard?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-text-dampad">{etikett}</span>
      <span className="flex items-center gap-1.5 text-right text-text-primar">
        {atgard ? (
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
          />
        ) : null}
        {varde}
      </span>
    </div>
  );
}
