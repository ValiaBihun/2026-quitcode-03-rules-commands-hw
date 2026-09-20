#!/usr/bin/env node
// PreToolUse hook: блокує будь-який запис у захищені зони проєкту.
//
// Claude Code / Cursor подають на stdin JSON опису виклику інструмента.
// Шлях беремо з tool_input.file_path (Edit/Write), з запасними варіантами для
// інших форм вводу. Якщо шлях у захищеній зоні — причина в stderr і exit 2:
// код 2 означає «дію заблоковано», і текст зі stderr агент бачить як зворотний зв'язок.
//
// Node, а не bash — щоб працювало і на Windows.
import { relative, resolve, sep } from "node:path";

const PROTECTED = [
  "app/src/core",
  "app/scripts",
  "materials",
  ".github",
  ".coderabbit.yaml",
];

function readStdin() {
  return new Promise((done) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => done(data));
    // Якщо stdin не підключено — не блокуємо нічого.
    setTimeout(() => done(data), 2000).unref?.();
  });
}

function pickPath(payload) {
  const input = payload?.tool_input ?? payload?.toolInput ?? payload?.input ?? {};
  return (
    input.file_path ?? input.filePath ?? input.path ?? input.notebook_path ?? payload?.file_path ?? null
  );
}

// Шлях у робочій теці, у posix-формі, без ведучого "./".
function toRepoPath(target, root) {
  return relative(root, resolve(root, target)).split(sep).join("/");
}

const raw = await readStdin();
if (!raw.trim()) process.exit(0);

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0); // незнайома форма вводу — не наша справа
}

const target = pickPath(payload);
if (typeof target !== "string" || target === "") process.exit(0);

const root = payload?.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const repoPath = toRepoPath(target, root);

// Поза репо — не наша зона відповідальності.
if (repoPath.startsWith("../")) process.exit(0);

const hit = PROTECTED.find((zone) => repoPath === zone || repoPath.startsWith(zone + "/"));
if (!hit) process.exit(0);

process.stderr.write(
  `Заблоковано: ${repoPath} — захищена зона проєкту (${hit}).\n` +
    `Правило .claude/rules/do-not-touch.md: ці файли не редагуються, винятків немає.\n` +
    `Зупинись і опиши людині, яка саме зміна тут потрібна і навіщо, замість того щоб її робити.\n`,
);
process.exit(2);
