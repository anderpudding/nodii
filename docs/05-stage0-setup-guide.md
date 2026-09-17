# 0단계 직접 셋업 가이드

> 2026-09-17 · **진행: A~D 모두 완료 (2026-09-17)** · 대상: `03-implementation-plan.md` 0단계 중 사람이 직접 해야 하는 일
> 순서대로 하면 됩니다. **A → B**는 이어서, **C**(도메인·메일)는 DNS 반영을 기다리는 동안 병행하세요.
> 명령은 모두 맥의 **터미널**에서 프로젝트 폴더(`~/Downloads/Projects/nodii`) 기준입니다.

| 파트 | 내용 | 예상 시간 |
|---|---|---|
| A | 로컬 개발 환경 → `pnpm dev`로 앱 띄우기 | 30분 ~ 1시간 |
| B | Apple 인증서·프로파일 → `.pkg` 빌드 → TestFlight 설치 확인 | 1 ~ 2시간 + Apple 처리 대기 |
| C | 도메인 구매 → Resend 인증 메일 설정 → Supabase에 연결 | 30분 + DNS 대기 |
| D | GitHub CI 확인 | 5분 |

---

## A. 로컬 개발 환경

### A1. Xcode Command Line Tools
데스크톱 앱만 만들 때는 Xcode 전체 대신 이것만 있으면 됩니다 (Tauri 공식 안내).
```bash
xcode-select --install
```
팝업이 뜨면 **설치**. 이미 있으면 "already installed"가 나옵니다.

### A2. Homebrew (맥 패키지 관리자)
`brew -v`가 동작하면 건너뛰세요. 없으면 https://brew.sh 의 설치 명령을 실행합니다.
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
설치 끝에 나오는 **"Next steps"의 `echo … >> ~/.zprofile` 두 줄**을 그대로 실행하고 터미널을 새로 엽니다.

### A3. Node 22 · pnpm 10
이미 `pnpm install`을 하셨으니 버전만 확인합니다.
```bash
node -v   # v22 이상
pnpm -v   # 10 이상
```
낮거나 없으면:
```bash
brew install node@22 pnpm
brew link --overwrite --force node@22
```

### A4. Rust + Universal 빌드 타깃
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
- 물어보면 `1) Proceed with standard installation` (엔터)
- 끝나면 터미널을 새로 열거나 `source "$HOME/.cargo/env"`

App Store용 Universal(Apple Silicon + Intel) 빌드에 필요한 타깃 2개:
```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
```

### A5. Docker Desktop
로컬 Supabase가 Docker 위에서 돕니다.
1. https://www.docker.com/products/docker-desktop/ → **Download for Mac** → 내 맥 칩에 맞게 선택
   - 칩 확인:  → 이 Mac에 관하여 → "Apple M…"이면 **Apple Silicon**, "Intel"이면 **Intel**
2. `.dmg` 열기 → Docker를 Applications로 드래그 → 실행
3. 약관 동의, 로그인은 **건너뛰기(Skip)** 해도 됩니다
4. 메뉴 막대에 고래 아이콘이 뜨고 "Docker Desktop is running"이 되면 완료

### A6. Supabase CLI
```bash
brew install supabase/tap/supabase
supabase --version
```

### A7. 로컬 Supabase 띄우고 `.env.local` 채우기
Docker Desktop이 켜진 상태에서:
```bash
pnpm db:start
```
- 처음에는 Docker 이미지를 받느라 **5~10분** 걸립니다.
- 끝나면 URL과 키 목록이 나옵니다. 다시 보고 싶으면 `supabase status`.

