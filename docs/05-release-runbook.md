# 출시 런북 (사람이 하는 일)

> 8단계 코드 작업(`release.yml`, `pages.yml`, `site/`, `scripts/bump-version.sh`) 이후 **사람이 직접** 해야 하는 일을 순서대로 적은 체크리스트입니다.
> 근거: 설계서 §6.5(심사 계정), §6.7(최소 버전), §9(보안), §11(환경과 배포) · 요구사항 NFR-04·05·13~15, 완료 기준 4·5.
> 실제 인증서·키·비밀번호는 **GitHub Secrets와 App Store Connect 심사 노트에만** 둡니다. 이 문서나 저장소에 적지 마세요.

---

## 1. GitHub Secrets · Variables

저장소 **Settings → Secrets and variables → Actions**의 **Repository secrets / Repository variables**에 등록합니다(`release.yml`은 environment를 쓰지 않으므로 environment secret은 읽지 못함). `gh` CLI를 쓰면 클립보드를 거치지 않아도 됩니다(`gh secret set 이름 < 파일`).

> 아래 `gh` 명령은 **저장소 루트(`nodii` 폴더)에서** 실행합니다. `gh`는 현재 폴더의 git 저장소로 대상을 정하고, 파일 경로도 루트 기준입니다. 다른 폴더에서 실행하려면 `-R anderpudding/nodii`를 붙이세요.

### 1.1 Secrets (비밀 값)

| 이름 | 값 | 만드는 방법 |
|---|---|---|
| `APPLE_TEAM_ID` | 10자리 Team ID | developer.apple.com → Membership details |
| `APPLE_DISTRIBUTION_CERT_P12` | Apple Distribution 인증서 `.p12`의 base64 | 아래 1.3 |
| `APPLE_INSTALLER_CERT_P12` | Mac Installer Distribution 인증서 `.p12`의 base64 | 아래 1.3 |
| `APPLE_CERT_PASSWORD` | 두 `.p12`를 내보낼 때 정한 비밀번호 (같은 값으로) | 1.3에서 직접 정함 |
| `MAS_PROVISION_PROFILE` | `Nodii_MAS.provisionprofile`의 base64 | `base64 -i apps/desktop/src-tauri/profiles/Nodii_MAS.provisionprofile \| gh secret set MAS_PROVISION_PROFILE` |
| `APPLE_API_KEY_ID` | App Store Connect API 키 ID (10자리) | 아래 1.4 |
| `APPLE_API_ISSUER` | Issuer ID (UUID) | 아래 1.4 |
| `APPLE_API_KEY_P8` | `AuthKey_<KEY_ID>.p8` 파일 내용 그대로 (base64도 허용) | `gh secret set APPLE_API_KEY_P8 < AuthKey_XXXXXXXXXX.p8` |
| `APPLE_SIGNING_IDENTITY` | (선택) `Apple Distribution: Sungjun Lee (TEAMID)` | 비워 두면 CI가 키체인에서 찾습니다 |
| `APPLE_INSTALLER_IDENTITY` | (선택) `3rd Party Mac Developer Installer: Sungjun Lee (TEAMID)` | 비워 두면 CI가 키체인에서 찾습니다 |

### 1.2 Variables (앱에 들어가는 공개 값)

`VITE_*` 값은 빌드된 앱 안에 그대로 들어가므로 비밀이 아닙니다. **Variables** 탭에 넣습니다. URL과 publishable 키는 Secrets에 넣어도 CI가 읽습니다.

| 이름 | 값 |
|---|---|
| `VITE_SUPABASE_URL` | `https://hwipekipumrnpriytqbe.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase 대시보드 → Project Settings → API Keys의 **publishable**(또는 legacy anon) 키. **secret·service_role 키를 넣으면 CI가 중단합니다** |
| `VITE_REVIEW_ACCOUNT_EMAIL` | `appreview@nodii.app` (3단계에서 만든 심사 계정, 비밀번호는 넣지 않음) |
| `VITE_APP_STORE_ID` | App Store Connect → 앱 정보 → Apple ID (숫자) |
| `VITE_PRIVACY_URL` | 예: `https://nodii.app/privacy.html` (2.6에서 사이트 게시 후) |
| `VITE_TERMS_URL` | 예: `https://nodii.app/terms.html` |
| `VITE_SUPPORT_URL` | 예: `https://nodii.app/support.html` |

