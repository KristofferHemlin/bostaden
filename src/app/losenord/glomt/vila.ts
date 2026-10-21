// Vilan efter ett aterstallningsutskick (src/app/losenord/glomt/page.tsx).

/** Supabase slapper igenom en ny aterstallning till samma konto forst efter en
 *  minut (Auth-installningen for utskicksfrekvens, standard 60 s). Ett tryck
 *  dessforinnan skickar inget mejl. Andras installningen ska talet foljas at. */
export const SKICKA_IGEN_EFTER_MS = 60_000;

export const VANTA_MED_NY_LANK = "Du kan be om en ny länk om en stund.";
