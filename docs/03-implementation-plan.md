# Nodii 구현 계획서 (MVP)

> 버전 1.0 · 2026-09-17 · 근거 문서: `01-requirements.md` v1.1, `02-system-design.md` v1.2
> 상태: **진행 중 — 5단계 완료 (2026-09-18), 다음은 6단계.** 단계가 끝날 때마다 체크박스와 §6 진행 기록을 갱신합니다.

---

## 1. 원칙

1. **가장 불확실한 것부터 확인한다.** 가장 큰 리스크는 기능이 아니라 "Tauri 앱이 App Sandbox를 켜고 서명되어 TestFlight까지 가는가"입니다. 빈 앱으로 0단계에서 한 번 끝까지 통과시킵니다.
2. **아래에서 위로, 세로로 자른다.** DB와 `@nodii/core`는 UI 없이 테스트로 먼저 굳힙니다. 그 위로는 "화면 하나가 실제 데이터로 끝까지 동작"하는 단위로 쌓습니다.
3. **외부 대기 시간이 긴 일은 먼저 걸어 둔다.** 도메인 DNS(SPF/DKIM 전파), Apple 인증서·프로비저닝 프로파일, App Store 심사.
4. **Must 먼저, 실사용은 빨리.** 루틴(5단계)까지 되면 dev 빌드로 투두메이트를 대체해서 쓰기 시작하고, 남은 기간 동안 실사용 피드백을 반영합니다.
5. **각 단계는 완료 기준을 통과해야 다음으로 넘어간다.**

---

## 2. 전체 일정 (대략)

주 15~20시간 기준 약 12주. 심사 기간은 별도입니다.

| 단계 | 내용 | 기간 | 관련 시나리오 / 요구사항 |
|---|---|---|---|
| 0 | 기반 셋업 + 배포 스파이크 | ~1주 | NFR-05, NFR-13 |
| 1 | DB 마이그레이션 + `@nodii/core` | ~1.5주 | NFR-06, NFR-08, NFR-10 |
| 2 | 인증 + 앱 셸 | ~1주 | AUTH-01~04, 07, 08 · SET-05 |
| 3 | 목표 + 하루 목록 | ~1.5주 | S1, S2 · GOAL-01/02/05/07 · TODO-01~04, 09 |
| 4 | 캘린더 + 날짜 이동 + 가져오기 | ~1주 | S3, S4, S6 · CAL-01~04 · TODO-05, 10 |
| 5 | 루틴 | ~2주 | S5 · ROUT-01~10 |
| 6 | 실시간 동기화 + 오프라인 읽기 | ~1주 | SYNC-01~04 |
| 7 | 설정 + Should 항목 | ~1주 | AUTH-06 · SET-01~03, 07 · GOAL-03/04/06 · TODO-06 |
| 8 | 출시 준비 + 심사 | ~1~2주 + 심사 | 완료 기준 4, 5 · NFR-14, 15 |

---

## 3. 단계별 작업

### 0단계 · 기반 셋업 + 배포 스파이크 (~1주)

**저장소**
- [x] pnpm 모노레포: `apps/desktop`, `packages/core`, `packages/api`
- [x] 공통 tsconfig, ESLint, Prettier, Vitest
- [x] `supabase/` 초기화 (`config.toml`: OTP 6자리, 재전송 60초)
- [x] GitHub Actions CI: lint · typecheck · test (빌드·배포는 8단계)
- [x] 환경 점검 스크립트: `pnpm check-env` (배포 준비물까지 `pnpm check-env --release`)
- [x] App Store용 설정 분리: `tauri.appstore.conf.json`, `Entitlements.plist`, `Info.plist`, `scripts/build-appstore.sh`

**로컬 환경 (내 맥에서)**
- [x] Node 22, pnpm 10, Rust stable, Xcode Command Line Tools
- [x] `rustup target add aarch64-apple-darwin x86_64-apple-darwin`
- [x] Docker Desktop + Supabase CLI (`brew install supabase/tap/supabase`)
- [x] `pnpm install` → `pnpm dev` 로 창이 뜨는지 확인

**배포 스파이크 (손으로 한 번)**
- [x] Apple Developer: App ID `com.sungjunlee.Nodii`, Apple Distribution / Mac Installer Distribution 인증서, Mac App Store Connect 프로비저닝 프로파일
- [x] 프로파일을 `apps/desktop/src-tauri/profiles/Nodii_MAS.provisionprofile`에 둔다 (git에는 올리지 않음)
- [x] Supabase 클라우드 프로젝트 `nodii` 생성 (us-west-1), `apps/desktop/.env.production.local`에 URL과 publishable 키
- [x] `scripts/build-appstore.sh` 로 Universal `.app` → `.pkg` 생성 → Transporter 앱으로 업로드
- [x] TestFlight로 설치해서 스파이크 화면의 두 항목(네트워크, 저장소)이 모두 성공인지 확인

**외부 준비 (기다리는 동안 다른 작업)**
- [x] 도메인 `nodii.app` 구매 (Q9), Resend 가입, 발신 도메인 `mail.nodii.app` SPF·DKIM Verified
- [x] Resend API 키 → Supabase `nodii`에 SMTP 연결 (발신 `no-reply@mail.nodii.app`), 메일 템플릿·OTP 설정 (가이드 C3~C5)

**완료 기준:** TestFlight 설치본에서 창이 뜨고, Supabase 헬스 체크와 plugin-store 쓰기/읽기가 샌드박스 안에서 성공한다. → ✅ **통과 (2026-09-17)**. ADR-006(pnpm 모노레포) 확정.

### 1단계 · DB + `@nodii/core` (~1.5주, 병행 가능)

**DB**
- [x] `20260917103537_init.sql`: 설계서 §4.3 (테이블, 트리거, RLS, Realtime publication)
- [x] `20260917103538_rules_rpc.sql`: 설계서 §4.5 (`ensure_active_goal`, `split_routine`, `move_todos`, `app_config`)
- [x] `20260917103539_account.sql`: `delete_my_account()` RPC (§5 보완 사항)
- [x] pgTAP: 정책별 허용 1개 + 거부 1개, 마지막 활성 목표 보관 거부, `split_routine` 3케이스, `move_todos` 남의 할 일 무시, 가입 시 기본 목표 생성
- [x] `supabase gen types typescript --local > packages/api/src/database.types.ts`

