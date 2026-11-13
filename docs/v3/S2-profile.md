# S2 — 프로필 탭 · 프로필 · 사진 · 초대 링크 · 기본 공개 범위

> 기준: `docs/16-v3-social-plan.md` SOC-01~08·SOC-28·D20·D22·D23·D25·D26·D27·D28, S0 결과(`S0-spikes.md` "결과"), S1 스키마(`supabase/migrations/20261112*`). 화면: `docs/design/screens.md`·`mobile-screens.md`의 v3 절, `components.md` "v3 소셜", `tokens.md` §9. 규칙: `AGENTS.md` §5 "소셜 (v3)"·§6.
> 브랜치: `feat/s2-profile`. macOS와 iOS를 **같이** 만듭니다.

## 0. 범위

**완료 기준(계획서 §8): 두 계정이 각자 ID를 정하고, 초대 링크로 서로의 프로필을 연다.** 두 앱 모두.

- **한다**: 소셜 켜짐 플래그와 하단 탭바 뼈대(§1), `packages/api`·`packages/core`의 프로필 기능(§2·§3), 프로필 시작(ID 정하기), 프로필 탭, 프로필 편집, 사진 자르기·업로드, 설정 옮기기와 새 설정 항목, 초대 링크 공유·열기, 다른 사람 프로필 보기(머리만), 새 목표의 기본 공개 범위 적용, 계정 삭제 전 사진 정리.
- **하지 않는다**: 팔로우·검색·팔로잉/팔로워 목록·차단·신고(S3), 목표 공개 범위 UI·`GoalMark`·아바타 줄·친구 하루·"오늘에 보일 사람"·월 제목 오늘 버튼(S4), 반응·알림 탭 내용·알림 설정(S5), 푸시·로컬 알림(S6), DB 스키마 변경(필요하면 멈추고 보고).

### 계획서와 다른 점: 탭바를 S2로 당깁니다

계획서 §8은 탭바를 S4에 두었지만, 프로필 탭과 설정 이동(D27)은 탭바 없이 들어갈 자리가 없습니다. 그래서 **탭바 뼈대는 S2**에서 만들고, S4는 탭바를 그대로 쓰고 오늘 탭 내용만 바꿉니다. 알림 탭은 S5 전까지 빈 상태 화면입니다.

## 1. 소셜 플래그 · 탭바 · 설정 진입점 (D13, D20~D22, D27)

- `packages/api`에 `fetchSocialEnabled(client)` — `app_config.social_enabled = 'true'`일 때만 참. 실패·시간 초과(3초)는 **거짓**(v2 화면으로 동작). `fetchMinAppVersion`과 같은 방식으로 앱 시작 때 한 번 읽고, 앱이 앞으로 올 때 다시 읽습니다.
- **로컬 개발**: `supabase/seed.sql` 끝에 `update public.app_config set value = 'true' where key = 'social_enabled';`를 더합니다(seed는 로컬 전용). 원격은 S7에서 사람이 켭니다.
- **소셜 꺼짐**: 지금 화면 그대로(탭바 없음, 오늘 화면의 설정 진입점 그대로). 이 경로의 기존 테스트가 그대로 통과해야 합니다.
- **소셜 켜짐**:
  - iOS: 하단 탭바 `오늘 | 알림 | 프로필`(아이콘만, 접근성 레이블은 이름). 계획서 §5대로 Expo Router native tabs를 먼저 시도하고, 시안 모양(떠 있는 알약, `tokens.md` §9)을 낼 수 없거나 iOS 27에서 문제가 있으면 자체 탭바로 만듭니다. 고른 방식과 이유를 보고합니다. 하위 화면에서는 탭바를 숨깁니다.
  - macOS: 창 아래 56 줄 탭바(`tokens.md` §9), `⌘1~3`.
  - 오늘 탭: 날짜 줄·상단 줄에서 **설정 진입점을 없애고**, 하루 메뉴 버튼 아이콘을 `⋯`에서 **슬라이더**로 바꿉니다(D22). 데스크톱은 하루 목록 위의 설정 글리프만 없앱니다. 그 밖의 오늘 화면(날짜 제목·화살표·[오늘] 버튼·아바타 줄)은 S4에서 바꿉니다.
  - 알림 탭: 큰 제목 "알림" + 가운데 "아직 알림이 없어요". S5에서 채웁니다.
  - 탭 사이를 오가도 오늘 탭의 선택 날짜·스크롤은 유지합니다.

