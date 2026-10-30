// Det appen fragar efter inifran, fran ett enda kort overst pa startsidan
// (docs/design.md, "Onboardingen fortsätter på startsidan"). Registreringen
// fragar bara om upplatelseform och tilltrade; adressen, kopeskillingen och
// agarandelen fragas sedan, en i taget.
//
// Ordningen ar fast och ar ett villkor, inte en smaksak: en inbjudan matchas
// mot adressen, sa adressen maste komma fore andelen – det ar den som gor
// inbjudningserbjudandet mojligt att visa.
//
// Kortet pekar pa NASTA obesvarade fraga, aldrig pa en lista, och forsvinner
// nar inget ar obesvarat. Inbjudan raknas inte som en fraga: den ar ett
// erbjudande, och en overhoppad inbjudan far aldrig fa kortet att komma
// tillbaka. Darfor laser nastaUppgift bara de tre svaren – inget om
// inbjudningar finns ens i dess indata.
//
// Ingenting har ar en sparr. Kortet ligger ovanfor "Lägg till kvitto", aldrig
// i stallet for den.

export type Bostadsuppgift = "adress" | "kopeskilling" | "agarandel";

export const UPPGIFTERNAS_ORDNING: readonly Bostadsuppgift[] = [
  "adress",
  "kopeskilling",
  "agarandel",
];

export interface Bostadssvar {
  adress: string | null;
  kopeskilling: bigint | number | null;
  /** null = inte angiven (CLAUDE.md, "Andelen ar null tills den besvarats"). */
  agarandel: number | null;
}

function besvarad(uppgift: Bostadsuppgift, svar: Bostadssvar): boolean {
  switch (uppgift) {
    case "adress":
      return (svar.adress ?? "").trim() !== "";
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
  adress: "/bostaden/adress",
  kopeskilling: "/bostaden/kopeskilling",
  agarandel: "/bostaden/andel",
};

export const INBJUDNINGSERBJUDANDETS_SOKVAG = "/bostaden/bjud-in";

/**
 * Kortets text: fragan sjalv, aldrig "Fortsätt", och vad svaret laser upp.
 * Rubriken ar ocksa rubriken pa fragans egen sida – samma namn pa samma sak.
 */
export const UPPGIFTENS_TEXT: Record<Bostadsuppgift, { fraga: string; rad: string }> = {
  adress: {
    fraga: "Lägg till adressen",
    rad: "Den står överst på varje skärm, och den du bjuder in ser vilken bostad det gäller.",
  },
  kopeskilling: {
    fraga: "Lägg till köpeskillingen",
    rad: "Den står på K5 och K6, så du behöver talet den dag du säljer.",
  },
  agarandel: {
    fraga: "Hur stor del av bostaden äger du?",
    rad: "Talen i ditt underlag gäller hela bostaden tills du säger vilken andel du äger.",
  },
};

/**
 * Hjalptexten under kopeskillingsfaltet. Faltet ar obligatoriskt i kortet och
 * sager darfor varfor: var talet star, och att det behovs pa K5 och K6 den
 * dag bostaden saljs, oavsett vad appen gor med det.
 */
export const KOPESKILLINGENS_HJALPTEXT =
  "Står på köpekontraktet eller överlåtelseavtalet, och behövs på K5 och K6 när du säljer.";

/** Hjalptexten under andelsfaltet – samma som fragan vid forsaljningen. */
export const ANDELENS_HJALPTEXT =
  "Andelen står i köpekontraktet. Den avgör talen du för in i deklarationen.";

/**
 * Var en fraga leder efter sitt svar. Varje svar ar redan sparat nar det har
 * anropas, sa att kliva ur ar ett normalt satt att anvanda flodet: nasta gang
 * pekar kortet pa samma stalle.
 *
 * Erbjudandet om att bjuda in visas direkt efter en andel under 100 %, men
 * bara nar adressen finns – inbjudan visar den, och utan den star det "en
 * bostad" pa sidan bakom koden – och bara nar ingen annan redan har eller
 * ar inbjuden till bostaden. Da finns redan den andra delagaren.
 */
export function efterSvaret({
  svar,
  nyssBesvarad,
  andraFinns,
}: {
  /** Svaren som de ar sparade nu, efter svaret. */
  svar: Bostadssvar;
  nyssBesvarad: Bostadsuppgift;
  /** Fler medlemmar eller en utestaende inbjudan. */
  andraFinns: boolean;
}): string {
  if (
    nyssBesvarad === "agarandel" &&
    svar.agarandel !== null &&
    svar.agarandel < 100 &&
    besvarad("adress", svar) &&
    !andraFinns
  ) {
    return INBJUDNINGSERBJUDANDETS_SOKVAG;
  }
  return nastaSidan(svar);
}

/** Sidan for nasta obesvarade fraga, eller oversikten nar allt ar besvarat. */
export function nastaSidan(svar: Bostadssvar): string {
  const nasta = nastaUppgift(svar);
  return nasta ? UPPGIFTENS_SOKVAG[nasta] : "/";
}
