// Service-role-klient for Supabase Storage. ENDAST server.
//
// Bucketen ar privat. All atkomst gar genom servern: appen kontrollerar
// behorigheten mot medlemskapet och harleder alltid sokvagen ur kostnadens id
// (produktspec 12). Darfor kringgas RLS pa storage.objects medvetet – klienten
// far aldrig en permanent lank och servern litar aldrig pa en sokvag fran
// klienten.

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { kravLagringskonfig } from "@/lib/supabase/konfig";
import { BILAGOR_BUCKET } from "./bilaga-regler";

export { BILAGOR_BUCKET };

let cachad: SupabaseClient | null = null;

export function lagringsklient(): SupabaseClient {
  if (cachad) return cachad;
  const { url, serviceRoleNyckel } = kravLagringskonfig();
  cachad = createClient(url, serviceRoleNyckel, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachad;
}

export function bilagelager() {
  return lagringsklient().storage.from(BILAGOR_BUCKET);
}
