// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Landningssida } from "@/app/landningssida";

// Samma mening star inte ordagrant bade pa ett kort och i ett svar
// (docs/design.md, "Vad som står under vikningen"). Kortet sager regeln kort,
// fragesvaret sager den helt; star en mening pa bada stallena ar det svaret
// som behaller den.
//
// Testet vaktar regeln, inte dagens lydelser: det jamfor de fyra korten med
// de sju svaren som de renderas pa sidan, och kanner inte till nagon av
// texterna. En sprakrattning faller det inte pa – en mening som kopieras fran
// ett svar till ett kort faller det pa.
//
// "Samma mening" ar en hel mening, avgransad av punkt, fragetecken eller
// utropstecken, jamford utan skiljetecken, versaler och skillnader i
// blanksteg. Troskeln ar fem ord: under det ar en mening en fras och inte en
// forklaring – "Ingenting.", "Grundförbättringar räknas alltid." – och sadana
// far upprepas utan att nagot blir dubbelt.

const MINSTA_ANTAL_ORD = 5;

function sida(): Document {
  return new DOMParser().parseFromString(renderToStaticMarkup(Landningssida()), "text/html");
}

const normalisera = (t: string) =>
  t
    .toLocaleLowerCase("sv")
    .replace(/[.,!?:;"”–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Hela meningar med minst MINSTA_ANTAL_ORD ord, normaliserade. */
function meningar(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(normalisera)
    .filter((m) => m.split(" ").length >= MINSTA_ANTAL_ORD);
}

/** De fyra kortens text – rubrik och brodtext – som de renderas. */
function korten(dok: Document): string[] {
  const h2 = [...dok.querySelectorAll("h2")].find((e) => e.textContent?.trim() === "Vad räknas som förbättringsutgift?");
  if (!h2) throw new Error("sidan saknar avsnittet Vad räknas som förbättringsutgift?");
  const kort = [...h2.parentElement!.querySelectorAll("p")].map((p) => p.textContent ?? "");
  expect(kort, "avsnittet ska ha fyra kort").toHaveLength(4);
  return kort;
}

/** De sju svaren som de renderas. */
function svaren(dok: Document): string[] {
  const svar = [...dok.querySelectorAll("[data-svar]")].map((p) => p.textContent ?? "");
  expect(svar, "sidan ska ha sju svar").toHaveLength(7);
  return svar;
}

describe("samma mening star inte bade pa ett kort och i ett svar", () => {
  it("ingen mening pa minst fem ord finns i bade ett kort och ett frågesvar", () => {
    const dok = sida();
    const iSvaren = new Set(svaren(dok).flatMap(meningar));
    const dubbla = korten(dok).flatMap(meningar).filter((m) => iSvaren.has(m));
    expect(dubbla).toEqual([]);
  });
});

// Testet ovan passerar sa lange korten och svaren rakar vara olika. Har provas
// jamforelsen den vilar pa: att den kanner igen samma mening i en annan
// skrivning, och att den hoppar over korta fraser. Att testet ovan faller pa
// en inklistrad svarsmening ar provat med flit 2026-11-10.
describe("jamforelsen sjalv", () => {
  it("kanner igen samma mening trots versal, skiljetecken och blanksteg", () => {
    expect(meningar("Gränsen  gäller bostaden som helhet, inte varje enskild åtgärd.")).toEqual(
      meningar("gränsen gäller bostaden som helhet inte varje enskild åtgärd"),
    );
  });

  it("hoppar over meningar under fem ord", () => {
    expect(meningar("Ingenting. Grundförbättringar räknas alltid. Gratis att använda, inget kort, ingen bindning.")).toEqual([
      "gratis att använda inget kort ingen bindning",
    ]);
  });
});
