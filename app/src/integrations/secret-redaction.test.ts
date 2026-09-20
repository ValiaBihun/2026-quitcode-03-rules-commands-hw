// Секрети інтеграцій не повинні потрапляти в журнал.
//
// postJson() пише невдалу спробу через log.warn і вкладає URL у текст помилки.
// Для Telegram і Sheets токен є частиною URL, тож єдине, що стоїть між ним і
// журналом, — log.redact(). Цей тест фіксує, що воно справді накриває форми
// секретів, які використовують наші інтеграції: якщо хтось змінить патерн у
// core/log.ts або форму URL в інтеграції, тест впаде.
import { describe, expect, it } from "vitest";
import { redact } from "../core/log.js";

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
