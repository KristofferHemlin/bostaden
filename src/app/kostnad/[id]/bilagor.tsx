"use client";

// Bilageraden pa en kostnad (docs/design.md, "Bilagor"): en rad stora,
// staende miniatyrer med en +-ruta sist. Miniatyren oppnar filen i en
// helskarmsvy. Ingen beskarning – hela bilden visas inpassad mot
// --yta-nedsankt, sa att ett avklippt eller suddigt kvitto syns i
// forhandsvisningen i stallet for att doljas av en beskuren ruta. Rutan ar
// darfor stor: minst 96px, styrande regel ar att tre rutor (inkl. +-rutan)
// ska rymmas pa en rad pa 390px – med kortets padding landar det pa 100px.
//
// En bild som annu inte hamtats far ALDRIG se ut som en tom ruta – det ar
// exakt den signal som far anvandaren att tro att kvittot ar borta.
// <Miniatyrbild> visar darfor ett laddningslage tills webblasaren bekraftat
// bilden, och ett eget "kunde inte visas"-lage om den faktiskt misslyckas
// (t.ex. en HEIC-miniatyr som inte gick att generera).
//
// Raderingen ligger som en egen papperskorgsikon i miniatyrens ovre hogra
// horn – en tunn SVG i --text-primar (aldrig emoji, och mer kontrast an
// --text-sekundar eftersom den ligger ovanpa ett fotografi) med en egen
// tryckyta pa minst 44px och en HELT TACKANDE ljus platta bakom sig. En
// genomskinlig platta later kvittot lysa igenom och gor ikonen olaslig mot ett
// vitt kassakvitto. Ikonen ar ett SYSKON till oppningsknappen, inte nastlad i
// den (knappar far inte nastlas), och lagd SENARE i markupen sa den malas
// ovanpa – ett klick i hornet trafffar alltid papperskorgen, aldrig
// oppningen. Bekraftelsen visas som ett eget block under hela raden (texten ar
// for lang for att fa plats i en 100px-ruta), med samma icke-orange
// knappmonster som anvands for att ta bort ett kvitto. Eftersom bekraftelsen
// ligger under HELA raden och inte kan visa vilken ruta den galler, markeras
// den valda bilagan med en ram (samma monster som i nya-kvitto-formularet)
// och de ovriga dampas – annars gar det inte att se vilket av tva kvitton
// fran samma butik som ska bort. Markeringen bars aldrig av att fa
// papperskorgen orange.
//
// Helskarmsvyn finns bara for att titta – ingen raderingsatgard dar, och inget
// filnamn under bilden. Den ligger over en mork halvgenomskinlig yta som
// tacker HELA skarmen inklusive topprad och flikrad – annars ser vyn ut som
// att sidan bytt innehall i stallet for att nagot oppnats ovanpa, och
// ingenting antyder da att den gar att stanga. Den stangs med klick utanfor
// bilden, Escape, eller ett kryss i ovre hogra hornet – pa telefon finns ingen
// Escape och ytan runt en stor bild ar liten, sa krysset ar det enda som
// fungerar med tummen.
//
// Uppladdningen gar DIREKT fran webblasaren till Supabase Storage via en
// signerad URL (filen passerar aldrig en serverless-funktion). Under
// uppladdningen visas tydlig status; misslyckas den visas felet med mojlighet
// att forsoka igen och filen slapps inte ur minnet. Radering kraver ett extra
// bekraftelsesteg – den ar permanent.

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { revalideraKostnadssida, taBortBilagaAction } from "./actions";
import type { BilagaResultat } from "./actions";
import { valideraBilaga } from "@/lib/lagring/bilaga-regler";
import { laddaUppKostnadsbilaga } from "@/lib/lagring/bilaga-klient";
import type { Bilagevy } from "@/lib/lagring/bilagor";

const START: BilagaResultat = {};

const ACCEPT =
  "image/jpeg,image/png,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.heic,.heif,.pdf";

