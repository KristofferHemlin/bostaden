"use client";

export function KlientFelKnapp() {
  return (
    <button
      onClick={() => {
        // @ts-expect-error - avsiktligt odefinierad, för att testa klientfel
        funktionSomInteFinns();
      }}
    >
      Kasta klientfel
    </button>
  );
}
