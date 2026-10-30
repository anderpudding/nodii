# I5 · iOS 영어 지원과 출시 준비 결과

작업일: 2026-10-30. I4 PR #42가 병합된 `main`(`b8a49cc`)에서 `feat/i18n-i5-ios`를 만들었다. 시작 시 작업 트리는 깨끗했다. 기준은 `AGENTS.md`, i18n 계획·iOS 런북·I1~I4 보고서와 `docs/codex/stage-i5-ios-english.md`다. 디자인 문서·토큰과 해당 모바일 와이어프레임도 읽었다.

## 1. 구현 범위

- **SET-06**: SDK 57에 맞춰 `npx expo install expo-localization`으로 `~57.0.2`를 설치했다. 유일한 새 직접 의존성이다. 잠금 파일의 `rtl-detect`는 그 전이 의존성이다. Expo Go에는 모듈이 있지만 기존 개발 클라이언트·production 바이너리는 **새 네이티브 빌드가 필요**하다.
- `lib/language-preference.ts`: AsyncStorage `nodii.language`에 `system | ko | en`을 기기별 저장한다. 읽기 오류·시간 초과는 system 적용 후 오류를 알리고, 잘못된 값도 system이다. 저장 성공 후에만 언어·선택을 바꾸며 실패 시 이전 상태를 유지한다. system일 때만 AppState active에서 첫 기기 선호 언어를 다시 읽는다. 빈 언어 배열도 코어의 영어 기본값으로 처리한다.
- 루트는 theme·language 복원을 함께 기다린 다음 첫 화면을 렌더하고 읽기 실패를 알린다. 설정의 테마 아래 언어 세그먼트에 그룹 이름·선택 상태·저장 중 비활성을 추가했다. 언어 이름은 System / 한국어 / English이며 자기 언어 표기를 유지한다.
- **CAL-01/SET-06**: 고정 `ko-KR` 8파일 9곳을 현재 로케일 헬퍼로 바꿨다. ISODate는 UTC 기반 `formatISODate`, 요일은 `weekdayName`이다. 보관 타임스탬프는 로케일만 바꾸고 기존 시간대 처리를 유지했다.
- **ROUT-10**: 규칙 표시를 `packages/i18n/src/format-routine.ts`의 `formatRoutineRule`로 공유했다. 데스크톱 기존 경로는 재수출하고 모바일 `ruleLabel`도 같은 함수를 사용한다. core 역의존·런타임 의존성을 추가하지 않고 필요한 구조 타입만 받는다. 목록·서수·주 시작 정렬·월 일자 정규화는 기존 데스크톱 방식을 따른다. 한국어 대표 출력 `매일`, `매주 월·수·금`, `매월 1·15일`과 영어 일/주/월·간격을 검사했다.
- **AUTH-04**: 일반 이메일 OTP 요청만 `sendOtp(client, destination, getLocale())`로 바꿨다. 심사 계정 경로는 유지했다. 서버/API/DB와 기존 사용자 이름은 바꾸지 않았다.
- ESLint의 한국어 리터럴 금지(error)를 모바일 app/src/lib에 적용했다. 테스트·픽스처는 제외했다. Vitest·Jest 모두 기본 ko·모의 expo-localization을 설정했다. 개발 pseudo는 `__DEV__ && EXPO_PUBLIC_PSEUDO_LOCALE === '1'`일 때만 켜진다. 네 조합을 검사해 production에서 플래그가 1이어도 꺼짐을 확인했다.

## 2. 다시 그리기 선택과 문자열 감사

**코드 선택 전에 실제 expo-router Stack을 RNTL로 검사했다.** 루트만 `useLocale()`로 구독하면 열린 라우트는 `언어`를 그대로 표시했다. 라우트 최상위(`app/index.tsx`)도 `useSyncExternalStore`로 구독하면 `Language`로 바뀌고 입력 초안·마운트 횟수 1이 유지됐다. 따라서 루트와 라우트가 구독하고 트리 key로 재마운트하지 않는다. 루트 구독은 준비/오류 문구도 갱신한다.

