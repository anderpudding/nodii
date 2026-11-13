# S3 — 팔로우 · 친구 찾기 · 목록 · 차단 · 신고

> 기준: `docs/16-v3-social-plan.md` SOC-06·08·10~13·38(머리)·60~64·D25·D27·D28·D32, S1 스키마(`supabase/migrations/20261112*`, `S1-db.md`), S2 결과(`S2-profile.md` "검증 기록"). 화면: `docs/design/screens.md`·`mobile-screens.md`의 v3 절, `components.md` "v3 소셜"(`FollowButton`), `tokens.md` §9. 규칙: `AGENTS.md` §5 "소셜 (v3)"·§6.
> 브랜치: `feat/s3-follow`. macOS와 iOS를 **같이** 만듭니다.

## 0. 범위

**완료 기준(계획서 §8): 두 계정이 서로 팔로우·언팔로우·팔로워 내보내기·차단·차단 해제를 주고받고, 신고가 `reports`에 쌓이며 지원 메일함에 알림 메일이 온다.** 두 앱 모두.

- **한다**: 팔로우·언팔로우(§4.1), 친구 찾기(§4.2), 팔로잉·팔로워 목록과 팔로워 내보내기(§4.3), 다른 사람 프로필의 `FollowButton`·`⋯` 메뉴(§4.4), 차단·차단 목록·차단 해제(§4.5), 프로필 신고와 신고 메일(§4.6·§5), 신고 자동 숨김 표시(§4.7), 프로필 탭 숫자·사람+ 연결(§4.8), 차단 목록용 RPC 하나(§1).
- **하지 않는다**: 친구 하루 보기·캘린더·할 일 목록·할 일 신고(S4 — 남의 할 일이 화면에 처음 나오는 단계), 목표 공개 범위 UI·`GoalMark`·아바타 줄·"오늘에 보일 사람" 화면(S4), 새 팔로워 **알림**(S5 — 알림을 만드는 트리거도 S5), 푸시(S6), 운영자 화면(Studio 저장 쿼리로 처리).
- 사람이 하는 일: Resend API 키·지원 메일 주소를 Supabase secret으로 넣기(§5), 서명 빌드로 유니버설 링크 실기기 확인(§8).

## 1. DB — 차단 목록 RPC 하나 (마이그레이션 1개)

S1의 `social_profiles` RLS는 **어느 방향이든 차단이 있으면** 프로필을 숨깁니다. 그래서 차단 목록(SOC-61)에서 내가 차단한 사람의 이름·사진을 읽을 수 없습니다. 이 목록 하나만 위해 definer RPC를 추가합니다. 다른 스키마 변경은 하지 않습니다(필요하면 멈추고 보고).

- 마이그레이션 `supabase migration new blocked_profiles`.
- `public.my_blocked_profiles() returns table (user_id uuid, handle text, nickname text, avatar_path text, blocked_at timestamptz)` — `security definer`, `stable`, `search_path = ''`. `blocks.blocker_id = auth.uid()`인 행만, `social_profiles`와 조인, `blocked_at desc`. 소개·검색 허용 여부·정지 상태는 돌려주지 않습니다. 정지된 사람도 목록에는 나옵니다(해제할 수 있어야 함). `auto_hidden_at`이 있으면 `avatar_path`는 `null`로 돌려줍니다.
- `revoke all ... from public, anon`, `grant execute ... to authenticated`. definer 예외(AGENTS.md §6)는 보고에 적습니다.
- pgTAP(`supabase/tests/`에 새 파일): 내가 차단한 사람만 나온다 / 나를 차단한 사람은 안 나온다 / anon 실행 거부 / 자동 숨김이면 사진이 `null`.
- `pnpm db:types`로 타입을 다시 만듭니다.

## 2. `packages/api`

이름은 제안입니다. 기존 repository·훅 방식(S2의 `social-profiles.ts`, `hooks/social.ts`)을 따르고, 모든 조회에 `user_id` 조건을 명시합니다(S1 §7).

