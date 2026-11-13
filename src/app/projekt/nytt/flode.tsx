"use client";

// Projektflodet (docs/design.md, "Att skapa ett projekt"): fyra steg i ett
// formular – vad gjorde du, vilken del av bostaden, fragetradet, vilka kvitton
// som horde hit – och ett enda sparande sist (skapaProjekt). Fragorna ar
// fragetradets egna komponenter (src/app/projekt/fragetradet.tsx), samma som
// genomgangens fas 2 och redigeringen, sa att de stalls ordagrant likadant.
//
// Tillstandet mellan stegen (CLAUDE.md, "Tillståndet mellan två steg"): det
// finns bara har. Ingenting skrivs till databasen forran Spara, sa ett
// halvfardigt projekt – utan namn, utan svar – kan inte dyka upp i
// projektlistan, pa kvittots sida, i valen "Koppla till projekt" eller i
// Återstår. Det som skrivits ligger kvar i webblasaren som ett utkast
// (localStorage, per bostad), och den som gar darifran och kommer tillbaka
// hamnar dar hon var. Utkastet ar en bekvamlighet, inte ett sparat svar: det
// syns ingen annanstans, rakar det vara borta borjar flodet tomt, och det tas
// bort nar projektet sparats.
//
// Alla steg ar renderade hela tiden och bara det aktuella syns. Da skickas
// varje stegs falt med i samma formular, och ett fel som servern hittar i
// ett tidigare steg gar att visa vid sin fraga: flodet byter till det steget
// och fokus flyttas dit (docs/design.md, "När ett formulär vägrar").

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useActionState, useEffect, useState } from "react";
import { skapaProjekt, type SkapaProjektResultat } from "../actions";
import { BostadsdelFraga } from "../bostadsdel-fraga";
import {
  Fragetradet,
  FragetradetDoldaFalt,
  MerkostnadFalt,
  NamnFalt,
  TOMMA_SVAR,
  fragetradetsValidering,
  type FragetradetUIState,
} from "../fragetradet";
import {
  Avdelningsrubrik,
  FALTFEL_KLASS,
  Friskrivning,
  HJALPTEXT_KLASS,
  Meddelanderuta,
  PRIMARKNAPP_KLASS,
} from "@/components/skarm";
import { KvittoKryssLista, type ValbartKvitto } from "@/components/kvitto-kryssruta";
import { BOSTADSDELAR, type BostadsdelSvar } from "@/doman/bostadsdel";
import type { Upplatelseform } from "@/doman/typer";
import { FORMULARFEL_ATTRIBUT } from "@/lib/formularfel";
import { useFormularfel } from "@/lib/formularfel-klient";
import type { FragetradetFaltnamn } from "@/lib/fragetradet-formdata";

const START: SkapaProjektResultat = {};

/** Antalet steg. Fast, oavsett gren – det ar stegen som raknas, inte
 *  fragorna, vars antal varierar (docs/design.md, "Ange aldrig hur många
 *  frågorna är"). */
export const ANTAL_STEG = 4;
type Steg = 1 | 2 | 3 | 4;

/** Steget dar varje fraga star – dit flodet gar nar svaret avvisas. */
const STEG_FOR_FALT: Record<FragetradetFaltnamn, Steg> = {
  namn: 1,
  byggde_nytt: 3,
  andrade_planlosning: 3,
  nytt_eller_bytt: 3,
  battre_eller_liknande: 3,
  // Merkostnaden stalls i kvittosteget, nar beloppet finns.
  merkostnad: 4,
  skick_forvarv: 3,
};

export type { ValbartKvitto };

// ---- Utkastet ---------------------------------------------------------------

interface Utkast {
  steg: Steg;
  namn: string;
  bostadsdelar: BostadsdelSvar[];
  svar: FragetradetUIState;
  valda: string[];
}

export function utkastNyckel(bostadId: string): string {
  return `kvittobo:nytt-projekt:${bostadId}`;
}

function arTomt(u: Omit<Utkast, "steg">): boolean {
  return (
    u.namn.trim() === "" &&
    u.bostadsdelar.length === 0 &&
    u.valda.length === 0 &&
    JSON.stringify(u.svar) === JSON.stringify(TOMMA_SVAR)
  );
}

