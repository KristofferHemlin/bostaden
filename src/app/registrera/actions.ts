"use server";

// Registreringsflodet (docs/design.md, Registreringsflodet): ett eget flode i tre
// steg – kontouppgifter, bostaden, losenord – inte inloggningsformularet med en
// extra knapp. Sista steget skapar bade Supabase-kontot och bostaden.
//
// Samma action tackar aven fallet "redan inloggad men utan bostad" (t.ex. via
// e-postlank): da hoppas kontoskapandet over och bara bostaden laggs upp.
//
// Bostadssteget har fyra falt: upplatelseform, tilltradesdatum, adress och ort.
// Endast de tva forsta ar obligatoriska. Storlek och kopeskilling hor hemma pa
// installningssidan (docs/design.md, Registreringsflodet), inte har.

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hamtaAnvandare, sakerstallAnvandarrad } from "@/lib/session";
import { skapaServerklient } from "@/lib/supabase/server";

export interface RegistreringResultat {
  fel?: string;
  meddelande?: string;
}

const GILTIGA_FORMER = new Set(["bostadsratt", "fastighet"]);
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
// Undre grans: regelparametrarna seedas med giltig_fran 1970-01-01.
const TIDIGASTE_TILLTRADE = "1970-01-01";
const EPOST = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function las(fd: FormData, nyckel: string): string {
  return String(fd.get(nyckel) ?? "").trim();
}

export async function slutforRegistrering(
  _foreg: RegistreringResultat,
  formData: FormData,
): Promise<RegistreringResultat> {
  // Bostadsfalten finns alltid i formularet.
  const upplatelseform = las(formData, "upplatelseform");
  const tilltradesdatum = las(formData, "tilltradesdatum");
  const adress = las(formData, "adress");
  const ort = las(formData, "ort");

  if (!GILTIGA_FORMER.has(upplatelseform)) {
    return { fel: "Välj bostadsrätt eller villa/radhus." };
  }
  if (!DATUM.test(tilltradesdatum)) {
    return { fel: "Fyll i tillträdesdatum." };
  }
  if (tilltradesdatum < TIDIGASTE_TILLTRADE) {
    return { fel: "Tillträdesdatum före 1970 stöds inte." };
  }

  // Redan inloggad (t.ex. via e-postlank)? Da skapar vi bara bostaden.
  const befintlig = await hamtaAnvandare();
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
    if (error) return { fel: oversattFel(error.message) };

    // Supabase svarar med en attrapp-anvandare utan identiteter nar adressen
    // redan har ett konto (skydd mot adressgissning) – behandla som upptagen.
    if (!data.user || (data.user.identities?.length ?? 0) === 0) {
      return { fel: "E-postadressen har redan ett konto. Logga in i stället." };
    }

    authId = data.user.id;
    harSession = Boolean(data.session);
    await sakerstallAnvandarrad(authId, epost);
  }

  await prisma.bostad.create({
    data: {
      adress: adress || null,
      ort: ort || null,
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

function oversattFel(meddelande: string): string {
  const m = meddelande.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) {
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
