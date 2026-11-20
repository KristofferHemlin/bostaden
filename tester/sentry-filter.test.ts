// src/lib/sentry-filter.ts – filtreringen som ska halla felrapporterna inom
// det vitlistade sammanhanget (produktspec avsnitt 13): sida, anrop och
// anvandar-id, aldrig kvittobilder, belopp eller atkomsttoken.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Breadcrumb, ErrorEvent, EventHint } from "@sentry/nextjs";
import {
  beforeBreadcrumb,
  beforeSend,
  PRISMA_ARGUMENT_BORTTAGNA,
  saneraBreadcrumbUrl,
  saneraText,
  utanSessioner,
} from "@/lib/sentry-filter";

describe("saneraBreadcrumbUrl", () => {
  it("strippar token och sokvag (bostad_id/kostnad_id) ur en signerad lagringslank", () => {
    const signerad =
      "https://xyzabc.supabase.co/storage/v1/object/sign/kvitton/bostad-1/kostnad-42/a1b2.jpg" +
      "?token=eyJhbGciOiJIUzI1NiJ9.eyJhbGxlaG9wcCI.abc123&exp=1999999999";

    const resultat = saneraBreadcrumbUrl(signerad);

    expect(resultat).toBe("https://xyzabc.supabase.co");
    expect(String(resultat)).not.toMatch(/token|bostad-1|kostnad-42/);
  });

  it("strippar bara query-strangen for en vanlig (icke-lagrings-) url", () => {
    const resultat = saneraBreadcrumbUrl(
      "https://exempel.se/api/kostnad?belopp=1997&leverantor=Bauhaus",
    );
    expect(resultat).toBe("https://exempel.se/api/kostnad");
  });

  it("lamnar en url utan query-strang oforandrad", () => {
    expect(saneraBreadcrumbUrl("https://exempel.se/api/kostnad")).toBe(
      "https://exempel.se/api/kostnad",
    );
  });

  it("tar i alla fall bort query-strangen fran en relativ sokvag den inte kan tolka som absolut url", () => {
    expect(saneraBreadcrumbUrl("/api/kostnad?token=hemligt")).toBe("/api/kostnad");
  });
});

describe("beforeBreadcrumb", () => {
  function fetchBrodsmula(data: Record<string, unknown>): Breadcrumb {
    return { category: "fetch", data };
  }

  it("saneras url:en i en fetch-brodsmula mot en signerad lagringslank", () => {
    const brodsmula = fetchBrodsmula({
      url:
        "https://xyzabc.supabase.co/storage/v1/object/sign/kvitton/bostad-1/kostnad-42/a1b2.jpg?token=hemligt",
      method: "GET",
      status_code: 200,
    });

    const resultat = beforeBreadcrumb(brodsmula);

    expect(resultat?.data).toEqual({
      url: "https://xyzabc.supabase.co",
      method: "GET",
      status_code: 200,
    });
  });

  it("lamnar xhr-brodsmulor utan data-falt orörda", () => {
    const brodsmula: Breadcrumb = { category: "xhr" };
    expect(beforeBreadcrumb(brodsmula)).toEqual(brodsmula);
  });

  it("rör inte brodsmulor av andra kategorier", () => {
    const brodsmula: Breadcrumb = {
      category: "navigation",
      data: { to: "/kostnad/42" },
    };
    expect(beforeBreadcrumb(brodsmula)).toEqual(brodsmula);
  });
});

describe("beforeSend – anvandarobjektet", () => {
  function handelse(overrides: Partial<ErrorEvent>): ErrorEvent {
    return { ...overrides } as ErrorEvent;
  }

  it("reducerar ett anvandarobjekt med e-post och namn till bara id", () => {
    const resultat = beforeSend(
      handelse({ user: { id: "anv-1", email: "test@exempel.se", username: "Test Testsson" } }),
      {} as EventHint,
    );
    expect(resultat?.user).toEqual({ id: "anv-1" });
  });

  it("tar bort anvandarobjektet helt om det saknar id", () => {
    const resultat = beforeSend(
      handelse({ user: { email: "test@exempel.se" } }),
      {} as EventHint,
    );
    expect(resultat?.user).toBeUndefined();
  });

  it("stryker cookies, query-strang och Authorization-header fran request", () => {
    const resultat = beforeSend(
      handelse({
        request: {
          cookies: { session: "hemligt" },
          query_string: "belopp=1997",
          headers: { Authorization: "Bearer hemligt", "Content-Type": "application/json" },
        },
      }),
      {} as EventHint,
    );
    expect(resultat?.request?.cookies).toBeUndefined();
    expect(resultat?.request?.query_string).toBeUndefined();
    expect(resultat?.request?.headers).toEqual({ "Content-Type": "application/json" });
  });
});