- **관계**
  - `fetchRelations(client, me, userIds) → Map<userId, { iFollow, followsMe }>` — `follows`를 두 번 조회(`follower_id = me and followee_id in (...)`, `followee_id = me and follower_id in (...)`). 목록·검색 결과에 버튼을 붙일 때 씁니다. N+1 금지.
  - `follow(client, me, targetId)` — `follows` insert. `today_sort_key`는 not null이고 기본값이 없으므로 **내 팔로우 중 가장 큰 키 뒤**(`keyBetween(maxKey, null)`, `@nodii/core` `sort-key.ts`)로 넣습니다(SOC-36, 새 팔로우는 맨 아래). `show_on_today`는 기본값(`true`).
  - `unfollow(client, me, targetId)` — `follower_id = me` 행 삭제.
  - `removeFollower(client, me, followerId)` — `followee_id = me` 행 삭제(SOC-12).
- **목록**
  - `fetchFollowing(client, me)` / `fetchFollowers(client, me)` — `follows`와 `social_profiles` 조인, `created_at desc`. 상대 프로필이 RLS로 안 보이면(정지 등) 그 줄은 뺍니다. 개수(`count`)는 목록 길이가 아니라 `head: true, count: 'exact'`로 따로 가져와 프로필 탭 숫자에 씁니다.
  - v3 규모에서는 페이지 나누기 없이 최대 500줄까지 한 번에 가져옵니다(넘으면 보고).
- **검색**: `searchProfiles(client, query)` — `search_profiles` RPC. 2자 미만이면 호출하지 않습니다. 결과에 `fetchRelations`를 붙입니다.
- **차단**: `block(client, me, targetId)`(`blocks` insert — 양방향 팔로우 삭제는 S1 트리거), `unblock(client, me, targetId)`, `fetchBlockedProfiles(client)`(§1 RPC).
- **신고**: `reportProfile(client, { targetUserId, reason, detail?, alsoBlock })` — §5의 Edge Function `report-profile`을 호출합니다. `alsoBlock`이면 신고가 성공한 뒤 `block`을 이어서 부릅니다.
- **오류**: `socialErrorCode`에 `rate_limited`(SOC-13), `blocked`·`not_found`(상대가 차단·정지·삭제), `already_following`(PK 충돌 — 성공으로 취급해도 됨)을 추가하고 문구 키로 연결합니다.
- **훅**: `useRelations`, `useFollowMutation`(낙관적 업데이트: 버튼 상태 즉시 전환, 실패 시 되돌리고 토스트), `useFollowing`/`useFollowers`/`useFollowCounts`, `useProfileSearch`(입력 300ms 디바운스, 이전 요청 취소), `useBlock`/`useUnblock`/`useBlockedProfiles`, `useReportProfile`.
- **캐시 무효화**: 팔로우·언팔로우·내보내기·차단·해제 뒤 관계·목록·숫자·검색 결과를 같이 무효화합니다. `follows`는 Realtime에 없으므로(S1 §9) 앱이 앞으로 올 때 목록·숫자를 다시 불러옵니다.

## 3. `packages/core` (테스트 먼저, 커버리지 90%)

- `followButtonState({ iFollow, followsMe }) → 'follow' | 'followBack' | 'following'` (`components.md` `FollowButton` 표).
- `normalizeSearchQuery(text)` — 앞뒤 공백·앞의 `@` 제거, 소문자. 2자 미만이면 `null`.
- `REPORT_REASONS = ['spam', 'offensive', 'impersonation', 'harassment', 'other'] as const`, `validateReportDetail(text)` — `other`면 1~500자 필수, 나머지는 선택(최대 500자).
- `visibleProfile(profile, isMe)` — `auto_hidden_at`이 있고 내가 아니면 `avatarPath: null`, `bio: null`로 바꿔 돌려줍니다(§4.7). 모든 화면이 프로필을 그리기 전에 이걸 거칩니다.

## 4. 화면