열린 BottomSheet와 기존 실행 취소 토스트를 함께 바꾸는 네이티브 검사도 통과했다. 토스트는 번역 함수를 보관해 표시 시점에 평가한다. ID·만료 시간·실행 취소 콜백은 유지한다. 제스처로 별도로 열리는 TodoMenu도 구독한다.

지시서의 22곳과 달리 실제 production `useMemo`·`useCallback` 호출은 **19곳**이었다(import·테스트 제외). 전체 목록:

| 파일 | 확인한 호출 | 처리 |
| --- | --- | --- |
| BottomSheet | pan | 닫기/제스처만, 번역 없음 |
| ManagementScreen | edge | 제스처만 |
| Toast | show, dismiss, clear, registerPortal | 4곳. show는 번역 함수 보관, 표시 컴포넌트가 로케일 구독 |
| SwipeableRow | coordinator, scroll, close | 3곳. 제스처 상태만 |
| Today | rows, logs, sections, summary, stampColors | 5곳. 도메인/색/집계만, 표시 문구는 렌더에서 계산 |
| RoutineList | edge | 제스처만 |
| DatePickSheet | summary, stampColors | 2곳. 집계/색만 |
| TodoMenu | close, pan | close 안의 폐기 확인 문구 4개를 메모 밖으로 옮겨 번역 문자열을 의존성에 포함. pan은 close에 의존 |

이어 붙이던 문장은 다음과 같이 정리했다.

| 위치 | 변경 |
| --- | --- |
| routines/model.ts | 월·일 단위를 이어 붙이던 규칙을 전체 문장 키 + formatList + ordinal로 전환 |
| RoutineList | 행 접근성 이름은 `routine.row.label`, 규칙·기간 표시는 `routine.row.detail` 전체 키 |
| Login 코드 설명 | 이메일을 무조건 앞에 붙이지 않고 `{email}` 자리 앞/뒤를 나눠 강조 Text를 삽입. 한국어의 앞 이메일·강조 모양은 유지 |
| RoutineEditor 요일 접근성 | 허용된 유일한 기존 한국어 값 변경: `{day}요일 고르기` → `{day} 고르기`, long 요일 전달. 결과는 계속 `월요일 고르기` |

추가로 실제 production에는 지시서의 요일 배열 외에 `'을/를'` 리터럴 **4개**가 있었다. `withParticle`의 기본 인자로 이동해 결과를 보존했다. 기간의 날짜 범위 구분 기호·사용자 제목·목표 이름은 번역 문장의 조각으로 만들지 않는다.

## 3. 실제 iOS 화면 검수

iOS 18.5 / Expo Go 57.0.9 / 실제 React Native·Hermes에서 제품 컴포넌트를 실행했다. 화면 데이터만 I4 영어 샘플로 격리했다. 모의 transport는 로컬 메모리이며 실제 계정·DB에 쓰지 않았다. 웹 미리보기로 대체하지 않았다.

| 기기 | 논리 크기 | PNG | 검수 조합 |
| --- | --- | --- | --- |
| iPhone 16e | 390×844 | 1170×2532 | English/pseudo × 기본 large/접근성 accessibility-extra-extra-large |
| iPhone 16 Pro Max | 440×956 | 1320×2868 | 같은 4조합 |
| iPhone 16 Pro | 402×874 | 1206×2622 | 스토어 6.3인치 원시 캡처·네이티브 동작 확인 |

