// Indatan till underlaget, hamtad pa ett stalle (docs/design.md, "Beskedet när
// ett värde ändrar vilka kvitton som räknas"). Exportvyn och beskedet fore ett
// sparande raknar pa samma indata, sa att talet i beskedet ar det tal hon
// sedan ser i underlaget. Byggdes de tva for sig skulle de glida isar – ett
// andelsvillkor eller ett filter pa utkast som bara den ena kanner till – och
// beskedet skulle lova ett tal som exportvyn inte visar.

import type { K6aIndata } from "@/doman/export-k6a";
import { hamtaAndelar } from "@/lib/andelar";
import { hamtaBostadsdata, hamtaUtkastSomInteArTomma, tillDomanBostad } from "@/lib/doman-fran-db";
import { andelAttMultiplicera, andelForUnderlag } from "@/lib/samagande";

export async function hamtaUnderlagetsIndata(bostadId: string, egenAndel: number | null) {
  const [data, andelar, utkastSomInteArTomma] = await Promise.all([
    hamtaBostadsdata(bostadId),
    hamtaAndelar(bostadId),
    hamtaUtkastSomInteArTomma(bostadId),
  ]);
  const medlemsandelar = andelar.medlemmar.map((m) => m.andel);
  const andelslage = andelForUnderlag({ egenAndel, medlemsandelar });
  const andelarnaGarIhop = andelslage.slag !== "gar_inte_ihop";
  const indata: K6aIndata = {
    bostad: tillDomanBostad(data.bostad),
    medlemskap: { agarandel: andelAttMultiplicera(andelslage) },
    projekt: data.projekt,
    kostnader: data.kostnader,
    utkast_som_inte_ar_tomma: utkastSomInteArTomma,
    regelparametrar: data.regelparametrar,
  };
  return { ...data, andelar, utkastSomInteArTomma, andelslage, andelarnaGarIhop, indata };
}
