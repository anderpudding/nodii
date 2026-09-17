#!/usr/bin/env bash
# Nodii 개발 환경 점검 (0단계)
#   pnpm check-env             개발 환경만 점검 (pnpm 내장 `pnpm doctor`와 겹치지 않게 이 이름을 씀)
#   pnpm check-env --release   App Store 배포 스파이크 준비물까지 점검
#
# 아무것도 설치하거나 바꾸지 않습니다. 확인만 합니다.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP="$ROOT/apps/desktop"
TAURI_DIR="$DESKTOP/src-tauri"
PROFILE="$TAURI_DIR/profiles/Nodii_MAS.provisionprofile"
BUNDLE_ID="com.sungjunlee.Nodii"
RELEASE=false
[[ "${1:-}" == "--release" ]] && RELEASE=true

FAILS=0
WARNS=0
ok() { printf '  \033[32m✔\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      → %s\n' "$2"; WARNS=$((WARNS + 1)); }
fail() { printf '  \033[31m✘\033[0m %s\n' "$1"; [[ -n "${2:-}" ]] && printf '      → %s\n' "$2"; FAILS=$((FAILS + 1)); }
section() { printf '\n\033[1m%s\033[0m\n' "$1"; }
has() { command -v "$1" >/dev/null 2>&1; }
major() { sed -E 's/^[^0-9]*([0-9]+).*/\1/' <<<"$1"; }

# .env 파일에서 값 하나 읽기 (없으면 빈 문자열)
env_value() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r'
}

check_health() {
  local label="$1" url="$2" key="$3" code
  code="$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -H "apikey: $key" "${url%/}/auth/v1/health" 2>/dev/null)"
  if [[ "$code" == "200" ]]; then
    ok "$label 연결 성공 ($url)"
  else
    fail "$label 연결 실패 ($url · HTTP ${code:-없음})" "$4"
  fi
}

if [[ "$(uname)" != "Darwin" ]]; then
  echo "macOS에서 실행해 주세요."
  exit 1
fi

# ───────────────────────────────────────────────
section "1. 기본 도구"

os_version="$(sw_vers -productVersion)"
if (( $(major "$os_version") >= 12 )); then ok "macOS $os_version"; else fail "macOS $os_version (12 이상 필요)"; fi

if xcode-select -p >/dev/null 2>&1; then ok "Xcode Command Line Tools"; else fail "Xcode Command Line Tools 없음" "xcode-select --install"; fi

if has node; then
  v="$(node -v)"
  if (( $(major "$v") >= 22 )); then ok "Node $v"; else fail "Node $v (22 이상 필요)" "brew install node@22"; fi
else
  fail "Node 없음" "brew install node@22"
fi

if has pnpm; then
  v="$(pnpm -v)"
  if (( $(major "$v") >= 10 )); then ok "pnpm $v"; else fail "pnpm $v (10 이상 필요)" "corepack enable && corepack prepare pnpm@10 --activate"; fi
else
  fail "pnpm 없음" "brew install pnpm (또는 corepack enable)"
fi

if [[ -d "$ROOT/node_modules" && -d "$DESKTOP/node_modules" ]]; then ok "의존성 설치됨"; else fail "의존성 미설치" "pnpm install"; fi

# ───────────────────────────────────────────────
section "2. Rust / Tauri"

if has rustc && has cargo; then
  ok "$(rustc --version)"
else
  fail "Rust 없음" "curl https://sh.rustup.rs -sSf | sh"
fi

if has rustup; then
  installed="$(rustup target list --installed 2>/dev/null)"
  for t in aarch64-apple-darwin x86_64-apple-darwin; do
    if grep -qx "$t" <<<"$installed"; then ok "Rust 타깃 $t"; else warn "Rust 타깃 $t 없음 (Universal 빌드에 필요)" "rustup target add $t"; fi
  done
fi

# ───────────────────────────────────────────────
section "3. 로컬 Supabase"

if has docker; then
  if docker info >/dev/null 2>&1; then ok "Docker 실행 중"; else warn "Docker가 꺼져 있음" "Docker Desktop 실행"; fi
else
  fail "Docker 없음" "Docker Desktop 설치"
fi

if has supabase; then ok "Supabase CLI $(supabase --version 2>/dev/null)"; else fail "Supabase CLI 없음" "brew install supabase/tap/supabase"; fi

LOCAL_ENV="$DESKTOP/.env.local"
if [[ -f "$LOCAL_ENV" ]]; then
  url="$(env_value "$LOCAL_ENV" VITE_SUPABASE_URL)"
  key="$(env_value "$LOCAL_ENV" VITE_SUPABASE_PUBLISHABLE_KEY)"
  if [[ -z "$url" || -z "$key" ]]; then
    warn ".env.local에 URL 또는 키가 비어 있음" "pnpm db:start 출력의 'Publishable key'를 VITE_SUPABASE_PUBLISHABLE_KEY에 넣기"
  elif has docker && docker info >/dev/null 2>&1; then
    check_health "로컬 Supabase" "$url" "$key" "pnpm db:start 로 로컬 스택을 먼저 띄우기"
  else
    ok ".env.local 값 있음 (Docker가 꺼져 있어 연결 확인은 건너뜀)"
  fi
