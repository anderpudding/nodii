# S1 — DB: 소셜 스키마 · RLS · RPC · pgTAP

> 기준: `docs/16-v3-social-plan.md` §3(SOC-), §4(데이터 구조·RLS·반응 대상), D1~D12. 규칙: `AGENTS.md` §5 "소셜 (v3)"·§6. 브랜치: `feat/s1-db`.
> 계획서 §4는 "스케치"입니다. 이 지시서가 그것을 SQL 수준으로 정한 것이고, 다른 부분은 아래 **"계획서와 다른 점"**에 이유와 함께 적었습니다.

## 0. 범위

- **한다**: 마이그레이션(테이블·enum·컬럼·함수·트리거·RLS·GRANT·Storage 정책·Realtime publication), 금칙어·예약어 시드, `split_routine`·`delete_my_account` 수정, pgTAP, `pnpm db:types`, `packages/api`의 기존 조회에 `user_id` 필터 추가(§7).
- **하지 않는다**: 화면, i18n, 새 repository·훅(S2 이후), Edge Function(신고 메일·푸시는 S3·S6), 알림을 **만드는** 트리거(S5), 원격 프로젝트 적용(사람이 함).

## 1. 마이그레이션 파일

`supabase migration new <name>`으로 아래 순서로 만듭니다. 이미 커밋된 마이그레이션은 고치지 않습니다.

| # | 이름 | 내용 |
| --- | --- | --- |
| 1 | `social_profiles` | `goal_visibility` enum, `goals.visibility`, `profiles.default_visibility`, `social_profiles`, `handle_holds`, `invite_links`, `app_config.social_enabled` |
| 2 | `moderation_words` | `reserved_words`, `banned_words` 테이블 + CSV 시드, `text_is_allowed`·`text_is_reserved` 함수, `social_profiles` 검사 트리거 |
| 3 | `follows_blocks` | `follows`, `blocks`, 관계 함수(`relation_level`, `can_view_goal`, `can_view_routine`), 기존 4개 테이블의 친구 SELECT 정책 |
| 4 | `reactions` | `reactions`, `react`·`unreact` RPC, `split_routine` 수정 |
| 5 | `notifications` | `notifications`, `notification_prefs`, `notification_mutes`, `push_tokens` (테이블·RLS만) |
| 6 | `reports` | `reports`, 3건 자동 숨김 트리거 |
| 7 | `avatars_storage` | `avatars` 버킷과 `storage.objects` 정책 |
| 8 | `social_account` | `delete_my_account` 정리, Realtime publication 추가 |

## 2. 프로필 (SOC-01~08)

### 계획서와 다른 점: 공개 프로필은 새 테이블 `social_profiles`

기존 `profiles`에는 남에게 보이면 안 되는 값(`timezone`, `week_start`, 새 `default_visibility`)이 있고, RLS는 행 단위라 열 일부만 남에게 열 수 없습니다. 그래서 **남에게 보이는 프로필은 `social_profiles`로 분리**합니다. `profiles`는 지금처럼 본인만 읽고 씁니다. `profiles.display_name`은 쓰지 않는 채로 둡니다(닉네임은 `social_profiles.nickname`).

```sql
create type public.goal_visibility as enum ('private', 'mutual', 'followers', 'public');

alter table public.goals add column visibility public.goal_visibility not null default 'private';   -- D6: 기존 행도 private
alter table public.profiles add column default_visibility public.goal_visibility not null default 'private'
  check (default_visibility <> 'public');                                                             -- D3, SOC-28

create table public.social_profiles (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  handle             text not null unique
                     check (handle ~ '^[a-z][a-z0-9_.]{2,19}$' and handle not like '%..%' and handle not like '%.'),
  nickname           text not null check (char_length(nickname) between 1 and 20),
  bio                text not null default '' check (char_length(bio) <= 80
                       and array_length(string_to_array(bio, E'\n'), 1) <= 2),
  avatar_path        text,                         -- null = 기본 이미지(D23). 'avatars/{user_id}/{uuid}' (확장자·크기 접미사 제외)
  searchable         boolean not null default true, -- SOC-06
  handle_changed_at  timestamptz,
  auto_hidden_at     timestamptz,                  -- 서로 다른 신고 3건(SOC-62): 사진·소개를 숨김
  social_suspended_at timestamptz,                 -- 운영자 조치 ③
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
```

