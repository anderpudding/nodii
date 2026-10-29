# I1 · 데스크톱 문구 추출 결과

2026-10-28 · 브랜치 `feat/i18n-i1-desktop-strings` · 기준 `docs/codex/stage-i1-desktop-strings.md`

## 한 일

- SET-06: 화면 문구·접근성 이름·토스트·오류·네이티브 메뉴를 `@nodii/i18n`으로 추출했습니다. 공용·앱 셸, 메뉴, 인증, 하루 목록·캘린더, 목표, 루틴, 설정 순서로 영역마다 커밋했습니다.
- 계획 문서는 첫 커밋 `1abf849`에 해당 파일만 기록했습니다. 패키지 연결·경고 수준 린트·영역별 추출·카탈로그 테스트·기록은 각각 별도 커밋이며 push하지 않았습니다.
- 고유 키 기준 **새 키 196개**, **기존 키 138개 재사용**입니다. 기준 main 카탈로그 298개 → 494개이며, 데스크톱이 참조하는 키는 334개입니다. 반복 호출 횟수는 세지 않았습니다. 새 키에 미사용 항목이 없고, 기존 298개 키의 이름과 값은 그대로입니다.
- `common.done`의 “완료”는 시트 닫기, `date.weekday.short.0`의 “일”은 일요일을 뜻합니다. 기존 할 일 완료 동작·날짜 단위의 같은 글자와 의미가 달라 별도 키를 유지했습니다.
- 날짜 요일은 `date.weekday.short.0`~`6`과 `weekdayShort()`로 조회합니다. 프리셋은 `nameKey`, 외부 링크는 `labelKey`, 루틴 검증 맵은 `messageKey`를 보관합니다. 모듈 최상위 `t()` 호출은 0개입니다.
- 로그인 설명은 기존 `auth.code.description`의 `{email}` 자리를 기준으로 렌더하여 이메일의 굵은 표시와 문장 전체 키를 함께 유지했습니다. 루틴 규칙 요약도 요일·날짜 묶음을 문장 전체의 자리표시자에 넣습니다.
- 기존 데스크톱 테스트 파일 23개의 한국어 기대값은 수정하지 않았습니다. 빈 문구·자리표시자 형식·대표 문장 치환 검사를 i18n에 9개 추가했습니다.

## 업데이트 안내 후속 수정 (SET-06)

I1 추출에서 데스크톱 원문의 마침표를 놓쳐 `mobile.update.title`을 재사용했습니다. `app.update.instruction`에 **“App Store에서 업데이트해 주세요.”**를 그대로 넣어 복원했으며, 모바일 키 이름과 값은 변경하지 않았습니다. 새 `UpdateRequired.test.tsx`의 렌더 검사 1개가 수정 전에 실패하고 수정 후 통과했습니다. 기존 테스트의 한국어 기대값은 변경하지 않았습니다.

후속 수정으로 새 키는 195→196개, 데스크톱이 재사용하는 기존 키는 139→138개, 통일 후보는 68→69행입니다. 최초 I1 검증 결과는 아래에 그대로 두고, 후속 검증은 진행 기록에 추가합니다. 후속 `pnpm lint`·`pnpm format:check`·`pnpm typecheck`·`pnpm test`는 모두 통과했으며, 전체 **632개**(desktop129·기존 다른 패키지503개)입니다. 현재 AST 검사에서도 새196개 모두 사용·한국어 리터럴0개·기존 키 값 보존을 확인했습니다. 새 의존성과 추가 결정 사항은 없습니다. DB 변경이 없어 DB 검증은 미실행했고, 실제 Tauri 화면·웹 빌드·원격 CI는 이번 후속 수정에서 재실행하지 않았습니다.

## 한국어 리터럴 린트

`eslint.config.js`의 `no-restricted-syntax`에 아래 esquery 선택자를 넣었습니다. 별도 플러그인이나 검사 스크립트 의존성은 추가하지 않았습니다.

