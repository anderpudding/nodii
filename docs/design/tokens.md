# 디자인 토큰

> 디자인 시스템 **v2** (2026-10-27). 근거: `DESIGN.md`. 값이 바뀌면 이 파일을 먼저 고치고 코드를 따라 고칩니다.
> v1에서 바뀐 것: 사이드바 회색·`line-2` 테두리·파란 `focus`를 걷어 내고 `chip`·`box`를 새로 둡니다. 목표 색 프리셋은 한 단계 선명하게 바꿨습니다(블루는 유지).

## 1. 색

| 토큰 | 라이트 | 다크 | 쓰는 곳 |
| --- | --- | --- | --- |
| `bg` | `#FFFFFF` | `#0F1013` | 창·화면 바탕 **하나**. 사이드바도 같은 색 |
| `surface` | `#FFFFFF` | `#1A1C21` | 시트·모달·메뉴 표면 |
| `chip` | `#F2F3F6` | `#1E2026` | 목표 이름표, 보조 버튼(모바일 오늘 포함), 입력칸, 세그먼트 트랙, 설정 묶음 |
| `box` | `#E6E8EC` | `#2B2E35` | 빈 체크 상자, 하나도 못 끝낸 날의 남은 개수 도장(지난날·오늘) |
| `stamp-soft` | `#F2F3F6` | `#1E2026` | 하나도 못 끝낸 앞날 도장, 항목 없는 날의 빈 도장(CAL-02) |
| `ink` | `#111318` | `#F3F4F6` | 본문, 주 버튼 바탕, 선택된 날짜, 키보드 포커스 링 |
| `ink-2` | `#3E4350` | `#B9BEC8` | 보조 글자, 끝낸 할 일 제목 |
| `muted` | `#626877` | `#9097A3` | 라벨, 앞날 도장 숫자, 비활성 설명 (`chip` 위에서도 4.5:1) |
| `line` | `#ECEEF1` | `#22252B` | 꼭 필요한 곳의 구분선(메뉴 항목 사이 등). 기본은 쓰지 않음 |
| `line-2` | `#DFE2E7` | `#30333A` | 원형 아이콘 버튼의 1px 선 |
| `danger` | `#D6303A` | `#FF6B6B` | 삭제, 오류 글자 |
| `danger-fill` | `#D6303A` | `#D6303A` | 흰 글자를 올리는 삭제 버튼·밀기 칸 |
| `sun` / `sat` | `#D6303A` / `#2563EB` | `#FF7A7A` / `#7AA7FF` | 일요일·토요일 숫자 |
| `toast-action` | `#9DB8FF` | `#2F5BD8` | 토스트의 "실행 취소" |
| `warn-bg` / `warn-ink` | `#FFF4DB` / `#8A5A00` | `#3A2F17` / `#F2C66D` | 오프라인 표시 |

- 없앤 토큰: `side`(→ `bg`), `field`(입력칸 테두리 → `chip` 채움), `stamp-empty`(→ `stamp-soft`), `banner`, `focus`(→ `ink`).
- 잉크 버튼 위 글자는 `bg`, `danger-fill` 위 글자는 흰색.
- 스크림: 라이트 `rgba(17,19,24,0.36)`, 다크 `rgba(0,0,0,0.55)`.
- 그림자: 시트 `0 -16px 48px rgba(17,19,24,0.16)`, 모달 `0 24px 64px rgba(17,19,24,0.18)`, 메뉴 `0 16px 40px rgba(17,19,24,0.16)` + 1px 5% 링, 토스트 `0 12px 32px rgba(17,19,24,0.24)`. **그림자는 떠 있는 것(시트·모달·메뉴·토스트)에만 씁니다.** 카드·목록·버튼에는 그림자도 테두리도 없습니다.

## 2. 목표 색 프리셋

| 이름 | HEX | 체크 | 이름 | HEX | 체크 |
| --- | --- | --- | --- | --- | --- |
| 코랄 | `#F2553F` | 흰색 | 틸 | `#0FA3B1` | 흰색 |
| 오렌지 | `#E67300` | 흰색 | 블루 | `#4F7CFF` | 흰색 |
| 옐로 | `#FFC329` | 먹색 | 인디고 | `#5B5CF6` | 흰색 |
| 라임 | `#8BD444` | 먹색 | 퍼플 | `#9B5CFF` | 흰색 |
| 그린 | `#12A66A` | 흰색 | 핑크 | `#FF3D8B` | 흰색 |
| | | | 그레이 | `#8A8F99` | 흰색 |

