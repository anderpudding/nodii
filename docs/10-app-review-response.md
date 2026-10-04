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
