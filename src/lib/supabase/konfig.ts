// Delad, beroendefri uppslagning av Supabase-varden sa att bade middleware
// (edge), serverklienten och webbklienten drar dem fran samma stalle.
//
// Nyckeln kan heta tva saker: nyare projekt anvander en "publishable key"
// (sb_publishable_...), aldre en anon-JWT. Bada godtas – ordningen nedan ar
// prioritet. All access ar statisk (process.env.NEXT_PUBLIC_...) sa att Next
// kan inlina vardena aven i klientbunten; en berakning som process.env[namn]
// hade blivit undefined dar.

const URL_NAMN = "NEXT_PUBLIC_SUPABASE_URL";
const NYCKEL_NAMN =
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY eller NEXT_PUBLIC_SUPABASE_ANON_KEY";

function rensa(varde: string | undefined): string | undefined {
  const t = varde?.trim();
  return t ? t : undefined;
}

export function supabaseUrl(): string | undefined {
  return rensa(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseNyckel(): string | undefined {
  return (
    rensa(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
    rensa(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

/** Bool-check som aldrig kastar – styr om appen kor med inloggning eller slapper igenom. */
export function supabaseKonfigurerad(): boolean {
  const url = supabaseUrl();
  const nyckel = supabaseNyckel();
  return (
    !!url &&
    url.startsWith("https://") &&
    !!nyckel &&
    nyckel.length > 20 &&
    !nyckel.includes("PLACEHOLDER")
  );
}

/**
 * Ger url + nyckel eller kastar ett fel som namnger exakt vilken variabel som
 * saknas. Anvands dar en Supabase-klient faktiskt ska skapas – ersatter det
 * tysta `?? ""` som annars gav Supabases obegripliga "URL and Key are required".
 */
export function kravSupabaseKonfig(): { url: string; nyckel: string } {
  const url = supabaseUrl();
  const nyckel = supabaseNyckel();

  const saknas: string[] = [];
  if (!url) saknas.push(URL_NAMN);
  if (!nyckel) saknas.push(NYCKEL_NAMN);

  if (saknas.length > 0) {
    throw new Error(
      `Supabase-klienten kan inte skapas: ${saknas.join(
        " och ",
      )} saknas i miljon. Lagg till variabeln i .env (projektets rot) och starta om dev-servern.`,
    );
  }

  return { url: url as string, nyckel: nyckel as string };
}
