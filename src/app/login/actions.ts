"use server";

// Inloggning via Supabase Auth. Tva satt pa samma sida: e-post + losenord som
// forsta vag, magisk lank som alternativ (produktspec steg 2 – "bara fungerande",
// ingen registreringsdesign). En enda action-ingang; knappen satter faltet
// "avsikt".

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { skapaServerklient } from "@/lib/supabase/server";

export interface AuthResultat {
  fel?: string;
  meddelande?: string;
}

function las(formData: FormData, nyckel: string): string {
  return String(formData.get(nyckel) ?? "").trim();
}

export async function hanteraAuth(
  _foreg: AuthResultat,
  formData: FormData,
): Promise<AuthResultat> {
  const avsikt = las(formData, "avsikt");
  const epost = las(formData, "epost");
  const losenord = String(formData.get("losenord") ?? "");
  const supabase = await skapaServerklient();

  if (avsikt === "magisk-lank") {
    if (!epost) return { fel: "Fyll i din e-postadress." };
    const origin = (await headers()).get("origin") ?? "";
    const { error } = await supabase.auth.signInWithOtp({
      email: epost,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    if (error) return { fel: oversattFel(error.message) };
    return { meddelande: `En inloggningslänk är på väg till ${epost}.` };
  }

  if (avsikt === "skapa-konto") {
    if (!epost || losenord.length < 8) {
      return { fel: "Lösenordet måste vara minst 8 tecken." };
    }
    const { data, error } = await supabase.auth.signUp({
      email: epost,
      password: losenord,
    });
    if (error) return { fel: oversattFel(error.message) };
    if (data.session) redirect("/");
    return {
      meddelande: "Konto skapat. Bekräfta via mejlet vi skickat, logga sedan in.",
    };
  }

  // avsikt === "logga-in" (default)
  if (!epost || !losenord) {
    return { fel: "Fyll i både e-post och lösenord." };
  }
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
    return "Ingen kontakt med inloggningstjänsten. Kontrollera att NEXT_PUBLIC_SUPABASE_* är ifyllda.";
  }
  return meddelande;
}
