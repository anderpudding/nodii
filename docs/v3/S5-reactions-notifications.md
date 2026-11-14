# S5 — 반응 하트 · 알림 탭 · 알림 설정

> 기준: `docs/16-v3-social-plan.md` SOC-40~42·50~53·55·56, D8·D10·D24·D25, S1 스키마(`reactions`·`react` RPC·`notifications`·`notification_prefs`·`notification_mutes`, `S1-db.md` §5), S3·S4 결과. 화면: `docs/design/screens.md`·`mobile-screens.md`의 v3 절(알림 탭, 설정 > 알림), `components.md` "v3 소셜"(`HeartButton`·`NotificationRow`·종류 필터 칩·`FollowButton`), `tokens.md` §9. 규칙: `AGENTS.md` §5 "소셜 (v3)"·§6.
> 브랜치: `feat/s5-notifications`. macOS와 iOS를 **같이** 만듭니다. 아래 **작업 순서**대로 커밋을 나눕니다.

## 0. 범위

**완료 기준(계획서 §8): 반응이 알림 탭에 뜨고, 설정대로 켜지고 꺼진다.** 두 앱 모두. S6(푸시)이 늦어져도 S5만으로 알림 기능이 완결되어야 합니다.

- **한다**: 친구 하루의 반응 하트(§3.1), 알림을 만드는 DB 함수와 트리거(§1), 알림 탭(§3.2), 설정 > 알림과 사람별 친구 완료 알림(§3.3), 알림 실시간 갱신(§2).
- **하지 않는다**: 원격 푸시·macOS 로컬 알림·`push_tokens` 쓰기(S6), 앱 아이콘 배지·탭 배지·읽음 상태(D24 — 만들지 않음), 댓글(D11), 반응 종류 추가(v3는 좋아요 하나).

### 작업 순서 (커밋 단위 제안)

1. DB: 알림 생성 함수·트리거·pgTAP(§1)
2. `packages/core`·`packages/api`(§2)
3. 반응 하트(§3.1)
4. 알림 탭(§3.2)
5. 설정 > 알림(§3.3)

## 1. DB — 알림 만들기 (마이그레이션 1개)

S1은 `notifications` 테이블과 RLS만 만들고 **쓰기 권한을 아무에게도 주지 않았습니다**. S5에서 definer 트리거가 씁니다. 테이블 구조는 바꾸지 않습니다(필요하면 멈추고 보고).

- 마이그레이션 `supabase migration new notification_triggers`. 함수는 `social_private` 스키마, `security definer`, `search_path = ''`, 실행 권한은 아무에게도 주지 않습니다(트리거 전용). definer 예외(AGENTS.md §6)는 보고에 적습니다.
- **받는 사람 설정 판정**: `social_private.wants_notification(recipient, actor, kind)` — `notification_prefs`에 행이 없으면 기본값(친구 완료 끔, 새 팔로워 켬, 반응 켬). 친구 완료는 `notification_mutes(recipient, actor)`가 있으면 **그 값이 전체 설정보다 우선**(S1 결정 4). 차단이 있으면(`social_private.is_blocked_between`) 거짓. 받는 사람이 소셜 프로필이 없거나 정지(`social_suspended_at`)면 거짓.
- **새 팔로워(`follow`)**: `follows` AFTER INSERT → 판정이 참이면 `notifications(recipient = followee, actor = follower, kind = 'follow')` INSERT. `follows` AFTER DELETE(언팔로우·내보내기·차단 cascade) → 그 `follow` 알림을 지웁니다(팔로우·언팔로우를 반복해 알림을 쌓지 못하게, 줄이 남아 오해를 주지 않게).
- **반응(`reaction`)**: `reactions` AFTER INSERT → `notifications(recipient = owner, actor = reactor, kind = 'reaction', todo_id / routine_id + date)`. `reactions` AFTER DELETE(좋아요 취소) → 그 알림을 지웁니다. 판정은 `reaction` 설정.
- **친구 완료(`friend_done`)**: 할 일이 **완료로 바뀔 때**(`todos` AFTER UPDATE OF `is_done` WHEN `new.is_done and not old.is_done and new.deleted_at is null`, 그리고 완료 상태로 INSERT될 때)와 루틴 기록이 **`done`이 될 때**(`routine_logs` AFTER INSERT/UPDATE, `status = 'done'`).
  - 받는 사람 = 완료한 사람을 **팔로우하는 사람** 중, 그 항목을 볼 수 있고(`relation_level(recipient, owner)`와 목표 `visibility` — `can_view_goal`과 같은 규칙을 recipient 기준으로) 판정이 참인 사람(SOC-52).
  - 하루 한 줄(SOC-51): `(recipient, actor, date)` unique(S1 인덱스)로 **upsert**. `date`는 할 일·루틴 기록의 날짜.
  - `count`는 더하지 않고 **그때 다시 셉니다**: 그 날짜에 actor가 끝낸 항목 중 recipient가 볼 수 있는 할 일(`is_done`, 삭제 안 됨) + 루틴 기록(`done`) 개수. 그래서 같은 할 일을 체크·해제·재체크해도 한 번만 셉니다(SOC-51).
  - 숫자가 **늘었을 때만** `updated_at = now()`(맨 위로). 같거나 줄면 `count`만 고치고 순서는 그대로.
  - 완료 취소로는 알림을 지우지 않습니다(펼치면 현재 끝낸 항목만 보이므로, §3.2).
  - 팔로워가 많아도 한 트랜잭션에서 처리합니다(v3 규모). 팔로워 수가 큰 계정의 성능은 pgTAP에서 팔로워 200명으로 한 번 재 보고 보고에 적습니다.