출력에서 **`Publishable key`**(CLI 버전에 따라 `anon key`) 값을 복사해서
`apps/desktop/.env.local`의 `VITE_SUPABASE_PUBLISHABLE_KEY=` 뒤에 붙여 넣습니다.
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…   ← 여기
```
> `Secret key` / `service_role key`는 **절대 넣지 마세요.**

로컬 대시보드: http://127.0.0.1:54323 · 로컬 메일함(OTP 확인용): http://127.0.0.1:54324

### A8. 앱 실행
```bash
pnpm dev
```
- 첫 실행은 Rust 컴파일로 **3~10분** 걸립니다. 이후에는 몇 초.
- "Nodii 배포 스파이크" 창이 뜨고 **외부 네트워크 · 로컬 저장소** 두 항목이 모두 **성공**이면 OK
- 창을 닫고 다시 `pnpm dev` → 저장소 항목에 "이전 실행 기록: …"이 보이면 저장도 정상

### A9. 점검
```bash
pnpm check-env
```
**필수 항목 모두 통과**가 나오면 A 파트 완료입니다. 경고(!)는 안내된 명령대로 해결하세요.

---

## B. Apple 배포 스파이크 (TestFlight까지)

목표: 샌드박스가 켜진 **실제 App Store 빌드**에서 네트워크와 저장소가 동작하는지 미리 확인.
필요 권한: Apple Developer 계정의 **Account Holder**(개인 계정이면 본인).

### B1. Team ID 확인
1. https://developer.apple.com/account 로그인
2. **Membership details**(멤버십 세부 사항) → **Team ID** (영문·숫자 10자리) 메모
   - `pnpm check-env --release`가 나중에 프로파일에서 자동으로 읽어 주므로 확인용입니다.

### B2. App ID 확인
App Store Connect에 앱을 등록할 때 이미 만들어졌을 가능성이 높습니다.
1. https://developer.apple.com/account/resources/identifiers/list
2. 목록에 **`com.sungjunlee.Nodii`** 가 있는지 확인 → 있으면 B3으로
3. 없으면: **(+)** → **App IDs** → **App** → Description `Nodii`, Bundle ID **Explicit** `com.sungjunlee.Nodii` → Continue → Register
   - Capabilities는 아무것도 체크하지 않아도 됩니다.

### B3. 인증서 요청 파일(CSR) 만들기
1. Spotlight(⌘+Space)에서 **"키체인 접근"**(Keychain Access) 실행
2. 메뉴 막대 **키체인 접근 → 인증서 지원 → 인증 기관에서 인증서 요청…**
   (Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority…)
3. 입력
   - 사용자 이메일 주소: Apple ID 이메일
   - 일반 이름: `Sungjun Lee Nodii`
   - CA 이메일 주소: 비워 두기
   - **디스크에 저장됨** 선택 → 계속 → 바탕화면에 `CertificateSigningRequest.certSigningRequest` 저장

> 이 과정에서 **개인 키가 이 맥의 키체인에** 만들어집니다. 인증서는 이 맥에서만 서명할 수 있고, CI용으로는 8단계에서 `.p12`로 내보냅니다.

### B4. 인증서 2개 발급
https://developer.apple.com/account/resources/certificates/list

**① Apple Distribution** (앱 서명용)
1. **(+)** → Software 아래 **Apple Distribution** → Continue
2. **Choose File** → B3의 `.certSigningRequest` → Continue → **Download**
3. 받은 `distribution.cer`를 **더블클릭** → 키체인에 설치

**② Mac Installer Distribution** (`.pkg` 서명용)
1. 다시 **(+)** → **Mac Installer Distribution** → Continue
2. 같은 `.certSigningRequest` 선택 → Continue → **Download**
3. 받은 `.cer` **더블클릭**

확인:
```bash
security find-identity -v
```
아래 두 줄 비슷한 것이 보이면 성공입니다. (설치 인증서는 키체인에서 이 이름으로 표시됩니다)
```
"Apple Distribution: Sungjun Lee (TEAMID)"
"3rd Party Mac Developer Installer: Sungjun Lee (TEAMID)"
```
> 안 보이면 키체인 접근 → **로그인** 키체인 → **내 인증서**에서 인증서 왼쪽 ▸를 펼쳐 **개인 키가 붙어 있는지** 확인하세요. 다른 맥에서 CSR을 만들었다면 개인 키가 없어서 서명이 안 됩니다.

### B5. 프로비저닝 프로파일
https://developer.apple.com/account/resources/profiles/list
1. **(+)** → Distribution 아래 **Mac App Store Connect** → Continue
2. App ID: **`com.sungjunlee.Nodii`** → Continue
3. Certificate: B4의 **Apple Distribution** → Continue
4. Provisioning Profile Name: `Nodii MAS` → **Generate** → **Download**
5. 프로젝트 안으로 옮기기 (다운로드된 파일 이름이 다르면 맞춰서):
   ```bash
   mv ~/Downloads/Nodii_MAS.provisionprofile apps/desktop/src-tauri/profiles/Nodii_MAS.provisionprofile
   ```
   이 파일은 `.gitignore`에 들어 있어서 커밋되지 않습니다.

### B6. Transporter 설치
1. Mac App Store에서 **Transporter**(Apple) 검색 → 받기
2. 실행 → Apple Developer 계정의 **Apple ID로 로그인**

### B7. 점검하고 빌드
```bash
pnpm check-env --release
```
- 모든 필수 항목이 통과하면 마지막에 **빌드 명령**이 출력됩니다. 그대로 복사해서 실행:
  ```bash
  APPLE_TEAM_ID=XXXXXXXXXX \
  APPLE_SIGNING_IDENTITY="Apple Distribution: …" \
  APPLE_INSTALLER_IDENTITY="3rd Party Mac Developer Installer: …" \
  pnpm build:appstore
  ```
- 처음 Universal 릴리스 빌드는 **10~20분**
- 키체인 접근 허용 창이 뜨면 맥 로그인 암호 입력 → **항상 허용**
- 성공하면 `dist-appstore/Nodii-<빌드번호>.pkg`가 생깁니다.
- 배포 빌드는 `apps/desktop/.env.production.local`(클라우드 Supabase `nodii`)을 사용합니다 — 이미 채워 두었습니다.

### B8. 업로드
1. Transporter 창에 `dist-appstore/Nodii-….pkg`를 **드래그**
2. **전달(Deliver)** 클릭
3. 오류가 나면 Transporter에 `ITMS-…` 코드와 설명이 나옵니다 → 아래 **문제 해결** 참고

### B9. TestFlight에서 빌드 배포
https://appstoreconnect.apple.com → **앱** → **Nodii** → **TestFlight** 탭
1. 빌드가 **처리 중**으로 보입니다. 보통 수 분~30분, 끝나면 이메일이 옵니다.
2. **수출 규정 준수(암호화)** 질문이 뜨면 → Info.plist에 `ITSAppUsesNonExemptEncryption=false`가 들어 있어 보통 생략되지만, 물으면 **"사용하지 않음/면제"** 쪽을 선택
3. 왼쪽 **내부 테스트** 옆 **(+)** → 그룹 이름 `Me` → 만들기
4. 그룹에서 **테스터 초대** → 본인 선택 → 추가
5. **빌드 추가** → 방금 빌드 선택 → "테스트할 내용"에 `배포 스파이크: 네트워크·저장소` → 추가

> 내부 테스트는 Apple 심사 없이 바로 설치할 수 있고, 빌드는 90일간 유효합니다.

### B10. 설치하고 확인
1. Mac App Store에서 **TestFlight** 앱 설치 → 같은 Apple ID로 로그인
2. Nodii → **설치** → **열기**
3. 확인할 것
   - [x] **외부 네트워크 (Supabase)**: 성공 · `https://hwipekipumrnpriytqbe.supabase.co · HTTP 200`
   - [x] **로컬 저장소 (plugin-store)**: 성공
   - [x] 앱을 완전히 종료(⌘Q) 후 다시 열었을 때 "이전 실행 기록"이 보임