## 2. `packages/api`

새 파일은 `repositories/social-profiles.ts`, `hooks/social.ts`, `avatars.ts`, `invites.ts`처럼 나눕니다. 행 ↔ 타입 변환은 `mappers.ts`에만 둡니다.

| 함수 / 훅 | 하는 일 |
| --- | --- |
| `fetchMySocialProfile` · `useMySocialProfile` | 내 `social_profiles` 행(없으면 `null`). 쿼리 키 `['socialProfile', 'me']` |
| `fetchSocialProfile(userId)` · `useSocialProfile(userId)` | 다른 사람 프로필. RLS가 막으면(차단·정지) `null`. 키 `['socialProfile', userId]` |
| `createSocialProfile({ handle, nickname })` | 소셜 시작(SOC-03). INSERT 뒤 `invite_links`가 트리거로 생깁니다 |
| `updateSocialProfile(patch)` | 닉네임·ID·소개·사진·검색 허용. 낙관적 업데이트 + 실패 시 롤백 |
| `checkHandle(handle)` | `handle_available` RPC → `'ok' \| 'taken' \| 'held' \| 'reserved' \| 'banned' \| 'invalid'` |
| `fetchMyInvite()` | 내 `invite_links.token` |
| `resolveInvite(token)` | `resolve_invite` RPC → `userId \| null` |
| `uploadAvatar(userId, { 160: bytes, 480: bytes })` | `avatars/{userId}/{uuid}_160.jpg`·`_480.jpg` 업로드 → `avatar_path = '{userId}/{uuid}'` 저장 → **이전 두 파일 삭제**. 중간에 실패하면 올린 파일을 지우고 이전 값 유지(S0 `uploadSpikeAvatars`와 같은 정리 규칙) |
| `removeAvatar()` | `avatar_path = null` 저장 후 이전 파일 삭제("기본 이미지로 되돌리기") |
| `avatarUrl(path, size)` | 공개 URL. 파일 이름에 UUID가 있어 바뀌면 주소도 바뀌므로 캐시를 따로 무효화하지 않습니다 |
| `clearMyAvatarFolder()` | 내 폴더의 파일을 모두 지움(계정 삭제 직전, §4.8) |
| `updateDefaultVisibility(v)` | `profiles.default_visibility`(SOC-28). `public`은 타입에서부터 막습니다 |

- 서버 오류를 화면 문구로 바꾸는 함수 하나: `socialErrorCode(error)` → `'reserved' | 'banned' | 'handle_cooldown' | 'handle_held' | 'taken'(unique 위반 23505) | 'network' | 'unknown'`. 어떤 단어가 걸렸는지는 서버도 주지 않고 앱도 보여 주지 않습니다.
- 목표 만들기(`createGoal`)는 `visibility`를 `profiles.default_visibility`로 채웁니다(SOC-28). 공개 범위를 고르는 UI는 S4입니다.
- 모든 새 함수에 MSW 테스트(정상 1개 + 오류 1개).

## 3. `packages/core` (테스트 먼저, 커버리지 90%)

- `validateHandle(raw)`: 소문자로 바꾼 값과 결과(`ok` 또는 `invalid`의 이유: 길이·첫 글자·허용 문자·`..`·끝 `.`). DB check와 같은 규칙(`^[a-z][a-z0-9_.]{2,19}$`). 금칙어·예약어는 서버가 판정합니다.
- `validateNickname`(1~20자, 앞뒤 공백 제거), `validateBio`(80자, 두 줄, `\r\n`은 `\n`으로).
- `handleChangeAvailableAt(handleChangedAt, now)`: 30일 쿨다운 끝나는 시각(SOC-02). 편집 화면 안내에 씁니다.
- `inviteUrl(token)` = `https://nodii.app/u/<token>` · `parseInviteUrl(url)` → `token | null`(S0 토큰 파싱 코드를 옮기고 테스트를 그대로 가져옵니다).
- `stripJpegMetadata(bytes: Uint8Array): Uint8Array` — **S0 결과의 S2 항목.** JPEG 마커를 따라가며 `APP1`(Exif·XMP), `APP13`(IPTC), `COM`을 지우고 `APP0`(JFIF)·`APP2`(ICC 프로필)·이미지 데이터는 그대로 둡니다. 다시 인코딩한 픽셀은 이미 똑바로 서 있으므로 방향 태그를 지워도 됩니다. JPEG이 아니면 오류. 테스트에는 S0 테스트 사진에서 만든 작은 JPEG 조각을 씁니다.
- `cropRect(imageSize, viewport, zoom, offset)`: 자르기 화면의 원형 틀(정사각형)에 해당하는 원본 좌표. 두 앱이 같은 계산을 씁니다.