값은 `tokens.md` 토큰만 씁니다. 화면을 만들기 전에 `mobile-designs/v3/`·`desktop-designs/v3/`의 PNG를 열어 봅니다(`AGENTS.md` "디자인"). S3 시안은 데스크톱·모바일 탭의 "프로필 탭 · 친구 찾기 · 설정", "알림 · 사람 하루" 줄에 있습니다. **시안이 없는 화면**(신고 시트, 차단 확인, 차단 목록, iOS 팔로잉/팔로워 목록)은 기존 컴포넌트(확인 창, 시트, 인셋 그룹 목록, 설정 하위 화면)로 만들고 보고에 "시안 없음"으로 적습니다.

### 4.1 `FollowButton`과 팔로우·언팔로우 (SOC-10·11·13, D25)

- 두 앱에 `FollowButton` 컴포넌트 하나. 상태는 `followButtonState`로 고르고, 문구·모양은 `components.md` 표 그대로(팔로우·맞팔로우 = 주요, 팔로잉 = 보조). 크기 prop: 목록 32 / 프로필 머리 36(iOS 펼침 폭 140).
- 누르는 동안 비활성, 낙관적 전환.
- [팔로잉]을 누르면 언팔로우 확인 창: "{닉네임}님을 언팔로우할까요?" + "맞팔로우로 공개한 목표는 서로 더 이상 볼 수 없어요." + [취소] [언팔로우](`danger`). 확인 창 문구는 i18n 카탈로그에.
- 서버가 `rate_limited`를 돌려주면 되돌리고 토스트 "잠시 후 다시 팔로우할 수 있어요"(1시간 30명, SOC-13).
- 상대가 그새 차단·정지·삭제되면 되돌리고 토스트 "지금은 팔로우할 수 없어요".

### 4.2 친구 찾기 (SOC-08·10·06, iOS `ProfileSearch` · macOS `MacProfileM1Search`)

- 프로필 탭 사람+에서 엽니다(S2에서 비워 둔 동작을 연결).
  - **iOS**: 하위 화면(탭바 숨김). 맨 위 검색칸(자동 포커스) + [취소], 아래 안내 "ID가 정확히 맞는 사람이 먼저 나와요"(13 `muted`), 결과 줄(44 `Avatar` · 닉네임 · `@ID` · `FollowButton` 32).
  - **macOS**(D32): 가운데 프로필이 왼쪽 380 칸으로 미끄러지고 오른쪽 칸에 "‹ 프로필" + "친구 찾기". 구성은 iOS와 같습니다. Esc·"‹"로 닫으면 가운데로.
- 입력 300ms 뒤 검색, 2자 미만이면 결과 대신 안내만. 결과 없음 "찾는 사람이 없어요". 오프라인 "연결되면 찾을 수 있어요".
- 나 자신은 결과에서 빼고, 결과 줄을 누르면 다른 사람 프로필(§4.4).

### 4.3 팔로잉 · 팔로워 목록과 팔로워 내보내기 (SOC-12, macOS `MacProfileM1`)

- 프로필 탭 숫자(팔로잉·팔로워)를 누르면 엽니다. S2에서 비워 둔 동작을 연결합니다.
  - **macOS**: 오른쪽 칸에 "팔로잉"/"팔로워" 큰 제목 + 오른쪽 위 `[팔로잉 n | 팔로워 n]` 세그먼트 + 목록(40 `Avatar` · 닉네임 · `@ID` · `FollowButton` 32). 왼쪽 숫자 칸 중 열린 쪽에 `chip` 바탕. 팔로워 줄 끝 `⋯`(호버·포커스 때 보임, 우클릭도 같은 메뉴) → "팔로워에서 내보내기".
  - **iOS**(시안 없음): 하위 화면, 머리 "‹ 프로필" + 가운데 `[팔로잉 n | 팔로워 n]` 세그먼트, 같은 줄을 세로 목록으로. 팔로워 줄을 왼쪽으로 밀면 "내보내기"(`danger`), 줄을 길게 눌러도 같은 메뉴.