- 행은 소셜을 처음 쓸 때 핸들을 정하면서 생깁니다(SOC-03). 행이 없는 사용자는 검색·팔로우 대상이 아닙니다.
- `handle`은 앱이 소문자로 바꿔 보내고, DB는 소문자만 받습니다(위 check).
- **RLS**
  - SELECT: 본인, 또는 (어느 방향이든 차단이 없고 `social_suspended_at is null`). 검색에 안 나오는 것(`searchable = false`)은 검색 RPC에서만 거릅니다 — 링크·팔로우로는 계속 보여야 합니다.
  - INSERT/UPDATE: `user_id = auth.uid()`. `social_suspended_at`·`auto_hidden_at`·`handle_changed_at`은 **컬럼 권한으로 막고** 트리거·운영자만 바꿉니다. DELETE 권한 없음(계정 삭제 cascade만).
- **트리거 `social_profiles_guard`** (before insert or update, `security definer`, `search_path = ''`):
  - 핸들·닉네임: `text_is_reserved`면 거부(SQLSTATE `P0001`, 메시지 `reserved`). 핸들·닉네임·소개: `text_is_allowed`가 거짓이면 거부(`banned`). 어떤 단어인지는 메시지에 넣지 않습니다.
  - 핸들 변경: `handle_changed_at`이 30일 안이면 거부(`handle_cooldown`). 바꾸면 예전 핸들을 `handle_holds(handle, released_by, available_at = now() + 30일)`에 넣고 `handle_changed_at = now()`.
  - 새 핸들이 `handle_holds`에 있고 `available_at > now()`이고 `released_by`가 본인이 아니면 거부(`handle_held`). 본인이 버린 핸들은 30일 안에 다시 가져갈 수 있습니다.
- `handle_holds(handle text primary key, released_by uuid references auth.users on delete set null, available_at timestamptz not null)` — RLS 켜고 정책·권한 없음(트리거만 씀). 계정을 지워도 묶음은 남아 사칭을 막습니다.
- `invite_links(token text primary key, user_id uuid not null unique references auth.users on delete cascade, created_at)` — 토큰은 `encode(extensions.gen_random_bytes(12), 'hex')`(24자). `social_profiles` INSERT 때 트리거로 함께 만듭니다. RLS: 본인 SELECT만.
- RPC
  - `resolve_invite(p_token text) returns uuid` — 토큰 주인의 `user_id`. 차단 관계면 `null`. `security definer`, `stable`, authenticated만.
  - `search_profiles(p_query text) returns setof social_profiles` — `searchable`이고 차단 없음. 정렬: 핸들이 정확히 같은 사람 → 핸들 앞부분 일치 → 닉네임 포함. 최대 30개. `p_query`는 2자 이상.
  - `handle_available(p_handle text) returns text` — `'ok' | 'taken' | 'held' | 'reserved' | 'banned' | 'invalid'`. 앱의 입력 중 안내용(S2).
- `app_config`에 `('social_enabled', 'false')` INSERT.

## 3. 금칙어 · 예약어 (SOC-02, SOC-64)

- 테이블: `reserved_words(word text primary key)`, `banned_words(word text primary key, match text not null check (match in ('contains','exact')), lang text not null)`. RLS 켜고 authenticated에 SELECT만(앱이 같은 목록으로 미리 안내, SOC-64).
- 시드: `docs/16-v3-moderation/banned-words.csv`(2,373행)·`reserved-words.csv`(33행)를 SQL `insert ... values`로 바꾸는 스크립트 `scripts/moderation-to-sql.mjs`를 만들고, 그 출력을 마이그레이션 2에 넣습니다. 스크립트는 다음에 목록이 바뀔 때 새 마이그레이션을 만드는 데 다시 씁니다. CSV를 손으로 고치지 않습니다.
- 정규화 `normalize_text(t)`: `lower(normalize(t, NFKC))`.
- `text_is_allowed(t)`: 정규화한 문자열에 `contains` 단어가 들어 있거나, 공백·기호로 나눈 토큰 중 하나가 `exact` 단어와 같으면 거짓. 토큰 나누기는 `regexp_split_to_array(n, '[[:space:][:punct:]]+')`로 시작하되, DB 로케일에서 한글이 문자로 남는지 pgTAP 예시로 확인합니다.
- `text_is_reserved(t)`: 정규화한 값이 `reserved_words.word`와 정확히 같으면 참.
- **pgTAP 예시(계획서 SOC-64 그대로)**: 통과 — "2026년", "청년", "class", "title", "hello", "생리학", "새끼손가락", "시바견", "아버지", "보지마", "시발점", "발기인", "젓가락", "하루 세끼". 막힘 — "씨발", "개새끼", "shithead", "xx좆xx". 예약어 — `nodii`, `Admin`(대문자도), `운영자`.