## 4. 화면

시안 이름은 디자인 캔버스 아트보드입니다. 값은 `tokens.md`의 토큰만 씁니다. 프로필 만들기·편집 시안은 캔버스 데스크톱·모바일 탭에, S2 단계에서 실제로 보이는 모습(사람+ 숨김, 숫자만, 초대 카드, 머리만 있는 다른 사람 프로필 등)은 **"S2 참고 시안"** 탭에 있습니다. `ProfileTabB`·`MacProfileM1`처럼 팔로잉 목록·친구 찾기가 있는 시안은 S3 이후 모습입니다.

**참고 이미지(와이어프레임)**: v3 시안 PNG가 `mobile-designs/v3/`(iOS)와 `desktop-designs/v3/`(macOS)에 있습니다(로컬 전용, git 제외). 각 화면을 만들기 전에 두 폴더를 나열하고, 아래 절의 화면에 해당하는 파일(프로필 만들기·ID 안내·프로필 탭·프로필 편집·ID/소개 고치기·사진 자르기·설정·다른 사람 프로필 등)을 **이미지로 열어** 배치·여백을 확인합니다. 파일 이름은 한국어 화면 이름이라 아트보드 이름과 다를 수 있으니 이름이 아니라 그림으로 맞춰 봅니다. 기준 순서·차이 보고 방법은 `AGENTS.md` "디자인"을 따릅니다. 이번 단계에 없는 화면(팔로우 목록·알림 탭 내용·아바타 줄 등)의 그림은 참고만 하고 만들지 않습니다. 보고에 연 파일 이름을 적습니다.

**문구 규칙**: 사용자에게 보이는 글에서는 "핸들" 대신 **"ID"**라고 씁니다("ID", "@ID", "예전 ID"). 코드·DB·API·i18n 키의 이름은 그대로 `handle`입니다.

### 4.1 소셜 시작 — ID 정하기 (SOC-03, 시안 iOS `ProfileSetupH1` · macOS `MacProfileSetupH1`, 안내 `ProfileHandleStates` · macOS `MacS2HandleStates`)

- 프로필 탭을 처음 열었을 때 내 `social_profiles` 행이 없으면 프로필 탭 자리에 이 화면이 나옵니다. 다른 탭은 그대로 씁니다.
- 위에서부터: 제목 "프로필 만들기" · 설명 "친구가 나를 찾을 때 쓰는 이름이에요." → (시안대로 넉넉한 간격) → **미리보기 줄**(64 기본 `Avatar` · 입력 중인 닉네임 · `@ID`, 비어 있으면 자리 문구를 `muted`로) → 닉네임 칸(1~20자, 기본값 없음) → ID 칸(`@` 접두 표시, 입력은 소문자로 바꿔 넣음) → 칸 아래 한 줄 안내 → 화면 아래 [시작하기](주요).
- ID 안내는 입력을 멈추고 300ms 뒤 `checkHandle`. 여섯 상태는 `ProfileHandleStates`: 확인 중 / 사용할 수 있어요 / 이미 쓰고 있어요 / 지금은 쓸 수 없는 이름이에요(`held`·`reserved`·`banned`를 구분하지 않음) / 형식 안내(`invalid`, core 이유별 문구 — 예: 영문 소문자로 시작하고 3~20자) / 오프라인 "연결되면 확인할게요".
- [시작하기]는 둘 다 유효하고 ID가 `ok`일 때만 켜집니다. 저장 중 비활성. 서버가 거부하면 같은 안내 문구로 되돌립니다.
- **macOS** `MacProfileSetupH1`: 프로필 탭 자리 가운데에 폭 380 칸 하나(왼쪽 프로필 칸·사람+·톱니 없음). 구성과 순서는 iOS와 같고 [시작하기]는 칸 폭 전체. Return으로 [시작하기]가 눌리게 폼으로 만듭니다(화면에 키 안내 문구는 넣지 않음).
- 사진은 여기서 받지 않습니다(편집에서). 초대 링크로 앱을 연 사람도 이 화면을 먼저 거칩니다(§4.6).

