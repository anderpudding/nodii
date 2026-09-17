# AGENTS.md — Nodii

이 파일은 이 저장소에서 일하는 코딩 에이전트(Codex 등)가 **매 작업마다 먼저 읽는 규칙서**입니다.
제품 결정의 기준은 `docs/`의 세 문서이고, 이 파일은 그 요약과 작업 규칙입니다. 둘이 다르면 **`docs/`가 우선**이며, 차이를 발견하면 보고하세요.

| 문서                             | 내용                                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `docs/01-requirements.md`        | 요구사항 (ID: AUTH-, GOAL-, TODO-, CAL-, ROUT-, SYNC-, SET-, NFR-) · 확정 결정 Q1~Q11                     |
| `docs/02-system-design.md`       | 아키텍처, **DB 스키마 SQL(§4.3, §4.5)**, core 함수 명세(§5), 흐름(§6), 캐시 키(§8), 보안(§9), 테스트(§10) |
| `docs/03-implementation-plan.md` | 단계별 작업 체크리스트, 설계 보완 사항 G1~G6(§5), 진행 기록(§6)                                           |
| `docs/codex/`                    | 단계별 작업 지시서 (사람이 한 단계씩 넘겨줌)                                                              |

---

## 1. 제품 한 줄 요약

**Nodii** — 투두메이트를 대체하는, 모든 기기에서 같은 하루를 보여주는 날짜 기반 투두 앱.
MVP는 **macOS 전용 데스크톱 앱**(Tauri v2)이고 **Mac App Store**로 공개 배포합니다. 서버는 Supabase(Auth + Postgres + Realtime)이며, v2에서 iOS 앱(Expo)이 `packages/core`·`packages/api`를 그대로 재사용합니다.

MVP 기능: 이메일 OTP 로그인 · 목표(카테고리) · 날짜별 할 일 · 월간 캘린더 · 루틴(반복 할 일) · 실시간 동기화 · 설정.
MVP 제외: 타이머, 일기, 소셜, 위젯, 푸시, 모바일 앱, **오프라인 쓰기**, Google/Apple 로그인, 앱 자체 업데이트.

UI 언어는 **한국어**입니다. 사용자에게 보이는 문구는 모두 한국어로, 짧고 친근한 존댓말(예: "저장하지 못했어요 · 다시 시도")로 씁니다.

---

## 2. 기술 스택 (이미 설치된 버전 기준)

| 영역                | 사용                                                  | 비고                                                                                       |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 모노레포            | pnpm 10 workspaces, Node 22                           | `pnpm-workspace.yaml`                                                                      |
| 언어                | TypeScript 6 (strict)                                 | `tsconfig.base.json`                                                                       |
| 데스크톱            | Tauri v2, Rust 셸 최소                                | 플러그인: `store`, `opener`만                                                              |
| UI                  | React 19, Vite 8, Tailwind CSS v4                     | 이후 추가: Radix/shadcn, dnd-kit                                                           |
| 서버 상태 / UI 상태 | TanStack Query / Zustand                              | 2~3단계에서 추가                                                                           |
| 날짜                | `core`의 자체 ISODate 유틸                            | 표시용 포맷은 `Intl.DateTimeFormat('ko-KR')`. date-fns는 꼭 필요할 때만 `apps/desktop`에서 |
| 정렬 키             | `fractional-indexing`                                 | 설계서 §4.4                                                                                |
| 백엔드              | Supabase (`@supabase/supabase-js` v2)                 | 로컬: Supabase CLI + Docker                                                                |
| 테스트              | Vitest 5 (+coverage-v8), Testing Library + MSW, pgTAP |                                                                                            |
| 린트/포맷           | ESLint 10 (flat config), Prettier 3                   |                                                                                            |

새 의존성은 **필요할 때만** 추가하고, 추가한 이유를 보고에 적습니다. `packages/core`에는 런타임 의존성을 넣지 않는 것이 원칙입니다(`fractional-indexing` 같은 순수 라이브러리는 예외로 허용, 보고에 명시).

