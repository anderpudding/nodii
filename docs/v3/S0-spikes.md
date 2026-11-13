# S0 — 실기기 스파이크

> 기준: `docs/16-v3-social-plan.md` §6·§8(S0), SOC-04·05·54. 브랜치: `spike/s0-<이름>`(네 개를 따로). **스파이크 코드는 `main`에 머지하지 않습니다.** 결과는 이 파일 맨 아래 "결과"에 적고, 그 기록만 PR로 올립니다.

## 목적

v3에서 처음 쓰는 플랫폼 기능 네 가지가 **실제 기기와 실제 배포 형태에서** 되는지 먼저 확인합니다. 안 되는 것이 있으면 대안을 정해 S2 이후 지시서에 반영합니다. 기능을 완성하는 단계가 아닙니다. 화면은 버튼 하나로 충분합니다.

## 공통

- **스파이크 전용 Supabase 프로젝트**(`nodii-spike`, 무료 플랜)를 씁니다. 실기기(TestFlight)는 내 맥의 로컬 Supabase에 닿지 않고, 운영 프로젝트는 건드리지 않기 위해서입니다. 사람이 만들어 URL·publishable 키를 각 앱의 `.env.local`에 넣어 둡니다. 스파이크용 테이블·버킷·Edge Function은 이 프로젝트에만 만들고 마이그레이션으로 커밋하지 않습니다.
- **진행 순서: 4 → 2 → 3 → 1.** 애플 설정이 적게 드는 것부터 합니다.
- **사람이 해야 할 단계에 닿으면 멈추고**, 무엇을 어떤 순서로 해야 하는지 체크리스트로 알려 준 뒤 기다립니다(빌드 업로드, 기기 설치, 애플 개발자 사이트 설정, 사이트 배포).
- **예외: 사이트 파일은 `main`으로 PR합니다.** 유니버설 링크는 실제 `nodii.app`에 파일이 있어야 확인할 수 있습니다. `site/.well-known/apple-app-site-association`과 `/u/` 안내 페이지만 별도 브랜치 `spike/s0-site`에서 `main`으로 PR합니다. 앱 쪽 스파이크 코드는 머지하지 않습니다.
- 스파이크 빌드는 운영 앱과 번들 ID가 같아서, 설치하면 기기의 운영 앱을 덮어씁니다. 끝나면 사람이 운영 빌드를 다시 설치합니다.

- 실기기: macOS 앱은 **Mac App Store 서명 빌드(샌드박스)** 또는 TestFlight(macOS), iOS는 **TestFlight**. 개발 빌드에서만 되는 것은 "됨"으로 치지 않습니다.
- 새 의존성·Tauri 플러그인·capability·Entitlement를 추가할 수 있습니다(스파이크 브랜치 한정). 추가한 것과 이유를 결과에 적습니다. `main`에 들어갈 때는 S2·S6 지시서에서 다시 정합니다.
- 비밀 값(APNs 키, Expo 액세스 토큰, Resend 키)은 커밋하지 않습니다. EAS·Supabase secret으로만 둡니다.
- 사람 손이 필요한 일(Apple Developer 설정, 도메인 파일 배포, 기기 설치)은 "사람이 할 일"로 나눠 적고, 에이전트는 그 앞뒤 준비를 끝내 둡니다.

## 1. 유니버설 링크로 앱 열기 (SOC-05)

`https://nodii.app/u/<token>` 링크를 누르면 앱이 설치된 기기에서는 앱이 열리고 토큰을 받는지 확인합니다.

