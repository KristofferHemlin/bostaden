// src/lib/sentry-filter.ts – filtreringen som ska halla felrapporterna inom
// det vitlistade sammanhanget (produktspec avsnitt 13): sida, anrop och
// anvandar-id, aldrig kvittobilder, belopp eller atkomsttoken.

import { describe, expect, it } from "vitest";
import type { Breadcrumb, ErrorEvent, EventHint } from "@sentry/nextjs";
import { beforeBreadcrumb, beforeSend, saneraBreadcrumbUrl } from "@/lib/sentry-filter";

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
