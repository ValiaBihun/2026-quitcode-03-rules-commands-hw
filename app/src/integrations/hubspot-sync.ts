// Створює контакт у HubSpot CRM для кожного нового ліда.
// CRM — система обліку, а не сповіщення: сюди йдуть повні дані ліда, включно з
// email і телефоном. Токен передається заголовком, а не в query — у журнал він
// не потрапляє взагалі.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

const CONTACTS_URL = "https://api.hubapi.com/crm/v3/objects/contacts";

/** Відповідь CRM на створення контакту: {"id":"701","properties":{…}}. */
interface HubspotContact {
  id: string;
}

const isHubspotContact = (value: unknown): value is HubspotContact =>
  isRecord(value) && isString(value.id);

export function toContactProperties(lead: Lead): Record<string, string> {
  const properties: Record<string, string> = {
    email: lead.email,
    firstname: lead.name,
    lead_source: lead.source,
    hs_lead_status: "NEW",
  };
  if (lead.phone !== undefined) properties.phone = lead.phone;
  if (lead.budgetUsd !== undefined) properties.budget_usd = String(lead.budgetUsd);
  return properties;
}

export const hubspotSync: Integration = {
  name: "hubspot-sync",
  requiredEnv: ["HUBSPOT_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const token = readEnv("HUBSPOT_TOKEN");
    if (!token.ok) return token;

    const response = await postJson(
      CONTACTS_URL,
      { properties: toContactProperties(lead) },
      { headers: { authorization: `Bearer ${token.value}` } },
    );
    if (!response.ok) {
      log.error(`hubspot-sync: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    const parsed = parseJson(response.value, isHubspotContact, "hubspot-sync");
    if (!parsed.ok) {
      log.error(`hubspot-sync: lead ${lead.id} not delivered: ${parsed.error}`);
      return parsed;
    }

    log.info(`hubspot-sync: lead ${lead.id} delivered as contact ${parsed.value.id}`);
    return { ok: true, value: undefined };
  },
};
