# Перевірка (Task B, C і бонус E)

> Сюди — лише те, що справді сталося в сесії: цитати, числа, імена файлів.

**Інструмент:** Claude Code (desktop app, Code tab), модель Opus 5
**Базова лінія до роботи:** `npm test` → 18 passed (6 файлів);
`npm run check:rules` → `TOTAL: 8 violation(s)`; `npm run typecheck` → без помилок.

> ⚠️ **Чесне застереження про форму прогонів.** Правила й команди створювались
> усередині цієї ж сесії, а Claude Code читає `.claude/commands/` і `.claude/rules/`
> на старті сесії. Тому виклик `/analyze-error` у цій сесії повернув
> `Unknown skill: analyze-error` — команда ще не була зареєстрована. Прогони нижче
> виконані **покроково за текстом файлів команд**, з фіксацією реальних чисел.
> Рядок «Чи підставився `$ARGUMENTS`» заповнюється в **новій** сесії — див.
> «Що лишилось підтвердити в новій сесії» в кінці файла.

---

## Task B — чи бачить інструмент AGENTS.md

- Інструмент і версія: Claude Code (desktop app), модель Opus 5
- Що було до: `CLAUDE.md` містив markdown-**посилання** `[AGENTS.md](./AGENTS.md)`.
  Посилання не є імпортом — Claude Code не завантажує файл за ним, агент бачить
  лише рядок тексту. Це і був баг стартера.
- Що зроблено: у `CLAUDE.md` поставлено **імпорт окремим рядком** — `@AGENTS.md`;
  нижче лишилось тільки специфічне для Claude Code (перелік правил, команд, хук).
  `AGENTS.md` переписано з «пиши якісний код» на 58 рядків конкретики.
- Як перевірити: `/context` → розділ **Memory files**.
- Результат: <заповнити в новій сесії — очікується `CLAUDE.md` і підтягнутий
  через `@` `AGENTS.md`>

---

## Task C — прогони команд

### `/analyze-error materials/error-log.txt`

- Виклик: `/analyze-error materials/error-log.txt`
- Чи підставився `$ARGUMENTS`: <заповнити в новій сесії>
- **Тригер:** `2026-09-10T00:02:37Z` — нічний бекап забив диск
  (`disk usage /srv/lead-sync/data: 97%`, о 00:05 — 100%). О 00:05 і 00:10 прогін
  падає з `ENOSPC` у `saveState` (`app/src/sync/state.ts:21`), викликаному з
  `runSync` (`app/src/sync/run.ts:18`).
- **Корінна причина:** `app/src/sync/state.ts:13–17` — `loadState()` обгортає
  `JSON.parse(readFileSync(...))` у `try/catch`, і в `catch` **мовчки повертає**
  `INITIAL_STATE` з `lastSyncedAt: "1970-01-01T00:00:00.000Z"`.
  Механізм: `writeFileSync` спершу обрізає файл, а вже потім пише, тож падіння на
  `ENOSPC` лишило `data/sync-state.json` порожнім/побитим. Після цього кожен
  наступний запуск читає порожній файл, тихо відкочує курсор у 1970 рік і вважає
  **всі ~1300 лідів** новими — звідси дублікати в Slack і в таблиці.
- **Чому це не тригер:** о `00:13:48` ops звільнили диск (`disk usage: 41%`), а
  дублікати йшли ще до `09:14` — **дев'ять годин** після зникнення тригера.
  Місце на диску не було тим, що тримало систему зламаною.
- **Чому воно не полагодилось саме (друга половина механізму):** `runSync` пише
  новий `lastSyncedAt` **лише в кінці** прогону (`app/src/sync/run.ts`, останній
  `saveState`). Розсилка ~1300 лідів × 2 інтеграції впирається в ліміт Slack
  (`HTTP 429` о 00:18) і планувальник вбиває процес на 4м30с
  (`run exceeded 4m30s limit, worker process killed (SIGKILL)`) — **до** того
  запису. Стан не лагодиться ніколи, і цикл самопідтримується кожні 5 хвилин.
- **Яку конвенцію порушено:** «Зовнішнім даним не довіряємо» — будь-який JSON лише
  через `parseJson(text, guard)`, а невалідний JSON це `Result{ok:false}`, який
  видно в журналі; тихий дефолт заборонений. Цей самий рядок ловить і
  `check:rules`: `src/sync/state.ts  json-via-parse  line 14`. Це **останнє**
  порушення, що лишилось у проєкті.
- **Тест, що відтворює:** `app/src/sync/state.test.ts` — записати у тимчасовий файл
  порожній рядок (як після обірваного `writeFileSync`) і викликати `loadState(path)`.
  Зараз повертає `{ lastSyncedAt: "1970-01-01T00:00:00.000Z" }` мовчки; очікування —
  помилка назовні, а не відкат курсора. Рівнем вище: `runSync` з побитим станом і
  трьома старими лідами зараз звітує `pending: 3` замість `pending: 0`.
- **План виправлення (не застосований):** `loadState` повертає `Result<SyncState>`
  через `parseJson` з guard на `{ lastSyncedAt: string }`; `runSync` на
  `ok: false` **зупиняє прогін** з помилкою в журналі замість розсилки з нуля;
  окремо — зберігати курсор інкрементально, щоб убитий прогін не втрачав прогрес.
  Обидва файли в `app/src/sync/`, ядро чіпати не треба.
- **Чи зупинився там, де сказано в Stop:** так. Код не змінювався:
  `git diff -- app/src/sync/` порожній, файл `state.test.ts` не створювався.
  Порушення `json-via-parse` у `state.ts:14` лишилось у `check:rules` навмисно —
  як доказ, що звіт не перетворився на самовільний фікс.

