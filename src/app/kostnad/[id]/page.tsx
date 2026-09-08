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
import { aterforTillGenomgang } from "./actions";
import { Bilagor } from "./bilagor";
import { SEKUNDARKNAPP_KLASS, Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { listaKostnadsbilagor } from "@/lib/lagring/bilagor";
import { formateraKronor, isoDatum } from "@/lib/format";
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
            Det här kvittot räknas inte med i underlaget. Bild och belopp ligger
            kvar.
          </p>
          <form action={aterforTillGenomgang} className="mt-2">
            <input type="hidden" name="kostnad_id" value={kostnad.id} />
            <button
              type="submit"
              className="font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar"
            >
              Ta tillbaka till genomgången
            </button>
          </form>
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
        <Link
          href={`/kostnad/${kostnad.id}/dela`}
          className={SEKUNDARKNAPP_KLASS}
        >
          Var något på kvittot privat?
        </Link>
      </div>
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