/** Laser utkastet, eller null. Ett utkast som inte gar att lasa – trasigt,
 *  fran en aldre form, eller en webblasare som vagrar – ar inget utkast. */
function lasUtkast(nyckel: string, kvittoIder: Set<string>): Utkast | null {
  try {
    const text = window.localStorage.getItem(nyckel);
    if (!text) return null;
    const u = JSON.parse(text) as Partial<Utkast>;
    const steg = [1, 2, 3, 4].includes(u.steg as number) ? (u.steg as Steg) : 1;
    const svar = { ...TOMMA_SVAR };
    for (const k of Object.keys(TOMMA_SVAR) as (keyof FragetradetUIState)[]) {
      const v = u.svar?.[k];
      if (k === "merkostnad") {
        if (typeof v === "number" || v === null) svar.merkostnad = v;
      } else if (typeof v === "string") {
        (svar as Record<string, unknown>)[k] = v;
      }
    }
    return {
      steg,
      namn: typeof u.namn === "string" ? u.namn : "",
      bostadsdelar: Array.isArray(u.bostadsdelar)
        ? u.bostadsdelar.filter((d): d is BostadsdelSvar =>
            BOSTADSDELAR.includes(d?.del) && (d.fritext === null || typeof d.fritext === "string"),
          )
        : [],
      svar,
      // Ett kvitto som hunnit kopplas nagon annanstans finns inte langre i
      // listan och ska inte heller skickas.
      valda: Array.isArray(u.valda) ? u.valda.filter((id) => kvittoIder.has(id)) : [],
    };
  } catch {
    return null;
  }
}

function sparaUtkast(nyckel: string, u: Utkast): void {
  try {
    // Ett tomt utkast finns inte – samma regel som for kvitton.
    if (arTomt(u)) window.localStorage.removeItem(nyckel);
    else window.localStorage.setItem(nyckel, JSON.stringify(u));
  } catch {
    // Utan lagring blir flodet som utan utkast: det som skrivits finns kvar
    // tills sidan lamnas.
  }
}

function glomUtkast(nyckel: string): void {
  try {
    window.localStorage.removeItem(nyckel);
  } catch {
    // Se ovan.
  }
}

// ---- Flodet -----------------------------------------------------------------

const TEXTLANK_KLASS =
  "text-center font-granssnitt text-sm text-text-sekundar underline hover:text-text-primar";

