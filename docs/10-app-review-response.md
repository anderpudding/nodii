# App Review 대응 — Guideline 2.1 Information Needed

> 상태: 2026-09-26 정보 요청 수신 → 답장과 화면 녹화 제출 완료, **승인 대기 중** (2026-10-04 기준)
> 다음 제출에서도 재사용합니다. UI 문구를 바꾸면 아래 [한국어 라벨]을 함께 고칩니다.

첫 제출이 "심사 이력이 적은 개발자 계정"이라는 이유로 추가 정보 요청(2.1)을 받음. 버그로 인한 거절이 아니라 정보 요청이므로, 아래 답변 + 화면 녹화를 App Store Connect 답장과 **App Review Information > Notes** 두 곳에 모두 넣는다.

## 화면 녹화 순서 (실제 Mac, 최신 macOS, 제출한 빌드)

1. `⌘⇧5` → 전체 화면 녹화 시작 → Dock/Launchpad에서 Nodii **실행**부터 녹화
2. **가입/로그인**: 본인 이메일 입력 → [코드 받기] → 메일의 6자리 코드 입력 → [로그인]
3. 목표 이름 태그(＋) 눌러 할 일 추가 → 체크 → ⋯/우클릭 메뉴로 [수정]·[내일로]·[날짜 선택]·[삭제](실행 취소)
4. 월간 캘린더에서 날짜 이동, 오늘로 돌아오기
5. [목표 관리](새 목표·색상·보관), [루틴 관리] → [새 루틴](매주 월·수·금) → 해당 날짜에 표시·완료
6. [설정](⌘,) → [로그아웃] → 다시 로그인
7. [설정] → [계정 삭제] → 이메일 재입력 → [되돌릴 수 없다는 걸 이해했어요] 체크 → [계정 삭제]
8. (선택) `appreview@nodii.app` + 비밀번호로 로그인되는 것까지 보여주기

- 계정 삭제는 **본인 이메일로 만든 계정**으로 시연 → 심사용 계정은 보존
- 2~4분, .mov/.mp4. 답장에 타임스탬프 목록(0:00 Launch app …)을 붙이면 좋음. 음성 설명은 선택
- 유료 기능·사용자 간 공유 콘텐츠 없음 → 신고/차단 흐름 불필요

## 답장 본문 (영어 + 한국어 UI 표기, 약 3,700자 · Notes 4,000자 제한 이내)

라벨은 `apps/desktop/src` 실제 문구 기준 (2026-09-26).

```
Hello App Review team,

Thank you for reviewing Nodii. The requested information is below, and a screen recording made on a Mac running the latest macOS is attached. The interface is in Korean; on-screen labels are given in [brackets].

1. Screen recording
The recording starts with launching the app and shows: account registration and sign-in with a 6-digit email code, adding/completing/editing/rescheduling to-dos, the monthly calendar, goals, routines (recurring to-dos), settings, sign-out, and in-app account deletion. Nodii has no content shared between users and no paid content or features.

2. Purpose and target audience
Nodii is a simple, date-based to-do app for Mac. Users organize each day's to-dos under color-coded goals, check their progress on a monthly calendar, and create routines (e.g. "exercise every Mon/Wed/Fri") that appear automatically on matching days. Data is saved to the user's account, so the same list is available on any Mac they sign in to and changes sync in real time.
It is intended for students and professionals who plan their work day by day at their Mac. It solves the problem of keeping a lightweight daily plan in sync across devices without a paid subscription; Nodii is free.

3. Accessing the app
Nodii signs users in with a 6-digit code sent by email; there are no passwords. Because reviewers cannot receive these emails, the review account alone signs in with a password:
- Email: appreview@nodii.app
- Password: provided in the Sign-In Information section
Steps: launch Nodii > type the email above in the Email [이메일] field > a Password [비밀번호] field appears > enter the password > click Sign In [로그인]. The account contains sample data. No sample files are needed.
Main features:
- Calendar (left sidebar): select a date to see that day's list.
- Add a to-do: click a goal's name tag with "＋" above its list (default goal: To-do [할 일]), type, press Enter.
- Complete: click the checkbox.
- To-do menu: right-click a to-do or click its "⋯" button > Edit [수정], To Tomorrow [내일로], To Today [오늘로], Pick Date [날짜 선택], Delete [삭제].
- Day menu: "⋯" in the date header > Import N past unfinished to-dos [지난 미완료 할 일 N개 가져오기], Move unfinished to another day [미완료 할 일 다른 날로 옮기기], Delete all unfinished [미완료 할 일 전체 삭제].
- Goals: Manage Goals [목표 관리] in the sidebar > New Goal [새 목표] > Add [추가]; set color or Archive [보관].
- Routines: Manage Routines [루틴 관리] in the sidebar > New Routine [새 루틴]; choose Daily [매일], Weekly [매주] or Monthly [매월] > Save [저장].
- Settings [설정] at the top right (or Command-,): week start, theme, Sign Out [로그아웃], legal and support links.
- Account deletion: Settings [설정] > Delete Account [계정 삭제] > re-enter the account email > check "I understand this cannot be undone" [되돌릴 수 없다는 걸 이해했어요] > Delete Account [계정 삭제]. This permanently deletes the account and all its data.
(In a narrow window, Manage Goals and Manage Routines move into the Settings [설정] menu.)

4. External services
- Supabase (supabase.com): authentication (email one-time codes; password sign-in for the review account only), the cloud database that stores each user's goals, to-dos and routines, and real-time sync between devices.
- Resend (resend.com): sends the sign-in code emails from no-reply@mail.nodii.app.
- GitHub Pages: hosts the privacy policy, terms of use and support pages at nodii.app.
Nodii does not use AI services, payment processors, advertising, analytics or tracking SDKs.

5. Regional differences
Nodii functions the same in all regions. There are no region-specific features or content.

6. Regulated industry / third-party material
Not applicable. Nodii is a personal productivity app and does not include protected third-party material.

Thank you,
Sungjun Lee
```

