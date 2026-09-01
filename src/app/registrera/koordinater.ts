// Adressfaltet i registreringen (docs/design.md, Registreringsflodet) ar alltid
// ett vanligt textfalt. Valjer anvandaren ett Google Places-forslag foljer
// place_id, latitud och longitud med i dolda falt; skriver hen fritext, eller
// svarar tjansten inte, saknas de. Servern litar aldrig pa att klienten skickar
// en konsekvent trippel – antingen ar alla tre giltiga, annars nollas alla tre
// och adressen sparas som ren fritext med koordinatfalten null.

export interface Geokod {
  place_id: string | null;
  latitud: number | null;
  longitud: number | null;
}

const TOM: Geokod = { place_id: null, latitud: null, longitud: null };

export function tolkaGeokod(
  placeId: string,
  latRatext: string,
  lngRatext: string,
): Geokod {
  const id = placeId.trim();
  const lat = Number(latRatext);
  const lng = Number(lngRatext);

  const giltig =
    id !== "" &&
    latRatext.trim() !== "" &&
    lngRatext.trim() !== "" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  return giltig ? { place_id: id, latitud: lat, longitud: lng } : TOM;
}
