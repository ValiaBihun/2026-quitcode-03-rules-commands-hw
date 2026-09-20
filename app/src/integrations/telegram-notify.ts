// Сповіщення про новий лід у Telegram-чат менеджерів.
// Месенджер — не система обліку: email і телефон ліда сюди не йдуть.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

/** Відповідь Bot API: {"ok":true,...} або {"ok":false,"description":"..."}. */
interface TelegramResponse {
  ok: boolean;
  description?: string;
}

const isTelegramResponse = (value: unknown): value is TelegramResponse =>
  isRecord(value) &&
  typeof value.ok === "boolean" &&
  (value.description === undefined || typeof value.description === "string");

export function formatTelegramMessage(lead: Lead): string {
  const budget = lead.budgetUsd === undefined ? "бюджет не вказано" : `бюджет $${lead.budgetUsd}`;
  return `Новий лід: ${lead.name} · ${lead.source} · ${budget}`;
}

export const telegramNotify: Integration = {
  name: "telegram-notify",
  requiredEnv: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],

  async send(lead: Lead): Promise<Result<void>> {
    const botToken = readEnv("TELEGRAM_BOT_TOKEN");
    if (!botToken.ok) return botToken;

    const chatId = readEnv("TELEGRAM_CHAT_ID");
    if (!chatId.ok) return chatId;

    const url = `https://api.telegram.org/bot${botToken.value}/sendMessage`;
    const body = { chat_id: chatId.value, text: formatTelegramMessage(lead) };

    const response = await postJson(url, body);
    if (!response.ok) {
      log.error(`telegram-notify: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    const parsed = parseJson(response.value, isTelegramResponse, "telegram-notify");
    if (!parsed.ok) {
      log.error(`telegram-notify: lead ${lead.id} not delivered: ${parsed.error}`);
      return parsed;
    }

    if (!parsed.value.ok) {
      const reason = parsed.value.description ?? "unknown error";
      log.error(`telegram-notify: lead ${lead.id} not delivered: ${reason}`);
      return { ok: false, error: `telegram error: ${reason}` };
    }

    log.info(`telegram-notify: lead ${lead.id} delivered`);
    return { ok: true, value: undefined };
  },
};