## 4. 팔로우 · 차단과 공개 범위 RLS (SOC-10~13, SOC-20~23, SOC-60, §4.2)

```sql
create table public.follows (
  follower_id    uuid not null references auth.users (id) on delete cascade,
  followee_id    uuid not null references auth.users (id) on delete cascade,
  show_on_today  boolean not null default true,      -- SOC-36
  today_sort_key text collate "C" not null,          -- 클라이언트가 fractional-indexing으로 맨 아래 키를 만들어 보냄
  created_at     timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id, follower_id);

create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id, blocker_id);
```

- **follows RLS**: SELECT `follower_id = me or followee_id = me`. INSERT `follower_id = me` + 트리거 검사(아래). UPDATE 정책 `follower_id = me`, 권한은 `grant update (show_on_today, today_sort_key)`만. DELETE `follower_id = me`(언팔로우) **또는** `followee_id = me`(팔로워 내보내기, SOC-12).
- **follows 트리거** (before insert): 양쪽 모두 `social_profiles` 행이 있고 정지되지 않았는지, 차단이 없는지, 그리고 **요청 횟수 제한**(SOC-13): 같은 `follower_id`가 최근 1시간에 만든 팔로우가 **30개** 이상이면 거부(`rate_limited`, §12-3 확정).
- **blocks RLS**: 본인(`blocker_id = me`)만 SELECT·INSERT·DELETE. 상대는 차단 사실을 볼 수 없습니다(SOC-60). blocks 트리거(after insert, definer): 양방향 `follows` 삭제.
- **관계 함수** (모두 `security definer`, `stable`, `search_path = ''`, authenticated에 실행 권한. follows·blocks의 RLS를 피하려고 definer가 필요합니다 — AGENTS.md §6 예외로 보고에 적습니다):
  - `is_blocked_between(a uuid, b uuid) boolean`
  - `relation_level(viewer uuid, owner uuid) int`: 같으면 3. 차단이면 -1. 둘 중 하나가 정지(`social_suspended_at`)면 -1. 서로 팔로우 2, viewer만 팔로우 1, 아니면 0.
  - `can_view_goal(p_goal_id uuid) boolean`: 목표 주인과 `visibility`를 읽어 `relation_level(auth.uid(), owner) >= 필요한 단계`(public 0 · followers 1 · mutual 2 · private 3).
  - `can_view_routine(p_routine_id uuid) boolean`: 루틴의 `goal_id`로 `can_view_goal`.
- **기존 4개 테이블에 정책 추가** (기존 `own *` 정책은 그대로 두고 SELECT 정책을 하나씩 더합니다. 정책은 OR로 합쳐집니다):
  - `goals`: `for select using (user_id <> (select auth.uid()) and public.can_view_goal(id))`
  - `todos`: `... and public.can_view_goal(goal_id)`
  - `routines`: `... and public.can_view_goal(goal_id)`
  - `routine_logs`: `... and status = 'done' and public.can_view_routine(routine_id)` — 건너뛴 기록은 친구에게 보이지 않습니다(SOC-23).
  - 친구 정책에 `deleted_at is null`을 **넣지 않습니다.** 넣으면 친구가 할 일을 지울 때(소프트 삭제 UPDATE) 그 행이 내게서 사라져 Realtime이 변경을 전달하지 않고, 친구 화면 캐시에 지운 할 일이 남습니다. 조회는 지금처럼 `deleted_at is null`로 거릅니다.
