// Projektsidans rad "År". projekt.ar ar en etikett for gruppering – allt som
// raknas utgar fran kvittonas betaldatum (CLAUDE.md, Konventioner), och ett
// projekt vars kvitton spanner over ett arsskifte star pa tva rader i
// underlaget. Uppmatt 2026-10-19: ett fonsterbyte med kvitton 2023 och 2024
// stod som "2023" pa projektsidan medan underlaget hade bada aren.

import { kalenderAr } from "@/doman/berakningar";

/**
 * Aren kvittona betalades: ett ar ("2024"), ett spann for ar i foljd
 * ("2023–2024"), och uppraknade nar det finns glapp ("2021, 2024") – ett
 * spann skulle pasta kvitton aren daremellan. Utan nagot betalt kvitto finns
 * inget ar att harleda, och da visas inget ar alls: inte etiketten
 * projekt.ar, som sattes nar projektet skapades och inte foljer med nar
 * kvitton flyttas, och inte innevarande ar (docs/design.md, "Årtalet bredvid
 * en åtgärd räknas ur dess kvitton"). Ett projekt utan kvitton har inget
 * belopp, och av samma skal inget ar.
 */
export function projektetsArText(betaldatum: (string | null)[]): string | null {
  const ar = [...new Set(betaldatum.filter((d): d is string => d !== null).map(kalenderAr))].sort(
    (a, b) => a - b,
  );
  if (ar.length === 0) return null;
  if (ar.length === 1) return String(ar[0]);
  const iFoljd = ar.every((a, i) => i === 0 || a === ar[i - 1]! + 1);
  return iFoljd ? `${ar[0]}–${ar[ar.length - 1]}` : ar.join(", ");
}

/** Det ur en kvittorad som arstexten behover: betaldatumet och vilka projekt
 *  dess rader hor till. Bade databasrader och falska rader i proven har det. */
export interface KvittoForAr {
  betaldatum: Date | null;
  rader: { fordelningar: { projekt_id: string | null }[] }[];
}

/**
 * Aret som text for varje projekt, ur kvittonas betaldatum – den enda
 * harledningen av ett projekts ar i appen (docs/design.md, "Året härleds på
 * varje skärm som nämner det"). Projektlistan, projektsidan, startskarmens
 * kort, kvittots rullistor och forsaljningens fraga om samma del gar alla
 * hit. Ett projekt over ett arsskifte heter da "2025–2026" overallt, i
 * stallet for att lista och rullista sager olika ar (2026-11-19).
 * Skickflodet vid forsaljningen gar ocksa hit sedan 2026-11-20; det last
 * dessforinnan etiketten och visade "Slipade golven · 2026" for ett kvitto
 * fran 2020.
 *
 * Varje projekt har en post, och null betyder inget ar att visa. Anroparen
 * ska aldrig falla tillbaka pa projekt.ar.
 */
export function projektarTextKarta(
  projekt: { id: string }[],
  kvitton: KvittoForAr[],
): Map<string, string | null> {
  return new Map(
    projekt.map((p) => [
      p.id,
      projektetsArText(
        kvitton
          .filter((k) => k.rader.some((r) => r.fordelningar.some((f) => f.projekt_id === p.id)))
          .map((k) => (k.betaldatum ? k.betaldatum.toISOString().slice(0, 10) : null)),
      ),
    ]),
  );
}

/**
 * Projekten i kvittonas ordning: tidigaste betalda kvitto forst, och projekt
 * utan betalt kvitto sist. Lika ar behaller den ordning projekten kom i, sa
 * att anroparen kan ge dem en andra nyckel (skapad_at) i fragan. Sortera inte
 * pa projekt.ar for en lista som visar aret – etiketten foljer inte med nar
 * kvitton flyttas, och listan stod da i en ordning som motsade sina egna ar
 * (docs/design.md, "Årtalet bredvid en åtgärd räknas ur dess kvitton").
 */
export function iKvittonasArsordning<P extends { id: string }>(projekt: P[], kvitton: KvittoForAr[]): P[] {
  const tidigast = new Map(
    projekt.map((p) => {
      const ar = kvitton
        .filter((k) => k.betaldatum && k.rader.some((r) => r.fordelningar.some((f) => f.projekt_id === p.id)))
        .map((k) => k.betaldatum!.getUTCFullYear());
      return [p.id, ar.length > 0 ? Math.min(...ar) : Infinity];
    }),
  );
  return [...projekt].sort((a, b) => tidigast.get(a.id)! - tidigast.get(b.id)!);
}