---

## 3. 저장소 구조와 의존 방향

```
apps/desktop/            Tauri v2 앱
  src/                   React (app/, features/{auth,calendar,day-list,goals,routines,settings}/, components/ui/, lib/)
  src-tauri/             Rust 셸 · tauri.conf.json · tauri.appstore.conf.json · Entitlements · Info.plist
packages/core/           순수 TS 도메인 로직 (타입, 날짜, 반복 규칙, 집계, 정렬 키)
packages/api/            Supabase 클라이언트, repository, query 훅, realtime
supabase/                config.toml · migrations/ · tests/(pgTAP) · templates/otp.html
scripts/build-appstore.sh
docs/
```

**의존 방향:** `apps/desktop` → `packages/api` → `packages/core`. 역방향 import 금지.

- `core`: React, Supabase, Tauri, DOM, `Date.now()` 직접 호출 금지 (오늘 날짜는 인자로 받음).
- `api`: Tauri import 금지 (저장소는 `AuthStorage` 인터페이스로 주입받음 — 모바일 재사용 때문).
- Tauri API(`@tauri-apps/*`)는 `apps/desktop`에서만 사용하고, `isTauri()`로 브라우저 미리보기(`pnpm dev:web`)에서도 죽지 않게 합니다.

---

## 4. 명령어

```bash
pnpm install
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test   # 기본 검증 (CI와 동일)
pnpm test:coverage                                              # core 커버리지 확인
pnpm db:start        # 로컬 Supabase (Docker 필요). API http://127.0.0.1:54321, 메일함 http://127.0.0.1:54324
pnpm db:reset        # 마이그레이션 전체 재적용 + seed
pnpm db:test         # pgTAP (supabase/tests/*.sql)
pnpm db:types        # packages/api/src/database.types.ts 재생성 (마이그레이션 변경 후 필수)
pnpm dev             # Tauri 앱 / pnpm dev:web: 브라우저 미리보기
```

**작업을 끝내기 전에 반드시** `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`를 통과시키고, DB를 건드렸다면 `pnpm db:reset && pnpm db:test && pnpm db:types`도 실행합니다. 실행할 수 없는 검증(Docker 미실행, 네트워크 차단 등)은 **건너뛰었다고 명시**하고, 통과했다고 쓰지 않습니다.

---

## 5. 반드시 지킬 도메인 규칙

### 날짜와 시간

- 할 일 날짜는 **로컬 달력 날짜 `ISODate`('YYYY-MM-DD')** 문자열이고 DB 타입은 `date`입니다. 시각(`timestamptz`)으로 바꾸지 마세요.
- `core`의 날짜 계산은 **문자열 ↔ UTC 기준 일수(epoch day)** 로 합니다. 로컬 `Date` 객체의 `setDate`/`getTime` 차이로 일수를 세면 DST 전환일에 하루가 틀어집니다.
- "오늘"은 `todayISO(timeZone, now)`로 계산하고(`Intl.DateTimeFormat`), 컴포넌트는 스토어의 `today` 값을 씁니다. 자정이 지나면 갱신합니다(6단계).

### 목표 · 할 일

- 모든 할 일은 목표에 속합니다. **활성 목표는 항상 1개 이상** (클라이언트에서 막고 DB 트리거 `ensure_active_goal`로도 강제).
- 목표·할 일·루틴은 **소프트 삭제**(`deleted_at`). 조회는 항상 `deleted_at is null`. 루틴 기록(`routine_logs`)만 실제 삭제.
- 목표는 **보관(`archived_at`)**이 기본. 보관한 목표에는 새 항목을 추가할 수 없고, 과거에 만든 할 일은 그 날짜에서 계속 보입니다.
- 정렬: 목표 `sortKey` 순 → 목표 안에서 항목 `sortKey` 순. 정렬 키는 `fractional-indexing`으로 만들고, 비교는 **바이트 순서**(`a < b`, `localeCompare` 금지). 순서 변경 시 한 행만 UPDATE.
- ID는 클라이언트에서 `crypto.randomUUID()`로 만들어 INSERT에 포함합니다(낙관적 업데이트).
- 지난 미완료 할 일은 **자동 이월하지 않습니다.** 오늘 화면의 "가져오기" 버튼으로만, 최근 `OVERDUE_LOOKBACK_DAYS`(7)일, 보관 목표 제외, 목표별 맨 아래로 이동(`move_todos` RPC).

