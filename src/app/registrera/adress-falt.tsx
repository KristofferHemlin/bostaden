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

import { useCallback, useEffect, useRef, useState } from "react";
import { Falt, INPUT_KLASS } from "@/components/skarm";

// Statisk access sa att Next kan inlina vardet i klientbunten.
const NYCKEL = process.env.NEXT_PUBLIC_GOOGLE_PLACES_KEY?.trim() || undefined;

const MIN_TECKEN = 3;
const FORDROJNING_MS = 350;
const MAX_FORSLAG = 5;
const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETALJ_URL = "https://places.googleapis.com/v1/places/";
// Ort ligger olika i Googles addressComponents beroende pa land – i Sverige
// oftast som postal_town, annars locality.
const ORT_TYPER = ["postal_town", "locality", "administrative_area_level_2"];

interface Forslag {
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

export function AdressFalt() {
  const [adress, setAdress] = useState("");
  const [ort, setOrt] = useState("");
  const [platsId, setPlatsId] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const [forslag, setForslag] = useState<Forslag[]>([]);
  const [oppen, setOppen] = useState(false);
  const [aktiv, setAktiv] = useState(-1);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
          setOrt(traff.longText);
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
            <ul
              id="adress-forslag"
              role="listbox"
              className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-linje bg-yta-upphojd"
            >
              {forslag.map((f, i) => (
                <li key={f.placeId} role="option" aria-selected={i === aktiv}>
                  <button
                    type="button"
                    // Behall fokus i faltet sa att onBlur inte hinner stanga
                    // listan innan klicket registreras.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => valjForslag(f)}
                    onMouseEnter={() => setAktiv(i)}
                    className={[
                      "block w-full px-3 py-2.5 text-left font-granssnitt transition-colors",
                      i === aktiv ? "bg-yta-nedsankt" : "hover:bg-yta-nedsankt",
                    ].join(" ")}
                  >
                    <span className="block truncate text-sm text-text-primar">
                      {f.primar}
                    </span>
                    {f.sekundar ? (
                      <span className="block truncate text-xs text-text-dampad">
                        {f.sekundar}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <Falt etikett="Ort">
        <input
          type="text"
          name="ort"
          autoComplete="address-level2"
          value={ort}
          onChange={(e) => setOrt(e.target.value)}
          className={INPUT_KLASS}
          placeholder="t.ex. Göteborg"
        />
      </Falt>

      {/* Foljer med formularet; servern nollar trippeln om den inte ar komplett. */}
      <input type="hidden" name="place_id" value={platsId} />
      <input type="hidden" name="latitud" value={lat} />
      <input type="hidden" name="longitud" value={lng} />
    </>
  );
}
