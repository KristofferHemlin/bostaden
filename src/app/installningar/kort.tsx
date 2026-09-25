"use client";

// Installningssidans fyra kort (docs/design.md, "Installningssidan"). Sidan
// visar VARDEN, inte falt: etikett till vanster, varde till hoger, samma form
// som kvittots detaljvy (src/app/kostnad/[id]/page.tsx). Ett tomt varde star
// som ett dampat "Inte ifyllt". En dampad "Ändra" i kortets horn oppnar just
// det kortet som formular med falt, hjalptexter och Spara/Avbryt – hjalp-
// texterna syns bara dar. Ovriga kort ligger kvar i lasläge.
//
// VARJE KORT SPARAR BARA SINA EGNA FALT (den viktigaste punkten – se
// installningar/actions.ts): tre helt fristaende server actions, en per kort.
// Ett kort vet ingenting om de andras falt och kan darfor aldrig skriva over
// dem, inte ens med ett standardvarde for nagot som inte skickades med.
//
// ETT OPPET KORT I TAGET. Oppnas ett annat medan det forsta har osparade
// andringar visas en fraga om de ska sparas eller kastas (BytKortDialog).
// Dirty-sparning sker via en enda onChange pa respektive <form> – den fangar
// bubblande native input/change-handelser fran ALLA falt, aven de som ligger
// i kontrollerade underkomponenter (BeloppFalt, AgarandelFalt, DatumFalt),
// sa inget falt-for-falt-tillstand behover lyftas upp hit bara for det.
// Kortvalsknapparna (upplatelseform, forsta agaren, ombildning) ar <button>,
// inte <input>, och rapporterar dirty for hand i sin onClick.
//
// Redigeringslaget monteras och avmonteras helt (ingen CSS-doljd form) – ett
// "Avbryt" behover darfor ingen egen reset-logik, det rader bort hela
// EditForm-tradet och nasta gang kortet oppnas monteras det fran props igen.

import Link from "next/link";
import { createPortal } from "react-dom";
import { useActionState, useRef, useState } from "react";
import { loggaUt } from "@/app/login/actions";
import { Kortval } from "@/app/projekt/fragetradet";
import { AdressFalt } from "@/app/registrera/adress-falt";
import { AgarandelFalt } from "@/components/agarandel-falt";
import { BeloppFalt } from "@/components/belopp-falt";
import { DatumFalt } from "@/components/datum-falt";
import {
  Falt,
  INPUT_KLASS,
  Kort,
  PRIMARKNAPP_KLASS,
  SEKUNDARKNAPP_KLASS,
} from "@/components/skarm";
import { useForhindraDubbelinskick } from "@/lib/dubbelinskick";
import { formateraBeloppInmatning, formateraKronor } from "@/lib/format";
import { useNarKlar } from "@/lib/nar-klar";
import { ArkivexportKnapp } from "./arkivexport-knapp";
import {
  sparaAgandet,
  sparaBostaden,
  sparaKopet,
  type InstallningarResultat,
} from "./actions";
import { KontoRadera } from "./konto-radera";

type KortNamn = "bostaden" | "kopet" | "agandet";

const KORT_TITEL: Record<KortNamn, string> = {
  bostaden: "Bostaden",
  kopet: "Köpet",
  agandet: "Ägandet",
};

const START: InstallningarResultat = {};

export interface BostadenData {
  adress: string;
  ort: string;
  platsId: string;
  lat: string;
  lng: string;
  upplatelseform: "bostadsratt" | "fastighet";
  tilltradesdatum: string;
  identifiering: string;
  sald: boolean;
}

export interface KopetData {
  storlek: string;
  kopeskillingOren: bigint | null;
  kopkostnaderOren: bigint | null;
  kapitaltillskottOren: bigint | null;
  arBostadsratt: boolean;
}

export interface AgandetData {
  agarandelProcent: number;
  nybyggdVidForvarv: boolean;
  ombildningFranHyresratt: boolean;
}

