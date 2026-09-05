// Landningspunkt for magisk lank / OTP. Supabase skickar hit med ?code=... som
// bytes mot en session, darefter vidare till oversikten (som i sin tur skickar
// till /registrera om ingen bostad finns).

import { NextResponse, type NextRequest } from "next/server";
import { skapaServerklient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nasta = searchParams.get("next") ?? "/";

  // Bakom Vercels proxy ar request.nextUrl.origin deployets interna adress
  // (t.ex. den slumpade *.vercel.app-hosten), inte domanen anvandaren surfar
  // pa. x-forwarded-host + x-forwarded-proto ger den publika adressen. Lokalt
  // saknas rubrikerna och origin ar redan ratt. `nasta` tvingas till en
  // relativ sokvag sa att en manipulerad ?next= inte kan omdirigera bort.
  const proxad = request.headers.get("x-forwarded-host");
  const protokoll = request.headers.get("x-forwarded-proto") ?? "https";
  const bas = proxad ? `${protokoll}://${proxad}` : origin;
  const mal = nasta.startsWith("/") && !nasta.startsWith("//") ? nasta : "/";

  if (code) {
    const supabase = await skapaServerklient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${bas}${mal}`);
    }
  }

  return NextResponse.redirect(`${bas}/login?fel=lank`);
}
