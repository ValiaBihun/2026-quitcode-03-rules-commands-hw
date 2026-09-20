// Стан синхронізації між запусками: ліди, створені після lastSyncedAt, ще не розіслані.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";

export interface SyncState {
  /** ISO-8601, UTC. */
  lastSyncedAt: string;
}

const INITIAL_STATE: SyncState = { lastSyncedAt: "1970-01-01T00:00:00.000Z" };

// Курсор має бути саме ISO-8601 UTC — у тій формі, яку пише saveState()
// (`Date.prototype.toISOString`). Перевірки `isString` тут замало: порожній рядок
// її проходить, а далі `lead.createdAt > ""` істинне для будь-якого ліда, тобто
// структурно «справний» файл стану дає той самий шторм дублікатів, що й побитий.
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

const isSyncState = (value: unknown): value is SyncState =>
  isRecord(value) && isString(value.lastSyncedAt) && ISO_UTC.test(value.lastSyncedAt);

// ⚠️ ВІДОМИЙ ДЕФЕКТ, НЕ ВИПРАВЛЕНИЙ ТУТ.
// Повернення INITIAL_STATE на побитому файлі стану — це корінна причина нічного
// інциденту 10.09.2026: обірваний writeFileSync лишив файл порожнім, курсор тихо
// відкотився в 1970 рік, і воркер розіслав усі ~1300 лідів заново (див.
// materials/error-log.txt і docs/verification.md).
// Конвенція вимагає віддавати таку помилку назовні як Result{ok:false}, а не
// підставляти дефолт. Це змінює сигнатуру loadState на Result<SyncState> і
// поведінку runSync — тобто виходить за межі рефакторингу «без зміни поведінки».
// Тут збіг лише те, що можна зробити без зміни поведінки: розбір через
// parseJson() з guard і ГУЧНИЙ журнал замість тихого відкоту.
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
