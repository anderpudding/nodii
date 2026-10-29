# I4 · macOS 영어 출시 준비 결과

2026-10-29 · AUTH-01/04 · SET-06 · NFR-13/15 · 브랜치 `feat/i18n-i4-release`

## 한 일과 시작 조건

- 깨끗한 `main` **6f21b5e**에서 시작했습니다. `git merge-base --is-ancestor`로 I3 마지막 커밋 **8bc4b11**, 기본 목표 현지화 마지막 커밋 **e4ee6a6**이 모두 main에 포함됨을 확인한 뒤 브랜치를 만들었습니다.
- AUTH-01·SET-06: 코드 하나를 위에 보여 주는 한국어·영어 병기 인증 메일과 두 제목을 구현했습니다.
- NFR-13·SET-06: 일반 미서명 `.app`의 실제 번들 언어 선언을 확인하고, 별도 로컬 검증 앱에서 영어/한국어 실행·네이티브 메뉴·영어 신규 가입·언어 설정 영속화를 확인했습니다.
- SET-06: 영어 스토어 문구 3안, 글자 수 검사, 한국어 새로운 기능 추가안, 영어 스크린샷 6장과 재생성 스크립트/HTML/README를 `store-assets/screenshots-v2/`에 만들었습니다. 모두 **git 제외**입니다.
- 출시 런북 §2.3·§4.4·§5.1·§6.5와 구현 계획을 갱신했습니다. 앱 UI·카탈로그·site·스키마·Tauri 설정·버전은 변경하지 않았습니다. 새 의존성은 없습니다.
- App Store Connect·클라우드 Supabase·GitHub 설정 변경, 버전 올리기·태그·업로드·심사 제출·push는 수행하지 않았습니다.

## 메일 확인 결과

제목은 다음과 같습니다.

| 용도                  | 제목                                        |
| --------------------- | ------------------------------------------- |
| Magic Link / 로그인   | `Nodii 로그인 코드 · Your Nodii login code` |
| Confirm signup / 가입 | `Nodii 가입 코드 · Your Nodii sign-up code` |

본문은 제목줄 `Nodii 인증 코드 · Your Nodii code` → 큰 코드 → 기존 한국어 두 문장 → 구분선 → 영어 두 문장 순서입니다. `{{ .Token }}`은 소스에 정확히 한 번, 실제 받은 코드도 본문에 한 번입니다. 두 언어 블록과 제목의 각 언어 span에 lang 속성을 넣었습니다. 한국어 원문은 그대로이고 영어는 지시서의 두 문장을 사용했습니다. 앱 `auth.email.help`와 6자리 코드/10분 안내의 의미를 맞췄으며 카탈로그를 변경하지 않았습니다. 외부 이미지·폰트·스크립트·스타일시트는 없습니다.

디자인 훅이 기존 `#888` 안내문의 낮은 대비를 지적해 두 언어의 보조 안내를 기존 `muted` 토큰 `#626877`로 보강했습니다. 수정 후 훅 지적 0건이며 억제한 항목·남겨 둔 지적은 없습니다. 실제 메일 앱의 다크 모드는 사람이 확인해야 합니다.

`pnpm db:start`로 로컬 서비스를 시작하고, `pnpm db:reset && pnpm db:test && pnpm db:types`를 실행했습니다. **pgTAP 159개 통과**, 타입 파일 변경 0개입니다.

실제 저장소의 `auth.email.enable_confirmations=false`에서는 가입 확인 메일을 별도로 검증하기 어렵습니다. 제품 설정은 유지하고, `/private/tmp/nodii-i4-mail`에 설정·마이그레이션·템플릿을 복사하여 **임시 로컬 환경만** 확인 메일을 켰습니다. API **56321**, 메일함 **56324**를 사용했습니다. 지시서의 Inbucket 주소와 달리 현재 CLI의 메일함은 **Mailpit**이며 동일한 로컬 메일 미리보기 역할입니다.

