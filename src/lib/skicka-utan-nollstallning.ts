"use client";

// Ett formular som avvisas ska visa det hon skrev, inte det lagrade vardet
// (docs/design.md, "Inställningssidan": "Och det hon skrev står kvar när
// fältet avvisar").
//
// React 19 nollstaller ett <form action={funktion}> till sina defaultValue
// nar actionen ar klar – OAVSETT om servern svarade med ett fel. Varje
// okontrollerat falt i formularet far da tillbaka sitt startvarde, aven de
// som inte hade nagot fel, och felet pekar pa ett varde som inte langre syns.
// Uppmatt 2026-11-09 pa storleken i kortet Bostaden: samma DOM-nod, vardet
// aterstallt – inte Falts ommontering, som byter ut noden.
//
// Nollstallningen gors bara for formular vars action skickas via
// action-propen. Ett formular som i stallet skickar fran onSubmit, i en
// transition, far samma vantlage fran useActionState men behaller sina varden.
//
// Anvands sa: <form onSubmit={(e) => { hanteraSubmit(e);
// skickaUtanNollstallning(e, action); }}> – utan action-prop. En
// onSubmit-hanterare som redan stoppat inskickningen (forhandskontroll,
// dubbelinskick) respekteras.

import { type FormEvent, startTransition } from "react";

export function skickaUtanNollstallning(
  e: FormEvent<HTMLFormElement>,
  action: (formData: FormData) => void,
): void {
  if (e.defaultPrevented) return;
  e.preventDefault();
  const skickare = (e.nativeEvent as SubmitEvent).submitter;
  const formData = new FormData(e.currentTarget, skickare ?? undefined);
  startTransition(() => action(formData));
}
