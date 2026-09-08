// Steg 10: dela upp ett kvitto pa radniva (produktspec 5, 6.3 "Dela upp ar
// endast tillgangligt vid oppnad enskild post", 6.4). Varje rad far en artikel,
// ett belopp och ett mal – ett projekt, "privat" eller okopplat. Summan av
// radernas belopp maste vara lika med totalbeloppet; det valideras vid sparning.
// En redan uppdelad kostnad oppnas har med sina befintliga rader ifyllda.

import { notFound, redirect } from "next/navigation";
import { DelaUppForm } from "./form";
import { Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Oren -> ren kronsträng for inmatningsfaltet, t.ex. `102095` -> `"1020,95"`. */
function orenTillFalt(oren: number): string {
  return (oren / 100).toFixed(2).replace(".", ",");
}

/** Andel 0..1 -> procentsträng utan onodiga decimaler, t.ex. `0.6` -> `"60"`. */
function andelTillFalt(andel: number): string {
  return String(Math.round(andel * 10000) / 100);
}

export default async function DelaUppSida({
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
  // Ett utkast har inga rader att dela – det kompletteras i inmatningsformularet.
  if (kostnad.totalbelopp === null) redirect(`/kostnad/nytt?utkast=${id}`);

  const { bostadsnamn } = bostadHeader(bostad);

  // Utgangslaget: kostnadens befintliga rader. En kostnad har alltid minst en
  // rad; ar den odelad (en rad pa hela beloppet) far anvandaren en tom rad till
  // att borja fran, sa att formularet oppnar redo att dela.
  const befintliga = kostnad.rader.map((rad) => {
    const projektFordelning = rad.fordelningar.find(
      (f) => !f.privat && f.projekt_id,
    );
    const privat = rad.fordelningar.some((f) => f.privat);
    return {
      artikel: rad.artikel,
      belopp: orenTillFalt(rad.belopp),
      mal: privat ? "privat" : (projektFordelning?.projekt_id ?? ""),
      andel: projektFordelning ? andelTillFalt(Number(projektFordelning.andel)) : "",
    };
  });
  const startRader =
    befintliga.length >= 2
      ? befintliga
      : [...befintliga, { artikel: "", belopp: "", mal: "", andel: "" }];

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Dela upp kvittot"
      bakLank={{ href: `/kostnad/${id}`, text: kostnad.leverantor ?? "Kvitto" }}
    >
      <DelaUppForm
        kostnadId={id}
        totalbelopp={kostnad.totalbelopp}
        projekt={projekt}
        startRader={startRader}
      />
    </Skarm>
  );
}
