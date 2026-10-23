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
//   inloggad, redan medlem i bostaden -> ett besked, och vagen till startsidan
//   inloggad, ratt adress             -> Anslut till bostaden
//
// Den som redan har andra bostader ansluts som alla andra – de ligger kvar och
// nas i vaxlaren (docs/design.md, "Att äga flera bostäder").
//
// Id:t i adressen ar ingen nyckel. Att losa in kraver att man ar inloggad med
// adressen inbjudan stallts till (src/lib/inbjudan.ts).

import type { Metadata } from "next";
import Link from "next/link";
import { TJANSTENS_NAMN } from "@/lib/kontakt";
import { EpostLank } from "@/components/epost-lank";
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

// Lanken ar gjord for att skickas vidare, ofta i en chatt som fler ser
// (docs/design.md, "Ikoner, delning och metadata"). Forhandsvisningen ar
// darfor `Kvittobo` och ingenting mer – inte bostadens adress, inte den
// inbjudnas e-post, inte vem som bjudit in, och inte heller ordet "inbjudan".
// Metadatan ar statisk med flit: den laser aldrig inbjudan.
// tester/publika-sidor.test.ts faller om den borjar bara nagot av det.
//
// Ingen beskrivning: rotens text beskriver produkten och hade varit ofarlig,
// men regeln ar "ingenting mer". Sokmotorer haller sig borta – brodtexten
// bar adressen (src/app/robots.ts forbjuder dessutom rutten).
//
// Inget eget `openGraph`: ett sadant ersatter rotens helt, och da forsvinner
// delningsbilden (src/app/opengraph-image.jpg) – uppmatt 2026-10-23. og:title
// fylls i ur titeln ovan.
export const metadata: Metadata = {
  title: { absolute: TJANSTENS_NAMN },
  description: null,
  robots: { index: false, follow: false },
};

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
          // Adressen foljer med i flikens tillstand, aldrig i lankens URL
          // (src/lib/epost-for-fliken.ts).
          <EpostLank href="/login" epost={vy.epost} className={PRIMARKNAPP_KLASS}>
            Logga in för att ansluta
          </EpostLank>
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

  const aktiv = await hamtaAktivBostad();
  if (aktiv?.bostader.some((b) => b.id === vy.bostadId)) {
    return (
      <Inbjudningskort vy={vy}>
        <Meddelanderuta>{inlosenFeltext("redan_medlem")}</Meddelanderuta>
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
