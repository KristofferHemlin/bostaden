// Kvittots skarm (docs/design.md, "Ett kvitto ar en skarm, inte tva"): lasläge
// och andringslage pa SAMMA rutt – rutten /redigera finns inte langre.
// Lasläget ar alltid utgangspunkten, sidan oppnas aldrig redigerbar. En dampad
// "Ändra" i sammanfattningens horn (i <KvittoKort>) gor sammanfattningen till
// ett formular med Spara och Avbryt PA PLATS, ingen navigering – se den
// filens kommentar for hela vaxlingen.
//
// Bilagan ligger overst i bagge lagena, i stor forhandsvisning
// (<Bilagor storForhandsvisning>). Ingen egen rubrik ovanfor:
// <Skarm> far ingen `rubrik`-prop har. Anteckningen ar ingen rubrik over
// bilden – den inleder i stallet sjalva sammanfattningen, tillsammans med
// belopp, datum och leverantor, och faller tillbaka pa leverantoren nar den
// saknas.
//
// Ingen statusrad, ingen projektrad, ingen prick: oklassificerad ar det
// normala tillstandet och kan vara det i aratal – att marka det som en brist
// motsager hela produkten. Ar kvittot kopplat till en gruppering visas den
// som en dampad rad med namnet; ar det inte kopplat visas ingen rad alls.
// Detsamma galler ett eventuellt privat belopp.

import { notFound, redirect } from "next/navigation";
import { KvittoKort } from "./kvitto-kort";
import { Skarm } from "@/components/skarm";
import { arEnkelKostnad } from "@/doman/berakningar";
import { bostadHeader } from "@/lib/bostad-header";
import { tillDomanKostnad } from "@/lib/doman-fran-db";
import { listaKostnadsbilagor } from "@/lib/lagring/bilagor";
import { enkelPrivatUppdelning } from "@/lib/kostnadsuppdelning";
import { formateraKronor, isoDatum, orenTillFalt } from "@/lib/format";
import { kvittodatumNotis } from "@/lib/kvittodatum-notis";
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

  const [kostnad, bostad, projekt] = await Promise.all([
    prisma.kostnad.findFirst({
      where: { id, bostad_id: bostadId },
      include: {
        rader: { include: { fordelningar: { include: { projekt: true } } } },
      },
    }),
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    prisma.projekt.findMany({
      where: { bostad_id: bostadId },
      orderBy: [{ ar: "desc" }, { skapad_at: "asc" }],
      select: { id: true, namn: true, ar: true },
    }),
  ]);
  if (!kostnad) notFound();

  // Ett utkast har inga uppgifter att visa – dess plats ar kompletteringsformularet.
  if (kostnad.totalbelopp === null) redirect(`/kostnad/nytt?utkast=${kostnad.id}`);

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

  // Kvittodatum utanfor innehavet (docs/design.md): provar dokumentdatumet,
  // aldrig betaldatumet – aven om raden ovan visar betaldatum i forsta hand.
  const kvittodatumNotisText = kostnad.dokumentdatum
    ? kvittodatumNotis(isoDatum(kostnad.dokumentdatum), {
        tilltradesdatum: isoDatum(bostad.tilltradesdatum),
        forsaljningsdatum: bostad.forsaljningsdatum
          ? isoDatum(bostad.forsaljningsdatum)
          : null,
      })
    : null;
  // Sammanfattningens ledande rad: anteckningen, annars leverantoren
  // (docs/design.md, "Kvittots detaljvy").
  const sammanfattningsnamn = anteckning || kostnad.leverantor || "Kvitto";

  const domanKostnad = tillDomanKostnad(kostnad);
  // Styr vilka falt andringslaget slapper fram: hela belopp-/ROT-/
  // projektgruppen (arEnkelKostnad) respektive privatfaltet (enkelPrivatUppdelning)
  // ar tva OLIKA, delvis overlappande villkor – en kostnad kan vara den
  // kanoniska tva-radiga privata uppdelningen (privatDel finns) utan att vara
  // "enkel" (en enda rad). Se kommentaren i kvitto-kort.tsx.
  const enkel = arEnkelKostnad(domanKostnad);
  const privatDel = enkelPrivatUppdelning(domanKostnad);

  const kopplatProjektId =
    kostnad.rader
      .flatMap((r) => r.fordelningar)
      .find((f) => !f.privat && f.projekt_id)?.projekt_id ?? "";

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      bakLank={{ href: "/kostnad", text: "Kvitton" }}
    >
      <KvittoKort
        kostnadId={kostnad.id}
        bilagor={bilagor}
        arkiverad={kostnad.arkiverad}
        enkel={enkel}
        projekt={projekt}
        lasVarden={{
          sammanfattningsnamn,
          belopp: formateraKronor(kostnad.totalbelopp),
          datum: datum ? isoDatum(datum) : "–",
          leverantor: kostnad.leverantor ?? "–",
          kvittodatumNotisText,
          grupperingar,
          privatbelopp:
            privatDel && privatDel.privatbelopp > 0
              ? formateraKronor(privatDel.privatbelopp)
              : null,
        }}
        redigeraVarden={{
          leverantor: kostnad.leverantor ?? "",
          totalbelopp: orenTillFalt(kostnad.totalbelopp),
          totalbeloppVisning: kostnad.totalbelopp,
          dokumentdatum: kostnad.dokumentdatum
            ? isoDatum(kostnad.dokumentdatum)
            : "",
          betaldatum: kostnad.betaldatum ? isoDatum(kostnad.betaldatum) : "",
          projektId: kopplatProjektId,
          rotUtnyttjat:
            kostnad.rot_utnyttjat !== null
              ? orenTillFalt(kostnad.rot_utnyttjat)
              : "",
          anteckning: kostnad.anteckning ?? "",
        }}
        innehav={{
          tilltradesdatum: isoDatum(bostad.tilltradesdatum),
          forsaljningsdatum: bostad.forsaljningsdatum
            ? isoDatum(bostad.forsaljningsdatum)
            : null,
        }}
        privatDel={
          privatDel
            ? {
                forvalt:
                  privatDel.privatbelopp > 0
                    ? orenTillFalt(privatDel.privatbelopp)
                    : "",
              }
            : null
        }
      />
    </Skarm>
  );
}
