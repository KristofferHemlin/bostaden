"use server";

// Registreringsflodet (docs/design.md, Registreringsflodet): ett eget flode i tva
// steg – konto (e-post + losenord) och bostaden – inte inloggningsformularet med
// en extra knapp.
//
// Kontot skapas nar STEG 1 skickas. Ordningen ar avgorande: ligger losenordet
// sist far den som anger en redan registrerad e-postadress veta det forst efter
// att ha fyllt i hela bostaden. Med kontot i steg 1 kommer felet pa forsta
// knapptrycket, efter tva falt, och da med en knapp till inloggningen.
//
// Samma action tackar bagge stegen (faltet `fas`) och dessutom fallet "redan
// inloggad men utan bostad" (t.ex. via e-postlank): da hoppas fas 1 over och
// bara bostaden laggs upp.
//
// Fas 1 lamnar tillbaka authId + harSession till klienten, som bar dem vidare i
// dolda falt till fas 2. Utan e-postbekraftelse finns ingen session att lasa
// authId ur i fas 2, sa den maste folja med formularet.
//
// Bostadssteget har tva falt, bada obligatoriska: upplatelseform och
// tilltradesdatum – utan dem finns ingen berakning. Adress, ort och
// kopeskilling lag har till 2026-10-28 och fragas nu fran kortet pa
// startsidan, ett svar i taget (docs/design.md, "Onboardingen fortsätter på
// startsidan"; src/app/bostaden). Toppraden faller tillbaka pa "Lägenheten"
// eller "Huset" tills adressen finns (src/lib/bostad-header.ts).
//
// Identifieringen (foreningens namn/fastighetsbeteckningen) frågas INTE har
// (produktspec 8/4.1): den behovs forst pa bilagepaketets forsattssida, och
// paketet ar dolt bakom en flagga. Kompletteringssteget som annars skulle
// fraga efter den kors aldrig medan flaggan ar av – ett falt till i ett
// avsiktligt kort flode for att avhjalpa ett problem som uppstar langt
// senare vore fel avvagning. Fältet finns kvar, oforandrat, i installningarna.

import { redirect } from "next/navigation";
import { isoDatum } from "@/lib/format";
import { INGEN_KONTAKT_MED_INLOGGNINGEN } from "@/lib/inloggning";
import { prisma } from "@/lib/prisma";
import { hamtaAnvandare, sakerstallAnvandarrad } from "@/lib/session";
import { skapaServerklient } from "@/lib/supabase/server";
import {
  bostadsstegetsFel,
  kontostegetsFel,
  type Registreringsfalt,
} from "./validering";

