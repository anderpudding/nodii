# 신규 가입 기본 목표 현지화 결과

> 2026-10-29 · AUTH-04 / SET-06 · 브랜치 `feat/i18n-default-goal`

## 한 일

- **AUTH-04:** `public.handle_new_user()`의 고정 이름을 신규 가입 언어에 따라 선택하도록 새 마이그레이션 `20261029212430_localize_default_goal.sql`을 추가했다. 기존 마이그레이션은 수정하지 않았다.
- **SET-06:** 데스크톱의 최초 코드 요청과 재전송 모두 요청 시점의 `getLocale()`을 공유 API `sendOtp()`에 전달한다. 기본 `system` 설정은 기존 OS 언어 결정 규칙을 사용하고, 사용자가 선택한 언어가 있으면 그 설정을 따른다.
- 공유 API는 선택 인자 `signupLocale?: 'ko' | 'en'`을 받아 Supabase `options.data.signup_locale`에 넣는다. 기존 두 인자 호출은 요청 형식까지 유지한다. API에 i18n·React·Tauri 의존성을 추가하지 않았다.
- 기본 목표는 설치마다 생기는 것이 아니라 `auth.users` 신규 행 INSERT 때 생성된다. 첫 OTP 요청에서 계정이 만들어질 때 이름을 한 번 정하고, 이후 재로그인·언어/메타데이터 변경으로 기존 목표나 사용자 편집 이름을 바꾸지 않는다.

| 신규 가입의 언어 힌트 | 생성 이름 |
| --- | --- |
| `en` | `Todos` |
| `ko` | `할 일` |
| 미전달·null·잘못된 값 | `할 일` (기존 클라이언트 호환) |

`Todos`는 I3 용어집의 `todo / todos`를 적용한 목표 제목이다. 한국어 카탈로그 값과 화면 문구, 기존 한국어 테스트 기대값은 변경하지 않았다. 기본 색 `#4F7CFF`, 정렬 키 `a0`, 계정당 활성 목표 하나 생성도 유지한다.

## 보안과 데이터 범위

- `signup_locale`은 사용자 편집 가능한 메타데이터이므로 두 이름을 고르는 힌트로만 쓴다. 접근 권한·RLS·기기 언어 설정에는 사용하지 않는다. 임의 이름이나 권한 필드를 메타데이터에 넣어도 생성 이름이나 권한에 반영하지 않는다.
- 가입 트리거의 기존 `security definer`·빈 `search_path`·스키마 명시를 유지하고, `public`·`anon`·`authenticated`의 직접 함수 실행 권한을 회수했다. 새 테이블·클라이언트 RPC·정책은 추가하지 않았다.
- 구현 검증은 포트를 분리한 임시 프로젝트 `nodii-default-goal-check`에서 초기화·가입·DB 테스트를 실행하고 종료했다. 사용 중인 로컬 `nodii` DB는 유지했다. 이후 사용자 요청으로 원격 DB에 같은 마이그레이션을 적용했다(아래 원격 적용 기록).

## 검증

| 명령 / 확인 | 결과 |
| --- | --- |
| `pnpm lint` | 통과 |
| `pnpm format:check` | 통과 |
| `pnpm typecheck` | 통과 |
| `pnpm test` | **681개 통과**: core167·i18n33·api82·desktop157·mobile Vitest137/RNTL105 |
| `pnpm db:reset --workdir /private/tmp/nodii-default-goal-check` | 전체 마이그레이션·seed 적용 통과 |
| `pnpm db:test --workdir /private/tmp/nodii-default-goal-check` | **159개 통과**, 신규 가입 언어·호환·기존 이름 보존·RLS/실행 권한 14개 포함 |
| `pnpm db:types --workdir /private/tmp/nodii-default-goal-check` | 초기화 완료 후 재생성 통과, 기존 타입과 차이 없음 |
| `supabase db advisors --local --type security --workdir /private/tmp/nodii-default-goal-check` | `No issues found` |
| 실제 공유 `sendOtp()` → 로컬 Auth HTTP → 가입 트리거 | 영어·한국어·언어 미전달의 테스트 계정 각각 `Todos`·`할 일`·`할 일`, 목표 하나씩 생성 확인 |
| 기존 한국어 파일 보존 | 카탈로그·기존 한국어 테스트 파일 변경 없음. 기존 DB 가입 테스트의 `할 일` 기대값도 그대로 통과 |