### 1.3 인증서를 `.p12`로 내보내기
0단계에서 CSR을 만든 **그 맥**에서 합니다(개인 키가 그 맥에만 있음).
1. 키체인 접근 → **로그인** 키체인 → **내 인증서**
2. `Apple Distribution: …`의 ▸를 펼쳐 **개인 키가 붙어 있는지** 확인 → 인증서를 우클릭 → **내보내기…** → 파일 형식 **개인 정보 교환(.p12)** → `distribution.p12`, 비밀번호 입력
3. `3rd Party Mac Developer Installer: …`도 같은 비밀번호로 `installer.p12`로 내보내기
4. 등록하고 파일 지우기
   ```bash
   base64 -i distribution.p12 | gh secret set APPLE_DISTRIBUTION_CERT_P12
   base64 -i installer.p12 | gh secret set APPLE_INSTALLER_CERT_P12
   gh secret set APPLE_CERT_PASSWORD        # 프롬프트에 비밀번호 입력
   rm distribution.p12 installer.p12
   ```
   `gh`가 없으면 `base64 -i distribution.p12 | pbcopy` 후 웹 화면에 붙여 넣습니다.

### 1.4 App Store Connect API 키
1. App Store Connect → **사용자 및 액세스 → 통합 → App Store Connect API → 팀 키** → (+)
2. 이름 `Nodii CI`, 액세스 **App Manager** (업로드만 하면 Developer도 가능) → 생성
3. **Issuer ID**와 **키 ID**를 적어 두고, `.p8`을 **다운로드(한 번만 가능)**
4. 등록 후 `.p8` 파일은 안전한 곳에 보관하거나 삭제

### 1.5 첫 실행 확인
- [ ] GitHub → Actions → **Release** → **Run workflow**(main) → `check` → `appstore` 순서로 초록색
- [ ] 로그에 비밀 값이 보이지 않음 (가려진 값은 `***`)
- [ ] App Store Connect → TestFlight에 새 빌드(빌드 번호 = UTC 시각 `YYYYMMDDHHMM`)가 처리 중으로 나타남
- [ ] 실패하면 run의 Artifacts에서 `.pkg`(7일 보관)를 받아 Transporter로 올려 볼 수 있음

> 빌드 번호는 로컬 `pnpm build:appstore`와 CI 모두 **UTC 시각**을 씁니다. 0단계 스파이크 빌드(`202609170301`)보다 항상 커서 업로드가 거절되지 않습니다.

---

## 2. 클라우드 Supabase `nodii`

0단계에서 SMTP·템플릿을 설정했더라도 **출시 직전에 한 번 더** 확인합니다. 대시보드: https://supabase.com/dashboard/project/hwipekipumrnpriytqbe

### 2.1 마이그레이션 적용
로컬에서 먼저 통과시킨 뒤 적용합니다 (설계서 §11 "단일 클라우드 프로젝트 주의점").
```bash
pnpm db:reset && pnpm db:test                     # 로컬 통과 확인
supabase link --project-ref hwipekipumrnpriytqbe  # 처음 한 번 (DB 비밀번호 입력)
supabase db push --dry-run                        # 적용될 파일 목록 확인
supabase db push
supabase migration list                           # Local과 Remote 열이 모두 채워졌는지
```
- [ ] 적용된 마이그레이션: `init`, `rules_rpc`, `account`, `goal_delete` (이후 추가분 포함)

### 2.2 Auth 설정
**Authentication → Sign In / Providers → Email**
- [ ] Email OTP Length **6**
- [ ] Email OTP Expiration **600**초 (앱 문구 "코드 유효 시간(10분)"과 일치)
- [ ] 사용자 한 명당 이메일 최소 간격 **60초** (AUTH-07, 로컬 `config.toml`의 `max_frequency = "60s"`와 같게)
- [ ] 새 사용자 가입 허용 (Allow new users to sign up) 켜짐