4. 결과를 알려 주시면 계획서 0단계 체크와 진행 기록을 갱신합니다.

### 문제 해결

| 증상 | 원인과 해결 |
|---|---|
| `check-env --release`에서 인증서 없음 | B4를 다시. 개인 키가 붙어 있는지 확인 |
| 프로파일 App ID가 다름 | B5에서 App ID를 `com.sungjunlee.Nodii`로, 유형을 **Mac App Store Connect**로 다시 생성 |
| 빌드 중 `rustup target` 오류 | `rustup target add aarch64-apple-darwin x86_64-apple-darwin` |
| Transporter: `90255` 파일을 root만 읽을 수 있음 | 앱 안 파일 권한이 600/700이라서 생김 → `build-appstore.sh`가 `.pkg` 만들기 전에 권한을 정리하도록 수정됨(2026-09-17). 다시 `pnpm build:appstore` 후 새 `.pkg` 업로드 |
| Transporter: 번들 버전 중복 | 빌드 번호가 같음 → 다시 `pnpm build:appstore` (번호는 시각으로 자동 증가) |
| Transporter: 샌드박스/권한 관련 `ITMS-90296` 등 | `Entitlements.appstore.plist`가 생성됐는지, `codesign -d --entitlements - <앱 경로>`에 `app-sandbox`가 있는지 확인 |
| TestFlight에서 **"테스트할 수 없음(Not Available for Testing)"** | 권한 파일에 `com.apple.application-identifier`가 없거나 Team ID가 틀림 → 스크립트가 넣도록 되어 있으니 `APPLE_TEAM_ID` 값을 확인하고 재빌드 |
| 설치본에서 네트워크만 **실패** | ① Supabase 프로젝트가 일시정지됐는지 대시보드 확인 ② `network.client` 권한 누락 ③ CSP `connect-src` 확인 — 오류 문구를 그대로 알려 주세요 |
| 설치본에서 저장소만 **실패** | 샌드박스 컨테이너 쓰기 문제 → 오류 문구를 알려 주세요 (스파이크가 잡으려던 바로 그 리스크) |

