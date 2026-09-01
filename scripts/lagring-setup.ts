// Idempotent engangsskript: skapar (eller bekraftar) den PRIVATA bucketen for
// bilagor i Supabase Storage.
//
//   npm run lagring:setup
//
// Kraver NEXT_PUBLIC_SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY i .env.
//
// Bucketen ar privat – alltid. Bilagorna ar kvitton och fakturor med belopp,
// leverantorer och datum, ekonomiska handlingar som aldrig far ligga pa en
// publik URL. Atkomst sker via korta signerade URL:er som servern skapar efter
// behorighetskontroll mot medlemskapet (produktspec avsnitt 12).

import { createClient } from "@supabase/supabase-js";

const BUCKET = "bilagor";
const MAX_FIL_BYTES = 10 * 1024 * 1024;
const TILLATNA_MIMETYPER = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/pdf",
];

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleNyckel = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleNyckel) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY måste vara satta i .env.",
    );
  }

  const supabase = createClient(url, serviceRoleNyckel, {
    auth: { persistSession: false },
  });

  const installningar = {
    public: false as const,
    fileSizeLimit: MAX_FIL_BYTES,
    allowedMimeTypes: TILLATNA_MIMETYPER,
  };

  const { data: befintlig } = await supabase.storage.getBucket(BUCKET);

  if (befintlig) {
    const { error } = await supabase.storage.updateBucket(BUCKET, installningar);
    if (error) throw error;
    console.log(
      `Bucketen "${BUCKET}" fanns redan – bekräftad privat, 10 MB-gräns och tillåtna format satta.`,
    );
    return;
  }

  const { error } = await supabase.storage.createBucket(BUCKET, installningar);
  if (error) throw error;
  console.log(`Privat bucket "${BUCKET}" skapad (10 MB-gräns, JPG/PNG/HEIC/PDF).`);
}

main().catch((fel) => {
  console.error(fel);
  process.exitCode = 1;
});