### 2.3 이메일 템플릿
**Authentication → Emails → Templates**
- [ ] **Magic Link**(기존 사용자) — 제목 `Nodii 로그인 코드`, 본문 `supabase/templates/otp.html`
- [ ] **Confirm signup**(새 사용자) — 제목 `Nodii 가입 코드`, 같은 본문
- [ ] 두 템플릿 모두 **`{{ .Token }}`** 포함 (링크만 있으면 코드가 가지 않음)

### 2.4 커스텀 SMTP (NFR-15)
- [ ] **Authentication → Emails → SMTP Settings**: 발신 `no-reply@mail.nodii.app`, 이름 `Nodii`, Host `smtp.resend.com`, Port `465`, Username `resend`
- [ ] Resend 대시보드에서 `mail.nodii.app`이 **Verified**(SPF·DKIM)
- [ ] Gmail·iCloud·Outlook 주소로 각각 가입 코드를 받아 **1분 안에 받은편지함**(스팸함 아님)에 오는지 확인
- [ ] **Authentication → Rate Limits**: 이메일 발송 한도가 출시 규모에 맞는지 (예: 시간당 30)

### 2.5 `app_config`와 계정 정리
SQL Editor에서:
```sql
select key, value from public.app_config;   -- min_macos_app_version = 출시 버전 이하인지
```
- [ ] `min_macos_app_version`이 **출시할 앱 버전보다 크지 않음** (크면 앱이 "새 버전이 필요해요"로 막힘)
- [ ] 스파이크·베타 테스트 계정을 **Authentication → Users**에서 삭제 (심사 계정 `appreview@nodii.app`은 남김)

### 2.6 웹 페이지 게시 (NFR-14)
1. `site/privacy.html`, `site/terms.html`, `site/support.html`의 **`[[TODO: …]]`를 모두 채움** (필요하면 전문가 검토)
   - `grep -n "TODO" site/*.html`로 남은 자리표시 확인
2. GitHub **Settings → Pages → Source: GitHub Actions**
3. main에 병합하면 `Pages` 워크플로가 `site/`를 게시 → `https://<사용자>.github.io/<저장소>/`에서 확인
4. 사용자 도메인: **Settings → Pages → Custom domain**에 `nodii.app` (참고 값: `site/CNAME.example`)
   - DNS: apex `nodii.app`에 A 레코드 `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (AAAA는 `2606:50c0:8000::153`~`8003::153`) — 설정 전 GitHub Pages 문서에서 최신 값 확인
   - 인증서 발급 후 **Enforce HTTPS** 켜기
   - 권장: 계정 **Settings → Pages → Verified domains**에 `nodii.app` 추가 (도메인 탈취 방지)
   - `mail.nodii.app`의 Resend 레코드(SPF·DKIM)는 건드리지 않음
5. 세 URL을 1.2의 `VITE_PRIVACY_URL`·`VITE_TERMS_URL`·`VITE_SUPPORT_URL`에 넣고 다시 빌드
6. `site/index.html`의 App Store 버튼 `href`를 `https://apps.apple.com/app/id<APP_ID>`로 바꿈

---

## 3. 심사용 데모 계정 (AUTH-08, 설계서 §6.5)

1. 비밀번호 만들기 (저장소·메모에 남기지 말고 비밀번호 관리자에만)
   ```bash
   openssl rand -base64 24
   ```
2. **Authentication → Users → Add user → Create new user**
   - Email `appreview@nodii.app`, 위 비밀번호, **Auto Confirm User** 켜기
3. 로컬 앱(`.env.local`을 클라우드 값으로 잠시 바꾸거나 TestFlight 빌드)에서 이 계정으로 로그인해 예시 데이터 입력
   - 목표 2~3개(예: 할 일, 운동, 공부), 오늘·내일 할 일 몇 개(일부 완료), 매일 루틴 1개와 요일 루틴 1개
4. 로그아웃 후 다시 로그인되는지 확인

### 심사 노트 초안 (App Store Connect → 앱 심사 정보)
- **로그인 필요**: 예 · 사용자 이름 `appreview@nodii.app` · 비밀번호 (위 값)
- **메모**:
  ```
  Nodii signs users in with a 6-digit code sent by email; there are no passwords for regular users.
  Because the review team cannot receive our emails, the review account above is the only account
  that shows a password field: enter the email, then the password field appears.
  The account already contains sample goals, to-dos and routines.
  Account deletion: Settings → Delete account.
  The app only connects to our Supabase backend over HTTPS and requests no other permissions.
  ```