---

## C. 도메인 + 인증 메일 (B와 병행)

### C1. 도메인 구매
추천: **Cloudflare Registrar** (원가 판매, DNS 관리와 Resend 자동 연결이 쉬움, `.app` 지원)
1. https://dash.cloudflare.com/sign-up 가입 (무료)
2. 대시보드 왼쪽 **Domain Registration → Register Domains**
3. `nodii.app` 검색 → 없으면 `nodii.dev`, `getnodii.app`, `nodiiapp.com` 등
4. 결제 정보 입력 → **자동 갱신 켜기** → 구매
   - 연락처 정보는 WHOIS에서 자동으로 가려집니다.

> `.app`, `.dev`는 **HTTPS가 강제**되는 도메인입니다. 나중에 GitHub Pages로 개인정보처리방침을 올릴 때 HTTPS를 켜면 문제없습니다.
> 다른 곳(Porkbun, Namecheap 등)에서 사도 되지만, 그러면 C2의 DNS 레코드를 그 업체 화면에서 직접 입력해야 합니다.

### C2. Resend에 발신 도메인 추가
1. https://resend.com/signup 가입 (GitHub 계정으로 가능)
2. 왼쪽 **Domains → Add Domain**
3. 도메인에 **`mail.nodii.app`** 입력 (Resend는 루트 도메인 대신 **서브도메인** 사용을 권장 — 평판 관리)
   - 리전은 기본값 그대로
4. DNS 설정
   - **자동(추천):** **Sign in to Cloudflare** 버튼 → 권한 허용 → 레코드가 자동으로 추가됨
   - **수동:** Cloudflare → 도메인 → **DNS → Records → Add record**로 Resend 화면에 나온 레코드를 그대로 추가
     - `MX` (send…), `TXT` SPF (send…), `TXT` DKIM (`resend._domainkey…`)
     - 이름 칸에는 **도메인 부분을 빼고** 붙여 넣기 (예: `send.mail`)
     - Proxy status는 **DNS only**(회색 구름)
