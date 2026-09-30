"use server";

// Serveratgarder for inbjudan (docs/design.md, "Att bjuda in en delagare").
// Logiken bor i src/lib/inbjudan.ts; har kommer bara vem som ar inloggad och
// vilken bostad, alltid fran sessionen och medlemskapet – aldrig fran klienten.
//
// Ingenting skickas. Appen visar en QR-kod och en lank att kopiera, och den
// inbjudna hittar dessutom inbjudan pa sin startskarm nar hon loggar in med
// adressen.

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { serverfelMeddelande } from "@/lib/databas-fel";
import {
  aterkallaInbjudan,
  hamtaInbjudningsvy,
  inlosenFeltext,
  losInInbjudan,
  skapaInbjudan,
} from "@/lib/inbjudan";
import { hamtaAnvandare, kravAnvandare, kravBostad } from "@/lib/session";

export type InbjudanResultat =
  | { ok: true; lank: string; qrSvg: string; epost: string; harKonto: boolean }
  | { ok?: false; fel?: string };

/** Den publika adressen – bakom Vercels proxy ar Host deployets interna. */
async function publikBas(): Promise<string> {
  const h = await headers();
  const vard = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protokoll = h.get("x-forwarded-proto") ?? (vard.startsWith("localhost") ? "http" : "https");
  return `${protokoll}://${vard}`;
}

export async function skapaInbjudanAction(
  _foreg: InbjudanResultat,
  formData: FormData,
): Promise<InbjudanResultat> {
  const anvandare = await kravAnvandare();
  const { bostadId } = await kravBostad();

  try {
    const resultat = await skapaInbjudan({
      bostadId,
      anvandareId: anvandare.id,
      anvandarEpost: anvandare.epost,
      epost: String(formData.get("epost") ?? ""),
      egenAndel: String(formData.get("egen_andel") ?? ""),
      inbjudenAndel: String(formData.get("inbjuden_andel") ?? ""),
    });
    if (!resultat.ok) return { fel: resultat.fel };

    const lank = `${await publikBas()}/inbjudan/${resultat.inbjudanId}`;
    // Petrolbla pa kortets yta, samma som textfargen – kontrasten racker gott
    // for en kamera, och en vit ruta vore den enda vita ytan i appen.
    const qrSvg = await QRCode.toString(lank, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0c2430", light: "#faf6f0" },
    });

    revalidatePath("/installningar");
    revalidatePath("/export");
    return { ok: true, lank, qrSvg, epost: resultat.epost, harKonto: resultat.harKonto };
  } catch (fel) {
    return {
      fel: serverfelMeddelande(fel, {
        sida: "installningar",
        anrop: "skapaInbjudan",
        anvandareId: anvandare.id,
      }),
    };
  }
}

export async function aterkallaInbjudanAction(
  _foreg: { fel?: string },
  formData: FormData,
): Promise<{ fel?: string }> {
  const { bostadId, anvandareId } = await kravBostad();
  try {
    const { ok } = await aterkallaInbjudan({
      bostadId,
      inbjudanId: String(formData.get("inbjudan_id") ?? ""),
    });
    if (!ok) return { fel: "Inbjudan är redan använd eller återkallad." };
  } catch (fel) {
    return {
      fel: serverfelMeddelande(fel, { sida: "installningar", anrop: "aterkallaInbjudan", anvandareId }),
    };
  }
  revalidatePath("/installningar");
  return {};
}

export async function losInInbjudanAction(
  _foreg: { fel?: string },
  formData: FormData,
): Promise<{ fel?: string }> {
  const anvandare = await hamtaAnvandare();
  if (!anvandare) redirect("/login");

  const inbjudanId = String(formData.get("inbjudan_id") ?? "");
  let resultat;
  try {
    resultat = await losInInbjudan({
      inbjudanId,
      anvandareId: anvandare.id,
      anvandarEpost: anvandare.epost,
    });
  } catch (fel) {
    return {
      fel: serverfelMeddelande(fel, { sida: "inbjudan", anrop: "losInInbjudan", anvandareId: anvandare.id }),
    };
  }
  if (!resultat.ok) {
    // Fel adress: beskedet namner adressen inbjudan galler, sa att det gar att
    // forsta vad som ska goras – den star anda redan pa sidan.
    const vy = resultat.fel === "fel_adress" ? await hamtaInbjudningsvy(inbjudanId) : null;
    return { fel: inlosenFeltext(resultat.fel, vy?.epost) };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
