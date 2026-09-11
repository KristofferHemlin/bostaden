// Visning av en bilaga. Servern kontrollerar behorigheten mot medlemskapet,
// skapar en kort signerad URL och skickar vidare till den. Klienten far aldrig
// en permanent lank (produktspec avsnitt 12).
//
//   GET /bilaga/<id>              -> visningsversionen (~2000px JPG) om sadan finns
//   GET /bilaga/<id>?variant=original  -> originalfilen

import { NextResponse, type NextRequest } from "next/server";
import { signeradBilagelank, type Lankvariant } from "@/lib/lagring/bilagor";
import { hamtaAnvandare } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const anvandare = await hamtaAnvandare();
  if (!anvandare) {
    return NextResponse.json({ fel: "Inte inloggad." }, { status: 401 });
  }

  const variant: Lankvariant =
    request.nextUrl.searchParams.get("variant") === "original"
      ? "original"
      : "visning";

  const url = await signeradBilagelank(id, anvandare.id, variant);
  if (!url) {
    return NextResponse.json(
      { fel: "Bilagan finns inte eller så saknar du åtkomst." },
      { status: 404 },
    );
  }

  return NextResponse.redirect(url, {
    status: 307,
    headers: { "cache-control": "private, no-store" },
  });
}