else
  warn ".env.local 없음" "cp apps/desktop/.env.example apps/desktop/.env.local"
fi

# ───────────────────────────────────────────────
section "4. 클라우드 Supabase (배포 빌드용)"

PROD_ENV="$DESKTOP/.env.production.local"
if [[ -f "$PROD_ENV" ]]; then
  url="$(env_value "$PROD_ENV" VITE_SUPABASE_URL)"
  key="$(env_value "$PROD_ENV" VITE_SUPABASE_PUBLISHABLE_KEY)"
  if [[ -n "$url" && -n "$key" ]]; then
    check_health "클라우드 Supabase" "$url" "$key" "대시보드에서 프로젝트가 일시정지(paused)되지 않았는지 확인"
  else
    fail ".env.production.local에 URL 또는 키가 비어 있음"
  fi
else
  warn ".env.production.local 없음 (배포 빌드에서 네트워크 확인이 '건너뜀'으로 표시됨)"
fi

# ───────────────────────────────────────────────
if $RELEASE; then
  section "5. App Store 배포 스파이크"

  identities="$(security find-identity -v 2>/dev/null)"
  signing="$(grep -oE '"(Apple Distribution|3rd Party Mac Developer Application): [^"]+"' <<<"$identities" | head -1 | tr -d '"')"
  installer="$(grep -oE '"(3rd Party Mac Developer Installer|Mac Installer Distribution): [^"]+"' <<<"$identities" | head -1 | tr -d '"')"

  if [[ -n "$signing" ]]; then ok "앱 서명 인증서: $signing"; else fail "Apple Distribution 인증서 없음" "developer.apple.com → Certificates → Apple Distribution 생성 후 더블클릭해 키체인에 설치"; fi
  if [[ -n "$installer" ]]; then ok "설치 패키지 인증서: $installer"; else fail "Mac Installer Distribution 인증서 없음" "developer.apple.com → Certificates → Mac Installer Distribution"; fi

  team_id=""
  if [[ -f "$PROFILE" ]]; then
    tmp="$(mktemp)"
    if security cms -D -i "$PROFILE" >"$tmp" 2>/dev/null; then
      app_id="$(/usr/libexec/PlistBuddy -c 'Print :Entitlements:com.apple.application-identifier' "$tmp" 2>/dev/null)"
      team_id="$(/usr/libexec/PlistBuddy -c 'Print :TeamIdentifier:0' "$tmp" 2>/dev/null)"
      expires="$(/usr/libexec/PlistBuddy -c 'Print :ExpirationDate' "$tmp" 2>/dev/null)"
      if [[ "$app_id" == "$team_id.$BUNDLE_ID" ]]; then
        ok "프로비저닝 프로파일 ($app_id · 만료 $expires)"
      else
        fail "프로파일의 App ID가 다름: $app_id" "번들 ID $BUNDLE_ID 용 'Mac App Store Connect' 프로파일을 받기"
      fi
    else
      fail "프로비저닝 프로파일을 읽을 수 없음"
    fi
    rm -f "$tmp"
  else
    fail "프로비저닝 프로파일 없음" "apps/desktop/src-tauri/profiles/Nodii_MAS.provisionprofile 에 두기"
  fi

  if [[ -d "/Applications/Transporter.app" ]]; then ok "Transporter 앱"; else warn "Transporter 앱 없음 (업로드용)" "Mac App Store에서 'Transporter' 설치"; fi

  if [[ -n "$signing" && -n "$installer" && -n "$team_id" ]]; then
    printf '\n  빌드 명령 (그대로 복사해서 실행):\n\n'
    printf '    APPLE_TEAM_ID=%s \\\n' "$team_id"
    printf '    APPLE_SIGNING_IDENTITY="%s" \\\n' "$signing"
    printf '    APPLE_INSTALLER_IDENTITY="%s" \\\n' "$installer"
    printf '    pnpm build:appstore\n'
  fi
fi

# ───────────────────────────────────────────────
printf '\n'
if (( FAILS > 0 )); then
  printf '\033[31m필수 항목 %d개 실패\033[0m, 경고 %d개\n' "$FAILS" "$WARNS"
  exit 1
fi
printf '\033[32m필수 항목 모두 통과\033[0m, 경고 %d개\n' "$WARNS"
$RELEASE || printf '배포 준비물까지 확인하려면: pnpm check-env --release\n'
