// Landningspunkt for magisk lank / OTP. Supabase skickar hit med ?code=... som
// bytes mot en session, darefter vidare till oversikten (som i sin tur skickar
// till /registrera om ingen bostad finns).

import { NextResponse, type NextRequest } from "next/server";
import { skapaServerklient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nasta = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await skapaServerklient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${nasta}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?fel=lank`);
}