1a 구현 보완(설계서 §4.3·§4.5 반영 제안): `set_updated_at`의 `search_path`를 고정하고 테이블 권한을 명시했다. 로컬 기본 권한의 `TRUNCATE`가 RLS를 우회하므로 회수했으며, 물리 DELETE는 `routine_logs`에만 허용한다(계정 삭제의 FK cascade는 유지). `app_config`는 읽기만 허용한다. 두 연결이 서로 다른 마지막 목표를 동시에 보관하면 활성 목표가 0개가 되는 설계 SQL의 경쟁 조건을 재현하여 `ensure_active_goal`에 사용자별 트랜잭션 잠금을 추가했다. 수정 후 한 요청이 거부되고 활성 목표 1개가 남는 것을 독립 연결 두 개로 확인했다. 테이블·컬럼 및 RPC 시그니처는 설계대로 유지한다. → **설계서 v1.3에 반영함** (§4.2, §4.3, §4.5, §9, §10, ADR-017).

**core (테스트 먼저)**
- [x] 날짜 유틸: `todayISO(tz, now)`, `addDays`, `daysBetween`, `startOfWeek`, 월 그리드(42칸) 범위·중첩 월 키 (1b 공개 API 명세)
- [x] `occursOn` — 설계서 §5.3 엣지 케이스 전부, `nextOccurrences` (검색 상한 1,098일)
- [x] `expandRoutines`, `buildDay`, `summarizeMonth`
- [x] `ruleChanged`, `needsScopePrompt`, `validateRoutineRule`, `planOverdueMove`
- [x] 정렬 키 헬퍼 (`fractional-indexing` 래핑: 맨 아래, 두 항목 사이), 제목·HEX 색상 검증

1b 검증: ADR-003은 가상 전개·완료/건너뛰기 로그·분할 전후·보관 당일 포함을, ADR-004는 바이트 정렬·100회 연속 사이 삽입·목표별 가져오기 키를, ADR-005는 UTC epoch day·윤년/세기 예외·Vancouver DST·시간대별 날짜를 단위 테스트로 검증했다. I1~I3를 적용했으며, 공개 API는 1b 지시서의 명시적 시각 주입·객체 인자·`startOfWeek` 이름을 따른다. ADR-003·004의 UI 통합 확인은 아래 검증 시점 표대로 5·7단계에 남는다. 설계서 ADR 상태 변경은 제안으로 남긴다.

1b 후속 보완(TODO-10, ROUT-01): 사용자 지시에 따라 `planOverdueMove`의 `todayTodos`를 `todayItems: readonly { goalId: string; sortKey: string }[]`로 교체했다. 호출자는 오늘 날짜로 전개한 할 일과 루틴을 함께 전달하며, 가져오는 할 일은 목표별 전체 항목의 마지막 키 뒤에 붙는다. `validateRoutineRule`은 반복 종류에 맞지 않는 비어 있지 않은 배열을 `weekday_not_allowed`/`monthday_not_allowed`로 거부한다. null·빈 배열은 모두 허용한다. 설계서 §4.5의 "빈 배열이 아니라 null" 설명은 §4.3의 실제 cardinality check와 차이가 있어 정정을 제안한다(설계서 자체는 수정하지 않음).

**완료 기준:** `supabase test db` 통과, core 커버리지 90% 이상. ADR-003·004·005 확정.

### 2단계 · 인증 + 앱 셸 (~1주)

- [x] `@nodii/api`: plugin-store 저장소 어댑터를 넣은 Supabase 클라이언트
- [x] 로그인 화면: 이메일 → 6자리 코드 (붙여넣기, 60초 재전송 카운트다운, 오류 안내)
- [x] 심사 계정 분기: `REVIEW_ACCOUNT_EMAIL`일 때만 비밀번호 입력 (AUTH-08)
- [x] 세션 복원, 로그아웃 시 Query 캐시와 인증 저장소 삭제 (persister 삭제는 지시서대로 6단계에서 `logout`에 추가)
- [x] AUTH-03 후속: 네트워크 오류에도 로컬 로그아웃을 완료하고 결과·토스트로 구분, 그 외 오류는 실패 유지
- [x] 로그인 직후 `profiles.timezone`을 실제 시간대로 갱신 (§5 보완 사항)
- [x] 최소 지원 버전 확인 (§6.7), QueryClient · 레이아웃 뼈대 · 토스트
- [x] 로컬 개발은 Supabase 로컬 메일 확인 도구(`localhost:54324`)로 OTP 수신

**완료 기준:** 새 이메일로 가입 → 기본 목표 "할 일" 생성 → 앱 재실행 시 로그인 유지 → 로그아웃 시 로그인 화면.

