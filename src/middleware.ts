import type { NextRequest } from "next/server";
import { uppdateraSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return uppdateraSession(request);
}

export const config = {
  // Kor pa alla sidor utom statiska filer och bilder.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