`accessibility-extra-extra-large`는 가장 큰 접근성 단계 바로 아래다. 로그인 이메일/코드/심사 계정, 업데이트 필요, 첫 안내, 오늘 주간/월간, 추가 입력, 메뉴/이름 수정/날짜 선택, 하루 메뉴, 목표/편집/보관함, 루틴/편집/범위/그만하기, 설정/계정 삭제, 실행 취소, 다크를 순회했다. 긴 편집·범위·설정은 위와 아래를 별도로 캡처했다. 원시 PNG·접촉판·캡처 메타데이터는 git 제외 `generator-ios/audit-*`에 남겼다. 기본 26화면×8조합 208장에 하단·양방향 밀기 화면을 보태 누적 보관한 고유 캡처는 **260장**이다(`source-audit.json`). 보완 전 진단 프레임도 보관하며, 공통 상단의 마지막 폭 보완은 최종 today/dark 원시 캡처에서 재확인했다. 스토어용 12장은 별도의 최종 출력/검증본이다. 검수용 임시 복사본은 locale/pseudo 매개변수로 초기 상태를 준비하며, 이 경로는 제품에 들어가지 않는다. 제품의 개발 환경 변수 경로는 네 조합 검사와 production export로 별도 확인했다.

한국어 보존도 별도로 확인했다. 문구 다듬기 전 I5 커밋 `76c0990`과 최종 코드를 같은 iPhone 16 Pro·같은 데이터·기본 글자로 캡처해 오늘/월간/루틴 편집/하루 메뉴/설정 **5장 모두 다른 픽셀 0개**를 확인했다(`korean-layout-checks.json`). 설정의 언어 줄은 지시서 4번에 따라 이미 추가된 I5 상태를 비교한 것이다. 이후 보완도 영어 조건으로 한정했다. 이는 이 5개 샘플 화면의 기본 배치 확인이며 모든 사용자 데이터·접근성 설정 조합을 증명하지 않는다. main 대비 기존 한국어 카탈로그 값은 허용된 weekdaySelect 하나만 다르고 기존 테스트에서 한국어 기대값을 삭제하거나 수정한 곳은 없다.

### 화면에서 발견한 문제와 수정

- English 스와이프 칸의 `Mark as Done` 세 줄이 잘렸다. 시각 표기는 Done / Undo, 접근성 이름·대체 메뉴는 전체 동작 이름을 유지했다. 한국어는 기존 완료 / 완료 취소를 재사용한다.
- 고정 너비의 헤더·달력 셀·좁은 버튼이 접근성 글자에서 본문을 밀어내거나 요일을 세로로 쪼갰다. 제한된 영역의 헤더는 2줄, 달력/버튼은 한 줄 맞춤을 적용했다. 본문 글자 확대 자체를 끄거나 전역 상한을 넣지 않았다. 날짜 빠른 선택은 필요하면 줄바꿈한다. 선택지 라벨과 버튼은 폭을 줄일 수 있다.
- 오늘의 영어 확대 헤더는 날짜에 한 행을 배정한다. 먼저 내용에 맞는 축소·줄바꿈을 적용했지만 확대된 영어 날짜와 나머지 버튼을 한 행에 둘 수 없어, 이 경우에만 영어 + fontScale 분기를 썼다. 새 색·크기·모션 토큰은 추가하지 않았다. 달력 월 셀의 원래 높이66은 한국어와 기본 글자에서 유지하고 영어 확대에서만 내용 높이를 허용했다.
- 확대 영어의 긴 제목과 Cancel/Save가 폭을 다투어 pseudo에서 동작이 가려졌다. 공용 `SheetHeader`에서 제목과 동작 행을 분리하고 동작에 같은 폭을 주었다. 첫 안내·일반 시트·루틴 편집·이름 수정이 이를 사용한다. 관리 제목은 한 줄 맞춤을 사용한다.
- 목표/루틴 관리의 확대 영어 행은 이름표·제목/설명·보관 해제 동작을 세로로 배치해 전체 폭을 확보했다(`use-large-english-text.ts`). 한국어 보존 요구에 따라 최종 줄 수·폭·맞춤 제약은 영어에 한정했다.
- 업데이트 안내의 기존 중앙 고정 View는 확대 영어에서 위·아래가 화면 밖으로 나갔다. 영어는 ScrollView로 전체 안내·버전·업데이트 버튼에 도달하게 했다. 한국어 View는 유지했다.
- 확대 영어의 여러 줄 토스트 글자가 알약 모서리 밖에 놓였다. 이 경우 기존 card 모서리 토큰을 쓰고 Undo 폭/줄 맞춤을 적용했다. 한국어와 기본 영어 토스트의 모양은 유지했다.
- 72pt 밀기 라벨은 영어 한 줄 맞춤, 접근성은 전체 동작 이름을 유지한다. 확대 캡처는 해당 행까지 실제 목록을 스크롤해 완료/옮기기/삭제 칸을 확인했다. pseudo의 긴 Today 버튼도 가용 폭에 맞춘다.
- 코드 설명의 이메일 순서, 루틴 편집의 `Every 1 weeks` 단수, iOS 제목 대소문자를 다듬었다.

