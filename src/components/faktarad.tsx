// En rad i projektets faktaruta: etikett till vanster, varde till hoger.
// Delas av projektsidan och projektflodets sammanfattning (docs/design.md,
// "Sammanfattningen ligger på kortets egen yta"): samma uppgifter med samma
// etiketter ska se likadana ut, och likheten ar hela poangen med att visa dem
// fore sparandet. Tva kopior hade glidit isar.

import Link from "next/link";

/** Faktarutans typografi och radavstand – utan egen yta: rutan ligger pa
 *  kortets yta, inte pa ett band. */
export const FAKTARUTA_KLASS = "space-y-2 font-granssnitt text-sm";

export function Faktarad({
  etikett,
  varde,
  atgard,
  lank,
}: {
  etikett: string;
  varde: string;
  atgard?: boolean;
  /** En vag att andra svaret, direkt efter vardet. */
  lank?: { href: string; text: string };
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-text-sekundar">{etikett}</span>
      <span className="flex items-center gap-1.5 text-right text-text-primar">
        {atgard ? (
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
          />
        ) : null}
        {varde}
        {lank ? (
          <Link
            href={lank.href}
            className="ml-1 text-text-sekundar underline underline-offset-2 hover:text-text-primar"
          >
            {lank.text}
          </Link>
        ) : null}
      </span>
    </div>
  );
}
