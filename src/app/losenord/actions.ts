"use server";

// Glomt losenord (docs/design.md, Inloggningssidan). Supabase inbyggda
// aterstallning – ingen egen e-posttjanst. Tva steg:
//
// 1. begarAterstallning: skickar mejlet. Svaret ar ALLTID detsamma, oavsett om
//    adressen finns. Supabase svarar sjalvt likadant for okanda adresser, men
//    sparren mellan tva mejl till samma anvandare och utskicksgransen kan bara
//    sla till for en adress som har ett konto – ett eget felbesked for dem
//    skulle avsloja just det. De rapporteras darfor till Sentry (utan adress)
//    och besvaras som allt annat. Enda undantaget ar nar inloggningstjansten
//    inte gar att na alls: det beror inte pa adressen, och att da pasta att
//    ett mejl ar pa vag vore fel.
//
// 2. sattNyttLosenord: lanken i mejlet har via /auth/callback redan gett en
//    session. Har satts bara losenordet, med samma krav som vid registreringen,
//    och personen skickas till sin startskarm – inloggad.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { rapporteraFel } from "@/lib/feltrapportering";
import { LOSENORD_MINSTA_LANGD, losenordsfel } from "@/lib/losenord";
import { skapaServerklient } from "@/lib/supabase/server";

export interface GlomtResultat {
  fel?: string;
  /** Satt nar begaran ar besvarad – beskedet ar detsamma vad adressen an ar. */
  skickatTill?: string;
}

export interface NyttLosenordResultat {
  fel?: string;
  /** Ingen session att satta losenordet pa – lanken ar anvand eller for gammal. */
  lankOgiltig?: boolean;
}

interface AuthFel {
  name?: string;
  status?: number;
  code?: string;
  message?: string;
}

const INGEN_KONTAKT = "Ingen kontakt med inloggningstjänsten. Försök igen om en stund.";

// AuthRetryableFetchError (status 0) ar natverksfel – begaran nadde aldrig fram.
function arNatverksfel(fel: AuthFel): boolean {
  return fel.name === "AuthRetryableFetchError" || fel.status === 0;
}

export async function begarAterstallning(
  _foreg: GlomtResultat,
  formData: FormData,
): Promise<GlomtResultat> {
  const epost = String(formData.get("epost") ?? "").trim();
  if (!epost) return { fel: "Fyll i din e-postadress." };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await skapaServerklient();
  const { error } = await supabase.auth.resetPasswordForEmail(epost, {
    redirectTo: `${origin}/auth/callback?next=/losenord/nytt`,
  });

  if (error) {
    const fel = error as AuthFel;
    if (arNatverksfel(fel)) return { fel: INGEN_KONTAKT };
    // Bara felkoden – aldrig adressen (produktspec, felrapportering).
    rapporteraFel(new Error(`resetPasswordForEmail: ${fel.code ?? fel.status ?? "okant"}`), {
      sida: "losenord/glomt",
      anrop: "begarAterstallning",
    });
  }

  return { skickatTill: epost };
}

export async function sattNyttLosenord(
  _foreg: NyttLosenordResultat,
  formData: FormData,
): Promise<NyttLosenordResultat> {
  const losenord = String(formData.get("losenord") ?? "");
  const svagt = losenordsfel(losenord);
  if (svagt) return { fel: svagt };

  const supabase = await skapaServerklient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { lankOgiltig: true };

  const { error } = await supabase.auth.updateUser({ password: losenord });
  if (error) {
    const fel = error as AuthFel;
    if (arNatverksfel(fel)) return { fel: INGEN_KONTAKT };
    if (fel.code === "same_password") {
      return { fel: "Det nya lösenordet måste vara ett annat än det gamla." };
    }
    if (fel.code === "weak_password") {
      return { fel: `Lösenordet godtogs inte. Välj ett annat, minst ${LOSENORD_MINSTA_LANGD} tecken.` };
    }
    if (fel.code === "session_not_found" || fel.code === "session_expired" || fel.status === 401) {
      return { lankOgiltig: true };
    }
    rapporteraFel(new Error(`updateUser: ${fel.code ?? fel.status ?? "okant"}`), {
      sida: "losenord/nytt",
      anrop: "sattNyttLosenord",
      anvandareId: user.id,
    });
    return { fel: "Lösenordet kunde inte sparas. Försök igen." };
  }

  redirect("/");
}