## 제출 전 체크

- [x] 녹화에 쓴 빌드 = 심사 제출 빌드 (TestFlight 설치본)
- [x] 심사 계정 로그인 확인, 샘플 데이터 있음, Sign-In Information 칸에 이메일·비밀번호 입력
- [x] 위 본문을 App Review Information > Notes에도 붙여넣기
- [x] App Store 설명/스크린샷이 실제 앱(한국어 UI)과 일치
- [ ] UI 문구를 바꾸면 본문의 [한국어 라벨]도 함께 수정 (다음 제출 때 확인)

## 거절되면

- 거절 사유의 Guideline 번호를 먼저 확인하고, 사유별로 이 문서에 섹션을 추가한다.
- 기능 문제라면 수정 → 새 빌드 업로드(`scripts/bump-version.sh` → 태그 푸시 → `Release`) → 재제출. 정보 요청이라면 답장만 보낸다.
- 심사 계정 로그인은 제출마다 다시 확인한다 (`docs/05-release-runbook.md` 3장).

## iOS판 — M6 제출 준비 초안 (2026-10-12, 아직 발송하지 않음)

Mac의 실제 2.1 답장/체크 기록은 위에 보존합니다. iOS는 같은 앱 레코드/번들 ID의 별도 플랫폼 버전이므로 아래 문구와 iPhone 녹화를 사용합니다. 실제 App Store Connect 심사 상태는 이번 작업에서 조회하지 않았습니다. 전송 전 최신 빌드의 한국어 라벨과 계정 삭제 동작을 확인합니다.

### iPhone 화면 녹화 순서

1. **제출할 production TestFlight 빌드**를 실제 iPhone에 설치하고 화면 기록을 시작합니다. 앱 실행/스플래시부터 보여 줍니다.
2. 별도 시연 계정 이메일 → [코드 받기] → 6자리 코드 → [로그인]. 코드 입력/메일 알림에 실제 개인정보가 노출되지 않게 촬영합니다.
3. 첫 안내의 밀기/길게 누르기 설명 → [건너뛰기] → 하단 [할 일 추가] → 제목 입력/저장 → 완료/취소.
4. 오른쪽 밀기 완료, 왼쪽 옮기기/삭제와 [실행 취소]. **길게 누르기 또는 줄 메뉴 버튼**에서도 [완료]·[이름 수정]·[날짜 옮기기]·[삭제]가 있음을 보여 줍니다.
5. 월 제목으로 월간 펼침/날짜 선택 → [오늘], [설정] → [목표 관리]·[루틴 관리] → [루틴 만들기]·[저장].
6. [설정]에서 법적 링크·버전·로그아웃/재로그인을 보여 줍니다. 선택적으로 같은 계정의 Mac에 동기화된 결과를 함께 첨부합니다.
7. 별도 시연 계정의 [설정] → [계정 삭제] → 목표·할 일·루틴 개수 → [모든 기록이 사라지는 것을 이해했어요] → [계정 삭제] → 로그인 화면. **iOS 확인에는 이메일 재입력이 없습니다**(M5 지시). 심사 계정은 삭제하지 않습니다.
8. (선택) `appreview@nodii.app`을 입력하면 비밀번호 필드가 나오는 경로를 보여 주되, 비밀번호 자체는 영상에 노출하지 않습니다.

