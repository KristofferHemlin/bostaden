"use server";

// Inloggning via Supabase Auth: e-post + losenord. Att skapa konto ar ett eget
// flode (/registrera), och glomt losenord likasa (/losenord/glomt).
//
// Inloggning med e-postlank (signInWithOtp) togs bort 2026-10-01
// (docs/design.md, Inloggningssidan) – den fungerade inte, och en vag in som
// inte fungerar ar samre an ingen. Grenen ar borta ur actionen och inte bara ur
// granssnittet, sa att den inte heller nas med en handskriven begaran. Rutten
// som tar emot lankar (/auth/callback) ligger kvar: aterstallningsmejlet landar
// dar. Ska e-postlanken tillbaka finns den i git-historiken.

import { redirect } from "next/navigation";
import { INGEN_KONTAKT_MED_INLOGGNINGEN } from "@/lib/inloggning";
import { inloggningensFel } from "@/lib/inloggningsfalt";
import { skapaServerklient } from "@/lib/supabase/server";

export interface AuthResultat {
  fel?: string;
  /** Faltet felet galler – meningen star da vid det (docs/design.md). Fel
   *  e-post eller losenord galler inget enskilt falt: vilket det ar sags
   *  medvetet inte. */
  falt?: "epost" | "losenord";
}

function las(formData: FormData, nyckel: string): string {
  return String(formData.get(nyckel) ?? "").trim();
}

export async function hanteraAuth(
  _foreg: AuthResultat,
  formData: FormData,
): Promise<AuthResultat> {
  const epost = las(formData, "epost");
  const losenord = String(formData.get("losenord") ?? "");

  // Samma regler och samma meningar som formularet (src/lib/inloggningsfalt.ts).
  const faltfel = inloggningensFel(formData);
  if (faltfel) return faltfel;

  const supabase = await skapaServerklient();
  const { error } = await supabase.auth.signInWithPassword({
    email: epost,
    password: losenord,
  });
  if (error) return { fel: oversattFel(error.message) };
  redirect("/");
}

export async function loggaUt(): Promise<void> {
  const supabase = await skapaServerklient();
  await supabase.auth.signOut();
  redirect("/login");
}

function oversattFel(meddelande: string): string {
  const m = meddelande.toLowerCase();
  if (m.includes("invalid login credentials")) return "Fel e-post eller lösenord.";
  if (m.includes("already registered")) {
    return "E-postadressen har redan ett konto. Logga in i stället.";
  }
  if (m.includes("email not confirmed")) {
    return "E-postadressen är inte bekräftad än. Kolla mejlen.";
  }
  if (m.includes("supabase") || m.includes("fetch")) {
    console.error(`Inloggningstjänsten gick inte att nå: ${meddelande}`);
    return INGEN_KONTAKT_MED_INLOGGNINGEN;
  }
  return meddelande;
}
