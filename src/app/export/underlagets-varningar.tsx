// Det som gor underlaget ofullstandigt och inte syns nagon annanstans pa
// sidan (K6aExport.varningar). Overst, fore talen: den som laser underlaget
// ska veta att det har ett hal innan hon laser summorna, inte efter.
// produktspec 8: "Ett paket med ett tyst hål är värre än ett paket som säger
// var hålet finns, eftersom det första upptäcks av Skatteverket och det andra
// av användaren."
//
// Sand, inte en varningsfarg – appen har ingen (docs/design.md,
// "Meddelanderutor"). Varje varning ar en hel mening och star for sig.

import { Meddelanderuta } from "@/components/skarm";

export function UnderlagetsVarningar({ varningar }: { varningar: string[] }) {
  if (varningar.length === 0) return null;
  return (
    <Meddelanderuta>
      <ul className="space-y-1">
        {varningar.map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ul>
    </Meddelanderuta>
  );
}