### 4.2 프로필 탭 (SOC-08, D27·D28, S2 모습 iOS `S2ProfileTab` · macOS `MacS2ProfileTab`)

- **iOS** `ProfileTabB`, 팔로잉 0명 `ProfileTabEmpty`(S2에서 보일 모습은 `S2ProfileTab`): 맨 위 줄 오른쪽 사람+(S3에서 연결 — S2에서는 **숨김**) · 톱니(설정). `ProfileHeader`(84 `Avatar` · 닉네임 · `@ID` · 소개, 소개가 비면 줄을 뺌). 숫자 두 칸(팔로잉 0 · 팔로워 0 — S2에서는 숫자만, 누르면 아무 일 없음, S3에서 목록 연결). [프로필 편집] [프로필 공유]. 그 아래 초대 카드(`ProfileTabEmpty` 문구). 버튼 모서리는 알약(999), 초대 카드 바탕은 `chip`(`components.md`).
- 스크롤하면 머리가 한 줄로 접힙니다(`tokens.md` §9 "프로필 머리 접힘"). S2에서 본문이 짧아 접힐 일이 거의 없지만 컴포넌트는 이 동작까지 만들어 둡니다(S3·S4의 사람 하루 페이지가 같이 씀).
- **macOS** `MacProfileM1`: 왼쪽 380 칸(톱니 · `ProfileHeader` · 숫자 두 칸 · 두 버튼). 오른쪽 칸 기본 화면은 S2에서 **초대 카드**(팔로잉 0명 상태와 같음). 톱니·`⌘,`를 누르면 오른쪽 칸에 설정이 "‹ 프로필"과 함께 열립니다(`MacProfileM1Settings`). 사람+는 숨김.
- 사진은 `Avatar`로: `avatar_path`가 있으면 `avatarUrl(path, 480)`(머리)·`160`(작은 자리), 없거나 불러오지 못하면 기본 싹이(`tokens.md` §9, D23). `auto_hidden_at`이 있으면 남에게는 기본 이미지·빈 소개로 보이고, 본인에게는 그대로 보이되 편집 화면 위에 "신고가 쌓여 사진과 소개가 다른 사람에게 숨겨졌어요" 안내(문구 제안).

### 4.3 프로필 편집 (SOC-01·02·07, 시안 iOS `ProfileEditE1`·`ProfileEditE1Handle` · macOS `MacProfileEditE1`·`MacProfileEditE1Handle`·`MacProfileEditE1Bio`)

- 하위 화면(머리 "‹ 프로필" · "프로필 편집"). 맨 위 가운데 84 `Avatar` + "사진 바꾸기"(누르면 파일/사진 고르기 → 4.4). 그 아래 인셋 그룹 한 개에 항목 줄: **닉네임 · ID · 소개** — 줄마다 왼쪽 이름, 오른쪽 현재 값(`muted`, 한 줄 말줄임) + `›`.
- 줄을 누르면 **칸 하나짜리 편집 화면**이 열립니다(머리 "‹" · 항목 이름 · [완료]). [완료]는 값이 유효하고 바뀌었을 때만 켜지고, 누르면 바로 `updateSocialProfile`로 저장한 뒤 돌아옵니다. 화면 전체를 한 번에 저장하는 [저장] 버튼은 없습니다.
  - 닉네임: 1~20자, 남은 글자 수.
  - 소개: 여러 줄, 80자 · 두 줄, 남은 글자 수.
  - ID(`ProfileEditE1Handle`): 4.1과 같은 실시간 안내 + 칸 아래 "바꾸면 30일 동안 다시 바꿀 수 없어요. 예전 ID는 30일 동안 다른 사람이 쓸 수 없어요"(SOC-02).
