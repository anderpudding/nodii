# I2 · 로케일 인프라와 언어 설정 결과

2026-10-29 · 브랜치 `feat/i18n-i2-locale` · 기준 `docs/codex/stage-i2-locale-infra.md`

## 한 일 (SET-06)

- `main`(`7a4c556`)에서 요청한 브랜치를 만들었습니다. 첫 커밋 `3dd1b73`은 기존 미커밋 변경인 `docs/14-i18n-plan.md` **한 파일만** 포함하며 메시지는 `docs(i18n): move bundle localizations into I2`입니다.
- 지시서 순서대로 i18n 패키지 → 날짜·요일 교체 → 저장소·구독 → 설정 UI → 번들 언어 선언 → 추가 테스트 → 기록을 별도 커밋했습니다. push하지 않았습니다.
- `@nodii/i18n`에 `Locale`, `LanguagePreference`, `resolveLocale`, 모듈 로케일 저장소·구독, `intlLocale`, `formatISODate`, `weekdayName`을 추가했습니다. 초깃값은 `ko`이며 DOM·navigator·React 의존성을 추가하지 않았습니다.
- `t(key, params)` 호출 방식과 자리표시자 치환을 유지했습니다. 내부 `createTranslator(catalogs)`로 테스트 카탈로그를 주입하고, 숫자 `count`가 있는 대상 문구는 영어 복수형을 우선합니다. 영어에 없는 문구는 한국어로 대체하며 한국어에는 복수형 키를 넣지 않았습니다.
- 영어 카탈로그는 언어 설정 6개 키만 채웠습니다. 기존 한국어 값은 지시서가 허용한 요일 키 7개 삭제와 `routine.weekday.label`의 `'{day}'` 변경 외에는 유지했습니다. 요일 키의 다른 사용처가 없는지 `rg`로 확인한 후 삭제했습니다. 모바일의 요일 키·코드는 변경하지 않았습니다.
- 데스크톱의 고정 `ko-KR` 3곳을 교체했습니다. `CalendarGrid`·`DayHeader`는 UTC 날짜 헬퍼, 목표 보관 날짜는 현재 로케일의 Intl 포맷터를 사용합니다. 보관 타임스탬프의 **UTC 시간대 동작은 유지**했습니다.
- `settings.json`의 `language`를 원본, `nodii-language` localStorage를 미러로 사용합니다. 즉시 적용·저장 실패 롤백·읽기 중 사용자 변경을 보존하는 revision·system일 때만 languagechange 반영·구독 정리를 구현했습니다. 로딩/저장/메뉴 실패는 기존 토스트 경로로 알립니다.
- `App`이 `useLocale()`로 구독하고 `Providers`가 `startLanguage()`를 시작합니다. 트리의 key를 바꾸지 않습니다. `<html lang>` 동기화와 index.html의 초기 미러 스크립트, 테마 아래 언어 세그먼트를 추가했습니다. 영어/한국어 전환 중 열린 설정 시트의 DOM·초점을 유지하는 통합 테스트가 통과했습니다.
- `Info.plist`에 `CFBundleDevelopmentRegion=en`, `CFBundleLocalizations=[en, ko]`를 추가했습니다. `AGENTS.md`의 언어·날짜 표시 규칙도 갱신했습니다.

## OS 언어 감지 결과

실제 macOS 첫 선호 언어를 바꿔 WKWebView의 `navigator.languages`를 관찰하는 검증은 **수행하지 못했습니다**. jsdom 모의 결과를 OS 검증으로 간주하지 않았습니다.

| 실행 형태 | OS 첫 언어 | 결과 |
| --- | --- | --- |
| `pnpm dev` (Tauri/WKWebView) | 한국어 | **건너뜀** — 실제 macOS 언어 전환·앱 실행 및 navigator 로그 관찰 미수행 |
| `pnpm dev` (Tauri/WKWebView) | 영어 | **건너뜀** — 실제 macOS 언어 전환·앱 실행 및 navigator 로그 관찰 미수행 |
| 앱스토어 빌드 | 한국어 | **건너뜀** — `pnpm build:appstore`가 `APPLE_TEAM_ID` 미설정으로 빌드 전 중단 |
| 앱스토어 빌드 | 영어 | **건너뜀** — 같은 이유로 실행 가능한 이번 단계 서명 빌드 없음 |

