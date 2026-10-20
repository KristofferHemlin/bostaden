// Fragesidans tomma lage: inget projekt vantar pa fragor. Det betyder inte att
// man ar klar – kvitton kan ligga kvar i fas 1, annu inte ihoplagda, och dem
// ser man inte harifran. Uppmatt i produktionen 2026-10-19: "Inget väntar på
// frågor" stod som rubrik medan tva kvitton lag kvar. Rubriken ar det man
// laser, sa den sager vad som aterstar nar nagot gor det.

import Link from "next/link";
import { PRIMARKNAPP_KLASS, SEKUNDARKNAPP_KLASS } from "@/components/skarm";

export function FragorTomtLage({ kvarAttLaggaIhop }: { kvarAttLaggaIhop: number }) {
  if (kvarAttLaggaIhop > 0) {
    // Vagen framat ar fas 1, sa den ar primarknappen (docs/design.md, "Orange
    // markerar att man gar framat").
    return (
      <div className="p-5">
        <p className="font-rubrik text-lg text-text-primar">
          {`${kvarAttLaggaIhop} ${kvarAttLaggaIhop === 1 ? "kvitto" : "kvitton"} kvar att lägga ihop`}
        </p>
        <p className="mt-1 font-granssnitt text-sm text-text-sekundar">
          Frågorna om det du lagt ihop är besvarade. Lägg ihop det som är kvar,
          så kommer frågorna om det.
        </p>
        <Link href="/genomgang" className={`${PRIMARKNAPP_KLASS} mt-4`}>
          Lägg ihop kvitton
        </Link>
        <Link href="/" className={`${SEKUNDARKNAPP_KLASS} mt-2`}>
          Till översikten
        </Link>
      </div>
    );
  }
  return (
    <div className="p-5">
      <p className="font-rubrik text-lg text-text-primar">Inget väntar på frågor</p>
      <p className="mt-1 font-granssnitt text-sm text-text-sekundar">
        Du har svarat på frågorna om allt du lagt ihop. Kvitton du lägger in
        senare dyker upp här när du kommer tillbaka.
      </p>
      <Link href="/" className={`${PRIMARKNAPP_KLASS} mt-4`}>
        Till översikten
      </Link>
      <Link href="/genomgang" className={`${SEKUNDARKNAPP_KLASS} mt-2`}>
        Lägg ihop fler kvitton
      </Link>
    </div>
  );
}
