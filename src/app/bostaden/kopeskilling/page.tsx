// Fragan om kopeskillingen, fran startsidans kort (docs/design.md,
// "Onboardingen fortsätter på startsidan"). Obligatorisk har, och faltet
// sager varfor.

import { Skarm } from "@/components/skarm";
import { UPPGIFTENS_TEXT } from "@/lib/bostadsuppgifter";
import { formateraBeloppInmatning } from "@/lib/format";
import { KopeskillingFormular } from "../formular";
import { TILL_OVERSIKTEN, lasFragesidan } from "../sida";

export const metadata = { title: "Köpeskillingen" };

export const dynamic = "force-dynamic";

export default async function KopeskillingSida() {
  const { bostad, bostadsnamn } = await lasFragesidan();
  const forval =
    bostad.kopeskilling === null ? "" : formateraBeloppInmatning(String(bostad.kopeskilling / 100n));
  return (
    <Skarm bostadsnamn={bostadsnamn} rubrik={UPPGIFTENS_TEXT.kopeskilling.fraga} bakLank={TILL_OVERSIKTEN}>
      <KopeskillingFormular forval={forval} />
    </Skarm>
  );
}
