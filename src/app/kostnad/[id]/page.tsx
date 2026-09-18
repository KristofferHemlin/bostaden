// Kvittots detaljvy (docs/design.md, "Kvittots detaljvy"). Ett sparat kvitto
// visar anteckningen som rubrik, sedan belopp, datum och leverantor, och
// bilagorna under. Ingenting annat.
//
// Ingen statusrad, ingen projektrad, ingen prick: oklassificerad ar det normala
// tillstandet och kan vara det i aratal – att marka det som en brist motsager
// hela produkten. Ar kvittot kopplat till en gruppering visas den som en dampad
// rad med namnet; ar det inte kopplat visas ingen rad alls, inte "Inget".

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AterforKnapp } from "./aterfor-knapp";
import { Bilagor } from "./bilagor";
import { PrivatFalt } from "./privat-falt";
import { SEKUNDARKNAPP_KLASS, Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { listaKostnadsbilagor } from "@/lib/lagring/bilagor";
import { enkelPrivatUppdelning } from "@/lib/kostnadsuppdelning";
import { formateraKronor, isoDatum, orenTillFalt } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function KostnadSida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { bostadId } = await kravBostad();

  const kostnad = await prisma.kostnad.findFirst({
    where: { id, bostad_id: bostadId },
    include: {
      rader: {
        include: { fordelningar: { include: { projekt: true } } },
      },
    },
  });
  if (!kostnad) notFound();

  // Ett utkast har inga uppgifter att visa – dess plats ar kompletteringsformularet.
  if (kostnad.totalbelopp === null) redirect(`/kostnad/nytt?utkast=${kostnad.id}`);

  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
  });
  const { bostadsnamn } = bostadHeader(bostad);

  const bilagor = await listaKostnadsbilagor(kostnad.id);

  // Grupperingen (om nagon) – bara namnet, ingen kategori, ingen status.
  const grupperingar = [
    ...new Map(
      kostnad.rader
        .flatMap((r) => r.fordelningar)
        .filter((f) => f.projekt)
        .map((f) => [f.projekt!.id, f.projekt!.namn]),
    ).values(),
  ];

  const anteckning = kostnad.anteckning?.trim();
  // Utkast har redirectats bort ovan – har ar leverantor, datum och belopp satta.
  const datum = kostnad.betaldatum ?? kostnad.dokumentdatum;

  // Privatfaltet (produktspec 5, "Kostnadsrad") later bara kostnader i den
  // kanoniska formen – null betyder ett genuint flerprojektfall som bara gar
  // att andra via uppdelningsvyn (/dela).
  const privatDel = enkelPrivatUppdelning(tillDomanKostnad(kostnad));
  const privatFalt =
    privatDel && privatDel.privatbelopp > 0
      ? orenTillFalt(privatDel.privatbelopp)
      : "";

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik={anteckning || kostnad.leverantor || "Kvitto"}
      bakLank={{ href: "/kostnad", text: "Kvitton" }}
    >
      <section className="space-y-2 border-b border-linje p-4 font-granssnitt text-sm">
        <Rad
          etikett="Belopp"
          varde={formateraKronor(kostnad.totalbelopp ?? 0)}
        />
        <Rad etikett="Datum" varde={datum ? isoDatum(datum) : "–"} />
        <Rad etikett="Leverantör" varde={kostnad.leverantor ?? "–"} />
        {grupperingar.length > 0 ? (
          <p className="pt-1 text-text-dampad">
            Hör till {grupperingar.join(", ")}
          </p>
        ) : null}
      </section>

      {kostnad.arkiverad ? (
        <section className="border-b border-linje p-4">
          <p className="font-granssnitt text-sm text-text-sekundar">
            Det här kvittot hör inte till bostaden. Bild och belopp ligger kvar.
          </p>
          <AterforKnapp kostnadId={kostnad.id} />
        </section>
      ) : null}

      <Bilagor kostnadId={kostnad.id} bilagor={bilagor} />

      <div className="flex flex-col gap-2 border-t border-linje p-4">
        <Link
          href={`/kostnad/${kostnad.id}/redigera`}
          className={SEKUNDARKNAPP_KLASS}
        >
          Ändra uppgifter
        </Link>
        {!privatDel ? (
          <Link
            href={`/kostnad/${kostnad.id}/dela`}
            className={SEKUNDARKNAPP_KLASS}
          >
            Var något på kvittot privat?
          </Link>
        ) : null}
      </div>

      {privatDel ? (
        <PrivatFalt kostnadId={kostnad.id} forvalt={privatFalt} />
      ) : null}
    </Skarm>
  );
}

function Rad({ etikett, varde }: { etikett: string; varde: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-text-dampad">{etikett}</span>
      <span className="text-right text-text-primar">{varde}</span>
    </div>
  );
}