// Stor, staende ruta (docs/design.md, "Bilagor"): FAST storlek – 100px bred,
// 133px hog (ungefar 3:4) – oavsett hur manga bilagor kostnaden har. flex-none
// nollstaller bade flex-grow och flex-shrink explicit sa rutan aldrig stracks
// ut for att fylla raden (ett kvitto med en bilaga ska visa den lika stort som
// ett med tre). Bredd och hojd anges som fasta pixelvarden i stallet for
// aspect-ratio-utiliteten, sa storleken aldrig beror pa flex-layouten.
//
// Tre rutor (tva bilagor + "Lagg till") ska rymmas pa en rad pa 390px. Med
// kortets och sektionens padding (main px-4 + denna sektionens p-4 = 64px)
// ater raden 326px pa en 390px-skarm; 100px per ruta + gap-2 ger 316px, dvs
// plats kvar.
const RUTA =
  "relative flex h-[133px] w-[100px] flex-none flex-col items-center justify-center overflow-hidden rounded-lg bg-yta-nedsankt text-center";

export function Bilagor({
  kostnadId,
  bilagor,
}: {
  kostnadId: string;
  bilagor: Bilagevy[];
}) {
  const router = useRouter();

  // Filerna lever i state tills servern bekraftat varje uppladdning – en tyst
  // misslyckad uppladdning ar det varsta som kan handa i den har appen.
  const [koa, setKoa] = useState<File[]>([]);
  const [laddarUpp, setLaddarUpp] = useState(false);
  const [uppladdningsfel, setUppladdningsfel] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Helskarmsvyn – bara for att titta, ingen radering dar.
  const [oppen, setOppen] = useState<Bilagevy | null>(null);

  // Raderingsbekraftelsen galler en bilaga i taget, oavsett vilken miniatyrs
  // papperskorg som utlost den.
  const [bekraftaBilaga, setBekraftaBilaga] = useState<Bilagevy | null>(null);

  const [radera, raderaAction, raderar] = useActionState(
    taBortBilagaAction,
    START,
  );

  useEffect(() => {
    if (radera.ok) setBekraftaBilaga(null);
  }, [radera]);

  async function laddaUpp(filer: File[]) {
    if (filer.length === 0) return;
    setLaddarUpp(true);
    setUppladdningsfel(null);
    setKoa(filer);

    const kvar = [...filer];
    while (kvar.length > 0) {
      const fil = kvar[0];
      const resultat = await laddaUppKostnadsbilaga(kostnadId, fil);
      if (!resultat.ok) {
        setUppladdningsfel(
          `${fil.name || "Filen"}: ${resultat.fel ?? "uppladdningen misslyckades."}`,
        );
        setKoa(kvar); // det som aterstar ligger kvar for nytt forsok
        setLaddarUpp(false);
        return;
      }
      kvar.shift();
      setKoa([...kvar]);
    }

    setLaddarUpp(false);
    if (inputRef.current) inputRef.current.value = "";
    await revalideraKostnadssida(kostnadId);
    router.refresh();
  }

  function valjFiler(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const filer = Array.from(lista);
    // Samma grind som servern, direkt vid valet.
    for (const fil of filer) {
      const grind = valideraBilaga({
        mimetyp: fil.type,
        storlek: fil.size,
        filnamn: fil.name,
      });
      if (!grind.ok) {
        setUppladdningsfel(`${fil.name || "Filen"}: ${grind.fel}`);
        return;
      }
    }
    void laddaUpp(filer);
  }

  return (
    <div className="p-4">
      <p className="mb-2 font-granssnitt text-xs uppercase tracking-wide text-text-dampad">
        Bilagor
      </p>

      <div className="flex flex-wrap gap-2">
        {bilagor.map((b) => {
          // Vid radering ska raderingen ALDRIG behova las av bekraftelsetexten
          // for att veta vilken ruta den galler – med tva kvitton fran samma
          // butik bredvid varandra ar det annars omojligt att se. Den valda
          // rutan far en tydlig ram; de andra dampas som ett andra, svagare
          // stod – men ramen ar den som bar signalen (verifierat i
          // webblasaren: dampningen ensam later inte se VILKEN ruta som
          // avses). Markeringen bars ALDRIG av papperskorgens farg – orange
          // betyder handling, inte radering av bevisning (docs/design.md,
          // "Bilagor").
          //
          // INTE ring-inset (som anvands for markerad bilaga i
          // nya-kvitto-formularet): dar ligger ramen ovanpa en <img
          // aspect-ratio>-platshallare utan eget innehall an sjalva bilden,
          // men har fyller <Miniatyrbild> hela rutan med en `absolute
          // inset-0`-bild som malas som ett SENARE lager an knappens egen
          // box-shadow – en inset-ring hamnar da exakt dar bilden ligger och
          // syns aldrig (bekraftat med getComputedStyle: boxShadow fanns och
          // hade ratt farg, men var helt dold bakom bilden). En vanlig
          // (icke-inset) ring ligger UTANFOR knappens kant, dar ingen bild
          // nagonsin malas, och forblir synlig oavsett vad rutan visar.
          const vald = bekraftaBilaga?.id === b.id;
          const dampad = bekraftaBilaga !== null && !vald;
          return (
            <div
              key={b.id}
              className={`relative flex-none transition-opacity ${dampad ? "opacity-40" : ""}`}
            >
              <button
                type="button"
                onClick={() => setOppen(b)}
                className={`${RUTA} transition-colors hover:bg-sand ${
                  vald ? "ring-2 ring-text-primar" : ""
                }`}
                title={b.filnamn}
                aria-label={`Öppna ${b.filnamn}`}
              >
                <Miniatyrinnehall bilaga={b} />
              </button>

              {/* Papperskorgen ar ett SYSKON till oppningsknappen (aldrig
                  nastlad – knappar far inte nastlas), lagd EFTER den i
                  markupen sa den malas ovanpa. Ett klick i hornet trafffar
                  alltid den har knappen, aldrig oppningsknappen under
                  (docs/design.md, "Bilagor"). */}
              <button
                type="button"
                onClick={() => setBekraftaBilaga(b)}
                aria-label={`Ta bort ${b.filnamn}`}
                className="absolute right-0 top-0 z-10 flex h-11 w-11 items-center justify-center text-text-primar transition-colors hover:text-accent-mork"
              >
                {/* Helt tackande – en genomskinlig platta later kvittot lysa
                    igenom och gor ikonen olaslig mot ett vitt kassakvitto
                    (docs/design.md, "Bilagor"). */}
                <span
                  aria-hidden
                  className="absolute inset-1.5 rounded-full bg-yta-upphojd"
                />
                <PapperskorgIkon />
              </button>
            </div>
          );
        })}

        <label
          className={`${RUTA} cursor-pointer text-text-sekundar transition-colors hover:bg-sand`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            disabled={laddarUpp}
            onChange={(e) => valjFiler(e.target.files)}
          />
          <span aria-hidden className="text-xl leading-none">
            +
          </span>
          <span className="mt-0.5 font-granssnitt text-[10px]">
            {laddarUpp ? "Laddar upp…" : "Lägg till"}
          </span>
        </label>
      </div>

      {laddarUpp ? (
        <p className="mt-2 font-granssnitt text-sm text-text-sekundar">
          Laddar upp{koa.length > 1 ? ` (${koa.length} kvar)` : ""} – bilagan
          sparas inte förrän servern bekräftat.
        </p>
      ) : null}

      {uppladdningsfel ? (
        <div className="mt-2 font-granssnitt text-sm text-accent-mork">
          <p>{uppladdningsfel}</p>
          {koa.length > 0 ? (
            <button
              type="button"
              onClick={() => void laddaUpp(koa)}
              className="mt-1 underline"
            >
              Försök igen
            </button>
          ) : null}
        </div>
      ) : null}

      {bilagor.length === 0 && !laddarUpp && !uppladdningsfel ? (
        <p className="mt-2 font-granssnitt text-sm text-text-dampad">
          Inga bilagor än. Ett kvitto utan bild är inget fel – underlaget blir
          bara svagare.
        </p>
      ) : null}

      {/* Bekraftelsen som ett eget block under raden – texten ar for lang for
          att fa plats i en 100px-ruta. Samma icke-orange knappmonster som "Ta
          bort kvittot" i redigeringsvyn (docs/design.md, "Bilagor"). */}
      {bekraftaBilaga ? (
        <form
          action={raderaAction}
          className="mt-3 flex flex-col gap-2 rounded-lg bg-yta-nedsankt p-3"
        >
          <input type="hidden" name="bilaga_id" value={bekraftaBilaga.id} />
          <input type="hidden" name="kostnad_id" value={kostnadId} />
          <p className="font-granssnitt text-sm text-text-primar">
            Ta bort bilagan? Bilden raderas och går inte att återskapa.
            Kvittots uppgifter ligger kvar.
          </p>
          {radera.fel ? (
            <p className="font-granssnitt text-sm text-accent-mork">
              {radera.fel}
            </p>
          ) : null}
          <div className="flex gap-4">
            {/* Aldrig orange – radering av bevisning ar inte handlingen
                produkten vill uppmuntra (docs/design.md, "Bilagor"). */}
            <button
              type="submit"
              disabled={raderar}
              className="font-granssnitt text-sm font-medium text-text-primar underline disabled:opacity-60"
            >
              {raderar ? "Tar bort…" : "Ta bort"}
            </button>
            <button
              type="button"
              onClick={() => setBekraftaBilaga(null)}
              className="font-granssnitt text-sm text-text-sekundar"
            >
              Avbryt
            </button>
          </div>
        </form>
      ) : null}

      {oppen ? (
        <Helskarmsvy bilaga={oppen} onStang={() => setOppen(null)} />
      ) : null}
    </div>
  );
}

/** Innehallet i en miniatyrruta – samma for miniatyren som for den stora ytan
 * i helskarmsvyn (bild, PDF-ikon eller felikon). */
function Miniatyrinnehall({ bilaga }: { bilaga: Bilagevy }) {
  if (bilaga.arBild) {
    return (
      <Miniatyrbild
        src={`/bilaga/${bilaga.id}?variant=visning`}
        alt={bilaga.filnamn}
      />
    );
  }
  if (bilaga.arPdf) {
    return (
      <>
        <DokumentIkon />
        <span className="mt-1 line-clamp-2 px-1 font-granssnitt text-[10px] leading-tight text-text-sekundar">
          PDF
        </span>
      </>
    );
  }
  return (
    <>
      <FelIkon />
      <span className="mt-1 px-1 font-granssnitt text-[10px] leading-tight text-text-dampad">
        Kunde inte visas
      </span>
    </>
  );
}

/**
 * En bildminiatyr med ett eget laddningslage (docs/design.md, "Bilagor"): fram
 * tills bilden hamtats visas en roterande indikator i rutan i stallet for en
 * tom yta, och gar hamtningen inte att lasa visas ett tydligt felmeddelande –
 * aldrig ingenting.
 *
 * Bilden visas HEL, aldrig beskuren: object-contain mot rutans
 * --yta-nedsankt-bakgrund, sa att ett avklippt eller suddigt kvitto syns i
 * stallet for att doljas av en beskarning av mitten.
 */
function Miniatyrbild({ src, alt }: { src: string; alt: string }) {
  const [lage, setLage] = useState<"laddar" | "klar" | "fel">("laddar");

  if (lage === "fel") {
    return (
      <span className="flex flex-col items-center px-1">
        <FelIkon />
        <span className="mt-1 font-granssnitt text-[10px] leading-tight text-text-dampad">
          Kunde inte visas
        </span>
      </span>
    );
  }

  return (
    <>
      {lage === "laddar" ? (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-text-dampad border-t-transparent" />
        </span>
      ) : null}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLage("klar")}
        onError={() => setLage("fel")}
        className={`absolute inset-0 h-full w-full object-contain ${
          lage === "laddar" ? "invisible" : ""
        }`}
      />
    </>
  );
}