- **도메인 파일**: `site/.well-known/apple-app-site-association`(확장자 없음, JSON). `applinks.details`에 두 앱(`<TeamID>.com.sungjunlee.Nodii`, iOS와 macOS 번들 ID가 같음) + 경로 `/u/*`. GitHub Pages에서 `.well-known`이 그대로 서비스되는지(`.nojekyll` 필요 여부), `Content-Type`이 JSON인지 `curl -I`로 확인합니다.
- **iOS**: `app.json`의 `ios.associatedDomains: ["applinks:nodii.app"]`. `expo-linking`으로 받은 URL에서 토큰을 꺼내 화면에 표시.
- **macOS**: Entitlement `com.apple.developer.associated-domains` + Tauri 딥링크(`tauri-plugin-deep-link` 검토). 앱이 꺼져 있을 때와 켜져 있을 때 둘 다.
- **앱이 없을 때**: 같은 주소가 웹 페이지로 열려야 합니다. `site/u/index.html` 같은 안내 페이지(App Store 버튼 두 개)가 `/u/<token>`에서도 보이는지 확인합니다(정적 호스팅의 경로 처리 — 404 페이지 재활용 등).
- **완료 기준**: iPhone(메모·메시지에서 링크 탭)과 Mac(Safari·메시지에서 링크 클릭)에서 앱이 열리고 토큰이 보인다. 앱을 지운 iPhone에서는 안내 페이지가 열린다.
- **안 될 때 대안**: macOS는 사용자 지정 스킴(`nodii://u/<token>`)으로 안내 페이지의 [앱에서 열기] 버튼을 둡니다. 결과에 어느 쪽으로 갈지 적습니다.

## 2. macOS: Realtime → 로컬 알림 (SOC-54)

앱이 켜져 있는 동안(창을 닫고 Dock에 남은 상태 포함) Supabase Realtime으로 행을 받으면 macOS 알림 센터에 알림을 띄울 수 있는지 확인합니다.

- 임시 테이블(`spike_events`, 본인 행만 RLS) INSERT를 Realtime으로 구독해서 `tauri-plugin-notification`으로 알림을 띄웁니다. 테이블은 스파이크 프로젝트에만 만들고 마이그레이션으로 커밋하지 않습니다. 다른 계정으로 행을 넣는 스크립트(`scripts/spike/insert-event.mjs` 같은 것, 커밋하지 않음)도 함께 준비합니다.
- 확인할 것: 첫 실행의 알림 권한 요청, 샌드박스에서의 동작, 창을 닫은 상태·다른 앱이 앞에 있는 상태, 앱 아이콘 배지를 켜고 끌 수 있는지(v3는 배지를 쓰지 않음, SOC-50 — 쓰지 않을 수 있는지만 확인), 알림을 눌렀을 때 앱이 앞으로 오는지.
- 완전히 종료된 앱에서는 알림이 오지 않는 것이 정상입니다(계획 §6). 그 사실만 결과에 적습니다.
- **완료 기준**: 서명 빌드에서 창을 닫은 상태로 다른 계정이 INSERT하면 2초 안에 알림이 뜬다.

## 3. iOS: Expo push가 TestFlight 기기에 도착 (SOC-54, S6 위험 확인)

- `expo-notifications`로 권한 요청 → Expo push token 얻기 → 화면에 표시(복사 가능하게).
- EAS 자격 증명에 APNs 키 연결(사람이 할 일). TestFlight 빌드 설치.
- 서버 쪽은 Supabase Edge Function 하나(`spike-push`)에서 Expo Push API(`https://exp.host/--/api/v2/push/send`)를 호출합니다. 스파이크 프로젝트에 배포하거나 로컬(`supabase functions serve`)에서 실행해도 됩니다. 토큰과 메시지를 받아 보내는 명령 한 줄을 사람에게 알려 줍니다.
- 확인할 것: 앱을 완전히 종료한 상태에서 도착, 알림을 눌렀을 때 앱이 열리고 payload를 읽는지, 잘못된 토큰의 오류 응답 모양(나중에 토큰 정리에 씀).
- **완료 기준**: 앱을 종료한 TestFlight iPhone에 10초 안에 도착하고, 누르면 payload가 화면에 보인다.
- **안 될 때**: S6을 v3.1로 넘기는 계획(§8 마지막 줄)을 쓸지 결과에 적습니다.

