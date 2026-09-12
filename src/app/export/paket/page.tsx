// Bilagepaketet som PDF (docs/produktspec.md avsnitt 8, "Bilagepaketet som
// PDF"; docs/design.md, "Exportvyn"). Nas via knappen under summorna pa
// /export, som ar otillganglig fore forsaljning – den har sidan skyddar sig
// darfor ocksa mot en direkt begaran innan bostaden ar sald.
//
// Sidan visar forst kompletteringssteget (agarandel och tilltradesdatum ar
// harda krav, identifiering ar mjuk och gar att hoppa over) och bygger sedan
// sjalva PDF:en i webblasaren, se ./flode.tsx.

import { redirect } from "next/navigation";
import { Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { isoDatum } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";
import { BilagepaketFlode } from "./flode";

export const dynamic = "force-dynamic";

export default async function BilagepaketSida() {
  const { bostadId, agarandel } = await kravBostad();
  const bostad = await prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } });

  // Knappen pa /export ar redan otillganglig fore forsaljning – detta ar ett
  // andra skydd mot en direkt lank.
  if (!bostad.forsaljningsdatum) redirect("/export");

  const { bostadsnamn } = bostadHeader(bostad);

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Bilagepaket"
      bakLank={{ href: "/export", text: "Deklarationsunderlag" }}
    >
      <BilagepaketFlode
        agarandel={String(agarandel)}
        tilltradesdatum={isoDatum(bostad.tilltradesdatum)}
        identifiering={bostad.identifiering ?? ""}
        upplatelseform={bostad.upplatelseform}
      />
    </Skarm>
  );
}