- 자기 자신에게는 어떤 알림도 만들지 않습니다.
- **pgTAP**(`supabase/tests/`에 새 파일):
  - 팔로우하면 `follow` 알림, 언팔로우하면 사라짐, 새 팔로워 끔이면 안 생김.
  - 반응하면 `reaction` 알림, 취소하면 사라짐, 반응 알림 끔이면 안 생김.
  - 친구 완료: 기본 끔이면 안 생김 / 전체 켬이면 생김 / 전체 켬 + 사람별 끔이면 안 생김 / 전체 끔 + 사람별 켬이면 생김.
  - 친구 완료 공개 범위: 나만 목표 안 생김, 맞팔로우 목표는 맞팔에게만, 팔로워 목표는 팔로워에게.
  - 같은 날 두 개 끝내면 한 줄 `count = 2`, 체크·해제·재체크해도 `count` 그대로, 다른 날은 새 줄.
  - 건너뛴 루틴은 알림을 만들지 않음. 차단 사이엔 어떤 알림도 없음. authenticated는 여전히 `notifications`에 직접 쓰지 못함.

## 2. `packages/core` · `packages/api`

- **core** (테스트 먼저):
  - `groupNotifications(rows, now, tz)` → 구간 `today` · `thisWeek` · `earlier`(주 시작 요일 설정을 따름).
  - `filterNotifications(rows, kind)` — 칩 `all` · `friend_done` · `reaction` · `follow`.
  - `notificationSentence(row, locale)` 문구 키 고르기: 새 팔로워 "{이름}님이 나를 팔로우했어요", 반응 "{이름}님이 {항목}에 좋아요를 남겼어요", 친구 완료 "{이름}님이 할 일 {n}개를 끝냈어요"(1개면 "{항목}을 끝냈어요"는 쓰지 않고 숫자 문장으로 통일).
  - `effectiveFriendDone(prefs, mutes, actorId)`(설정 화면 표시용, DB 판정과 같은 규칙).
- **api**:
  - `fetchNotifications(client, me)` — `recipient_id = me`, `updated_at desc`, **최근 100줄**. 배우(actor) 프로필은 `social_profiles`를 한 번에 조회해 붙이고 `visibleProfile`(S3)을 적용. 반응·친구 완료의 항목 제목은 볼 수 있는 할 일·루틴을 한 번에 조회해 붙입니다(N+1 금지). 볼 수 없게 된 항목이면 제목 없이 "할 일"로.
  - `subscribeNotifications(client, me, onChange)` — Realtime `notifications`(`recipient_id=eq.{me}`), INSERT·UPDATE·DELETE에 목록 쿼리를 무효화. 앱이 앞으로 올 때도 다시 불러옵니다.
  - `react(client, { todoId } | { routineId, date })` — S1 `react` RPC. `unreact(client, me, reactionId)` — 본인 `reactions` DELETE(ADR-017). 오류 `not_visible`·`not_done`·`own_item`을 `socialErrorCode`에 연결.
  - `fetchMyReactions(client, me, { todoIds, routineDates })` — 친구 하루에 보이는 항목들에 내가 남긴 반응을 한 번에(하트 상태).
  - `fetchNotificationPrefs`·`updateNotificationPrefs`(행이 없으면 upsert), `fetchNotificationMutes`·`setNotificationMute(actorId, friendDone)`·`clearNotificationMute(actorId)`.
  - 훅: `useNotifications`(Realtime 포함), `useReactionToggle`(낙관적), `useNotificationPrefs`, `useNotificationMutes`.

