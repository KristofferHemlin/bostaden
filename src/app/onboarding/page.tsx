// Steg 3: onboarding. Guard – ingen session -> /login, redan en bostad -> /.

import { redirect } from "next/navigation";
import { OnboardingForm } from "./form";
import { hamtaAktivBostad, kravAnvandare } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function OnboardingSida() {
  await kravAnvandare();
  const bostad = await hamtaAktivBostad();
  if (bostad) redirect("/");

  return (
    <div className="min-h-screen w-full bg-yta-bas">
      <main className="mx-auto w-full max-w-[430px] px-4 py-12">
        <header className="mb-4 px-1">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3.5 w-3.5 rounded-[4px] bg-accent"
            />
            <h1 className="font-rubrik text-2xl text-text-primar">
              Lägg upp din bostad
            </h1>
          </div>
          <p className="mt-1 pl-6 font-granssnitt text-sm text-text-dampad">
            Två uppgifter räcker för att komma igång. Resten fyller du i när du
            vill.
          </p>
        </header>

        <div className="overflow-hidden rounded-xl bg-yta-upphojd">
          <OnboardingForm />
        </div>
      </main>
    </div>
  );
}
