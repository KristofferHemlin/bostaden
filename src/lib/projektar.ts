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
 * inget ar att harleda, och etiketten star kvar.
 */
export function projektetsArText(betaldatum: (string | null)[], etikett: number): string {
  const ar = [...new Set(betaldatum.filter((d): d is string => d !== null).map(kalenderAr))].sort(
    (a, b) => a - b,
  );
  if (ar.length === 0) return String(etikett);
  if (ar.length === 1) return String(ar[0]);
  const iFoljd = ar.every((a, i) => i === 0 || a === ar[i - 1]! + 1);
  return iFoljd ? `${ar[0]}–${ar[ar.length - 1]}` : ar.join(", ");
}
