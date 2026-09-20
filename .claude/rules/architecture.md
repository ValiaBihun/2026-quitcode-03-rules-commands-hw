---
paths:
  - "app/src/**/*.ts"
---

# Архітектура lead-sync

## Контекст

`lead-sync` перенесли з n8n-воркфлоу: тепер це три шари з одностороннім напрямом
залежностей, а ядро спільне для всіх клієнтських воркерів агенції. Шар, доданий
«не туди», ламає цю спільність — тому структура тут не предмет для імпровізації.

## Правило

### Шари й напрям залежностей

- `app/src/core/` — платформа: типи, HTTP, конфіг, парсинг, логер.
  Ядро **не імпортує нічого** з `integrations/` чи `sync/`.
- `app/src/integrations/` — по одному модулю на зовнішню систему + реєстр `index.ts`.
  Інтеграції **не знають про `sync/`**: імпорт із `../sync/` заборонений.
- `app/src/sync/` — запуск синхронізації і стан між запусками. `sync/` працює з
  інтеграціями **лише** через контракт `Integration` з `core/types.ts` і масив
  `integrations` з `integrations/index.ts`. Не імпортуй конкретний модуль
  інтеграції в `sync/` напряму.
- Імпорти всередині `app/src/**` — відносні, з розширенням `.js`
  (напр. `import { postJson } from "../core/http.js"`).

### Нова інтеграція — рівно три речі

1. `app/src/integrations/<kebab-name>.ts` — експортує об'єкт типу `Integration`;
2. `app/src/integrations/<kebab-name>.test.ts` — тест поруч із модулем;
3. один рядок у `app/src/integrations/index.ts` (імпорт + елемент масиву `integrations`).

Більше нічого. Не заводь підтеки, «спільні хелпери» чи базові класи для інтеграцій.

### Публічний API ядра — рівно ось це

| Модуль | Що існує |
|---|---|
| `core/types.ts` | `Lead`, `Result<T>`, `Integration` |
| `core/http.ts` | `postJson(url, body, options?)` → `Promise<Result<string>>`, `PostOptions` |
| `core/config.ts` | `readEnv(name)` → `Result<string>` |
| `core/parse.ts` | `parseJson(text, guard, label?)` → `Result<T>`, `Guard<T>`, `isRecord`, `isString`, `isNumber` |
| `core/log.ts` | `log.info`, `log.warn`, `log.error`, `redact(text)` |

Іншого експорту з `core/` **не існує**. Не імпортуй те, чого немає в таблиці, і не
вигадуй, ніби воно є: `getJson`, `httpClient`, `logger`, `Config`, `AppError`,
`parseSafe` — усього цього в ядрі немає. Бракує чогось — див. правило `do-not-touch`.

## Як перевірити

- `cd app && npm run typecheck` — без помилок (неіснуючий експорт ядра впаде саме тут).
- `cd app && npm run check:rules` → рядок `core-untouched   0`.
- Нова інтеграція: `git status --short` показує рівно два нові файли
  (`<name>.ts`, `<name>.test.ts`) і зміну в `integrations/index.ts`.
- `grep -rnE "from ['\"]\.\./sync/" app/src/integrations/` → порожньо
  (обидва стилі лапок; перевірка лише на `"` пропускає `from '../sync/run.js'`).