export function InstallningarKort({
  bostaden,
  kopet,
  agandet,
  epost,
}: {
  bostaden: BostadenData;
  kopet: KopetData;
  agandet: AgandetData;
  epost: string;
}) {
  const [oppetKort, setOppetKort] = useState<KortNamn | null>(null);
  const [dirty, setDirty] = useState(false);
  const [byteTill, setByteTill] = useState<KortNamn | null>(null);
  const [dialogSparar, setDialogSparar] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function begarOppna(kort: KortNamn) {
    if (oppetKort === kort) return;
    if (oppetKort && dirty) {
      setByteTill(kort);
      return;
    }
    setOppetKort(kort);
  }

  function stangUtanAtSpara() {
    setOppetKort(null);
    setDirty(false);
  }

  function kastaOchByt() {
    setDirty(false);
    setOppetKort(byteTill);
    setByteTill(null);
  }

  function sparaOchByt() {
    setDialogSparar(true);
    formRef.current?.requestSubmit();
  }

  // Kallas av det oppna kortets EditForm nar dess sparning ar klar, lyckad
  // eller inte. Lyckas den och nagon bytesbegaran vantar (satt via dialogen)
  // fullfoljs bytet; annars stannar anvandaren kvar pa samma kort och ser
  // felet dar. Misslyckas den avbryts en eventuell vantande bytesbegaran –
  // anvandaren far se felet i stallet for att tyst hamna pa ett annat kort.
  function narKlar(fel: boolean) {
    setDialogSparar(false);
    if (fel) {
      setByteTill(null);
      return;
    }
    setDirty(false);
    if (byteTill) {
      setOppetKort(byteTill);
      setByteTill(null);
    } else {
      setOppetKort(null);
    }
  }

  return (
    <>
      <Kort>
        <BostadenKort
          data={bostaden}
          oppen={oppetKort === "bostaden"}
          formRef={formRef}
          onAndra={() => begarOppna("bostaden")}
          onAvbryt={stangUtanAtSpara}
          onDirty={() => setDirty(true)}
          onKlar={narKlar}
        />
      </Kort>

      <Kort>
        <KopetKort
          data={kopet}
          oppen={oppetKort === "kopet"}
          formRef={formRef}
          onAndra={() => begarOppna("kopet")}
          onAvbryt={stangUtanAtSpara}
          onDirty={() => setDirty(true)}
          onKlar={narKlar}
        />
      </Kort>

      <Kort>
        <AgandetKort
          data={agandet}
          oppen={oppetKort === "agandet"}
          formRef={formRef}
          onAndra={() => begarOppna("agandet")}
          onAvbryt={stangUtanAtSpara}
          onDirty={() => setDirty(true)}
          onKlar={narKlar}
        />
      </Kort>

      <Kort>
        <DittKontoKort epost={epost} />
      </Kort>

      {byteTill && oppetKort ? (
        <BytKortDialog
          franKort={KORT_TITEL[oppetKort]}
          pagar={dialogSparar}
          onSpara={sparaOchByt}
          onKasta={kastaOchByt}
          onAvbryt={() => setByteTill(null)}
        />
      ) : null}
    </>
  );
}

// Delad radkomponent for lasläget (docs/design.md, "Installningssidan":
// "samma form som kvittots detaljvy"). Ett tomt varde visas dampat som "Inte
// ifyllt" – inte tankstrecket kvittovyn anvander, det later som "okant"
// snarare an "inget angivet" for ett fritt valbart falt.
function Rad({ etikett, varde }: { etikett: string; varde: string | null }) {
  const tomt = varde == null || varde.trim() === "";
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <span className="text-text-dampad">{etikett}</span>
      <span
        className={`text-right ${tomt ? "text-text-dampad" : "text-text-primar"}`}
      >
        {tomt ? "Inte ifyllt" : varde}
      </span>
    </div>
  );
}