- ID 쿨다운: `handleChangeAvailableAt`이 미래면 항목 줄의 값 옆에 자물쇠, 오른쪽에 "N일 뒤"를 보이고, 눌러 열면 칸이 비활성인 채 "N일 뒤에 바꿀 수 있어요".
- 저장 실패 문구는 `socialErrorCode`로: 금칙어 "쓸 수 없는 말이 들어 있어요", 예약어·보류 "지금은 쓸 수 없는 이름이에요", 쿨다운 "N일 뒤에 바꿀 수 있어요".
- **macOS** `MacProfileEditE1`: M1 오른쪽 칸의 하위 화면("‹ 팔로잉"), 왼쪽 칸의 [프로필 편집] 버튼은 눌린 상태(먹색 바탕). 사진 84 + [사진 바꾸기…](파일 고르기 → 4.4) + "JPEG·HEIC·PNG, 10MB 이하" 한 줄 → 항목 줄. 본문은 위에 붙이지 않고 시안처럼 넉넉히 내려 오른쪽 칸 가운데쯤에 둡니다(제목 위 여백 약 96, 토큰의 가까운 간격 값으로).
- **macOS** 칸 하나 편집 `MacProfileEditE1Handle`·`MacProfileEditE1Bio`: 오른쪽 칸이 "‹ 프로필 편집" + 항목 이름 제목 + 칸으로 바뀌고, [취소] [완료]는 머리가 아니라 **칸 아래 오른쪽**에 둡니다. 키보드: Return = 완료(소개는 ⌘Return, Return은 줄바꿈), Esc = 취소. 키 안내 문구는 화면에 넣지 않습니다.

### 4.4 사진 자르기 (SOC-04, D26, 시안 iOS `SocialCropFinal` · macOS `MacS2Crop`)

- **고르기**: iOS는 `expo-image-picker`(사진 보관함, 편집 끄고 원본), macOS는 `<input type="file" accept="image/jpeg,image/heic,image/heif,image/png">`. 고른 원본은 S0 규칙으로 먼저 거릅니다 — 10MB 초과·움직이는 이미지(GIF 등)·서명이 맞지 않는 파일은 **자르기 전에** "사진을 열 수 없어요. 10MB 이하의 사진을 골라 주세요" 토스트.
- **자르기 화면**: 위 [취소] · "사진 자르기" · [완료] → 358 자르기 판(310 원형 틀, 끌기·핀치/트랙패드 확대) → 확대 막대(1~4배) → 화면 아래쪽 "미리보기" 80·52·36 → "기본 이미지로 되돌리기"(사진이 있을 때만). iOS는 전체 화면 모달, macOS는 폭 520 모달(`MacS2Crop`, [기본 이미지로 되돌리기]는 왼쪽 아래, [취소][완료]는 오른쪽 아래). 원이 원본 밖으로 나가지 않게 끌기·확대를 제한합니다.
- **만들기**: `cropRect`로 자른 정사각형을 160·480px JPEG(품질 0.8)로 인코딩합니다. iOS는 `expo-image-manipulator`(+ `expo-file-system`으로 바이트 읽기), macOS는 `<canvas>.toBlob('image/jpeg', 0.8)`. HEIC는 S0에서 두 앱 모두 열렸습니다. 그다음 **`stripJpegMetadata`**를 두 파일에 적용하고 `uploadAvatar`.
- 올리는 동안 [완료] 자리에 진행 표시, 실패하면 "사진을 올리지 못했어요 · 다시 시도"(이전 사진 유지).

### 4.5 설정 옮기기와 새 항목 (D22·D27, SOC-02·06·28)

- iOS `MobileSettings`(= `ProfileSettings`): 프로필 탭 톱니로 들어가는 하위 화면, 머리 "‹ 프로필". macOS: 프로필 탭 오른쪽 칸 두 단(`MacProfileM1Settings`, `screens.md` "설정").
- 지금 설정 항목은 그대로 두고 S2에서 더하는 것:
  - 계정: **ID `›`**(4.3 편집 화면으로).
  - 개인정보: **새 목표의 기본 공개 범위 `›`**(`ProfileDefaultVis`, 세 줄 라디오, 아이콘은 S4의 `GoalMark` 전까지 범위 아이콘 SVG를 이 화면 안에 둠 — S4에서 교체) · **ID로 검색 허용**(스위치, `searchable`, "끄면 링크로만 나를 찾을 수 있어요").
  - 정보: 계정 삭제 설명을 "목표, 할 일, 루틴, 팔로우 기록을 모두 지워요"로.
