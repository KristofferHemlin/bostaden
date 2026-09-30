// Registreringsflodet (docs/design.md, Registreringsflodet). Ett eget flode, inte
// inloggningsformularet med en extra knapp.
//
// Guard:
//  - inloggad med bostad      -> /  (inget att gora har)
//  - inloggad utan bostad     -> utestaende inbjudningar till adressen, om
//                                sadana finns; annars bara bostadssteget
//  - ingen session            -> hela flodet: konto (e-post + losenord), bostad
//  - ingen session, ?inbjudan -> bara kontot; bostaden finns redan
//
// Den som registrerar sig via en inbjudan ansluts till den befintliga bostaden
// i stallet for att skapa en egen (docs/design.md, "Att bjuda in en
// delagare"). Den som loggar in utan att ga via koden hamnar ocksa har, via
// startskarmen, och ser inbjudan anda – den ar en post, inte en lank.
//
// Ersatter den tidigare /onboarding-sidan.

import Link from "next/link";
import { redirect } from "next/navigation";
import { hamtaInbjudningsvy, utestaendeInbjudningar } from "@/lib/inbjudan";
import { hamtaAktivBostad, hamtaAnvandare } from "@/lib/session";
import { AnslutKnapp } from "@/app/inbjudan/anslut-knapp";
import { Inbjudningskort } from "@/app/inbjudan/inbjudningskort";
import { RegistreraFlode } from "./flode";

export const dynamic = "force-dynamic";

export default async function RegistreraSida({
  searchParams,
}: {
  searchParams: Promise<{ inbjudan?: string; egen?: string }>;
}) {
  const { inbjudan: inbjudanId, egen } = await searchParams;
  const anvandare = await hamtaAnvandare();
  let endastBostad = false;

  if (anvandare) {
    const bostad = await hamtaAktivBostad();
    if (bostad) redirect("/");
    endastBostad = true;

    const inbjudningar = egen ? [] : await utestaendeInbjudningar(anvandare.epost);
    if (inbjudningar.length > 0) {
      return (
        <Ram rubrik="Du är inbjuden" underrad="Anslut till en bostad som redan finns i appen.">
          {inbjudningar.map((vy) => (
            <div key={vy.id} className="border-b border-linje p-5 last:border-b-0">
              <Inbjudningskort vy={vy}>
                <AnslutKnapp inbjudanId={vy.id} />
              </Inbjudningskort>
            </div>
          ))}
          <div className="p-5 pt-0">
            <Link
              href="/registrera?egen=1"
              className="font-granssnitt text-sm text-text-sekundar underline underline-offset-2 hover:text-text-primar"
            >
              Lägg upp en egen bostad i stället
            </Link>
          </div>
        </Ram>
      );
    }
  }

  // Via koden, utan konto: bara kontosteget, med adressen inbjudan galler.
  if (!anvandare && inbjudanId) {
    const vy = await hamtaInbjudningsvy(inbjudanId);
    if (vy && vy.status === "utestaende") {
      return (
        <Ram rubrik="Skapa konto" underrad={`Sedan ansluts du till ${vy.bostadsnamn}.`}>
          <RegistreraFlode inbjudan={{ id: vy.id, epost: vy.epost }} />
        </Ram>
      );
    }
  }

  return (
    <Ram
      rubrik={endastBostad ? "Lägg upp din bostad" : "Skapa konto"}
      underrad={
        endastBostad
          ? "Sista steget innan du kommer igång."
          : "Två korta steg: konto och din bostad."
      }
    >
      <RegistreraFlode endastBostad={endastBostad} />
    </Ram>
  );
}

function Ram({
  rubrik,
  underrad,
  children,
}: {
  rubrik: string;
  underrad: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-yta-bas">
      <main className="mx-auto w-full max-w-[430px] px-4 py-12">
        <header className="mb-6 px-1">
          {/* Ingen orange markor har – i registreringen bar den aktiva
              forloppspricken och primarknappen den enda oranga betydelsen. */}
          <h1 className="font-rubrik text-2xl text-text-primar">{rubrik}</h1>
          <p className="mt-1 font-granssnitt text-sm text-text-sekundar">{underrad}</p>
        </header>

        <div className="overflow-hidden rounded-xl border border-linje bg-yta-upphojd">
          {children}
        </div>
      </main>
    </div>
  );
}