**2단계 검증·보완 (2026-09-17)**
- AUTH-01/02/03/07/08: OTP·심사 계정 API, 세션 저장/복원, 로그아웃 정리, 한국어 오류, 6칸 붙여넣기·자동 제출·60초 재전송 구현. `plugin-store`는 쓰기/삭제 뒤 `save()`까지 기다림.
- SET-05·G2: 숫자 단위 버전 비교, 최소 버전 조회 실패/잘못된 값 통과, 3초 요청 제한, 시간대가 다를 때만 UPDATE 및 Query 재시도. `getVersion()`은 Tauri에서만 사용하고 브라우저는 앱 패키지 버전을 사용.
- 기본 opener 권한은 `macappstore://`를 허용하지 않아 기존 capability에 `macappstore://apps.apple.com/app/id*`만 추가. Rust·플러그인·DB 스키마 변경 없음.
- 문서 차이: 기존 가입 트리거의 기본 목표 색은 `#4F7CFF`, 새 디자인 토큰은 코랄 `#F0715A`. 기존 마이그레이션은 유지했으며 후속 단계에서 새 마이그레이션으로 맞출지 결정 필요. GoTrue의 `otp_expired`는 틀린 코드에도 올 수 있어 해당 응답은 새 코드 요청 안내로 처리하고, 별도의 invalid 응답은 틀린 코드 문구를 사용.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` 통과: core 141 + api 28 + desktop 17 = 186검사. core 커버리지 문장/함수/라인 100%, 분기 98.99%. `pnpm build:web` 통과(단일 JS 청크 약 566.5KB 경고, 폰트 2.06MB 번들). DB 스키마 변경이 없어 `db:reset`·`db:test`·`db:types`는 실행하지 않음.
- 로컬 실제 검증: `stage2-smoke-0917@example.com` 신규 가입 → 메일함 54324의 6자리 코드 붙여넣기 → 메인 → 새로고침 후 세션 유지 → 로그아웃 후 로그인 화면. DB에서 `profiles.timezone = America/Vancouver`, 기본 목표 “할 일” 생성 확인. `otp.html`의 `{{ .Token }}`과 6자리/600초 설정 확인.
- 사람 확인: Tauri 앱 완전 종료·재실행의 세션 유지와 로그아웃, 실제 App Store ID 설정 후 업데이트 이동, macOS 라이트·다크 확인. 계획서의 persister 정리는 아직 도입하지 않은 6단계 작업임.

### 3단계 · 목표 + 하루 목록 (S1, S2) (~1.5주)

- [x] 공통 낙관적 업데이트 헬퍼 (스냅샷 → 요청 → 실패 시 롤백 + "저장하지 못했어요 · 다시 시도")
- [x] `['goals']`, `['todos', monthKey]` 쿼리 → `buildDay`로 선택 날짜 목록
- [x] 할 일 추가(목표 옆 `+`), 체크, 인라인 수정, 삭제
- [x] 목표 관리 시트: 생성, 이름·프리셋 색상, 보관/보관 해제, 마지막 활성 목표 버튼 비활성화
- [x] 날짜 헤더, ←/→ 이전·다음 날

**완료 기준:** S1, S2를 실제 데이터로 수행. 네트워크를 끊고 체크하면 롤백과 토스트가 뜬다.

**3단계 검증·보완 (2026-09-17)**

- GOAL-01/02/05/07·TODO-01~04/09: 목표 생성·이름/프리셋 수정·보관/해제, 마지막 활성 목표 방어, 날짜 이동·목표별 목록·연속 입력·체크·인라인 편집·소프트 삭제 구현. 한국어 IME의 조합 중 Enter, Esc 취소, 우클릭/키보드 메뉴, 로딩·조회 오류/재시도, 라이트·다크 대응.
- GOAL-03 대비 계산: 순수 `goalTint`·`goalInk`·`checkColor`, 프리셋 11색과 흰색/검정의 두 테마 이름표 4.5:1·체크 3:1 검사. HEX 입력 UI는 지시대로 7단계에 유지.
- 공통 낙관적 헬퍼는 캐시된 모든 인접 월을 스냅샷·패치하고 서버 행(`updatedAt`·`doneAt` 포함)으로 교체. 실패한 행만 복원하여 동시에 성공한 다른 행을 보존하며, 로그아웃으로 제거한 캐시는 늦은 응답으로 다시 만들지 않음. API의 기본 1000행 상한을 넘긴 목록도 페이지를 이어 읽음. `profiles.week_start`를 받은 뒤 월 쿼리를 시작하고 서버 데이터는 Query 캐시에만 저장.
- 문서 해석: 계획서의 삭제 실행 취소는 7단계 항목이지만 요구사항 TODO-04와 DESIGN §3/컴포넌트 기준을 따라 3단계에서 5초 실행 취소를 구현. 보관도 실행 취소 제공. I3에 따라 보관 목표에 당일 할 일이 있으면 그 날짜에 계속 표시하고 추가 버튼만 숨김(지시서의 사람 확인 문구 “오늘 목록에서 사라짐”은 오늘 항목이 없는 경우로 해석). 목표별 전체 할 일/루틴 개수는 3단계 API 범위에 집계가 없어 아직 표시하지 않으며 후속 관리 UI에서 연결 필요.
- macOS 12 초기 WebView에서도 작동하도록 네이티브 `dialog` 대신 공통 시트에 포커스 순환·복원·Esc/바깥 클릭 닫기를 구현. CSS `color-mix()`·`:has()`와 새 UI 라이브러리를 사용하지 않음. 새 의존성·DB 스키마·Rust·capability 변경 없음.
- `pnpm lint`·`pnpm format:check`·`pnpm typecheck`·`pnpm test` 통과(core 156 + api 39 + desktop 31 = 226검사). core 커버리지 문장 99.55%, 분기 99.07%, 함수 100%, 라인 99.46%. `pnpm build:web` 통과(약 597KB 단일 JS 청크의 기존 500KB 경고는 유지). 셸의 pnpm 12가 네트워크 제한으로 지정 버전 확인에 실패하여, 이미 설치된 pnpm 10.28.0을 임시 PATH로 지정해 검증함.
- 로컬 실제 검증: 별도 개발 계정으로 OTP 로그인 → 할 일 5개 연속 추가 → 2개 체크 → 목표 총 3개 생성·이름/색 변경 → 목표 보관 시 오늘 빈 그룹 숨김·전날 기록 보존 → 할 일 삭제/실행 취소 → 새로고침 후 데이터 유지. 브라우저 라이트·다크(임시 테마 검증 페이지, 확인 후 삭제), 880×600 목록·시트 확인. 실패/롤백은 서버 중단 대신 MSW 403 및 DB 제약 오류로 검증하여 실행 중인 로컬 DB를 중단하지 않음.
- DB 변경이 없어 `pnpm db:reset`·`pnpm db:test`·`pnpm db:types`는 실행하지 않음. 사람이 남겨서 확인할 것: 실제 Tauri/macOS 12 WebView에서 한국어 입력·키보드·시트, 체크 반영 100ms 이하 체감, 시스템 테마 전환. 앱 설치 파일 크기와 네이티브 실행 검증은 출시 단계에서 확인.

### 4단계 · 캘린더 + 날짜 이동 + 가져오기 (S3, S4, S6) (~1주)

- [x] 월간 캘린더 (남은 개수, 완료 표시, 오늘 강조, [오늘] 버튼), 이전/다음 달 prefetch
- [x] 컨텍스트 메뉴: 내일로 · 오늘로 · 날짜 선택 (두 monthKey 캐시 패치)
- [x] `['overdue', today]` 쿼리 + 가져오기 배너 + `move_todos`

**완료 기준:** S3, S4, S6. 월 이동 300ms 이하.

**구현·검증 기록 (2026-09-17)**

- CAL-01~05: 프로필 주 시작 요일의 42칸 캘린더, `summarizeMonth` 메모 집계, 지난날·앞날 도장/완료 체크, 오늘·선택 날짜, 방향키/Enter 탐색, 하루 목록과 월 선택 연동, 이전·다음 월 prefetch. 주 시작 설정 변경 시 월 캐시 무효화.
- TODO-05: Radix 우클릭/더보기 메뉴, 할 일 날짜 기준 내일로·오늘로·달력 팝오버 이동. 목적 날짜 목표의 마지막 키 계산, 원래/새 날짜를 포함하는 모든 월 캐시 패치·실패 롤백·5초 실행 취소.
- TODO-10: 오늘 화면에서만 최근 7일 미완료 조회, 보관 목표 제외, `buildDay`의 `todayItems`를 넘긴 하나의 계획으로 배너 개수와 RPC 대상 일치. 가져오기 낙관적 반영·원래 월/오늘 월/overdue 롤백·실행 취소. 체크·삭제·이동 성공 후 overdue 무효화.
- 검증: lint·format:check·typecheck·test, 웹 빌드 결과는 아래 §6에 기록. API의 월 경계 이동/다른 월 이동/3종 캐시 롤백/로그아웃 보호, 화면의 메뉴·팝오버·완료 표시·오늘 복귀·배너 숨김/실패/실행 취소·루틴 뒤 정렬을 검사.
- 브라우저: 임시 검증 데이터로 달력 팝오버 이동 후 양쪽 날짜 집계와 수동 가져오기 후 배너 제거·목록 추가 확인. 라이트 1120×740, 다크 880×600 확인(최소 창 scrollWidth=880, scrollHeight=600). 임시 HTML·데이터 파일은 확인 후 제거. 독립 UI 검토 결과 Ship.
- 새 의존성: `@radix-ui/react-context-menu`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover` — 지시서의 우클릭 메뉴와 더보기·팝오버의 키보드/포커스/충돌 배치 처리. core·DB·Tauri 변경 없음.
- 문서 차이: 날짜 선택은 이번 지시서의 **팝오버**를 따름(`components.md`는 왼쪽 달력 선택 모드). 다크의 완료 체크·선택 날짜 글자는 흰 `ink` 위 대비를 위해 `bg`를 사용(`tokens.md`의 잉크 표면 규칙 적용).
- 사람이 확인할 것: 실제 Tauri/WebView에서 빠른 연속 월 이동 300ms 이하, 월 경계 이동 후 양쪽 월 숫자, 실제 서버에서 8일 전 제외·저장 유지. 브라우저 검증은 모의 데이터였으며 실제 DB 쓰기/네이티브 성능은 미검증. DB 변경이 없어 db:reset·db:test·db:types는 실행하지 않음.

