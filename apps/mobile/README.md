# Nodii iOS M2a

Expo SDK 57 기반의 iOS 앱입니다. 이메일 코드·심사 계정 로그인, Keychain 세션 복원, 최소 iOS 버전 안내, 주간 날짜 선택·목표별 하루 목록·체크·하단 연속 추가를 제공합니다.

## 로컬 실행

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
pnpm install
pnpm --filter @nodii/mobile start
```

Expo CLI에서 `i`를 눌러 iOS Simulator를 열거나 Expo Go의 QR 코드를 읽습니다. 새 이메일로 코드를 받은 뒤 로그인하고, 앱 완전 종료·재실행 시 오늘 화면이 유지되는지 확인합니다. 로그아웃하면 로그인 화면으로 돌아와야 합니다.

`EXPO_PUBLIC_REVIEW_ACCOUNT_EMAIL`은 심사 계정 주소, `EXPO_PUBLIC_APP_STORE_ID`는 iOS App Store 숫자 ID입니다. 예시 값은 비워 두며 preview/production EAS 환경에도 등록합니다. 심사 비밀번호는 환경 변수나 저장소에 넣지 않습니다. 로컬 시뮬레이터는 `http://127.0.0.1:54321`, 실기기는 접근 가능한 Supabase URL을 사용합니다.

키보드·safe area·Keychain·토큰 만료 후 복귀·자동완성은 실기기에서도 확인해야 합니다. 모바일 단위/기존 화면 검사는 Vitest/RN Web으로, 오늘 화면 컴포넌트 검사는 Expo Jest와 React Native Testing Library로 실행합니다. `pnpm --filter @nodii/mobile test`는 둘 다 실행하며 `test:native`는 RNTL만 실행합니다. 실제 OS 키보드 조합·스크롤 성능·safe area는 실기기에서 별도로 확인합니다. iOS의 조합 상태는 RN submit 이벤트에 노출되지 않아 한국어 하드웨어 Enter 차단은 미보장이며, 자세한 한계는 구현 계획 M2a 기록을 참고합니다.

localhost가 IPv6로만 바인딩되어 시뮬레이터 접속이 실패하면 다음처럼 IPv4를 우선합니다.

```bash
NODE_OPTIONS=--dns-result-order=ipv4first pnpm --filter @nodii/mobile exec expo start --go --ios --localhost
```

## M2a 확인

주간 스트립으로 날짜를 고른 뒤 하단 “할 일 추가”를 열어 목표를 선택합니다. 추가 후 입력칸만 비워져 같은 시트에서 계속 입력할 수 있습니다. 날짜 줄은 표시 전용이며 월간·설정 버튼은 다음 단계까지 비활성입니다.

할 일 3개 추가 → 하나 체크 → 같은 로컬 계정의 맥 앱/브라우저에서 목록과 완료 상태가 같은지 확인합니다. 입력이 남은 시트를 아래로 밀거나 취소하면 폐기 확인이 표시됩니다. 실기기에서는 30개 목록·한국어 키보드·노치/홈 인디케이터·Dynamic Type을 확인합니다.

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
