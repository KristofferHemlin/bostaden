// Steg 4: oppna ett projekt. Visar de fyra svaren, harledd underlagsstyrka och
// de kostnader som kopplats hit. Harifran lagger man till en kostnad.

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Listrad,
  PRIMARKNAPP_KLASS,
  SEKUNDARKNAPP_KLASS,
  Skarm,
} from "@/components/skarm";
import { bidragForKostnad, harledUnderlagsstyrka } from "@/doman/berakningar";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { formateraKronor } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

function jaNejVetInte(v: boolean | null): string {
  if (v === true) return "Ja";
  if (v === false) return "Nej";
  return "Inte besvarat";
}

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
  const { bostadsnamn, andrarad } = bostadHeader(bostad);

  const kostnadRader = await prisma.kostnad.findMany({
    where: {
      bostad_id: bostadId,
      rader: { some: { fordelningar: { some: { projekt_id: id } } } },
    },
    include: { rader: { include: { fordelningar: true } } },
    orderBy: { betaldatum: "asc" },
  });
  const kostnader = kostnadRader.map(tillDomanKostnad);

  const oklassificerad = projekt.kategori === null;
  const kategoriText = oklassificerad
    ? "Behöver klassificeras"
    : projekt.kategori === "grundforbattring"
      ? "Grundförbättring"
      : "Reparation";
  const svagt = harledUnderlagsstyrka(projekt) === "svagt";

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      andrarad={andrarad}
      rubrik={projekt.namn}
      bakLank={{ href: "/projekt", text: "Projekt" }}
    >
      <section className="space-y-2 border-b border-linje p-4 font-granssnitt text-sm">
        <Rad etikett="Kategori" varde={kategoriText} atgard={oklassificerad} />
        <Rad etikett="År (etikett)" varde={String(projekt.ar)} />
        {oklassificerad ? null : (
          <>
            <Rad
              etikett="Nytt eller fanns förut"
              varde={
                projekt.kategori === "grundforbattring"
                  ? "Nytt / klar förbättring"
                  : "Fanns förut, uppfräschat"
              }
            />
            <Rad
              etikett="Slitet vid inflytt"
              varde={jaNejVetInte(projekt.slitet_vid_tilltrade)}
            />
          </>
        )}
        <Rad
          etikett="Underlag"
          varde={svagt ? "underlag saknas" : "dokumenterat"}
          atgard={svagt && !oklassificerad}
        />
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
                  namn={original.leverantor}
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
          <Link
            href={`/kostnad/nytt?projekt=${id}`}
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
