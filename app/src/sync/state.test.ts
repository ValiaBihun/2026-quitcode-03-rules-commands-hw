// Регресія на guard курсора синхронізації.
//
// Кожен випадок нижче — це шлях, яким непридатний lastSyncedAt колись проходив
// у runSync і спричиняв повторну розсилку всіх лідів. Тести фіксують два факти:
// курсор відкидається, і про це є запис у журналі (а не тиша).
//
// ⚠️ Поточна поведінка fallback — повернення INITIAL_STATE — навмисно
// зафіксована як є: її зміна на Result<SyncState> міняє контракт runSync і
// потребує окремого рішення (див. коментар на початку state.ts).
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadState, saveState } from "./state.js";

const INITIAL = "1970-01-01T00:00:00.000Z";

let dir: string;
let journal: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lead-sync-state-"));
  journal = [];
  const collect = (...args: unknown[]) => void journal.push(args.map(String).join(" "));
  vi.spyOn(console, "log").mockImplementation(collect);
  vi.spyOn(console, "error").mockImplementation(collect);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const withState = (contents: string): string => {
  const path = join(dir, "sync-state.json");
  writeFileSync(path, contents);
  return path;
};

describe("loadState — придатні курсори", () => {
  it("читає збережений стан", () => {
    const path = withState(JSON.stringify({ lastSyncedAt: "2026-09-10T08:00:00.000Z" }));

    expect(loadState(path)).toEqual({ lastSyncedAt: "2026-09-10T08:00:00.000Z" });
    expect(journal).toHaveLength(0);
  });

  it("приймає форму без мілісекунд", () => {
    const path = withState(JSON.stringify({ lastSyncedAt: "2026-09-10T08:00:00Z" }));

    expect(loadState(path)).toEqual({ lastSyncedAt: "2026-09-10T08:00:00Z" });
    expect(journal).toHaveLength(0);
  });

  it("повертає початковий стан, якщо файлу ще немає — це не помилка", () => {
    expect(loadState(join(dir, "missing.json"))).toEqual({ lastSyncedAt: INITIAL });
    expect(journal).toHaveLength(0);
  });
});

describe("loadState — непридатні курсори відкидаються гучно", () => {
  // [опис, вміст файлу, чим саме небезпечний]
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["порожній файл після обірваного writeFileSync", ""],
    ["невалідний JSON", "{ lastSyncedAt: "],
    ["курсор не рядок", JSON.stringify({ lastSyncedAt: 1757500800000 })],
    ["порожній курсор — усі ліди стають новішими", JSON.stringify({ lastSyncedAt: "" })],
    ["календарно неможлива дата", JSON.stringify({ lastSyncedAt: "0000-00-00T00:00:00Z" })],
    ["неіснуючий день місяця — Date мовчки зсунув би на 2 березня", JSON.stringify({ lastSyncedAt: "2026-02-30T00:00:00Z" })],
    ["місяць поза діапазоном", JSON.stringify({ lastSyncedAt: "2026-13-01T00:00:00Z" })],
    ["не ISO-8601 узагалі", JSON.stringify({ lastSyncedAt: "вчора" })],
  ];

  it.each(cases)("%s", (_name, contents) => {
    const state = loadState(withState(contents));

    expect(state).toEqual({ lastSyncedAt: INITIAL });
    expect(journal.join("\n")).toContain("ERROR");
  });
});

describe("saveState", () => {
  it("записаний стан читається назад без втрат", () => {
    const path = join(dir, "roundtrip.json");
    saveState(path, { lastSyncedAt: "2026-09-10T12:34:56.789Z" });

    expect(loadState(path)).toEqual({ lastSyncedAt: "2026-09-10T12:34:56.789Z" });
    expect(journal).toHaveLength(0);
  });
});
