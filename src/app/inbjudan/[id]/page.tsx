// Sidan bakom QR-koden och lanken (docs/design.md, "Att bjuda in en
// delagare"). Oskyddad: den ska ga att oppna utan konto.
//
// Sidan bevisar forst vem inbjudan kommer fran och vad den innebar, och forst
// darefter finns nagot att trycka pa. Vilken utgang som visas avgors NAR
// SIDAN OPPNAS, inte nar koden skapades – annars blir koden fel byggd om den
// inbjudna hinner skapa konto under tiden:
//
//   utan session, adressen har konto -> Logga in for att ansluta
//   utan session, inget konto         -> Skapa konto
//   inloggad med fel adress           -> ett besked om varfor, och utloggning
//   inloggad, har redan en bostad     -> en bostad per person i dag
//   inloggad, ratt adress, ingen bostad -> Anslut till bostaden
//
// Id:t i adressen ar ingen nyckel. Att losa in kraver att man ar inloggad med
// adressen inbjudan stallts till (src/lib/inbjudan.ts).

import Link from "next/link";
import { loggaUt } from "@/app/login/actions";
import { Meddelanderuta, PRIMARKNAPP_KLASS, SEKUNDARKNAPP_KLASS } from "@/components/skarm";
import {
  type Inbjudningsvy,
  hamtaInbjudningsvy,
  inbjudenHarKonto,
  inlosenFeltext,
  normaliseraEpost,
} from "@/lib/inbjudan";
import { hamtaAktivBostad, hamtaAnvandare } from "@/lib/session";
import { AnslutKnapp } from "../anslut-knapp";
import { Inbjudningskort } from "../inbjudningskort";

export const dynamic = "force-dynamic";

export default async function InbjudanSida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vy = await hamtaInbjudningsvy(id);
  const innehall = vy ? (
    await utgang(vy)
  ) : (
    <Meddelanderuta>{inlosenFeltext("finns_inte")}</Meddelanderuta>
  );

  return (
    <div className="min-h-screen w-full bg-yta-bas">
      <main className="mx-auto w-full max-w-[430px] px-4 py-12">
        <header className="mb-6 px-1">
          <h1 className="font-rubrik text-2xl text-text-primar">Inbjudan</h1>
        </header>
        <div className="overflow-hidden rounded-xl border border-linje bg-yta-upphojd p-5">
          {innehall}
        </div>
      </main>
    </div>
  );
}

// En vanlig funktion, inte en komponent: utgangen avgors i sidans egen
// begaran, och det ar den som tester/inbjudan.test.ts laser av.
async function utgang(vy: Inbjudningsvy) {
  const anvandare = await hamtaAnvandare();

  if (vy.status !== "utestaende") {
    const medlem = anvandare ? (await hamtaAktivBostad()) !== null : false;
    return (
      <div className="flex flex-col gap-4">
        <Meddelanderuta>
          {inlosenFeltext(vy.status === "aterkallad" ? "aterkallad" : "redan_inlost")}
        </Meddelanderuta>
        {medlem ? (
          <Link href="/" className={SEKUNDARKNAPP_KLASS}>
            Till startsidan
          </Link>
        ) : null}
      </div>
    );
  }

  if (!anvandare) {
    const harKonto = await inbjudenHarKonto(vy.epost);
    return (
      <Inbjudningskort vy={vy}>
        {harKonto ? (
          <Link href={`/login?epost=${encodeURIComponent(vy.epost)}`} className={PRIMARKNAPP_KLASS}>
            Logga in för att ansluta
          </Link>
        ) : (
          <Link href={`/registrera?inbjudan=${vy.id}`} className={PRIMARKNAPP_KLASS}>
            Skapa konto
          </Link>
        )}
      </Inbjudningskort>
    );
  }

  if (normaliseraEpost(anvandare.epost) !== normaliseraEpost(vy.epost)) {
    return (
      <Inbjudningskort vy={vy}>
        <Meddelanderuta>{inlosenFeltext("fel_adress", vy.epost)}</Meddelanderuta>
        <form action={loggaUt}>
          <button type="submit" className={SEKUNDARKNAPP_KLASS}>
            Logga ut
          </button>
        </form>
      </Inbjudningskort>
    );
  }

  if ((await hamtaAktivBostad()) !== null) {
    return (
      <Inbjudningskort vy={vy}>
        <Meddelanderuta>{inlosenFeltext("har_bostad")}</Meddelanderuta>
        <Link href="/" className={SEKUNDARKNAPP_KLASS}>
          Till startsidan
        </Link>
      </Inbjudningskort>
    );
  }

  return (
    <Inbjudningskort vy={vy}>
      <AnslutKnapp inbjudanId={vy.id} />
    </Inbjudningskort>
  );
}
