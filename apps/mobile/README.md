# Nodii iOS M0

Expo SDK 57 기반의 배포 스파이크입니다. 기능 화면은 없고 공유 패키지, Supabase 연결, SecureStore를 확인합니다.

## 로컬 실행

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
pnpm install
pnpm --filter @nodii/mobile start
```

Expo CLI에서 `i`를 눌러 iOS Simulator를 열거나 Expo Go의 QR 코드를 읽습니다. 네트워크와 보안 저장소가 모두 성공인지 확인한 뒤 앱을 완전히 종료하고 다시 열어 이전 실행 기록이 남는지 확인합니다.

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
