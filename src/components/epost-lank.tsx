"use client";

// En lank mellan vagarna in som tar adressen med sig (docs/design.md,
// Inloggningssidan): adressen skrivs till flikens tillstand i samma ogonblick
// som lanken trycks, och lases pa malsidan. Lankens adress ar alltid bara
// sidans – aldrig adressen som frageparameter.
//
// `epost` ar adressen att bara. Utan den lases e-postfaltet i formularet
// lanken ligger intill (`formular`), sa att det som faktiskt star i faltet
// foljer med, inte det som stod dar nar sidan laddades.

import Link from "next/link";
import type { ReactNode, RefObject } from "react";
import { sparaEpostForFliken } from "@/lib/epost-for-fliken";

export function EpostLank({
  href,
  epost,
  formular,
  className,
  children,
}: {
  href: string;
  epost?: string;
  formular?: RefObject<HTMLFormElement | null>;
  className?: string;
  children: ReactNode;
}) {
  function bar() {
    if (epost !== undefined) {
      sparaEpostForFliken(epost);
      return;
    }
    const falt = formular?.current?.elements.namedItem("epost");
    if (falt instanceof HTMLInputElement) sparaEpostForFliken(falt.value);
  }

  return (
    <Link href={href} onClick={bar} className={className}>
      {children}
    </Link>
  );
}
