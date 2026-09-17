# Nodii 구현 계획서 (MVP)

> 버전 1.0 · 2026-09-17 · 근거 문서: `01-requirements.md` v1.1, `02-system-design.md` v1.2
> 상태: **진행 중 — 0단계 완료 (2026-09-17), 다음은 1단계.** 단계가 끝날 때마다 체크박스와 §6 진행 기록을 갱신합니다.

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

**완료 기준:** `supabase test db` 통과, core 커버리지 90% 이상. ADR-003·004·005 확정.

### 2단계 · 인증 + 앱 셸 (~1주)

- [ ] `@nodii/api`: plugin-store 저장소 어댑터를 넣은 Supabase 클라이언트
- [ ] 로그인 화면: 이메일 → 6자리 코드 (붙여넣기, 60초 재전송 카운트다운, 오류 안내)
- [ ] 심사 계정 분기: `REVIEW_ACCOUNT_EMAIL`일 때만 비밀번호 입력 (AUTH-08)
- [ ] 세션 복원, 로그아웃 시 Query 캐시와 persister 삭제
- [ ] 로그인 직후 `profiles.timezone`을 실제 시간대로 갱신 (§5 보완 사항)
- [ ] 최소 지원 버전 확인 (§6.7), QueryClient · 레이아웃 뼈대 · 토스트
- [ ] 로컬 개발은 Supabase 로컬 메일 확인 도구(`localhost:54324`)로 OTP 수신

**완료 기준:** 새 이메일로 가입 → 기본 목표 "할 일" 생성 → 앱 재실행 시 로그인 유지 → 로그아웃 시 로그인 화면.

### 3단계 · 목표 + 하루 목록 (S1, S2) (~1.5주)

- [ ] 공통 낙관적 업데이트 헬퍼 (스냅샷 → 요청 → 실패 시 롤백 + "저장하지 못했어요 · 다시 시도")
- [ ] `['goals']`, `['todos', monthKey]` 쿼리 → `buildDay`로 선택 날짜 목록
- [ ] 할 일 추가(목표 옆 `+`), 체크, 인라인 수정, 삭제
- [ ] 목표 관리 시트: 생성, 이름·프리셋 색상, 보관/보관 해제, 마지막 활성 목표 버튼 비활성화
- [ ] 날짜 헤더, ←/→ 이전·다음 날

**완료 기준:** S1, S2를 실제 데이터로 수행. 네트워크를 끊고 체크하면 롤백과 토스트가 뜬다.

### 4단계 · 캘린더 + 날짜 이동 + 가져오기 (S3, S4, S6) (~1주)

- [ ] 월간 캘린더 (남은 개수, 완료 표시, 오늘 강조, [오늘] 버튼), 이전/다음 달 prefetch
- [ ] 컨텍스트 메뉴: 내일로 · 오늘로 · 날짜 선택 (두 monthKey 캐시 패치)
- [ ] `['overdue', today]` 쿼리 + 가져오기 배너 + `move_todos`

**완료 기준:** S3, S4, S6. 월 이동 300ms 이하.

### 5단계 · 루틴 (S5) (~2주)

- [ ] `['routines']`, `['routineLogs', monthKey]` 쿼리, `buildDay`·`summarizeMonth`에 루틴 합치기
- [ ] 루틴 편집 모달: 매일/매주/매월 + N, 요일·일 선택, 시작·종료일, 다음 5회 미리보기
- [ ] 완료 / 완료 취소 / 이날은 건너뛰기
- [ ] 수정: 제목·목표는 바로 적용, 규칙 변경 시 적용 범위 다이얼로그 → UPDATE 또는 `split_routine`
- [ ] 종료("오늘부터 그만하기") / 완전 삭제, 루틴 목록 화면

**완료 기준:** S5. 분할 직후 어제와 오늘의 표시가 설계대로 나온다.
**→ 이 시점부터 dev 빌드로 투두메이트 대신 사용 시작.**

### 6단계 · 실시간 동기화 + 오프라인 읽기 (~1주)

- [ ] Realtime 채널 구독, 이벤트를 `updated_at` 비교 후 캐시에 패치
- [ ] DELETE 이벤트 처리 (필터가 적용되지 않으므로 캐시에 있는 키만 반영)
- [ ] 오프라인 배너, TanStack Query persister (plugin-store)
- [ ] 자정이 지나면 `today` 갱신

**완료 기준:** 앱 두 개에 같은 계정으로 로그인해서 한쪽 변경이 몇 초 안에 다른 쪽에 반영 (MVP 완료 기준 2).

### 7단계 · 설정 + Should 항목 (~1주)

- [ ] 설정 화면: 주 시작 요일, 테마, 로그아웃, **계정 삭제**, 개인정보처리방침·이용약관·지원 링크, 앱 버전
- [ ] 단축키: `⌘N`, `⌘T`, `←/→`, `⌘,` (메뉴와 연결)
- [ ] 드래그 정렬(목표, 할 일), HEX 색상 입력, 목표 완전 삭제 확인 창, 할 일 삭제 실행 취소
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
