# I3 · 영어 카탈로그 결과

2026-10-29 · 브랜치 `feat/i18n-i3-english` · 기준 `docs/codex/stage-i3-english-catalog.md`

## 한 일 (SET-06 · ROUT-10)

- 깨끗한 `main` **3aa3d91**(PR #40, I2 병합)에서 시작했습니다. I2 마지막 커밋 `e73d460`이 main의 조상임을 확인했습니다. push하지 않았습니다.
- `catalog.en.ts`의 **기본 493키 전체 + `_one` 8키**를 채웠습니다. 기본 키 순서와 구역 주석은 한국어와 같습니다. 완전성 타입은 `Record<MessageKey, string> & Partial<Record<PluralKey, string>>`입니다. `t(key, params)`와 한국어 대체 안전장치는 유지했습니다.
- 번역 전에 데스크톱·모바일에서 키의 직접 호출, 동적 키, `messageKey`·`labelKey`·`nameKey`의 사용처를 찾아 버튼·제목·설명·접근성 이름을 구분했습니다. 현재 사용처가 없는 `mobile.spike.*`는 기존 카탈로그의 개발 진단 문맥을 따랐습니다.
- 미국 영어, 축약형, Title Case/sentence case, 원문의 마침표·따옴표·가운뎃점·한 글자 줄임표를 적용했습니다. macOS 메뉴는 `About Nodii`, `Settings…`, `Hide Others`, `Zoom`, `Bring All to Front` 등을 사용했습니다.
- 숫자 `count`만 기존 복수형 장치를 사용합니다. 단수 키는 기본 키 바로 위에 두었습니다. 여러 숫자는 `Todos {todos} · Routines {routines}` 또는 괄호 안 개수로 표현했습니다. `{particle}`은 영어에서 제거했습니다.
- `formatList(items, locale?)`·`ordinal(n, locale?)`을 추가하고 데스크톱 `formatRoutineRule`에 연결했습니다. 한국어는 가운뎃점·숫자를 유지하며, 영어는 `Intl.ListFormat`과 ordinal `Intl.PluralRules`를 사용합니다. 요일의 주 시작 순서와 일자 중복 제거·정렬도 유지했습니다. 기존 `.trim()`은 선택 요일이 없는 방어 경로의 마지막 공백을 없애기 위해 남겼습니다.
- `pseudoLocalize`는 영문자를 악센트 문자로 치환하고 영문자 수의 약 40%만큼 패딩을 추가한 뒤 대괄호로 감쌉니다. `{param}`을 보존하고 **값 치환 전에** 적용하므로 사용자 이름·이메일·개수는 변형하지 않습니다. 한국어는 변형하지 않습니다.
- 설정의 버전 조회는 번역 문자열 대신 대기/실패 상태와 버전 값만 저장합니다. 열린 설정에서 언어를 바꿀 때 대기·실패 문구도 즉시 바뀌도록 했으며 두 상태의 회귀 테스트를 추가했습니다. 한국어 출력은 그대로입니다.
- 한국어 카탈로그는 **파일 변경 0개**입니다. 모바일·core·api·DB·Tauri 설정·App Store 메타데이터·인증 메일도 변경하지 않았습니다. 새 의존성·토큰·HEX·폰트·Tauri 플러그인은 없습니다.

## 커밋 순서

지시서가 허용한 완전성 검사 후순위를 선택했습니다. 임시 번역·skip 테스트·실패하는 중간 커밋을 만들지 않았습니다.

1. 목록·서수 헬퍼, 데스크톱 규칙 요약, 헬퍼 테스트
2. 번역 6묶음: auth/app/menu → day/todo/calendar/date → goal → routine → settings/sync/common → mobile
3. 카탈로그 완전성 타입 + 카탈로그 검사 + 실제 영어 규칙 요약 스냅숏
4. pseudo + 개발 빌드 연결 + 프로덕션 비활성 테스트
5. 레이아웃 3묶음: 목표/보관함/목표 삭제 → 루틴 → 설정(버전 조회 상태 문구 포함)
6. 용어집·진행 기록·이 보고서

최종 검토에서 고친 번역과 레이아웃은 해당 영역 커밋에 합쳤습니다. 커밋 메시지는 영어 Conventional Commits이며 AI 작성자 표시는 없습니다. 이미지·스크린샷·`docs/codex/`는 커밋하지 않았습니다.

기존 테스트 변경은 두 곳입니다. `locale.test.ts`의 대체 문구 검사는 부분 영어 카탈로그를 주입하도록 바꿔 **기존 한국어 기대값을 그대로** 유지했습니다. `SettingsLanguage.test.tsx`는 테마와 언어에 각각 생긴 `System`을 구분하도록 언어 radiogroup 안에서 조회하고, 영어 시트의 잔존 한글 검사를 추가했습니다. 기존 한국어 기대값은 수정하지 않았습니다.

## 새로 정한 용어

전체 확정 표는 계획 §4에 반영했습니다.

| 한국어 | 영어 | 선택 이유 |
| --- | --- | --- |
| 목표 관리 / 루틴 관리 | Manage Goals / Manage Routines | 동작을 드러내는 관리 화면 이름 |
| 완료하기 / 완료 취소 | Mark as Done / Mark as Unfinished | 확인 창의 Done과 체크 동작을 구분 |
| 완료 기록 | completion records | 상태 이름 done과 기록 명사를 구분 |
| 끝난 루틴 | ended routines | 완료 체크가 아니라 종료된 반복임을 표현 |
| 순서 바꾸기 | Reorder | 드래그·키보드 순서 변경에 공통 사용 |
| 이름 수정 / 일반 수정 | Rename / Edit | 할 일 제목 변경과 일반 편집의 문맥 차이 |
| 날짜 선택 | Choose Date | 달력에서 날짜를 고르는 동작 |
| 반복 간격 | repeat interval | `day interval` / `week interval` / `month interval` |
| 자동 | Automatic | 기존 모바일 원문의 “시스템”과 구분 |
| 다시 확인 | Check Again | 다시 시도 Try Again과 원문 차이 유지 |

## 검수 필요

다음은 선택한 번역을 구현에 반영했지만 사람이 자연스러움·의미를 확인할 후보입니다. 모바일 실제 화면은 I5에서 확인합니다.

| 키 | 한국어 | 영어 | 고민한 점 |
| --- | --- | --- | --- |
| `auth.title` | Nodii 시작하기 | Get Started with Nodii | 신규 가입과 기존 로그인 모두 포함하는 제목의 자연스러움 |
| `day.menu.import` | 지난 미완료 할 일 {count}개 가져오기 | Bring Over {count} Unfinished Todos | 용어집의 Bring Over를 따름. “지난”이라는 범위가 첫 사용에 충분히 이해되는지 |
| `routine.endToday` | 오늘부터 그만하기 | Stop from Today | 오늘도 표시에서 제외하는 종료를 짧게 전달하는지 |
| `routine.scope.title` | 반복 규칙을 바꿨어요. 어디부터 적용할까요? | Where Should the New Repeat Rule Apply? | 변경 사실을 new rule로 압축한 대화상자 제목 |
| `routine.scope.all` | 과거 날짜까지 모두 | All Dates, Including the Past | 짧은 대안보다 과거 포함 의미를 우선했음 |
| `routine.partialSplit.retry` | 규칙은 바뀌었지만 종료일을 저장하지 못했어요. 다시 시도로 종료일만 저장할 수 있어요. | The rule has changed, but we couldn't save the end date. Try again to save only the end date. | 부분 성공의 의미와 재시도 범위가 분명한지 |
| `routine.ended` | 끝난 루틴 {count}개 | {count} ended routines | stopped보다 end date 종료까지 포괄하는 ended를 선택 |
| `routine.scope.legend` | 끝냄: 완료 기록 · 기록 없음: 지난 미완료 · 예정: 앞으로 할 루틴 | Done: completion record · No record: past unfinished routine · Planned: upcoming routine | 짧은 범례에서 past unfinished routine 표현의 이해도 |
| `goal.reorder.position` | {position}번째로 옮기기 · {name} | Move to position {position} · {name} | 모바일 숫자 순서 접근성 안내를 서수 대신 position으로 표현 |
| `mobile.guide.hold` | 줄을 길게 눌러 보세요 | Touch and hold a row | 모바일 제스처 용어·톤은 실제 iOS에서 검수 필요 |
| `mobile.spike.core` | 공유 코드 · {date} · 반복 {occurs} | Shared code · {date} · Repeat {occurs} | 현재 사용처 없는 M0 진단 문구, 표시/숨김은 Visible/Hidden으로 번역 |

## 레이아웃 수정 목록

모든 추가 CSS는 **`html[lang='en']`로 제한**했습니다. 영어에는 줄바꿈을 허용하고 고정 폭·토큰 값은 늘리지 않았습니다.

| 화면 | 원인 | 조치 |
| --- | --- | --- |
| 목표 관리 머리글 | 400px pseudo에서 제목과 동작 합계가 가로폭 초과 | 머리글·동작 묶음 flex-wrap, 동작 오른쪽 정렬 |
| 목표 관리 행 | 확장된 편집/보관 버튼 때문에 목표 이름이 좁아져 단어가 분절됨 | 좁은 영어 창에서 이름/개수와 동작을 각각 한 줄로 배치 |
| 목표 편집·보관함 설명 | 확장 패딩과 긴 단어가 설명 폭 초과 | min-width: 0 / overflow-wrap: anywhere |
| 목표 삭제 | 개수가 로딩된 긴 설명의 pseudo 패딩이 숨겨짐 | 설명 단락 overflow-wrap: anywhere |
| 보관함 머리글 | 세 열 grid에서 뒤로 버튼·제목·완료가 겹침 | 영어에서 flex-wrap으로 필요한 만큼 줄바꿈 |
| 루틴 반복 세그먼트 | 400px pseudo의 Every day가 버튼 폭 초과 | white-space: normal, height: auto, 단어 줄바꿈. 공유 요약 키 Every day는 유지하고 **보이는 세그먼트만 CSS capitalize**로 Title Case |
| 루틴 적용 범위 | 7열 셀의 No record/Planned와 pseudo가 이웃 칸 침범 | 상태 span max-width: 100% / overflow-wrap: anywhere |
| 설정 머리글 | 가운데 제목과 오른쪽 완료 버튼이 pseudo에서 겹침 | 영어에서 빈 보조 칸 제거, flex-wrap으로 제목·동작 배치 |

발견한 웹 문구의 잘림·겹침은 수정했습니다. 남은 제약은 **OS가 그리는 날짜 입력의 언어**입니다. Chrome의 빈 네이티브 date 입력은 영어 html/lang·브라우저 locale에서도 OS 한국어 자리표시자(연도·월·일)를 보였습니다. 이 문구는 카탈로그나 DOM 텍스트가 아니며, 이번 단계에서 날짜 입력을 새로 구현하지 않았습니다. 실제 Tauri/WKWebView에서 OS 언어·앱 언어 조합을 수동 확인해야 합니다. 실제 네이티브 메뉴·VoiceOver도 미검증입니다.

한국어는 레이아웃 수정 전후 동일한 모의 데이터로 비교했습니다. 비교 가능한 40장 중 **27장은 픽셀까지 동일**했습니다. 나머지 13장은 포커스 링·메뉴 강조·로딩 시점 차이가 있어 픽셀 동일을 주장하지 않습니다. 한국어 CSS를 변경하지 않았고 기존 한국어 테스트·카탈로그 값은 보존했습니다. 실제 Tauri에서 I2와 최종 비교는 사람 확인 항목입니다.

## pseudo 켜기와 프로덕션 비활성 근거

```bash
VITE_PSEUDO_LOCALE=1 pnpm dev:web
```

개발 서버를 재시작하고 언어를 English로 고릅니다. 한국어 선택에서는 변형하지 않습니다. 실제 Tauri 개발 실행도 같은 플래그로 `pnpm dev`를 시작하면 됩니다.

데스크톱 진입점이 렌더 전에 `configurePseudoLocale()`을 호출하며 조건은 아래와 같습니다.

```ts
import.meta.env.DEV && import.meta.env.VITE_PSEUDO_LOCALE === '1'
```

Vite 프로덕션 빌드에서는 DEV가 false이므로 플래그가 1이어도 항상 꺼집니다. DEV/플래그 4조합 테스트가 통과했습니다. **`VITE_PSEUDO_LOCALE=1 pnpm build:web`**로 빌드한 결과를 `vite preview`에서 열었을 때 실제 제목이 **Get Started with Nodii**로 표시되어 pseudo가 꺼진 것을 확인했습니다. 새 설정 항목·정식 pseudo 언어·모바일 초기화는 추가하지 않았습니다.

## 화면 점검 범위와 결과

실제 앱 진입점의 Vite 브라우저 미리보기를 Chrome/Playwright로 순회했습니다. **1120×740 / 400×740**, 영어·pseudo·한국어, 모의 Auth/REST 응답을 사용했습니다. 실제 Supabase 데이터에 쓰지 않았습니다. 개발 서버와 임시 캡처/검사 스크립트는 검증 용도이며 저장소에 추가하지 않았습니다.

- 로그인 이메일·코드·긴 이메일·리뷰 계정, 업데이트 안내, 연결 설정 안내
- 툴바, 하루 머리글, 할 일·루틴 행과 메뉴, 추가 입력, 날짜 선택, 하루 메뉴·일괄 삭제, 삭제·실행 취소 토스트
- 월간 캘린더·요일·도장, 400px 주간 스트립
- 목표 관리·추가·편집·삭제·보관함·프리셋 접근성 이름
- 루틴 관리·편집·간격·요일/일자·세 종류 규칙 요약·적용 범위 상단/하단·종료 확인
- 설정 상단·스크롤 하단·테마/언어·계정 삭제(개수 로딩 후), 메인 다크 모드

영어·pseudo·한국어 **168캡처** 순회를 수행했고, 이후 영어·pseudo **116캡처**에서 적용 범위 상단·개수 로딩 후 설명을 추가 확인했습니다. 그 검사에서 발견한 보관함 머리글 겹침/긴 삭제 설명을 고친 뒤 해당 영역 **12캡처**를 다시 확인해 오류·가로 넘침 0건을 확인했습니다. 스크린샷을 직접 열어 겹침도 확인했습니다. OTP의 의도된 숨은 입력과 sr-only 라벨은 가로 넘침 집계에서 제외했습니다.

브라우저 DOM 화면 텍스트의 한글은 언어 이름 **한국어** 외 0건입니다. 사용자 데이터와 OS 네이티브 날짜 입력은 이 결과에 포함하지 않습니다. 네이티브 메뉴와 실제 인증/동기화 서버의 end-to-end 검증으로 간주하지 않습니다.

## 완료 기준 점검

| 지시서 항목 | 결과 |
| --- | --- |
| lint·format:check·typecheck·test, 모바일 포함 | 통과, 총 674개 |
| 영어 전체 키·키/자리표시자 동등성·조사 제거·한글 잔존·이메일 1회 | 통과, 493기본 + 8단수 |
| 복수형·여러 개수 문장·세 종류 규칙 요약 대표 스냅숏 | 통과 |
| English 전 화면의 앱 문구 | 위 브라우저 순회에서 확인. 네이티브 메뉴/OS 날짜 입력은 수동 확인 필요 |
| pseudo에서 읽을 수 없는 잘림 없음 | 발견한 웹 문구 문제 수정 후 확인. 실제 WKWebView는 미검증 |
| 용어·검수 필요·레이아웃·pseudo/프로덕션·I5·실행/미실행 검증 기록 | 이 보고서 및 계획 §4에 반영 |

## 실행한 검증

기존 로컬 pnpm **10.28.0**을 `/private/tmp/nodii-i2-bin` PATH로 사용했습니다. 다운로드·설치는 하지 않았습니다.

| 명령 또는 검사 | 결과 |
| --- | --- |
| 각 커밋 전 변경 패키지 typecheck·관련 Vitest 및 변경 파일 ESLint/Prettier | 통과 |
| `pnpm lint` | 전체 통과, 데스크톱 한글 리터럴 오류 규칙 유지 |
| `pnpm format:check` | 전체 통과 |
| `pnpm typecheck` | 모바일 포함 전체 통과 |
| `pnpm test` | **674개 통과**: core167 · i18n33 · api80 · desktop152 · mobile Vitest137 · Jest/RNTL105(12스위트) |
| `VITE_PSEUDO_LOCALE=1 pnpm build:web` | 통과, 기존 500kB 청크 경고 유지 |
| 위 프로덕션 결과의 실제 브라우저 실행 | 영어 제목·pseudo 비활성 확인, 외부 요청 차단 |
| 영어/pseudo/한국어 브라우저 순회 | 위 점검 범위 참조, 마지막 수정 영역 12캡처 모두 오류/넘침 없음 |
| `git diff main`의 한국어 카탈로그·mobile/core/api/DB/Tauri 설정 | 변경 없음 |
| `git diff --check` | 통과 |

초기 선택자 `vitest run src/features/goals`는 해당 경로에 테스트가 없어 실패했습니다. 실제 목표 통합 검사가 있는 `DayView.test.tsx` 29개를 실행해 통과했습니다. 설정의 중복 System 조회와 추가한 테스트 옵션의 타입 오류는 수정 후 통과했습니다. 기존 모바일 act/GoTrueClient 진단과 웹 청크 경고는 남아 있습니다.

## 건너뛴 검증과 사람이 확인할 것

- **문구 검수:** 한국어/영어 카탈로그를 나란히 보고 위 검수 필요 표부터 확인합니다. English로 로그인 → 추가·완료·옮기기·삭제 → 하루 메뉴 → 캘린더 → 목표 → 루틴 → 설정을 실제 사용하며 자연스러움을 확인합니다.
- **실제 Tauri:** 네이티브 메뉴·단축키, OS 언어 한국어/영어와 앱 언어 조합, WKWebView의 date 입력 자리표시자·선택 UI, VoiceOver, 최소 400×600 창을 확인합니다. 이번 자동 순회는 높이 740px이며 최소 높이 600px의 실기기 순회는 수행하지 않았습니다.
- **한국어:** 실제 Tauri에서 I2의 한국어 화면과 최종 비교합니다. 카탈로그·기존 한국어 기대값 보존은 자동 검증했습니다.
- **DB:** `pnpm db:reset`·`pnpm db:test`·`pnpm db:types`는 DB·API·스키마 변경이 없어 미실행했습니다.
- **출시:** 서명 App Store 빌드·실제 인증 메일·스토어 메타데이터는 I4 범위로 미실행했습니다. 원격 CI는 push하지 않아 미실행입니다.
- **iOS:** 앱 실행·export·실기기 언어 전환은 I5 범위로 미실행했습니다. 기존 모바일 테스트는 그대로 통과했습니다.

## I5에 남긴 모바일 항목

1. `src/features/routines/model.ts`의 `ruleLabel`은 매월 키 + 숫자 + `routine.dayUnit` 이어 붙이기를 유지합니다. 영어에는 서수·접속사가 없고 순서도 맞지 않습니다. `formatList`·`ordinal`을 사용하는 전체 문장 키로 전환해야 합니다. 고정 한국어 `weekdays` 배열도 현재 로케일 요일 헬퍼로 교체해야 합니다.
2. `'ko-KR'`는 **8파일·9호출** 그대로입니다: `Today.tsx`, `today/InlineAdd.tsx`, `today/DayCell.tsx`(2호출), `today/DatePickSheet.tsx`, `today/MonthGrid.tsx`, `today/calendar-model.ts`, `goals/Goals.tsx`, `routines/model.ts`.
3. 모바일의 OS 언어 감지·기기 저장·실행 중 로케일 구독·언어 설정을 연결해야 합니다. 이번에는 공유 영어 카탈로그만 완성했고 모바일 초기 로케일은 기존대로입니다.
4. 공유 키를 이어 붙이는 접근성 이름/루틴 날짜, 모달 제목과 접근성 라벨의 대소문자, 긴 버튼·큰 글자·VoiceOver·실제 iOS 날짜 UI를 검수해야 합니다. I3의 pseudo는 데스크톱 개발 진입점에서만 켭니다.

## 결정이 필요한 사항 / 문서 차이

- 앱 자체 영어 문구 구현에 남은 제품 결정은 없습니다. 검수 후보는 위 표에 모았습니다.
- 원문에 있는 “자동”은 Automatic, “시스템”은 System으로 구분했습니다. 요약과 세그먼트가 공유하는 `routine.daily`는 지시서의 **Every day**를 유지하고 세그먼트의 시각적 Title Case만 CSS로 적용했습니다.
- 한국어 화면 보존을 위해 레이아웃 보강을 영어에만 제한했습니다. OS 네이티브 date 입력까지 앱 설정 언어를 강제할 필요가 있다면 실제 WKWebView 확인 후 별도 결정이 필요합니다. 이번 단계에서 새 날짜 선택 컴포넌트나 플러그인은 도입하지 않았습니다.
- 새 의존성·토큰·HEX·폰트·DB 변경은 없습니다. I2에서 남긴 OS 언어 감지/서명 빌드 수동 확인을 이번 브라우저 검사로 완료 처리하지 않았습니다.
