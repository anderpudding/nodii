# Nodii iOS M1

Expo SDK 57 기반의 iOS 앱입니다. 이메일 코드·심사 계정 로그인, Keychain 세션 복원, 최소 iOS 버전 안내와 오늘 화면 자리를 제공합니다.

## 로컬 실행

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
pnpm install
pnpm --filter @nodii/mobile start
```

Expo CLI에서 `i`를 눌러 iOS Simulator를 열거나 Expo Go의 QR 코드를 읽습니다. 새 이메일로 코드를 받은 뒤 로그인하고, 앱 완전 종료·재실행 시 오늘 화면이 유지되는지 확인합니다. 로그아웃하면 로그인 화면으로 돌아와야 합니다.

`EXPO_PUBLIC_REVIEW_ACCOUNT_EMAIL`은 심사 계정 주소, `EXPO_PUBLIC_APP_STORE_ID`는 iOS App Store 숫자 ID입니다. 예시 값은 비워 두며 preview/production EAS 환경에도 등록합니다. 심사 비밀번호는 환경 변수나 저장소에 넣지 않습니다. 로컬 시뮬레이터는 `http://127.0.0.1:54321`, 실기기는 접근 가능한 Supabase URL을 사용합니다.

키보드·safe area·Keychain·토큰 만료 후 복귀·자동완성은 실기기에서도 확인해야 합니다. 모바일 화면 자동 테스트는 Vitest에서 RN Web과 Testing Library로 실행하며 네이티브 동작을 대신 검증하지 않습니다.

localhost가 IPv6로만 바인딩되어 시뮬레이터 접속이 실패하면 다음처럼 IPv4를 우선합니다.

```bash
NODE_OPTIONS=--dns-result-order=ipv4first pnpm --filter @nodii/mobile exec expo start --go --ios --localhost
```

## EAS 환경 변수

`.env.local`은 EAS Build에 업로드되지 않습니다. preview와 production 환경에 다음 공개 값을 등록합니다.

```bash
pnpm dlx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL
pnpm dlx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
pnpm dlx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL
pnpm dlx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Supabase `service_role` 키는 등록하지 않습니다.

## iOS 빌드와 제출

```bash
cd apps/mobile
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest build --platform ios --profile preview
pnpm dlx eas-cli@latest build --platform ios --profile production
pnpm dlx eas-cli@latest submit --platform ios --profile production
```

첫 빌드에서 Apple ID, 2FA, Team을 고르고 인증서와 프로비저닝은 EAS 자동 관리를 승인합니다. 번들 ID는 macOS 앱과 같은 `com.sungjunlee.Nodii`입니다. 식별자 오류가 나면 새 ID를 만들지 말고 오류를 기록합니다.