고친 영어 표기(공유 기존 영어 값은 바꾸지 않고 모바일 전용 키로 분리):

| 키/표시 위치 | 이전 | 이후 | 이유 |
| --- | --- | --- | --- |
| 스와이프 완료 시각 라벨 | Mark as Done | Done (`common.done`) | 72pt 칸에 들어가게, 전체 접근성 라벨 유지 |
| `mobile.swipe.uncomplete` | Mark as Unfinished | Undo | 좁은 완료 취소 칸 |
| `mobile.dayMenu.title` | Day menu | Day Menu | iOS 시트 제목 |
| `mobile.routine.daily` | Every day | Every Day | 편집 세그먼트 버튼 |
| `mobile.routine.interval.daily/weekly/monthly` | Every 1 days/weeks/months | Every 1 day/week/month | 1일 때 단수, 2 이상은 기존 복수 키 |
| Login 코드 설명 배치 | 이메일 + Enter the 6-digit code… | Enter the 6-digit code sent to 이메일. | 기존 영어 카탈로그 어순 존중 |

잠금 해제 뒤 Device Hub에서 한국어 설정의 English를 눌러 열린 화면이 Settings/Language로 바뀌고 선택 상태가 유지됨을 확인했다. Expo Go를 완전히 종료한 뒤 언어를 강제하지 않는 `locale=stored` 경로로 다시 열어 English 복원을 확인했다. 실제 W→M→날짜 선택→W, 행 대체 메뉴→날짜 시트, 하루 삭제 확인의 **Delete 2 Unfinished Todos? / Done todos and routines will stay.** 및 Cancel도 확인했다. 목표 + 입력에서 영어 샘플 2개를 완료 키로 연속 추가하고 입력·키보드 유지, 영어 Deleted/Undo 표시도 확인했다. 모두 격리 데이터에서 수행했다.

VoiceOver의 영어 접근성 라벨·선택 상태는 네이티브 테스트와 접근성 트리로 확인했다. **실제 음성 낭독은 완료하지 못했으며**, 행/대체 동작/세그먼트의 청각적 검수는 런북 §7.1의 사람 항목이다. 샘플 상태를 직접 여는 캡처는 전체 실제 서버 E2E나 밀기 촉감·연속 입력 IME·TestFlight 검증을 증명하지 않는다.

## 4. 실제 환경과 지시서의 차이

