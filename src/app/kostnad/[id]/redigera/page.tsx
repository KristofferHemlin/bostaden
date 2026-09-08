// Redigera en sparad kostnad (produktspec 6.4). Leverantor, kvittots datum och
// betaldatum gar alltid att andra. Belopp och projektkoppling gar att andra nar
// kostnaden ar "enkel" – en rad pa hela beloppet med hogst en fordelning; en
// uppdelad kostnad andras per rad i ett senare steg. Har ligger ocksa
// borttagningen av hela kostnaden, med bekraftelsesteg.

import { notFound, redirect } from "next/navigation";
import { RedigeraKostnadForm } from "./form";
import { Skarm } from "@/components/skarm";
import { arEnkelKostnad } from "@/doman/berakningar";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { isoDatum } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Oren -> ren kronsträng for inmatningsfaltet, t.ex. `102095` -> `"1020,95"`. */
function orenTillFalt(oren: number): string {
  return (oren / 100).toFixed(2).replace(".", ",");
}

export default async function RedigeraKostnadSida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { bostadId } = await kravBostad();

  const [kostnad, bostad, projekt] = await Promise.all([
    prisma.kostnad.findFirst({
      where: { id, bostad_id: bostadId },
      include: { rader: { include: { fordelningar: true } } },
    }),
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    prisma.projekt.findMany({
      where: { bostad_id: bostadId },
      orderBy: [{ ar: "desc" }, { skapad_at: "asc" }],
      select: { id: true, namn: true, ar: true },
    }),
  ]);
  if (!kostnad) notFound();
  // Ett utkast kompletteras i inmatningsformularet, inte i redigeringen.
  if (kostnad.totalbelopp === null) redirect(`/kostnad/nytt?utkast=${id}`);

  const { bostadsnamn } = bostadHeader(bostad);
  const enkel = arEnkelKostnad(tillDomanKostnad(kostnad));

  // Nuvarande projektkoppling: for en enkel kostnad ar det hogst ett projekt.
  const kopplatProjektId =
    kostnad.rader
      .flatMap((r) => r.fordelningar)
      .find((f) => !f.privat && f.projekt_id)?.projekt_id ?? "";

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Ändra kvitto"
      bakLank={{ href: `/kostnad/${id}`, text: kostnad.leverantor ?? "Kvitto" }}
    >
      <RedigeraKostnadForm
        kostnadId={id}
        enkel={enkel}
        projekt={projekt}
        varden={{
          leverantor: kostnad.leverantor ?? "",
          totalbelopp: orenTillFalt(kostnad.totalbelopp),
          totalbeloppVisning: kostnad.totalbelopp,
          dokumentdatum: kostnad.dokumentdatum
            ? isoDatum(kostnad.dokumentdatum)
            : "",
          betaldatum: kostnad.betaldatum ? isoDatum(kostnad.betaldatum) : "",
          projektId: kopplatProjektId,
        }}
      />
    </Skarm>
  );
}
