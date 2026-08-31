// Sessionsuppdatering och enkel routeskydd. Kors fran src/middleware.ts pa varje
// request. Ingen registreringsdesign – bara: har du ingen session och gar mot en
// skyddad sida, hamnar du pa /login.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseNyckel, supabaseUrl } from "./konfig";

const OSKYDDADE_PREFIX = ["/login", "/auth", "/registrera"];

export async function uppdateraSession(
  request: NextRequest,
): Promise<NextResponse> {
  let svar = NextResponse.next({ request });

  // Utan riktiga Supabase-varden slapper vi igenom allt sa att appen gar att
  // bladdra i medan nyckeln fylls i. Skyddet slar pa nar varden finns.
  const url = supabaseUrl();
  const nyckel = supabaseNyckel();
  if (!url || !nyckel) {
    return svar;
  }

  const supabase = createServerClient(url, nyckel, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesAttSatta) {
        for (const { name, value } of cookiesAttSatta) {
          request.cookies.set(name, value);
        }
        svar = NextResponse.next({ request });
        for (const { name, value, options } of cookiesAttSatta) {
          svar.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sokvag = request.nextUrl.pathname;
  const oskyddad = OSKYDDADE_PREFIX.some(
    (p) => sokvag === p || sokvag.startsWith(`${p}/`),
  );

  if (!user && !oskyddad) {
    const omdirigering = request.nextUrl.clone();
    omdirigering.pathname = "/login";
    return NextResponse.redirect(omdirigering);
  }

  return svar;
}
