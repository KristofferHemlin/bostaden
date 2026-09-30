// En utestaende inbjudan som den inbjudna ser den (docs/design.md, "Att bjuda
// in en delagare"): pa sidan bakom koden, i registreringen och pa
// startskarmen. Forst beviset pa vem den kommer fran och vad den innebar – vem
// som bjudit in, vilken bostad, vad atkomsten ger – och forst darefter
// nagot att trycka pa (`children`). En kod som leder rakt till ett falt har
// formen av ett natfiskeflode.

import type { ReactNode } from "react";
import type { Inbjudningsvy } from "@/lib/inbjudan";

export function Inbjudningskort({
  vy,
  children,
}: {
  vy: Inbjudningsvy;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="font-rubrik text-lg text-text-primar">
          {vy.inbjudarEpost ?? "En delägare"} har bjudit in dig till {vy.bostadsnamn}
        </p>
        <p className="font-granssnitt text-sm text-text-sekundar">
          Du får tillgång till bostadens arkiv: varje kvitto, varje belopp, hela
          historiken och underlaget. Ni ser samma sak, och båda kan lägga in nya
          kvitton.
        </p>
        <p className="font-granssnitt text-sm text-text-sekundar">
          Inbjudan gäller {vy.epost}.
        </p>
      </div>
      {children}
    </div>
  );
}
