"use client";

// Satter Sentry-anvandaren i webblasaren (produktspec avsnitt 13). Id:t
// hamtas server-sidan (rot-layouten, via hamtaAnvandare()) och skickas ner
// hit, eftersom sessionen bara gar att lasa server-sidan – klienten har ingen
// egen auth-koll att hanga upp det pa.
//
// Bara id:t – aldrig e-post eller namn. beforeSend i sentry-filter.ts
// reducerar dessutom anvandarobjektet till { id } aven om nagot annat
// skulle satta mer har.

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export function SentryAnvandare({ id }: { id: string | null }) {
  useEffect(() => {
    if (id) Sentry.setUser({ id });
  }, [id]);

  return null;
}
