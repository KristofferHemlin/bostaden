// Fragan om adressen, fran startsidans kort (docs/design.md, "Onboardingen
// fortsätter på startsidan"). Forst i den fasta ordningen: en inbjudan
// matchas mot adressen.

import { Skarm } from "@/components/skarm";
import { UPPGIFTENS_TEXT } from "@/lib/bostadsuppgifter";
import { AdressFormular } from "../formular";
import { TILL_OVERSIKTEN, lasFragesidan } from "../sida";

export const metadata = { title: "Adressen" };

export const dynamic = "force-dynamic";

export default async function AdressSida() {
  const { bostad, bostadsnamn } = await lasFragesidan();
  return (
    <Skarm bostadsnamn={bostadsnamn} rubrik={UPPGIFTENS_TEXT.adress.fraga} bakLank={TILL_OVERSIKTEN}>
      <AdressFormular forval={{ adress: bostad.adress ?? "", ort: bostad.ort ?? "" }} />
    </Skarm>
  );
}