## 3. 화면

값은 `tokens.md` 토큰만 씁니다. 화면을 만들기 전에 `mobile-designs/v3/`·`desktop-designs/v3/`의 PNG를 열어 봅니다. S5 시안은 iOS `SocialNotifyFinal`(모바일 탭 "알림 · 사람 하루" 줄), macOS `MacNotifyMN1`(데스크톱 탭 알림 줄), 설정(`ProfileSettings`·`MacProfileM1Settings`), 친구 하루의 하트(`SocialFriendsA1`·`DeskSocialFinal`).

### 3.1 반응 하트 (SOC-40·41, D8, `HeartButton`)

- 친구의 하루(오늘 탭에서 친구 선택, 사람 하루 페이지)에서 **끝낸** 할 일·루틴 줄 오른쪽 끝(S4에서 비워 둔 자리). 끝내지 않은 줄에는 없습니다.
- 누른 하트는 그 목표의 이름표 글자색(`goalInk`)으로 채움(SOC-32). `aria-pressed` + 레이블 "아침 독서 30분 좋아요" / "좋아요 취소".
- 낙관적 토글. `react`가 `not_done`·`not_visible`이면 되돌리고 토스트 "반응을 남기지 못했어요". 취소는 본인 반응 DELETE.
- 반응을 남긴 뒤 친구가 완료를 취소하면 그 줄은 미완료가 되어 하트가 안 보이지만, 반응과 알림은 남습니다(D8).
- 할 일 신고 메뉴(S4)는 그대로. 하트 버튼은 줄 메뉴를 열지 않습니다.

### 3.2 알림 탭 (SOC-50·55·56, D24, iOS `SocialNotifyFinal` · macOS `MacNotifyMN1`)

- S2에서 비워 둔 알림 탭을 채웁니다. 큰 제목 "알림" → 종류 필터 칩 [전체 · 친구 완료 · 좋아요 · 팔로우](하나만, 기본 전체) → 구간 "오늘" · "이번 주" · "이전" → `NotificationRow`.
  - macOS: 가운데 한 줄 목록(MN1, D29). 탭바는 알림이 선택된 채로.
- **안 읽음 표시·개수 배지·모두 읽음 없음**(D24). 탭바 알림 아이콘에도 배지 없음.
- 줄 동작(SOC-55, `components.md` `NotificationRow`):
  - 아바타·이름 → 사람 하루 페이지(S4). 머리 "‹ 알림".
  - **새 팔로워**: 오른쪽 `FollowButton`(작게, D25 세 상태 — 보통 [맞팔로우]). 줄 → 사람 하루 페이지.
  - **반응**: 오른쪽에 반응받은 목표의 싹이 체크(22, 목표 색). 줄 → 오늘 탭, 그 항목의 날짜로(내 하루).
  - **친구 완료**: 오른쪽 펼치기 `⌄`(32 원, 열리면 `⌃`). 줄 → 그 자리에서 펼치기/접기. 펼친 안쪽(`chip` 둥근 사각형, 반지름 14)에 그날 **지금 끝나 있는** 볼 수 있는 항목: 싹이 체크 20 · 제목 14 `ink-2` · `HeartButton`. 펼칠 때 S4의 친구 하루 조회로 그 날짜만 불러옵니다. 하나도 없으면(모두 완료 취소) "끝낸 항목이 없어요".
- 빈 상태: "아직 알림이 없어요". 칩으로 거른 결과가 없으면 "이 종류의 알림이 없어요".
- 친구 완료 알림이 꺼져 있고(기본) 팔로잉이 1명 이상이면, 목록 맨 아래에 한 번만 안내 줄 "친구가 할 일을 끝내면 알려 드릴까요?" + [켜기](→ §3.3 화면). 닫기 `×`를 누르면 기기에 저장하고 다시 띄우지 않습니다.
- 실시간: 탭을 보고 있는 동안 새 줄이 위에 생기고, 친구 완료 줄의 숫자가 바뀌면 맨 위로 올라갑니다. 지워진 알림(언팔로우·좋아요 취소)은 사라집니다. 목록을 조회할 때 정지 등으로 발신자 프로필을 읽을 수 없는 알림은 제외합니다.
- 당겨서 새로고침(iOS)·`⌘R`(macOS).

