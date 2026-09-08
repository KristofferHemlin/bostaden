// Kvittolistan – malet for "Kvitton" i toppmenyn. Alla bostadens kvitton och
// fakturor, grupperade per kalenderar (docs/design.md, Kvittolistan): troskeln
// galler per ar och aren ar helt skilda at i underlaget, sa en lista dar aren
// gloser samman doljer produktens viktigaste struktur.
//
// Raderna visar anteckningen som huvudtext med leverantor och datum dampat
// under – exakt samma presentation som pa startskarmen. Aret bestams av
// betaldatum (dokumentdatum som reserv nar kvittot annu ar obetalt); kvitton
// utan bada hamnar i en egen grupp overst.
//
// Entiteten heter fortfarande `kostnad` i kod och rutter (docs/design.md,
// "Ordval i granssnittet") – bara det anvandaren moter byter till "kvitto".

import Link from "next/link";
import { Listrad, PRIMARKNAPP_KLASS, Skarm } from "@/components/skarm";
import { arUtkast } from "@/doman/berakningar";
import { bostadHeader } from "@/lib/bostad-header";
import { formateraKronor, isoDatum } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { kravBostad } from "@/lib/session";

export const dynamic = "force-dynamic";

interface KvittoRad {
  id: string;
  namn: string;
  status: string;
  atgard: boolean;
  belopp: string | undefined;
  href: string;
  bild: { src: string; alt: string } | undefined;
}

interface Arsgrupp {
  nyckel: string;
  rubrik: string;
  summaOre: number;
  rader: KvittoRad[];
}

export default async function KvittolistaSida() {
  const { bostadId } = await kravBostad();

  const [bostad, kostnadRader] = await Promise.all([
    prisma.bostad.findUniqueOrThrow({ where: { id: bostadId } }),
    prisma.kostnad.findMany({
      where: { bostad_id: bostadId },
      include: {
        bilagor: {
          select: { id: true },
          orderBy: { skapad_at: "asc" },
          take: 1,
        },
      },
      orderBy: [{ skapad_at: "desc" }],
    }),
  ]);
  const { bostadsnamn } = bostadHeader(bostad);

  // Gruppera i insattningsordning (nyast forst) och sortera sedan grupperna:
  // kvitton utan datum overst, darefter aren fallande.
  const grupper = new Map<string, Arsgrupp>();

  for (const k of kostnadRader) {
    const utkast = arUtkast(k);
    const notering = k.anteckning?.trim();
    const leverantor = k.leverantor?.trim();
    const datumRad = k.betaldatum ?? k.dokumentdatum;
    const datum = datumRad ? isoDatum(datumRad) : null;

    // Samma andrarad som pa startskarmen: leverantor och datum dampat under
    // anteckningen. Saknas anteckning ar leverantoren huvudtext och andraraden
    // bara datumet.
    let status: string;
    let atgard = false;
    if (k.arkiverad) {
      status = "Räknas inte med";
    } else if (utkast) {
      status = "Utkast · komplettera uppgifterna";
      atgard = true;
    } else if (notering) {
      status = [leverantor, datum].filter(Boolean).join(" · ");
    } else {
      status = datum ?? "";
    }

    const forstaBilaga = k.bilagor[0];
    const rad: KvittoRad = {
      id: k.id,
      namn: notering || leverantor || "Kvitto",
      status,
      atgard,
      belopp: utkast ? undefined : formateraKronor(k.totalbelopp ?? 0),
      href: utkast ? `/kostnad/nytt?utkast=${k.id}` : `/kostnad/${k.id}`,
      bild:
        utkast && forstaBilaga
          ? { src: `/bilaga/${forstaBilaga.id}?variant=visning`, alt: "Kvittobild" }
          : undefined,
    };

    const nyckel = datum ? datum.slice(0, 4) : "";
    let grupp = grupper.get(nyckel);
    if (!grupp) {
      grupp = {
        nyckel,
        rubrik: nyckel || "Utan datum",
        summaOre: 0,
        rader: [],
      };
      grupper.set(nyckel, grupp);
    }
    grupp.rader.push(rad);
    // Arssumman raknar det som faktiskt raknas: varken utkast (inget belopp an)
    // eller arkiverade kvitton bidrar.
    if (!utkast && !k.arkiverad) grupp.summaOre += k.totalbelopp ?? 0;
  }

  const sorterade = [...grupper.values()].sort((a, b) => {
    if (a.nyckel === b.nyckel) return 0;
    if (a.nyckel === "") return -1;
    if (b.nyckel === "") return 1;
    return Number(b.nyckel) - Number(a.nyckel);
  });

  return (
    <Skarm
      bostadsnamn={bostadsnamn}
      rubrik="Kvitton"
      bakLank={{ href: "/", text: "Översikt" }}
    >
      {kostnadRader.length === 0 ? (
        <div className="p-5">
          <p className="font-rubrik text-lg text-text-primar">
            Lägg till ditt första kvitto
          </p>
          <p className="mt-1 font-granssnitt text-sm text-text-dampad">
            Fånga kvittot medan det är färskt. Att koppla det till ett projekt kan
            vänta – oklassificerade kvitton ligger kvar här tills du hinner.
          </p>
          <Link href="/kostnad/nytt" className={`${PRIMARKNAPP_KLASS} mt-4`}>
            Lägg till kvitto
          </Link>
        </div>
      ) : (
        <>
          {sorterade.map((grupp) => (
            <div key={grupp.nyckel || "utan-datum"}>
              {/* Arsrubrik: egen rad pa --yta-nedsankt med artalet och arets
                  summa hogerstalld (docs/design.md, Kvittolistan). */}
              <div className="flex items-baseline justify-between gap-3 border-b border-linje bg-yta-nedsankt px-4 py-2">
                <span className="font-rubrik text-sm text-text-primar">
                  {grupp.rubrik}
                </span>
                <span className="font-rubrik text-sm tabular-nums text-text-primar">
                  {formateraKronor(grupp.summaOre)}
                </span>
              </div>
              <div className="divide-y divide-linje border-b border-linje">
                {grupp.rader.map((r) => (
                  <Listrad
                    key={r.id}
                    namn={r.namn}
                    status={r.status}
                    atgard={r.atgard}
                    belopp={r.belopp}
                    href={r.href}
                    bild={r.bild}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="p-4">
            <Link href="/kostnad/nytt" className={PRIMARKNAPP_KLASS}>
              Lägg till kvitto
            </Link>
          </div>
        </>
      )}
    </Skarm>
  );
}
