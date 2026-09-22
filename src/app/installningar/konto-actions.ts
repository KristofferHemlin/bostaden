"use server";

// Server action for kontoraderingen (produktspec avsnitt 14, "Kontoradering").
// Kraver att den inloggade skriver sin egen e-postadress som bekraftelse –
// kontrolleras har igen, aven om knappen i granssnittet redan ar avstangd tills
// den stammer. Appens enda oaterkalleliga atgard.

import { redirect } from "next/navigation";
import { raderaKonto } from "@/lib/konto/radera";
import { hamtaAnvandare } from "@/lib/session";
import { skapaServerklient } from "@/lib/supabase/server";

export interface KontoraderaResultat {
  fel?: string;
}

export async function raderaKontoAction(
  _foreg: KontoraderaResultat,
  formData: FormData,
): Promise<KontoraderaResultat> {
  const anvandare = await hamtaAnvandare();
  if (!anvandare) redirect("/login");

  const bekraftadEpost = String(formData.get("epost_bekraftelse") ?? "")
    .trim()
    .toLowerCase();
  if (bekraftadEpost !== anvandare.epost.trim().toLowerCase()) {
    return { fel: "E-postadressen stämmer inte." };
  }

  const resultat = await raderaKonto(anvandare.id);
  if (!resultat.ok) {
    return { fel: resultat.fel };
  }

  // Kontot ar redan borta i Auth har – signOut far inte blockera utloggningen
  // om anropet sjalvt klagar pa det.
  try {
    const supabase = await skapaServerklient();
    await supabase.auth.signOut();
  } catch {
    // ignoreras med flit
  }

  // Efter raderingen: utloggad, till inloggningssidan med ett kort besked
  // (produktspec 14).
  redirect("/login?kontoraderat=1");
}
