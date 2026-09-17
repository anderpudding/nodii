#!/usr/bin/env bash
# Mac App Store용 .pkg 빌드 (설계서 §11.3)
# 0단계 배포 스파이크에서는 내 맥에서 직접 실행하고, 8단계에서 CI가 같은 스크립트를 쓴다.
#
# 필요한 환경 변수
#   APPLE_TEAM_ID              예: ABCDE12345
#   APPLE_SIGNING_IDENTITY     예: "Apple Distribution: Sungjun Lee (ABCDE12345)"
#   APPLE_INSTALLER_IDENTITY   예: "3rd Party Mac Developer Installer: Sungjun Lee (ABCDE12345)"
# 선택
#   BUNDLE_VERSION             업로드마다 올라가야 하는 빌드 번호 (기본: 현재 시각 YYYYMMDDHHMM)
#   APPLE_API_KEY_ID, APPLE_API_ISSUER
#                              둘 다 있으면 altool로 App Store Connect에 바로 업로드
#                              (키 파일은 ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8)
#
# 설치된 서명 인증서 확인: security find-identity -v
set -euo pipefail

: "${APPLE_TEAM_ID:?APPLE_TEAM_ID가 필요합니다}"
: "${APPLE_SIGNING_IDENTITY:?APPLE_SIGNING_IDENTITY가 필요합니다 (Apple Distribution 인증서 이름)}"
: "${APPLE_INSTALLER_IDENTITY:?APPLE_INSTALLER_IDENTITY가 필요합니다 (3rd Party Mac Developer Installer 인증서 이름)}"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "macOS에서만 실행할 수 있습니다." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP="$ROOT/apps/desktop"
TAURI_DIR="$DESKTOP/src-tauri"
PROFILE="$TAURI_DIR/profiles/Nodii_MAS.provisionprofile"
OUT_DIR="$ROOT/dist-appstore"
BUNDLE_VERSION="${BUNDLE_VERSION:-$(date +%Y%m%d%H%M)}"

if [[ ! -f "$PROFILE" ]]; then
  echo "프로비저닝 프로파일이 없습니다: $PROFILE" >&2
  echo "Apple Developer에서 Mac App Store Connect 프로파일을 받아 위 경로에 두세요." >&2
  exit 1
fi

if [[ ! -f "$DESKTOP/.env.local" && ! -f "$DESKTOP/.env.production.local" ]]; then
  echo "경고: Supabase 환경 변수 파일이 없어서 네트워크 확인이 '건너뜀'으로 표시됩니다." >&2
fi

for target in aarch64-apple-darwin x86_64-apple-darwin; do
  if ! rustup target list --installed | grep -qx "$target"; then
    echo "Rust 타깃 $target 을 설치합니다."
    rustup target add "$target"
  fi
done

echo "▶ 권한 파일 생성 (Team ID: $APPLE_TEAM_ID)"
sed "s/__APPLE_TEAM_ID__/$APPLE_TEAM_ID/g" \
  "$TAURI_DIR/Entitlements.template.plist" > "$TAURI_DIR/Entitlements.appstore.plist"

echo "▶ Universal 빌드 (build $BUNDLE_VERSION)"
cd "$DESKTOP"
export APPLE_SIGNING_IDENTITY
pnpm tauri build \
  --bundles app \
  --target universal-apple-darwin \
  --config src-tauri/tauri.appstore.conf.json \
  --config "{\"bundle\":{\"macOS\":{\"bundleVersion\":\"$BUNDLE_VERSION\"}}}"

APP="$TAURI_DIR/target/universal-apple-darwin/release/bundle/macos/Nodii.app"
mkdir -p "$OUT_DIR"
PKG="$OUT_DIR/Nodii-$BUNDLE_VERSION.pkg"

echo "▶ 파일 권한 정리"
# .pkg는 root 권한으로 설치되므로, 앱 안 파일이 소유자만 읽을 수 있으면(600/700)
# 일반 사용자가 서명을 검증하지 못한다 → Transporter ITMS-90255. 모두 읽기 가능하게 맞춘다.
# (권한 비트는 코드 서명 대상이 아니라서 서명 후에 바꿔도 서명은 유효하다)
chmod -R u+rwX,go+rX "$APP"
if [[ -n "$(find "$APP" ! -perm -o+r -print -quit)" ]]; then
  echo "다른 사용자가 읽을 수 없는 파일이 남아 있습니다:" >&2
  find "$APP" ! -perm -o+r >&2
  exit 1
fi

echo "▶ 서명 확인"
codesign --verify --deep --strict --verbose=2 "$APP"
codesign -d --entitlements - "$APP" | grep -q "com.apple.security.app-sandbox" \
  || { echo "App Sandbox 권한이 빠졌습니다." >&2; exit 1; }

echo "▶ .pkg 생성"
xcrun productbuild --sign "$APPLE_INSTALLER_IDENTITY" --component "$APP" /Applications "$PKG"

if [[ -n "${APPLE_API_KEY_ID:-}" && -n "${APPLE_API_ISSUER:-}" ]]; then
  echo "▶ App Store Connect 업로드"
  xcrun altool --upload-app --type macos --file "$PKG" \
    --apiKey "$APPLE_API_KEY_ID" --apiIssuer "$APPLE_API_ISSUER"
else
  echo "✔ 완료: $PKG"
  echo "  Transporter 앱으로 업로드하거나, APPLE_API_KEY_ID·APPLE_API_ISSUER를 설정하고 다시 실행하세요."
fi
