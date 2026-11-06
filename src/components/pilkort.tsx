// Formen som ett tryckbart kort med pil till hoger har (docs/design.md,
// "Startskärmen med innehåll"): rubrik, en dampad rad, och → till hoger. Hela
// kortet ar tryckytan; omslaget – en lank eller en knapp – ager anroparen.
//
// Bara formen, aldrig tonen. Fragekortet om agarandelen staller en fraga till
// henne; inbjudningskortet ar ett pastaende om nagon annan. Namnet sager
// darfor ingenting om fragor – ett gemensamt namn i fragoton hade dragit
// inbjudan dit av sig sjalv.

import { Kort } from "@/components/skarm";

export function Pilkort({
  rubrik,
  rad,
  iKnapp = false,
}: {
  rubrik: string;
  rad: string;
  /** Kortet ligger i en <button>, som bara far ha frasinnehall: kortet och
   *  rubriken blir span med samma utseende. I en lank star rubriken som h2. */
  iKnapp?: boolean;
}) {
  const rubrikKlass = "font-rubrik text-base text-text-primar";
  const radKlass = "mt-0.5 font-granssnitt text-sm text-text-sekundar";
  return (
    <Kort
      som={iKnapp ? "span" : "div"}
      className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-yta-nedsankt"
    >
      {iKnapp ? (
        <span className="block min-w-0">
          <span className={`block ${rubrikKlass}`}>{rubrik}</span>
          <span className={`block ${radKlass}`}>{rad}</span>
        </span>
      ) : (
        <div className="min-w-0">
          <h2 className={rubrikKlass}>{rubrik}</h2>
          <p className={radKlass}>{rad}</p>
        </div>
      )}
      <span aria-hidden className="shrink-0 font-granssnitt text-text-sekundar">
        →
      </span>
    </Kort>
  );
}