export interface RegistreringResultat {
  fel?: string;
  /** Faltet felet galler – meningen star da vid det, med aria-invalid och
   *  bindning (docs/design.md, "När ett formulär vägrar"). */
  falt?: Registreringsfalt;
  meddelande?: string;
  // Fas 1 lyckades – klienten gar vidare till steg 2 och bar med authId.
  kontoSkapat?: boolean;
  authId?: string;
  harSession?: boolean;
  // E-postadressen ar upptagen – klienten visar en knapp till inloggningen.
  epostUpptagen?: boolean;
  epost?: string;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function las(fd: FormData, nyckel: string): string {
  return String(fd.get(nyckel) ?? "").trim();
}

export async function slutforRegistrering(
  _foreg: RegistreringResultat,
  formData: FormData,
): Promise<RegistreringResultat> {
  const befintlig = await hamtaAnvandare();

  // ---- STEG 1: skapa kontot -------------------------------------------------
  // Hoppas over om anvandaren redan ar inloggad (t.ex. via e-postlank).
  if (!befintlig && las(formData, "fas") === "konto") {
    return skapaKonto(formData);
  }

  // ---- STEG 2: spara bostaden ---------------------------------------------
  const upplatelseform = las(formData, "upplatelseform");
  const tilltradesdatum = las(formData, "tilltradesdatum");

  // Samma regler och samma meningar som formularet (./validering.ts).
  const faltfel = bostadsstegetsFel(formData, isoDatum(new Date()));
  if (faltfel) return faltfel;

  let authId: string;
  let harSession: boolean;

  if (befintlig) {
    authId = befintlig.id;
    harSession = true;
    const redan = await prisma.medlemskap.findFirst({
      where: { anvandare_id: authId },
      select: { id: true },
    });
    if (redan) redirect("/");
  } else {
    // Kontot skapades i steg 1; klienten bar authId hit i ett dolt falt.
    authId = las(formData, "authId");
    harSession = las(formData, "harSession") === "1";
    if (!UUID.test(authId)) {
      return { fel: "Kontot kunde inte kopplas. Börja om från steg 1." };
    }
    const anvandarrad = await prisma.anvandare.findUnique({
      where: { id: authId },
      select: { id: true },
    });
    if (!anvandarrad) {
      return { fel: "Kontot kunde inte kopplas. Börja om från steg 1." };
    }
  }

  await prisma.bostad.create({
    data: {
      upplatelseform: upplatelseform as "bostadsratt" | "fastighet",
      tilltradesdatum: new Date(`${tilltradesdatum}T00:00:00.000Z`),
      // Ingen agarandel: den fragas efter registreringen, och null betyder
      // inte angiven – aldrig 100 (CLAUDE.md, "Andelen ar null tills den
      // besvarats").
      medlemskap: { create: { anvandare_id: authId } },
    },
  });

  if (harSession) redirect("/");
  return {
    meddelande:
      "Kontot är skapat och bostaden sparad. Bekräfta din e-postadress via länken vi skickat och logga sedan in.",
  };
}

async function skapaKonto(formData: FormData): Promise<RegistreringResultat> {
  const epost = las(formData, "epost");
  const losenord = String(formData.get("losenord") ?? "");
  // Samma regler och samma meningar som formularet (./validering.ts).
  const faltfel = kontostegetsFel(formData);
  if (faltfel) return faltfel;

  const supabase = await skapaServerklient();
  const { data, error } = await supabase.auth.signUp({
    email: epost,
    password: losenord,
  });
  if (error) {
    const upptagen = arUpptagen(error.message);
    return {
      fel: oversattFel(error.message),
      // En upptagen adress galler e-postfaltet; ovriga fel fran
      // inloggningstjansten galler inget enskilt falt.
      falt: upptagen ? "epost" : undefined,
      epostUpptagen: upptagen,
      epost,
    };
  }

  // Supabase svarar med en attrapp-anvandare utan identiteter nar adressen
  // redan har ett konto (skydd mot adressgissning) – behandla som upptagen.
  if (!data.user || (data.user.identities?.length ?? 0) === 0) {
    return {
      fel: "E-postadressen har redan ett konto. Logga in i stället.",
      falt: "epost",
      epostUpptagen: true,
      epost,
    };
  }

  await sakerstallAnvandarrad(data.user.id, epost);

  // Via en inbjudan finns bostaden redan (docs/design.md, "Att bjuda in en
  // delagare"): inget bostadssteg. Med session vidare till inbjudan, dar
  // anslutningen ar ett eget, uttryckligt tryck. Utan session (e-post ska
  // bekraftas forst) vantar inbjudan pa startskarmen efter inloggningen.
  const inbjudanId = las(formData, "inbjudan_id");
  if (inbjudanId && UUID.test(inbjudanId)) {
    if (data.session) redirect(`/inbjudan/${inbjudanId}`);
    return {
      meddelande:
        "Kontot är skapat. Bekräfta din e-postadress via länken vi skickat och logga sedan in – inbjudan väntar på startsidan.",
    };
  }

  return {
    kontoSkapat: true,
    authId: data.user.id,
    harSession: Boolean(data.session),
    epost,
  };
}

function arUpptagen(meddelande: string): boolean {
  const m = meddelande.toLowerCase();
  return m.includes("already registered") || m.includes("already been registered");
}

function oversattFel(meddelande: string): string {
  const m = meddelande.toLowerCase();
  if (arUpptagen(meddelande)) {
    return "E-postadressen har redan ett konto. Logga in i stället.";
  }
  if (m.includes("password")) {
    return "Lösenordet uppfyller inte kraven – välj minst 8 tecken.";
  }
  if (m.includes("email") && m.includes("invalid")) {
    return "E-postadressen ser inte giltig ut.";
  }
  if (m.includes("supabase") || m.includes("fetch")) {
    console.error(`Inloggningstjänsten gick inte att nå: ${meddelande}`);
    return INGEN_KONTAKT_MED_INLOGGNINGEN;
  }
  return meddelande;
}