- 내보내기 확인 창: "{닉네임}님을 팔로워에서 내보낼까요?" + "상대에게 알리지 않아요. 다시 팔로우할 수 있어요." + [취소] [내보내기](`danger`). 실행 취소 없음.
- 빈 목록: 팔로잉 "아직 팔로우한 사람이 없어요" + [친구 찾기], 팔로워 "아직 팔로워가 없어요" + [초대 링크 보내기].
- 줄을 누르면 다른 사람 프로필(§4.4).

### 4.4 다른 사람 프로필 — 머리 + 버튼 (SOC-38 머리, D25, iOS `SocialPersonFinalButtons` · macOS `MacNotifyPerson`)

- S2의 머리만 있는 화면(`S2OtherProfile`)에 버튼을 더합니다. **아래 하루 내용(캘린더·할 일)은 S4**이므로 S3에서도 비워 둡니다.
  - **iOS**: 머리 "‹ {들어온 화면}" + 오른쪽 `⋯`. 펼친 `ProfileHeader` 아래 `FollowButton` 36(폭 140). 시안의 접힘 동작은 S4에서 본문이 생길 때 붙입니다.
  - **macOS**: 신호등 줄에 "‹ {들어온 화면}", 전체 폭 한 줄 머리(64 `Avatar` · 닉네임 + `@ID` · 소개 · `FollowButton` 36 · `⋯`).
- `⋯` 메뉴: "신고하기"(→ §4.6) · "차단하기"(→ §4.5). 이미 차단했다면 이 화면에 올 수 없습니다(RLS로 프로필이 안 읽힘 → "프로필을 볼 수 없어요").
- 들어오는 길: 초대 링크(S2), 친구 찾기 결과, 팔로잉·팔로워 줄. 내 프로필이면 이 화면 대신 프로필 탭으로 보냅니다.

### 4.5 차단 · 차단 목록 · 차단 해제 (SOC-60·61)

- 차단 확인 창: "{닉네임}님을 차단할까요?" + "서로 팔로우가 끊기고, 서로 찾거나 프로필·목표를 볼 수 없어요. 상대에게 알리지 않아요." + [취소] [차단](`danger`). 차단하면 다른 사람 프로필을 닫고 들어온 화면으로 돌아가며, 그 화면의 목록·검색 결과에서 그 사람이 사라집니다.
- 차단 목록: 설정 > 개인정보 > **차단한 사람** `›`(S2에서 자리만 둔 항목을 연결, 오른쪽 값은 "n명"). 하위 화면, 줄: 40 `Avatar` · 닉네임 · `@ID` · [차단 해제](보조, 32). 빈 목록 "차단한 사람이 없어요".
- 차단 해제 확인 창: "{닉네임}님의 차단을 풀까요?" + "팔로우는 다시 이어지지 않아요." + [취소] [차단 해제]. 해제 후 그 줄은 목록에서 빠집니다.

### 4.6 신고 (SOC-62, 프로필만)

- 다른 사람 프로필 `⋯` → "신고하기". iOS는 시트(중간 높이, 끌어 내려 닫기), macOS는 폭 440 모달.
- 구성(시안 없음): 제목 "{닉네임}님 신고" → 사유 라디오 다섯 줄(스팸 / 불쾌한 내용 / 사칭 / 괴롭힘 / 기타) → "기타"를 고르면 입력칸(1~500자, 남은 글자 수) → 스위치 "이 사람 차단하기"(기본 꺼짐) → 안내 "신고는 24시간 안에 확인해요. 상대에게 알리지 않아요." → [취소] [신고하기](사유를 골라야 켜짐).
- 보내면 닫고 토스트 "신고했어요". 차단도 골랐으면 §4.5처럼 프로필을 닫습니다.
- 할 일 신고(`target_kind = 'todo'`)는 S4에서 친구 할 일이 보일 때 같은 시트로 붙입니다.

### 4.7 신고 자동 숨김 표시 (SOC-62)

- `auto_hidden_at`이 있는 사람은 **남에게** 기본 이미지와 소개 없음으로 보입니다(`visibleProfile`). 닉네임·ID는 그대로. 본인 화면에는 그대로 보이고, 프로필 편집 위에 한 줄 "신고가 접수되어 사진과 소개가 다른 사람에게 잠시 숨겨졌어요"(`muted`).
- 모든 곳(검색 결과, 목록, 다른 사람 프로필, 초대 링크로 연 화면)에 적용합니다.

