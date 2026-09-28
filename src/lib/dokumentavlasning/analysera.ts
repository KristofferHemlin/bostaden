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
// Avlasningen BLOCKERAR aldrig sparandet, men den ar aldrig tyst (produktspec,
// "Dokumentavlasning"). Darfor returneras inte bara falten utan ocksa `kord`:
// sant nar modellen faktiskt svarade (enskilda falt kan fortfarande vara null –
// det ar "faltet kunde inte lasas"), falskt bara nar sjalva anropet aldrig kom
// ivag eller aldrig kom tillbaka: saknad nyckel, natverksfel, timeout eller ett
// fel fran API:et ("avlasningen kordes inte"). Formularet ska aldrig blockeras
// av nagotdera – det ar klientens jobb att visa skillnaden.

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { rapporteraFel } from "@/lib/feltrapportering";
import type { Bilageformat } from "@/lib/lagring/bilaga-regler";
import { heicTillJpegMiniatyr } from "@/lib/lagring/miniatyr";
import {
  TOMT_DOKUMENTFALT,
  avlasningsrapporter,
  tolkaDokumentsvarMedKontroll,
  type Dokumentfalt,
} from "./tolkning";

const SAMMANHANG = { sida: "dokumentavlasning", anrop: "analyseraDokumentbuffert" };

// Att lasa nagra falt ur ett kvitto kraver inte den storsta modellen och kostnaden
// skiljer en storleksordning. Racker inte traffsakerheten, ga upp till
// "claude-sonnet-5" (produktspec avsnitt 9, "Modellvalet ska sta i proportion").
const MODELL = "claude-haiku-4-5-20251001";

const INSTRUKTION = [
  "Du laser ett kvitto eller en faktura for kostnader nedlagda pa en bostad.",
  "Svara med ENBART ett JSON-objekt – ingen text runt om, inga kodstaket – med",
  'exakt dessa nycklar: "datum", "valuta", "leverantor", "att_betala",',
  '"rot_utnyttjat", "netto", "moms", "summa_fore_rot".',
  "Varje belopp ska sta tryckt pa dokumentet precis sa. Rakna aldrig ut ett",
  "belopp – varken summor, differenser eller procent. Star talet inte utskrivet,",
  "returnera null.",
  '- "datum": kvittots eller fakturans datum som "YYYY-MM-DD".',
  '- "valuta": valutakoden dokumentet ar i, t.ex. "SEK" eller "EUR".',
  '- "leverantor": butikens eller foretagets namn.',
  '- "att_betala": summan kunden ska betala inklusive moms, sa som den star pa',
  '  dokumentet ("Att betala", "Totalt", "Summa"), i kronor som ett tal med',
  "  decimaler, t.ex. 1020.95. Ar ett ROT-avdrag redan draget ar det talet EFTER",
  "  avdraget – rakna inte om det.",
  '- "rot_utnyttjat": det ROT-avdrag (skattereduktion for arbetskostnad) som',
  '  REDAN har dragits av pa fakturan, i kronor – ofta angivet som "ROT-avdrag"',
  '  eller "varav ROT". Aldrig en procentsats. Returnera null om inget',
  "  ROT-avdrag redovisas.",
  '- "netto": summan exklusive moms, sa som den star pa dokumentet ("Netto",',
  '  "Summa exkl. moms"). Null om den inte star utskriven.',
  '- "moms": det totala momsbeloppet i kronor, sa som det star pa dokumentet.',
  "  Null om det inte star utskrivet, eller om momsen bara star pa flera rader",
  "  utan en utskriven totalsumma – lagg inte ihop dem.",
  '- "summa_fore_rot": summan inklusive moms FORE ROT-avdraget, bara om den',
  "  star utskriven som ett eget belopp pa dokumentet. Rakna aldrig fram den",
  "  sjalv. Returnera null om den inte star utskriven eller om inget ROT-avdrag",
  "  redovisas.",
  "Returnera alla belopp som null om dokumentet INTE ar i svenska kronor (SEK) –",
  "appen kan bara rakna pa kronbelopp.",
  "Satt ett falt till null om det inte gar att lasa sakert ur dokumentet.",
  "Gissa aldrig – ett gissat varde ar varre an null.",
].join("\n");

type Bildmediatyp = "image/jpeg" | "image/png";

/**
 * Resultatet av en dokumentavlasning. `kord` skiljer "modellen svarade men
 * hittade inget i det har faltet" (falt-for-falt null, kord: true) fran
 * "anropet kom aldrig ivag eller aldrig tillbaka" (kord: false) – de tva
 * kraver olika besked till anvandaren (produktspec, "Dokumentavlasning").
 */
export interface Dokumentavlasning {
  kord: boolean;
  falt: Dokumentfalt;
}

const KORDES_INTE: Dokumentavlasning = { kord: false, falt: { ...TOMT_DOKUMENTFALT } };

/**
 * Skickar ett redan inlast dokument till modellen och returnerar datum,
 * totalbelopp (oren, inklusive moms och fore ROT – se tolkning.ts), leverantor
 * och – nar det gar att lasa ur en faktura – utnyttjat ROT-avdrag. Kastar aldrig – vid varje fel returneras
 * `kord: false` sa att anroparen kan visa att avlasningen inte kordes alls, i
 * stallet for att tysta ihop det med enskilda falt som inte gick att lasa.
 *
 * Bufferten kommer fran Storage: webblasaren laddar upp filen dit direkt (den
 * passerar aldrig en serverless-funktion) och servern laser ner den for analys.
 */
export async function analyseraDokumentbuffert(
  original: Buffer,
  format: Bilageformat,
): Promise<Dokumentavlasning> {
  try {
    const nyckel = process.env.ANTHROPIC_API_KEY;
    if (!nyckel) {
      // En saknad nyckel i drift ar en avlasning som aldrig kors for nagon –
      // den ska synas i loggen, inte bara som tomma falt hos anvandaren.
      rapporteraFel(new Error("Dokumentavläsning: ANTHROPIC_API_KEY saknas"), SAMMANHANG);
      return KORDES_INTE;
    }

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

    // Modellen svarade – kord: true aven om svaret inte gick att tolka till
    // nagot anvandbart falt. Det ar fortfarande "faltet kunde inte lasas", inte
    // "avlasningen kordes inte".
    //
    // Ett obrukbart svar och en kontroll som slog fel rapporteras, men bara
    // som namnet pa det som hande (produktspec avsnitt 13): aldrig talen,
    // leverantoren eller svarstexten. stop_reason ar ett fast varde fran API:et
    // och sager om svaret klipptes av.
    const tolkning = tolkaDokumentsvarMedKontroll(text);
    for (const meddelande of avlasningsrapporter(tolkning)) {
      rapporteraFel(
        new Error(
          tolkning.tolkbart
            ? meddelande
            : `${meddelande} (stop_reason: ${svar.stop_reason ?? "okänd"})`,
        ),
        SAMMANHANG,
      );
    }
    return { kord: true, falt: tolkning.falt };
  } catch (fel) {
    // Aldrig ett kastat fel – men en modell som slutat svara (fel nyckel, kvot,
    // API-driftstorning) ska synas nagonstans i stallet for att bara sluta
    // fylla i falt utan forklaring (produktspec avsnitt 13, punkt 1). Ingen
    // dokumentdata skickas med, bara att det hande.
    rapporteraFel(fel, SAMMANHANG);
    return KORDES_INTE;
  }
}
