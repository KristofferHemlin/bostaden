// Beskedet over faltgruppen nar avlasningen inte kordes (produktspec,
// "Dokumentavlasning"; src/app/kostnad/nytt/form.tsx). I det laget ar BARA
// bilagan sparad – kostnaden ar ett utkast utan belopp och raknas inte
// nagonstans forran den sparats. Beskedet far darfor aldrig saga att kvittot
// ar sparat: den som laser det lagger undan telefonen, och kvittot saknas i
// underlaget den dag bostaden saljs. tester/avlasningsbesked.test.ts vaktar det.
//
// "Bilagan" och inte "Bilden": en faktura ar ofta en PDF, och bilaga ar appens
// eget ord. Appen talar inte om sig sjalv som ett "vi".

export const AVLASNINGEN_KORDES_INTE =
  "Bilagan är sparad, men den gick inte att läsa av. Fyll i uppgifterna nedan och spara – först då räknas kvittot med.";