### 4.8 프로필 탭 연결 (D27·D32)

- 숫자 두 칸을 누르면 §4.3 목록. 사람+는 §4.2. S2의 "S3에서 연결"을 모두 지웁니다.
- 숫자는 실제 개수로(§2). 팔로잉이 1명 이상이면 초대 카드를 숨깁니다(`ProfileTabB`). macOS 가운데 기본 화면도 같습니다.

## 5. 신고 메일 — Edge Function `report-profile`

- 앱은 `reports`에 직접 쓰지 않고 이 함수를 부릅니다. 함수가 신고 저장과 메일을 한 번에 처리해, 메일 없이 신고만 쌓이는 경로가 없게 합니다.
- `supabase/functions/report-profile/index.ts`(Deno):
  1. `Authorization` 헤더의 사용자 JWT로 **그 사용자 권한의** Supabase 클라이언트를 만들고(서비스 키로 쓰지 않음), `reports`에 insert합니다. RLS(`reporter_id = me`, 본인 신고 불가)와 S1 트리거(3건 자동 숨김)가 그대로 적용됩니다.
  2. 저장이 성공하면 Resend REST API(`https://api.resend.com/emails`)로 지원 메일함에 보냅니다. 발신 `no-reply@mail.nodii.app`, 제목 `[Nodii report] {reason} — @{handle}`, 본문에 신고 ID·사유·상세·대상 user_id·핸들·신고 시각(UTC)·Studio 저장 쿼리 이름. 신고자 이메일은 넣지 않습니다.
  3. 메일이 실패해도 신고는 성공으로 돌려주고 함수 로그에 남깁니다(재시도 큐는 v3에 없음 — 운영자는 Studio에서 미해결 신고를 매일 확인).
  4. 입력 검증: `reason`은 다섯 값 중 하나, `detail` ≤ 500자, `targetUserId`는 UUID. 같은 사람이 같은 대상을 10분 안에 다시 신고하면 저장하지 않고 성공을 돌려줍니다(메일 폭주 방지). `reports`는 사용자에게 SELECT 권한이 없으므로 이 확인 한 번만 서비스 키 클라이언트로 읽고(`reporter_id`·`target_user_id`·`created_at` 조건의 count), 저장은 1번처럼 사용자 권한으로 합니다.
- 비밀 값: `RESEND_API_KEY`, `REPORT_INBOX`(지원 메일 주소). 코드·커밋에 넣지 않고 `supabase/functions/.env.local`(gitignore 확인) / 원격은 `supabase secrets set`(사람이 함).
- 로컬 테스트: `supabase functions serve report-profile`. Resend 키가 없으면 메일 단계를 건너뛰고 로그만 남기게 합니다(`RESEND_API_KEY`가 비면 dry-run).
- Deno 단위 테스트 또는 API 쪽 MSW 테스트로: 성공·검증 실패·본인 신고 거부·메일 실패 시에도 성공.
- **Studio 저장 쿼리**: `supabase/snippets/reports-open.sql`(미해결 신고 목록, 대상별 건수)과 `reports-resolve.sql`(조치 ①②③ 예시 — 숨김 해제·프로필 초기화·`social_suspended_at` 설정, `resolved_at` 채우기)을 파일로 남깁니다. 실행은 사람이 Studio에서.

## 6. 문구 (i18n)

- 새 문구는 `packages/i18n` 한국어·영어 카탈로그에 함께 넣습니다(`social.follow.*`, `social.search.*`, `social.lists.*`, `social.block.*`, `social.report.*`). 화면에는 "ID", 코드에는 `handle`.
- 확인 창 제목의 이름은 닉네임을 그대로 끼웁니다(영어: "Unfollow {nickname}?").

## 7. 테스트

