# S6 — iOS 원격 푸시 · macOS 로컬 알림

> 기준: `docs/16-v3-social-plan.md` SOC-50·51·53·54, §6 "푸시", D10·D24, S0 결과(`S0-spikes.md` "S2·S6에 반영할 사항"), S1 `push_tokens`, S5 알림 트리거. 규칙: `AGENTS.md` §5 "소셜 (v3)"·§6.
> 브랜치: `feat/s6-push`. 아래 **작업 순서**대로 커밋을 나눕니다.

## 0. 범위

**완료 기준(계획서 §8): 앱을 닫은 iPhone에 반응 푸시가 온다.** macOS는 앱이 켜져 있으면(창을 닫았거나 다른 앱이 앞에 있어도) 시스템 알림이 뜹니다.

- **한다**: iOS 푸시 토큰 등록·정리(§3), 서버 발송(§1·§2: 알림 행 → Edge Function → Expo Push), 발송 규칙(같은 친구 3시간 1번, 기기 시간 밤 11시~아침 8시 제외), 푸시를 누르면 해당 화면 열기, macOS 로컬 알림(§4), 알림 권한 요청 흐름과 설정 화면의 권한 상태(§5).
- **하지 않는다**: 앱 아이콘 배지·Dock 배지(D24 — 항상 0), macOS 원격 푸시, 알림 탭·설정의 동작 변경(S5 그대로), 출시 작업(S7).
- **멈출 조건**: 이 단계가 막히면 계획서 §8대로 S6을 v3.1로 넘길 수 있습니다. 막히면 우회하지 말고 보고합니다.

### 작업 순서 (커밋 단위 제안)

1. DB: `push_tokens` 컬럼·발송 제한 테이블·알림 → 함수 호출 트리거·pgTAP(§1)
2. Edge Function `send-push`(§2)
3. iOS 토큰 등록·권한·푸시 응답(§3·§5)
4. macOS 로컬 알림·권한(§4·§5)

## 1. DB (마이그레이션 1개)

- **`push_tokens` 컬럼 추가**: `locale text not null default 'ko'`(기기 언어 `ko`·`en`), `time_zone text not null default 'UTC'`(기기 IANA 시간대), `app_version text`. 푸시 문장 언어와 조용한 시간을 **기기 기준**으로 정하기 위함입니다(SOC-51 "기기 시간"). 기존 RLS(본인 모든 권한) 그대로.
- **`push_throttle(recipient_id uuid, actor_id uuid, last_sent_at timestamptz, primary key (recipient_id, actor_id))`** — 친구 완료 푸시의 "같은 친구당 3시간 1번"용. 둘 다 `auth.users` cascade. RLS 켜고 정책 없음(서비스 역할만 씀). 계정 삭제 cascade를 S1 계정 삭제 pgTAP에 더합니다.
- **알림 → 발송 함수 호출**: `notifications` AFTER INSERT, 그리고 AFTER UPDATE에서 `new.updated_at > old.updated_at`(S5: 친구 완료 숫자가 **늘었을 때만** `updated_at`이 바뀜) → `pg_net`의 `net.http_post`로 Edge Function `send-push`를 부릅니다. 본문은 `{ notification_id }`만.
  - 함수 주소와 공유 비밀은 **Supabase Vault**에서 읽습니다(`project_url`, `push_webhook_secret`). 마이그레이션에 값을 넣지 않습니다. Vault에 값이 없으면 호출하지 않고 넘어갑니다(로컬 테스트·다른 개발자 환경이 깨지지 않게).
  - 트리거 함수는 `social_private`, definer, `search_path = ''`, 실행 권한 없음.
  - 원본 트랜잭션을 늦추거나 실패시키지 않게, HTTP 호출은 `pg_net`의 비동기 큐에 넣기만 합니다. 예외는 삼키고 경고만 남깁니다.
- `pg_net` 확장이 로컬·원격에서 켜져 있는지 확인하고, 마이그레이션에서 `create extension if not exists pg_net`.
- **pgTAP**: 컬럼 기본값, `push_throttle`에 authenticated 접근 불가, 알림 INSERT·숫자 증가 UPDATE에서만 `net.http_request_queue`에 요청이 쌓이고 숫자가 같거나 줄면 안 쌓임, Vault 값이 없으면 아무것도 안 쌓임, 계정 삭제 시 `push_throttle` 정리.