### 3.3 설정 > 알림 (SOC-51·53, D10)

- 설정 > 알림 구역(S2에서 자리만 둔 항목을 연결):
  - **친구 완료 알림** `›`(오른쪽 값: 끔 / 모두 / n명) → 하위 화면.
  - **새 팔로워**(스위치, 기본 켬), **받은 좋아요**(스위치, 기본 켬). 바로 저장(낙관적).
- **친구 완료 알림 하위 화면**(시안 없음 — 설정 하위 화면 모양으로): 머리 "‹ 설정" + 제목 "친구 완료 알림".
  - 맨 위 스위치 "모든 친구"(전체 설정) + 아래 설명 13 `muted` "친구가 할 일을 끝내면 하루에 한 줄로 알려 드려요."
  - 구역 "사람별" + 내 팔로잉 목록(40 `Avatar` · 이름 · `@ID` · 스위치). 스위치 값은 `effectiveFriendDone`. 사람별 스위치를 전체 설정과 **다르게** 바꾸면 그 사람에 대한 예외(`notification_mutes`)를 저장하고, 전체 설정과 **같게** 되돌리면 예외를 지웁니다. 예외가 있는 사람 줄 아래에 12 `muted` "따로 설정함".
  - 맨 위 "모든 친구"를 바꾸면 예외는 그대로 둡니다(예외가 우선, S1 결정 4).
  - 팔로잉이 0명이면 "사람별" 구역 대신 "팔로우한 사람이 없어요".
- macOS: 설정은 프로필 오른쪽 칸 하위 화면(`MacProfileM1Settings`), 친구 완료 알림은 그 안에서 한 단계 더 들어갑니다("‹ 설정").

## 4. 문구 (i18n)

- 한국어·영어 카탈로그에 함께: 알림 문장 세 가지(이름은 굵게 처리할 수 있게 조각으로), 칩, 구간, 빈 상태, 안내 줄, 하트 레이블·토스트, 설정 화면. 영어 칩 `All · Friends' done · Likes · Follows`.
- 시간 표시: 오늘은 "3분 전"·"2시간 전", 이번 주는 요일, 이전은 날짜(기존 날짜 형식 함수).

## 5. 테스트

