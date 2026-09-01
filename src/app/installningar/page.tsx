// Installningssidan. Bostadsuppgifter som inte behovs for att komma igang:
// storlek och kopeskilling. Kopeskillingen gar aven att ange i registreringens
// bostadssteg (docs/design.md, Registreringsflodet). Nas via kugghjulet i
// navigationen.

import { Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";
import { InstallningarForm } from "./form";

export const dynamic = "force-dynamic";

const grupperat = new Intl.NumberFormat("sv-SE");

export default async function InstallningarSida() {
  const { bostadId } = await kravBostad();
  const bostad = await prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } });
  const { bostadsnamn, andrarad } = bostadHeader(bostad);

  const storlek = bostad.storlek != null ? String(bostad.storlek) : "";
  const kopeskilling =
    bostad.kopeskilling != null
      ? grupperat.format(Math.round(bostad.kopeskilling / 100))
      : "";

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      andrarad={andrarad}
      rubrik="Inställningar"
      bakLank={{ href: "/", text: "Översikt" }}
    >
      <InstallningarForm storlek={storlek} kopeskilling={kopeskilling} />
    </Skarm>
  );
}