2~4분 .mov/.mp4, 빌드 번호/기종/iOS 버전과 실제 타임스탬프 목록을 답장에 덧붙입니다. Mac 단축키/우클릭 녹화를 iOS 녹화로 대신 제출하지 않습니다.

### iOS 답장 본문 (영어 + 실제 한국어 라벨)

아래 블록은 비밀번호가 없는 **초안**입니다. 녹화를 실제 첨부한 뒤에만 "attached"라고 보냅니다. App Review Notes는 현재 Apple 안내의 **4,000 bytes** 제한을 따릅니다([플랫폼 버전 정보](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)); 이전 Mac 절의 글자 수 설명과 구분합니다.

```text
Hello App Review team,

Thank you for reviewing Nodii for iOS. A recording of the submitted TestFlight build on an iPhone is attached. The interface is in Korean; labels are in brackets.

1. Recording
The recording starts with app launch and shows email-code registration/sign-in, the optional gesture guide, adding/completing/editing/moving/deleting to-dos, undo, the monthly calendar, goals, routines, settings, sign-out and in-app account deletion. Nodii has no paid features or content shared between users.

2. Purpose and audience
Nodii is a free, date-based to-do app for iPhone and Mac. Users group tasks under goals, see daily progress on a calendar, and create daily/weekly/monthly routines. Signing in to the same account synchronizes records between devices. It is for people who plan their day on their phone and computer.

3. Review access
Regular users sign in with a 6-digit email code. For review, enter appreview@nodii.app in Email [이메일]. A Password [비밀번호] field appears for this account only. Enter the password supplied in Sign-In Information, then tap Sign In [로그인]. Sample data is included; no sample files are needed.
The first guide is optional [건너뛰기].
- Add: bottom bar [할 일 추가], enter a title and save.
- Complete: checkbox or swipe right. Swipe left for Move [옮기기] and Delete [삭제]. Long press or the row menu button provides the same actions, including Edit [이름 수정] and Pick date [날짜 옮기기].
- Calendar: tap the month title to expand, choose a date, or tap Today [오늘].
- Goals/routines: Settings [설정] > [목표 관리] or [루틴 관리] > [루틴 만들기]; choose [매일], [매주] or [매월], then [저장].
- Account deletion: Settings [설정] > Delete account [계정 삭제]. The confirmation lists the goals, to-dos and routines to remove. Check [모든 기록이 사라지는 것을 이해했어요], then tap [계정 삭제]. This permanently deletes the account and its data across devices. No website or email request is needed. Please preserve the review account for future reviews.
Offline, only previously loaded records can be viewed; changes require internet access.

4. Services
Supabase provides authentication, account data storage and real-time sync. Resend sends sign-in emails from no-reply@mail.nodii.app. GitHub Pages hosts the privacy, terms and support pages at nodii.app. No AI, payment, advertising, analytics or tracking services are used.

5. Regions / regulated industry
There are no region-specific features. Nodii is a personal productivity app, not a regulated-industry service, and has no shared user content requiring reporting/blocking.

Thank you,
Sungjun Lee
```

### iOS 제출 전 확인

- [ ] 본문 UTF-8 4,000 bytes 이하(실제 편집한 원고를 다시 측정)
- [ ] 첨부 녹화 빌드 = 제출한 iOS TestFlight 빌드, Mac 답장과 플랫폼 구분
- [ ] 같은 심사 계정 실제 로그인/샘플 데이터 확인, 비밀번호는 Sign-In Information에만 입력
- [ ] 새 계정 가입·건너뛴 안내·메뉴 대체 동작·앱 내부 삭제 시연 확인
- [ ] `docs/13-ios-release-runbook.md`의 URL/개인정보/기기 간 동기화/오프라인/개발에 쓰지 않은 기기 확인
- [ ] 실제 2.1 정보 요청일 때만 해당 질문을 빠짐없이 맞춰 답장. 기능 버그라면 새 EAS 빌드로 수정

### iOS가 거절되면

기존 "거절되면" 원칙을 유지하되 **iOS는 `bump-version.sh … --platform ios` → EAS production Build → 확인한 빌드 ID로 Submit** 경로를 씁니다. iOS 수정 때문에 macOS용 `v*` 태그/`Release`를 실행하지 않습니다. 단순 추가 정보 요청이면 답장/녹화만 보낼 수 있고, 제출마다 심사 계정·법적 링크·계정 삭제를 다시 확인합니다. 구체 사유와 조치는 이 절에 날짜·플랫폼·빌드 번호와 함께 추가합니다.