- 알림 묶음(S5)·차단한 사람(S3)은 아직 넣지 않습니다.
- 소셜 꺼짐이면 설정은 지금처럼 오늘 화면에서 열리고 새 항목은 보이지 않습니다.

### 4.6 초대 링크 (SOC-05, S0 항목 1)

- [프로필 공유]: iOS는 시스템 공유 시트(`Share.share`, 내용 "Nodii에서 같이 해요 {inviteUrl}" — 문구 제안), macOS는 클립보드 복사 + 토스트 "링크를 복사했어요".
- **링크 받기**: S0 `spike/s0-universal-links`의 방식을 그대로 가져옵니다 — iOS `expo-linking`(시작 URL + 실행 중 이벤트), macOS `tauri-plugin-deep-link` 2.4.7(시작 URL + 실행 중 이벤트, capability `deep-link:allow-get-current`). `parseInviteUrl`로 토큰을 꺼냅니다.
- 받은 토큰은 로그인·소셜 시작(4.1)이 끝날 때까지 기억했다가 처리합니다(앱 메모리, 앱 재시작 시 버림). 처리: `resolveInvite` → 사용자 ID면 그 사람 프로필(4.7)을 열고, 본인이면 프로필 탭, `null`이면 토스트 "링크를 열 수 없어요".
- 소셜 꺼짐이면 링크를 무시합니다(토스트 없이).

### 4.7 다른 사람 프로필 (SOC-38의 머리 부분만, 시안 `S2OtherProfile`·`S2OtherProfileGone` · macOS `MacS2OtherProfile`·`MacS2OtherProfileGone`)

- 하위 화면(iOS: 탭바 숨김, 머리 "‹ {들어온 화면}"; macOS: 창 전체, `MacNotifyPerson`의 위쪽 한 줄 머리만). `ProfileHeader`(84/64 `Avatar` · 닉네임 · `@ID` · 소개).
- S2에서는 팔로우 버튼·`⋯`·하루 내용이 없습니다. 머리 아래에 "곧 이 사람의 하루를 볼 수 있어요"를 두지 말고 **비워 둡니다**(S3·S4에서 채움).
- 프로필을 불러올 수 없으면(차단·정지·삭제) "프로필을 볼 수 없어요".

### 4.8 계정 삭제 전 사진 정리 (SOC-70, S1 §8)

- 두 앱의 계정 삭제 흐름에서 `delete_my_account` 호출 **전에** `clearMyAvatarFolder()`. 사진 정리가 실패해도 계정 삭제는 진행합니다(파일 이름이 UUID라 주소를 추측할 수 없음). 대신 실패를 그냥 넘기지 말고 `console.warn` 한 줄을 남깁니다.

## 5. 플랫폼 설정과 의존성 (이번 단계에서 허락함)

- **macOS**
  - `tauri-plugin-deep-link` 2.4.7(JS·Rust)과 capability. Info.plist/Entitlements에 Associated Domains `applinks:nodii.app`(S0과 같게). `Entitlements.template.plist`에 `com.apple.developer.associated-domains`와 `com.apple.security.files.user-selected.read-only`를 추가합니다(S0에서 확인).
  - CSP `img-src`에 `https://*.supabase.co`를 추가합니다(공개 아바타 URL). `connect-src`는 이미 있습니다.
- **iOS**
  - `app.json`: `ios.associatedDomains: ["applinks:nodii.app"]`, `expo-image-picker`(사진 보관함 권한 문구 한국어·영어 — `NSPhotoLibraryUsageDescription` "프로필 사진을 고르려면 사진 보관함에 접근해야 해요"), `expo-image-manipulator`, `expo-file-system`. 버전은 S0 브랜치와 같게.