describe("saneraText – felets eget meddelande", () => {
  // Riktiga valideringsfel från Prisma, uppmätta mot databasen 2026-11-20
  // (tester/fixturer/prisma-valideringsfel.json). Meddelandet bar anropets
  // argument ordagrant – en leverantör, en gatuadress, en e-postadress.
  const PRISMA = JSON.parse(
    readFileSync(join(process.cwd(), "tester/fixturer/prisma-valideringsfel.json"), "utf-8"),
  ).meddelanden as Record<string, string>;
  const VARDEN = /Hemliga Byggfirman|Storgatan 1|anna\.andersson@exempel\.se|tolvtusen/;

  it.each([
    ["kostnadMedFelTyp", "Invalid `prisma.kostnad.findMany()` invocation:", "Argument `totalbelopp`: Invalid value provided. Expected IntNullableFilter, Int or Null, provided String."],
    ["bostadMedOkantFalt", "Invalid `prisma.bostad.findMany()` invocation:", "Unknown argument `gatuadressen`. Available options are marked with ?."],
    ["anvandareMedEpost", "Invalid `prisma.anvandare.findMany()` invocation:", "Argument `id`: Invalid value provided. Expected UuidFilter or String, provided Int."],
  ])("%s: argumenten bort, anropet och felet kvar", (namn, rubrik, felrad) => {
    expect(PRISMA[namn], "förutsättningen: meddelandet bär värdena").toMatch(VARDEN);
    const ut = saneraText(PRISMA[namn]);
    expect(ut).toBe(`\n${rubrik}\n\n${PRISMA_ARGUMENT_BORTTAGNA}\n\n${felrad}`);
  });

  it("e-postadresser och sökparametrar i fullständiga adresser tas bort i varje text", () => {
    expect(saneraText("kunde inte nå https://x.supabase.co/storage/v1/object/sign/a.jpg?token=t för anna@exempel.se")).toBe(
      "kunde inte nå https://x.supabase.co/storage/v1/object/sign/a.jpg för [e-post]",
    );
  });

  it("ett meddelande utan något av det lämnas orört", () => {
    expect(saneraText("Kunde inte läsa sidantalet")).toBe("Kunde inte läsa sidantalet");
  });
});

describe("beforeSend – adresserna i händelsen", () => {
  it("sidans adress, Referer och Nexts request_path bär inte sina sökparametrar", () => {
    const ut = beforeSend(
      {
        request: { url: "https://kvittobo.se/kostnad/k-1?utkast=u-1", headers: { Referer: "https://kvittobo.se/export?fran=x" } },
        contexts: { nextjs: { request_path: "/kostnad/k-1?utkast=u-1", router_kind: "App Router" } },
      } as unknown as ErrorEvent,
      {} as EventHint,
    )!;
    expect(ut.request!.url).toBe("https://kvittobo.se/kostnad/k-1");
    expect(ut.request!.headers).toEqual({ Referer: "https://kvittobo.se/export" });
    expect(ut.contexts!.nextjs).toEqual({ request_path: "/kostnad/k-1", router_kind: "App Router" });
  });
});

describe("beforeBreadcrumb – navigering, konsol och klick", () => {
  it("navigeringen utan sökparametrar", () => {
    expect(beforeBreadcrumb({ category: "navigation", data: { from: "/a?x=1", to: "/b?y=2" } })!.data).toEqual({ from: "/a", to: "/b" });
  });
  it("konsolen skickas inte", () => {
    expect(beforeBreadcrumb({ category: "console", message: "Bauhaus 12 000 kr" })).toBeNull();
  });
  it("klickets elementattribut bort, taggen och klasserna kvar", () => {
    expect(beforeBreadcrumb({ category: "ui.click", message: 'body > button.knapp[title="Bauhaus 12 000 kr"]' })!.message).toBe(
      "body > button.knapp",
    );
  });
});

describe("utanSessioner", () => {
  it("tar bort sessionerna och bara dem", () => {
    const namn = ["InboundFilters", "BrowserSession", "ProcessSession", "RequestData"].map((name) => ({ name }));
    expect(utanSessioner(namn).map((i) => i.name)).toEqual(["InboundFilters", "RequestData"]);
  });
});