### `/refactor app/src/integrations/sheets-append.ts`

- Виклик: `/refactor app/src/integrations/sheets-append.ts`
- `npm run check:rules` для цього файлу: **7 → 0**
  (до: `no-any` ×2, `http-via-core`, `env-via-config`, `json-via-parse`,
  `log-via-logger` ×2). `TOTAL` по проєкту: **8 → 1**.
- `npm test` до / після: **18 passed / 18 passed**, 6 файлів, кількість та сама.
- `npm run typecheck`: без помилок і до, і після.
- Що замінено:
  - `fetch(...)` → `postJson(url, body)` з `core/http.ts` (таймаут, повтори на 5xx/429);
  - `process.env.SHEETS_WEBHOOK_URL` / `SHEETS_TOKEN` → два виклики `readEnv()`;
  - `JSON.parse(await res.text())` → `parseJson(response.value, isSheetsResponse)`
    з guard на `{ status: string }`, складеним з `isRecord` + `isString`;
  - `console.log` ×2 → `log.info` / `log.error`;
  - `lead: any`, `data: any` → `Lead` і `SheetsResponse`; сам об'єкт тепер
    типізований як `Integration`.
- Що змінилось у поведінці (має бути: нічого з того, що фіксують тести):
  URL лишився `SHEETS_WEBHOOK_URL + "?token=" + SHEETS_TOKEN`, тіло запиту те саме
  (`values: [[createdAt, name, email, phone ?? "", source]]`), текст помилки той
  самий (`"sheets error: " + status`), експорт лишився **default**. Тести не
  редаговані: `git diff` по `*.test.ts` порожній.
  Поза тим, що фіксують тести, стало **краще**: мережевий збій раніше кидав
  виняток назовні (порушення «send завжди повертає `Result`»), тепер повертається
  `Result{ok:false}`; рядок журналу приведено до формату сусіднього
  `slack-notify.ts`, і токен у URL більше не потрапляє в журнал — `log.redact()`
  маскує `?token=`.

### `/generate-integration telegram-notify`

- Виклик: `/generate-integration telegram-notify` (месенджер — типовий сервіс агенції)
- Які файли створено:
  - `app/src/integrations/telegram-notify.ts` — `Integration` з
    `name: "telegram-notify"`, `requiredEnv: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]`;
  - `app/src/integrations/telegram-notify.test.ts` — 4 тести;
  - один рядок у `app/src/integrations/index.ts` (імпорт + елемент масиву).
- **Мінімізація даних:** Telegram — месенджер, не система обліку, тому в тіло
  запиту йдуть лише `name`, `source`, `budgetUsd`. `email` і `phone` не
  передаються — це окремо зафіксовано тестом
  («форматує повідомлення без email і телефону»).
- `npm test`: **22 passed (7 файлів)** — 18 старих + 4 нових, усі зелені.
- `npm run check:rules`: `TOTAL: 1` — **нових порушень немає** (лишилось те саме
  `state.ts:14`, яке команда `analyze-error` свідомо не чіпала).
- `npm run typecheck`: без помилок. `package.json` не змінено, `npm install` не запускався.

---

## Task E (бонус) — хук

- Файли: `.claude/settings.json` (`PreToolUse`, matcher `Edit|Write|NotebookEdit`)
  і `.claude/hooks/protect-core.mjs` (Node, щоб працювало на Windows).
- Як працює: читає JSON зі stdin, бере шлях із `tool_input.file_path` (із запасними
  `filePath` / `path` / `notebook_path`), нормалізує його відносно `cwd`, і якщо він
  у захищеній зоні — пише причину в **stderr** і виходить з кодом **2**.
- Захищені зони в хуку: `app/src/core`, `app/scripts`, `materials`, `.github`,
  `.coderabbit.yaml` — ті самі, що в `.claude/rules/do-not-touch.md`.
- Спроба змінити `app/src/core/log.ts` → відповідь хука (цитата, exit code 2):

  ```
  Заблоковано: app/src/core/log.ts — захищена зона проєкту (app/src/core).
  Правило .claude/rules/do-not-touch.md: ці файли не редагуються, винятків немає.
  Зупинись і опиши людині, яка саме зміна тут потрібна і навіщо, замість того щоб її робити.
  ```

- Перевірені гілки: відносний шлях у захищеній зоні → `exit 2`; абсолютний шлях
  (`.../app/scripts/check-rules.mjs`) → `exit 2`; `materials/ab-task.md` → `exit 2`;
  дозволений шлях (`app/src/integrations/sheets-append.ts`) → `exit 0`;
  порожній stdin → `exit 0` (хук нічого не ламає, якщо форма вводу незнайома).

---

## Що лишилось підтвердити в новій сесії

Claude Code реєструє `.claude/rules/`, `.claude/commands/` і `.claude/settings.json`
на **старті** сесії, тож у новій сесії треба:

1. `/context` → **Memory files**: переконатись, що видно `AGENTS.md`, підтягнутий
   через `@`-імпорт, — і вписати результат у Task B вище.
2. Не відкриваючи файлів, спитати агента, які правила проєкту вже в його контексті:
   має назвати `do-not-touch` (воно без `paths`, тому always-on).
3. `/analyze-error materials/error-log.txt` — перевірити, чи підставився
   `$ARGUMENTS`, і вписати відповідь у три рядки «Чи підставився» вище.
4. «Додай коментар на початок `app/src/core/log.ts`» — переконатись, що хук
   блокує дію живцем, а не лише в ручному тесті через stdin.
