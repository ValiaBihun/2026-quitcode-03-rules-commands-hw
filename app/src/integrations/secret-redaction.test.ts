// Секрети інтеграцій не повинні потрапляти в журнал.
//
// postJson() пише невдалу спробу через log.warn і вкладає URL у текст помилки.
// Для Telegram і Sheets токен є частиною URL, тож єдине, що стоїть між ним і
// журналом, — log.redact().
//
// Тут два рівні перевірки:
//   1. модульний — патерни redact() проти форм секретів, які ми використовуємо;
//   2. наскрізний — реальний виклик send() із помилкою HTTP 500, де перевіряється
//      те, що справді потрапило в console. Саме другий ловить зміну форми URL в
//      інтеграції; перший — лише зміну патернів у core/log.ts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { redact } from "../core/log.js";
import sheetsAppend from "./sheets-append.js";
import { telegramNotify } from "./telegram-notify.js";
import type { Lead } from "../core/types.js";

describe("маскування секретів у журналі", () => {
  it("токен Telegram у шляху URL", () => {
    const line = redact(
      "POST https://api.telegram.org/bot123456789:AAHfake_token_abcdefghijklmno/sendMessage failed: HTTP 429",
    );

    expect(line).not.toContain("AAHfake_token_abcdefghijklmno");
    expect(line).toContain("bot<REDACTED>");
  });

  it("токен Sheets у query string", () => {
    const line = redact("POST https://sheets.example.test/append?token=fake-sheets-token-0000 failed: HTTP 500");

    expect(line).not.toContain("fake-sheets-token-0000");
    expect(line).toContain("?token=<REDACTED>");
  });

  it("Bearer-заголовок HubSpot", () => {
    const line = redact("Authorization: Bearer fake-hubspot-token-000000");

    expect(line).not.toContain("fake-hubspot-token-000000");
    expect(line).toContain("Bearer <REDACTED>");
  });

  it("шлях Slack-вебхука", () => {
    const line = redact("POST https://hooks.slack.example.test/services/T000/B000/fake failed: HTTP 429");

    expect(line).not.toContain("T000/B000/fake");
    expect(line).toContain("/services/<REDACTED>");
  });
});

// ── Наскрізно: що справді потрапляє в console під час збою ──────────────────
//
// 500 обрано навмисно: postJson повторює спробу лише на 5xx/429 і саме тоді
// пише log.warn з повним URL. На 4xx він виходить із циклу ще до запису.

const lead: Lead = {
  id: "ld_0009",
  name: "Тест Секретів",
  email: "secrets@studio-nova.example.test",
  source: "website",
  createdAt: "2026-09-10T13:00:00.000Z",
};

describe("секрети не потрапляють у журнал під час збою запиту", () => {
  let written: string[];

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const captureConsole = () => {
    written = [];
    const collect = (...args: unknown[]) => void written.push(args.map(String).join(" "));
    vi.spyOn(console, "log").mockImplementation(collect);
    vi.spyOn(console, "error").mockImplementation(collect);
  };

  it("telegram-notify: токен зі шляху URL не видно в журналі", async () => {
    const token = "123456789:AAHfake_token_abcdefghijklmno";
    vi.stubEnv("TELEGRAM_BOT_TOKEN", token);
    vi.stubEnv("TELEGRAM_CHAT_ID", "-1000000000000");
    captureConsole();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream down", { status: 500 })),
    );

    const result = await telegramNotify.send(lead);

    expect(result.ok).toBe(false);
    expect(written.length).toBeGreaterThan(0);
    const journal = written.join("\n");
    expect(journal).not.toContain(token);
    expect(journal).toContain("bot<REDACTED>");
  });

  it("sheets-append: токен із query string не видно в журналі", async () => {
    const token = "fake-sheets-token-0000";
    vi.stubEnv("SHEETS_WEBHOOK_URL", "https://sheets.example.test/append");
    vi.stubEnv("SHEETS_TOKEN", token);
    captureConsole();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream down", { status: 500 })),
    );

    const result = await sheetsAppend.send(lead);

    expect(result.ok).toBe(false);
    expect(written.length).toBeGreaterThan(0);
    const journal = written.join("\n");
    expect(journal).not.toContain(token);
    expect(journal).toContain("?token=<REDACTED>");
  });
});
