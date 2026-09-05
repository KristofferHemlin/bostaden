"use server";

// Steg 5 + produktspec 2b + docs/design.md ("Inmatningen staller inga
// skattefragor", "Uppdelning av kvitto vid inmatning"). Manuell
// kostnadsinmatning: belopp, datum, leverantor och den valfria anteckningen
// "Vad gallde det?". Inga skattefragor, ingen kategori, inget projekt skapas har
// – klassificeringen gors i en egen genomgang.
//
// Projektkoppling ar en genvag, inte vagen in. `projekt_id` (om satt) kopplar
// kostnaden till en BEFINTLIG gruppering. Nya grupperingar skapas inte harifran.
//
// Uppdelning. "Var nagot pa kvittot privat?" faller ut rader i samma formular.
// Inga procenttal: en rad ar antingen privat (rad_privat) eller sparas mot
// malet. Utan uppdelning skapas EN rad pa hela totalbeloppet, med artikelnamnet
// satt till leverantoren (produktspec 5: "En rad skapas alltid"). Med uppdelning
// gar samma vag som steg 10:s dela-sida via tolkaUppdelning – summan av radernas
// belopp maste vara lika med totalbeloppet.
//
// Aret bestams av betaldatum, aldrig av dokumentdatum. En kostnad utan
// betaldatum sparas anda (obetald, raknas inte in) – inga floden far blockera.
//
// Steg 9: valfria bilagor laddas upp EFTER att kostnaden sparats och bekraftas
// mot Storage innan flodet gar vidare till startskarmen. En fil utan bilaga ar
// inget fel; en misslyckad uppladdning blockerar inte (kostnaden ar redan
// sparad) utan ger ett meddelande och en lank for att forsoka igen.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { laddaUppKostnadsbilaga } from "@/lib/lagring/bilagor";
import { oreFranKronor } from "@/lib/format";
import {
  inlineUppdelningTillIndata,
  tolkaUppdelning,
  type InlineUppdelningsrad,
} from "@/lib/kostnadsuppdelning";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export interface KostnadResultat {
  fel?: string;
  /** Satt nar kostnaden sparades men en bilaga inte gick att ladda upp – ger
   *  formularet en vag vidare till kostnaden for att forsoka igen. */
  kostnadId?: string;
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
// Undre grans: regelparametrarna seedas med giltig_fran 1970-01-01. En kostnad
// med betaldatum fore dess avvisas har i stallet for att berakningen kastar fel.
const TIDIGASTE_BETALDATUM = "1970-01-01";

export async function skapaKostnad(
  _foreg: KostnadResultat,
  formData: FormData,
): Promise<KostnadResultat> {
  const { bostadId } = await kravBostad();

  const leverantor = String(formData.get("leverantor") ?? "").trim();
  const beloppText = String(formData.get("totalbelopp") ?? "");
  const dokumentdatum = String(formData.get("dokumentdatum") ?? "");
  const betaldatum = String(formData.get("betaldatum") ?? "").trim();
  const anteckning = String(formData.get("anteckning") ?? "").trim();

  const projektId = String(formData.get("projekt_id") ?? "").trim();

  if (!leverantor) return { fel: "Fyll i leverantör." };

  const totalbelopp = oreFranKronor(beloppText);
  if (totalbelopp === null || totalbelopp <= 0) {
    return { fel: "Fyll i ett belopp större än noll, t.ex. 1 020,95." };
  }
  if (!DATUM.test(dokumentdatum)) {
    return { fel: "Fyll i kvittots datum." };
  }
  if (betaldatum !== "") {
    if (!DATUM.test(betaldatum)) return { fel: "Betaldatum har fel format." };
    if (betaldatum < TIDIGASTE_BETALDATUM) {
      return { fel: "Betaldatum före 1970 stöds inte." };
    }
  }

  // Kopplingen ar valfri och bara till en BEFINTLIG gruppering (genvag langst ned
  // i formularet). Ingen koppling = okopplad kostnad, vilket far vara – inget
  // flode blockerar och klassificeringen gors senare.
  let befintligtProjektId: string | null = null;
  if (projektId !== "") {
    const projekt = await prisma.projekt.findFirst({
      where: { id: projektId, bostad_id: bostadId },
      select: { id: true },
    });
    if (!projekt) return { fel: "Det du valde att koppla kostnaden till finns inte längre." };
    befintligtProjektId = projekt.id;
  }

  // Malet raderna kopplas till: befintligt id eller tomt (okopplat).
  const malForRader = befintligtProjektId ?? "";
  const harKoppling = befintligtProjektId !== null;

  // Uppdelningsraderna – bara med nar "Var något på kvittot privat?" var utfälld
  // och minst en rad har innehåll.
  const radArtiklar = formData.getAll("rad_artikel").map(String);
  const radBelopp = formData.getAll("rad_belopp").map(String);
  const radPrivat = formData.getAll("rad_privat").map(String);
  const harUppdelning = radArtiklar.length > 0;

  // Domanens radform. Utan uppdelning: en rad på hela beloppet med artikeln satt
  // till leverantoren. Med uppdelning: via tolkaUppdelning, samma invarianter
  // som steg 10:s dela-sida.
  interface RadUtkast {
    artikel: string;
    belopp: number;
    fordelningar: { projekt_id: string | null; privat: boolean; andel: number }[];
  }
  let raderUtkast: RadUtkast[];

  if (harUppdelning) {
    const inlineRader: InlineUppdelningsrad[] = radArtiklar.map((artikel, i) => ({
      artikel,
      belopp: radBelopp[i] ?? "",
      privat: (radPrivat[i] ?? "") !== "",
    }));
    const tolkad = tolkaUppdelning(
      inlineUppdelningTillIndata(inlineRader, malForRader),
      totalbelopp,
    );
    if ("fel" in tolkad) return { fel: tolkad.fel };
    raderUtkast = tolkad.rader.map((r) => ({
      artikel: r.artikel,
      belopp: r.belopp,
      fordelningar: r.fordelningar,
    }));
  } else {
    raderUtkast = [
      {
        artikel: leverantor,
        belopp: totalbelopp,
        fordelningar: harKoppling
          ? [{ projekt_id: malForRader, privat: false, andel: 1 }]
          : [],
      },
    ];
  }

  const dok = new Date(`${dokumentdatum}T00:00:00.000Z`);
  const bet = betaldatum ? new Date(`${betaldatum}T00:00:00.000Z`) : null;

  const skapad = await prisma.kostnad.create({
    data: {
      bostad_id: bostadId,
      leverantor,
      totalbelopp,
      dokumentdatum: dok,
      betaldatum: bet,
      anteckning: anteckning || null,
      rader: {
        create: raderUtkast.map((rad) => ({
          artikel: rad.artikel,
          belopp: rad.belopp,
          fordelningar: rad.fordelningar.length
            ? {
                create: rad.fordelningar.map((f) => ({
                  projekt_id: f.projekt_id,
                  privat: f.privat,
                  andel: f.andel,
                })),
              }
            : undefined,
        })),
      },
    },
    select: { id: true },
  });

  // Bilagor bekraftas alltid mot Storage innan flodet gar vidare. Misslyckas en
  // uppladdning ar kostnaden anda sparad (inga floden far blockera) – anvandaren
  // far ett meddelande och en lank for att forsoka igen fran kostnaden, och
  // filen ligger kvar i formularets input tills dess.
  const filer = formData
    .getAll("bilagor")
    .filter((f): f is File => f instanceof File && f.size > 0);
  for (const fil of filer) {
    const resultat = await laddaUppKostnadsbilaga({
      bostadId,
      kostnadId: skapad.id,
      fil,
    });
    if (!resultat.ok) {
      return {
        fel: `Kostnaden sparades, men ${fil.name || "en bilaga"} kunde inte laddas upp: ${resultat.fel ?? "okänt fel."}`,
        kostnadId: skapad.id,
      };
    }
  }

  // Efter sparning gar flodet till startskarmen, inte till detaljvyn
  // (docs/design.md, "Kvittots detaljvy"): den som just sparat vill se att
  // kvittot kom fram och kunna lagga in nasta. Det ligger overst i listan dar.
  revalidatePath("/");
  redirect("/");
}