## 4. Storage 사진 업로드와 EXIF 제거 (SOC-04)

- 스파이크 프로젝트에 `avatars` 버킷(공개 읽기)을 만들고, 정책은 S1 마이그레이션 `avatars_storage`와 같게 둡니다(본인 폴더 `{user_id}/`만 쓰기).
- **iOS**: 사진 보관함에서 위치 정보가 있는 사진(HEIC 포함)을 고르고 `expo-image-manipulator`로 정사각형 자르기 → 160·480px JPEG(품질 0.8)로 저장 → 업로드.
- **macOS**: 파일 선택 → `<canvas>`에서 자르고 `toBlob('image/jpeg', 0.8)` → 업로드. HEIC를 WebView가 읽는지 확인합니다(못 읽으면 대안 기록).
- 올라간 파일을 내려받아 `exiftool`로 **GPS·촬영 기기 정보가 없는지** 확인합니다. 내려받기와 검사를 한 번에 하는 스크립트를 준비합니다.
- 다른 계정 폴더에 쓰기·지우기가 거부되는지 확인합니다.
- 움직이는 이미지(GIF)·10MB 넘는 원본을 고르면 업로드 전에 막히는지.
- **완료 기준**: 두 앱 모두 160·480 파일이 올라가고, EXIF 위치가 없고, 남의 폴더 쓰기가 거부된다.

## 하지 말 것

- 실제 화면 디자인, i18n 문구, 소셜 테이블 마이그레이션(S1), 원격 Supabase 프로젝트 변경.
- `main` 브랜치에 스파이크 코드 머지.

## 최종 보고

AGENTS.md §8 형식에 더해 네 항목마다: 됨/안 됨, 확인한 기기·OS·빌드 종류, 추가한 의존성·Entitlement, 사람이 한 일, 안 되면 대안. 아래 "결과"에도 같은 내용을 짧게 적습니다.

## 결과

