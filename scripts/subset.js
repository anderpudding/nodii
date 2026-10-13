import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.length !== 1 && !(args.length === 2 && args[0] === '--source-dir')) {
  console.error(
    '사용법: FONT_SUBSET_PYTHON=<fonttools가 있는 Python> node scripts/subset.js --check | --source-dir <원본 OTF 폴더>',
  );
  process.exit(1);
}
if (args.length === 1 && args[0] !== '--check') process.exit(1);

function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path) : /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}
const paths = [
  'apps/mobile/app',
  'apps/mobile/src',
  'apps/mobile/lib',
  'packages/core/src',
  'packages/api/src',
  'packages/i18n/src',
].flatMap((path) => sources(join(root, path)));
const characters = new Set();
function include(text) {
  for (const character of text) {
    // 줄바꿈/탭은 글리프가 아니며 시스템 레이아웃이 처리한다.
    if (!/[\p{Cc}\p{Cf}]/u.test(character)) characters.add(character.codePointAt(0));
  }
}
for (const path of paths) {
  const text = readFileSync(path, 'utf8');
  // 주석·테스트 문자도 포함하는 보수적 상위집합 + TS의 escape 해석 결과.
  include(text);
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (
      ts.isStringLiteralLike(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    )
      include(node.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
}
for (const weekday of ['narrow', 'short', 'long'])
  for (let day = 1; day <= 7; day++)
    include(
      new Intl.DateTimeFormat('ko-KR', { weekday, timeZone: 'UTC' }).format(
        new Date(Date.UTC(2026, 0, day)),
      ),
    );
for (let month = 0; month < 12; month++)
  for (const dateStyle of ['full', 'long', 'medium', 'short'])
    include(
      new Intl.DateTimeFormat('ko-KR', { dateStyle, timeZone: 'UTC' }).format(
        new Date(Date.UTC(2026, month, 28)),
      ),
    );
for (const number of [0, 1, -1, 1234567890, 0.5, Infinity, NaN])
  include(new Intl.NumberFormat('ko-KR').format(number));

const result = spawnSync(
  process.env.FONT_SUBSET_PYTHON || 'python3',
  [join(root, 'scripts/font-subset/subset.py'), ...args],
  {
    input: JSON.stringify({
      root,
      sourceFiles: paths.length,
      uiCodepoints: [...characters].sort((a, b) => a - b),
    }),
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  },
);
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
