// Supabase-klient for serverkomponenter, server actions och route handlers.
// Laser och skriver sessionscookies via Next cookies(). I Next 15 ar cookies()
// async, darfor ar denna funktion async.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { kravSupabaseKonfig, supabaseKonfigurerad } from "./konfig";

export { supabaseKonfigurerad };

export async function skapaServerklient() {
  const cookieLager = await cookies();
  const { url, nyckel } = kravSupabaseKonfig();

  return createServerClient(url, nyckel, {
    cookies: {
      getAll() {
        return cookieLager.getAll();
      },
      setAll(cookiesAttSatta) {
        // Kastar i rena serverkomponenter (ingen skrivbar cookie-kontext).
        // Middleware uppdaterar da sessionen i stallet – tryggt att svalja.
        try {
          for (const { name, value, options } of cookiesAttSatta) {
            cookieLager.set(name, value, options);
          }
        } catch {
          // ignoreras med flit
        }
      },
    },
  });
}