function KortHuvud({
  titel,
  visaAndra,
  onAndra,
}: {
  titel: string;
  visaAndra: boolean;
  onAndra: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 pb-0">
      <h2 className="font-rubrik text-base text-text-primar">{titel}</h2>
      {visaAndra ? (
        <button
          type="button"
          onClick={onAndra}
          className="font-granssnitt text-sm text-text-dampad underline underline-offset-2 hover:text-text-sekundar"
        >
          Ändra
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bostaden: adress, ort, upplatelseform, tilltradesdatum, identifiering.
// ---------------------------------------------------------------------------

const UPPLATELSEFORMER = [
  { varde: "bostadsratt" as const, etikett: "Bostadsrätt" },
  { varde: "fastighet" as const, etikett: "Villa eller radhus" },
];

function identifieringEtikett(arBostadsratt: boolean): string {
  return arBostadsratt ? "Föreningens namn" : "Fastighetsbeteckning";
}

function bytestext(mal: "bostadsratt" | "fastighet"): string {
  const nyEtikett = identifieringEtikett(mal === "bostadsratt");
  const gammalEtikett = identifieringEtikett(mal !== "bostadsratt").toLowerCase();
  return `Identifieringen behöver skrivas om – fältet blir "${nyEtikett}", och ${gammalEtikett} hör inte hemma där längre.`;
}

// Tunn vaxlare: monterar ANTINGEN lasläget ELLER redigeringsformularet – ALDRIG
// samma komponent kvar med ett internt if. Bada skulle annars vara samma
// funktionskomponent, vars useState (upplatelseformVal, bytesforslag m.fl.)
// da hade OVERLEVT en stangning utan att spara – ett "Avbryt" hade sett ut
// att fungera men lamnat gamla, osparade varden kvar i faltet nasta gang
// kortet oppnades. Genom att lat- OCH redigeringslaget vara TVA SKILDA
// komponenter monterar React av redigeringsformularets tillstand helt nar
// `oppen` blir false, precis som ett riktigt "kasta" ska gora.
function BostadenKort({
  data,
  oppen,
  formRef,
  onAndra,
  onAvbryt,
  onDirty,
  onKlar,
}: {
  data: BostadenData;
  oppen: boolean;
  formRef: React.RefObject<HTMLFormElement | null>;
  onAndra: () => void;
  onAvbryt: () => void;
  onDirty: () => void;
  onKlar: (fel: boolean) => void;
}) {
  if (!oppen) {
    return (
      <>
        <KortHuvud titel="Bostaden" visaAndra onAndra={onAndra} />
        <div className="p-4 font-granssnitt text-sm">
          <Rad etikett="Adress" varde={data.adress} />
          <Rad etikett="Ort" varde={data.ort} />
          <Rad
            etikett="Upplåtelseform"
            varde={
              UPPLATELSEFORMER.find((o) => o.varde === data.upplatelseform)
                ?.etikett ?? null
            }
          />
          <Rad etikett="Tillträdesdatum" varde={data.tilltradesdatum} />
          <Rad
            etikett={identifieringEtikett(data.upplatelseform === "bostadsratt")}
            varde={data.identifiering}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <KortHuvud titel="Bostaden" visaAndra={false} onAndra={onAndra} />
      <BostadenEditForm
        data={data}
        formRef={formRef}
        onAvbryt={onAvbryt}
        onDirty={onDirty}
        onKlar={onKlar}
      />
    </>
  );
}

function BostadenEditForm({
  data,
  formRef,
  onAvbryt,
  onDirty,
  onKlar,
}: {
  data: BostadenData;
  formRef: React.RefObject<HTMLFormElement | null>;
  onAvbryt: () => void;
  onDirty: () => void;
  onKlar: (fel: boolean) => void;
}) {
  const [resultat, action, pagar] = useActionState(sparaBostaden, START);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);
  useNarKlar(pagar, Boolean(resultat.fel), onKlar);

  const [upplatelseformVal, setUpplatelseformVal] = useState(data.upplatelseform);
  const [bytesforslag, setBytesforslag] = useState<
    "bostadsratt" | "fastighet" | null
  >(null);
  const arBostadsratt = upplatelseformVal === "bostadsratt";

  return (
    <>
      <form
        ref={formRef}
        action={action}
        onSubmit={hanteraSubmit}
        onChange={onDirty}
        className="flex flex-col gap-5 p-4"
      >
        <AdressFalt
          forval={{
            adress: data.adress,
            ort: data.ort,
            platsId: data.platsId,
            lat: data.lat,
            lng: data.lng,
          }}
        />

        <div>
          <span className="mb-1.5 block font-granssnitt text-sm text-text-sekundar">
            Vad äger du?
          </span>
          <div className="grid grid-cols-2 gap-2">
            {UPPLATELSEFORMER.map((o) => {
              const vald = upplatelseformVal === o.varde;
              return (
                <button
                  key={o.varde}
                  type="button"
                  aria-pressed={vald}
                  aria-disabled={data.sald}
                  onClick={() => {
                    // Last efter forsaljning (produktspec 4.8) – korten visas
                    // som valda men gar inte att andra. Fore forsaljningen
                    // kraver ett byte en bekraftelse i stallet for att sla
                    // igenom direkt.
                    if (data.sald || vald) return;
                    setBytesforslag(o.varde);
                  }}
                  className={[
                    "rounded-lg border-2 px-3 py-3 text-center font-granssnitt text-sm text-text-primar transition-colors",
                    vald
                      ? "border-text-primar bg-yta-nedsankt"
                      : "border-linje hover:border-text-dampad",
                    data.sald ? "cursor-default opacity-70" : "",
                  ].join(" ")}
                >
                  {o.etikett}
                </button>
              );
            })}
          </div>
          <input type="hidden" name="upplatelseform" value={upplatelseformVal} />

          {data.sald ? (
            <p className="mt-1.5 font-granssnitt text-xs text-text-dampad">
              Låst efter försäljningen – underlaget är framtaget och blanketten
              vald.
            </p>
          ) : null}

          {bytesforslag ? (
            <div className="mt-2 flex flex-col gap-2 rounded-lg bg-yta-nedsankt p-3">
              <p className="font-granssnitt text-sm text-text-primar">
                {bytestext(bytesforslag)}
              </p>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setUpplatelseformVal(bytesforslag);
                    setBytesforslag(null);
                    onDirty();
                  }}
                  className="font-granssnitt text-sm font-medium text-text-primar underline"
                >
                  Byt
                </button>
                <button
                  type="button"
                  onClick={() => setBytesforslag(null)}
                  className="font-granssnitt text-sm text-text-sekundar"
                >
                  Avbryt
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <Falt etikett="Tillträdesdatum" obligatoriskt hjalp="Baslinjen för skickbedömningen – gränsen för vilka utgifter som är dina.">
          <DatumFalt
            name="tilltradesdatum"
            defaultValue={data.tilltradesdatum}
            framtidsFelmeddelande="Tillträdesdatum kan inte ligga i framtiden."
          />
        </Falt>

        <Falt
          etikett={identifieringEtikett(arBostadsratt)}
          hjalp={
            arBostadsratt
              ? "Står i årsredovisningen eller på överlåtelseavtalet."
              : 'Står på lagfarten eller köpekontraktet, t.ex. "Söderhamn Kvarnen 3:1".'
          }
        >
          <input
            type="text"
            name="identifiering"
            defaultValue={data.identifiering}
            className={INPUT_KLASS}
            placeholder={
              arBostadsratt ? "t.ex. Brf Ulriksborg" : "t.ex. Söderhamn Kvarnen 3:1"
            }
          />
        </Falt>

        {resultat.fel ? (
          <p className="font-granssnitt text-sm text-accent-mork">{resultat.fel}</p>
        ) : null}

        <div className="flex flex-col gap-2">
          <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
            {pagar ? "Sparar…" : "Spara"}
          </button>
          <button
            type="button"
            onClick={onAvbryt}
            disabled={pagar}
            className={SEKUNDARKNAPP_KLASS}
          >
            Avbryt
          </button>
        </div>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------
// Kopet: kopeskilling, kopkostnader, kapitaltillskott (bara bostadsratt),
// storlek.
// ---------------------------------------------------------------------------

function orenTillKronsträng(oren: bigint | null): string {
  return oren != null ? formateraKronor(Number(oren)) : "";
}

function KopetKort({
  data,
  oppen,
  formRef,
  onAndra,
  onAvbryt,
  onDirty,
  onKlar,
}: {
  data: KopetData;
  oppen: boolean;
  formRef: React.RefObject<HTMLFormElement | null>;
  onAndra: () => void;
  onAvbryt: () => void;
  onDirty: () => void;
  onKlar: (fel: boolean) => void;
}) {
  if (!oppen) {
    return (
      <>
        <KortHuvud titel="Köpet" visaAndra onAndra={onAndra} />
        <div className="p-4 font-granssnitt text-sm">
          <Rad etikett="Köpeskilling" varde={orenTillKronsträng(data.kopeskillingOren)} />
          <Rad etikett="Köpkostnader" varde={orenTillKronsträng(data.kopkostnaderOren)} />
          {data.arBostadsratt ? (
            <Rad
              etikett="Kapitaltillskott"
              varde={orenTillKronsträng(data.kapitaltillskottOren)}
            />
          ) : null}
          <Rad etikett="Storlek" varde={data.storlek ? `${data.storlek} m²` : null} />
        </div>
      </>
    );
  }

  return (
    <>
      <KortHuvud titel="Köpet" visaAndra={false} onAndra={onAndra} />
      <KopetEditForm
        data={data}
        formRef={formRef}
        onAvbryt={onAvbryt}
        onDirty={onDirty}
        onKlar={onKlar}
      />
    </>
  );
}

function KopetEditForm({
  data,
  formRef,
  onAvbryt,
  onDirty,
  onKlar,
}: {
  data: KopetData;
  formRef: React.RefObject<HTMLFormElement | null>;
  onAvbryt: () => void;
  onDirty: () => void;
  onKlar: (fel: boolean) => void;
}) {
  const [resultat, action, pagar] = useActionState(sparaKopet, START);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);
  useNarKlar(pagar, Boolean(resultat.fel), onKlar);

  const [kopeskilling, setKopeskilling] = useState(() =>
    formateraBeloppInmatning(
      data.kopeskillingOren != null ? String(data.kopeskillingOren / 100n) : "",
    ),
  );
  const [kopkostnader, setKopkostnader] = useState(() =>
    formateraBeloppInmatning(
      data.kopkostnaderOren != null ? String(data.kopkostnaderOren / 100n) : "",
    ),
  );
  const [kapitaltillskott, setKapitaltillskott] = useState(() =>
    formateraBeloppInmatning(
      data.kapitaltillskottOren != null
        ? String(data.kapitaltillskottOren / 100n)
        : "",
    ),
  );

  return (
    <>
      <form
        ref={formRef}
        action={action}
        onSubmit={hanteraSubmit}
        onChange={onDirty}
        className="flex flex-col gap-5 p-4"
      >
        <Falt
          etikett="Köpeskilling"
          hjalp="Står på köpekontraktet eller överlåtelseavtalet."
        >
          <BeloppFalt
            name="kopeskilling"
            value={kopeskilling}
            onValueChange={setKopeskilling}
            className={INPUT_KLASS}
            placeholder="t.ex. 3 250 000"
          />
        </Falt>

        <Falt
          etikett="Köpkostnader"
          hjalp={
            data.arBostadsratt
              ? "Överlåtelseavgiften du betalade när du köpte bostadsrätten."
              : "Lagfart, pantbrev och inköpsprovision vid köpet."
          }
        >
          <BeloppFalt
            name="kopkostnader"
            value={kopkostnader}
            onValueChange={setKopkostnader}
            className={INPUT_KLASS}
            placeholder="t.ex. 45 000"
          />
        </Falt>

        {data.arBostadsratt ? (
          <Falt
            etikett="Kapitaltillskott"
            hjalp="Föreningens amorteringar under din innehavstid – står i uppgiften från föreningen."
          >
            <BeloppFalt
              name="kapitaltillskott"
              value={kapitaltillskott}
              onValueChange={setKapitaltillskott}
              className={INPUT_KLASS}
              placeholder="t.ex. 60 000"
            />
          </Falt>
        ) : null}

        <Falt etikett="Storlek" hjalp="Boarea i kvadratmeter.">
          <input
            type="text"
            name="storlek"
            inputMode="numeric"
            defaultValue={data.storlek}
            className={INPUT_KLASS}
            placeholder="t.ex. 72"
          />
        </Falt>

        {resultat.fel ? (
          <p className="font-granssnitt text-sm text-accent-mork">{resultat.fel}</p>
        ) : null}

        <div className="flex flex-col gap-2">
          <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
            {pagar ? "Sparar…" : "Spara"}
          </button>
          <button
            type="button"
            onClick={onAvbryt}
            disabled={pagar}
            className={SEKUNDARKNAPP_KLASS}
          >
            Avbryt
          </button>
        </div>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------
// Agandet: agarandel, forsta agaren, ombildning fran hyresratt.
// ---------------------------------------------------------------------------

const HJALP_FORSTA_AGARE =
  "Svara ja om bostaden var nybyggd eller nyproduktion när du köpte den, eller om du köpte en tomt och byggde hus på den.";
const HJALP_OMBILDNING =
  "Den som köpte sin hyresrätt vid ombildningen är formellt första ägare av bostadsrätten, men lägenheten fanns och var använd sedan tidigare – då gäller vanliga regler för reparationer.";

function AgandetKort({
  data,
  oppen,
  formRef,
  onAndra,
  onAvbryt,
  onDirty,
  onKlar,
}: {
  data: AgandetData;
  oppen: boolean;
  formRef: React.RefObject<HTMLFormElement | null>;
  onAndra: () => void;
  onAvbryt: () => void;
  onDirty: () => void;
  onKlar: (fel: boolean) => void;
}) {
  if (!oppen) {
    return (
      <>
        <KortHuvud titel="Ägandet" visaAndra onAndra={onAndra} />
        <div className="p-4 font-granssnitt text-sm">
          <Rad etikett="Ägarandel" varde={`${data.agarandelProcent} %`} />
          <Rad etikett="Första ägaren" varde={data.nybyggdVidForvarv ? "Ja" : "Nej"} />
          {data.nybyggdVidForvarv ? (
            <Rad
              etikett="Ombildning från hyresrätt"
              varde={data.ombildningFranHyresratt ? "Ja" : "Nej"}
            />
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <KortHuvud titel="Ägandet" visaAndra={false} onAndra={onAndra} />
      <AgandetEditForm
        data={data}
        formRef={formRef}
        onAvbryt={onAvbryt}
        onDirty={onDirty}
        onKlar={onKlar}
      />
    </>
  );
}

function AgandetEditForm({
  data,
  formRef,
  onAvbryt,
  onDirty,
  onKlar,
}: {
  data: AgandetData;
  formRef: React.RefObject<HTMLFormElement | null>;
  onAvbryt: () => void;
  onDirty: () => void;
  onKlar: (fel: boolean) => void;
}) {
  const [resultat, action, pagar] = useActionState(sparaAgandet, START);
  const hanteraSubmit = useForhindraDubbelinskick(pagar);
  useNarKlar(pagar, Boolean(resultat.fel), onKlar);

  const [forstaAgare, setForstaAgare] = useState<"ja" | "nej">(
    data.nybyggdVidForvarv ? "ja" : "nej",
  );
  const [ombildning, setOmbildning] = useState<"ja" | "nej">(
    data.ombildningFranHyresratt ? "ja" : "nej",
  );

  return (
    <>
      <form
        ref={formRef}
        action={action}
        onSubmit={hanteraSubmit}
        onChange={onDirty}
        className="flex flex-col gap-5 p-4"
      >
        <Falt
          etikett="Ägarandel"
          hjalp="Anges i procent. Lämna tomt om du äger hela bostaden själv."
        >
          <AgarandelFalt
            name="agarandel"
            defaultValue={
              data.agarandelProcent === 100 ? "" : String(data.agarandelProcent)
            }
          />
        </Falt>

        <div>
          <span className="mb-1.5 block font-granssnitt text-sm text-text-sekundar">
            Var du första ägaren av bostaden?
          </span>
          <div className="grid grid-cols-2 gap-2">
            <Kortval
              vald={forstaAgare === "ja"}
              text="Ja"
              onClick={() => {
                setForstaAgare("ja");
                onDirty();
              }}
            />
            <Kortval
              vald={forstaAgare === "nej"}
              text="Nej"
              onClick={() => {
                setForstaAgare("nej");
                setOmbildning("nej");
                onDirty();
              }}
            />
          </div>
          <p className="mt-1.5 font-granssnitt text-xs text-text-dampad">
            {HJALP_FORSTA_AGARE}
          </p>
        </div>
        <input type="hidden" name="forsta_agare" value={forstaAgare} />

        {forstaAgare === "ja" ? (
          <div>
            <span className="mb-1.5 block font-granssnitt text-sm text-text-sekundar">
              Köpte du bostaden i samband med ombildning från hyresrätt?
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Kortval
                vald={ombildning === "ja"}
                text="Ja"
                onClick={() => {
                  setOmbildning("ja");
                  onDirty();
                }}
              />
              <Kortval
                vald={ombildning === "nej"}
                text="Nej"
                onClick={() => {
                  setOmbildning("nej");
                  onDirty();
                }}
              />
            </div>
            <p className="mt-1.5 font-granssnitt text-xs text-text-dampad">
              {HJALP_OMBILDNING}
            </p>
          </div>
        ) : null}
        <input type="hidden" name="ombildning" value={ombildning} />

        {resultat.fel ? (
          <p className="font-granssnitt text-sm text-accent-mork">{resultat.fel}</p>
        ) : null}

        <div className="flex flex-col gap-2">
          <button type="submit" disabled={pagar} className={PRIMARKNAPP_KLASS}>
            {pagar ? "Sparar…" : "Spara"}
          </button>
          <button
            type="button"
            onClick={onAvbryt}
            disabled={pagar}
            className={SEKUNDARKNAPP_KLASS}
          >
            Avbryt
          </button>
        </div>
      </form>
    </>
  );
}

// ---------------------------------------------------------------------------
// Ditt konto: inget lasläge – bara handlingar (docs/design.md,
// "Installningssidan").
// ---------------------------------------------------------------------------

function DittKontoKort({ epost }: { epost: string }) {
  return (
    <>
      <div className="p-4 pb-0">
        <h2 className="font-rubrik text-base text-text-primar">Ditt konto</h2>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <p className="font-granssnitt text-sm text-text-sekundar">
          Ladda ner alla dina kvitton och fakturor som ett zip-arkiv – till
          exempel om du vill ta med dig dokumentationen om du slutar använda
          tjänsten.
        </p>
        <ArkivexportKnapp />

        <form action={loggaUt}>
          <button type="submit" className={SEKUNDARKNAPP_KLASS}>
            Logga ut
          </button>
        </form>

        <div className="flex flex-col items-start gap-3 border-t border-linje pt-3">
          <Link
            href="/integritetspolicy"
            className="font-granssnitt text-sm text-text-dampad underline underline-offset-2 hover:text-text-sekundar"
          >
            Integritetspolicyn
          </Link>
          <KontoRadera epost={epost} />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Bekraftelsen nar ett annat kort oppnas medan det aktuella har osparade
// andringar (docs/design.md, "Installningssidan").
// ---------------------------------------------------------------------------

function BytKortDialog({
  franKort,
  pagar,
  onSpara,
  onKasta,
  onAvbryt,
}: {
  franKort: string;
  pagar: boolean;
  onSpara: () => void;
  onKasta: () => void;
  onAvbryt: () => void;
}) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="byt-kort-rubrik"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--text-primar)_90%,transparent)] p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-yta-upphojd p-5">
        <h2 id="byt-kort-rubrik" className="font-rubrik text-base text-text-primar">
          Osparade ändringar
        </h2>
        <p className="mt-2 font-granssnitt text-sm text-text-sekundar">
          Du har osparade ändringar i {franKort}. Vill du spara dem innan du
          fortsätter?
        </p>
        <div className="mt-4 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onSpara}
            disabled={pagar}
            className={PRIMARKNAPP_KLASS}
          >
            {pagar ? "Sparar…" : "Spara ändringarna"}
          </button>
          <button
            type="button"
            onClick={onKasta}
            disabled={pagar}
            className="font-granssnitt text-sm text-text-dampad underline disabled:opacity-60"
          >
            Kasta ändringarna
          </button>
          <button
            type="button"
            onClick={onAvbryt}
            disabled={pagar}
            className="font-granssnitt text-sm text-text-sekundar disabled:opacity-60"
          >
            Fortsätt redigera
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