1. **Hermes Intl**: Node 테스트와 달리 Expo Go의 Hermes에는 `Intl.PluralRules`·`Intl.ListFormat`이 없었다. 처음 영어 화면에서 예외를 재현했다. 새 의존성 없이 ko/en에 필요한 cardinal/ordinal·목록 fallback을 i18n 내부에 추가했다. Native 구현이 있는 환경은 그대로 쓰며, 없는 경로를 테스트에서 실제로 제거해 검사했다(서수 1~131·수량·목록). 이 때문에 공용 패키지는 규칙 요약 이동 외에도 최소한의 호환 코드가 추가됐다. 데스크톱 검증도 다시 실행했다.
2. **권한 설명**: app.json에 직접 없었지만 합쳐진 설정에는 기존 expo-secure-store의 Face ID와 개발 클라이언트의 Local Network 설명이 있었다. 두 설명을 en/ko locale JSON에 넣었다. 앱 기능의 새 권한 요청 코드는 추가하지 않았다.
3. **정적 조사 수치**: 메모 22→실제19, 요일 외 조사 리터럴4개. 숨기거나 기준을 바꾸지 않고 위에 처리 내역을 적었다. 계획 표의 고정 날짜 8곳은 실제8파일9곳으로 바로잡았다.
4. **네이티브 실행 도구**: 이 Xcode의 시뮬레이터 앱 이름은 Simulator 대신 Device Hub였다. Expo Go 첫 열기 확인과 개발 메뉴 오버레이를 정리한 뒤 캡처했다. 기본 키보드는 OS의 한국어 설정을 따르므로 시스템 키보드의 한국어는 앱 미번역으로 세지 않았다. 언어 선택지 `한국어`도 의도된 자기 언어 이름이다.
5. **캡처 데이터**: 한국어 원본은 루틴5개지만 I4 영어 샘플에는6개다. 실제 영어 샘플6개를 사용했다. 영어 목표 칩과 문장은 길이에 맞게 줄바꿈해 시트 높이가 달라질 수 있다. 앱 캡처의 글자나 상태를 이미지 편집으로 고치지 않았다. Run 5 km 편집은 원본 요일 구성을 보이도록 weekly Tue/Thu/Sat 검수 상태로 열었으며 실제 데이터를 저장하지 않았다. 모의 transport에는 고정 집계와 부분 PATCH 응답이 있어, 실제 서버의 Undo 복원·집계 정합성은 E2E 완료로 판정하지 않았다.
6. 임시 복사본에 새 파일을 더한 뒤 Metro가 이전 모듈을 사용하는 경우가 있어 서버를 `--clear`로 재시작하고 보완 화면을 다시 캡처했다. 월간 초기 전환 중간 프레임도 폐기하고 실제 M 선택·영어 날짜/선택 상태 확인 뒤 최종 6.3인치 월간을 재캡처했다. 생성기 README에 이 확인을 기록했다.
7. Expo Go의 앱별 OS 언어 목록은 Nodii의 standalone 바이너리를 대신하지 않는다. `.lproj` 생성 확인과 실제 TestFlight 설정 앱 선택은 구분했다.

## 5. iOS 번들 확인

`ios.infoPlist`에 development region en·localizations [en, ko], `expo.locales`에 두 JSON을 연결했다. `npx expo config --type introspect --json`에서 합쳐진 두 키를 확인했다. 임시 폴더 `/private/tmp/nodii-i5-prebuild`에서 `npx expo prebuild --platform ios --no-install`이 성공했다. `ios/Nodii/Supporting/en.lproj/InfoPlist.strings`와 `ko.lproj/InfoPlist.strings`에 Nodii 이름과 권한 설명 두 개가 생겼다. 저장소에 ios 폴더를 남기지 않았다. 서명 바이너리·App Store Languages 표시는 아직 확인하지 않았다.

## 6. 영어 스토어 자료

모두 git 제외 `store-assets/screenshots-v2/`에 있다. `store-text.en.md`의 iOS 설명 **1,793/4,000**, 키워드 **83/100**, 프로모션 **141/170**, 새로운 기능 **329** Unicode 글자다. I4 `generator/store-copy.mjs`를 확장해 세었다. 공유 이름 `Nodii: Todos & Routines`(23/30), 부제 `Goals, Habits & Daily Planner`(29/30)는 iOS에도 맞는다. 현재 macOS 설명을 유지하고 iOS 영어 출시 **후** 교체할 문장(99자)을 별도 수정안으로 남겼다.