이 환경에서 Auth HTTP로 새 `@nodii.test` 주소에 가입 OTP 요청 → Mailpit 제목/HTML 확인 → 코드 인증 → 같은 계정에 로그인 OTP 요청 → 두 번째 제목/HTML 확인 → 코드 인증을 모두 통과했습니다. 위 제목 두 개, 코드 한 번, 언어 블록 순서, 각 언어의 10분 안내와 요청하지 않은 메일 무시 안내를 검사했습니다. 이는 **로컬 수신 검증**이며 실제 SMTP/Gmail/iCloud 수신 검증은 아닙니다. 일회용 코드·세션·키는 보고서나 저장소에 남기지 않았습니다.

참고한 기본 동작은 [Supabase 이메일 템플릿 공식 문서](https://supabase.com/docs/guides/auth/auth-email-templates)이며, [changelog](https://supabase.com/changelog)도 확인했습니다. Markdown 문서 조회는 도구의 content-type/DNS 제한으로 실패해 HTML 공식 문서로 확인했습니다.

## 번들 언어 선언과 실행 결과

실행 명령:

```sh
pnpm --filter @nodii/desktop tauri build --bundles app --no-sign
plutil -p apps/desktop/src-tauri/target/release/bundle/macos/Nodii.app/Contents/Info.plist
```

설치된 CLI에 `--no-sign`이 있어 그대로 사용했습니다. **미서명 빌드 성공**이며 결과는 `apps/desktop/src-tauri/target/release/bundle/macos/Nodii.app`입니다. 실제 Contents/Info.plist에서 다음을 확인했습니다.

| 키                            | 실제 번들 값           |
| ----------------------------- | ---------------------- |
| CFBundleDevelopmentRegion     | `en`                   |
| CFBundleLocalizations         | `en`, `ko`             |
| ITSAppUsesNonExemptEncryption | `false`                |
| CFBundleIdentifier            | `com.sungjunlee.Nodii` |
| CFBundleShortVersionString    | `0.1.3`                |

`tauri.appstore.conf.json`에는 entitlements와 embedded profile 설정만 있으며 Info.plist 경로/언어를 덮어쓰지 않습니다. 설치된 Tauri config schema의 `MacConfig.infoPlist` 설명도 설정 파일과 같은 폴더의 `Info.plist`를 자동 병합한다고 명시합니다. 따라서 스토어 설정 역시 같은 소스를 합치는 구성입니다. **서명된 App Store 바이너리는 만들지 않았으므로 실제 업로드 바이너리·스토어 Languages 목록은 미검증**입니다. `pnpm build:appstore`도 실행하지 않았습니다.

사용자의 기존 앱 세션·설정을 피하기 위해 네이티브 실행은 명령행 임시 설정으로 **Nodii I4 Preview / com.sungjunlee.Nodii.i4preview**를 별도 빌드했습니다. 저장소의 설정 파일은 바꾸지 않았습니다. 검증 앱은 임시 로컬 API 56321만 사용합니다. 첫 시도에서는 출시 CSP가 로컬 연결을 막아 로그인 요청이 실패했고, 검증용 명령행 설정에만 로컬 HTTP/WS CSP를 주입해 재빌드했습니다. 출시용 CSP는 유지했습니다.

```sh
open -n 'apps/desktop/src-tauri/target/release/bundle/macos/Nodii I4 Preview.app' --args -AppleLanguages '(en-US)'
open -n 'apps/desktop/src-tauri/target/release/bundle/macos/Nodii I4 Preview.app' --args -AppleLanguages '(ko-KR)'
```

매번 앱을 완전히 종료하고 실행했습니다. 시스템 언어 설정은 바꾸지 않았습니다.

| 실행 조건                            | 실제 확인                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| en-US / 앱 언어 System               | 영어 로그인 화면, `October 2026`, `Thu, October 29 · Today`, 영어 요일. Settings의 Language에서 System 선택 확인                      |
| 영어 신규 가입                       | 로컬 메일의 코드로 실제 Tauri 가입 성공. 기본 목표 **Todos** 표시                                                                     |
| 영어 메뉴                            | File·Edit·View·Window, About Nodii·Settings…·Hide Nodii·Hide Others·Quit Nodii 확인                                                   |
| ko-KR / 앱 언어 System               | `2026년 10월`, `10월 29일 (목) · 오늘`, 한국어 요일. 파일·편집·보기·윈도우, Nodii 정보·설정…·Nodii 가리기·기타 가리기·Nodii 종료 확인 |
| ko-KR 실행 중 English 선택           | 열린 설정 시트·날짜·요일·메뉴가 즉시 영어로 전환                                                                                      |
| English 선택 후 종료, ko-KR로 재실행 | 날짜와 메뉴가 영어로 유지, Settings의 English 선택 확인. 세션과 기존 **Todos** 이름도 유지                                            |
| System 복원                          | 같은 실행에서 한국어 날짜·메뉴로 복원 확인 후 검증 앱 종료                                                                            |

`⌘,`로 설정 열기도 확인했습니다. OS 서비스 메뉴에 설치된 개발 도구 이름은 앱 카탈로그 현지화 대상이 아닙니다. 이 검증은 **별도 ID·로컬 백엔드의 미서명 앱** 결과이며, 정식 ID의 실제 계정/서명 TestFlight 빌드 검증으로 확대하지 않습니다. 한국어 명시 선택의 재실행 유지·400×600 전체 순회·VoiceOver·WKWebView 날짜 입력 조합은 사람 확인 항목입니다.

## 영어 스토어 문구와 글자 수

전체 초안: `store-assets/screenshots-v2/store-text.en.md`. 한국어 원본 `store-text.md`는 수정하지 않고, 한국어 macOS 새로운 기능에 영어 지원 두 줄을 더한 별도 절을 영어 초안 안에 넣었습니다. iOS 영어 설명·스크린샷은 만들지 않았습니다.

`generator/store-copy.mjs`가 Unicode 코드 포인트를 **공백·구두점·줄바꿈 포함**하여 셉니다. 이름·부제·키워드는 번호가 같은 조합끼리 사용합니다.

| 안        | 이름                      | 글자 수 / 30 | 부제                          | 글자 수 / 30 |
| --------- | ------------------------- | ------------ | ----------------------------- | ------------ |
| 추천      | Nodii: Todos & Routines   | 23           | Goals, Habits & Daily Planner | 29           |
| 다른 안 1 | Nodii: Daily Todo Planner | 25           | Color Your Goals and Habits   | 27           |
| 다른 안 2 | Nodii: Goals & Habits     | 21           | Plan Todos, Build Routines    | 26           |

키워드 각 **84 / 100**:

- 추천: `checklist,calendar,task,organizer,schedule,weekly,monthly,tracker,sync,desktop,focus`
- 다른 안 1: `checklist,calendar,task,routine,organizer,schedule,weekly,monthly,tracker,sync,focus`
- 다른 안 2: `checklist,calendar,task,planner,organizer,schedule,weekly,monthly,tracker,sync,focus`

이름·부제 단어와 키워드 중복, `app`, 쉼표 뒤 공백을 스크립트로 검사했습니다. 다른 앱 이름은 넣지 않았습니다. 조합을 바꾸면 중복 검사를 다시 해야 합니다.

| 항목                       | 글자 수 / 한도 |
| -------------------------- | -------------- |
| 프로모션 텍스트            | 151 / 170      |
| macOS 설명                 | 1794 / 4000    |
| 영어 새로운 기능           | 386 / 4000     |
| 한국어 새로운 기능 별도 안 | 273 / 4000     |

설명은 한국어 원문의 목표별 하루 → 루틴 → 캘린더 → 동기화 → 로그인/개인정보 순서를 따릅니다. Mac의 영어/한국어 지원과 현재 iPhone UI의 한국어 지원을 구분했습니다. 새로운 기능은 main의 영어 지원·기기 언어 저장·날짜/메뉴 현지화·신규 기본 목표·영어 레이아웃 보강만 적었습니다. 클라우드에 아직 적용하지 않은 병기 메일을 출시 완료 기능으로 적지 않았습니다.

## 스크린샷 6장과 모의 데이터

결과: `store-assets/screenshots-v2/macos-en/`. 모두 **2880×1800 PNG**이며 순서/파일명 접미사는 한국어와 같습니다. HTML 템플릿과 Playwright, 앱에 설치된 Pretendard를 사용했습니다. 실행 방법은 `store-assets/screenshots-v2/generator/README.md`, 측정은 `reference-pixels.json`, 검사 결과는 `screenshot-checks.json`, 모의 데이터는 `mock-data.json`입니다.

| 파일                     | 영어 제목                               | 보라색 강조 단어 |
| ------------------------ | --------------------------------------- | ---------------- |
| nodii-mac-01-today.png   | Make room for every goal                | goal             |
| nodii-mac-02-daymenu.png | Bring unfinished todos to today         | today            |
| nodii-mac-03-routine.png | Set a routine. Let it repeat.           | routine          |
| nodii-mac-04-goals.png   | Give every goal a color                 | color            |
| nodii-mac-05-dark.png    | A calmer day in dark mode               | dark             |
| nodii-mac-06-narrow.png  | A smaller window. / One week at a time. | week             |

- 한국어 **6장을 먼저 이미지로 열어** 여백·글자·강조색·프레임·모서리·그림자 범위를 측정했습니다. 앞 5장 창 외곽은 CSS 좌표 `(259,222)`, `922×649`; 6번은 `(919,89)`, `432×722`입니다. 타이틀바 28, 모서리 12, 내부 앱 화면은 각각 `920×619` / `430×692`입니다. 합성은 1440×900 CSS px의 DPR 2입니다.
- 날짜는 한국어 원본과 같은 **2026-10-22(목)**, 주 시작 일요일, 42칸 그리드입니다. 오늘 **6개 중 3개 완료**, 하루 메뉴의 지난 미완료 **3개**, 활성 목표 **4개**, 보관 목표 **1개**를 맞췄습니다. 달력 42칸의 남은 개수/완료 색 상태도 원본을 기준으로 재구성했습니다.
- 목표는 Study / Workout / Reading / Todos, 보관한 목표는 Travel입니다. 오늘의 항목은 Learn 30 Spanish words, Solve 2 coding problems, Review chapter 3 notes, Run 5 km, Read 20 pages, Get groceries입니다. 앞의 두 Study 항목과 Run 5 km가 완료 상태입니다.
- 루틴 만들기는 **Swimming lesson**, Workout, 매주 월·수·금, 간격 1, 시작 2026-10-22, 종료일 없음입니다. 목표 관리의 개수도 Study 16/2, Workout 0/2, Reading 0/1, Todos 12/1(할 일/루틴)로 맞췄습니다.
- 브라우저 프리뷰는 모의 Auth/REST·Realtime만 사용했습니다. 외부 호스트를 차단하고 쓰기 요청을 실패시킵니다. 오류·가로 넘침·DOM/입력값의 한글 0건입니다. 개인정보처럼 보이는 사용자 데이터·다른 회사 상표는 넣지 않았습니다.
- OS 네이티브 날짜 입력은 Playwright locale만으로 한국어가 남았습니다. Chrome 프로세스에만 `-AppleLanguages '(en-US)'`를 넘기는 래퍼로 해결했습니다. 빈 종료일은 **yyyy-mm-dd**, 시작일은 **2026-10-22**로 보이며 앱 날짜 입력이나 카탈로그를 고치거나 이미지 위에 덮어쓰지 않았습니다.
- 최종 PNG 크기를 검사하고 6장을 각각 열어 한글·잘림·겹침·프레임을 검수했습니다. 제목/부제는 원본 6번의 의도된 두 줄 외에는 한 줄입니다. 목록 아래 화면 밖 항목은 앱의 정상 스크롤 영역입니다.

## 지시서와 실제 자료 차이 / 결정이 필요한 사항

1. **기본 언어 문서의 분기:** 앞서 만든 `8b25e48`(기본 언어 변경을 I5로 옮긴 계획 수정)은 `feat/i5-primary-language`에만 있고 시작 main에는 없습니다. main의 계획은 아직 I4에서 변경 검토라고 적습니다. 이번 단계는 구체적인 I4 지시서의 **기본 언어 유지·I5 전환 확정**을 따라 런북에 기록했습니다. 기존 커밋은 보존했고 이번 브랜치에 임의로 cherry-pick하거나 계획을 다시 수정하지 않았습니다. 이 계획 커밋의 통합은 남습니다.
2. **원본 배경/배치:** 지시서는 모두 연보라·상단 문구라고 요약하지만, 실제 02는 연살구, 03은 연청록, 04는 연파랑, 05는 다크, 06은 연분홍이며 06은 좌측 문구/우측 창입니다. 원본의 배경·배치를 유지했습니다. 원본 강조색은 여러 색이지만 영어는 지시서가 명시한 **단어 하나의 보라색 강조**를 적용했습니다.
3. **원본 생성 소스 없음:** 한국어 PNG만 있으므로 원시 브라우저 viewport와 그림자 CSS의 수학적 동일성은 검증할 수 없습니다. 프레임 크기·위치는 측정해 맞췄고, 그림자는 확산 범위를 기준으로 재현했습니다. 영어의 원시 프리뷰는 넓은 창 1100×740 / 좁은 창 **490×788**, 최종 합성 내부 너비는 원본과 같은 920 / 430입니다. 430px 원시 창에서는 긴 영어 머리글/버튼이 다음 줄로 내려가 목록이 더 가려졌습니다. 제품 UI 수정 없이 6번에서 헤더와 보이는 행이 잘리지 않도록 원시 캡처 크기를 조정했습니다. **원시 창 폭까지 동일하다고 주장하지 않으며**, 원본 생성 소스가 있으면 그 viewport로 최종 재대조가 필요합니다.
4. **메일/네이티브 검증 환경:** 저장소의 확인 메일 비활성 설정, 현재 Mailpit, 출시 CSP의 로컬 차단 때문에 위의 임시 환경과 별도 ID/CSP를 사용했습니다. 제품 설정을 바꾸지 않았고 실제 SMTP·정식 서명 앱 검증은 남겼습니다.
5. **공유 앱 정보:** 이름·부제는 iOS/macOS가 함께 쓰므로 영어 현지화를 추가하면 iOS의 영어 스토어 노출에도 영향을 줄 수 있습니다. 추천안은 플랫폼 전용 영어 지원을 약속하지 않지만 iPhone UI는 아직 한국어입니다. 사람이 공유 이름·부제와 iOS 노출을 검수해야 합니다. 기본 언어 English 전환은 I5입니다.
6. **출시 버전 제안:** 현재 0.1.3에서 새로운 영어 지원을 알리는 **0.2.0**을 제안합니다. 번호 결정은 사람이 하며 이번 작업에서 파일/태그/업로드를 바꾸지 않았습니다.

## 실행한 검증과 완료 기준

pnpm은 기존 캐시의 **10.28.0**을 `/private/tmp/nodii-i2-bin` PATH로 사용했습니다. 설치/다운로드·새 의존성 추가는 없습니다.

| 지시서 완료 기준 / 명령                           | 결과                                                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                                       | 최종 통과. git 제외 생성 스크립트도 검사                                                                      |
| `pnpm format:check`                               | 통과. 메일 HTML·생성 스크립트/HTML/README는 ignore를 해제한 개별 Prettier도 적용                              |
| `pnpm typecheck`                                  | 모바일 포함 전체 통과                                                                                         |
| `pnpm test`                                       | **681개 통과**: core167 · i18n33 · api82 · desktop157 · mobile Vitest137 / Jest105(12스위트)                  |
| `pnpm db:start`                                   | 로컬 시작 성공                                                                                                |
| `pnpm db:reset && pnpm db:test && pnpm db:types`  | 초기화 성공, **159개 통과**, 타입 변경 0개                                                                    |
| 로컬 병기 메일                                    | 가입/로그인 각각 제목·본문·코드 한 번·언어/10분 안내·실제 코드 인증 통과                                      |
| 일반 미서명 `tauri build --bundles app --no-sign` | 성공, 실제 Info.plist의 en / en·ko / 암호화 false 확인                                                        |
| App Store 설정 파일 확인                          | 동일한 기본 Info.plist를 병합하는 구성, 변경 없음                                                             |
| `-AppleLanguages` 네이티브 실행                   | 격리 미서명 앱에서 영어/한국어 날짜·메뉴, System, 영어 신규 가입·Todos, 실행 중 전환·English 재실행 유지 확인 |
| `node …/generator/store-copy.mjs`                 | 3조합 및 모든 문구 길이 제한·키워드 검사 통과                                                                 |
| `node …/generator/capture.mjs`                    | 6장 생성. 오류·가로 넘침·한글·외부 요청 각 0건                                                                |
| 최종 PNG 크기 / 이미지 검수                       | 6장 모두 2880×1800, 날짜 입력을 포함해 한글 잔존 없음, 마케팅 문구 잘림/겹침 없음                             |
| `git diff --check` / 커밋 범위                    | 통과, store-assets·빌드·지시서·비밀 파일 제외                                                                 |

초기 로컬 CLI telemetry 쓰기/프리뷰 포트는 sandbox 제한으로 실패해 승인된 로컬 실행으로 재시도했습니다. 생성 스크립트의 globals/미사용 대입 린트, 모의 날짜의 월말 범위 오류, Realtime 연결 경고, 날짜 입력의 한국어 표시도 최종 생성 전에 수정했습니다. 제품 코드/테스트 기대값을 바꾸지는 않았습니다. 기존 모바일 act/GoTrueClient 진단·웹 빌드 500kB 청크 경고, 타입 생성 시 MaxListeners 진단은 남습니다.

보조 검사로 macOS Vision OCR도 시도했으나 모듈 캐시 sandbox 제한을 해결한 뒤에도 Vision 실행이 `Foundation._GenericObjCError.nilError`로 실패했습니다. OCR 결과를 통과 근거로 쓰지 않았고, 한글 확인은 DOM/입력값 검사와 최종 이미지 직접 검수로 수행했습니다.

**건너뛴 검증:** 정식 ID/서명 App Store 빌드·TestFlight·다른 맥·실제 SMTP/Gmail/iCloud·스토어 Languages/미리보기·전체 네이티브 영어 E2E/최소 400×600/VoiceOver·iOS 영어 반영·원격 CI. 출시 작업은 사람 영역이거나 이번 단계의 로컬 검증 범위를 벗어나므로 통과로 표시하지 않았습니다.

## 사람이 할 일 (런북 순서)

1. **§2.3·§2.4:** 클라우드 Magic Link/Confirm signup 제목과 병기 otp.html을 수동 반영. 실제 가입/로그인 메일을 Gmail·iCloud 등에서 받아 코드·스팸·다크 모드 확인. 새 앱 출시 전 반영 가능 (§5.1).
2. **§4.4-1~2:** 영어 문구 3안과 최종 6장을 검수하고 공유 이름·부제를 승인. App Store Connect에 English (U.S.) 추가. 기본 언어 유지.
3. **§4.4-3~4:** macOS 버전에 승인 문구·6장·기존 영어 지원/개인정보 URL 입력. 한국어 새로운 기능 추가안도 검수.
4. **§5.1·§1.5:** 사람이 버전 번호를 결정하고 별도 릴리스에서 버전/태그·새 빌드 업로드 수행. 이번 브랜치에서는 하지 않음.
5. **§6.5·§6.1~4:** 정식 서명 앱에서 영어 전체 흐름, 언어 설정/재실행·메뉴/단축키/OS 날짜 입력·한국어 신규 가입·400×600/다크/VoiceOver·다른 맥을 확인.
6. **§4.4-6~7:** 빌드 처리 뒤 스토어 Languages의 English·Korean과 양쪽 미리보기 확인. 이 목록은 현재 소스 검증만으로 완료 처리하지 않음.
7. 계획 수정 `8b25e48` 통합과 I5의 iOS 언어 연결/기본 언어 전환은 별도 후속 작업.

## 커밋과 의존성

- `0f875fd` — `feat(auth): send bilingual verification code emails (AUTH-01, SET-06)`
- `0441aff` — `docs(release): add English localization steps to runbook`
- 이 보고서·구현 계획은 세 번째 기록 커밋으로 분리합니다.
- **새 의존성 없음.** 설치된 Playwright/Chrome/Pretendard 및 기존 로컬 Supabase만 사용합니다. 제품 코드·락파일·DB 스키마·생성 타입·네이티브 설정 변경 없음. `store-assets/`, 빌드, `docs/codex/`, `.hiring-panel/`은 커밋하지 않습니다.
