// Dokumentavlasning (produktspec avsnitt 9). Formularet skickar den valda filen
// hit direkt – innan kostnaden sparats och utan att ga via lagringen – och far
// tillbaka datum, totalbelopp (oren, inklusive moms) och leverantor som JSON.
//
// Nyckeln (ANTHROPIC_API_KEY) lever bara pa servern. Alla fel svaljs: svaret ar
// alltid 200 med tre falt som kan vara null, sa att formularet fungerar exakt
// som utan analys. Enda undantaget ar utebliven inloggning, som avvisas innan
// nagot betalt anrop gors.

import { NextResponse } from "next/server";
import { analyseraDokument } from "@/lib/dokumentavlasning/analysera";
import { TOMT_DOKUMENTFALT } from "@/lib/dokumentavlasning/tolkning";
import { MAX_BILAGA_BYTES } from "@/lib/lagring/bilaga-regler";
import { hamtaAnvandare } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const anvandare = await hamtaAnvandare();
  if (!anvandare) {
    return NextResponse.json({ fel: "Inte inloggad." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const fil = formData.get("fil");
    if (
      !(fil instanceof File) ||
      fil.size === 0 ||
      fil.size > MAX_BILAGA_BYTES
    ) {
      return NextResponse.json(TOMT_DOKUMENTFALT);
    }
    return NextResponse.json(await analyseraDokument(fil));
  } catch {
    // Trasig multipart, avbrutet anrop, m.m. – svalj och lat formularet fortsatta.
    return NextResponse.json(TOMT_DOKUMENTFALT);
  }
}