- 흰 체크가 3:1을 넘도록 코랄·오렌지·그린·틸·핑크를 고른 값입니다. 옐로·라임은 먹색 체크(`checkColor`).
- 기본 목표("할 일", AUTH-04)는 **블루 `#4F7CFF`** 그대로입니다. 가입 트리거(설계서 §4.3) 값과 같아야 합니다.
- **이미 저장된 목표 색은 바꾸지 않습니다.** 프리셋 표만 바뀌고, 예전 프리셋 값으로 만든 목표는 그 값 그대로 보입니다(마이그레이션 없음).

## 3. 타이포그래피

글꼴: `Pretendard Variable`(데스크톱), Pretendard 정적 OTF(모바일). 폴백 `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif`.

| 용도 | 크기 / 굵기 | 자간 |
| --- | --- | --- |
| 모바일 큰 제목(관리 화면) | 30 / 800 | -1px |
| 날짜 제목(데스크톱) | 28 / 800 | -0.9px |
| 월 제목 | 21~22 / 800 | -0.6~-0.7px |
| 시트·모달 제목 | 19~20 / 800 | -0.3px |
| 할 일 제목, 입력칸 | 16(모바일) · 15(데스크톱) / 400 | 0 |
| 목표 이름표, 버튼 | 14 / 800 | -0.2px |
| 보조 설명 | 13 / 500 | 0 |
| 라벨, 요일, 캘린더 숫자 | 12 / 700 | 0 |

- 행간은 본문 1.45~1.6, 제목 1.2~1.25. 숫자에는 `tabular-nums`.
- **800 굵기**: 데스크톱은 가변 폰트라 그대로 됩니다. 모바일은 정적 4벌(400~700)뿐이라 `Pretendard-ExtraBold.otf`를 같은 서브셋 절차(§7)로 추가합니다(약 0.75MB). 추가 전까지는 700으로 대체해도 레이아웃은 깨지지 않습니다.

## 4. 모양 · 간격

- 체크·도장 모양: **싹이**(새싹)(`components.md` 체크 · 모양 정의). 모서리 값 대신 정해진 path를 씁니다.
- 모서리: 입력칸 14 · 묶음 18 · 메뉴 14 · 모달 22 · 바텀 시트 26 · **버튼·이름표·토스트·세그먼트 999(알약)** · 아이콘 버튼 999(원).
- 아이콘 버튼: 원 32(데스크톱 월 이동·설정)·36(날짜 이동·하루 메뉴), `line-2` 1px 안쪽 선. 모바일 상단 줄의 `⋯`·설정은 선 없는 글리프(44pt 영역).
- 간격(px): 7 이름표 점과 글자 · 8 칩 사이 · 12 체크와 제목 · 16 묶음 안쪽 · 26 목표 묶음 사이(데스크톱) · 16(모바일) · 48 목록 좌우 여백.
- 사이드바 너비 380(바탕은 `bg`, 경계선 없음), 최소 창 크기 400×600(설계서 §7). 폭 760 미만에서는 사이드바 대신 주간 스트립을 표시합니다(CAL-07).

## 5. 모션

| 대상 | 시간 / 이징 |
| --- | --- |
| 배경 상태 변화 | 0.15s ease-out |
| 체크 눌림 | 0.12s ease-out, `scale(0.86)`(데스크톱)·`scale(0.88)`(모바일) |
| 체크 표시 등장 | 0.28s `cubic-bezier(0.2, 0.9, 0.3, 1.35)` |
| 메뉴 열림 | 0.14s ease-out, 위로 4px |
| 토스트 | 0.24s `cubic-bezier(0.16, 1, 0.3, 1)`, 아래서 10px |
| 모바일 누름 | 0.12s, 투명도 0.55 |

`@media (prefers-reduced-motion: reduce)`에서 모두 끕니다.