| # | 항목 | 결과 | 기기 / 빌드 | 메모·대안 |
| --- | --- | --- | --- | --- |
| 1 | 유니버설 링크 (SOC-05) | 됨 | iPhone 14 Plus · iOS 27.0.1 · TestFlight `0.2.1 (17)`<br>MacBook Pro 16 · macOS 27.0.1 · 서명 빌드 `0.2.1 (202611130436)` | 두 앱에서 종료·실행 중 모두 초대 토큰이 표시됐고, 앱을 지운 iPhone에서는 스토어 안내가 열렸다. [사이트 PR #54](https://github.com/anderpudding/nodii/pull/54) 머지 후 GitHub Pages 원본은 `200 application/octet-stream`, Apple CDN은 `200 application/json`을 반환했다. |
| 2 | macOS 로컬 알림 (SOC-54) | 됨 | MacBook Pro 16 · macOS 27.0.1 · 서명 빌드 `0.2.1 (202611130107)` | 다른 계정의 INSERT 후 창을 닫고 다른 앱을 앞에 둔 상태에서 2초 이내 도착했다. 알림을 누르면 Nodii가 앞으로 왔고, Dock 배지를 켜고 끌 수 있었다. ⌘Q 종료 뒤에는 알림이 오지 않았다. 최초 시스템 권한 프롬프트는 미확인이다. |
| 3 | iOS 푸시 (SOC-54) | 됨 | iPhone 14 Plus · iOS 27.0.1 · TestFlight `0.2.1 (16)` | 앱을 완전히 종료한 상태에서 10초 이내 도착했다. 알림을 누르면 Nodii가 열리고 `message`와 `sentAt`이 표시됐다. 잘못된 토큰은 HTTP 200의 티켓에서 `data.status = "error"`, `data.details.error = "DeviceNotRegistered"`를 반환했다. |
| 4 | 사진 업로드·EXIF (SOC-04) | 됨 (S0 기준) | iPhone 14 Plus · iOS 27.0.1 · TestFlight `0.2.1 (15)`<br>MacBook Pro 16 · macOS 27.0.1 · 서명 빌드 `0.2.1 (202611130001)` | 두 앱에서 JPEG·HEIC 업로드가 성공했고 GIF·10MB 초과 원본은 거부했다. JPEG 8개에서 160·480px 정사각형과 GPS·촬영 기기 정보 제거를 확인했다. 실제 Storage API에서 타인 폴더 쓰기·삭제를 거부했다. 인코더가 만든 EXIF는 S2에서 제거할 예정이다. |

사용자가 사이트 PR을 머지하고, 서명 빌드와 TestFlight 빌드를 만들어 설치한 뒤 링크·알림·사진 업로드를 실기기에서 확인했다. macOS 유니버설 링크 빌드 번호는 로컬 서명 번들의 Info.plist와 패키지로, iOS 빌드 번호는 EAS의 스파이크 커밋 기록으로 대조했다.

### 스파이크 브랜치의 의존성과 권한

- `spike/s0-universal-links`는 macOS의 시작 URL과 실행 중 URL을 받기 위해 Tauri 딥링크 플러그인 2.4.7(JS·Rust)과 `deep-link:allow-get-current`를 추가했다. 두 플랫폼에 Associated Domains 권한으로 `applinks:nodii.app`을 설정했다. iOS는 기존 `expo-linking`을 사용했다.
- `spike/s0-macos-notifications`는 macOS 알림을 띄우기 위해 Tauri 알림 플러그인 2.4.0(JS·Rust)과 알림 조회·요청·발송 capability를 추가했다. 배지 확인에는 `core:window:allow-set-badge-label`을 썼다.
- `spike/s0-ios-push`는 권한 요청·푸시 토큰 발급·알림 응답을 위해 `expo-notifications`를, 토큰 복사를 위해 `expo-clipboard`를 추가했다. TestFlight용 `aps-environment`는 `production`으로 설정했다.
- `spike/s0-photos`는 iOS 사진 선택·변환·파일 읽기에 각각 `expo-image-picker`, `expo-image-manipulator`, `expo-file-system`을 추가했다. macOS 샌드박스에서 사용자가 고른 파일을 읽기 위해 `com.apple.security.files.user-selected.read-only`를 추가했다.

### S2·S6에 반영할 사항

- **S2 (SOC-04)**. 재인코딩 결과에 크기·색 공간·방향 등 인코더가 추가한 EXIF가 남았다. 업로드 직전에 JPEG의 EXIF 블록을 제거하고 두 크기의 결과에서 EXIF 전체가 없는지 검사하는 방안을 제안한다.
- **S2 (SOC-05)**. 현재 Pages 배포가 `.well-known`을 포함했고 Apple CDN에서 JSON으로 확인됐다. 현재 유니버설 링크 경로를 사용하고, 배포 뒤 원본과 CDN 응답을 확인한다. 브라우저로 들어온 `/u/<token>`은 Pages의 사용자 지정 404에서 `/u/` 안내로 이동한다.
- **S6 (SOC-50·54)**. iOS는 Expo 발송 티켓과 영수증의 `DeviceNotRegistered`를 토큰 정리에 쓴다. macOS는 서명 빌드에서 최초 권한 프롬프트와 시스템 알림이 꺼진 상태를 다시 확인한다. v3의 Dock 배지는 SOC-50을 따른다.

### 검증

- 스파이크 브랜치와 사이트에서 `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`가 통과했다. macOS 알림·링크의 `cargo check`, iOS Entitlement 확인, 푸시 함수의 `deno check`도 통과했다.
- 별도 로컬 Supabase에서 `pnpm db:reset`, `pnpm db:test`(342개), `pnpm db:types`를 실행했다. 생성 타입은 저장소와 일치했다. `nodii-spike`에서 Storage 정책 8개와 알림 RLS·Realtime 설정 6개도 통과했다.
