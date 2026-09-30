// Den dampade upplysningen for "Kvittodatum utanfor innehavet"
// (docs/design.md). Samma dampade textbehandling som ovriga fakta i appen –
// ingen ikon, ingen ruta, ingen farg (@/components/skarm, `Friskrivning`).
//
// Alltid monterad, aven utan text: ytan reserveras sa att faltet under (t.ex.
// "Leverantor") ligger stilla nar notisen dyker upp under inmatningen.

import { HJALPTEXT_KLASS } from "@/components/skarm";
export function KvittodatumNotis({ notis }: { notis: string | null }) {
  return (
    <p className={`mt-1.5 min-h-[1.25rem] ${HJALPTEXT_KLASS}`}>
      {notis ?? " "}
    </p>
  );
}
