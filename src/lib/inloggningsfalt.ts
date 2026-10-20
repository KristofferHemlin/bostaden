// Faltreglerna for inloggning, glomt losenord och nytt losenord – provade i
// formularet innan nagot skickas och igen pa servern, med samma meningar
// (docs/design.md, "När ett formulär vägrar").
//
// Formularen anvande tidigare webblasarens `required` och `type="email"`, som
// pa manga telefoner bara flyttar fokus utan ett ord. Det ar den post i
// inventeringen 2026-10-19 som kan lasa ute nagon: kommer man inte in spelar
// resten ingen roll.
//
// Ett losenord aterges aldrig i en mening – varken har eller i felrapporter.
// Meningarna namner falt och krav, aldrig vardet.

import { epostfel } from "@/lib/epostfalt";
import type { Faltfel } from "@/lib/formularfel";
import { losenordsfel } from "@/lib/losenord";

function las(formData: FormData, nyckel: string): string {
  return String(formData.get(nyckel) ?? "");
}

/** Inloggningen: e-post och losenord. Forsta felet, i faltens ordning. */
export function inloggningensFel(
  formData: FormData,
): Faltfel<"epost" | "losenord"> | null {
  const epost = epostfel(las(formData, "epost").trim());
  if (epost) return { falt: "epost", fel: epost };
  if (las(formData, "losenord") === "") {
    return { falt: "losenord", fel: "Fyll i ditt lösenord." };
  }
  return null;
}

/** Glomt losenord: bara adressen. */
export function glomtLosenordFel(formData: FormData): Faltfel<"epost"> | null {
  const epost = epostfel(las(formData, "epost").trim());
  return epost ? { falt: "epost", fel: epost } : null;
}

/** Nytt losenord: ifyllt, och samma krav som vid registreringen. */
export function nyttLosenordFel(formData: FormData): Faltfel<"losenord"> | null {
  const losenord = las(formData, "losenord");
  if (losenord === "") return { falt: "losenord", fel: "Fyll i ett nytt lösenord." };
  const svagt = losenordsfel(losenord);
  return svagt ? { falt: "losenord", fel: svagt } : null;
}
