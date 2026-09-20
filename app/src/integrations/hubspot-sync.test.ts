import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../core/types.js";
import { hubspotSync, toContactProperties } from "./hubspot-sync.js";

const lead: Lead = {
  id: "ld_0004",
  name: "Ігор Тестовий",
  email: "ihor@studio-nova.example.test",
  phone: "+380 (00) 000-00-00",
  source: "website",
  budgetUsd: 7000,
  createdAt: "2026-09-10T11:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("hubspot-sync", () => {
  it("створює контакт із повними даними ліда", async () => {
    vi.stubEnv("HUBSPOT_TOKEN", "fake-hubspot-token-000000");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"id":"701"}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(hubspotSync.send(lead)).resolves.toEqual({ ok: true, value: undefined });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.hubapi.com/crm/v3/objects/contacts");

    const headers = init?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer fake-hubspot-token-000000");

    expect(JSON.parse(String(init?.body))).toEqual({
      properties: {
        email: "ihor@studio-nova.example.test",
        firstname: "Ігор Тестовий",
        lead_source: "website",
        hs_lead_status: "NEW",
        phone: "+380 (00) 000-00-00",
        budget_usd: "7000",
      },
    });
  });

  it("повертає помилку, якщо не задано HUBSPOT_TOKEN", async () => {
    vi.stubEnv("HUBSPOT_TOKEN", "");

    await expect(hubspotSync.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable HUBSPOT_TOKEN",
    });
  });

  it("повертає помилку, якщо CRM відмовила", async () => {
    vi.stubEnv("HUBSPOT_TOKEN", "fake-hubspot-token-000000");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"message":"invalid token"}', { status: 401 })),
    );

    await expect(hubspotSync.send(lead)).resolves.toEqual({
      ok: false,
      error: "POST https://api.hubapi.com/crm/v3/objects/contacts failed: HTTP 401",
    });
  });

  it("пропускає необов'язкові поля, яких у ліда немає", () => {
    const minimal: Lead = {
      id: "ld_0005",
      name: "Без Телефона",
      email: "no-phone@studio-nova.example.test",
      source: "referral",
      createdAt: "2026-09-10T12:00:00.000Z",
    };

    expect(toContactProperties(minimal)).toEqual({
      email: "no-phone@studio-nova.example.test",
      firstname: "Без Телефона",
      lead_source: "referral",
      hs_lead_status: "NEW",
    });
  });
});