스크린샷 생성 **전에 한국어 12장을 각각 이미지로 열었다.** `generator-ios/reference-pixels.json`에 각 PNG의 픽셀 좌표·바탕색·제목 영역의 강조색/픽셀 수·프레임 위치·상태 막대·2줄 제목/1줄 부제를 기록했다. 두 크기 모두 장별 색은 아래와 같다. 라이트 프레임은 1320 기준 x86~1233/y693, 1206 기준 x79~1126/y634, 다크는 각각 x85~1234/y692와 x78~1127/y633이다. 4개 새싹·중앙 제목/부제·하단 밖으로 이어지는 기기 프레임·9:41을 유지했다.

| 번호/크기 | 영어 제목(슬래시가 줄바꿈) | 바탕색 | 강조색 |
| --- | --- | --- | --- |
| 01 / 1320×2868 | Make room for / every goal | #F2EAFF | #7F4DD1 |
| 02 / 1320×2868 | Your progress, / in full color | #FFE6F0 | #B83069 |
| 03 / 1320×2868 | Set a routine. / Let it repeat. | #E0F3F5 | #107883 |
| 04 / 1320×2868 | Swipe to finish. / Hold for more. | #E8EEFF | #4062C5 |
| 05 / 1320×2868 | Unfinished todos? / Bring them to today. | #FCEDDE | #A65607 |
| 06 / 1320×2868 | Your day, / in sync with Mac. | #0F1013 | #9B5CFF |
| 01 / 1206×2622 | Make room for / every goal | #F2EAFF | #7F4DD1 |
| 02 / 1206×2622 | Your progress, / in full color | #FFE6F0 | #B83069 |
| 03 / 1206×2622 | Set a routine. / Let it repeat. | #E0F3F5 | #107883 |
| 04 / 1206×2622 | Swipe to finish. / Hold for more. | #E8EEFF | #4062C5 |
| 05 / 1206×2622 | Unfinished todos? / Bring them to today. | #FCEDDE | #A65607 |
| 06 / 1206×2622 | Your day, / in sync with Mac. | #0F1013 | #9B5CFF |

최종 PNG 12장의 크기·바탕색·강조색 픽셀·제목 구성·외부 요청 0건은 `generator-ios/screenshot-checks.json`과 `final-png-checks.json`에 기록했다. 12장 모두 실제 모서리 RGB가 기준과 같고, 불투명·제목 2줄·부제 1줄·장별 강조색 픽셀을 확인했다. 최종 PNG도 각각 이미지로 열어 검수했다. 재현 절차는 같은 폴더 README에 있다.

## 7. 검증과 완료 기준

| 완료 기준 | 결과/증거 |
| --- | --- |
| lint·format:check·typecheck·test | 최종 필수4종 통과. 총 **698검사**: core167, i18n34, api82, desktop157, mobile Vitest148 + Jest110 |
| 모바일 production 한국어 리터럴/ko-KR 0 | TypeScript AST로 79파일 검사: 각각 **0개**. ESLint error 규칙도 통과 |
| English 전 화면·pseudo·큰 글자 | 위 기기/조합의 네이티브 샘플 화면 검수 및 수정 완료. 사용자 데이터·자기 언어 이름·OS 키보드를 제외한 미번역 한국어 없음. 실제 서버 정합성/음성의 미완료 범위는 §3/§8에 구분 |
| 즉시 전환·재실행 후 유지 | 실제 Stack/설정/저장소/기존 토스트·시트 네이티브 자동 검사 통과. 열린 시뮬레이터 설정의 한국어↔English 전환 확인. 잠금 해제 후 종료/재실행 실제 UI에서도 저장값 복원을 확인. standalone TestFlight의 OS 앱별 언어는 §7.1에 남김 |
| iOS 언어 선언·현지화 폴더 | introspect와 임시 prebuild 성공, en/ko `.lproj` 및 권한 설명 확인 |
| 보고 필수 항목 | 다시 그리기·메모19곳·문장 연결·공유 함수·화면/수정/한계·영어 표기·번들·스토어 글자 수·12장 제목/색·결정/사람 항목을 §1~§8에 기록 |

