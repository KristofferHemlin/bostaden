// En kvittorad i ett projekt – samma rad pa projektets sida och pa skarmen
// Kvittona (docs/design.md, "Kvittoraden ser likadan ut på Kvittona som på
// projektsidan": det ar samma rad). En komponent, sa att de inte kan glida
// isar; 2026-11-19 tappade Kvittona kursiven och bilagemarket en skarm bort.
//
// Samma rad som i kvittolistan och Senaste kvitton (docs/design.md,
// "Anteckningen får två rader där den är radens huvudtext"): anteckningen
// overst pa tva rader, leverantor och datum dampat under. Saknas anteckning
// ar leverantoren huvudtext och andraraden bara datumet.

import { Listrad } from "@/components/skarm";
import { arUtkast, beloppForKostnad, rotForBelopp } from "@/doman/berakningar";
import type { Kostnad } from "@/doman/typer";
import { formateraKronor, isoDatum } from "@/lib/format";
import { bilagemarke } from "@/lib/kvittolista";

/** Det ur databasraden som raden visar, utover domanens kostnad. */
export interface KvittoradKalla {
  anteckning: string | null;
  leverantor: string | null;
  betaldatum: Date | null;
  dokumentdatum: Date | null;
  arkiverad: boolean;
  _count: { bilagor: number };
}

export function ProjektetsKvittorad({
  kostnad: k,
  original,
  projektId,
}: {
  kostnad: Kostnad;
  original: KvittoradKalla & Parameters<typeof arUtkast>[0];
  projektId: string;
}) {
  const notering = original.anteckning?.trim();
  const leverantor = original.leverantor?.trim();
  const datumRad = original.betaldatum ?? original.dokumentdatum;
  const datum = datumRad ? isoDatum(datumRad) : null;
  return (
    <Listrad
      namn={notering || leverantor || "Kvitto"}
      anteckning={!!notering}
      // Till kvittot, som i kvittolistan – dar ratta man ett belopp utan att
      // leta upp kvittot via Kvitton.
      href={`/kostnad/${k.id}`}
      status={notering ? [leverantor, datum].filter(Boolean).join(" · ") : (datum ?? "")}
      // Kursiv forsta rad och bilagemarket, som i kvittolistan och pa
      // startskarmen (docs/design.md, Kvittolistan). Samma villkor som dar:
      // utkast och kvitton som inte hor till bostaden bar inget marke.
      kursivStatus
      bilaga={bilagemarke({
        arkiverad: original.arkiverad,
        utkast: arUtkast(original),
        antalBilagor: original._count.bilagor,
      })}
      // Projektets summa raknar kvittot; det ar underlaget (exporten,
      // troskeln) som vantar pa betaldatumet.
      underStatus={k.betaldatum ? undefined : "Obetald – räknas i underlaget när den är betald"}
      atgard={!k.betaldatum}
      // Beloppet pa pappret, inte det ROT-reducerade bidraget (docs/design.md,
      // "Samma belopp ska se likadant ut overallt").
      belopp={formateraKronor(beloppForKostnad(k, projektId))}
      // ROT som avgar fran just den har delen av kvittot (docs/design.md,
      // Listrader: "ROT-raden hor till kvittoraden, overallt den visas").
      rot={rotForBelopp(k, beloppForKostnad(k, projektId))}
    />
  );
}