export function NyttProjektFlode({
  bostadId,
  upplatelseform,
  kvitton,
}: {
  bostadId: string;
  /** Avgor vilka knappar bostadsdelsfragan visar – inget annat. */
  upplatelseform: Upplatelseform;
  /** Kvitton som annu inte hor till nagot projekt, i den ordning de visas. */
  kvitton: ValbartKvitto[];
}) {
  const router = useRouter();
  const nyckel = utkastNyckel(bostadId);
  const [resultat, action, pagar] = useActionState(skapaProjekt, START);
  const klar = resultat.skapat !== undefined;

  const [steg, setSteg] = useState<Steg>(1);
  const [namn, setNamn] = useState("");
  const [bostadsdelar, setBostadsdelar] = useState<BostadsdelSvar[]>([]);
  const [svar, setSvar] = useState<FragetradetUIState>(TOMMA_SVAR);
  const [valda, setValda] = useState<Set<string>>(new Set());
  // Bostadsdelsfragan har sitt eget tillstand och laser sitt startvarde en
  // gang; ett aterlast utkast ger den en ny instans.
  const [instans, setInstans] = useState(0);
  const [utkastLast, setUtkastLast] = useState(false);
  // Flodet borjade pa ett sparat utkast. Da sager skarmen det och erbjuder
  // Börja om (docs/design.md, "Och ett utkast går alltid att kasta").
  const [franUtkast, setFranUtkast] = useState(false);

  const valtBelopp = kvitton
    .filter((k) => valda.has(k.id))
    .reduce((s, k) => s + k.bidrag, 0);

  const { formRef, hanteraSubmit, visaFel, faltfel, formularfel, rensa } =
    useFormularfel<FragetradetFaltnamn>({
      pagar: pagar || klar,
      resultat,
      validera: (formData) => {
        const fel = fragetradetsValidering(valtBelopp)(formData);
        if (fel) setSteg(STEG_FOR_FALT[fel.falt]);
        return fel;
      },
    });

  // Utkastet lases efter forsta renderingen – localStorage finns inte pa
  // servern, och sidan ska se likadan ut dar som i webblasarens forsta bild.
  useEffect(() => {
    const u = lasUtkast(nyckel, new Set(kvitton.map((k) => k.id)));
    if (u) {
      setSteg(u.steg);
      setNamn(u.namn);
      setBostadsdelar(u.bostadsdelar);
      setSvar(u.svar);
      setValda(new Set(u.valda));
      setInstans((n) => n + 1);
      setFranUtkast(!arTomt(u));
    }
    setUtkastLast(true);
    // Bara vid start: ett utkast som andras medan flodet ar oppet ar vart eget.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!utkastLast || klar) return;
    sparaUtkast(nyckel, { steg, namn, bostadsdelar, svar, valda: [...valda] });
  }, [utkastLast, klar, nyckel, steg, namn, bostadsdelar, svar, valda]);

  // Sparat: utkastet ar besvarat, och projektet ar dit hon ska.
  useEffect(() => {
    if (!resultat.skapat) return;
    glomUtkast(nyckel);
    router.replace(`/projekt/${resultat.skapat}`);
  }, [resultat.skapat, nyckel, router]);

  // Ett fel fran servern i ett tidigare steg visas dar fragan star.
  useEffect(() => {
    if (resultat.falt) setSteg(STEG_FOR_FALT[resultat.falt]);
  }, [resultat]);

  // Varje nytt steg borjar overst (docs/design.md, "Varje nytt steg i ett
  // flerstegsflode borjar overst").
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [steg]);

  /** Nasta: steget provas med samma tolkning som servern, utom merkostnadens
   *  tak – det beror pa kvittona, som valjs sist, och provas vid Spara. */
  function vidare() {
    if (steg === 1 || steg === 3) {
      const fel = fragetradetsValidering(Number.POSITIVE_INFINITY)(
        new FormData(formRef.current!),
      );
      if (fel && STEG_FOR_FALT[fel.falt] <= steg) {
        setSteg(STEG_FOR_FALT[fel.falt]);
        visaFel(fel);
        return;
      }
    }
    rensa();
    setSteg((s) => Math.min(ANTAL_STEG, s + 1) as Steg);
  }

  function tillbaka() {
    rensa();
    setSteg((s) => Math.max(1, s - 1) as Steg);
  }

  // Enter i ett textfalt skickar annars hela formularet fran forsta steget.
  function hanteraTangent(e: KeyboardEvent<HTMLFormElement>) {
    if (
      e.key === "Enter" &&
      steg < ANTAL_STEG &&
      e.target instanceof HTMLInputElement
    ) {
      e.preventDefault();
      vidare();
    }
  }

  /** Kastar utkastet och borjar fran forsta steget med tomma falt. */
  function borjaOm() {
    glomUtkast(nyckel);
    setSteg(1);
    setNamn("");
    setBostadsdelar([]);
    setSvar(TOMMA_SVAR);
    setValda(new Set());
    setInstans((n) => n + 1);
    setFranUtkast(false);
    rensa();
  }

  function vaxla(id: string) {
    setValda((f) => {
      const ny = new Set(f);
      if (ny.has(id)) ny.delete(id);
      else ny.add(id);
      return ny;
    });
    rensa();
  }

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(e) => {
        if (steg < ANTAL_STEG) {
          e.preventDefault();
          vidare();
          return;
        }
        hanteraSubmit(e);
      }}
      onKeyDown={hanteraTangent}
      noValidate
      className="flex flex-col"
    >
      <div className="border-b border-linje px-4 py-3">
        <Avdelningsrubrik>
          {steg} av {ANTAL_STEG}
        </Avdelningsrubrik>
      </div>

      <div className="flex flex-col gap-6 p-5">
        {franUtkast ? (
          <Meddelanderuta>Det här är ett utkast du började på tidigare.</Meddelanderuta>
        ) : null}

        <div hidden={steg !== 1}>
          <NamnFalt
            varde={namn}
            fel={faltfel?.falt === "namn" ? faltfel.fel : undefined}
            onChange={(v) => {
              setNamn(v);
              rensa();
            }}
          />
        </div>

        {/* Frivillig (docs/design.md, "Vilken del av bostaden projektet
            rörde") – ingen validering, den kan inte stoppa projektet. */}
        <div hidden={steg !== 2}>
          <BostadsdelFraga
            key={instans}
            upplatelseform={upplatelseform}
            initial={bostadsdelar}
            onAndring={setBostadsdelar}
          />
        </div>

        {/* Fraga 2 och framat, med all grenning. Raden om hela beloppet visas
            inte: kvittona ar inte valda an, och beloppet finns inte. */}
        <div hidden={steg !== 3}>
          <Fragetradet
            varden={svar}
            fel={faltfel}
            // Merkostnaden behover ett belopp, och kvittona valjs i steg 4.
            visaMerkostnad={false}
            onChange={(delvis) => {
              setSvar((s) => ({ ...s, ...delvis }));
              rensa();
            }}
          />
        </div>

        <fieldset hidden={steg !== 4} className="min-w-0">
          <legend className="font-rubrik text-lg text-text-primar">
            {namn.trim()
              ? `Vilka kvitton hörde till ”${namn.trim()}”?`
              : "Vilka kvitton hörde hit?"}
          </legend>
          {kvitton.length > 0 ? (
            <>
              <p className={`mt-1 ${HJALPTEXT_KLASS}`}>
                Kvitton som inte hör till något projekt än. Du kan spara utan
                att välja något och koppla kvitton till projektet senare.
              </p>
              <KvittoKryssLista kvitton={kvitton} valda={valda} onVaxla={vaxla} />
            </>
          ) : (
            <p className={`mt-1 ${HJALPTEXT_KLASS}`}>
              Alla kvitton du lagt in hör redan till ett projekt. Spara, så kan
              du koppla kvitton hit när du lagt in dem.
            </p>
          )}
        </fieldset>

        {/* Merkostnaden, fraga 5:s foljd, stalls bara nar de valda kvittona
            har ett belopp att vaga den mot. Utan skjuts den upp, och
            projektet bar en upplysning tills ett kvitto kopplats
            (docs/design.md, "Att skapa ett projekt"). */}
        {steg === ANTAL_STEG && svar.battreEllerLiknande === "battre" && valtBelopp > 0 ? (
          <MerkostnadFalt
            varde={svar.merkostnadText}
            fel={faltfel?.falt === "merkostnad" ? faltfel.fel : undefined}
            onChange={(delvis) => {
              setSvar((s) => ({ ...s, ...delvis }));
              rensa();
            }}
          />
        ) : null}

        <input type="hidden" name="namn" value={namn} />
        <FragetradetDoldaFalt svar={svar} />
        {[...valda].map((id) => (
          <input key={id} type="hidden" name="kostnad_ider" value={id} />
        ))}

        {formularfel ? (
          <p
            role="alert"
            tabIndex={-1}
            {...{ [FORMULARFEL_ATTRIBUT]: "" }}
            className={`${FALTFEL_KLASS} outline-none`}
          >
            {formularfel}
          </p>
        ) : null}

        {steg < ANTAL_STEG ? (
          <button type="button" onClick={vidare} className={PRIMARKNAPP_KLASS}>
            Nästa
          </button>
        ) : (
          <button type="submit" disabled={pagar || klar} className={PRIMARKNAPP_KLASS}>
            {pagar || klar ? "Sparar…" : "Spara"}
          </button>
        )}

        {steg > 1 ? (
          <button type="button" onClick={tillbaka} className={TEXTLANK_KLASS}>
            Tillbaka
          </button>
        ) : null}

        {/* Fortsatt senare lovar ingenting om var: utkastet ligger i den har
            webblasaren, pa den har enheten (docs/design.md). */}
        <div className="flex justify-center gap-6">
          <Link href="/projekt" className={TEXTLANK_KLASS}>
            Fortsätt senare
          </Link>
          {franUtkast ? (
            <button type="button" onClick={borjaOm} className={TEXTLANK_KLASS}>
              Börja om
            </button>
          ) : null}
        </div>

        {/* Avskild langst ned, nar fragorna star pa skarmen (docs/design.md,
            "Projektfrågorna"). */}
        {steg === 3 ? (
          <div className="border-t border-linje pt-4">
            <Friskrivning />
          </div>
        ) : null}
      </div>
    </form>
  );
}
