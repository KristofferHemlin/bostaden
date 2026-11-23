// Steg 5: manuell kostnadsinmatning.
//
// Ingen grind pa "har du ett projekt an?" – docs/design.md, "Projektet uppstar,
// det administreras inte": anvandaren ska aldrig behova skapa ett projekt som en
// egen uppgift innan ett kvitto kan laggas in.
//
// ?utkast=<id>: aterupptar ett utkast som skapades nar en fil valdes tidigare
// (avsnittet "Dokumentavlasning"). Bilagorna ar redan uppladdade; formularet
// visar dem och sparningen uppdaterar utkastet. Ar id:t inte ett utkast (redan
// slutfort) eller inte den har bostadens skickas anvandaren till kostnaden.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NyKostnadForm } from "./form";
import { Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { formateraBeloppInmatning, sparadDag, orenTillFalt } from "@/lib/format";
import { listaKostnadsbilagor } from "@/lib/lagring/bilagor";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

// Sidans titel ar rubriken: "Komplettera kvittot" for ett aterupptaget utkast.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ utkast?: string }>;
}): Promise<Metadata> {
  const { utkast } = await searchParams;
  return { title: utkast ? "Komplettera kvittot" : "Nytt kvitto" };
}

export default async function NyKostnadSida({
  searchParams,
}: {
  searchParams: Promise<{ utkast?: string }>;
}) {
  const { utkast: utkastId } = await searchParams;
  const { bostadId, antalBostader } = await kravBostad();

  const bostad = await prisma.bostad.findUniqueOrThrow({
    where: { id: bostadId },
  });
  const { bostadsnamn } = bostadHeader(bostad);

  let utkast:
    | {
        id: string;
        anteckning: string | null;
        falt: { belopp: string; datum: string; dokumentdatum: string; leverantor: string; rot: string };
        bilagor: Awaited<ReturnType<typeof listaKostnadsbilagor>>;
      }
    | undefined;

  if (utkastId) {
    const rad = await prisma.kostnad.findFirst({
      where: { id: utkastId, bostad_id: bostadId },
      select: {
        id: true,
        totalbelopp: true,
        anteckning: true,
        // Det hon skrivit i utkastet (docs/design.md, "Ett kvittoutkast minns
        // det hon skrev") – sparat lopande av formularet, sparaUtkastfalten.
        utkast_belopp: true,
        leverantor: true,
        dokumentdatum: true,
        betaldatum: true,
        rot_utnyttjat: true,
      },
    });
    if (!rad) notFound();
    // Redan slutfort – vidare till den vanliga detaljvyn.
    if (rad.totalbelopp !== null) redirect(`/kostnad/${rad.id}`);
    utkast = {
      id: rad.id,
      anteckning: rad.anteckning,
      // Samma form som falten har i formularet, sa att det hon ser vid
      // aterkomsten ar det hon skrev.
      falt: {
        belopp: rad.utkast_belopp === null ? "" : formateraBeloppInmatning(orenTillFalt(rad.utkast_belopp)),
        // Formularets datumfalt ar betaldatumet. Dokumentdatumet foljer med
        // bara nar det skiljer sig – annars ar det samma dag (form.tsx,
        // `dokumentdatum`).
        datum: rad.betaldatum ? sparadDag(rad.betaldatum) : "",
        dokumentdatum:
          rad.dokumentdatum && sparadDag(rad.dokumentdatum) !== (rad.betaldatum ? sparadDag(rad.betaldatum) : "")
            ? sparadDag(rad.dokumentdatum)
            : "",
        leverantor: rad.leverantor ?? "",
        rot: rad.rot_utnyttjat === null ? "" : formateraBeloppInmatning(orenTillFalt(rad.rot_utnyttjat)),
      },
      bilagor: await listaKostnadsbilagor(rad.id),
    };
  }

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik={utkast ? "Komplettera kvittot" : "Nytt kvitto"}
    >
      <NyKostnadForm
        utkast={utkast}
        // Formularet bar bostaden det visas for, och namnger den nar det
        // finns fler an en (docs/design.md, "Att äga flera bostäder").
        bostad={{ id: bostadId, namn: antalBostader > 1 ? bostadsnamn : null }}
        innehav={{
          tilltradesdatum: sparadDag(bostad.tilltradesdatum),
          forsaljningsdatum: bostad.forsaljningsdatum
            ? sparadDag(bostad.forsaljningsdatum)
            : null,
        }}
      />
    </Skarm>
  );
}