새 API 테스트 2개는 locale 전달을, 데스크톱 테스트 5개는 OS 영어/한국어·명시적 언어 우선·재전송 시 언어 재조회를 검증한다. 전체 테스트의 기존 모바일 act/GoTrueClient 경고와 CLI 타입 생성의 MaxListeners 경고는 실패 없이 유지됐다. 초기화 도중 먼저 실행한 타입 출력은 복구하고, 초기화 완료 후 재생성한 최종 결과로 확인했다.

새 의존성·플러그인·capability·환경 변수 없음. 웹 프로덕션/서명 빌드·원격 CI·영어/한국어 OS의 실제 Tauri 신규 가입은 이번 작업에서 실행하지 않았다.

## 배포와 사람이 확인할 것

1. DB 마이그레이션 → 데스크톱 코드 순서로 배포한다. 사용자 요청으로 원격 DB 적용은 완료했다. 신규 계정에 언어 힌트를 보내려면 이번 변경을 포함한 데스크톱 앱을 사용해야 한다.
2. 영어 OS의 언어 설정 `System`에서 **새 이메일**로 가입해 `Todos`를, 한국어 OS에서 `할 일`을 확인한다. 이미 가입한 계정은 이름이 자동 변경되지 않는다.
3. 언어를 바꾸거나 다른 기기로 로그인해도 저장된 목표 이름이 유지되고, 사용자가 직접 이름을 바꿀 수 있는지 확인한다.
4. iOS는 I5에서 OS 로케일과 `sendOtp()`의 세 번째 인자를 연결한다. 현재 모바일 호출은 기존 한국어 기본값을 유지한다.

## 원격 적용 기록 (2026-10-29)

- 사용자 요청에 따라 연결 정보와 Supabase 프로젝트 목록을 대조해 원격 `nodii`(`hwipekipumrnpriytqbe`)를 확인했다. 기존 5개 마이그레이션 이력과 가입 트리거가 로컬 기준과 일치했다.
- `supabase db push --linked --project-ref hwipekipumrnpriytqbe --skip-vault --dry-run`에서 적용 대상이 `20261029212430_localize_default_goal.sql` 한 개임을 확인한 뒤, 같은 명령의 `--dry-run`을 `--yes`로 바꿔 적용했다. seed·roles·vault는 변경하지 않았다.
- 원격 이력에 버전 `20261029212430` / 이름 `localize_default_goal`이 기록됐고, 함수 정의·활성 INSERT 트리거 하나·빈 `search_path`·`security definer`·anon/authenticated 직접 실행 불가를 확인했다.
- 원격 트랜잭션에서 영어·한국어·미전달·미지원·null 메타데이터의 임시 사용자 5개로 프로필/활성 목표 하나씩 생성, 이름·색·정렬 키, 메타데이터 변경 시 기존/사용자 편집 이름 보존을 검증했다. **전부 통과 후 ROLLBACK**했고 테스트 사용자가 남지 않았음을 별도 조회로 확인했다. 기존 사용자 목표를 수정하는 SQL은 실행하지 않았다.
- 적용 전후 보안 진단을 비교해 가입 트리거의 anon/authenticated 직접 실행 경고가 사라졌음을 확인했다. 기존 `delete_my_account()`의 authenticated 실행 경고(계정 삭제용 RPC)와 유출 비밀번호 보호 비활성 경고는 이번 변경과 별개로 유지되며, 관련 설정은 바꾸지 않았다.
- 앱 소스와 마이그레이션 SQL은 직전 검증 이후 바뀌지 않아 필수4종681검사·격리 DB159검사/reset/types는 반복하지 않았다. 이번 후속에서는 원격 dry-run·적용·이력/정의/권한 조회·트랜잭션 검증·보안 진단과 문서 포맷 검사를 실행했다. 실제 Tauri 신규 가입 수동 확인은 남아 있다.

## 문서 차이와 설계 제안

사용자 요청에 따라 요구사항 AUTH-04를 두 언어의 초기 이름으로 갱신했다. `docs/02-system-design.md`의 가입 트리거 SQL은 고정 `할 일`을 기술하고 있으므로, 다음 설계 문서 개정 때 `signup_locale` 허용값·한국어 호환 기본값·가입 시 한 번 생성하는 규칙을 반영할 것을 제안한다. AGENTS 규칙에 따라 설계서는 직접 수정하지 않았다. 기존 기본 목표 색과 디자인 토큰 사이의 차이는 이번 범위에서 유지했다.

근거: [Supabase OTP 옵션](https://supabase.com/docs/reference/javascript/auth-signinwithotp), [사용자 데이터와 가입 트리거](https://supabase.com/docs/guides/auth/managing-user-data). 설치된 SDK의 `options.data` 요청 구현과 최신 공식 문서·변경 이력을 확인했다.