## 6. Tailwind v4 설정 (`apps/desktop/src/index.css`)

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-bg: #ffffff;
  --color-surface: #ffffff;
  --color-chip: #f2f3f6;
  --color-box: #e6e8ec;
  --color-stamp-soft: #f2f3f6;
  --color-ink: #111318;
  --color-ink-2: #3e4350;
  --color-muted: #626877;
  --color-line: #eceef1;
  --color-line-2: #dfe2e7;
  --color-danger: #d6303a;
  --color-danger-fill: #d6303a;
  --color-sun: #d6303a;
  --color-sat: #2563eb;
  --color-toast-action: #9db8ff;
  --font-sans: "Pretendard Variable", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
}

.dark {
  --color-bg: #0f1013;
  --color-surface: #1a1c21;
  --color-chip: #1e2026;
  --color-box: #2b2e35;
  --color-stamp-soft: #1e2026;
  --color-ink: #f3f4f6;
  --color-ink-2: #b9bec8;
  --color-muted: #9097a3;
  --color-line: #22252b;
  --color-line-2: #30333a;
  --color-danger: #ff6b6b;
  --color-danger-fill: #d6303a;
  --color-sun: #ff7a7a;
  --color-sat: #7aa7ff;
  --color-toast-action: #2f5bd8;
}

:root { color-scheme: light dark; }
::selection { background: rgba(155, 92, 255, 0.22); }
:focus-visible { outline: 2px solid var(--color-ink); outline-offset: 2px; }

