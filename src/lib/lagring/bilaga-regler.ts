// Rena regler for bilagor (produktspec avsnitt 12, "Bilagor och lagring").
// Fristaende fran databas och Supabase sa att de gar att testa utan bada.
//
// - Tillatna format: JPG, PNG, HEIC och PDF. Max 10 MB per fil.
// - HEIC kan ingen webblasare visa – en JPG-miniatyr maste genereras vid
//   uppladdningen. `kraverMiniatyr` markerar de formaten.
// - Sokvagsmonster: {bostad_id}/{kostnad_id}/{slumpat_filnamn}. Anvandarens
//   ursprungliga filnamn lagras i databasen, ALDRIG i sokvagen – telefonfilnamn
//   kan bryta sokvagar och ett gissningsbart monster gor atkomstkontrollen till
//   enda skyddet.

export const MAX_BILAGA_BYTES = 10 * 1024 * 1024;

export interface Bilageformat {
  /** Normaliserad MIME-typ som filen lagras med. */
  mimetyp: string;
  /** Filandelse utan punkt, gemener. */
  andelse: string;
  /** HEIC/HEIF gar inte att visa i webblasare – kraver en genererad JPG-miniatyr. */
  kraverMiniatyr: boolean;
}

const JPEG: Bilageformat = {
  mimetyp: "image/jpeg",
  andelse: "jpg",
  kraverMiniatyr: false,
};
const PNG: Bilageformat = {
  mimetyp: "image/png",
  andelse: "png",
  kraverMiniatyr: false,
};
const HEIC: Bilageformat = {
  mimetyp: "image/heic",
  andelse: "heic",
  kraverMiniatyr: true,
};
const PDF: Bilageformat = {
  mimetyp: "application/pdf",
  andelse: "pdf",
  kraverMiniatyr: false,
};

const EFTER_MIME: Record<string, Bilageformat> = {
  "image/jpeg": JPEG,
  "image/jpg": JPEG,
  "image/pjpeg": JPEG,
  "image/png": PNG,
  "image/heic": HEIC,
  "image/heif": HEIC,
  "image/heic-sequence": HEIC,
  "image/heif-sequence": HEIC,
  "application/pdf": PDF,
};

const EFTER_ANDELSE: Record<string, Bilageformat> = {
  jpg: JPEG,
  jpeg: JPEG,
  png: PNG,
  heic: HEIC,
  heif: HEIC,
  pdf: PDF,
};

const GENERISKA_MIMETYPER = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
]);

/** Sista filandelsen i gemener, utan punkt och utan skrap. "" om ingen finns. */
export function filandelse(filnamn: string): string {
  const punkt = filnamn.lastIndexOf(".");
  if (punkt < 0 || punkt === filnamn.length - 1) return "";
  return filnamn
    .slice(punkt + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Kanner igen ett tillatet format ur MIME-typ, med filandelsen som reserv nar
 * telefonen skickar en tom eller generisk MIME-typ. Returnerar null for allt
 * som inte ar JPG, PNG, HEIC eller PDF.
 */
export function kannIgenFormat(
  mimetyp: string,
  filnamn: string,
): Bilageformat | null {
  const mt = mimetyp.trim().toLowerCase();
  if (EFTER_MIME[mt]) return EFTER_MIME[mt];
  if (GENERISKA_MIMETYPER.has(mt)) {
    return EFTER_ANDELSE[filandelse(filnamn)] ?? null;
  }
  return null;
}

export type Bilagevalidering =
  | { ok: true; format: Bilageformat }
  | { ok: false; fel: string };

/** Grindar en fil mot storleks- och formatgranserna. */
export function valideraBilaga(fil: {
  mimetyp: string;
  storlek: number;
  filnamn: string;
}): Bilagevalidering {
  if (!Number.isFinite(fil.storlek) || fil.storlek <= 0) {
    return { ok: false, fel: "Filen är tom." };
  }
  if (fil.storlek > MAX_BILAGA_BYTES) {
    return {
      ok: false,
      fel: "Filen är större än 10 MB. Minska den och försök igen.",
    };
  }
  const format = kannIgenFormat(fil.mimetyp, fil.filnamn);
  if (!format) {
    return {
      ok: false,
      fel: "Formatet stöds inte. Tillåtna format: JPG, PNG, HEIC och PDF.",
    };
  }
  return { ok: true, format };
}

/**
 * Slumpat, icke gissningsbart filnamn. Anvandarens eget filnamn hamnar aldrig
 * har – det lagras separat i databasen.
 */
export function slumpatFilnamn(andelse: string): string {
  const rensad = andelse.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `${crypto.randomUUID()}.${rensad}`;
}

/** Sokvagsmonstret {bostad_id}/{kostnad_id}/{slumpat_filnamn}. */
export function lagringsnyckel(
  bostadId: string,
  kostnadId: string,
  slumpatNamn: string,
): string {
  return `${bostadId}/${kostnadId}/${slumpatNamn}`;
}

/** Miniatyren ligger bredvid originalet under samma kostnad, alltid som .jpg. */
export function miniatyrnyckel(originalnyckel: string): string {
  return `${originalnyckel.replace(/\.[^./]+$/, "")}.miniatyr.jpg`;
}
