// Стан синхронізації між запусками: ліди, створені після lastSyncedAt, ще не розіслані.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";

export interface SyncState {
  /** ISO-8601, UTC. */
  lastSyncedAt: string;
}

const INITIAL_STATE: SyncState = { lastSyncedAt: "1970-01-01T00:00:00.000Z" };

// Курсор має бути справжньою міткою часу ISO-8601 UTC, і перевіряти це треба на
// трьох рівнях — кожен пропускає значення, які ламають синхронізацію:
//
//   isString   — пропускає "", а далі `lead.createdAt > ""` істинне для будь-якого
//                ліда, тобто розсилка всіх лідів заново;
//   ISO_UTC    — пропускає календарно неможливе: "0000-00-00T00:00:00Z"
//                лексикографічно менше за будь-яку реальну дату, той самий ефект;
//   Date.parse — пропускає "2026-02-30T00:00:00Z", мовчки «перевертаючи» його на
//                2 березня, тобто курсор поїде на два дні вперед.
//
// Тому після форми звіряємо компоненти з тим, що реально розібрав Date — і окремо
// перевіряємо, що значення взагалі може бути курсором цього проєкту:
//
//   до епохи   — "0000-01-01T00:00:00Z" калeндарно існує і компоненти сходяться,
//                але лексикографічно менше за будь-яку реальну дату, тобто знову
//                розсилка всіх лідів. Нижня межа — сам INITIAL_STATE (epoch 0):
//                раніше за нього курсора не буває, а сам INITIAL_STATE читається
//                назад (його пише runSync при першому запуску).
//   з майбутнього — "9999-12-31T23:59:59Z" дає протилежний, гірший збій: pending
//                завжди порожній, воркер тихо не доставляє нічого. Курсор — це
//                завжди `createdAt` того, що вже сталося, тож майбутнє неможливе.
//                Допуск на розбіжність годинників — доба.
const ISO_UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/;

/** Запас на розбіжність годинників між джерелом лідів і воркером. */
const CLOCK_SKEW_TOLERANCE_MS = 24 * 60 * 60 * 1000;

function isIsoUtcTimestamp(value: string): boolean {
  const parts = ISO_UTC.exec(value);
  if (parts === null) return false;

  const epochMs = Date.parse(value);
  if (Number.isNaN(epochMs)) return false;

  if (epochMs < 0) return false;
  if (epochMs > Date.now() + CLOCK_SKEW_TOLERANCE_MS) return false;

  const date = new Date(epochMs);
  return (
    date.getUTCFullYear() === Number(parts[1]) &&
    date.getUTCMonth() + 1 === Number(parts[2]) &&
    date.getUTCDate() === Number(parts[3]) &&
    date.getUTCHours() === Number(parts[4]) &&
    date.getUTCMinutes() === Number(parts[5]) &&
    date.getUTCSeconds() === Number(parts[6])
  );
}

const isSyncState = (value: unknown): value is SyncState =>
  isRecord(value) && isString(value.lastSyncedAt) && isIsoUtcTimestamp(value.lastSyncedAt);

// ⚠️ ВІДОМИЙ ДЕФЕКТ, НЕ ВИПРАВЛЕНИЙ ТУТ.
// Повернення INITIAL_STATE на побитому файлі стану — це корінна причина нічного
// інциденту 10.09.2026: обірваний writeFileSync лишив файл порожнім, курсор тихо
// відкотився в 1970 рік, і воркер розіслав усі ~1300 лідів заново (див.
// materials/error-log.txt і docs/verification.md).
//
// Не обманюйся строгістю guard вище: КОЖНЕ його відхилення теж веде до
// INITIAL_STATE, тобто до тієї самої розсилки всіх лідів. Guard купує лише
// ВИДИМІСТЬ — раніше такі курсори проходили мовчки, тепер кожен лишає log.error.
// Самої розсилки він не спиняє.
//
// Спиняє її та зміна, якої тут немає: конвенція вимагає віддавати помилку
// назовні як Result{ok:false}, щоб runSync зупинив прогін замість розсилки з
// нуля. Це змінює сигнатуру loadState на Result<SyncState> і поведінку runSync —
// тобто виходить за межі рефакторингу «без зміни поведінки».
export function loadState(path: string): SyncState {
  if (!existsSync(path)) return { ...INITIAL_STATE };

  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    log.error(`sync: не вдалося прочитати ${path}: ${error instanceof Error ? error.message : String(error)}`);
    return { ...INITIAL_STATE };
  }

  const parsed = parseJson(text, isSyncState, "sync-state");
  if (!parsed.ok) {
    log.error(
      `sync: ${parsed.error} (${path}); курсор скинуто на ${INITIAL_STATE.lastSyncedAt} — ` +
        `наступний прогін розішле всі ліди заново`,
    );
    return { ...INITIAL_STATE };
  }

  return parsed.value;
}

export function saveState(path: string, state: SyncState): void {
  writeFileSync(path, JSON.stringify(state, null, 2));
}