/* 시스템 "대비 높이기"를 켠 사람에게만 빈 체크·빈 도장에 3:1 테두리 (DESIGN.md §7) */
@media (prefers-contrast: more) {
  .check[aria-pressed="false"], .stamp-soft { box-shadow: inset 0 0 0 1.5px var(--color-muted); }
}
```

테마는 `.dark` 클래스를 `<html>`에 붙여 전환합니다. 설정값은 기기별 로컬 저장(`plugin-store`, 지시서 I5), 시스템 값은 `matchMedia('(prefers-color-scheme: dark)')`로 따라갑니다.
`::selection`의 퍼플은 장식이 아니라 선택 영역 표시이고, `color-mix()`를 쓰지 않도록 rgba로 고정했습니다(macOS 12 WebView).

## 7. 글꼴 번들

```bash
pnpm --filter @nodii/desktop add pretendard
```

```ts
// apps/desktop/src/main.tsx
import "pretendard/dist/web/variable/pretendardvariable.css";
```

- `pretendardvariable-dynamic-subset.css`는 네트워크에서 조각을 받아오므로 **쓰지 않습니다**(오프라인 읽기 SYNC-04).
- 변수 폰트 woff2 약 2MB. 설치 파일 15MB 제한(NFR-04) 안에서 확인하고, 넘치면 `subset.js`로 한글 상용 글리프만 남깁니다.

### 모바일 정적 OTF 서브셋 적용 (M6 후속, 2026-10-12)

모바일은 M1의 **Regular/Medium/SemiBold/Bold 정적 4벌(400/500/600/700)**을 유지하며, 가변 폰트로 바꾸지 않습니다. `scripts/subset.js` + FontTools **4.61.1**로 실제 서브셋을 적용했습니다. 앱 런타임/프로젝트 의존성은 추가하지 않았으며 작업용 Python venv에만 FontTools를 설치했습니다.

| 파일 | 적용 전 bytes | 적용 후 bytes |
| --- | ---: | ---: |
| `Pretendard-Regular.otf` | 1,574,352 | 753,700 |
| `Pretendard-Medium.otf` | 1,584,068 | 754,572 |
| `Pretendard-SemiBold.otf` | 1,583,704 | 753,148 |
| `Pretendard-Bold.otf` | 1,576,660 | 749,772 |
| **합계** | **6,318,784** | **3,011,192** |

- **3,307,592 bytes(52.35%) 감소**. 기준은 Pretendard v1.3.9의 공개 `subset_glyphs.txt`(Adobe-KR-9 상용 한글 **2,780자**)입니다. 숫자·영문·기호·자모를 잃지 않도록 원본의 **비한글 3,164자 전체**를 보존합니다. 필요한 앱 문자가 상용 목록 밖에 있으면 추가하도록 설계했습니다.
- 앱/공유 소스 **168파일**의 원문 및 TypeScript AST의 문자열·템플릿 escape·JSX 텍스트, `Intl`의 요일 7개/월 12개/날짜/숫자 출력에서 **615문자**를 확인했습니다. 원본에서 지원하던 문자의 새 누락 **0개**, 네 벌의 보존 코드포인트 **5,944개** 모두 cmap에서 실제 글리프로 연결됨을 검증했습니다.
- 네 벌을 직렬화한 뒤 다시 열어 원본과 보존 글리프의 **윤곽 및 글자 폭/side bearing 해시**가 같은지 검사했습니다. weight 400/500/600/700, 정적 OTF(`fvar` 없음), 기존 OpenType layout feature(`tnum` 등)도 유지합니다.
- `⌄`·`☰`는 원본에도 없는 문자로 기존 시스템 fallback을 유지합니다. 상용 범위 밖 사용자 입력 한글도 입력을 제한하지 않고 시스템 fallback으로 표시됩니다. UI 문구에 새 음절이 추가되면 `--check`가 실패하므로 원본에서 다시 생성합니다.
- OFL/저작권 파일은 유지하고 파생 폰트 바이너리의 내부 family/PostScript 이름만 `NodiiUISubset`으로 변경했습니다. 파일명·Expo 등록 별칭 `Pretendard-*`·앱 타이포그래피 값은 그대로입니다. 근거와 재현 명령은 `scripts/font-subset/README.md`, 원본 SHA/보존 문자/윤곽 해시는 `scripts/font-subset/report.json`에 있습니다.
- 같은 iOS export 명령으로 전체 **11,144,030 → 7,836,393 bytes**, Hermes **4,800,268 → 4,800,223 bytes**를 측정했습니다. 기존 EAS 0.1.0(5)의 IPA/42.7MB 페이로드는 적용 전 빌드이므로 새 설치 크기로 보고하지 않습니다. 이후 production 재빌드/실기기 로딩·fallback 확인이 필요합니다.

```bash
FONT_SUBSET_PYTHON=/path/to/fonttools-python node scripts/subset.js --source-dir /path/to/original-otfs
FONT_SUBSET_PYTHON=/path/to/fonttools-python node scripts/subset.js --check
```

## 8. 모바일 M2b 상호작용 보완

- `MobileMenu` 메뉴 줄 최소 높이 56pt, 왼쪽 글리프 20pt (`mobile-screens.md`).
- `MobileUndo` 토스트 최소 높이 54pt, 좌우 16pt, 모서리 999(알약), safe area 위 10pt.
- 세그먼트 트랙은 `chip`(회색 묶음 안에서는 `bg`), `toastBg`/`toastInk`는 `ink`/`bg` 역할로 해석한다. **실행 취소 글자는 데스크톱·모바일 모두 `toast-action`**을 쓴다(2026-10-27 사용자 결정). 모바일에서는 `colors.toastAction`으로 대응한다. 본문과 일반 닫기는 `bg` 글자색을 쓴다. 새로운 HEX를 추가하지 않는다.
- 삭제 칸은 두 테마 모두 `danger-fill`(`#D6303A`) + 흰색을 쓴다. 다크의 `danger=#FF6B6B`는 오류·삭제 글자용이며 흰 글자 채움에는 쓰지 않는다.
- 길게 누른 줄의 확대는 `scale(1.02)`, 시간은 기존 눌림 120ms. 문서의 "살짝 커짐"을 2%로 보완하며 레이아웃에는 영향을 주지 않는다. 모션 감소 시 확대하지 않는다. 실기기 느낌 확인 후 조정할 수 있다.
- 밀기 한 칸 너비는 기존 36pt 칩 높이의 2배인 72pt. 수평 12pt 이후 활성화, 활성화 전 수직 8pt 초과 시 실패, 전체 실행은 행 너비의 65%. 속도만으로 실행하지 않는다. 짧은 밀기는 닫고, 왼쪽 두 칸(144pt)을 드러내되 65% 미만이면 버튼을 누를 수 있게 유지한다.
