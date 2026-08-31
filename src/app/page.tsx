// Steg 6-vyn (oversikt), men nu mot riktig data for den inloggade anvandarens
// bostad i stallet for seed. Ingen inmatning har – bara lasning och lankar
// vidare. All berakning bor i src/doman; har komponeras den bara.
// Struktur och farger: docs/design.md. Innehall: produktspec.md avsnitt 7.

import Link from "next/link";
import { loggaUt } from "@/app/login/actions";
import {
  Listrad,
  Meddelanderuta,
  PRIMARKNAPP_KLASS,
  SEKUNDARKNAPP_KLASS,
  Skarm,
} from "@/components/skarm";
import {
  bidragForKostnad,
  harledUnderlagsstyrka,
  kalenderAr,
  reduktionsfaktor,
  troskelgrundandeArsbelopp,
  troskelUppnadd,
} from "@/doman/berakningar";
import { slaUppRegelparameter } from "@/doman/regelparameter";
import { bostadHeader } from "@/lib/bostad-header";
import { hamtaBostadsdata } from "@/lib/doman-fran-db";
import { formateraKronor } from "@/lib/format";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Oversikt() {
  const { bostadId } = await kravBostad();
  const { bostad, projekt, projektRader, kostnader, regelparametrar } =
    await hamtaBostadsdata(bostadId);
  const { bostadsnamn, andrarad } = bostadHeader(bostad);

  const VISAT_AR = new Date().getUTCFullYear();
  const inomVisatAr = (betaldatum: string | null) =>
    betaldatum !== null && kalenderAr(betaldatum) === VISAT_AR;

  const insamlingslage = bostad.upplatelseform === "fastighet";

  const troskelbelopp = slaUppRegelparameter(
    regelparametrar,
    "troskelbelopp",
    `${VISAT_AR}-12-31`,
  );
  const reparationsfonsterAr = slaUppRegelparameter(
    regelparametrar,
    "reparationsfonster_ar",
    `${VISAT_AR}-12-31`,
  );

  const arsunderlag = troskelgrundandeArsbelopp({ kostnader, projekt }, VISAT_AR);
  const naddTroskel = troskelUppnadd(arsunderlag, troskelbelopp);
  const aterstaende = Math.max(0, troskelbelopp - arsunderlag);
  const fyllnadsgrad = Math.min(100, (arsunderlag / troskelbelopp) * 100);

  // Okopplat: den del av radernas belopp som varken fordelats till ett projekt
  // eller markerats som privat. Reduktionsfaktorn ateranvands sa att ROT och
  // forsakringsersattning behandlas som i arssumman (produktspec 5, 6.3).
  let okopplat = 0;
  for (const kostnad of kostnader) {
    if (kostnad.arkiverad || !inomVisatAr(kostnad.betaldatum)) continue;
    const faktor = reduktionsfaktor(kostnad);
    for (const rad of kostnad.rader) {
      const fordelad = rad.fordelningar.reduce((s, f) => s + f.andel, 0);
      okopplat += rad.belopp * Math.max(0, 1 - fordelad) * faktor;
    }
  }
  okopplat = Math.round(okopplat);

  const projektlista = projekt.map((p, i) => {
    let belopp = 0;
    for (const kostnad of kostnader) {
      if (kostnad.arkiverad || !inomVisatAr(kostnad.betaldatum)) continue;
      belopp += bidragForKostnad(kostnad, p.id);
    }
    const svagt = harledUnderlagsstyrka(p) === "svagt";
    const kategoriText =
      p.kategori === "grundforbattring" ? "Grundförbättring" : "Reparation";
    return {
      id: p.id,
      namn: p.namn,
      ar: projektRader[i].ar,
      belopp,
      status: svagt ? `${kategoriText} · underlag saknas` : kategoriText,
      atgard: svagt,
    };
  });

  const tomt = projekt.length === 0 && kostnader.length === 0;

  return (
    <Skarm bostadsnamn={bostadsnamn} andrarad={andrarad} rubrik="Översikt">
      {tomt ? (
        <div className="p-5">
          <p className="font-rubrik text-lg text-text-primar">
            Lägg till din första kostnad
          </p>
          <p className="mt-1 font-granssnitt text-sm text-text-dampad">
            Samla kvitton medan de är färska. Klassificeringen kan vänta – att
            fånga utgiften är det bråttom med.
          </p>
          <Link href="/projekt/nytt" className={`${PRIMARKNAPP_KLASS} mt-4`}>
            Skapa projekt
          </Link>
          <Link href="/kostnad/nytt" className={`${SEKUNDARKNAPP_KLASS} mt-2`}>
            Lägg till kostnad
          </Link>
        </div>
      ) : (
        <>
          {insamlingslage ? (
            <div className="border-b border-linje p-4">
              <Meddelanderuta>
                Fastighetsreglerna är inte implementerade ännu. Kostnader,
                projekt och årssummor fungerar, men klassificeringsförslag,
                avdragsstatus och export är avstängda.
              </Meddelanderuta>
            </div>
          ) : null}

          {/* Metrikblock: arets underlag mot 5 000-troskeln */}
          <section className="border-b border-linje p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-granssnitt text-sm text-text-dampad">
                Underlag {VISAT_AR}
              </span>
              <span className="font-rubrik text-2xl tabular-nums text-text-primar">
                {formateraKronor(arsunderlag)}
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-yta-nedsankt">
              <div
                className={`h-full rounded-full ${
                  naddTroskel ? "bg-accent" : "bg-sand-mork"
                }`}
                style={{ width: `${fyllnadsgrad.toFixed(2)}%` }}
              />
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3 font-granssnitt text-xs tabular-nums text-text-dampad">
              <span>Tröskel {formateraKronor(troskelbelopp)}</span>
              <span>
                {naddTroskel
                  ? "tröskeln nådd"
                  : `${formateraKronor(aterstaende)} kvar`}
              </span>
            </div>
            {!naddTroskel ? (
              <p className="mt-2 font-granssnitt text-xs text-text-dampad">
                Under tröskeln ger året 0 kr i avdrag – hela årets belopp faller
                bort, inte bara mellanskillnaden.
              </p>
            ) : null}
          </section>

          {/* Okopplat belopp – doljs helt nar det ar noll */}
          {okopplat > 0 ? (
            <section className="border-b border-linje p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-granssnitt text-base text-text-primar">
                  Oklassificerat
                </span>
                <span className="font-rubrik text-base tabular-nums text-text-primar">
                  {formateraKronor(okopplat)}
                </span>
              </div>
              <p className="mt-0.5 font-granssnitt text-sm text-text-dampad">
                Räknas in i underlaget först när det kopplats till ett projekt.
              </p>
            </section>
          ) : null}

          {/* Projektlista */}
          <div className="divide-y divide-linje border-b border-linje">
            {projektlista.length === 0 ? (
              <p className="p-4 font-granssnitt text-sm text-text-dampad">
                Inga projekt än.
              </p>
            ) : (
              projektlista.map((r) => (
                <Listrad
                  key={r.id}
                  href={`/projekt/${r.id}`}
                  namn={r.namn}
                  status={r.status}
                  atgard={r.atgard}
                  belopp={formateraKronor(r.belopp)}
                />
              ))
            )}
          </div>

          {/* Femarshorisonten */}
          <section className="border-b border-linje p-4">
            <p className="font-granssnitt text-sm text-text-dampad">
              Reparationer du betalar {VISAT_AR} räknas med vid en försäljning
              fram till {VISAT_AR + reparationsfonsterAr}.
            </p>
          </section>

          <div className="flex flex-col gap-2 p-4">
            <Link href="/kostnad/nytt" className={PRIMARKNAPP_KLASS}>
              Lägg till kostnad
            </Link>
            <Link href="/projekt" className={SEKUNDARKNAPP_KLASS}>
              Alla projekt
            </Link>
            {!insamlingslage ? (
              <Link href="/export" className={SEKUNDARKNAPP_KLASS}>
                Deklarationsunderlag
              </Link>
            ) : null}
          </div>
        </>
      )}

      <div className="flex items-center justify-between border-t border-linje p-4">
        <Link
          href="/installningar"
          className="font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar"
        >
          Inställningar
        </Link>
        <form action={loggaUt}>
          <button
            type="submit"
            className="font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar"
          >
            Logga ut
          </button>
        </form>
      </div>
    </Skarm>
  );
}
