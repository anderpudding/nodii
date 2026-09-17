# Nodii

모든 기기에서 같은 하루를 보여주는, 가볍고 깔끔한 날짜 기반 투두 앱 (macOS · Tauri v2 + React + Supabase)

- 요구사항: [`docs/01-requirements.md`](docs/01-requirements.md)
- 시스템 설계: [`docs/02-system-design.md`](docs/02-system-design.md)
- 구현 계획 · 진행 상황: [`docs/03-implementation-plan.md`](docs/03-implementation-plan.md)

## 구조

```
apps/desktop/        Tauri v2 앱 (React 19 · Vite · Tailwind)
  src-tauri/         Rust 셸 · tauri.conf.json · App Store 설정
packages/core/       도메인 로직 (순수 TS, 의존성 없음)
packages/api/        Supabase 클라이언트 · repository · realtime
supabase/            config.toml · migrations · pgTAP tests · 메일 템플릿
scripts/             App Store 빌드 스크립트
```

의존 방향: `apps/*` → `packages/api` → `packages/core`

## 준비물

| 도구                          | 설치                                                         |
| ----------------------------- | ------------------------------------------------------------ |
| Node 22 · pnpm 10             | `brew install node@22 pnpm` (또는 `corepack enable`)         |
| Rust stable                   | `curl https://sh.rustup.rs -sSf \| sh`                       |
| Universal 빌드 타깃           | `rustup target add aarch64-apple-darwin x86_64-apple-darwin` |
| Xcode Command Line Tools      | `xcode-select --install`                                     |
| Docker Desktop · Supabase CLI | `brew install supabase/tap/supabase`                         |

## 시작하기

```bash
pnpm install
pnpm check-env         # 설치 상태 점검 (배포 준비물까지: pnpm check-env --release)
cp apps/desktop/.env.example apps/desktop/.env.local

pnpm db:start        # 로컬 Supabase (출력된 API URL·Publishable key를 .env.local에)
pnpm dev             # Tauri 앱 실행
```

로컬에서 보낸 인증 메일은 http://127.0.0.1:54324 에서 확인합니다.

## 스크립트

| 명령                                                  | 내용                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm dev` / `pnpm dev:web`                           | Tauri 앱 / 브라우저 미리보기                                     |
| `pnpm lint` · `pnpm format`                           | ESLint · Prettier                                                |
| `pnpm typecheck` · `pnpm test` · `pnpm test:coverage` | 전체 패키지 타입 검사 · 테스트                                   |
| `pnpm db:start` · `db:reset` · `db:test` · `db:types` | 로컬 DB 실행 · 마이그레이션 재적용 · pgTAP · 타입 생성           |
| `pnpm build:appstore`                                 | Mac App Store용 서명된 `.pkg` (환경 변수는 스크립트 상단 참고)   |
| `pnpm check-env` · `pnpm check-env --release`         | 개발 환경 · App Store 배포 준비물 점검 (확인만 하고 바꾸지 않음) |

## 배포 스파이크 (0단계)

1. Apple Developer에서 인증서 2개(Apple Distribution, Mac Installer Distribution)와 Mac App Store Connect 프로비저닝 프로파일을 만든다
2. 프로파일을 `apps/desktop/src-tauri/profiles/Nodii_MAS.provisionprofile`에 둔다
3. 배포 빌드는 `apps/desktop/.env.production.local`(클라우드 Supabase `nodii`)을 쓴다. `pnpm dev`는 `.env.local`(로컬 Supabase)
4. `pnpm check-env --release`가 모두 통과하면 마지막에 출력되는 빌드 명령을 그대로 실행한다
5. `dist-appstore/*.pkg`를 Transporter로 업로드 → TestFlight 설치 → 두 항목이 모두 **성공**인지, 재실행 시 이전 실행 기록이 보이는지 확인