- `packages/core`: §3 함수 전부(경계값 포함), 커버리지 90%.
- `packages/api`: MSW로 `fetchRelations`(쿼리 두 번, `user_id` 조건), `follow`의 정렬 키, 오류 코드 매핑, 캐시 무효화 범위.
- pgTAP: §1 RPC. 기존 342개 전부 통과.
- 앱(두 앱 모두):
  - `FollowButton` 세 상태, 언팔로우 확인 창, 낙관적 실패 되돌리기.
  - 검색 디바운스·2자 미만·결과 없음.
  - 팔로워 내보내기 확인 → 목록에서 빠짐.
  - 차단 → 프로필 닫힘·목록에서 빠짐, 차단 목록 → 해제.
  - 신고 시트: 사유 없으면 버튼 꺼짐, 기타 입력 필수, 차단 스위치.
  - 자동 숨김 표시.
  - 소셜 꺼짐 경로 기존 테스트 그대로.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm db:reset` → `pnpm db:test`.

## 8. 완료 기준

로컬 Supabase + 두 개발 앱(S2의 "로컬 링크 검증 방법"과 같은 준비, `pnpm db:social-on`)으로:

- [x] A가 검색으로 B를 찾아 팔로우 → B의 버튼에 A가 "맞팔로우"로 보이고, B가 맞팔로우하면 둘 다 "팔로잉".
- [x] 언팔로우 확인 창 → 숫자·목록이 두 앱에서 맞게 바뀐다(앱을 앞으로 가져오면 다른 기기도).
- [x] B가 A를 팔로워에서 내보냄 → A의 팔로잉에서 B가 사라진다.
- [x] 31번째 팔로우가 1시간 안에 거부되고 토스트가 뜬다(pgTAP 또는 스크립트로 30개를 미리 만든 뒤 앱에서 시도).
- [x] A가 B를 차단 → 양쪽 팔로우가 끊기고, 서로 검색·프로필·초대 링크로 못 연다. B 화면에 차단 사실이 드러나지 않는다. A의 차단 목록에 B, 해제하면 다시 찾을 수 있다(팔로우는 이어지지 않음).
- [x] A가 B를 신고 → `reports`에 행이 생기고, dry-run 로그(또는 키가 있으면 실제 메일)가 남는다. 서로 다른 세 계정이 신고하면 B의 사진·소개가 남에게 숨겨지고 B 본인에게 안내가 뜬다.
- [x] "ID로 검색 허용"을 끈 사람은 검색에 안 나오지만 초대 링크로는 열린다.
- [x] 두 앱 모두, 소셜 꺼짐 경로가 그대로.
- [ ] **사람이 확인(실기기, 서명 빌드)**: `https://nodii.app/u/<token>`이 iPhone(개발 빌드 또는 TestFlight)과 서명한 macOS 앱에서 앱의 다른 사람 프로필로 열린다. 앱이 꺼져 있을 때와 켜져 있을 때 둘 다(S0·S2에서 미룬 항목). macOS는 App ID에 Associated Domains가 켜진 프로비저닝 프로필이 필요합니다.

### 검증 기록

- 격리된 Supabase에서 macOS 개발 번들과 iPhone 18 Pro(iOS 27) 시뮬레이터를 다른 OTP 계정으로 사용했습니다. 맞팔로우, 앱 전경 복귀 후 숫자·목록 갱신, 언팔로우, 팔로워 내보내기, 31번째 제한 토스트를 확인했습니다. 차단·해제와 신고 dry-run은 앱에서, 차단 양방향의 검색·프로필·링크 권한과 검색 허용 해제는 같은 DB의 REST/RPC로 확인했습니다.
- 서로 다른 세 계정의 신고 저장 및 자동 숨김을 로컬 Edge Function과 DB에서 확인했습니다. 사용자 앱 테스트에서 다른 사람 프로필의 사진·소개 숨김, 본인 프로필 편집 안내, 소셜 꺼짐 경로를 확인했습니다.
- 실제 Resend 수신과 서명 빌드의 HTTPS 링크는 운영 비밀 값과 서명 환경에서 확인합니다.

### 확인한 PNG