- [ ] 제출할 때마다 이 계정으로 로그인되는지 확인, 심사 후 필요하면 비밀번호 교체

---

## 4. App Store Connect 입력

### 4.1 앱 개인정보 (NFR-14)
**앱 개인정보 → 데이터 수집: 예**

| 데이터 유형 | 용도 | 사용자와 연결 | 추적 |
|---|---|---|---|
| 연락처 정보 → **이메일 주소** | 앱 기능 | 예 | 아니요 |
| 사용자 콘텐츠 → **기타 사용자 콘텐츠** (목표·할 일·루틴) | 앱 기능 | 예 | 아니요 |

- [ ] "추적" 질문에 모두 **아니요**
- [ ] 결정 필요: 프로필의 시간대·주 시작 요일을 별도 유형(기타 데이터)으로 신고할지 — 앱 기능용 설정 값이라 위 두 항목만으로 보는 것이 보수적인 해석인지 확인
- [ ] 개인정보처리방침 URL = `VITE_PRIVACY_URL`과 같은 주소

### 4.2 앱 정보·버전 정보
- [ ] 지원 URL, (선택) 마케팅 URL `https://nodii.app/`
- [ ] 카테고리 **생산성**, 가격 **무료**
- [ ] 연령 등급 설문 (해당 사항 없음 위주)
- [ ] 수출 규정: Info.plist의 `ITSAppUsesNonExemptEncryption = false`로 자동 처리되는지 확인
- [ ] 저작권 `© 2026 Sungjun Lee`

### 4.3 스크린샷 (Mac)
- 크기(16:10) 중 하나: **1280×800, 1440×900, 2560×1600, 2880×1800** · 1~10장 · 제출 전 App Store Connect 안내에서 최신 규격 확인
- [ ] 라이트·다크 각각 메인 화면(하루 목록 + 월간 캘린더), 루틴 편집, 목표 관리, 좁은 창 주간 보기
- [ ] 데모 계정의 예시 데이터로 촬영 (실제 개인 데이터 금지)
- [ ] 스크린샷에 Mac이 아닌 기기 모양이나 다른 회사 상표가 없음

---

## 5. 릴리스 순서

### 5.1 일반 릴리스 (설계서 §11)
1. [ ] (필요하면) **하위 호환** 마이그레이션을 클라우드에 적용 (2.1)
2. [ ] `bash scripts/bump-version.sh X.Y.Z` → 안내된 명령으로 커밋·태그 푸시
3. [ ] CI(`Release`)가 App Store Connect에 업로드 (1.5)
4. [ ] TestFlight로 **개발에 쓰지 않은 다른 맥**에서 설치·확인 (6장)
5. [ ] 1주일 실사용 (MVP 완료 기준 3)
6. [ ] 설계서 §11.4 체크리스트 확인 → 심사 제출
7. [ ] 승인 후 출시 (수동 출시 권장)
8. [ ] 필요하면 `min_macos_app_version` 올리기 (5.2)

### 5.2 호환성이 깨지는 마이그레이션 (설계서 §6.7-4)
오래된 앱이 깨지지 않도록 **이 순서를 지킵니다.**
1. [ ] 새 스키마와 옛 스키마 **양쪽**에서 동작하는 새 앱 버전을 만들고 심사 통과
2. [ ] 스토어 출시
3. [ ] `update public.app_config set value = 'X.Y.Z' where key = 'min_macos_app_version';` (SQL Editor, 새 버전 번호)
4. [ ] 그 뒤에 호환성 깨지는 마이그레이션 적용 (`supabase db push`)

---

## 6. 수동 E2E 체크리스트 (제출마다)

TestFlight 설치본 기준. 결과는 날짜와 함께 `docs/03-implementation-plan.md` §6에 한 줄로 남깁니다.

### 6.1 시나리오 (요구사항 S1~S6)
- [ ] S1 ~ S6을 처음부터 끝까지 수행 (요구사항 문서의 각 시나리오)
- [ ] 창 크기 **400×600**에서 가로 스크롤 없음, 주간 보기로 전환 (NFR-05)
- [ ] 라이트·다크 모드 모두 확인