5. (권장) DMARC 레코드 추가: `TXT` · 이름 `_dmarc` · 값 `v=DMARC1; p=none;`
6. Resend 화면에서 **Verify** → 상태가 **Verified**가 될 때까지 대기 (보통 몇 분, 최대 72시간)

### C3. Resend API 키
1. 왼쪽 **API Keys → Create API Key**
2. Name `supabase-nodii` · Permission **Sending access** · Domain `mail.nodii.app` → Add
3. 표시된 `re_…` 키를 **바로 복사**해서 비밀번호 관리자에 저장 (다시 볼 수 없음)
   - 이 키는 저장소나 채팅에 올리지 마세요.

> Resend 무료 플랜: 하루 100통 · 월 3,000통 · 도메인 3개. MVP 인증 메일에는 충분합니다.

### C4. Supabase `nodii`에 SMTP 연결
https://supabase.com/dashboard/project/hwipekipumrnpriytqbe
1. **Authentication → Emails(또는 Notifications → Email) → SMTP Settings**
2. **Enable custom SMTP** 켜기
3. 입력
   | 항목 | 값 |
   |---|---|
   | Sender email | `no-reply@mail.nodii.app` |
   | Sender name | `Nodii` |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | C3의 API 키 |
4. **Save**

### C5. Supabase `nodii` 인증 설정 (같은 대시보드)
설계서 §6.5 체크리스트입니다. 2단계에서 클라우드로 로그인을 시험하기 전까지만 해 두면 됩니다.
1. **Authentication → Emails → Templates**
   - **Magic Link**: 제목 `Nodii 로그인 코드`, 본문에 저장소의 `supabase/templates/otp.html` 내용을 붙여 넣기
   - **Confirm signup**: 제목 `Nodii 가입 코드`, 같은 본문
   - 두 곳 모두 `{{ .Token }}`이 들어가야 합니다 (링크만 있으면 코드가 안 감)
2. **Authentication → Sign In / Providers → Email**
   - Email OTP Length: `6` · Email OTP Expiration: `600`초
3. **Authentication → Rate Limits**: 이메일 발송 한도가 너무 낮으면 시간당 `30` 정도로

### C6. 확정 값 (2026-09-17)
- 도메인: **`nodii.app`**
- 발신 도메인: **`mail.nodii.app`** (Resend Verified)
- 발신 주소: **`no-reply@mail.nodii.app`** · 발신자 이름 `Nodii`
- 요구사항 v1.1(Q9)과 설계서 v1.2에 반영됨

---

## D. GitHub CI 확인
1. https://github.com/anderpudding/nodii → **Actions** 탭
2. 최근 커밋의 **CI** 실행이 초록 체크(✓)인지 확인
3. 빨간 X면 실행을 눌러 실패한 단계의 로그를 복사해서 알려 주세요.

---

## 끝나면 0단계 완료 기준
- [x] `pnpm check-env --release` 필수 항목 모두 통과
- [x] TestFlight 설치본에서 네트워크·저장소 **성공**, 재실행 시 이전 기록 표시
- [x] 도메인 구매, Resend 도메인 **Verified**
- [x] GitHub Actions CI 통과

→ 다 되면 1단계(`docs/codex/stage-1a-db.md`, `stage-1b-core.md`)로 넘어갑니다.

---

### 참고한 공식 문서
- [Tauri · Prerequisites](https://v2.tauri.app/start/prerequisites/) · [Tauri · App Store 배포](https://v2.tauri.app/distribute/app-store/)
- [Apple · App Store Connect 프로비저닝 프로파일 만들기](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile) · [Apple · 빌드 업로드](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/) · [Apple · 내부 테스터 추가](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers)
- [Resend · Cloudflare 도메인](https://resend.com/docs/dashboard/domains/cloudflare) · [Resend · Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp) · [Resend · 계정 한도](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
- [Cloudflare · .app 도메인](https://www.cloudflare.com/application-services/products/registrar/buy-app-domains/)
