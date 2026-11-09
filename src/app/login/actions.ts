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

/** Vilket slags fel en avvisning var (docs/design.md, Inloggningssidan).
 *  Formularet tommer losenordet bara vid "uppgifter" – och laser det har,
 *  aldrig meningens text, som gar sonder forsta gangen nagon skriver om den.
 *    uppgifter – fel e-post eller losenord; losenordet kan ha varit fel
 *    kontakt   – inloggningstjansten svarade inte; losenordet var troligen ratt
 *    annat     – allt annat, ocksa faltfel och obekraftad adress */
export type AuthOrsak = "uppgifter" | "kontakt" | "annat";

export interface AuthResultat {
  fel?: string;
  /** Faltet felet galler – meningen star da vid det (docs/design.md). Fel
   *  e-post eller losenord galler inget enskilt falt: vilket det ar sags
   *  medvetet inte. */
  falt?: "epost" | "losenord";
  /** Satt vid varje avvisning. */
  orsak?: AuthOrsak;
  /** Adressen som skickades, tillbaka vid varje avvisning. Formularet
   *  nollstalls inte langre (src/lib/skicka-utan-nollstallning.ts), men
   *  adressen bar faltets defaultValue och star kvar om sidan renderas om.
   *  Losenordet kommer aldrig tillbaka. */
  epost?: string;
}

/** Det fel signInWithPassword returnerar (AuthError i @supabase/auth-js):
 *  `name` skiljer natverksfel (AuthRetryableFetchError) fran API-fel, och
 *  `code` ar API:ets felkod, nar den finns. */
interface Inloggningsfel {
  name?: string;
  message: string;
  status?: number;
  code?: string;
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
  if (faltfel) return { ...faltfel, orsak: "annat", epost };

  const supabase = await skapaServerklient();
  const { error } = await supabase.auth.signInWithPassword({
    email: epost,
    password: losenord,
  });
  if (error) return { ...oversattFel(error), epost };
  redirect("/");
}

export async function loggaUt(): Promise<void> {
  const supabase = await skapaServerklient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Reservmeningen for allt som inte ar oversatt (docs/design.md,
// Inloggningssidan: "Ingen engelska når användaren"). Originalet loggas i
// stallet for att visas.
const INLOGGNINGEN_GICK_INTE = "Det gick inte att logga in just nu. Försök igen om en stund.";

function oversattFel(fel: Inloggningsfel): { fel: string; orsak: AuthOrsak } {
  const m = fel.message.toLowerCase();
  if (fel.code === "invalid_credentials" || m.includes("invalid login credentials")) {
    return { fel: "Fel e-post eller lösenord.", orsak: "uppgifter" };
  }
  if (fel.code === "email_not_confirmed" || m.includes("email not confirmed")) {
    return { fel: "E-postadressen är inte bekräftad än. Kolla mejlen.", orsak: "annat" };
  }
  // Natverksfel och 5xx fran inloggningstjansten: supabase-js ger dem som
  // AuthRetryableFetchError. Ett 5xx utan JSON har statusraden som meddelande
  // ("Bad Gateway"), utan "fetch" i sig – darfor namnet och inte bara texten.
  if (fel.name === "AuthRetryableFetchError" || m.includes("supabase") || m.includes("fetch")) {
    console.error(`Inloggningstjänsten gick inte att nå: ${fel.message}`);
    return { fel: INGEN_KONTAKT_MED_INLOGGNINGEN, orsak: "kontakt" };
  }
  console.error(
    `Inloggningen avvisades med ett oöversatt fel: ${fel.name ?? "okänt"} ${fel.status ?? "-"} ${fel.code ?? "-"}: ${fel.message}`,
  );
  return { fel: INLOGGNINGEN_GICK_INTE, orsak: "annat" };
}