- 쓰기 정책은 바꾸지 않습니다(본인만).
- **성능**: 친구 화면 조회(`todos` 42일 범위)에 `explain analyze`를 돌려 결과를 보고에 붙입니다. 함수 호출이 행마다 반복되면 `goal_id`별로 묶이도록 `(select ...)` 서브쿼리나 함수의 `stable` 캐시를 확인합니다.

## 5. 반응 (SOC-40~42, §4.3)

```sql
create table public.reactions (
  id          uuid primary key default gen_random_uuid(),
  reactor_id  uuid not null references auth.users (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  todo_id     uuid references public.todos (id) on delete cascade,
  routine_id  uuid references public.routines (id) on delete cascade,
  date        date,
  type        text not null default 'like' check (type in ('like')),   -- D7: 나중에 마스코트 이모티콘
  created_at  timestamptz not null default now(),
  check ((todo_id is not null and routine_id is null and date is null)
      or (todo_id is null and routine_id is not null and date is not null))
);
create unique index reactions_todo_uniq    on public.reactions (reactor_id, todo_id, type) where todo_id is not null;
create unique index reactions_routine_uniq on public.reactions (reactor_id, routine_id, date, type) where routine_id is not null;
create index reactions_owner_idx on public.reactions (owner_id, created_at desc);
```

- `routine_logs`를 외래 키로 참조하지 않습니다(완료 취소 때 물리 삭제되므로, D8).
- RLS: SELECT `reactor_id = me or (owner_id = me and not is_blocked_between(owner_id, reactor_id))`. INSERT 권한 없음(RPC로만). DELETE `reactor_id = me`(물리 삭제 허용 — 아래 ADR).
- `react(p_todo_id uuid, p_routine_id uuid, p_date date) returns uuid` (definer): 본인 것이 아님, `can_view_goal`/`can_view_routine`이 참, **지금 완료 상태**(할 일 `is_done`, 루틴 `routine_logs.status = 'done'`)를 확인하고 INSERT(이미 있으면 기존 id). 실패 이유는 `not_visible` · `not_done` · `own_item`.
- `unreact(p_reaction_id uuid)`는 두지 않고 클라이언트가 DELETE합니다(RLS로 충분).
- **`split_routine` 수정**: `p_from` 이후 날짜의 반응도 새 `routine_id`로 옮깁니다. 반응 행은 다른 사람(`reactor_id`) 것이라 invoker 권한으로는 바꿀 수 없으므로, 함수를 `security definer`로 바꾸고 **첫 줄에서 `v_old.user_id = auth.uid()`를 직접 확인**합니다(지금은 RLS가 그 일을 했습니다). 같은 시그니처로 `create or replace`.
- "과거 날짜까지 모두"로 숨겨진 날의 반응은 지우지 않습니다(§4.3).
- **ADR-017 갱신 제안**: 물리 DELETE 허용 테이블이 `routine_logs`, `reactions` 둘이 됩니다. `docs/02-system-design.md`는 직접 고치지 말고 보고의 "결정이 필요한 사항"에 문안을 적습니다.

## 6. 알림 · 신고 · 사진 (테이블과 권한만)

