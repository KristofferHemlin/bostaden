"use client";

// Faltets etikett for kontroller som har egna namn (docs/design.md, "De tre
// rutorna måste bära fältets namn"). Datumfaltets rutor heter "År", "Månad"
// och "Dag", och ett eget namn tar over etiketten runt dem: i
// tillganglighetstradet stod faltets namn ingenstans, och tva datumfalt i
// samma formular gick inte att skilja at. Falt ger darfor sin etikett vidare
// har, och varje ruta bar bada.
//
// Kontexten bor i en egen klientmodul sa att Falt kan fortsatta renderas
// varsomhelst – en server-komponent kan rendera en klientkomponent med barn.

import { createContext, useContext, type ReactNode } from "react";

const FaltEtikett = createContext<string | null>(null);

export function FaltEtikettGivare({ etikett, children }: { etikett: string; children: ReactNode }) {
  return <FaltEtikett.Provider value={etikett}>{children}</FaltEtikett.Provider>;
}

/** Etiketten pa det Falt kontrollen ligger i, eller null utanfor ett Falt. */
export function useFaltEtikett(): string | null {
  return useContext(FaltEtikett);
}

/** En dels namn i ett falt: "Betaldatum, år". Utanfor ett Falt bara delen. */
export function delensNamn(etikett: string | null, del: string): string {
  return etikett ? `${etikett}, ${del.toLowerCase()}` : del;
}
