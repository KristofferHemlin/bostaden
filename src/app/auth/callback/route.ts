// Landningspunkt for magisk lank / OTP och for lanken i aterstallningsmejlet.
// Supabase skickar hit med ?code=... som bytes mot en session, darefter vidare
// till ?next= (default oversikten, som i sin tur skickar till /registrera om
// ingen bostad finns).
//
// ?token_hash=...&type=... loses in med verifyOtp. Den formen kraver ingen
// PKCE-cookie fran webblasaren som begarde lanken, och fungerar darfor aven
// nar mejlet oppnas pa en annan enhet – men bara om e-postmallen i Supabase
// pekar hit med {{ .TokenHash }}. Standardmallen ger ?code=.
//
// En aterstallningslank som inte gar att losa in (anvand, for gammal, eller
// Supabase felomdirigering utan kod) leder till sidan for nytt losenord med
// ?lank=ogiltig – den sager vad som hant och erbjuder en ny lank
// (docs/design.md, Inloggningssidan). Inte till inloggningen, dar ingen
// forklaring vantar.

import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { skapaServerklient } from "@/lib/supabase/server";

const NYTT_LOSENORD = "/losenord/nytt";

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

  const tokenHash = searchParams.get("token_hash");
  const typ = searchParams.get("type") as EmailOtpType | null;

  if (code || (tokenHash && typ)) {
    const supabase = await skapaServerklient();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: typ! });
    if (!error) {
      return NextResponse.redirect(`${bas}${mal}`);
    }
  }

  if (mal === NYTT_LOSENORD) {
    return NextResponse.redirect(`${bas}${NYTT_LOSENORD}?lank=ogiltig`);
  }
  return NextResponse.redirect(`${bas}/login?fel=lank`);
}