소스 plist 문법은 `plutil -lint`로 통과했습니다. **번들 선언이 실제 dev/스토어 앱에 반영됐는지와 OS 추종 여부는 미확정**입니다. 불일치를 확인한 것은 아니며, 새 OS 플러그인·capability·Rust 명령은 추가하지 않았습니다. 사람이 검증하다 시스템 언어를 따르지 않는 것을 확인하면 이 지점에서 멈추고 대안을 결정해야 합니다. 임시 navigator 로그는 최종 코드에 없습니다.

## `useMemo` 6곳 확인 요청과 실제 코드 차이

이번 시작점의 `apps/desktop/src`에는 `useMemo` 호출이 **3곳**, `useCallback` 호출과 `React.memo` 사용은 **0곳**입니다. import와 호출을 중복 계산하지 않았습니다. 지시서에 적힌 “현재 useMemo 6곳”에 맞춰 나머지 세 곳을 추정하거나 새 메모를 추가하지 않았습니다.

| 실제 위치 | 메모 내용 | 처리 |
| --- | --- | --- |
| `features/day-list/DayView.tsx` | `buildDay`의 도메인 항목 묶음 | `t()`·날짜 표시 헬퍼 호출 없음. 문구는 메모 밖 렌더에서 생성하므로 기존 의존성 유지 |
| `features/calendar/MonthCalendar.tsx` | `summarizeMonth`와 목표 도장 색 | 문구/날짜 표시 문자열 없음. 렌더의 `CalendarGrid`가 현재 로케일로 포맷하므로 기존 의존성 유지 |
| `features/calendar/WeekStrip.tsx` | 월 경계 캐시 병합·집계·목표 도장 색 | 문구/날짜 표시 문자열 없음. 기존 의존성 유지 |

따라서 메모 내부에서 이전 로케일의 문자열을 보관하는 곳은 **0곳**이며, 불필요한 locale 의존성을 추가하지 않았습니다. 다른 기준 리비전의 6곳을 뜻했다면 대조할 위치 확인이 필요합니다.

## 메뉴 중복 설치 방지

- `main.tsx`의 최초 `installAppMenu()` 호출을 제거하고 `startLanguage()`의 첫 적용으로 일원화했습니다.
- `menuLocale`에 마지막으로 설치를 요청한 **실제 로케일**을 보관합니다. StrictMode effect 재시작, 같은 store 원본 재적용, 설정값만 system↔ko처럼 바뀌고 결과 로케일은 같은 경우에 설치를 반복하지 않습니다.
- 설치 요청은 `menuQueue`로 직렬화해 이전 비동기 설치가 이후 설치를 뒤늦게 덮어쓰지 않게 했습니다. 실패는 `app.menu.failed` 토스트로 알리고 해당 최신 요청의 중복 방지 표식을 해제해 다음 적용에서 재시도할 수 있게 했습니다.
- 모의 함수로 초기화 중복 방지·언어 변경 시 재설치·빠른 전환 직렬화·실패 알림을 검증했습니다. 실제 네이티브 메뉴 표시와 macOS 기본 항목의 현지화는 미검증입니다. 사용자 정의 메뉴의 영어 카탈로그는 I3 범위라 이번에는 한국어 대체가 적용됩니다.

## 실행한 검증

로컬 캐시의 pnpm **10.28.0**을 `/private/tmp/nodii-i2-bin` PATH로 지정했습니다. 새 다운로드·의존성 설치는 없습니다.