## 2. Edge Function `send-push`

- `supabase/functions/send-push/`(S3 `report-profile`처럼 `handler.ts` + `index.ts` + 테스트). `verify_jwt = false`로 두고 헤더 `x-push-secret`을 Vault의 `push_webhook_secret`과 **상수 시간 비교**합니다. 틀리면 401.
- 서비스 키 클라이언트로(이 함수는 서버 내부 전용):
  1. 알림 행을 읽습니다. 없으면(그새 지워짐 — 언팔로우·좋아요 취소) 아무것도 안 하고 200.
  2. 받는 사람의 `push_tokens`(iOS)를 읽습니다. 없으면 200.
  3. **다시 확인**: 받는 사람 설정(S5 `wants_notification`과 같은 규칙 — 함수로 RPC 하나를 노출하지 말고 같은 SQL을 서비스 키로 조회)과 차단·정지. 트리거와 발송 사이에 바뀌었을 수 있습니다.
  4. **친구 완료만**: `push_throttle(recipient, actor).last_sent_at`이 3시간 안이면 보내지 않습니다(SOC-51).
  5. **조용한 시간**: 토큰마다 `time_zone`의 현재 시각이 23:00~07:59면 그 토큰에는 보내지 않습니다. 나중에 몰아서 보내지 않습니다(알림 탭에는 남아 있음).
  6. 문장: 토큰의 `locale`로. 제목 없음, 본문은 알림 탭 문장과 같은 규칙(S5 `notificationSentence`의 문구를 함수 안에 같은 키로 둡니다 — 한·영 두 벌, 테스트로 카탈로그와 문장이 같은지 확인). 보낸 사람 닉네임이 자동 숨김이어도 닉네임은 그대로(S3). 항목 제목은 넣지 않고 숫자·종류만(잠금 화면 노출 최소화): 반응 "민수님이 좋아요를 남겼어요", 친구 완료 "민수님이 할 일 3개를 끝냈어요", 새 팔로워 "민수님이 나를 팔로우했어요".
  7. Expo Push API(`https://exp.host/--/api/v2/push/send`)로 토큰 묶음 발송. `sound: 'default'`, **`badge`는 넣지 않음**(D24), `data: { notificationId, kind, actorId, date, todoId, routineId }`, iOS `threadId`는 `kind:actorId`(같은 사람 알림을 묶음).
  8. 티켓에서 `DeviceNotRegistered`면 그 토큰 행을 지웁니다(S0). 다른 오류는 로그만.
  9. 한 토큰이라도 보냈고 친구 완료면 `push_throttle`을 `now()`로 upsert.
- 영수증(receipt) 조회는 v3에 넣지 않습니다(티켓 오류로 토큰 정리). 이유를 보고에 적습니다.
- 비밀: `EXPO_ACCESS_TOKEN`(Expo 계정의 푸시 보안을 켰다면, 없으면 생략). 로컬은 `supabase/functions/.env.local`, 원격은 사람이 `supabase secrets set`.
- 로컬 테스트: Expo 대신 가짜 서버로 보내는 dry-run(`PUSH_DRY_RUN=1`이면 요청 본문을 로그만). 단위 테스트: 비밀 불일치 401, 알림 없음, 설정 꺼짐, 3시간 제한, 조용한 시간 경계(22:59·23:00·07:59·08:00, 시간대 두 개), 언어, `DeviceNotRegistered` 정리, 배지 없음.

## 3. iOS — 토큰 등록과 푸시 응답

