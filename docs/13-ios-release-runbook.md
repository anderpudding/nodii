# iOS 출시 런북 (사람이 하는 일)

> M6 코드 작업 이후 사람이 직접 하는 체크리스트입니다. 근거: NFR-09/16 · SET-05/07 · MOB-01, 설계서 §6.5·6.7·14.6, `stage-m6-ios-release.md`.
> Mac과 iPhone은 **같은 번들 ID `com.sungjunlee.Nodii`, 같은 App Store 앱 레코드(Apple ID `6812983213`)**를 사용합니다. 인증서·계정 비밀번호·API 개인 키를 이 문서나 저장소에 적지 않습니다.
> M6 코드 완료와 실제 출시 완료는 다릅니다. M6 소스의 EAS production 빌드 요청/업로드는 완료했고, TestFlight 제출·기기 설치·설치 크기·실기기 성능·심사 계정 확인은 아직 수행하지 않았습니다.

현재 M6 EAS 빌드: [b596dcb1-7fef-4d84-8885-b12e5b5e568b](https://expo.dev/accounts/anderpudding/projects/nodii/builds/b596dcb1-7fef-4d84-8885-b12e5b5e568b) · 표시 버전 **0.1.0**, 원격 빌드 번호 **5** · **네이티브 빌드 성공**(Vancouver 2026-10-12 17:12). IPA에서 번들 ID/최소 iOS 16.4도 확인했습니다. CLI **24.12.1**과 기존 EAS 인증서를 사용했으며 새 인증서/비밀번호 파일은 만들지 않았습니다. 이 빌드의 TestFlight 제출은 §1 명령을 사람이 실행합니다.

## 1. 빌드 환경과 EAS 프로필

저장소 루트에서 기본 검증을 먼저 실행합니다.

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test
node --test scripts/bump-version.test.js
bash -n scripts/bump-version.sh
cd apps/mobile
```

- [ ] Node는 `.nvmrc`, pnpm은 루트 `packageManager` 버전을 사용합니다.
- [ ] Expo 계정 로그인 및 프로젝트 연결을 확인합니다. 프로젝트 ID는 `app.json`의 `9a1cd883-1556-490a-87c2-1c3ca558f719`입니다. 새 프로젝트·새 앱 레코드를 만들지 않습니다.
- [ ] 로컬 EAS CLI가 `eas.json` 요구 버전 이상인지 `eas --version`으로 확인합니다. CLI가 없으면 Expo 공식 [EAS CLI 안내](https://docs.expo.dev/eas/cli/)에 따라 설치합니다(앱 런타임 의존성은 아님).
- [ ] Apple 계정·인증서·프로비저닝은 EAS Credentials 또는 Apple의 보안 저장소에서 사람이 설정합니다. `eas credentials --platform ios`로 확인합니다.

| 프로필 | 명령 | 용도 |
| --- | --- | --- |
| `development` | `eas build --platform ios --profile development` | 개발 클라이언트 + 내부 배포. Metro 연결/디버깅, 등록된 기기 필요 |
| `preview` | `eas build --platform ios --profile preview` | Metro 없이 실행하는 내부 배포. Ad Hoc 기기 등록 필요, TestFlight 제출용 아님 |
| `production` | `eas build --platform ios --profile production` | App Store/TestFlight용 서명 빌드. 원격 빌드 번호 자동 증가 |

빌드 완료 후 **방금 확인한 빌드 ID**를 지정해 제출합니다. `--latest`로 다른 빌드를 고르지 않습니다.

```bash
eas build:list --platform ios --build-profile production --limit 5
eas submit --platform ios --profile production --id <확인한_BUILD_ID>
```

- [ ] EAS Submit에서 기존 Apple ID `6812983213`을 선택합니다. 인증은 EAS/Apple에서 입력하고 파일에 적지 않습니다.
- [ ] TestFlight의 iOS 탭에서 빌드 처리 완료·표시 버전·빌드 번호를 확인합니다. macOS 빌드와 혼동하지 않습니다.
- [ ] EAS Submit은 바이너리 업로드입니다. 스크린샷/메타데이터 작성 및 심사 제출은 별도로 사람이 합니다.
- [ ] CI에 EAS 작업을 추가하지 않습니다. 기존 모바일 CI 검증(lint·format·typecheck·test)과 macOS 배포 경로를 유지합니다.

프로필과 제출의 근거: [EAS Build 프로필](https://docs.expo.dev/build/eas-json/), [EAS Submit](https://docs.expo.dev/submit/introduction/). 스플래시는 개발 클라이언트에서 다르게 보일 수 있으므로 **production TestFlight 설치본**으로 확인합니다([Expo 안내](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)).

## 2. 공개 환경 변수와 사이트

`apps/mobile/.env.example`을 개발용 `.env.local`로 복사합니다. 실제 `.env` 계열은 커밋하지 않습니다. EAS에서는 **프로필에 대응하는 environment**에 다음 이름을 등록합니다. `EXPO_PUBLIC_*`는 앱 안에 번들되므로 비밀번호·개인 키를 넣을 수 없습니다.

| 이름 | production 값 / 확인 방법 |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://hwipekipumrnpriytqbe.supabase.co` (Mac과 같은 프로젝트) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 대시보드 API Keys의 **publishable** 키. 이 문서에는 값 기록 안 함 |
| `EXPO_PUBLIC_REVIEW_ACCOUNT_EMAIL` | `appreview@nodii.app` (이메일만, 비밀번호 금지) |
| `EXPO_PUBLIC_APP_STORE_ID` | `6812983213` (기존 유니버설 구매 앱 레코드와 대조) |
| `EXPO_PUBLIC_PRIVACY_URL` | `https://nodii.app/privacy.html` |
| `EXPO_PUBLIC_TERMS_URL` | `https://nodii.app/terms.html` |
| `EXPO_PUBLIC_SUPPORT_URL` | `https://nodii.app/support.html` |

- [ ] **secret 키·service_role 키는 앱/EAS 공개 환경 변수 어디에도 넣지 않습니다.** publishable 키는 RLS 범위에서 동작합니다([Supabase API 키](https://supabase.com/docs/guides/getting-started/api-keys)).
- [ ] 실제 iPhone에서 `127.0.0.1`은 Mac이 아닙니다. 내부 개발은 Mac의 LAN 주소를 사용하고, production은 HTTPS 클라우드 주소를 사용합니다.
- [ ] `development`/`preview`/`production` environment의 URL·키·심사 이메일·Apple ID를 확인합니다. 키를 화면 캡처·로그에 남기지 않습니다.
- [ ] URL 세 개는 M6 점검에서 HTTP 200을 반환했습니다. **iOS 문구 변경분의 게시까지 확인한 것은 아닙니다.**
- [ ] `site/privacy.html`·`terms.html`의 `[[TODO: …]]`(iOS 적용 시행일/최종 수정일·EULA 검토)를 사람이 확정합니다. 기존 운영자/연락처/보관 규칙은 유지했으며 새 법적 판단은 넣지 않았습니다.
- [ ] main 병합 뒤 기존 Pages 배포로 iOS 문구와 support FAQ가 실제 도메인에 올라왔는지 확인합니다. 배포 후 세 링크를 Safari와 앱 설정에서 직접 엽니다.
- [ ] 개인정보 링크를 바꾸면 유니버설 구매의 macOS 쪽에도 영향을 주므로 Mac 설정과 App Store 정보도 함께 점검합니다.

## 3. 버전 정책 — 출시 전에 선택

유니버설 구매라고 표시 버전·빌드 번호까지 같아야 하는 것은 아닙니다. Apple은 플랫폼별 다른 버전 번호/빌드 문자열을 허용하고, 설명·스크린샷 등은 플랫폼별로 작성합니다. 앱 이름·개인정보 URL 등 공유 정보는 함께 검토합니다([Apple 메타데이터 명세, Universal Purchase](https://help.apple.com/asc/appsspec/en.lproj/static.html), [플랫폼 추가](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-platforms/), [플랫폼 버전 정보](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)).

| 선택지 | 이점 | 비용 / 운영 조건 | 도우미 |
| --- | --- | --- | --- |
| 같은 표시 번호 | 지원/변경 기록에서 하나의 제품 버전을 설명하기 쉬움 | iOS 전용 수정에도 Mac 버전을 함께 관리하거나 다음 공동 출시까지 기다려야 함. 심사/배포 시점은 플랫폼별 확인 | `bash scripts/bump-version.sh X.Y.Z --platform all` |
| 플랫폼별 표시 번호 | iOS와 Mac의 수정·심사를 각자 진행할 수 있음 | 문의/릴리스 기록에 플랫폼을 반드시 적고 두 최소 지원 버전을 따로 관리 | `--platform ios` 또는 `--platform desktop` |

- [ ] **정책 선택: [[TODO: 같은 표시 번호 / 플랫폼별 표시 번호]]**. 이 작업에서 결정하거나 실제 버전을 올리지 않았습니다.
- [ ] 출시 표시 버전: **[[TODO: X.Y.Z]]**. 저장소의 현재 앱 표시 버전은 모두 `0.1.0`입니다.
- [ ] 도우미는 선택된 앱 설정·package.json만 함께 바꿉니다. `all`은 Tauri 설정/desktop package + Expo `expo.version`/mobile package를 맞춥니다. core/api/i18n 라이브러리 버전은 앱 배포 번호로 올리지 않습니다.
- [ ] 변경 후 기본 검증·diff 확인·영어 커밋을 합니다. 스크립트는 커밋/태그/업로드를 실행하지 않습니다.
- [ ] iOS 전용 출시에서는 `v*` 태그를 푸시하지 않습니다. 기존 `release.yml`이 Mac을 빌드하기 때문입니다. 공동/macOS 출시 때만 도우미의 태그 안내와 `docs/05-release-runbook.md`를 따릅니다.

**iOS 빌드 번호**는 `eas.json`의 `appVersionSource: remote`, production `autoIncrement: true`가 기준입니다. 현재 `app.json`에 `ios.buildNumber`가 없는 것은 누락이 아닙니다. 원격 모드에서는 로컬 값이 무시되므로 새로 적거나 표시 버전 스크립트로 덮지 않습니다([Expo 버전 관리](https://docs.expo.dev/build-reference/app-versions/)).

```bash
cd apps/mobile
eas build:version:get --platform ios
# 최초 연결/복구 때만: App Store Connect와 EAS의 최근 번호를 먼저 대조
eas build:version:set --platform ios
# 로컬 Xcode 빌드 번호를 원격 번호와 맞출 때만
eas build:version:sync --platform ios
```

- [ ] 원격 빌드 번호는 최근 iOS 업로드보다 커야 합니다. M0 스파이크의 기존 원격 번호를 낮추거나 다시 1로 초기화하지 않습니다.
- [ ] 표시 버전과 원격 빌드 번호를 빌드 상세/TestFlight에서 모두 확인합니다. Mac의 UTC 빌드 번호와 동일하게 만들 필요는 없습니다.

## 4. App Store Connect 입력

- [ ] 기존 Nodii 앱 레코드에 iOS 플랫폼이 있는지 확인합니다. 필요하면 **Add Platform → iOS**로 추가하며 새 앱/번들 ID를 만들지 않습니다. M0에서 TestFlight를 통과한 기록은 있지만 이번 작업에서 계정 UI를 조회한 것은 아닙니다.
- [ ] iPhone 세로 전용·iOS **16.4 이상**(M0 결정), `supportsTablet: false`를 TestFlight 빌드에서 확인합니다.
- [ ] iOS 설명·프로모션 문구·스크린샷·심사 노트가 iOS 동작과 일치하는지 확인합니다. macOS 원고를 그대로 붙이지 않습니다.
- [ ] 지원 URL/개인정보 URL은 §2와 같습니다. 이용약관 URL은 앱 설정 링크와 EULA 정책에 맞춰 검토합니다. 마케팅 URL은 `https://nodii.app/`이며 사이트 소개도 실제 출시 상태와 맞춥니다.
- [ ] 수출 규정은 `ITSAppUsesNonExemptEncryption: false`와 실제 암호화 용도를 대조합니다.

### 4.1 iOS 스크린샷

2026-10-12 [Apple 규격](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) 확인 기준입니다. 제출 직전 최신 규격을 다시 확인합니다.

- [ ] 큰 Dynamic Island iPhone 세로: **1260×2736 / 1290×2796 / 1320×2868** 중 지원 크기로 촬영합니다(기존 6.9형에 해당).
- [ ] 위 규격을 제공하지 않으면 큰 Face ID iPhone **1284×2778 / 1242×2688** 규격이 필요합니다.
- [ ] 오늘 · 월간 펼침 · 루틴 관리 · 설정의 4장 이상을 데모 데이터로 촬영합니다. 개인정보·메일 코드·비밀번호를 노출하지 않습니다.
- [ ] 작은 기준 화면 390×844는 디자인 검증용이며 Store 스크린샷 제출 픽셀 크기가 아닙니다.
- [ ] iPad는 현재 지원 대상이 아니므로 iPad 지원을 추가하거나 스크린샷을 만들어 지원한다고 표시하지 않습니다. macOS 스크린샷은 별도로 유지합니다.

### 4.2 앱 개인정보 라벨

M6는 수집 항목/목적/보관을 바꾸지 않았습니다. 새 서버 컬럼·추적·광고 SDK는 없습니다. [Apple 개인정보 안내](https://developer.apple.com/app-store/app-privacy-details/) 기준으로 실제 제출 바이너리의 포함 SDK도 사람이 대조합니다.

| 항목 | 기존 Mac 기준 | iOS 확인 |
| --- | --- | --- |
| 이메일 주소 | 앱 기능 · 사용자와 연결 · 추적 안 함 | 같은 Supabase 인증이므로 동일한 신고가 맞는지 확인 |
| 기타 사용자 콘텐츠(목표·할 일·루틴/완료) | 앱 기능 · 사용자와 연결 · 추적 안 함 | 같은 데이터이므로 동일한 신고가 맞는지 확인 |
| 시간대·주 시작 요일·서버 기술 로그 | 기존 정책에 이미 설명 | 기존 미결정 사항(별도 데이터 유형 신고)을 함께 확정. 임의로 라벨을 생략하지 않음 |
| 기기별 테마·안내 확인 | 로컬만 보관, 서버로 보내지 않음 | 수집 대상과 로컬 저장을 구분하고 포함 SDK의 privacy manifest도 점검 |

- [ ] 유니버설 구매의 개인정보 라벨을 공유 정보로 검토하고 Mac 사용자에게도 맞는지 확인합니다. 실제 App Store Connect 값을 이번 코드 작업에서 확인하지 않았습니다.

## 5. 심사 데모 계정과 답장

- [ ] 같은 Supabase 프로젝트·기존 AUTH-08 비밀번호 경로를 쓰므로 `appreview@nodii.app`은 **코드상 재사용 가능**합니다. 새 계정을 만들 필요는 없습니다. 실제 계정 활성 상태·비밀번호·샘플 데이터는 제출 빌드에서 사람이 확인합니다.
- [ ] iOS production의 `EXPO_PUBLIC_REVIEW_ACCOUNT_EMAIL`이 정확한지 확인합니다. 일반 이메일은 OTP, 심사 이메일만 비밀번호 필드가 보여야 합니다.
- [ ] 심사 계정으로 로그인 → 예시 목표·오늘 할 일·매일/매주 루틴 확인 → 로그아웃 → 재로그인합니다. 삭제 시연에는 심사 계정을 사용하지 않습니다.
- [ ] 비밀번호는 비밀번호 관리자 및 App Store Connect **Sign-In Information**에만 둡니다.

심사 노트 초안(설계서 §6.5):

```text
Nodii uses 6-digit email codes for regular users. For review, enter
appreview@nodii.app in Email [이메일]; a Password [비밀번호] field appears.
Use the password provided in Sign-In Information, then tap Sign In [로그인].
The account has sample goals, to-dos and routines, shared with the macOS app.
The first gesture guide can be skipped [건너뛰기]. All swipe actions are
also available by long press or the row menu button.
Account deletion is in the app: Settings [설정] → Delete account [계정 삭제].
The confirmation lists the records to be removed and requires acknowledging
that deletion cannot be undone. Deletion removes the account and its data
on all devices. Please keep the review account for subsequent reviews.
No paid features, advertising or content shared between users are included.
```

Guideline 2.1 답장·iPhone 화면 녹화 순서는 `docs/10-app-review-response.md`의 **iOS판**을 사용합니다. v1 Mac 원고/이력은 보존했고 실제 iOS 답장 발송은 하지 않았습니다.

## 6. 릴리스 순서와 최소 지원 버전

1. [ ] 버전 정책/출시 버전(§3)·사이트 법적 TODO·프로덕션 환경을 확정합니다.
2. [ ] 기본 검증 통과 → EAS production 빌드 → 지정한 빌드 제출 → TestFlight 처리 완료를 확인합니다.
3. [ ] **개발에 쓰지 않은 iPhone**에서 TestFlight 설치·가입·Mac 동기화·§7 테스트·크기/성능(§8)을 확인합니다.
4. [ ] iOS 메타데이터·개인정보·스크린샷·심사 계정·노트를 확인하고 사람이 심사를 제출합니다.
5. [ ] 승인 뒤 스토어에 **실제로 출시**하고 새 버전을 다운로드할 수 있는지 확인합니다.
6. [ ] 출시/호환성 정책에 따라 필요한 때만 `min_ios_app_version`을 올립니다. **지금 값 `0.1.0`은 변경하지 않습니다.** 낮은 버전은 앱 전체 진입이 막히므로 첫 출시/스파이크 사용자를 성급하게 차단하지 않습니다.

대시보드 SQL Editor에서 먼저 조회합니다. 아래 UPDATE는 **출시 후 사람 실행용**이며 `[[TODO: …]]`를 실제 승인/출시한 버전으로 바꾸기 전에는 실행할 수 없습니다.

```sql
select key, value from public.app_config
where key in ('min_ios_app_version', 'min_macos_app_version');

-- 출시 후 필요한 때만: 기존 행 하나를 갱신 (새 마이그레이션/행 추가 아님)
update public.app_config
set value = '[[TODO: 실제 출시한 iOS X.Y.Z]]'
where key = 'min_ios_app_version';

select key, value from public.app_config where key = 'min_ios_app_version';
```

- [ ] 업데이트 안내의 App Store 버튼으로 실제 iOS Nodii 페이지가 열리는지 확인합니다. `min_macos_app_version`은 iOS 출시 때문에 함께 올리지 않습니다.
- [ ] 호환성이 깨지는 미래 서버 변경은 설계서 §6.7-4 순서 **새 앱 심사 통과 → 스토어 출시 → 해당 플랫폼 최소 버전 갱신 → 마이그레이션**을 따릅니다. 양쪽 앱이 영향을 받으면 두 플랫폼 모두 확인한 뒤 진행합니다.
- [ ] M6에는 DB/RLS/RPC/서버 변경이 없으므로 원격 migration 명령을 실행하지 않습니다(NFR-09).

## 7. 수동 E2E (production TestFlight 빌드)

- [ ] 개발에 쓰지 않은 기기에 설치. 기종·iOS 버전·앱 표시 버전·빌드 번호를 기록합니다. 시스템 라이트/다크 모두 확인합니다.
- [ ] 새 이메일 가입 → 코드 수신(스팸함 포함) → 자동 기본 목표 → 첫 안내 → [시작하기]. 재실행·로그아웃/재로그인 시 안내가 반복되지 않습니다.
- [ ] 다른 첫 실행 기기에서 [건너뛰기]. 메뉴 버튼·길게 누르기·VoiceOver로 완료/취소·이름 수정·날짜 옮기기·삭제가 모두 됩니다.
- [ ] 첫 빈 하루에서 추가 안내/하단 바 → 할 일 3개 연속 추가 → 체크/취소 → 이름 수정 → 내일/임의 날짜 이동 → 삭제/5초 실행 취소.
- [ ] 주간·월간 이동, 오늘 복귀, 월 경계·보관 목표 과거 기록·지난 7일 가져오기·하루 일괄 이동/삭제.
- [ ] 매일·요일·31일 루틴, 건너뛰기/취소, 규칙 과거까지/오늘부터, 종료/삭제. 다른 날짜 기록 보존 확인.
- [ ] 목표 추가·HEX/대비·순서·보관/해제·마지막 활성 목표 방어. 설정 주 시작·자동/라이트/다크·앱 버전·법적 링크 세 개.
- [ ] 같은 계정 Mac↔iPhone: 추가·완료·이동·삭제·루틴 로그가 양방향 반영. 폰 백그라운드 후 복귀/재구독·자정 날짜 갱신.
- [ ] 비행기 모드: 이미 읽은 기록은 표시, 모든 쓰기 비활성/이유 표시. 완전 종료/재실행 때 캐시 읽기 유지. 처음 사용해 캐시가 없으면 인터넷 연결 안내/로그아웃이 보임. 재연결 후 회복.
- [ ] 로그인 실패·코드 만료/재전송·네트워크 실패에서 재시도가 가능. 개발 빌드에서 URL 누락·손상 캐시·렌더 오류를 주입하면 준비/복구 안내가 보임. 개인정보 로그 없음.
- [ ] 별도 테스트 계정에서 설정 → 계정 삭제: 함께 삭제되는 개수·이해 체크·삭제 버튼, 로그인 화면 복귀, 로컬 계정 캐시 제거, Mac에서도 해당 계정 데이터 사용 불가. **심사 계정 삭제 금지**.
- [ ] 최소 버전 안내는 모의/로컬 app_config 또는 버전 게이트 테스트로 검증. production 값을 출시 전에 올려 테스트하지 않음. 출시 후 이전 빌드에서 업데이트 화면/스토어 이동 확인.
- [ ] VoiceOver·큰 Dynamic Type·모션 감소·작은 iPhone 화면·키보드 회피·한국어 하드웨어 Enter 조합을 확인. RNTL의 모의 제스처는 실제 밀기/스크롤 감각을 증명하지 않음.

## 8. 설치 크기·긴 목록·아이콘

2026-10-12 M6 폰트 서브셋 후속 로컬 측정(실제 파일 바이트). 아래 EAS IPA/페이로드는 **서브셋 적용 전 0.1.0(5)** 측정이며 새 폰트가 포함된 네이티브 빌드는 아직 만들지 않았습니다:

| 대상 | 크기 | 의미 |
| --- | --- | --- |
| production Hermes JS | **4,800,223 bytes (4.80MB)** | `expo export --platform ios`, M5와 비슷한 4.8MB |
| Pretendard 정적 OTF 4개 | **3,011,192 bytes (3.01MB)** | 정적 400/500/600/700 유지, 서브셋 전 6,318,784 bytes에서 52.35% 감소 |
| export 전체 | **7,836,393 bytes (7.84MB)** | JS+에셋+metadata, 네이티브 실행 파일·서명·압축·기기 thinning은 제외 |
| EAS production IPA | **20,388,201 bytes (20.39MB)** | 서브셋 전 M6 0.1.0(5)의 실제 IPA 파일 |
| IPA의 앱 페이로드(압축 해제 기준) | **42,698,061 bytes (42.70MB)** | 서브셋 전 0.1.0(5), Payload 안 파일 81개 합계. 기기 thinning/설치 크기는 미포함 |
| iPhone 설치 앱 크기 | **미측정** | [[TODO: 기종/iOS/버전/빌드, 설치 직후 앱 크기·문서 및 데이터 각각]] |

재현(환경 파일 없이 JS/에셋만 측정):

```bash
cd apps/mobile
EXPO_NO_DOTENV=1 pnpm exec expo export --platform ios --output-dir /tmp/nodii-ios-export
```

- [ ] TestFlight 설치 직후 **설정 → 일반 → iPhone 저장 공간 → Nodii**에서 앱 크기와 문서/데이터 크기를 나눠 기록합니다. EAS IPA 압축 크기·App Store thinning 다운로드 크기·설치 앱 크기를 서로 대신 쓰지 않습니다. 실제 iOS 설치 크기를 Mac 설치 파일 15MB 기준과 동일하다고 판정하지 않습니다.
- [x] 사용자 후속 지시로 tokens.md §7의 실제 정적 4벌 서브셋을 적용했습니다. 상용 한글 2,780자·원본 비한글 3,164자·앱 문자와 윤곽/폭을 검사했고 새 누락은 없습니다. 자세한 기준/바이트/재현은 tokens.md §7과 scripts/font-subset/README.md를 따릅니다.
- [ ] 새 production 빌드에서 정적 네 벌 로딩·자모/숫자/기호/요일·사용자 입력 fallback을 확인하고 IPA/설치 크기를 다시 측정합니다.
- [ ] 테스트 계정에 한 날짜 **50~100개** 할 일과 루틴을 입력하고 같은 목록을 Mac에서도 확인합니다. 개인정보 없는 제목을 씁니다.
- [ ] production 설치본에서 빠른 상하 스크롤, 체크 연속 입력, 밀기 도중 세로 스크롤, 길게 누르기, 월 이동을 측정합니다. Xcode Instruments의 Animation Hitches/Time Profiler로 끊김·메인 스레드 시간을 기록하고 기종/OS/행 수/재현 동작을 함께 남깁니다.
- [ ] SectionList 가상화는 유지했습니다. 실기기 프레임 드랍 측정은 이번 환경의 Simulator.app/실기기 실행 경로 부재로 못 했습니다. 프레임 드랍이 없다고 판정하지 않습니다.
- [ ] 앱 작성 코드(core/api/i18n 포함)에는 production `console.*` 호출이 없습니다. Hermes에는 React Native/Expo/Supabase 등 라이브러리 진단용 console 심볼이 남을 수 있습니다. release 기기 로그로 실제 이메일/토큰/사용자 콘텐츠가 출력되지 않는지 확인합니다.

아이콘은 Mac의 블루 `#4F7CFF` 체크를 유지하며 iOS **1024×1024 불투명·정사각형·가장자리까지 채운** PNG로 정리했습니다. 바깥 모서리는 시스템이 자릅니다. 원본 SVG도 같이 보관합니다. 스플래시는 같은 체크 모양, 기존 라이트 `bg`/다크 `bg`이며 세션 복원까지 유지되고 오류에서도 숨겨집니다.

- [ ] iOS의 기본/다크/틴티드 홈 화면에서 체크 식별/대비를 확인합니다. **별도 다크/틴티드 변형은 이번에 넣지 않았습니다.** 단색 바탕+흰 체크라 기존 기본 아이콘으로 동작하지만 시스템 변환의 결과는 실기기 확인이 필요합니다. 필요하면 같은 토큰의 별도 변형을 `ios.icon`에 추가할 수 있습니다([Apple 아이콘 안내](https://developer.apple.com/documentation/xcode/configuring-your-app-icon), [Expo 아이콘 설정](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)).
- [ ] 기본 아이콘의 알파 없음·수동 둥근 바깥 모서리 없음, 스플래시→로그인/하루 화면 전환에 빈 화면이 없는지 확인합니다. JS export만으로 네이티브 스플래시 포함/Store 아이콘 처리를 증명하지 않습니다.

## 9. 심사 거절·정보 요청 대응

| 사유 | 대응 |
| --- | --- |
| Guideline 2.1 정보 요청(실제 v1 경험) | 번호/질문을 먼저 읽고 `10-app-review-response.md` iOS 답장 + 제출한 TestFlight 빌드의 실제 iPhone 녹화를 보냄. 단순 정보 요청과 기능 수정이 필요한 거절을 구분 |
| 데모 계정 로그인 불가 | production 심사 이메일 환경·비밀번호·계정 활성·네트워크를 확인. 노트/Sign-In Information 갱신, 비밀번호는 저장소에 남기지 않음 |
| 계정 삭제를 찾지 못함 | 설정 → 계정 삭제의 개수·이해 체크·실제 삭제를 별도 계정으로 녹화. 웹 문의를 삭제 방법으로 대신 안내하지 않음 |
| 빈 화면/멈춤/제스처 충돌 | 정확한 빌드·기종·OS로 재현, 수정·기본 검증·새 EAS production 빌드. 정보 요청 답장만으로 해결됐다고 하지 않음 |
| 개인정보/URL/메타데이터 불일치 | 공개 사이트/라벨/SDK 실제 동작과 두 플랫폼 정보를 함께 대조. TODO 확정/사이트 게시 후 재확인 |
| 빌드 번호 중복·아이콘·서명 | 최근 iOS 빌드 번호와 EAS remote 대조. 불투명 1024 아이콘·같은 번들 ID·프로비저닝 확인. 인증서를 코드로 우회하지 않음 |

- [ ] 재제출 전 §5 데모 계정·§7 삭제/오프라인·공개 링크를 다시 확인합니다.
- [ ] 승인 뒤 필요하면 데모 비밀번호를 교체하고 다음 심사 노트도 갱신합니다.

## 10. 문서 차이와 남은 결정

- 설계서 §14.6은 별도 앱 레코드/번들 ID 가능성을 적었으나 M6는 유니버설 구매를 확정했습니다. **M6를 우선**했고 설계서 수정 제안만 남깁니다.
- M6의 "목표도 할 일도 없는 첫 로그인"은 정상 가입에 기본 목표 1개가 생기는 AUTH-04와 다릅니다. 기본 목표를 없애지 않고 목표 0개 응답도 보수적으로 안내했습니다.
- 글꼴은 M1부터 정적 4개이며 M6 예상 2MB와 다릅니다. 변경 없이 실측만 남깁니다.
- 버전 정책·출시 번호·법적 시행일/EULA·개인정보 라벨의 미결정 항목·아이콘 변형 판단은 사람이 확정해야 합니다. TestFlight 제출/기기 설치·실제 설치 크기·실기기 성능·실 계정 로그인 확인도 미완료입니다. EAS production 빌드와 IPA 측정은 위 기록대로 완료했습니다.
