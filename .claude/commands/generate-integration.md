---
description: Нова інтеграція за архітектурою проєкту: модуль, тест, рядок у реєстрі. Core не чіпає, залежностей не додає.
argument-hint: <назва сервісу, напр. telegram-notify або HubSpot>
---

# Generate integration

**Ціль:** $ARGUMENTS
(Якщо в рядку вище немає назви сервісу — ціль вказана в повідомленні одразу після
назви команди. Немає й там — спитай і зупинись.)

## Кроки

1. Прочитай `app/src/core/types.ts` (контракт `Integration`, тип `Lead`),
   `app/src/integrations/slack-notify.ts` як зразок і його тест
   `slack-notify.test.ts` як зразок тестів. Правила — `.claude/rules/architecture.md`
   і `.claude/rules/conventions.md`.
2. Визнач `name` у kebab-case — він **має збігатися** з іменем файлу — і перелік
   `requiredEnv` (лише **імена** змінних, не значення).
3. Створи `app/src/integrations/<name>.ts`: об'єкт типу `Integration`, `send(lead)`
   читає env через `readEnv()`, шле через `postJson()`, розбирає відповідь (якщо
   вона потрібна) через `parseJson(text, guard)`, пише в журнал через `log.*` і
   **завжди** повертає `Result<void>` — жодних винятків назовні.
4. **Вирішu, що це за система.** Месенджер/сповіщення → у тіло запиту йдуть лише
   `name`, `source`, `budgetUsd`. Система обліку (таблиця, CRM) → можна повні дані.
   Це пункт «мінімізація даних» у конвенціях — назви явно, який варіант обрав.
5. Створи `app/src/integrations/<name>.test.ts` — три випадки: успішна відправка
   (перевір URL і тіло запиту), відсутня змінна середовища, помилка від зовнішньої
   системи. Мережу підміняй `vi.stubGlobal("fetch", ...)`, змінні — `vi.stubEnv`.
6. Додай **один рядок** у `app/src/integrations/index.ts`: імпорт і елемент масиву
   `integrations`.
7. Перевір: `cd app && npm test && npm run typecheck && npm run check:rules`.
8. Покажи підсумок: створені файли, `name`, `requiredEnv`, які поля ліда йдуть у
   запит і чому, числа трьох перевірок.

## Acceptance criteria

- [ ] Рівно три зміни: `<name>.ts`, `<name>.test.ts`, один рядок в `index.ts`.
- [ ] `name` у файлі збігається з іменем файлу; обидва в kebab-case.
- [ ] Жодного `fetch`, `process.env`, `JSON.parse`, `console.*`, `any` у новому коді.
- [ ] Три тести проходять; `npm test` зелений; `npm run typecheck` без помилок.
- [ ] `npm run check:rules` — **нових** порушень немає (`TOTAL` не виріс).
- [ ] `package.json` не змінено.

## Stop

`app/src/core/**` не чіпати — контракт `Integration` бери як є; якщо потрібного
поля в `Lead` немає, зупинись і опиши це (див. `.claude/rules/do-not-touch.md`).
Нових залежностей не додавати — жодного `npm install`. Перед завершенням покажи
підсумок і числа перевірок.