- `notifications(id uuid pk, recipient_id, actor_id, kind text check in ('follow','reaction','friend_done'), todo_id uuid null, routine_id uuid null, date date null, count int not null default 1, created_at, updated_at)` — 둘 다 `auth.users` cascade. 읽음 컬럼 없음(D24). 인덱스 `(recipient_id, updated_at desc)`, 친구 완료 묶음용 unique `(recipient_id, actor_id, date) where kind = 'friend_done'`. RLS: SELECT `recipient_id = me`이고 actor와 차단이 없음. 쓰기 권한 없음(S5에서 definer 함수가 씀).
- `notification_prefs(user_id pk, friend_done bool default false, new_follower bool default true, reaction bool default true, updated_at)` — 본인 모든 권한(DELETE 제외).
- `notification_mutes(user_id, actor_id, friend_done boolean not null, primary key (user_id, actor_id))` — **사람별 예외**입니다. 전체 설정보다 우선합니다(전체 꺼짐 + 민수만 켬, 또는 그 반대). 본인 SELECT·INSERT·UPDATE·DELETE.
- `push_tokens(token text pk, user_id, platform text check in ('ios'), updated_at)` — 본인 모든 권한.
- `reports(id uuid pk, reporter_id, target_user_id, target_kind text check in ('profile','todo'), todo_id uuid null, reason text check in ('spam','offensive','impersonation','harassment','other'), detail text check (char_length(detail) <= 500), created_at, resolved_at)` — INSERT만(`reporter_id = me`, 본인 신고 불가). 트리거: 서로 다른 `reporter_id`의 미해결 프로필 신고가 3건이 되면 `social_profiles.auto_hidden_at = now()`(SOC-62). 메일 발송은 S3.
- **Storage `avatars`** (마이그레이션 7): 버킷 공개 읽기, `file_size_limit` 1MB, `allowed_mime_types` `image/jpeg`. `storage.objects` 정책 — INSERT·UPDATE·DELETE는 `bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text`. 파일 이름은 `{user_id}/{uuid}_160.jpg`·`_480.jpg`.

## 7. 기존 API 조회에 `user_id` 필터 (중요)

지금 `packages/api/src/repositories/*`와 `settings.ts`의 조회는 `user_id`로 거르지 않고 RLS에만 기대고 있습니다(예: `todos.ts`의 날짜 범위 조회, `routine-logs.ts`, `countAllGoalContents`). §4의 친구 SELECT 정책이 생기면 **내 화면 조회에 친구의 공개 항목이 섞여 들어옵니다.** Realtime은 이미 `user_id=eq.` 필터가 있습니다.

- 모든 목록 조회에 `.eq('user_id', userId)`를 더합니다(`goals`, `todos`, `routines`, `routine_logs`, 관계 집계). 함수 시그니처에 `userId`가 없으면 세션에서 받는 쪽으로 바꾸고, 호출하는 두 앱을 고칩니다.
- 테스트: MSW 요청에 `user_id=eq.` 쿼리가 붙는지 확인하는 테스트를 repository마다 하나씩.
- 이 수정이 먼저 출시돼야 합니다. v3 앱이 나오기 전에는 아무도 목표를 공개할 수 없어 실제로 섞일 일은 없지만, **같은 계정으로 v3 iPhone과 예전 Mac 앱을 같이 쓰면** 예전 앱에 친구 항목이 보입니다. 출시 때 `min_*_app_version`을 올리는 계획(§6)과 함께 보고에 적어 둡니다.

## 8. 계정 삭제 (SOC-70)

- 새 테이블은 모두 `auth.users` cascade라 `delete_my_account()`는 그대로 대부분 정리됩니다. 확인만 pgTAP으로 합니다.
- **Storage 파일은 cascade되지 않습니다.** SQL로 `storage.objects`를 지우지 않습니다(실제 파일이 남음). S2에서 앱이 계정 삭제 전에 자기 폴더를 Storage API로 비우도록 하고, 여기서는 보고에 남깁니다.
- `handle_holds`는 `released_by on delete set null`로 남깁니다. 지운 계정의 핸들도 30일 묶입니다(계정 삭제 시 현재 핸들을 holds에 넣는 처리를 트리거로 추가).

## 9. Realtime

`alter publication supabase_realtime add table public.follows, public.reactions, public.notifications;`
`goals`의 `visibility` 변경은 이미 publication에 있는 `goals`로 전달됩니다.

## 10. pgTAP

새 파일 `supabase/tests/10_social_*.sql`. 각 파일은 기존처럼 독립 트랜잭션, seed에 기대지 않음, `set local role authenticated` + `request.jwt.claims`로 사용자 전환.

필수(계획서 §4.2 그대로 + 이 지시서의 결정):