### 6.2 동기화
- [ ] 앱 두 개(또는 맥 두 대)에 같은 계정으로 로그인 → 추가·체크·이동·삭제·루틴 완료가 다른 쪽에 반영

### 6.3 다른 맥 (MVP 완료 기준 4)
- [ ] **개발에 쓰지 않은 맥**에서 TestFlight로 설치
- [ ] **새 이메일로 가입**: 코드가 1분 안에 받은편지함에 도착, 가입 후 기본 목표 "할 일" 생성
- [ ] 기존 맥과 동기화
- [ ] 앱 종료·재실행 후 로그인 유지 (샌드박스 컨테이너에 세션 저장)
- [ ] Intel 맥이 있으면 Universal 빌드 실행 확인

### 6.4 심사·예외 경로
- [ ] 데모 계정 `appreview@nodii.app` 비밀번호 로그인
- [ ] 최소 버전 안내: `min_macos_app_version`을 잠시 현재보다 높게 → 재실행 시 "새 버전이 필요해요" + App Store 버튼 → **원래 값으로 되돌리기**
- [ ] 오프라인: Wi-Fi 끄고 실행 → 빈 창이나 멈춤 없이 저장된 내용 표시·"오프라인이라 보기만 할 수 있어요" 표시 → 다시 켜면 복구
- [ ] 로그인 실패: 틀린 코드·만료 코드에 안내 문구
- [ ] 설정의 개인정보처리방침·이용약관·지원 링크가 브라우저로 열림 (SET-07)
- [ ] 메인 창을 닫은 뒤 Dock 아이콘을 누르면 창이 다시 열리거나 앱이 종료됨 (창 없는 상태로 남지 않음)
- [ ] 계정 삭제 (AUTH-06): 설정 → 계정 삭제 → 로그인 화면 → 같은 이메일로 다시 가입하면 빈 계정으로 시작
- [ ] 설치 파일 크기 15MB 이하 (App Store Connect 빌드의 파일 크기, NFR-04), 대기 메모리 150MB 이하 (활성 상태 보기)

---

## 7. 심사 거절 시 흔한 사유와 대응

| 가이드라인 | 흔한 사유 | 대응 |
|---|---|---|
| 2.1 앱 완성도 | 데모 계정으로 로그인 불가, 서버 일시정지, 크래시 | 제출 직전 3장 로그인 확인. Supabase 무료 플랜이 일시정지되지 않았는지 대시보드 확인. 답변에 재현 단계 요청 |
| 2.1 정보 요청 | "이메일 코드로 로그인이 안 된다" | 심사 노트의 설명을 다시 붙여 답변, 필요하면 비밀번호 교체 후 알려 줌 |
| 2.3 메타데이터 | 스크린샷이 실제 앱과 다름, 다른 플랫폼 표시 | 현재 빌드로 다시 촬영 |
| 2.4.5 Mac 앱 요건 | 샌드박스 권한 설명, 창을 닫으면 다시 열 수 없음 | 권한은 `network.client`뿐임을 설명. 창 재열기 동작 확인(6.4) |
| 4.0 디자인 | 좁은 창에서 잘림, 기본 메뉴 누락 | 400×600 확인, 편집 메뉴(복사·붙여넣기) 동작 확인 |
| 5.1.1 개인정보 | 처리방침 링크 누락·접속 불가, 계정 삭제 경로 불명확 | URL이 앱 설정과 App Store Connect 모두에서 열리는지, 심사 노트에 계정 삭제 경로 명시 |
| 5.1.1(v) 계정 삭제 | 앱 안에서 삭제 불가로 판단 | 설정 → 계정 삭제 스크린샷을 답변에 첨부 |
| 5.1.2 데이터 사용 | 개인정보 라벨과 실제 수집이 다름 | 4.1 표와 처리방침 1장을 맞춤 |

- 거절 답변은 **해결 센터(Resolution Center)**에서 합니다. 코드 수정이 필요 없으면 답변만으로 재심사를 요청할 수 있습니다.
- 수정이 필요하면 `bump-version.sh`로 버전을 올리거나 같은 버전으로 태그 없이 `workflow_dispatch`를 실행해 새 빌드 번호로 업로드합니다.