- `Literal[value=/[가-힣]/]`
- `TemplateElement[value.raw=/[가-힣]/]`
- `JSXText[value=/[가-힣]/]`

대상은 `apps/desktop/src/**/*.{ts,tsx}`이며 `**/*.test.*`와 `apps/desktop/src/test/**`는 제외합니다. 최초 규칙 커밋에서는 `warn`, 설정 추출을 마친 커밋에서는 `error`로 올렸습니다. 주석은 AST 문자열 노드가 아니므로 차단하지 않습니다.

실제 ESLint API에 한국어 문자열·템플릿·JSX 텍스트를 넣어 오류 3개를 확인했습니다. 같은 코드를 테스트 파일과 `src/test` 경로에 넣었을 때 해당 오류는 0개였으며, 한국어 주석과 영어 JSX는 허용됐습니다. 독립적인 TypeScript AST 검사에서도 대상 한국어 문자열/템플릿/JSX 노드는 0개였습니다. 임시 검증 파일은 저장소에 남기지 않았습니다.

## 실행한 검증

| 명령 또는 검사 | 결과 |
| --- | --- |
| `pnpm install --offline --store-dir /Users/anderpudding/Library/pnpm/store/v10` | 기존 pnpm 10.28.0 캐시로 workspace 연결·lockfile 갱신, 다운로드 없음 |
| 데스크톱 임시 import 검사·`typecheck`·Vitest·Vite 빌드 | workspace import 확인, 임시 테스트 제거 |
| 영역별 변경 파일 lint·Prettier·desktop/i18n typecheck·test | 각 커밋 전 통과, 데스크톱 128개 기대값 유지 |
| `pnpm lint` | 통과, 한국어 리터럴은 오류 수준 |
| `pnpm format:check` | 통과 |
| `pnpm typecheck` | 모바일 포함 전체 통과 |
| `pnpm test` | **631개 통과**: core167·i18n14·api80·desktop128·mobile Vitest137·Jest/RNTL105(12스위트) |
| `pnpm build:web` | 실제 앱 진입점으로 통과 |
| ESLint 양성·음성·제외 경로 검사 | 통과 |
| 기존 키 이름·값 보존 / 새 키 사용 / 최상위 `t()` / 잔존 한국어 AST | 기존298개 보존 / 새195개 모두 사용 / 0개 / 0개 |
| `git diff main`의 기존 desktop 테스트·mobile·core·api | 변경 없음 |

명령은 로컬의 기존 pnpm 10.28.0을 임시 PATH로 지정해 실행했습니다. 기존 모바일 비동기 `act`·GoTrueClient 진단 및 웹 빌드의 청크 크기 경고는 남아 있습니다.

## 건너뛴 검증과 사람이 확인할 것

- `pnpm db:reset`, `pnpm db:test`, `pnpm db:types`: DB·스키마·API 변경이 없어 미실행했습니다.
- `pnpm dev` 실제 Tauri 화면/메뉴바 수동 순회: 미실행했습니다. 로그인 → 오늘 목록 → 할 일/하루 메뉴 → 캘린더 → 목표/보관함/프리셋 → 루틴 편집/범위/종료 → 설정의 문구와 macOS 메뉴바를 확인해야 합니다.
- iOS export·실기기·언어 전환·영어 화면 검증: 이번 단계 범위에 없어 미실행했습니다. I2·I3 구현도 하지 않았습니다.
- 원격 CI: push하지 않았으므로 미실행했습니다.

## 의존성과 문서 차이

- 데스크톱에 기존 내부 패키지 `@nodii/i18n: workspace:*`만 추가했습니다. 문구 카탈로그를 공유하기 위한 연결이며 새 외부 라이브러리는 없습니다.
- 조사 문서의 “61개 파일”과 달리 작업 시작점의 AST에서 한국어 문자열·템플릿·JSX 텍스트가 있던 파일은 **38개**였습니다. 주석·테스트를 제외한 실제 노드를 기준으로 전수 검사했으며, 대상 누락 없이 이 38개와 새 요일 헬퍼를 변경했습니다.
- 기존 `'ko-KR'` 세 곳, `<html lang>`, 영어/복수형/언어 설정은 유지했습니다. 모바일·core·api·DB·Tauri 설정도 변경하지 않았습니다.
- 화면 문구를 통일하기 위한 제품 결정은 하지 않았습니다. 아래 후보는 추후 검토 자료이며, 정보량이나 접근성 용도가 다른 쌍은 그 차이도 확인해야 합니다.