/**
 * Helskarmsvyn en miniatyr oppnar (docs/design.md, "Bilagor"). Finns bara for
 * att titta – ingen raderingsatgard har, och inget filnamn under bilden.
 *
 * Renderas med createPortal direkt under document.body, INTE dar <Bilagor>
 * rakar sitta i tradet. <Skarm> sveper sidans innehall i ETT kort
 * (`overflow-hidden rounded-xl` i <Kort>, skarm.tsx), och en `position: fixed`
 * -yta som legat kvar INUTI det kortet vore ett gift som bara vantar pa att
 * utlosas – lagger nagon senare till en transform/filter/backdrop-filter/
 * contain pa nagon forfader (eller byter overflow-hidden mot nagot som
 * klipper fixed-barn) blir helskarmsvyn instangd i kortet i stallet for att
 * tacka skarmen. Portalen tar bort det beroendet helt, oavsett vad som
 * omgardar <Bilagor> nu eller i framtiden.
 *
 * VIKTIGT FYND (verifierat i webblasaren, inte bara last i koden): den
 * ursprungliga bakgrunden `bg-text-primar/90` renderade som `rgba(0,0,0,0)`
 * – helt osynlig. Tailwinds opacitetsmodifierare (`/NN`) fungerar bara nar
 * fargen ar uppbyggd av separata kanalvarden (`r g b`); har mappar
 * tailwind.config.ts tokens som `text-primar` direkt till en `var(--x)` som
 * innehaller en hel hex-strang, sa Tailwind kan inte komponera `/90` och
 * genererar tyst INGEN regel alls for den klassen. Samma sak hande med
 * `text-yta-upphojd/90` pa PDF/fel-ikonen. Bakgrunden har ALDRIG synts – inte
 * en stangingscontext, utan en osynlig yta som ratt "klick utanfor" pa. Los
 * ALDRIG en liknande halvgenomskinlighet med `/NN` pa dessa tokens; anvand
 * `color-mix(in srgb, var(--token) X%, transparent)` i en godtycklig
 * Tailwind-varde-klass i stallet (som nedan) – den refererar fortfarande
 * token-variabeln, aldrig en hex-strang i komponenten.
 *
 * Bilden (eller PDF/fel-laget) ligger pa en egen vit platta (`--yta-upphojd`)
 * med jamn marginal runt om, mot den morka bakgrunden. Krysset sitter i
 * PLATTANS ovre hogra horn – inte skarmens – som en mork rund bricka pa
 * hornet, med bibehallen tryckyta pa 44px. Escape och klick utanfor stanger
 * ocksa – pa telefon finns ingen Escape och ytan runt en stor bild ar liten,
 * sa krysset ar det som faktiskt fungerar med tummen.
 */