| 명령 또는 검사 | 결과 |
| --- | --- |
| 변경 영역 `pnpm exec eslint …`, `pnpm exec prettier --write/--check …` | 각 기능·테스트 커밋 전 통과 |
| `pnpm --filter @nodii/i18n typecheck/test` | i18n 기능 커밋 전 통과, 최종 패키지 테스트 **25개** |
| `pnpm --filter @nodii/desktop typecheck/test` | 기능 커밋 전 통과. 날짜 교체 시 기존 **129개** 한국어 검사 유지 |
| `pnpm --filter @nodii/desktop exec vitest run src/lib/language.test.ts src/features/settings/SettingsLanguage.test.tsx` | 최종 관련 **16개** 통과 |
| `pnpm lint` | 전체 통과, 한국어 리터럴 오류 규칙 유지 |
| `pnpm format:check` | 전체 통과 |
| `pnpm typecheck` | 모바일 포함 전체 통과 |
| `pnpm test` | **659개 통과**: core167 · i18n25 · api80 · desktop145 · mobile Vitest137 · Jest/RNTL105(12스위트) |
| `pnpm build:web` | 통과, 기존 500kB 초과 청크 경고 유지 |
| `plutil -lint apps/desktop/src-tauri/Info.plist` | 통과 |
| `pnpm build:appstore` | **실패**: `APPLE_TEAM_ID` 필수 환경 변수 없음. 서명·번들 생성 전 중단 |
| `git diff main`의 기존 `*.test.*` / mobile·core·api·DB | 기존 테스트 수정 0개 / 대상 변경 0개 |
| 데스크톱 고정 `ko-KR` 및 삭제한 요일 키 참조 검색 | 제품 코드 잔존 없음 |

추가 테스트는 로케일 해석·구독·복수형·대체 문구·날짜/요일 전환, 미러/원본·저장 롤백·비동기 경쟁·메뉴 직렬화, 실제 App 구독을 통한 열린 설정 시트의 전환을 검증합니다. 기존 한국어 기대값은 바꾸지 않았습니다. 기존 모바일 비동기 act/GoTrueClient 진단 경고는 남아 있습니다.

## 건너뛴 검증

- 위 OS 언어 감지 네 조합, 실제 Tauri 네이티브 메뉴·프로세스 재실행 후 plugin-store 영속화: 수동 확인 미수행. 원본 저장/미러 복원은 모의 테스트로만 확인했습니다.
- `pnpm db:reset`, `pnpm db:test`, `pnpm db:types`: core/api/DB·스키마를 변경하지 않아 미실행했습니다.
- iOS 실행·export·실기기 언어 전환: I5 범위라 미실행했습니다. 기존 모바일 테스트는 그대로 통과했습니다.
- 원격 CI: push하지 않아 미실행했습니다.

## 새 의존성과 결정이 필요한 사항

- **새 의존성 없음.** 새 i18n 라이브러리·Tauri 플러그인·외부 호스트·서버 저장은 추가하지 않았습니다.
- 실제 코드와 지시서 차이: 위 `useMemo` 6곳 대 실제 3곳입니다. 보관 날짜는 기존 타임스탬프 UTC 포맷을 유지했습니다. 밴쿠버 저녁에 보관하면 다음 날로 표시될 수 있으며, 시간대 변경은 별도 결정입니다.
- 계획 §3의 React context·localStorage 설명, 한국어 `_other` 표현과 §6의 세 인자 `t()` 예시는 I2 지시서의 구체적인 **모듈 저장소 + 데스크톱 useSyncExternalStore / plugin-store 원본·localStorage 미러 / 한국어 복수형 키 없음 / 두 인자 시그니처 유지**와 다릅니다. 이번 구현은 지시서를 따랐으며 계획 문서의 첫 커밋 이후 본문은 임의 수정하지 않았습니다. 또한 요구사항 SET-06의 기존 한국어 전용 표기보다 이번 i18n 지시서를 적용했습니다.
- I2는 영어 설정 외 문구를 한국어로 대신하는 중간 단계입니다. **I2만 단독 출시하지 않습니다.**

## 사람이 직접 확인할 것

1. macOS 첫 선호 언어를 한국어/영어로 각각 바꾸고 앱 설정을 시스템으로 두어 dev와 서명 스토어 빌드의 `navigator.languages`·초기 표시를 확인합니다. 시스템과 다르면 새 플러그인을 넣지 않고 중단·보고합니다.
2. 설정 시트를 연 채 언어를 왕복 전환하여 시트·입력 상태·포커스와 날짜·요일·언어 줄을 확인합니다. 한국어 `10월 28일 (수)` ↔ 영어 `Wed, October 28`이 기준입니다.
3. 메뉴바의 재설치, 단축키 동작, macOS 기본 항목(서비스·가리기 등)의 표시를 확인합니다. 사용자 정의 메뉴 번역은 I3에서 채웁니다.
4. 한국어·English·시스템 선택 후 앱을 종료하고 다시 열어 plugin-store 원본과 미러의 기기별 영속화를 확인합니다.
