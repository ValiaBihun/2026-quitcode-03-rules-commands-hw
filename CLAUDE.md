# CLAUDE.md

@AGENTS.md

Нижче — лише те, що стосується Claude Code.

## Правила проєкту

- [`.claude/rules/do-not-touch.md`](.claude/rules/do-not-touch.md) — без `paths`, тому
  завантажується в кожній сесії.
- [`.claude/rules/architecture.md`](.claude/rules/architecture.md) і
  [`.claude/rules/conventions.md`](.claude/rules/conventions.md) — з `paths: app/src/**/*.ts`,
  підтягуються під час роботи з кодом застосунку.

## Команди

- `/analyze-error <лог або стек>` — корінна причина інциденту; код не змінює.
- `/refactor <файл>` — привести файл до конвенцій без зміни поведінки.
- `/generate-integration <сервіс>` — нова інтеграція за архітектурою.

## Хук

`.claude/settings.json` → `PreToolUse` на `Edit|Write` запускає
`.claude/hooks/protect-core.mjs`: запис у `app/src/core/**` блокується на рівні
інструмента, а не прохання.
