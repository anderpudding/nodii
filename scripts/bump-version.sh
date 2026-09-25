#!/usr/bin/env bash
# 앱 버전을 tauri.conf.json과 apps/desktop/package.json에 함께 적는다.
# 두 값이 다르면 release.yml이 실패하므로 버전은 이 스크립트로만 올린다.
# 커밋·태그는 직접 하도록 명령만 안내한다.
#
# 사용법: bash scripts/bump-version.sh 0.2.0
set -euo pipefail

NEW_VERSION="${1:-}"
if [[ ! "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "사용법: $0 <X.Y.Z>  (예: $0 0.2.0)" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILES=(
  "$ROOT/apps/desktop/src-tauri/tauri.conf.json"
  "$ROOT/apps/desktop/package.json"
)

for file in "${FILES[@]}"; do
  # 서식을 바꾸지 않도록 최상위 "version" 한 줄만 치환한다.
  node - "$file" "$NEW_VERSION" <<'NODE'
const fs = require('node:fs');
const [file, next] = process.argv.slice(2);
const text = fs.readFileSync(file, 'utf8');
const current = JSON.parse(text).version;
const pattern = /^(  "version": ")[^"]*(")/m;
if (!pattern.test(text)) {
  console.error(`최상위 "version"을 찾지 못했습니다: ${file}`);
  process.exit(1);
}
fs.writeFileSync(file, text.replace(pattern, `$1${next}$2`));
console.log(`${file}: ${current} → ${next}`);
NODE
done

cat <<GUIDE

다음 명령으로 커밋하고 태그를 푸시하면 release.yml이 실행됩니다:

  git add apps/desktop/src-tauri/tauri.conf.json apps/desktop/package.json
  git commit -m "chore(release): v$NEW_VERSION"
  git tag v$NEW_VERSION
  git push origin HEAD v$NEW_VERSION
GUIDE
