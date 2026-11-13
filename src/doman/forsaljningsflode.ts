// Ordningen i forsaljningsflodet (produktspec 4.1, "De ställs först av allt
// vid försäljningen, och ordningen är härledd"):
//
//   1. Forsaljningsdatumet          /forsaljning
//   2. Bostadsfragorna              /forsaljning/bostaden
//   3. Skicket vid forsaljningen    /forsaljning/skick
//   4. Samma byggnadsdel            /forsaljning/samma-del
//   5. Agarandelen bekraftas        /forsaljning/andel
//   6. Underlaget                   /export
//
// Varje steg gar till det forsta steget efter sig som galler bostaden. Ett
// steg som inte kan andra nagot hoppas over: bostadsfragor som redan ar
// besvarade, skick nar reparationsgrenen ar slackt eller allt redan ar
// bedomt, samma del nar fragan inte kan andra ett tal, en andel som redan ar
// bekraftad. Ordningen bor har och ingen annanstans, sa att den inte kan
// glida isar mellan stegens egna omdirigeringar.
//
// Ren doman: lagets fakta hamtas av src/lib/forsaljningsflode.ts.

export type Forsaljningssteg = "bostadsfragor" | "skick" | "samma_del" | "andel" | "export";

/** Stegen i ordning, efter forsaljningsdatumet. */
export const FORSALJNINGSSTEG: readonly Forsaljningssteg[] = [
  "bostadsfragor",
  "skick",
  "samma_del",
  "andel",
  "export",
];

export const FORSALJNINGSSTEG_SIDA: Record<Forsaljningssteg, string> = {
  bostadsfragor: "/forsaljning/bostaden",
  skick: "/forsaljning/skick",
  samma_del: "/forsaljning/samma-del",
  andel: "/forsaljning/andel",
  export: "/export",
};

export interface Forsaljningslage {
  /** Bostadsfragorna har ett svar for varje fraga som galler bostaden. */
  bostadsfragorBesvarade: boolean;
  /** Bostaden var nybyggd vid forvarvet och kom inte ur en ombildning –
   *  reparationsgrenen ar slackt (src/doman/bostadsfragor.ts). */
  reparationsgrenenSlackt: boolean;
  /** Minst en atgard med reparationsdel saknar skicket vid forsaljningen. */
  skickAttBedoma: boolean;
  /** Fragan om samma del kan andra ett tal (src/doman/samma-del.ts). */
  sammaDelVisas: boolean;
  /** Den egna andelen ar bekraftad. */
  andelBekraftad: boolean;
}

function galler(steg: Forsaljningssteg, l: Forsaljningslage): boolean {
  switch (steg) {
    case "bostadsfragor":
      return !l.bostadsfragorBesvarade;
    case "skick":
      // Utan bostadsfragorna gar det inte att veta om grenen ar slackt – och
      // da kommer bostadsfragorna forst.
      return l.bostadsfragorBesvarade && !l.reparationsgrenenSlackt && l.skickAttBedoma;
    case "samma_del":
      return l.bostadsfragorBesvarade && l.sammaDelVisas;
    case "andel":
      return !l.andelBekraftad;
    case "export":
      return true;
  }
}

/** Forsta steget efter `efter` som galler bostaden. */
export function nastaForsaljningssteg(
  efter: "datum" | Forsaljningssteg,
  lage: Forsaljningslage,
): Forsaljningssteg {
  const start = efter === "datum" ? 0 : FORSALJNINGSSTEG.indexOf(efter) + 1;
  for (const steg of FORSALJNINGSSTEG.slice(start)) {
    if (galler(steg, lage)) return steg;
  }
  return "export";
}
