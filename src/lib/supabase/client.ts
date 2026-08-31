// Supabase-klient for webblasaren (klientkomponenter). Nyckeln ar publik och far
// ligga i klientbunten – radsakerhet gors i Supabase, inte har. URL och nyckel
// kommer fran NEXT_PUBLIC_-variabler; se .env.example.

import { createBrowserClient } from "@supabase/ssr";
import { kravSupabaseKonfig } from "./konfig";

export function skapaWebbklient() {
  const { url, nyckel } = kravSupabaseKonfig();
  return createBrowserClient(url, nyckel);
}
