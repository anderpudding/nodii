#!/usr/bin/env bash
# SET-05: 표시 버전을 선택한 플랫폼의 설정/패키지에 함께 적는다.
# 기존 인자 하나는 macOS 전용으로 유지하고 정책 선택은 --platform으로 명시한다.
# iOS 빌드 번호는 eas.json의 remote + autoIncrement가 관리한다.
# 커밋·태그·EAS 빌드는 실행하지 않고 명령만 안내한다.
# 사용법: bash scripts/bump-version.sh 0.2.0 [--platform desktop|ios|all]
set -euo pipefail

NEW_VERSION="${1:-}"
PLATFORM="desktop"
if [[ $# -gt 1 ]]; then
  if [[ $# -ne 3 || "${2:-}" != "--platform" ]]; then
    echo "사용법: $0 <X.Y.Z> [--platform desktop|ios|all]" >&2
    exit 1
  fi
  PLATFORM="$3"
fi
if [[ ! "$NEW_VERSION" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] ||
   [[ "$PLATFORM" != "desktop" && "$PLATFORM" != "ios" && "$PLATFORM" != "all" ]]; then
  echo "사용법: $0 <X.Y.Z> [--platform desktop|ios|all]" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node - "$ROOT" "$NEW_VERSION" "$PLATFORM" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [root, next, platform] = process.argv.slice(2);
const targets = [];
if (platform !== 'ios') targets.push(
  ['apps/desktop/src-tauri/tauri.conf.json', 'desktop'],
  ['apps/desktop/package.json', 'desktop'],
);
if (platform !== 'desktop') targets.push(
  ['apps/mobile/app.json', 'expo'],
  ['apps/mobile/package.json', 'mobile'],
);
// 잘못된 설정 파일이 하나라도 있으면 다른 파일을 먼저 바꾸지 않는다.
const changes = targets.map(([relative, kind]) => {
  const file = path.join(root, relative);
  const text = fs.readFileSync(file, 'utf8');
  const document = JSON.parse(text);
  const current = kind === 'expo' ? document.expo?.version : document.version;
  const pattern = kind === 'expo' ? /^(    "version": ")[^"]*(")/m : /^(  "version": ")[^"]*(")/m;
  if (typeof current !== 'string' || !pattern.test(text))
    throw new Error(`version을 찾지 못했습니다: ${relative}`);
  return { file, relative, current, text: text.replace(pattern, `$1${next}$2`) };
});
for (const change of changes) {
  fs.writeFileSync(change.file, change.text);
  console.log(`${change.relative}: ${change.current} → ${next}`);
}
NODE

if [[ "$PLATFORM" == "desktop" || "$PLATFORM" == "all" ]]; then
  cat <<GUIDE

macOS: 변경을 검증·커밋한 뒤 다음 태그를 푸시하면 release.yml이 실행됩니다:
  git tag v$NEW_VERSION
  git push origin HEAD v$NEW_VERSION
GUIDE
fi
if [[ "$PLATFORM" == "ios" || "$PLATFORM" == "all" ]]; then
  cat <<GUIDE

iOS: apps/mobile/app.json과 package.json을 검증·커밋한 뒤 수동 빌드합니다:
  cd apps/mobile
  eas build --platform ios --profile production
  eas submit --platform ios --profile production --id <확인한_BUILD_ID>

표시 버전: $NEW_VERSION. ios.buildNumber는 EAS 원격 값 + autoIncrement가 기준입니다.
  eas build:version:get --platform ios
기존 원격 번호를 확인하고 build:version:set은 최초 연결/복구 때만 사용하세요.
iOS 전용 변경은 v* 태그를 푸시하지 않습니다(macOS 배포가 실행되기 때문입니다).
GUIDE
fi
cat <<GUIDE

버전 정책(같은 번호 / 플랫폼별 번호)은 docs/13-ios-release-runbook.md §3에서 결정합니다.
이 스크립트는 커밋·태그·원격 빌드를 실행하지 않습니다.
GUIDE
