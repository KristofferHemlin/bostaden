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
// Bostadssteget har fem falt: upplatelseform, tilltradesdatum, adress, ort och
// kopeskilling. Endast de tva forsta ar obligatoriska. Storlek hor hemma pa
// installningssidan (docs/design.md, Registreringsflodet), inte har.

import { redirect } from "next/navigation";
import { oreFranKronor } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { hamtaAnvandare, sakerstallAnvandarrad } from "@/lib/session";
import { skapaServerklient } from "@/lib/supabase/server";
import { tolkaGeokod } from "./koordinater";

export interface RegistreringResultat {
  fel?: string;
  meddelande?: string;
  // Fas 1 lyckades – klienten gar vidare till steg 2 och bar med authId.
  kontoSkapat?: boolean;
  authId?: string;
  harSession?: boolean;
  // E-postadressen ar upptagen – klienten visar en knapp till inloggningen.
  epostUpptagen?: boolean;
  epost?: string;
}

const GILTIGA_FORMER = new Set(["bostadsratt", "fastighet"]);
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
// Undre grans: regelparametrarna seedas med giltig_fran 1970-01-01.
const TIDIGASTE_TILLTRADE = "1970-01-01";
const EPOST = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
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
  const adress = las(formData, "adress");
  const ort = las(formData, "ort");
  const kopeskillingText = las(formData, "kopeskilling");
  // Adressfaltet ar alltid fritext. Kom place_id + koordinater med fran ett valt
  // Places-forslag sparas de, annars sparas adressen som den ar med falten null.
  const geokod = tolkaGeokod(
    las(formData, "place_id"),
    las(formData, "latitud"),
    las(formData, "longitud"),
  );

  if (!GILTIGA_FORMER.has(upplatelseform)) {
    return { fel: "Välj bostadsrätt eller villa/radhus." };
  }
  if (!DATUM.test(tilltradesdatum)) {
    return { fel: "Fyll i tillträdesdatum." };
  }
  if (tilltradesdatum < TIDIGASTE_TILLTRADE) {
    return { fel: "Tillträdesdatum före 1970 stöds inte." };
  }

  // Kopeskilling ar valfri (docs/design.md, Registreringsflodet). Anges i kronor
  // i faltet, lagras som heltal oren.
  let kopeskilling: number | null = null;
  if (kopeskillingText !== "") {
    kopeskilling = oreFranKronor(kopeskillingText);
    if (kopeskilling === null || kopeskilling <= 0) {
      return { fel: "Köpeskilling anges som ett belopp, t.ex. 3 250 000." };
    }
  }

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
      adress: adress || null,
      ort: ort || null,
      place_id: geokod.place_id,
      latitud: geokod.latitud,
      longitud: geokod.longitud,
      kopeskilling,
      upplatelseform: upplatelseform as "bostadsratt" | "fastighet",
      tilltradesdatum: new Date(`${tilltradesdatum}T00:00:00.000Z`),
      medlemskap: { create: { anvandare_id: authId, agarandel: 100 } },
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
  if (!EPOST.test(epost)) {
    return { fel: "Fyll i en giltig e-postadress." };
  }
  if (losenord.length < 8) {
    return { fel: "Lösenordet måste vara minst 8 tecken." };
  }

  const supabase = await skapaServerklient();
  const { data, error } = await supabase.auth.signUp({
    email: epost,
    password: losenord,
  });
  if (error) {
    return {
      fel: oversattFel(error.message),
      epostUpptagen: arUpptagen(error.message),
      epost,
    };
  }

  // Supabase svarar med en attrapp-anvandare utan identiteter nar adressen
  // redan har ett konto (skydd mot adressgissning) – behandla som upptagen.
  if (!data.user || (data.user.identities?.length ?? 0) === 0) {
    return {
      fel: "E-postadressen har redan ett konto. Logga in i stället.",
      epostUpptagen: true,
      epost,
    };
  }

  await sakerstallAnvandarrad(data.user.id, epost);
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
    return "Ingen kontakt med inloggningstjänsten. Kontrollera att NEXT_PUBLIC_SUPABASE_* är ifyllda.";
  }
  return meddelande;
}
