"use client";

// Adressfaltet i registreringens bostadssteg (docs/design.md,
// Registreringsflodet). Faltet ar ALLTID ett vanligt textfalt:
//
//  - Finns NEXT_PUBLIC_GOOGLE_PLACES_KEY visas forslag under faltet medan man
//    skriver. Valjer man ett forslag fylls ort, place_id och koordinater i
//    automatiskt (dolda falt som foljer med formularet).
//  - Saknas nyckeln, svarar tjansten inte, eller struntar anvandaren i
//    forslagen: faltet beter sig som ren fritext. Inga felmeddelanden, ingen
//    blockering, inget krav pa valt forslag. Fritext sparas som den ar och
//    koordinatfalten lamnas tomma – servern nollar dem anda (se koordinater.ts).
//
// Anrop begransas: forslag hamtas forst efter MIN_TECKEN tecken och med
// FORDROJNING_MS fordrojning mellan tangenttryckningar. En pagaende sokning
// avbryts nar en ny tangent trycks.

import { type Ref, useCallback, useEffect, useRef, useState } from "react";
import { Falt, FALTFEL_KLASS, INPUT_KLASS } from "@/components/skarm";
import { FALTFEL_ATTRIBUT } from "@/lib/formularfel";
import { ortEfterUppslag } from "@/lib/ort-fran-uppslag";

// Statisk access sa att Next kan inlina vardet i klientbunten.
const NYCKEL = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY?.trim() || undefined;

const MIN_TECKEN = 3;
const FORDROJNING_MS = 350;
const MAX_FORSLAG = 5;

// Forslagslistan ligger ovanpa innehallet under faltet. Den far tacka falten
// i samma steg, men aldrig kontrollen som avslutar eller lamnar steget
// (docs/design.md, Adressfaltet). Uppmatt 2026-10-19: med fem forslag lag den
// over "Spara bostad", och ett tryck dar valde ett forslag i stallet for att
// spara – och skrev over orten. Den felträffen ar tyst; ett tryck som byter
// adressen nar man siktade pa Ort syns.
//
// Hojden ar tre forslag med tva rader, med egen skroll for resten. Matt
// renderat i Chrome, i registreringen, 2026-10-30
// (tester/adressforslag-layout.test.ts): 86 px fritt till "Spara bostad" vid
// 390 × 844 och 97 px vid 1280 × 800, med kopeskillingens hjalptext pa tva
// rader. Med den korta hjalptexten var det 66 och 74 px – samma 74 px som
// uppmattes i produktionen 2026-10-20. I installningarnas kort Bostaden ar avstandet flera
// hundra pixlar. Marginalen bars av Ort och Köpeskilling under adressfaltet:
// tas Köpeskilling bort tacker listan knappen med 70–80 px, och testet faller.
const FORSLAG_MAX_HOJD = "max-h-[11.375rem]";
const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETALJ_URL = "https://places.googleapis.com/v1/places/";
// Ort ligger olika i Googles addressComponents beroende pa land – i Sverige
// oftast som postal_town, annars locality.
const ORT_TYPER = ["postal_town", "locality", "administrative_area_level_2"];

export interface Forslag {
  placeId: string;
  primar: string;
  sekundar: string;
}

