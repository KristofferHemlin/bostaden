// Installningssidan (docs/design.md, "Installningssidan"). Allt som beskriver
// bostaden men inte behovs for att komma igang: storlek, kopeskilling,
// kopkostnader, agarandel, identifiering och – bara for bostadsratt –
// kapitaltillskott. Kopeskillingen gar aven att ange i registreringens
// bostadssteg. Nas via
// kugghjulet i navigationen. Langst ned ligger utloggningen, avskild med en
// linje – inte pa startskarmen.

import { loggaUt } from "@/app/login/actions";
import { SEKUNDARKNAPP_KLASS, Skarm } from "@/components/skarm";
import { bostadHeader } from "@/lib/bostad-header";
import { isoDatum } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";
import { ArkivexportKnapp } from "./arkivexport-knapp";
import { InstallningarForm } from "./form";

export const dynamic = "force-dynamic";

const grupperat = new Intl.NumberFormat("sv-SE");

// BigInt oren -> grupperad kronsträng utan ören. Heltalsdivisionen tappar inget;
// Intl.NumberFormat.format tar bigint direkt.
function kronor(oren: bigint | null): string {
  return oren != null ? grupperat.format(oren / 100n) : "";
}

export default async function InstallningarSida() {
  const { bostadId, agarandel } = await kravBostad();
  const bostad = await prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } });
  const { bostadsnamn } = bostadHeader(bostad);

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Inställningar"
      bakLank={{ href: "/", text: "Översikt" }}
    >
      <InstallningarForm
        upplatelseform={bostad.upplatelseform}
        sald={bostad.forsaljningsdatum != null}
        tilltradesdatum={isoDatum(bostad.tilltradesdatum)}
        storlek={bostad.storlek != null ? String(bostad.storlek) : ""}
        kopeskilling={kronor(bostad.kopeskilling)}
        kopkostnader={kronor(bostad.kopkostnader)}
        agarandel={agarandel === 100 ? "" : String(agarandel)}
        kapitaltillskott={kronor(bostad.kapitaltillskott)}
        identifiering={bostad.identifiering ?? ""}
      />

      {/* Arkivexport: laddar ner samtliga bilagor som ett zip-arkiv
          (docs/produktspec.md 12, "Arkivexport tidigt"). Avskild med en linje
          precis som utloggningen, men ligger ovanfor den – det ar en
          handling, inte en avslutning. */}
      <div className="flex flex-col gap-2 border-t border-linje p-5">
        <p className="font-granssnitt text-sm text-text-sekundar">
          Ladda ner alla dina kvitton och fakturor som ett zip-arkiv – till exempel
          om du vill ta med dig dokumentationen om du slutar använda tjänsten.
        </p>
        <ArkivexportKnapp />
      </div>

      {/* Utloggning: sekundarknapp langst ned, avskild med en linje
          (docs/design.md, "Installningssidan"). Egen server-action, darfor
          utanfor installningsformularet. */}
      <div className="border-t border-linje p-5">
        <form action={loggaUt}>
          <button type="submit" className={SEKUNDARKNAPP_KLASS}>
            Logga ut
          </button>
        </form>
      </div>
    </Skarm>
  );
}