### 루틴

- 루틴은 **가상 전개**: 규칙만 저장하고 날짜별 항목은 `core`에서 계산. 완료/건너뛰기만 `routine_logs`에 기록. 미래 행을 미리 만들지 마세요.
- 반복: 매일/N일마다, 매주 요일들/N주마다, 매월 날짜들/N개월마다. **그 날짜가 없는 달은 말일에 표시**(31일 규칙 → 30일, 2월 28/29일).
- 규칙(`freq`, `repeatEvery`, `byWeekday`, `byMonthday`, `startDate`)을 바꾸고 시작일이 오늘 이전이면 **적용 범위를 묻습니다**: 과거까지 모두 → 같은 행 UPDATE / 오늘부터 → `split_routine` RPC. 제목·목표만 바뀌면 묻지 않고 UPDATE.
- 종료: "오늘부터 그만하기" = `end_date = 어제` / "완전 삭제" = `deleted_at`.

### 동기화 · 상태

- **서버가 기준 데이터.** 클라이언트는 TanStack Query 캐시만 가집니다. 서버 데이터를 Zustand에 복사하지 마세요(Zustand는 선택 날짜, 보기 모드 같은 UI 상태만).
- 모든 쓰기는 **낙관적 업데이트**: `onMutate` 스냅샷 → 캐시 수정 → 요청 → 실패 시 롤백 + 토스트. **실패를 조용히 삼키지 않습니다**(NFR-12).
- 쿼리 키는 설계서 §8을 따릅니다: `['goals']`, `['routines']`, `['todos', monthKey]`, `['routineLogs', monthKey]`, `['overdue', today]`.
  - ⚠️ 월 캐시 범위는 **42칸 그리드**라서 인접한 달과 날짜가 겹칩니다. 할 일/로그를 패치할 때는 해당 날짜를 범위에 포함하는 **캐시된 모든 monthKey**를 패치하세요.
  - 그리드 범위는 주 시작 요일에 따라 달라지므로, 주 시작 요일을 바꾸면 월 캐시를 무효화합니다.
- 하루 목록과 캘린더 집계는 별도 요청 없이 캐시에서 `core.buildDay`/`summarizeMonth`로 계산(`useMemo`).
- 충돌 정책은 Last-Write-Wins. Realtime 이벤트는 `updated_at`이 캐시보다 **새로울 때만** 반영.

---

## 6. 보안 · 배포 제약 (App Store)