function nyToken(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function AdressFalt({
  forval,
  obligatoriskt,
  fel,
}: {
  /** Formularets mening om adressen, t.ex. nar den saknas (docs/design.md,
   *  "När ett formulär vägrar"): star direkt under faltet med role="alert",
   *  och faltet far aria-invalid och aria-describedby. */
  fel?: string;
  /** Markering vid etiketten, som Falt. Adressen ar obligatorisk sedan
   *  2026-10-01 – i registreringen och i installningarnas kort Bostaden. */
  obligatoriskt?: boolean;
  /** Startvarden – utelamnas i registreringen (dar faltet alltid borjar tomt);
   *  anvands av installningarnas kort Bostaden for att visa en redan sparad
   *  adress. */
  forval?: {
    adress?: string;
    ort?: string;
    platsId?: string;
    lat?: string;
    lng?: string;
  };
}) {
  const [adress, setAdress] = useState(forval?.adress ?? "");
  const [ort, setOrt] = useState(forval?.ort ?? "");
  // Ortfaltet just nu, och om det som star dar skrevs av en uppslagning.
  // Detaljerna kommer asynkront, sa uppslagningen maste lasa faltet nar svaret
  // kommer – inte nar adressen valdes – annars skrivs en ort som anvandaren
  // hann skriva under tiden over anda. En sparad ort (forval) raknas som
  // anvandarens: varifran den en gang kom vet faltet inte.
  const ortRef = useRef(forval?.ort ?? "");
  const ortFranUppslagRef = useRef(false);
  const [platsId, setPlatsId] = useState(forval?.platsId ?? "");
  const [lat, setLat] = useState(forval?.lat ?? "");
  const [lng, setLng] = useState(forval?.lng ?? "");

  const [forslag, setForslag] = useState<Forslag[]>([]);
  const [oppen, setOppen] = useState(false);
  const [aktiv, setAktiv] = useState(-1);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listaRef = useRef<HTMLUListElement | null>(null);
  const avbrytRef = useRef<AbortController | null>(null);
  const tokenRef = useRef<string>("");

  const avbrytSokning = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    avbrytRef.current?.abort();
    avbrytRef.current = null;
  }, []);

  // Stada timers och pagaende anrop nar komponenten lamnar sidan.
  useEffect(() => avbrytSokning, [avbrytSokning]);

  // Listan skrollar for sig, sa ett forslag som markeras med piltangenterna
  // maste hallas i bild.
  useEffect(() => {
    if (aktiv < 0) return;
    listaRef.current?.children[aktiv]?.scrollIntoView?.({ block: "nearest" });
  }, [aktiv]);

  function nollstallVal() {
    setPlatsId("");
    setLat("");
    setLng("");
  }

  async function hamtaForslag(input: string) {
    if (!NYCKEL) return;
    const styrning = new AbortController();
    avbrytRef.current = styrning;
    if (!tokenRef.current) tokenRef.current = nyToken();

    try {
      const svar = await fetch(AUTOCOMPLETE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": NYCKEL,
        },
        body: JSON.stringify({
          input,
          sessionToken: tokenRef.current,
          languageCode: "sv",
          regionCode: "SE",
          includedRegionCodes: ["se"],
        }),
        signal: styrning.signal,
      });
      if (!svar.ok) {
        setForslag([]);
        setOppen(false);
        return;
      }
      const data = (await svar.json()) as {
        suggestions?: {
          placePrediction?: {
            placeId?: string;
            text?: { text?: string };
            structuredFormat?: {
              mainText?: { text?: string };
              secondaryText?: { text?: string };
            };
          };
        }[];
      };
      const traffar: Forslag[] = (data.suggestions ?? [])
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
        .slice(0, MAX_FORSLAG)
        .map((p) => ({
          placeId: p.placeId as string,
          primar: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
          sekundar: p.structuredFormat?.secondaryText?.text ?? "",
        }));
      setForslag(traffar);
      setAktiv(-1);
      setOppen(traffar.length > 0);
    } catch {
      // AbortError eller natverksfel – degradera tyst till fritext.
      setForslag([]);
      setOppen(false);
    }
  }

  function planeraSokning(varde: string) {
    avbrytSokning();
    const input = varde.trim();
    if (!NYCKEL || input.length < MIN_TECKEN) {
      setForslag([]);
      setOppen(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      void hamtaForslag(input);
    }, FORDROJNING_MS);
  }

  function vidAndring(varde: string) {
    setAdress(varde);
    // Fritext frikopplar faltet fran ett tidigare valt forslag.
    nollstallVal();
    planeraSokning(varde);
  }

  async function hamtaDetaljer(placeId: string) {
    if (!NYCKEL) return;
    try {
      const svar = await fetch(`${DETALJ_URL}${encodeURIComponent(placeId)}`, {
        headers: {
          "X-Goog-Api-Key": NYCKEL,
          "X-Goog-FieldMask": "location,addressComponents",
        },
      });
      if (!svar.ok) return;
      const data = (await svar.json()) as {
        location?: { latitude?: number; longitude?: number };
        addressComponents?: { longText?: string; types?: string[] }[];
      };
      if (
        typeof data.location?.latitude === "number" &&
        typeof data.location?.longitude === "number"
      ) {
        setLat(String(data.location.latitude));
        setLng(String(data.location.longitude));
      }
      const komponenter = data.addressComponents ?? [];
      for (const typ of ORT_TYPER) {
        const traff = komponenter.find((k) => k.types?.includes(typ));
        if (traff?.longText) {
          // Bara i ett tomt falt eller over en tidigare uppslagnings ort –
          // aldrig over det anvandaren skrivit (src/lib/ort-fran-uppslag.ts).
          const ny = ortEfterUppslag({
            nuvarande: ortRef.current,
            franUppslag: ortFranUppslagRef.current,
            uppslagen: traff.longText,
          });
          if (ny !== ortRef.current) {
            ortRef.current = ny;
            ortFranUppslagRef.current = true;
            setOrt(ny);
          }
          break;
        }
      }
    } catch {
      // Koordinater uteblir – adressen sparas anda som fritext.
    }
  }

  function valjForslag(f: Forslag) {
    avbrytSokning();
    setAdress(f.primar);
    setPlatsId(f.placeId);
    setForslag([]);
    setOppen(false);
    setAktiv(-1);
    void hamtaDetaljer(f.placeId);
    // Ny sessionstoken efter ett avslutat val (Places-fakturering).
    tokenRef.current = nyToken();
  }

  function vidTangent(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!oppen || forslag.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAktiv((i) => (i + 1) % forslag.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAktiv((i) => (i <= 0 ? forslag.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (aktiv >= 0) {
        e.preventDefault();
        valjForslag(forslag[aktiv]);
      }
    } else if (e.key === "Escape") {
      setOppen(false);
    }
  }

  return (
    <>
      <div>
        <label
          htmlFor="adress-falt"
          className="mb-1.5 block font-granssnitt text-sm text-text-sekundar"
        >
          Adress
          {obligatoriskt ? (
            <span aria-hidden className="ml-0.5 text-text-sekundar">
              *
            </span>
          ) : null}
        </label>
        <div className="relative">
          <input
            id="adress-falt"
            type="text"
            name="adress"
            autoComplete="off"
            role="combobox"
            aria-expanded={oppen}
            aria-autocomplete="list"
            aria-controls="adress-forslag"
            aria-invalid={fel ? true : undefined}
            aria-describedby={fel ? "adress-fel" : undefined}
            {...(fel ? { [FALTFEL_ATTRIBUT]: "" } : {})}
            value={adress}
            onChange={(e) => vidAndring(e.target.value)}
            onKeyDown={vidTangent}
            onFocus={() => {
              if (forslag.length > 0) setOppen(true);
            }}
            onBlur={() => setOppen(false)}
            className={INPUT_KLASS}
            placeholder="t.ex. Kvarnvägen 12 B"
          />
          {oppen && forslag.length > 0 ? (
            <Forslagslista
              ref={listaRef}
              forslag={forslag}
              aktiv={aktiv}
              onValj={valjForslag}
              onPeka={setAktiv}
            />
          ) : null}
        </div>
        {fel ? (
          <p id="adress-fel" role="alert" className={`mt-1 ${FALTFEL_KLASS}`}>
            {fel}
          </p>
        ) : null}
      </div>

      <Falt etikett="Ort">
        <input
          type="text"
          name="ort"
          autoComplete="address-level2"
          value={ort}
          onChange={(e) => {
            ortRef.current = e.target.value;
            ortFranUppslagRef.current = false;
            setOrt(e.target.value);
          }}
          className={INPUT_KLASS}
        />
      </Falt>

      {/* Foljer med formularet; servern nollar trippeln om den inte ar komplett. */}
      <input type="hidden" name="place_id" value={platsId} />
      <input type="hidden" name="latitud" value={lat} />
      <input type="hidden" name="longitud" value={lng} />
    </>
  );
}

/**
 * Forslagslistan under adressfaltet. Egen komponent sa att hojden kan matas
 * renderad, i registreringen, mot knappen som sparar
 * (tester/adressforslag-layout.test.ts) – det ar samma lista som visas.
 */
export function Forslagslista({
  ref,
  forslag,
  aktiv,
  onValj,
  onPeka,
}: {
  ref?: Ref<HTMLUListElement>;
  forslag: Forslag[];
  aktiv: number;
  onValj: (f: Forslag) => void;
  onPeka: (i: number) => void;
}) {
  return (
    <ul
      ref={ref}
      id="adress-forslag"
      role="listbox"
      className={`absolute left-0 right-0 top-full z-10 mt-1 ${FORSLAG_MAX_HOJD} overflow-y-auto rounded-lg border border-linje bg-yta-upphojd`}
    >
      {forslag.map((f, i) => (
        <li key={f.placeId} role="option" aria-selected={i === aktiv}>
          <button
            type="button"
            // Behall fokus i faltet sa att onBlur inte hinner stanga
            // listan innan klicket registreras.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onValj(f)}
            onMouseEnter={() => onPeka(i)}
            className={[
              "block w-full px-3 py-2.5 text-left font-granssnitt transition-colors",
              i === aktiv ? "bg-yta-nedsankt" : "hover:bg-yta-nedsankt",
            ].join(" ")}
          >
            <span className="block truncate text-sm text-text-primar">{f.primar}</span>
            {f.sekundar ? (
              <span className="block truncate text-sm text-text-sekundar">{f.sekundar}</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
