import type { NextRequest } from "next/server";
import { uppdateraSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return uppdateraSession(request);
}

export const config = {
  // Kor pa alla sidor utom statiska filer och bilder. `pdfjs` ar de kopierade
  // pdf.js-byggena i public/ – de laddas som moduler/worker och far inte
  // omdirigeras till /login.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|pdfjs/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