- [x] A가 B의 `private` 목표·할 일·루틴·루틴 기록을 못 본다.
- [x] A가 B를 팔로우만 하면 B의 `followers` 목표는 보이고 `mutual`은 안 보인다.
- [x] 맞팔이면 `mutual`이 보인다.
- [x] 언팔 직후 못 본다. 팔로워 내보내기(B가 A→B 행 삭제) 직후 못 본다.
- [x] 어느 방향이든 차단하면 모든 범위(`public` 포함)가 막히고, 양방향 follows가 지워지고, 차단당한 쪽은 `blocks`를 볼 수 없다.
- [x] 친구의 할 일·루틴·목표·루틴 기록을 INSERT·UPDATE·DELETE할 수 없다(0행 또는 오류).
- [x] `public` 목표: 관계가 없어도 보인다(v3 화면에는 없지만 동작이 정의됨). `profiles.default_visibility = 'public'`은 거부.
- [x] 건너뛴 루틴 기록은 친구에게 안 보인다.
- [x] 팔로우당한 사람은 상대의 `show_on_today`·`today_sort_key`를 못 바꾼다. 팔로우한 사람은 그 두 컬럼만 바꿀 수 있다(`followee_id` 변경 거부).
- [x] 정지된 사용자의 목표는 친구에게 안 보이고, 정지된 사용자는 남을 볼 수 없다.
- [x] `react`: 볼 수 없으면 `not_visible`, 미완료면 `not_done`, 본인 것이면 `own_item`. 완료 취소 뒤에도 반응이 남는다(D8). 같은 대상 두 번은 한 행.
- [x] `split_routine` 뒤 `p_from` 이후 반응이 새 루틴으로 옮겨지고 이전 날짜 반응은 그대로. 남의 루틴으로 호출하면 거부.
- [x] 핸들 규칙(형식·소문자·예약어·금칙어·30일 쿨다운·30일 묶음·본인 재사용), §3의 금칙어 예시 전부.
- [x] 소개 81자·세 줄 거부. 닉네임 21자 거부.
- [x] `search_profiles`: `searchable = false`·차단 관계 제외, 정확히 같은 핸들이 첫 줄.
- [x] `resolve_invite`: 차단이면 null.
- [x] 팔로우 제한: 31번째(1시간 안) 거부.
- [x] 신고 3건(서로 다른 사람)이면 `auto_hidden_at`이 채워지고, 같은 사람 3건이면 안 채워진다.
- [x] `notifications`·`reactions`에 authenticated가 직접 INSERT 못 한다.
- [x] 계정 삭제 후 follows(양쪽)·blocks·reactions(보낸·받은)·notifications·prefs·mutes·push_tokens·reports·invite_links·social_profiles가 남지 않고, 핸들은 `handle_holds`에 남는다.
- [x] 새 테이블·RPC마다 허용 1개 + 거부 1개(AGENTS.md §6). RPC는 anon 실행 권한 회수 확인.
- [x] 기존 `01_rls.sql`~`09_*.sql`이 그대로 통과한다.

## 11. 완료 기준

- `pnpm db:reset && pnpm db:test && pnpm db:types` 통과, 위 체크리스트 전부 체크.
- `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` 통과(§7 수정 포함).
- 친구 화면 조회 `explain analyze` 결과를 보고에 첨부.
- `docs/v3/README.md` 진행 기록 한 줄.

## 12. 확정한 결정 (2026-11-11)

지시서를 쓰면서 정한 것을 사람이 확인해 확정했습니다. 구현은 이대로 하고, 바꿔야 할 이유가 생기면 보고에 적습니다.

1. 공개 프로필을 `profiles` 컬럼이 아니라 **`social_profiles` 새 테이블**로 둔다(§2). 계획서 §4.1 표도 이에 맞게 고쳤다.
2. 친구 SELECT 정책에 `deleted_at is null`을 넣지 않는다(§4, Realtime 때문).
3. 팔로우 제한 **1시간 30개**(SOC-13).
4. `notification_mutes`를 "사람별 예외(켬/끔)"로 둔다(계획서 표의 "사람별 친구 완료 알림 켜기"를 일반화).
5. 신고 자동 숨김을 `auto_hidden_at` 컬럼으로 표시하고 원본(사진·소개)은 지우지 않는다.
6. `split_routine`을 `security definer`로 바꾼다(반응을 옮기기 위해).
7. `avatars` 버킷을 공개 읽기로 둔다(파일 이름이 UUID라 추측 불가, 차단한 사람도 주소를 알면 볼 수 있음).
