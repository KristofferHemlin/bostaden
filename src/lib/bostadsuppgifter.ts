// Det appen fragar efter inifran, fran ett enda kort overst pa startsidan
// (docs/design.md, "Ägarandelen frågas från startsidan"). Registreringen
// samlar in allt som beskriver bostaden; kortet fragar om det som har en
// foljd – agarandelen – och om kopeskillingen nar den saknas.
//
// Kopeskillingen ar obligatorisk i registreringen sedan 2026-11-04. Kortet
// fragar efter den for konton som skapades fore kravet – kolumnen ar
// fortfarande nullbar. Adressen fragas inte har – den ar obligatorisk i
// registreringen.
//
// Kortet pekar pa NASTA obesvarade fraga, aldrig pa en lista, och forsvinner
// nar inget ar obesvarat. Inbjudan raknas inte som en fraga: den ar ett
// erbjudande, och en overhoppad inbjudan far aldrig fa kortet att komma
// tillbaka. Darfor laser nastaUppgift bara svaren – inget om inbjudningar
// finns ens i dess indata.
//
// Ingenting har ar en sparr. Kortet ligger ovanfor "Lägg till kvitto", aldrig
// i stallet for den.

export type Bostadsuppgift = "kopeskilling" | "agarandel";

export const UPPGIFTERNAS_ORDNING: readonly Bostadsuppgift[] = ["kopeskilling", "agarandel"];

export interface Bostadssvar {
  kopeskilling: bigint | number | null;
  /** null = inte angiven (CLAUDE.md, "Andelen ar null tills den besvarats"). */
  agarandel: number | null;
}

function besvarad(uppgift: Bostadsuppgift, svar: Bostadssvar): boolean {
  switch (uppgift) {
    case "kopeskilling":
      return svar.kopeskilling !== null;
    case "agarandel":
      return svar.agarandel !== null;
  }
}

/** Forsta obesvarade fragan i den fasta ordningen, eller null nar allt ar besvarat. */
export function nastaUppgift(svar: Bostadssvar): Bostadsuppgift | null {
  return UPPGIFTERNAS_ORDNING.find((u) => !besvarad(u, svar)) ?? null;
}

export const UPPGIFTENS_SOKVAG: Record<Bostadsuppgift, string> = {
  kopeskilling: "/bostaden/kopeskilling",
  agarandel: "/bostaden/andel",
};

export const INBJUDNINGSERBJUDANDETS_SOKVAG = "/bostaden/bjud-in";

/**
 * Kortets text: fragan sjalv, aldrig "Fortsätt", och vad svaret laser upp.
 * Rubriken ar ocksa rubriken pa fragans egen sida – samma namn pa samma sak.
 */
export const UPPGIFTENS_TEXT: Record<Bostadsuppgift, { fraga: string; rad: string }> = {
  kopeskilling: {
    fraga: "Lägg till köpeskillingen",
    // Kortet ar en hanvisning, inte faltet: samma innebord som
    // KOPESKILLINGENS_HJALPTEXT, inte samma ord. Riktningen ar att talet ska
    // DIT – blanketten ar tom tills hon fyller i den, sa "står på K5" pekar at
    // fel hall.
    rad: "Du för in den på K5 eller K6 den dag du säljer.",
  },
  agarandel: {
    fraga: "Hur stor del av bostaden äger du?",
    rad: "Talen i ditt underlag gäller hela bostaden tills du säger vilken andel du äger.",
  },
};

/**
 * Kopeskillingens hjalptext (docs/design.md, "Ägarandelen frågas från
 * startsidan"), densamma i kortets fraga och i registreringen. Ordet "själv"
 * bar meningen: hon behover talet oavsett vad appen gor med det.
 * Installningarna visar bara den forsta meningen.
 */
export const KOPESKILLINGENS_HJALPTEXT =
  "Står på köpekontraktet eller överlåtelseavtalet. Du behöver talet själv på blankett K5 eller K6 den dag du säljer.";

/** Hjalptexten under andelsfaltet – samma som fragan vid forsaljningen. */
export const ANDELENS_HJALPTEXT =
  "Andelen står i köpekontraktet. Den avgör talen du för in i deklarationen.";

/**
 * Om erbjudandet om att bjuda in galler: en angiven andel under 100 %, och
 * ingen annan har eller ar inbjuden till bostaden – da finns redan den andra
 * delagaren. Adressen som inbjudan matchas mot ar obligatorisk i
 * registreringen och villkoras darfor inte har. Laser andelsskarmen (som
 * visar erbjudandet under ekot) och erbjudandets egen sida (som annars gar
 * vidare).
 */
export function erbjudandetGaller(agarandel: number | null, andraFinns: boolean): boolean {
  return agarandel !== null && agarandel < 100 && !andraFinns;
}

/**
 * Var en fraga leder efter sitt svar. Varje svar ar redan sparat nar det har
 * anropas, sa att kliva ur ar ett normalt satt att anvanda flodet: nasta gang
 * pekar kortet pa samma stalle.
 *
 * Erbjudandet om att bjuda in ligger sedan 2026-11-04 i andelsskarmens eget
 * kort (docs/design.md, "Andelsskärmen svarar medan hon skriver"), inte som
 * ett steg efter sparandet. Inbjudningssidan nas darfor bara nar hon valt
 * erbjudandet – `bjudIn` – och nar det fortfarande galler. "Spara
 * ägarandelen" leder vidare som vilket annat svar som helst.
 */
export function efterSvaret({
  svar,
  nyssBesvarad,
  andraFinns,
  bjudIn,
}: {
  /** Svaren som de ar sparade nu, efter svaret. */
  svar: Bostadssvar;
  nyssBesvarad: Bostadsuppgift;
  /** Fler medlemmar eller en utestaende inbjudan. */
  andraFinns: boolean;
  /** Hon valde erbjudandet under ekot, inte primarknappen. */
  bjudIn: boolean;
}): string {
  if (bjudIn && nyssBesvarad === "agarandel" && erbjudandetGaller(svar.agarandel, andraFinns)) {
    return INBJUDNINGSERBJUDANDETS_SOKVAG;
  }
  return nastaSidan(svar);
}

/** Sidan for nasta obesvarade fraga, eller oversikten nar allt ar besvarat. */
export function nastaSidan(svar: Bostadssvar): string {
  const nasta = nastaUppgift(svar);
  return nasta ? UPPGIFTENS_SOKVAG[nasta] : "/";
}
