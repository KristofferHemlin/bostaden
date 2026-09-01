// Registreringsflodet (docs/design.md, Registreringsflodet). Ett eget flode, inte
// inloggningsformularet med en extra knapp.
//
// Guard:
//  - inloggad med bostad      -> /  (inget att gora har)
//  - inloggad utan bostad     -> bara bostadssteget (t.ex. efter e-postlank)
//  - ingen session            -> hela flodet: konto (e-post + losenord), bostad
//
// Ersatter den tidigare /onboarding-sidan.

import { redirect } from "next/navigation";
import { hamtaAktivBostad, hamtaAnvandare } from "@/lib/session";
import { RegistreraFlode } from "./flode";

export const dynamic = "force-dynamic";

export default async function RegistreraSida() {
  const anvandare = await hamtaAnvandare();
  let endastBostad = false;

  if (anvandare) {
    const bostad = await hamtaAktivBostad();
    if (bostad) redirect("/");
    endastBostad = true;
  }

  return (
    <div className="min-h-screen w-full bg-yta-bas">
      <main className="mx-auto w-full max-w-[430px] px-4 py-12">
        <header className="mb-6 px-1">
          {/* Ingen orange markor har – i registreringen bar den aktiva
              forloppspricken och primarknappen den enda oranga betydelsen. */}
          <h1 className="font-rubrik text-2xl text-text-primar">
            {endastBostad ? "Lägg upp din bostad" : "Skapa konto"}
          </h1>
          <p className="mt-1 font-granssnitt text-sm text-text-dampad">
            {endastBostad
              ? "Sista steget innan du kommer igång."
              : "Två korta steg: konto och din bostad."}
          </p>
        </header>

        <div className="overflow-hidden rounded-xl bg-yta-upphojd">
          <RegistreraFlode endastBostad={endastBostad} />
        </div>
      </main>
    </div>
  );
}