### 5단계 · 루틴 (S5) (~2주)

- [x] `['routines']`, `['routineLogs', monthKey]` 쿼리, `buildDay`·`summarizeMonth`에 루틴 합치기
- [x] 루틴 편집 모달: 매일/매주/매월 + N, 요일·일 선택, 시작·종료일, 다음 5회 미리보기
- [x] 완료 / 완료 취소 / 이날은 건너뛰기
- [x] 수정: 제목·목표는 바로 적용, 규칙 변경 시 적용 범위 다이얼로그 → UPDATE 또는 `split_routine`
- [x] 종료("오늘부터 그만하기") / 완전 삭제, 루틴 목록 화면

**완료 기준:** S5. 분할 직후 어제와 오늘의 표시가 설계대로 나온다.
**→ 이 시점부터 dev 빌드로 투두메이트 대신 사용 시작.**

**구현·검증 기록 (2026-09-18)**
- ROUT-01~04: 매일/매주/매월·간격·요일/날짜·시작/종료일, 활성 목표 선택, 필드별 오류와 다음 5회 미리보기. 말일 규칙은 core를 재사용하고 기존 3년 탐색 한도로 5회 미만일 수 있음을 안내.
- ROUT-05~07: 하루 목록·월 집계에 가상 루틴/로그 연결. 완료·취소·건너뛰기의 겹치는 모든 월 캐시 낙관적 갱신·롤백, 건너뛰기 5초 실행 취소, 인접 월 로그 prefetch. 할 일 날짜 이동도 목적 날짜의 루틴을 포함해 맨 아래로 정렬.
- ROUT-08: 제목·목표·종료일 단독 변경은 UPDATE. 과거 시작 규칙 변경은 범위 확인과 2주 미리보기, 오늘부터 분할 시 어제까지 규칙·로그 보존, 미래 로그 ID 이동. RPC의 미사용 요일/날짜 배열은 null. 분할 성공 후 종료일 저장만 실패하면 실제 분할 상태를 유지하고 오류/종료일만 재시도(중복 분할 방지).
- ROUT-09~10: 목표별 관리·규칙 요약·종료된 루틴 섹션, 종료/삭제 확인·5초 실행 취소. 오늘/미래 시작 종료는 소프트 삭제. 이미 종료된 루틴의 재종료는 기존 기간을 늘리지 않도록 UI·낙관적 캐시·repository에서 방어.
- 검증: `pnpm lint`·`pnpm format:check`·`pnpm typecheck`·`pnpm test` 통과(core 156 + api 60 + desktop 59 = 275검사). `pnpm --filter @nodii/core test:coverage` 통과(문장 99.55%, 분기 99.07%, 함수 100%, 줄 99.46%). `pnpm build:web` 통과(JS 722.98KB, 기존 500KB 청크 경고 유지). 설치된 pnpm 10.28.0을 임시 PATH로 사용. 새 의존성·DB 변경 없음으로 db:reset·db:test·db:types는 미실행.
- 화면 검증: 모의 데이터로 관리·편집·분할 직후 과거 표시, 라이트/다크·최소 880×600 스크롤 확인. 실제 브라우저 반복 방향키 선택, 테스트에서 완료/건너뛰기/실행 취소·저장 실패·분할 실패·종료일 재시도 확인. 임시 검증 파일 제거. 독립 검토의 종료 기간·라디오 접근성/다크 선택 표시 2건을 수정 후 해결 판정받음. Impeccable 전용 에이전트 대신 일반 독립 에이전트로 검토/문서 대조를 수행했으며 기존 디자인 문서는 유지.
- 문서 차이/결정 제안: 범위 선택은 stage-5와 설계서의 직접 적용 버튼을 따름(screens.md는 라디오 선택 후 별도 확인). 관리 행 수정 버튼은 키보드·발견성을 위해 상시 표시. 세그먼트의 얇은 그림자는 토큰 값이 없어 생략하고 기존 focus 링으로 선택 표시; 디자인 문서에 작은 그림자 값을 확정할지는 후속 결정. 기존 증감·메뉴 글리프를 재사용하고 루틴 아이콘은 SVG로 구현. 완전 삭제는 소프트 삭제라 로그 행은 보존되며, 확인 문구는 루틴 1개와 모든 날짜의 기록이 숨겨짐을 설명.
- 사람이 확인할 것: 실제 Tauri/VoiceOver·실계정에서 매월 31일의 9월 30일/2월 말일, 두 범위 적용 후 지난주 표시와 재실행 저장 유지, 건너뛰기→실행 취소. 실제 서버 쓰기·네이티브 성능은 이번 모의 브라우저 검증에 포함되지 않음.