- 앱에는 **publishable(anon) 키만** 넣습니다. `service_role` 키는 어디에도 두지 마세요.
- 모든 테이블 RLS 필수. 새 테이블/RPC를 만들면 RLS 정책(또는 `security invoker`)과 pgTAP 허용 1개 + 거부 1개 테스트를 같이 추가합니다. RPC는 `anon` 실행 권한을 회수합니다.
- `security definer` 함수는 `set search_path = ''`와 스키마를 명시한 이름(`public.goals`)만 사용하고, 꼭 필요한 곳(가입 트리거, 계정 삭제)에만 씁니다.
- 스키마 변경은 **마이그레이션 파일로만** (`supabase migration new <name>`). 이미 커밋된 마이그레이션은 수정하지 말고 새 파일을 추가합니다.
- Tauri: 새 플러그인·capability·Rust 명령을 추가하지 않는 것이 기본입니다. 추가가 필요하면 이유를 보고하세요. **`plugin-updater`, `shell` 플러그인 금지.** 외부 링크는 `plugin-opener`.
- 새 외부 호스트에 연결하면 `tauri.conf.json`의 CSP `connect-src`를 갱신해야 합니다. 폰트·스크립트를 CDN에서 불러오지 마세요(번들에 포함).
- 비밀 값 커밋 금지: `.env.local`, `*.provisionprofile`, 인증서, 심사 계정 비밀번호. 환경 변수는 `apps/desktop/.env.example`에 키 이름만 추가합니다.
- 번들 ID `com.sungjunlee.Nodii`, `Entitlements`, `Info.plist`, `tauri.appstore.conf.json`, `scripts/build-appstore.sh`는 지시가 없으면 건드리지 않습니다.
- 성능 목표: 조작 반영 100ms 이하, 월 이동 300ms 이하, 설치 파일 15MB 이하. 무거운 UI 라이브러리를 들이지 마세요.

---

## 7. 코드 스타일

- 기존 코드 스타일을 따릅니다: named export, 함수 컴포넌트, 파일당 한 가지 책임, Prettier 설정 준수.
- `any` 금지(불가피하면 `unknown` + 좁히기). 공개 함수에는 짧은 한국어 JSDoc으로 **왜**를 적고, 요구사항 ID를 달면 좋습니다(`// ROUT-04`).
- DB 행(snake_case) ↔ core 타입(camelCase) 변환은 `packages/api`의 매퍼 한 곳에서만 합니다.
- UI 컴포넌트는 `features/<기능>/` 아래에 두고, 공용 프리미티브만 `components/ui/`에 둡니다.
- 접근성: 체크박스·버튼에 레이블, 키보드로 조작 가능, 다크 모드 대응(Tailwind `dark:`).
- 테스트는 구현 옆에 `*.test.ts(x)`로. `core`는 **테스트 먼저** 작성하고 커버리지 90% 이상.

---

## 8. 작업 방식

1. **시작 전**: 지시서와 관련 문서 절을 읽고, `git status`가 깨끗한지 확인하고, `feat/<단계>-<이름>` 브랜치를 만듭니다.
2. **범위 준수**: 지시서의 "하지 말 것"과 다음 단계 작업을 미리 하지 않습니다. 관련 없는 리팩터링·포맷 변경을 섞지 않습니다.
3. **모호하거나 문서끼리 충돌할 때**: 제품 동작을 임의로 정하지 말고, 문서에 가장 가까운 **보수적인 해석**을 택한 뒤 코드 주석과 최종 보고의 "결정이 필요한 사항"에 적습니다.
4. **커밋**: 작은 단위로, 요구사항 ID 포함. 예: `feat(day-list): 할 일 날짜 옮기기 (TODO-05)`, `test(core): 매월 31일 루틴 말일 표시 (ROUT-04)`.
5. **문서 갱신**: 끝낸 항목은 `docs/03-implementation-plan.md` 체크박스를 체크하고 §6 진행 기록에 한 줄 추가합니다. 설계를 바꿔야 했다면 `docs/02-system-design.md`를 직접 고치지 말고 보고에 제안으로 남깁니다.
6. **건드리지 말 것**: `Claude outputs/` 폴더(이전 작업의 사본, CI 설정 원본은 `.github/workflows/`), `.env.local`, `src-tauri/profiles/`의 실제 파일.
7. **최종 보고 형식** (한국어):
   - 한 일 (요구사항 ID별)
   - 실행한 검증 명령과 결과 (건너뛴 것은 이유와 함께)
   - 새로 추가한 의존성과 이유
   - 결정이 필요한 사항 / 문서와 다르게 구현한 부분
   - 사람이 직접 확인해야 할 것 (예: `pnpm dev`로 화면 확인, Supabase 대시보드 설정)
