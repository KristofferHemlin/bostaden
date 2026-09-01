// Dokumentavlasning via sprakmodell (produktspec avsnitt 9). ENDAST server –
// ANTHROPIC_API_KEY far aldrig na klienten.
//
// Filen skickas hit direkt fran formularet, innan kostnaden sparats: det finns
// annu inget kostnad_id och darmed ingen sokvag i lagringen. Sjalva
// uppladdningen sker forst nar kostnaden sparas.
//
// HEIC kan modellen inte lasa och det ar standardformatet pa iPhone – samma
// konvertering som miniatyrgenereringen kor i minnet fore anropet.
//
// ALLA fel svaljs tyst. Natverksfel, oläsbart dokument, timeout, saknad nyckel –
// inget far synas eller blockera. Vid minsta problem returneras tre null-falt och
// formularet fungerar exakt som utan analys.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { kannIgenFormat } from "@/lib/lagring/bilaga-regler";
import { heicTillJpegMiniatyr } from "@/lib/lagring/miniatyr";
import {
  TOMT_DOKUMENTFALT,
  tolkaDokumentsvar,
  type Dokumentfalt,
} from "./tolkning";

// Att lasa tre falt ur ett kvitto kraver inte den storsta modellen och kostnaden
// skiljer en storleksordning. Racker inte traffsakerheten, ga upp till
// "claude-sonnet-5" (produktspec avsnitt 9, "Modellvalet ska sta i proportion").
const MODELL = "claude-haiku-4-5-20251001";

const INSTRUKTION = [
  "Du laser ett kvitto eller en faktura for kostnader nedlagda pa en bostad.",
  "Svara med ENBART ett JSON-objekt – ingen text runt om, inga kodstaket – med",
  'exakt dessa nycklar: "datum", "totalbelopp", "valuta", "leverantor".',
  '- "datum": kvittots eller fakturans datum som "YYYY-MM-DD".',
  '- "valuta": valutakoden dokumentet ar i, t.ex. "SEK" eller "EUR".',
  '- "totalbelopp": hela summan att betala inklusive moms, i kronor som ett tal',
  "  med decimaler, t.ex. 1020.95. Returnera null om dokumentet INTE ar i svenska",
  "  kronor (SEK) – appen kan bara rakna pa kronbelopp.",
  '- "leverantor": butikens eller foretagets namn.',
  "Satt ett falt till null om det inte gar att lasa sakert ur dokumentet.",
  "Gissa aldrig – ett gissat varde ar varre an null.",
].join("\n");

type Bildmediatyp = "image/jpeg" | "image/png";

/**
 * Skickar en vald fil till modellen och returnerar datum, totalbelopp (oren,
 * inklusive moms) och leverantor. Kastar aldrig – vid varje fel returneras
 * TOMT_DOKUMENTFALT.
 */
export async function analyseraDokument(fil: File): Promise<Dokumentfalt> {
  try {
    const nyckel = process.env.ANTHROPIC_API_KEY;
    if (!nyckel) return { ...TOMT_DOKUMENTFALT };

    const format = kannIgenFormat(fil.type, fil.name);
    if (!format) return { ...TOMT_DOKUMENTFALT };

    const original = Buffer.from(await fil.arrayBuffer());
    const klient = new Anthropic({ apiKey: nyckel });

    const dokumentblock: Anthropic.ContentBlockParam =
      format.andelse === "pdf"
        ? {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: original.toString("base64"),
            },
          }
        : {
            type: "image",
            source: {
              type: "base64",
              media_type: format.kraverMiniatyr
                ? "image/jpeg"
                : (format.mimetyp as Bildmediatyp),
              // HEIC/HEIF -> nedskalad JPG i minnet, samma kod som miniatyren.
              data: (format.kraverMiniatyr
                ? await heicTillJpegMiniatyr(original)
                : original
              ).toString("base64"),
            },
          };

    const svar = await klient.messages.create({
      model: MODELL,
      max_tokens: 512,
      system: INSTRUKTION,
      messages: [
        {
          role: "user",
          content: [
            dokumentblock,
            { type: "text", text: "Las ut falten ur dokumentet." },
          ],
        },
      ],
    });

    const text = svar.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n");

    return tolkaDokumentsvar(text);
  } catch {
    return { ...TOMT_DOKUMENTFALT };
  }
}