### 6단계 · 실시간 동기화 + 오프라인 읽기 (~1주)

- [x] Realtime 채널 구독, 이벤트를 `updated_at` 비교 후 캐시에 패치
- [x] DELETE 이벤트 처리 (내 캐시에 있는 키만 반영, 버전별 구독 차이는 아래 기록)
- [x] 오프라인 배너, TanStack Query persister (plugin-store)
- [x] 자정이 지나면 `today` 갱신

**완료 기준:** 앱 두 개에 같은 계정으로 로그인해서 한쪽 변경이 몇 초 안에 다른 쪽에 반영 (MVP 완료 기준 2).

**구현·검증 기록 (2026-09-19)**
- SYNC-03: 사용자별 단일 Realtime 채널, 매퍼 기반 캐시 패치·마이크로초 정밀도의 `updated_at` 비교. 할 일 날짜 이동은 기존 모든 월에서 제거하고 새 날짜가 속한 캐시된 월에만 삽입. 목표/할 일/루틴 소프트 삭제와 로그 복합 PK 변경·DELETE 처리, overdue 무효화. 재연결 시 모든 서버 쿼리 무효화, 주 시작 요일 변경은 기존 채널에서 최신 설정을 읽음. StrictMode/빠른 재로그인 시 해제 중인 topic을 재사용하지 않도록 구독별 이름을 부여.
- SYNC-04·AUTH-03: 사용자별 QueryClient와 저장 키로 계정 격리, 별도 `query-cache.json`(브라우저는 localStorage), 앱 버전 buster·7일 maxAge/gcTime. 복원 완료 후 쿼리/prefetch/구독 시작, 낙관적 쓰기가 끝나기 전에는 디스크 캐시 저장 보류. 로그아웃 시 진행 중 저장/복원을 폐기하고 직렬 삭제해 늦은 응답으로 캐시가 되살아나지 않게 함. 보관 실패는 토스트로 안내.
- SYNC-04·NFR-12: navigator·online/offline·포커스·채널 상태·실제 fetch 실패를 합쳐 onlineManager와 `useConnectivity`에 연결. 모든 데이터 mutation은 onMutate 및 요청 직전에 검사하여 오프라인 캐시 변경·요청·큐잉 차단. 상단 안내와 체크/목표 추가 비활성 스타일, 저장 시도 시 한국어 토스트. 갱신 실패에도 기존 목록 유지.
- NFR-01·날짜: 저장된 계정/Query 캐시를 먼저 읽어 만료 토큰 갱신과 버전 조회가 느려도 목록을 표시(버전 미달 결과가 도착하면 기존 차단 화면 적용). 1분 간격 및 focus/visibilitychange에서 기기 시간대로 today 재계산. 오늘을 보던 경우만 선택 날짜 이동, overdue 키도 새 날짜로 변경.
- 검증: `pnpm lint`·`pnpm format:check`·`pnpm typecheck`·`pnpm test` 통과(core 156 + api 72 + desktop 79 = 307검사). `pnpm build:web` 통과(JS 734.40KB, 기존 500KB 청크 경고 유지). pnpm 10.28.0을 임시 PATH로 사용. 오프라인 쓰기 3종·큐 없음, 사용자/버전/기간 분리·저장/삭제 경합·만료 세션의 느린 초기화 중 900ms 이내 캐시 화면 복원, 자정/복귀 및 최신 weekStart/재연결/해제를 테스트.
- 실제 연동: 로컬 Supabase의 독립 JS 클라이언트 2개를 같은 OTP 계정으로 연결해 추가·완료 체크·월 경계 이동·루틴 완료/취소·분할 후 로그 ID 변경까지 실제 이벤트/캐시 반영 확인. 기본 replica identity의 DELETE에 `(routine_id, date)`가 모두 오는 것 확인. 모의 데이터 브라우저에서 880×600 라이트/다크, 오프라인 배너·체크 차단 토스트·scrollWidth=880/scrollHeight=600 확인. 임시 검증 파일 제거.
- 새 의존성: `@tanstack/react-query-persist-client` 5.103.1 — 지시서의 캐시 복원/영속화 수명 관리. 추가된 간접 의존성은 `@tanstack/query-persist-client-core`이며, 저장소 어댑터는 기존 plugin-store로 구현. core·DB 스키마·Tauri 권한 변경 없음. DB 스키마 변경이 없어 db:reset·db:test·db:types는 실행하지 않음.
- 문서 차이/설계 제안: **4개 사용자 필터 구독 + 루틴 로그 DELETE 전용 무필터 구독 1개**를 단일 채널에 연결. 로컬 Realtime v2.130.0은 DEFAULT replica identity에서 `user_id` 필터가 있는 구독에 DELETE를 전달하지 않음(같은 삭제를 무필터 진단 구독은 수신). PK만으로 충분하므로 FULL/스키마 변경 대신 실제 물리 삭제를 허용한 로그만 보완하고 내 캐시에 있는 키만 제거. 최신 [Supabase DELETE 문서](https://supabase.com/docs/guides/realtime/postgres-changes#delete-events)와 로컬 검증이 지시서/G4의 ‘필터가 적용되지 않음’ 설명과 다름. 설계서 §6.2/G4 및 지시서에 이 버전 차이를 반영할 것을 제안하며 기준 설계 문서는 직접 수정하지 않음.
- 사람이 확인할 것: **MVP 완료 기준 2의 Tauri + 브라우저 조합은 아직 수동 확인 필요.** `pnpm dev`/`pnpm dev:web` 동일 계정에서 양방향 변경, Wi-Fi 끄기/켜기와 끊긴 동안 다른 기기의 변경 복구, Tauri 완전 종료 후 오프라인 실행 시 plugin-store 복원, 네이티브 시작 1초 이하 성능. JS 클라이언트 연동과 jsdom/브라우저 검증이 네이티브 검증을 대신하지 않음.

### 7단계 · 설정 + Should 항목 (~1주)

- [ ] 설정 화면: 주 시작 요일, 테마, 로그아웃, **계정 삭제**, 개인정보처리방침·이용약관·지원 링크, 앱 버전
- [ ] 단축키: `⌘N`, `⌘T`, `←/→`, `⌘,` (메뉴와 연결)
- [ ] 드래그 정렬(목표, 할 일), HEX 색상 입력, 목표 완전 삭제 확인 창, 할 일 삭제 실행 취소 검증(3단계 구현)
- [ ] Could 항목(메뉴 막대 빠른 추가, 캘린더로 드래그, 다른 목표로 이동, 복제)은 출시 후로

### 8단계 · 출시 준비 + 심사 (~1~2주 + 심사)

- [ ] CI 배포 파이프라인 (설계서 §11.3), GitHub Secrets 등록
- [ ] 클라우드 `nodii` 프로젝트: 마이그레이션 적용, 커스텀 SMTP 연결, 이메일 템플릿에 `{{ .Token }}`, 스파이크·베타 테스트 계정 정리
- [ ] 개인정보처리방침 · 이용약관 · 지원 페이지 게시
- [ ] 심사용 데모 계정 + 예시 데이터
- [ ] App Store Connect: 스크린샷, 개인정보 라벨, 심사 노트
- [ ] 개발에 쓰지 않은 다른 맥에서 TestFlight 설치 확인 (MVP 완료 기준 4)
- [ ] 1주일 동안 Nodii만 사용 (MVP 완료 기준 3)
- [ ] 설계서 §11.4 체크리스트 확인 후 심사 제출

---

## 4. 작업 방식

| 항목 | 규칙 |
|---|---|
| 브랜치 | `main`은 항상 동작하는 상태. 기능마다 `feat/<단계>-<이름>` 브랜치 → PR → CI 통과 후 병합 |
| 커밋 | **메시지는 항상 영어**(Conventional Commits), 요구사항 ID를 붙인다. 예: `feat(day-list): move todo to another date (TODO-05)` |
| 스키마 | 마이그레이션 파일로만 변경. local에서 검증 → 클라우드 `nodii`에 적용. 대시보드에서 직접 수정하지 않음 |
| 테스트 | core는 테스트 먼저, DB 규칙은 pgTAP, 화면은 주요 인터랙션만 컴포넌트 테스트 |
| 비밀 값 | `.env.local`, `.env.production.local`, 프로비저닝 프로파일, 인증서, 심사 계정 비밀번호는 커밋하지 않음 |
| 문서 | 설계가 바뀌면 `02-system-design.md` 버전을 올리고 ADR 표에 기록 |

### ADR 검증 시점
| ADR | 내용 | 확정 시점 |
|---|---|---|
| ADR-003 | 루틴 가상 전개 | 1단계 (core 테스트) + 5단계 |
| ADR-004 | fractional indexing | 1단계 (정렬 키 헬퍼) + 7단계 (드래그) |
| ADR-005 | 할 일 날짜 `date` 타입 | 1단계 (DST·시간대 테스트) |
| ADR-006 | pnpm 모노레포 | 0단계 |
| ADR-013 | 심사용 데모 계정 비밀번호 로그인 | 2단계 + 8단계 |
| ADR-014 | 최소 지원 버전 | 2단계 |

---

## 5. 설계서 보완 사항 (구현 전에 반영)

| # | 내용 | 조치 | 반영 단계 |
|---|---|---|---|
| G1 | **계정 삭제(AUTH-06) 구현 방법이 없음.** 클라이언트는 `auth.users`를 지울 수 없음 | `security definer` RPC `delete_my_account()`가 `auth.users`에서 본인 행을 삭제 (나머지는 `on delete cascade`). `authenticated`에만 실행 권한 | 1단계 ✅ |
| G2 | `profiles.timezone` 기본값이 `UTC`이고 갱신 흐름이 없음 | 로그인 직후 `Intl.DateTimeFormat().resolvedOptions().timeZone`과 다르면 UPDATE | 2단계 |
| G3 | CSP `connect-src`에 Realtime WebSocket 주소가 빠짐 | `https://*.supabase.co wss://*.supabase.co` (로컬 개발용 `127.0.0.1:54321` 포함) — 0단계 스캐폴드에 반영함 | 0단계 ✅ |
| G4 | Realtime DELETE 이벤트는 필터가 적용되지 않음. 루틴 완료 취소는 행 삭제 | 받은 기본 키가 내 캐시에 있을 때만 반영 | 6단계 |
| G5 | Universal 빌드에는 Rust 타깃 2개가 필요 | `rustup target add aarch64-apple-darwin x86_64-apple-darwin` | 0단계 |
| G6 | 개발용 빌드에 프로비저닝 프로파일·샌드박스가 걸리면 `tauri dev`/일반 빌드가 불편함 | App Store 전용 설정을 `tauri.appstore.conf.json`으로 분리하고 빌드 때 `--config`로 합침 — 0단계 스캐폴드에 반영함 | 0단계 ✅ |

---

## 6. 진행 기록


| 날짜 | 단계 | 내용 |
|---|---|---|
| 2026-09-17 | 0 | 계획서 작성. 모노레포 스캐폴드 생성 (core·api·desktop, supabase 초기화, CI, App Store 설정 분리) |
| 2026-09-17 | 0 | Supabase 클라우드 프로젝트 `nodii` 1개로 결정·생성 (무료 플랜 슬롯 제약, 설계서 v1.1). `.env.production.local` 작성. 환경 점검 스크립트 `pnpm check-env` 추가 |
| 2026-09-17 | 0 | **배포 스파이크 통과.** Universal 빌드 → `.pkg` 서명 → Transporter 업로드 → TestFlight 내부 테스트 설치. 샌드박스에서 Supabase 네트워크·plugin-store 저장/재실행 유지 모두 성공. 과정에서 고친 것: 스크립트를 `bash`로 실행(실행 권한), 점검 명령 이름 `check-env`(pnpm 내장 `doctor`와 충돌), `.pkg` 전 앱 파일 권한 정리(ITMS-90255). 남은 0단계: 도메인·Resend·SMTP, CI 확인 |
| 2026-09-17 | 0 | 도메인 `nodii.app` 구매, Resend 발신 도메인 `mail.nodii.app` Verified. 요구사항 v1.1(Q9 실제 값)·설계서 v1.2 반영. 남은 0단계: SMTP 연결(C3~C5), CI 확인 |
| 2026-09-17 | 0 | **0단계 완료.** Resend SMTP를 Supabase `nodii`에 연결(발신 `no-reply@mail.nodii.app`), 메일 템플릿 `{{ .Token }}`·OTP 6자리/600초 설정, GitHub Actions CI 통과 확인. 인증 메일 실제 수신은 2단계에서 확인 |
| 2026-09-17 | 1a | DB 마이그레이션 3개, OTP 개발 seed, pgTAP 7파일·122검사, DB 타입 생성, CI db 잡 활성화(Supabase CLI 2.117.0). `pnpm db:reset`·`pnpm db:test`·`pnpm db:types` 및 lint·format:check·typecheck·test(18검사) 통과. 보안 진단 경고 없음, 독립 연결 2개의 동시 목표 보관 방어 확인. 설계 SQL 보완 내용은 위 1단계 DB 항목에 기록. 사람 확인: Studio 테이블/RLS, 로컬 OTP 수신, 푸시 후 GitHub db 잡. |
| 2026-09-17 | 1a | NFR-06 권한 보완: 사용자 요청에 따라 기존 init 마이그레이션에서 사용자 테이블 5개의 anon SELECT 권한을 제거하고 `app_config` 읽기는 유지. `has_table_privilege` 5개 검사와 실제 SELECT 권한 오류 검사 추가. `pnpm db:reset`·`pnpm db:test`(127검사)·`pnpm db:types` 및 lint·format:check·typecheck·test(18검사) 통과. 타입 변경 없음, 보안 진단 경고 없음. |
| 2026-09-17 | 1a | 점검 반영: 설계서 v1.3(테이블 권한·물리 DELETE 제한·활성 목표 잠금·`delete_my_account`·RPC 타입 주의, ADR-017). 5단계 지시서에 `split_routine` null 인자 주의 추가 |
| 2026-09-17 | 1b | `@nodii/core` 날짜·반복 판정/미리보기·하루 목록/월 집계·수정 범위/검증·정렬 키·지난 할 일 가져오기 계획 구현. 테스트 먼저 작성, core 7파일 117검사 통과(문장/함수/라인 100%, 분기 98.37%, 기존 임계값 90% 유지). `pnpm lint`·`pnpm format:check`·`pnpm typecheck`·`pnpm test`(core 117 + api 4)·`pnpm --filter @nodii/core test:coverage` 및 `TZ=America/Vancouver pnpm --filter @nodii/core test` 통과. 순수 런타임 의존성 `fractional-indexing` 4.0.0 추가. Git에서 제외한 로컬 에이전트 스킬이 lint 대상에 들어가던 기존 설정을 동일 경로 제외로 보완. DB/API/desktop 변경 없음으로 DB 검증은 미실행. ADR-003·004·005 검증 요약은 위 core 항목 참조. 사람 확인: PR/CI 및 ADR 상태 확정 검토, UI 통합은 후속 단계. |
| 2026-09-17 | 1b | TODO-10·ROUT-01 후속 수정: `todayItems`로 할 일·전개 루틴의 목표별 최대 정렬 키를 반영하고, 반복 종류에 맞지 않는 배열을 거부하도록 검증 강화. 테스트 먼저 추가하여 실패 확인 후 구현, core 127검사 통과(문장/함수/라인 100%, 분기 98.95%). `pnpm lint`·`pnpm format:check`·`pnpm typecheck`·`pnpm test`(core 127 + api 4)·`pnpm --filter @nodii/core test:coverage` 통과. 새 의존성 없음. DB 변경이 없어 DB 검증은 미실행. 문서의 null/빈 배열 설명 차이는 위 후속 보완에 기록. 사람 확인: PR/CI와 설계서 설명 정정 검토. |
| 2026-09-17 | 디자인 | 디자인 기준 확정. `DESIGN.md`와 `docs/design/`(토큰·컴포넌트·화면 스펙) 추가, 화면 시안은 Claude 디자인 캔버스(메인 라이트·다크, 로그인, 목표 관리, 루틴 편집·관리·적용 범위, 설정, 업데이트 안내, 스타일 기초). UI 단계(2~5, 7) 지시서와 AGENTS.md에 읽을 문서로 연결. 남은 일: 드래그 중 모습, 첫 로그인 빈 상태, 정보 링크 실제 주소. |

| 2026-09-17 | 2 | AUTH-01/02/03/07/08·SET-05 인증 및 앱 셸 구현, G2 시간대 동기화·최소 버전 게이트·시스템 테마·공통 오류 토스트 추가. 필수 검사 4종(186검사)·core 커버리지·웹 빌드 통과. 로컬 실제 OTP 가입/새로고침 세션 유지/로그아웃·기본 목표·시간대 확인. 기존 opener에 App Store URL 범위만 추가. 기본 목표 색 문서 차이, Tauri 재실행·스토어 이동 사람 확인, 6단계 persister 후속 사항은 위 검증·보완 참조. |
| 2026-09-17 | 2 | AUTH-03 오프라인 로그아웃 보완: 네트워크 오류 시 Query 캐시·인증 저장소 정리 후 `localOnly: true` 반환, “이 기기에서 로그아웃했어요” 토스트 표시. 그 외 오류와 저장소 정리 실패는 실패 유지. 정상/네트워크/기타 오류 결과와 MSW 네트워크 차단 시 로그인 화면 전환·인증 키 삭제를 검증. `pnpm lint`·`pnpm format:check`·`pnpm typecheck`·`pnpm test` 통과(core 141 + api 28 + desktop 22 = 191검사). 새 의존성·DB 변경·설계 차이 없음으로 DB 검증은 미실행. 사람 확인: Tauri에서 네트워크를 끊고 로그아웃한 뒤 앱 재실행 시 로그인 화면 유지. |

| 2026-09-17 | 3 | GOAL-01/02/03(대비)/05/07·TODO-01~04/09 목표·하루 목록 구현. 공통 낙관적 갱신·인접 월 롤백·서버 메타데이터, 오류 재시도·5초 실행 취소·프로필 주 시작 요일 적용. 필수 검사 4종 226검사·core 커버리지·웹 빌드 통과, 로컬 실제 S1/S2 및 라이트/다크·최소 창 확인. 의존성/DB 변경 없음. I3 해석·실행 취소 선행·전체 개수 표시 후속·Tauri 사람 확인은 위 기록 참고. |

| 2026-09-17 | 3 | TODO-09 헤더 집계 보완: `DayView`에서 `buildDay`를 한 번 계산해 `DayHeader` 전체·완료 개수와 `DayList` 렌더링·빈 상태가 같은 결과를 사용하도록 수정. 삭제된 목표의 완료/미완료 항목·다른 날짜 항목 제외, 보관 목표의 표시 항목 포함, 숨겨진 항목만 남은 빈 상태를 회귀 테스트 2개로 검증(수정 전 실패 확인). `pnpm lint`·`pnpm format:check`·`pnpm typecheck`·`pnpm test` 통과(core 156 + api 39 + desktop 33 = 228검사). 새 의존성·DB·디자인 변경 없음으로 DB 검증은 미실행. 결정 사항·필수 수동 확인 없음. |

| 2026-09-17 | 4 | CAL-01~05·TODO-05/10 월간 캘린더·Radix 메뉴/날짜 팝오버·지난 할 일 가져오기 구현. 겹치는 월/overdue 낙관적 이동·실패 롤백·5초 실행 취소, todayItems 루틴 뒤 정렬·인접 월 prefetch 검증. `pnpm lint`·`pnpm format:check`·`pnpm typecheck`·`pnpm test` 모두 통과(core 156 + api 45 + desktop 43 = 244검사), `pnpm build:web` 통과(JS 693.33KB, 기존 500KB 청크 경고 유지). 설치된 pnpm 10.28.0을 임시 PATH로 사용. 모의 데이터 브라우저 S3/S4/S6 경로·라이트/다크·최소 창 확인, 임시 검증 파일 제거. Radix 메뉴/팝오버 3개 의존성 추가. DB 변경이 없어 DB 검증 미실행. 실제 Tauri 월 이동 300ms·실제 서버 저장과 8일 전 제외는 사람 확인. 날짜 선택 방식·다크 도장 대비 해석은 위 4단계 기록 참조. |

| 2026-09-17 | 4 | TODO-05·NFR-08 후속 수정: `DayView`가 전달한 `profile.timezone`을 `DayList` → `TodoRow` → `TodoMenu.moveTo`의 `buildDay`에 전달해 UTC 고정값 제거. UTC와 보관 날짜가 다른 Vancouver·Seoul 회귀 테스트 2개를 먼저 작성해 실패 확인 후 수정. 실제 core 계산을 유지하며 목적 날짜의 시간대 인자·보관 목표 마지막 키 뒤의 UPDATE 키·이동 후 표시 순서를 검증하고 다른 날짜/목표의 키를 제외함. 4단계는 루틴이 비어 있어 시간대 전달과 할 일 정렬을 각각 검증. `pnpm lint`·`pnpm format:check`·`pnpm typecheck`·`pnpm test` 통과(core 156 + api 45 + desktop 45 = 246검사). 새 의존성·DB·디자인 변경 없음으로 DB 검증 미실행. 결정 사항·필수 수동 확인 없음. |

| 2026-09-18 | 5 | ROUT-01~10 루틴 API·가상 전개 연결·편집/범위/관리 화면 구현. 겹치는 월 로그 낙관적 갱신·분할 롤백·부분 실패 재시도·5초 실행 취소, 이미 종료된 기간 보호, 키보드 라디오 검증. 필수 4종 275검사·core 커버리지·웹 빌드 통과. 모의 데이터 라이트/다크·최소 창 확인, 새 의존성·DB 변경 없음. 문서 차이·실제 Tauri/서버 확인은 위 5단계 기록 참고. |

| 2026-09-18 | 5 | ROUT-05~09 후속: 로그 쓰기를 `['write','routineLog', routineId, date]`, 생성·수정·종료·삭제를 `['write','routine', routineId]`로 분리. `useSplitRoutine`만 기존 공유 키를 사용하고 `exact: true`로 분할 중 편집 제한 유지. 하루 행은 자신의 규칙·해당 날짜 로그만, 편집·관리 화면은 해당 루틴의 모든 날짜 로그를 관찰하며 날짜별 행 마운트로 재시도 키를 보존. 분할 후 종료일 재시도는 새 루틴의 행 키 사용. 지연된 첫 체크 중 다른 루틴 체크·첫 실패 시 두 번째 완료 보존, 같은 루틴의 다른 날짜 체크, 수정/종료/삭제의 개별 잠금, 분할 중 다른 편집기 비활성 회귀 검증. 필수 4종 통과(core 156 + api 60 + desktop 64 = 280검사). 새 의존성·DB·비주얼 변경 없음으로 DB 검증 미실행. 별도 제품 결정·필수 수동 확인 없음. |

| 2026-09-19 | 6 | SYNC-03/04·AUTH-03·NFR-01/12 실시간 캐시 패치, 사용자별 영속 캐시/로그아웃 정리, 오프라인 쓰기 차단, 자정/복귀 날짜 갱신 구현. 필수 검사 4종 307검사·웹 빌드 통과. 실제 로컬 JS 세션 2개에서 추가/체크/이동/루틴 완료·취소/분할 확인, 최소 창 라이트·다크·차단 토스트 확인. Realtime v2.130.0의 필터 DELETE 미전달을 로그 DELETE 전용 구독으로 보완(단일 채널, 총 5개 바인딩), FULL/DB 변경 없음. Tauri+브라우저 및 네이티브 오프라인 재실행·시작 성능은 수동 확인 필요. |