- 의존성: `expo-notifications`(S0 스파이크와 같은 버전대). `app.json`에 플러그인, `aps-environment`(개발 빌드 `development`, TestFlight·App Store `production` — EAS가 프로필에 맞춰 넣는지 확인). 새 의존성은 보고에 적습니다.
- **등록 시점**: 로그인했고 소셜이 켜져 있고 **알림 권한이 허용**된 상태에서, 앱 시작·앞으로 올 때 `getExpoPushTokenAsync({ projectId })` → `push_tokens` upsert(`token`, `user_id`, `platform='ios'`, `locale`, `time_zone`, `app_version`). 값이 같으면 쓰지 않습니다.
- **해제**: 로그아웃·계정 삭제 직전에 이 기기 토큰 행을 지웁니다(오프라인이면 다음 로그인 때 같은 토큰이 다른 사용자로 upsert되며 덮어씀 — PK가 `token`). 소셜 꺼짐이면 등록하지 않습니다.
- **앱이 앞에 있을 때**: 시스템 배너를 띄우지 않습니다(`setNotificationHandler`에서 `shouldShowBanner: false`, `shouldPlaySound: false`, `shouldSetBadge: false`). 알림 탭은 S5 Realtime으로 갱신됩니다.
- **푸시를 누르면**(앱이 꺼져 있을 때 포함, 마지막 응답 확인): `data`로 S5 `NotificationRow`와 같은 이동 — 새 팔로워·친구 완료 → 사람 하루 페이지(친구 완료는 그 날짜), 반응 → 오늘 탭 그 날짜. 대상이 사라졌으면 알림 탭.
- 배지는 시작할 때 0으로 맞춥니다(이전 빌드 잔여 대비).

## 4. macOS — 로컬 알림

- 의존성: Tauri 알림 플러그인(S0 스파이크와 같은 것, 버전 고정) + capability. 새 의존성·권한은 보고에 적습니다.
- 앱이 실행 중이면(창을 닫았거나 다른 앱이 앞에 있어도) S5의 `notifications` Realtime 구독에서 **INSERT, 그리고 친구 완료 숫자가 늘어난 UPDATE**를 받으면 시스템 알림을 띄웁니다. ⌘Q로 종료하면 오지 않습니다(S0 확인 — 정상).
- 같은 규칙을 앱에서 적용합니다: 설정(이미 트리거가 거름), **친구 완료 3시간 1번**(기기에 마지막 표시 시각 저장), **기기 시간 23:00~07:59 제외**. 서버와 같은 판정 함수를 `packages/core`에 두고 Edge Function 테스트와 같은 경계값으로 테스트합니다(`shouldDeliverPush({ kind, now, timeZone, lastSentAt })`).
- Nodii 창이 **앞에 있고 알림 탭을 보고 있으면** 띄우지 않습니다. 다른 탭을 보고 있으면 띄웁니다.
- 문장은 iOS 푸시와 같고, 알림을 누르면 Nodii가 앞으로 오고 §3과 같은 화면으로 이동합니다.
- Dock 배지는 쓰지 않습니다(항상 0, SOC-50).

## 5. 알림 권한 요청과 설정 표시

- **앱 시작 때 묻지 않습니다.** 처음으로 알림 탭을 열었을 때, 권한이 아직 정해지지 않았으면 목록 위에 카드(시안 없음 — 초대 카드와 같은 모양): "알림을 켜면 친구 소식을 바로 받아요" + [알림 켜기] + 닫기 `×`. [알림 켜기]를 눌러야 시스템 권한 창이 뜹니다. 닫으면 기기에 저장하고 7일 뒤에 한 번 더 보여 줍니다.
- 설정 > 알림 구역 맨 위에 시스템 권한이 **꺼져 있을 때만** 한 줄: "기기 설정에서 Nodii 알림이 꺼져 있어요" + [설정 열기](iOS: 앱 설정, macOS: 시스템 설정 알림 화면). 켜져 있으면 아무것도 표시하지 않습니다.
- S5 설정 스위치는 그대로(서버 설정). 시스템 권한과 섞지 않습니다.
- macOS: 서명 빌드에서 첫 권한 프롬프트가 뜨는지, 시스템 설정에서 Nodii 알림을 끈 상태에서 앱이 조용히 넘어가는지 확인합니다(S0에서 미확인).

## 6. 문구 (i18n)

- 권한 카드, 설정 안내 줄은 한국어·영어 카탈로그에. 푸시·로컬 알림 문장은 S5 알림 문장 키를 재사용하고, Edge Function 안의 사본은 테스트로 카탈로그와 일치를 확인합니다.

## 7. 테스트

