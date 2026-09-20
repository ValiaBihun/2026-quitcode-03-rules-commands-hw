# AGENTS.md — lead-sync

`lead-sync` — воркер, перенесений з n8n-воркфлоу для клієнта Studio Nova. Кожні
5 хвилин бере нові заявки з форми сайту й розсилає їх в інтеграції: Slack-канал
менеджерів, Google-таблицю, далі — CRM і месенджери. TypeScript, Node 22+,
Vitest, **нуль runtime-залежностей**.

## Команди

Усі — з теки `app/`:

| Команда | Для чого |
|---|---|
| `npm install` | встановлення (лише devDependencies) |
| `npm test` | Vitest, без реальної мережі |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:rules` | статична перевірка конвенцій проєкту |

Поточна лінія: **44 тести зелені**, `check:rules` → **TOTAL: 0**.
Нових порушень після твоєї задачі бути не повинно.

⚠️ `TOTAL: 0` не означає «дефектів немає». `loadState` у `src/sync/state.ts` досі
тихо відкочує курсор на побитому файлі стану — це корінна причина нічного
інциденту, і статична перевірка такого не ловить. Деталі й план — у коментарі на
початку файлу та в [`docs/verification.md`](docs/verification.md).

## Карта коду

```
app/src/
  core/          платформа: типи, HTTP, конфіг, парсинг, логер — ЗАХИЩЕНО, не редагувати
  integrations/  один модуль на зовнішню систему + реєстр index.ts
  sync/          запуск синхронізації і стан між запусками
```

Напрям залежностей односторонній: `integrations/` і `sync/` імпортують з `core/`,
`core/` — ні з чого.

## Найважливіше — одним рядком

1. `app/src/core/**`, `app/scripts/**`, `materials/**`, `.github/**`, `.coderabbit.yaml` не редагуються — без винятків.
2. Помилки — значення: `Result<T>`, а не винятки; `send()` завжди повертає `Result<void>`.
3. HTTP — лише `postJson()`; змінні середовища — лише `readEnv()`.
4. Зовнішній JSON — лише `parseJson(text, guard)`; мовчазних дефолтів на помилку немає.
5. Журнал — лише `log.*`, не `console.*` (логер маскує секрети).
6. Без `any` і без нових залежностей.
7. У сповіщення не йдуть email і телефон ліда — лише ім'я, джерело, бюджет.

Деталі, приклади й перевірки — у правилах проєкту, копіювати їх сюди не треба:

- [`.claude/rules/architecture.md`](.claude/rules/architecture.md) — шари, нова інтеграція, публічний API ядра
- [`.claude/rules/conventions.md`](.claude/rules/conventions.md) — конвенції коду й тестів
- [`.claude/rules/do-not-touch.md`](.claude/rules/do-not-touch.md) — захищені зони і що робити, коли задача в них упирається

Джерело істини для правил — [`materials/architecture-brief.md`](materials/architecture-brief.md) (читати, не редагувати).

## Перед комітом

```bash
cd app && npm test && npm run typecheck && npm run check:rules
```

Далі `git status --short`: у списку не має бути нічого із захищених зон.