function Helskarmsvy({
  bilaga,
  onStang,
}: {
  bilaga: Bilagevy;
  onStang: () => void;
}) {
  // Escape stanger vyn; scroll bakom den lases medan den ar oppen.
  useEffect(() => {
    function pahandelse(e: KeyboardEvent) {
      if (e.key === "Escape") onStang();
    }
    document.addEventListener("keydown", pahandelse);
    const tidigareOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", pahandelse);
      document.body.style.overflow = tidigareOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={bilaga.filnamn}
      onClick={onStang}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--text-primar)_90%,transparent)] p-4"
    >
      {/* Platta + kryss ar ETT block: klick pa plattan ska inte stanga vyn,
          bara klick pa den morka ytan UTANFOR den. Krysset ligger pa plattans
          horn (halvt utanpa, som en bricka) sa det aldrig tar av bildens egen
          jamna marginal. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-full max-w-full flex-col items-center gap-3 rounded-lg bg-yta-upphojd p-4 sm:p-5"
      >
        <button
          type="button"
          onClick={onStang}
          aria-label="Stäng"
          className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center rounded-full bg-text-primar text-yta-upphojd shadow-md transition-opacity hover:opacity-90 sm:-right-3 sm:-top-3"
        >
          <StangIkon />
        </button>

        {bilaga.arBild ? (
          <img
            src={`/bilaga/${bilaga.id}?variant=visning`}
            alt={bilaga.filnamn}
            className="max-h-[75vh] max-w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-2 py-6 text-text-sekundar">
            {bilaga.arPdf ? <DokumentIkon stor /> : <FelIkon stor />}
            <p className="font-granssnitt text-sm">
              {bilaga.arPdf ? "PDF" : "Kunde inte visas"}
            </p>
            {bilaga.arPdf ? (
              <a
                href={`/bilaga/${bilaga.id}?variant=original`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-granssnitt text-sm text-text-primar underline"
              >
                Öppna PDF:en
              </a>
            ) : null}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Krysset som stanger helskarmsvyn – ovre hogra hornet (docs/design.md, "Bilagor"). */
function StangIkon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-6 w-6"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

function FelIkon({ stor }: { stor?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={stor ? "h-10 w-10" : "h-6 w-6 text-text-dampad"}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function DokumentIkon({ stor }: { stor?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={stor ? "h-10 w-10" : "h-6 w-6 text-text-sekundar"}
    >
      <path d="M14 3v5h5" />
      <path d="M18 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2z" />
    </svg>
  );
}

function PapperskorgIkon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="relative h-4 w-4"
    >
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </svg>
  );
}