실행 명령: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`; 각 단계의 모바일 typecheck·Vitest/Jest, 공유 변경 시 i18n·데스크톱 검사도 실행했다. 레이아웃 보완 후 전체 검증에서는 달력 높이를 auto로 바꾼 변경이 기존 한국어 높이66 검사 2개를 실패시켰다. **기대값은 고치지 않고** 한국어/기본 높이를 복원해 영어 확대에서만 내용 높이를 허용한 뒤 전체를 통과시켰다. 로컬 생성기 역시 root lint 대상이므로 Node/browser 전역·미사용 import를 고쳤다. 촬영 작업과 병행한 전체 테스트에서 기존 데스크톱 AppGate/UserCache 검사가 각각 5초 시간 초과했다. AppGate 13개 단독 재실행은 통과했다. 최종 전체 실행은 촬영 서버·시뮬레이터 종료 후 다시 수행했고, 테스트 제한 시간이나 한국어 기대값은 고치지 않았다.

추가: `EXPO_NO_DOTENV=1 EXPO_PUBLIC_PSEUDO_LOCALE=1 npx expo export --platform ios --output-dir /private/tmp/nodii-i5-export` 성공. JS/에셋 export이며 서명·설치 빌드가 아니다. production pseudo 비활성의 근거는 `__DEV__`와 명시 플래그의 AND 조건 및 네 조합 검사다.

건너뜀: DB 변경이 없어 `pnpm db:reset`, `pnpm db:test`, `pnpm db:types`는 실행하지 않았다. EAS/서명 빌드·제출·원격 CI·실기기 TestFlight·실제 메일/가입·VoiceOver 음성은 수행하지 않았고 통과로 적지 않았다. 기존 React Native act/환경 진단 경고·NO_COLOR 경고는 실패와 구분했다.

## 8. 결정 사항과 사람이 할 일

- **앱 미리보기 영상**: 지시서 기본안대로 만들지 않았다. 영어 현지화에는 스크린샷만 사용한다.
- **표시 버전**: 현재 macOS 0.1.3 / iOS 0.1.0은 그대로다. 런북 §3의 같은 표시 번호 정책과 I4 제안에 맞춰 공동 **0.2.0**을 제안한다. 확정·버전 올리기는 사람이 한다. 플랫폼별 빌드 번호는 별도다.
- 런북 **§7.1/§7**: 새 네이티브 TestFlight 빌드의 실제 iPhone에서 OS 앱별 언어, 앱 내 전환·종료 후 복원·system 우선순위, 큰 글자·VoiceOver 음성·실제 제스처/연속 입력, 영어 신규 가입 Todos 및 한국어 할 일·실제 병기 메일을 확인한다. 캡처용 샘플 transport는 이 검증을 대신하지 않는다.
- 런북 **§4.3/§4.4**: 영어 문구·12장 사람이 검수 → English (U.S.) 버전 메타데이터 입력 → 사람이 빌드·제출·출시. **iOS 영어 빌드 출시 뒤에만** 앱 정보의 Primary Language를 English로 바꾸고, 먼저 한국어 현지화 완전성을 확인한다. 이어 macOS 영어 설명의 iPhone 문장을 수정한다.
- 런북 **§8**: 새 바이너리의 언어 목록·권한 요청/폰트·설치 크기 및 실제 기기 성능을 확인한다.
- 이번 단계에서는 App Store Connect 입력/기본 언어 변경/버전 변경/EAS 빌드·제출/push/DB·서버 변경/영상 제작/site 변경을 하지 않았다.