- pgTAP: §1 전부. 기존 테스트 전부 통과.
- Edge Function: §2 목록.
- `packages/core`: `shouldDeliverPush` 경계값(조용한 시간·3시간·시간대).
- 앱: iOS 토큰 upsert(값이 같으면 안 씀)·로그아웃 삭제·앞에 있을 때 배너 없음·푸시 응답 이동 / macOS Realtime → 알림 표시 조건(알림 탭 보는 중 제외, 3시간, 조용한 시간)·알림 클릭 이동 / 권한 카드·설정 안내 줄 / 소셜 꺼짐이면 등록·표시 안 함.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`(기본 병렬, 시간 제한·워커 수 그대로), `pnpm db:reset` → `pnpm db:test`, `pnpm db:types`.

## 8. 완료 기준

로컬에서 확인할 것:

- [ ] 알림 INSERT·친구 완료 숫자 증가에서만 `send-push`가 불리고(dry-run 로그), 설정 꺼짐·차단·3시간 안·조용한 시간에는 보내지 않는다.
- [ ] `DeviceNotRegistered` 티켓이면 토큰 행이 지워진다(가짜 응답).
- [ ] macOS 개발 앱: 다른 계정의 반응·팔로우·친구 완료에 시스템 알림이 뜨고, 누르면 해당 화면. 알림 탭을 보는 중에는 안 뜬다.

**사람이 확인(실기기 · 원격 스파이크 또는 스테이징 프로젝트)**:

- [ ] TestFlight 빌드를 설치한 iPhone에서 앱을 **완전히 종료**한 뒤, 다른 계정이 좋아요를 누르면 푸시가 온다. 누르면 그날 오늘 탭이 열린다.
- [ ] 같은 친구의 완료가 3시간 안에 두 번이면 푸시는 한 번(알림 탭에는 숫자 증가).
- [ ] 기기 시간대 밤 11시 이후에는 푸시가 안 온다(시간대를 바꿔 확인해도 됨).
- [ ] 서명한 macOS 앱의 첫 권한 프롬프트, 시스템 설정에서 알림을 끈 상태.
- [ ] 앱 아이콘·Dock 배지가 어디에도 생기지 않는다.

## 9. 사람이 할 일

- 원격(스파이크 또는 스테이징) 프로젝트에서: `pg_net` 확인, Vault에 `project_url`·`push_webhook_secret` 넣기, `supabase secrets set PUSH_WEBHOOK_SECRET=…`(같은 값) 과 필요하면 `EXPO_ACCESS_TOKEN`, `supabase functions deploy send-push`.
- EAS: 푸시 키(APNs Auth Key)가 Expo 프로젝트에 연결되어 있는지 확인(S0에서 TestFlight 푸시가 됐으면 이미 연결됨). TestFlight 빌드 업로드.
- 운영 프로젝트에는 S7에서 같은 순서로.

## 10. 하지 말 것

- 배지(앱 아이콘·Dock) 숫자 설정. 읽음 상태 추가.
- 앱 시작 때 권한 묻기.
- 마이그레이션·코드·커밋에 비밀 값(서비스 키, 웹훅 비밀, Expo 토큰) 넣기.
- 트리거에서 동기 HTTP 호출이나, 발송 실패로 원본 쓰기를 실패시키는 일.
- §1 외의 스키마·RLS 변경, S5 알림 생성 규칙 변경.
- 테스트 시간 제한을 늘리거나 워커 수를 줄여 CI를 통과시키는 일.
- 운영 Supabase 적용, App Store 제출(S7).

## 11. 이 지시서에서 정한 것 (보고 때 다시 확인)

1. 알림 행(INSERT·친구 완료 숫자 증가)이 `pg_net`으로 Edge Function `send-push`를 부르고, 함수가 설정·차단·제한을 **다시 확인**한 뒤 Expo로 보낸다.
2. 조용한 시간과 문장 언어는 **기기(토큰) 기준**이다. 그래서 `push_tokens`에 `locale`·`time_zone`을 더한다.
3. 조용한 시간에 막힌 푸시는 나중에 보내지 않는다(알림 탭에는 남음).
4. 3시간 제한은 친구 완료에만, 받는 사람·보낸 사람 쌍마다 `push_throttle`로 센다. macOS는 기기에서 같은 규칙.
5. 푸시 문장에 할 일 제목을 넣지 않는다(잠금 화면 노출 최소화).
6. 영수증 조회는 하지 않고 티켓 오류로 토큰을 정리한다.
7. 권한은 알림 탭 카드에서 사용자가 눌렀을 때만 묻는다.
8. 앱이 앞에 있을 때 iOS 배너는 띄우지 않고, macOS는 알림 탭을 보는 중일 때만 띄우지 않는다.