## 통일 후보

모바일에서 쓰던 카탈로그 키와 데스크톱 원문을 보존한 새 키의 비교입니다. 아래 **69행**은 같은 키의 반복 호출을 뜻하지 않습니다. 두 문장으로 나뉜 보관함 빈 상태 등은 모바일의 한 키와 데스크톱의 여러 키가 대응합니다. 자리표시자·마침표·따옴표·문장 정보량을 포함해 원문을 유지했습니다.

| 모바일 키 | 모바일 문구 | 데스크톱 새 키 | 데스크톱 문구 |
| --- | --- | --- | --- |
| `goal.lastActive` | 활성 목표가 하나는 있어야 해요 | `goal.lastActive.required` | 활성 목표는 하나 이상 있어야 해요 |
| `goal.archived` | '{name}' 목표를 보관했어요 | `goal.archived.summary` | 목표를 보관했어요 |
| `goal.unarchived` | '{name}' 목표의 보관을 해제했어요 | `goal.unarchived.summary` | 목표 보관을 해제했어요 |
| `goal.hex.invalid` | #RRGGBB 형식으로 입력해 주세요 | `goal.hex.error` | #RRGGBB 형식으로 입력해 주세요. |
| `goal.preview` | 미리보기 | `goal.preview.label` | 목표 미리보기 |
| `goal.archive` | 보관 | `goal.archive.action` | 보관하기 |
| `goal.archive.description` | 새 할 일 목록에서 숨기고, 지난 기록은 그대로 남겨요 | `goal.archive.help` | 새 할 일 목록에서 숨기고, 지난 기록은 그대로 남겨요. |
| `goal.delete.title` | '{name}' 목표를 삭제할까요? | `goal.delete.confirm` | ‘{name}’ 목표를 삭제할까요? |
| `goal.counts.failed` | 개수를 불러오지 못했어요. 다시 시도해 주세요. | `goal.counts.error` | 개수를 불러오지 못했어요. |
| `goal.counts.loading` | 개수를 불러오고 있어요 | `goal.counts.checking` | 개수를 확인하고 있어요… |
| `goal.contents` | 할 일 {todos}개, 루틴 {routines}개 | `goal.counts.summary` | 할 일 {todos}개 · 루틴 {routines}개 |
| `goal.archived.empty` | 보관한 목표가 없어요. 목표 관리에서 보관하면 여기로 모여요. | `goal.archived.empty.title` | 보관한 목표가 없어요. |
| `goal.archived.empty` | 보관한 목표가 없어요. 목표 관리에서 보관하면 여기로 모여요. | `goal.archived.empty.description` | 목표 관리에서 보관하면 여기로 모여요. |
| `goal.failed` | 목표를 불러오지 못했어요. 다시 시도해 주세요. | `goal.failed.summary` | 목표를 불러오지 못했어요. |
| `goal.total` | 목표 {count}개 | `goal.reorder.help` | 목표 {count}개 · 드래그해서 순서를 바꿀 수 있어요 |
| `settings.theme.failed` | 테마 설정을 저장하거나 불러오지 못했어요. 다시 시도해 주세요. | `settings.theme.loadFailed` | 테마 설정을 불러오지 못했어요 |
| `settings.theme.failed` | 테마 설정을 저장하거나 불러오지 못했어요. 다시 시도해 주세요. | `settings.theme.saveFailed` | 테마를 저장하지 못했어요 |
| `settings.delete.understood` | 모든 기록이 사라지는 것을 이해했어요 | `settings.delete.acknowledge` | 되돌릴 수 없다는 걸 이해했어요 |
| `settings.logout.description` | 이 기기에 저장된 데이터도 함께 지워져요 | `settings.logout.device` | 이 맥에 저장된 데이터도 함께 지워져요. |
| `settings.theme.system` | 자동 | `settings.theme.os` | 시스템 |
| `settings.delete.summary` | 목표, 할 일, 루틴 기록을 모두 지워요 | `settings.delete.help` | 목표, 할 일, 루틴 기록을 모두 지우고 계정을 없애요. |
| `settings.link.failed` | 페이지를 열지 못했어요. 다시 시도해 주세요. | `settings.link.openFailed` | 링크를 열지 못했어요 |
| `settings.delete.counts` | 목표 {goals}개, 할 일 {todos}개, 루틴 {routines}개가 삭제돼요. | `settings.delete.contents` | 목표 {goals}개 · 할 일 {todos}개 · 루틴 {routines}개와 모든 완료 기록이 삭제돼요. |
| `sync.cache.clearFailed` | 보관된 데이터를 지우지 못했어요. 다시 시도해 주세요. | `sync.cache.clearDeviceFailed` | 이 기기의 캐시를 지우지 못했어요 |
| `mobile.today.loading` | 하루 목록을 불러오고 있어요. | `day.loading` | 하루 목록 불러오는 중 |
| `mobile.add.placeholder` | 무엇을 할까요? | `todo.add.placeholder` | 할 일을 적어 주세요 |
| `mobile.goal.add` | {name}에 할 일 추가 | `todo.add.label` | {name} 새 할 일 |
| `todo.deleted` | '{title}'{particle} 지웠어요 | `todo.deleted.summary` | 할 일을 삭제했어요 |
| `todo.complete` | {title} 완료하기 | `todo.completion.label` | {title} 완료 |
| `todo.title` | 할 일 제목 | `todo.rename.label` | 할 일 제목 수정 |
| `todo.moved` | '{title}'{particle} {date}로 옮겼어요 | `todo.moved.summary` | {date}로 옮겼어요 |
| `todo.action.rename` | 이름 수정 | `common.rename` | 수정 |
| `todo.action.move.menu` | 날짜 옮기기 | `todo.move.pick` | 날짜 선택 |
| `mobile.menu.open` | {title} 메뉴 열기 | `common.menuNamed` | {name} 메뉴 |
| `mobile.calendar.failed` | 달력을 불러오지 못했어요. | `calendar.failed` | 캘린더를 불러오지 못했어요. |
| `mobile.calendar.loading` | 달력을 불러오고 있어요. | `calendar.loading` | 캘린더를 불러오고 있어요. |
| `calendar.remaining` | {date}, {count}개 남음 | `calendar.remainingTodos` | {date}, 남은 할 일 {count}개 |
| `routine.weekdaySelect` | {day}요일 고르기 | `routine.weekday.label` | {day}요일 |
| `routine.monthdaySelect` | {day}일 고르기 | `routine.monthday.label` | {day}일 |
| `routine.invalid.repeat_every_invalid` | 간격은 1~365로 골라 주세요 | `routine.validation.repeatEvery` | 간격은 1부터 365까지 정수로 입력해 주세요. |
| `routine.invalid.weekday_required` | 요일을 하나 이상 골라 주세요 | `routine.validation.weekdayRequired` | 요일을 하나 이상 골라 주세요. |
| `routine.invalid.weekday_invalid` | 요일을 다시 골라 주세요 | `routine.validation.weekday` | 일요일부터 토요일 중에 골라 주세요. |
| `routine.invalid.weekday_not_allowed` | 반복에 맞는 요일을 골라 주세요 | `routine.validation.weekdayNotAllowed` | 요일은 매주 반복에서만 골라 주세요. |
| `routine.invalid.monthday_required` | 날짜를 하나 이상 골라 주세요 | `routine.validation.monthdayRequired` | 날짜를 하나 이상 골라 주세요. |
| `routine.invalid.monthday_invalid` | 날짜를 다시 골라 주세요 | `routine.validation.monthday` | 1일부터 31일 중에 골라 주세요. |
| `routine.invalid.monthday_not_allowed` | 반복에 맞는 날짜를 골라 주세요 | `routine.validation.monthdayNotAllowed` | 날짜는 매월 반복에서만 골라 주세요. |
| `routine.invalid.start_date_invalid` | 시작일을 다시 골라 주세요 | `routine.validation.start` | 시작일을 입력해 주세요. |
| `routine.invalid.end_date_invalid` | 종료일을 다시 골라 주세요 | `routine.validation.end` | 올바른 종료일을 입력해 주세요. |
| `routine.invalid.end_before_start` | 종료일은 시작일 이후로 골라 주세요 | `routine.validation.endBeforeStart` | 종료일은 시작일보다 빠를 수 없어요. |
| `routine.partialSplit` | 새 규칙은 적용됐지만 종료일을 저장하지 못했어요. 다시 시도하면 종료일만 저장해요. | `routine.partialSplit.retry` | 규칙은 바뀌었지만 종료일을 저장하지 못했어요. 다시 시도로 종료일만 저장할 수 있어요. |
| `routine.goalRequired` | 활성 목표를 골라 주세요 | `routine.goal.required` | 활성 목표를 골라 주세요. |
| `goal.failed` | 목표를 불러오지 못했어요. 다시 시도해 주세요. | `routine.goal.failed` | 목표를 불러오지 못했어요 · 다시 시도 |
| `routine.interval` | 간격 | `routine.repeat.interval` | 반복 간격 |
| `routine.monthEnd` | 없는 달은 말일에 표시돼요 | `routine.monthEnd.help` | 없는 달은 말일에 표시돼요. |
| `routine.end` | 종료일 | `routine.end.optional` | 종료일 (선택) |
| `routine.failed` | 루틴을 불러오지 못했어요. | `routine.load.retry` | 루틴을 불러오지 못했어요 · 다시 시도 |
| `routine.skipped` | '{title}'{particle} 오늘은 건너뛰었어요 | `routine.skipped.summary` | 이날은 건너뛰었어요 |
| `routine.skip` | 오늘만 건너뛰기 | `routine.skip.day` | 이날은 건너뛰기 |
| `routine.edit` | 루틴 편집 | `routine.edit.action` | 루틴 수정 |
| `routine.create` | 루틴 만들기 | `routine.new` | 새 루틴 |
| `routine.recordsRemain` | 기록은 캘린더에 남아 있어요 | `routine.recordsRemain.help` | 기록은 캘린더에 남아 있어요. |
| `routine.scope.todayDescription` | 어제까지의 규칙과 완료 기록은 그대로 두고, {date}부터 새 규칙으로 보여요. | `routine.scope.todayHelp` | {date}부터 새 규칙으로 보여요. 새 시작일은 오늘이에요. |
| `routine.scope.allDescription` | 시작일({date})부터 새 규칙으로 다시 계산해요. 새 규칙에 맞지 않는 날의 완료 기록은 지우지 않고 숨겨요. | `routine.scope.allHelp` | 새 규칙에 맞지 않는 날의 완료 기록은 지우지 않고 숨겨요. |
| `routine.scope.done` | 끝낸 날 | `routine.scope.completed` | 끝냄 |
| `routine.scope.cell` | {date}, {state} | `routine.scope.dateState` | {date} {state} |
| `mobile.update.title` | App Store에서 업데이트해 주세요 | `app.update.title` | 새 버전이 필요해요 |
| `mobile.update.title` | App Store에서 업데이트해 주세요 | `app.update.instruction` | App Store에서 업데이트해 주세요. |
| `mobile.update.missing` | App Store 주소가 아직 준비되지 않았어요. | `app.update.pending` | App Store 링크를 준비하고 있어요. |
| `mobile.update.versions` | 현재 {current} · 최소 {minimum} | `app.update.versions` | 지금 버전 {current} · 필요한 버전 {minimum} |