- pgTAP: §1 전부. 기존 테스트 전부 통과.
- `packages/core`: §2 함수(구간 경계 — 자정·주 시작 요일, 필터, 문장, 실효 설정).
- `packages/api`: 알림 조회가 한 번에 프로필·항목을 붙임(N+1 없음), Realtime 필터가 `recipient_id=eq.me`, 반응 오류 매핑, 예외 저장·삭제 규칙.
- 앱(두 앱): 하트 토글·실패 되돌리기, 칩 필터, 구간, 친구 완료 펼치기(지금 끝난 항목만), 새 팔로워 줄의 `FollowButton`, 반응 줄 → 오늘 탭 날짜 이동, 안내 줄 닫기, 설정 스위치와 사람별 예외("따로 설정함"), 소셜 꺼짐 경로 그대로.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`(기본 병렬, 시간 제한·워커 수를 바꾸지 않음), `pnpm db:reset` → `pnpm db:test`, `pnpm db:types`.

## 6. 완료 기준

로컬 Supabase + 두 개발 앱, 세 계정(A·B·C)으로(`pnpm db:social-on`):

- [ ] B가 A의 끝낸 할 일에 하트 → A의 알림 탭에 "B님이 …에 좋아요를 남겼어요"가 실시간으로 뜬다. B가 취소하면 줄이 사라진다.
- [ ] A가 받은 좋아요를 끄면 새 반응 알림이 생기지 않는다. 다시 켜면 생긴다.
- [ ] C가 A를 팔로우 → A에게 새 팔로워 줄 + [맞팔로우]. A가 누르면 [팔로잉]. 새 팔로워를 끄면 안 생긴다.
- [ ] 친구 완료는 기본으로 안 온다. A가 "모든 친구"를 켜면 B가 할 일 두 개를 끝낼 때 한 줄 "할 일 2개", 체크를 풀었다 다시 해도 2개. 펼치면 지금 끝난 항목과 하트.
- [ ] A가 "모든 친구" 켬 + B만 끔 → B 완료 알림 없음, C 완료 알림 있음. 반대(전체 끔 + B만 켬)도 맞다.
- [ ] 나만 목표의 완료는 알림이 없고, 맞팔로우 목표는 맞팔에게만 간다.
- [ ] 반응을 남긴 뒤 상대가 완료를 취소해도 반응과 알림이 남는다(D8).
- [ ] 안 읽음 표시·배지가 어디에도 없다.
- [ ] 두 앱 모두 소셜 꺼짐 경로가 그대로.

### 2026-11-14 검증 기록

위 체크박스는 **두 네이티브 개발 앱에서 세 계정으로 교차 재현**하는 기준이므로 남겨 두었습니다. 로컬 Supabase에는 `pnpm db:social-on`을 적용하고 실제 세 계정으로 API와 Realtime을 검증했습니다. 데스크톱 개발 미리보기는 같은 로컬 서버를 사용했고, 두 앱의 자동화 테스트도 통과했습니다.

| §6 항목 | 확인한 증거 |
| --- | --- |
| 1. 하트와 실시간 취소 | 실제 DB의 INSERT·DELETE가 Realtime으로 도착했고 데스크톱 미리보기의 줄도 생겼다가 사라졌습니다. 두 앱에서 하트 토글과 실패 복원을 테스트했습니다. |
| 2. 받은 좋아요 끄기/켜기 | 실제 API에서 끄면 알림 없이 반응만 저장되고, 켜면 다시 수신했습니다. 두 앱에서 설정 쓰기를 테스트했습니다. |
| 3. 새 팔로워 | 실제 Realtime 및 데스크톱 미리보기에서 줄이 생기는 것을 확인했습니다. 새 팔로워 끄기는 실제 API, [맞팔로우] 표시는 양쪽 앱 테스트에서 확인했습니다. |
| 4. 하루 묶음 | 실제 DB에서 기본 끔, 2개 한 줄, 재체크 후 개수·순서 유지를 확인했습니다. 데스크톱 미리보기와 양쪽 앱 테스트에서 펼침과 하트를 확인했습니다. |
| 5. 사람별 예외 | A·B·C 실제 계정으로 전체 켬+B만 끔과 전체 끔+B만 켬을 확인했습니다. 양쪽 앱 테스트는 예외 표시·유지·삭제를 확인했습니다. |
| 6. 공개 범위 | 실제 API와 pgTAP에서 나만·단방향·맞팔 범위를 확인했습니다. |
| 7. 완료 취소 뒤 반응 보존 | 실제 API와 pgTAP에서 반응과 알림 보존을 확인했습니다. |
| 8. 배지 없음 | 데스크톱 미리보기와 두 앱의 화면 코드에서 확인했습니다. |
| 9. 소셜 꺼짐 | 두 앱의 셸 회귀 테스트에서 기존 오늘 화면만 표시하는 것을 확인했습니다. |

## 7. 하지 말 것

- 앱에서 `notifications`에 쓰지 않습니다(트리거만 씀). 서비스 키를 앱에 넣지 않습니다.
- 읽음 상태 컬럼·배지·"모두 읽음"(D24).
- 푸시 발송·`push_tokens`·로컬 알림(S6). 트리거에 HTTP 호출(pg_net 등)을 넣지 않습니다 — S6에서 정합니다.
- §1 외의 스키마·RLS 변경, `notifications`·`reactions` 외 테이블의 Realtime 추가.
- 테스트 시간 제한을 늘리거나 워커 수를 줄여 CI를 통과시키는 일.
- 원격 Supabase 적용, 운영 빌드·TestFlight 업로드(사람이 함).

## 8. 이 지시서에서 정한 것 (보고 때 다시 확인)

1. 알림은 definer 트리거가 만든다. 앱에는 쓰기 권한이 없다.
2. 언팔로우·좋아요 취소하면 그 알림을 지운다. 친구 완료 알림은 완료 취소로 지우지 않는다.
3. 친구 완료 `count`는 더하지 않고 그때 볼 수 있는 끝낸 항목을 다시 센다. 숫자가 늘 때만 맨 위로.
4. 사람별 설정은 전체 설정과 다를 때만 예외로 저장하고, 같아지면 지운다.
5. 알림 탭은 최근 100줄만 불러온다. 오래된 알림을 지우는 서버 작업은 v3에 없다.
6. SOC-42(내 할 일에 받은 반응 보기)는 알림 탭의 반응 줄로 충족한다. 내 하루 목록에 하트 수를 따로 표시하지 않는다.
7. 친구 완료 알림이 꺼져 있을 때 알림 탭 맨 아래에 한 번 켜기 안내를 둔다(시안 없음, 제안).
8. 친구 완료 알림 사람별 하위 화면은 시안 없이 설정 하위 화면 모양으로 만든다.


### §8 확인 결과

1. `social_private`의 트리거 전용 definer 함수가 알림을 생성·삭제합니다. 비어 있는 `search_path`를 사용하고 앱 역할에는 실행·직접 쓰기 권한을 주지 않았습니다.
2. 언팔로우·좋아요 취소는 해당 알림을 삭제합니다. 완료 취소는 친구 완료 알림과 받은 반응을 보존합니다.
3. 완료할 때 수신자가 볼 수 있는 현재 완료를 다시 셉니다. 수가 증가할 때만 최신 시간으로 올립니다.
4. 사람별 값을 전체와 다르게 바꾸면 upsert, 전체와 같은 값으로 되돌리면 DELETE합니다. 전체 스위치 변경 시 기존 예외는 보존합니다.
5. 목록은 최근 100줄을 읽습니다. 서버 정리 작업은 두지 않았습니다.
6. 받은 반응은 알림 탭에 표시합니다. 내 하루에는 하트 수를 추가하지 않았습니다.
7. 전체 친구 완료 알림이 꺼져 있고 팔로잉이 있을 때 안내를 표시합니다. [켜기]는 친구 완료 설정을 열고, 닫기는 기기에 저장합니다.
8. 사람별 화면은 기존 하위 설정 화면의 패턴을 따릅니다.

- 검증: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`(809개), `pnpm --filter @nodii/core test:coverage`(줄 94.10%). 격리한 테스트 프로젝트에서 `pnpm db:reset`, `pnpm db:test`(379개), `pnpm db:types`(생성 결과 동일)를 실행했습니다.
- **팔로워 200명**: pgTAP에서 팔로워와 설정을 미리 만든 뒤, 할 일 1건을 완료하는 UPDATE와 동기 트리거 전체가 **203.652 ms**에 끝났습니다. 각 수신자에게 `count = 1`인 알림 총 200줄을 확인했습니다. 로컬 1회 측정으로 운영 지연은 포함하지 않습니다.
- 연 PNG: iOS — `A1 · 이름 달린 아바타 줄.png`, `사람 하루 · 펼친 머리 (P2).png`, `알림 · 최종 (N1 + 종류 필터).png`, `설정 (v3 · 프로필 탭에서 진입).png`, `설정 · 전체 길이 (스크롤).png`. macOS — `DeskSocial.png`, `알림 › 아바타 누름 · 사람 하루 페이지.png`, `알림 · 가운데 한 줄 목록 (D29).png`, `설정 · 프로필 탭 오른쪽 하위 화면 (v3).png`.
- 시안의 배지·NEW 표시·여러 사람의 반응을 합친 문장 대신 지시서의 알림 규칙을 따랐습니다. 이번 주는 요일, 이전은 날짜를 사용했고 펼침 바탕은 `chip`입니다.
- **안 되는 것과 대안**: Supabase Postgres Changes의 기존 복제 설정은 DELETE를 수신자 열로 거를 수 없습니다. INSERT·UPDATE는 수신자 필터를 사용하고, DELETE는 기본 키가 현재 내 캐시에 있을 때만 RLS가 적용되는 목록을 다시 읽습니다. 테이블이나 RLS 변경은 필요하지 않았습니다. 친구 완료 행에는 대상 ID가 없어 목록에서 제목을 미리 붙일 수 없습니다. 펼칠 때 해당 날짜의 S4 조회로 현재 완료를 읽습니다.
- **사람 확인 대기**: Tauri 네이티브 셸과 iOS 시뮬레이터에서 §6 전체를 교차 재현합니다. iOS 시뮬레이터는 개발 앱을 설치하고 실행했지만 시스템 링크 열기 확인 이후 UI를 조작하지 못했습니다. 푸시·로컬 알림, 원격 DB 적용, 스토어 빌드는 S5 범위 밖입니다.