- `mobile-designs/v3/` — `프로필 탭 (S2 · 숫자 0 + 초대 카드).png`, `설정 (v3 · 프로필 탭에서 진입).png`, `다른 사람 프로필 (S2 · 머리만, S4에서 사람 하루 페이지로 바뀜).png`, `다른 사람 프로필 · 볼 수 없음.png`, `메뉴 시트.png`, `제스처.png`.
- `desktop-designs/v3/` — `macOS 프로필 탭 (기본 · 가운데 내 프로필만).png`, `설정 · 프로필 탭 오른쪽 하위 화면 (v3).png`, `macOS 다른 사람 프로필 (S2 · 머리만, S4에서 사람 하루 페이지로 바뀜).png`, `macOS 다른 사람 프로필 · 볼 수 없음.png`, `알림 › 아바타 누름 · 사람 하루 페이지.png`의 머리.
- 친구 찾기와 macOS 팔로우 목록의 PNG는 로컬에 없어 화면 문서의 배치를 적용했습니다. iOS 팔로우 목록, 신고 시트, 차단 확인·목록은 시안 없이 기존 UI를 재사용했습니다.

### 안 되는 것과 대안

- `follows`의 외래 키는 `auth.users`를 참조합니다. 스키마 수정 없이 목록을 구성하도록 팔로우 행과 RLS로 읽을 수 있는 프로필을 UUID 배치로 조회해 원래 순서대로 결합했습니다. 관계와 프로필의 긴 GET URL을 피하기 위해 100명씩 나누어 조회하며 UI에는 최근 500명까지 표시합니다.
- 신고 중복 확인은 §5의 읽기 후 쓰기 방식입니다. 완료된 신고의 재전송을 걸러냅니다. 두 Edge 인스턴스가 같은 쌍을 동시에 받으면 둘 다 저장할 수 있습니다. 기존 S1 권한으로 인증 사용자의 직접 INSERT도 가능합니다. 앱은 Edge Function을 사용하며 원자적 중복 방지·직접 쓰기 차단은 별도 서버 설계와 스키마 변경이 필요합니다.
- 여러 기기가 같은 계정으로 정확히 동시에 팔로우하면 같은 마지막 키를 읽을 수 있습니다. 한 앱의 관계 쓰기는 계정 단위로 직렬화하며 서버 차원의 순번 직렬화에는 추가 RPC가 필요합니다.

## 9. 하지 말 것

- 남의 할 일·목표·캘린더를 화면에 그리지 않습니다(S4).
- `notifications`에 쓰지 않습니다. 새 팔로워 알림은 S5.
- 서비스 키를 앱에 넣지 않습니다. Edge Function에서 서비스 키는 §5-4의 중복 확인 읽기에만 쓰고, `reports` 저장은 사용자 권한으로 합니다.
- §1 외의 스키마·RLS 변경, `follows`를 Realtime에 다시 넣는 일.
- 차단 사실을 상대에게 드러내는 문구("차단되었습니다" 등). 상대 쪽에는 "프로필을 볼 수 없어요"만.
- 원격 Supabase 적용, 운영 빌드·TestFlight 업로드(사람이 함).

## 10. 이 지시서에서 정한 것 (보고 때 다시 확인)

1. 차단 목록은 definer RPC `my_blocked_profiles` 하나로 읽는다(스키마 변경은 이것만).
2. 신고는 Edge Function 한 곳에서 저장과 메일을 같이 처리하고, 메일 실패는 신고 실패로 보지 않는다.
3. 할 일 신고는 S4로 미룬다.
4. 자동 숨김은 클라이언트의 `visibleProfile`로 가린다(원본은 S1 결정대로 지우지 않음). Storage 파일 주소는 남지만 화면 어디에도 그리지 않는다.
5. 새 팔로우의 `today_sort_key`는 앱이 내 팔로우 끝에 붙여 만든다.
6. 목록은 페이지 나누기 없이 최대 500줄.
7. iOS 팔로잉/팔로워 목록·신고 시트·차단 확인·차단 목록은 시안 없이 기존 컴포넌트로 만든다.