- 이 단계에서 `expo-notifications`·`tauri-plugin-notification`은 넣지 않습니다(S6).
- 사이트(`site/.well-known`, `/u/`)는 S0에서 이미 배포됐으니 건드리지 않습니다.

## 6. 문구 (i18n)

새 문구는 모두 `@nodii/i18n`의 한국어·영어 카탈로그에 넣습니다. 키는 `social.*`(프로필·ID(`handle`)·초대), `tabs.*`(탭 접근성 레이블), `settings.privacy.*`, `settings.account.handle`처럼 묶습니다. 이 지시서의 한국어 문구가 기본이고, 영어는 같은 뜻의 짧은 문장으로 씁니다. 숫자·이름은 변수로(`{days}`, `{handle}`).

## 7. 테스트

- core: §3의 함수 전부(테스트 먼저).
- api: §2의 함수 전부 MSW(정상·오류), `createGoal`이 `default_visibility`를 넣는지.
- 데스크톱(Vitest + Testing Library)·모바일(Jest + RNTL):
  - 소셜 꺼짐: 탭바 없음, 설정이 오늘 화면에서 열림(기존 테스트 유지).
  - 소셜 켜짐: 탭 전환, 프로필 행이 없으면 4.1, ID 안내 상태 6가지, [시작하기] 활성 조건, 편집의 쿨다운 비활성, 설정 새 항목, 초대 링크로 들어온 토큰이 로그인 뒤 4.7을 여는 흐름, 본인 링크·잘못된 링크.
  - 사진: 거부 규칙(크기·GIF), 업로드 실패 시 이전 사진 유지.
- DB 변경이 없으므로 pgTAP은 그대로 통과해야 합니다(seed 변경 뒤 `pnpm db:reset && pnpm db:test`).

## 8. 완료 기준

- [ ] `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`, `pnpm db:reset && pnpm db:test` 통과.
- [ ] 로컬 Supabase에서 두 계정이 각자 ID를 정하고, 한쪽의 초대 링크를 다른 쪽 앱에서 열어 프로필이 보인다 — **iOS 시뮬레이터와 macOS 개발 빌드** 각각(로컬에서 유니버설 링크 대신 `xcrun simctl openurl`·`open "nodii-dev://…"` 같은 대체 경로를 쓸 수 있으면 그 방법을 보고에 적음).
- [ ] 사진을 바꾸면 이전 파일이 지워지고, 올린 두 파일에 EXIF(APP1)가 없다(`exiftool`로 확인하는 스크립트나 테스트).
- [ ] 소셜 꺼짐에서 v2와 같은 화면.
- [ ] `docs/v3/README.md` 진행 기록 한 줄.

실기기(서명 빌드·TestFlight) 확인은 S2를 머지한 뒤 사람이 S3와 묶어서 합니다. 이 단계에서 빌드를 올리지 않습니다.

## 9. 하지 말 것

- 팔로우·검색·목록·차단·신고 UI, 아바타 줄, 공개 범위 세그먼트, 알림 탭 내용.
- DB 마이그레이션 추가(필요해 보이면 멈추고 보고).
- 원격 Supabase 변경, `social_enabled` 원격 값 변경.
- 운영 빌드·TestFlight 업로드.

## 10. 이 지시서에서 정한 것 (보고 때 다시 확인)

1. 탭바 뼈대를 S4에서 S2로 당김(§0).
2. 알림 탭은 S5 전까지 빈 상태 화면.
3. 소셜 시작은 `ProfileSetupH1`/`MacProfileSetupH1`, 프로필 편집은 `ProfileEditE1`/`MacProfileEditE1`(항목 줄 → 칸 하나 편집, [완료]가 바로 저장, macOS는 [취소][완료]를 칸 아래에). 화면 문구는 "ID", 코드 이름은 `handle`(D31).
4. macOS 프로필 탭 오른쪽 칸의 S2 기본 화면은 초대 카드.
5. 다른 사람 프로필 화면은 S2에서 머리만.
6. 사진 메타데이터는 `APP1`·`APP13`·`COM`을 지우고 `APP0`·`APP2`(ICC)는 남김 — 색이 틀어지지 않게.
7. ID 안내에서 `held`·`reserved`·`banned`를 한 문구로 합침(어떤 이유인지 드러내지 않음).
