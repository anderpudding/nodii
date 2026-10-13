# 디자인 토큰

> 근거: `DESIGN.md`. 값이 바뀌면 이 파일을 먼저 고치고 코드를 따라 고칩니다.

## 1. 색

| 토큰 | 라이트 | 다크 | 쓰는 곳 |
| --- | --- | --- | --- |
| `bg` | `#FFFFFF` | `#131417` | 창 바탕, 하루 목록 |
| `side` | `#F7F8FA` | `#1A1C20` | 사이드바, 입력 중인 줄, 설정 창 바탕 |
| `surface` | `#FFFFFF` | `#1D1F23` | 시트·모달·메뉴 표면 |
| `ink` | `#16181D` | `#F1F2F4` | 본문, 주요 버튼 바탕 |
| `ink-2` | `#4B5160` | `#B4B9C2` | 보조 설명, 아이콘 |
| `muted` | `#646A76` | `#9AA0AA` | 라벨, 비활성 설명 |
| `line` | `#E9EBEF` | `#26292E` | 구분선 |
| `line-2` | `#DADDE2` | `#353941` | 앞날 도장 테두리, 취소선 |
| `field` | `#8F95A0` | `#70757F` | 입력칸·빈 체크 테두리 (대비 3:1) |
| `box-fill` | `#F1F2F5` | `#1E2024` | 빈 체크 안쪽 |
| `stamp` | `#ECEEF1` | `#2A2D33` | 캘린더 남은 개수 도장 |
| `stamp-empty` | `#F4F5F7` | `#212429` | 항목이 없는 날의 빈 도장 상자 (CAL-02) |
| `banner` | `#F2F4F7` | `#1F2227` | 지난 미완료 배너 |
| `focus` | `#2A63C9` | `#7AA7FF` | 포커스 링, 선택된 옵션 |
| `danger` | `#C4332C` | `#FF7A70` | 삭제, 오류 |
| `sun` | `#C4332C` | `#FF7A70` | 일요일 숫자 |
| `sat` | `#2A63C9` | `#7AA7FF` | 토요일 숫자 |
| `warn-bg` / `warn-ink` | `#FFF4DB` / `#8A5A00` | `#3A2F17` / `#F2C66D` | 오프라인 표시 |

- 잉크 버튼 위 글자는 `bg` 색, 위험 버튼(`#C4332C`) 위 글자는 흰색입니다.
- 스크림(모달 뒤 어둡게): 라이트 `rgba(22,24,29,0.32)`, 다크 `rgba(0,0,0,0.5)`.
- 그림자: 모달 `0 24px 64px rgba(22,24,29,0.22)`, 메뉴 `0 14px 36px rgba(22,24,29,0.16)` + 1px 링. 다크는 검정 불투명도를 올리고 흰색 7% 링을 더합니다. **테두리와 그림자를 함께 쓰지 않습니다**(메뉴만 예외).

## 2. 목표 색 프리셋

| 이름 | HEX | 이름 | HEX |
| --- | --- | --- | --- |
| 코랄 | `#F0715A` | 틸 | `#33A9B8` |
| 오렌지 | `#F59E3B` | 블루 | `#4F7CFF` |
| 옐로 | `#E9C23A` | 인디고 | `#6C6FE0` |
| 라임 | `#8CC152` | 퍼플 | `#A06CD5` |
| 그린 | `#3FB28A` | 핑크 | `#E86BA6` |
| | | 그레이 | `#8E8B84` |

기본 목표("할 일", AUTH-04)는 **블루 `#4F7CFF`**로 만듭니다. 가입 트리거(설계서 §4.3)가 쓰는 값과 같아야 하므로, 이 프리셋의 블루는 트리거 값에 맞춰 둡니다.

## 3. 타이포그래피

글꼴: `Pretendard Variable`, 폴백 `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif`.

| 용도 | 크기 / 굵기 | 자간 |
| --- | --- | --- |
| 날짜 제목 | 28 / 700 | -0.7px |
| 시트·모달 제목 | 20 / 700 | -0.4px |
| 할 일 제목, 입력칸 | 15 / 400 | 0 |
| 목표 이름표, 버튼 | 14 / 700 | -0.1px |
| 보조 설명 | 13 / 500 | 0 |
| 라벨, 캘린더 숫자 | 12 / 600 | 0 |

행간은 본문 1.45~1.6, 제목 1.2~1.25. 숫자에는 `tabular-nums`.

## 4. 모서리 · 간격

- 모서리: 체크 7 · 캘린더 도장 8 · 버튼과 입력 9~11 · 메뉴 12 · 카드와 시트 12~14 · 모달 16 · 이름표와 알약 999.
- 간격(px): 4 아이콘과 글자 · 8 칩 사이 · 12 체크와 제목 · 16 카드 안쪽 · 26 목표 묶음 사이 · 48 목록 좌우 여백.
- 사이드바 너비 380, 최소 창 크기 880×600(설계서 §7).

## 5. 모션

| 대상 | 시간 / 이징 |
| --- | --- |
| 배경·테두리 상태 변화 | 0.15s ease-out |
| 체크 눌림 | 0.12s ease-out, `scale(0.86)` |
| 체크 표시 등장 | 0.28s `cubic-bezier(0.2, 0.9, 0.3, 1.35)` |
| 메뉴 열림 | 0.14s ease-out, 위로 4px |
| 토스트 | 0.24s `cubic-bezier(0.16, 1, 0.3, 1)`, 아래서 10px |

`@media (prefers-reduced-motion: reduce)`에서 모두 끕니다.

## 6. Tailwind v4 설정 (`apps/desktop/src/index.css`)

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-bg: #ffffff;
  --color-side: #f7f8fa;
  --color-surface: #ffffff;
  --color-ink: #16181d;
  --color-ink-2: #4b5160;
  --color-muted: #646a76;
  --color-line: #e9ebef;
  --color-line-2: #dadde2;
  --color-field: #8f95a0;
  --color-box: #f1f2f5;
  --color-stamp: #eceef1;
  --color-stamp-empty: #f4f5f7;
  --color-banner: #f2f4f7;
  --color-focus: #2a63c9;
  --color-danger: #c4332c;
  --color-sun: #c4332c;
  --color-sat: #2a63c9;
  --font-sans: "Pretendard Variable", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
}

.dark {
  --color-bg: #131417;
  --color-side: #1a1c20;
  --color-surface: #1d1f23;
  --color-ink: #f1f2f4;
  --color-ink-2: #b4b9c2;
  --color-muted: #9aa0aa;
  --color-line: #26292e;
  --color-line-2: #353941;
  --color-field: #70757f;
  --color-box: #1e2024;
  --color-stamp: #2a2d33;
  --color-stamp-empty: #212429;
  --color-banner: #1f2227;
  --color-focus: #7aa7ff;
  --color-danger: #ff7a70;
  --color-sun: #ff7a70;
  --color-sat: #7aa7ff;
}

:root { color-scheme: light dark; }
::selection { background: color-mix(in srgb, var(--color-focus) 22%, transparent); }
:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
```

테마는 `.dark` 클래스를 `<html>`에 붙여 전환합니다. 설정값은 기기별 로컬 저장(`plugin-store`, 지시서 I5), 시스템 값은 `matchMedia('(prefers-color-scheme: dark)')`로 따라갑니다.

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
- `MobileUndo` 토스트 최소 높이 52pt, 좌우 16pt, 모서리 14pt, safe area 또는 고정 추가 바 위 10pt.
- `segBg`는 기존 `side`, `toastBg`/`toastInk`는 기존 `ink`/`bg` 역할로 해석한다. 실행 취소 글자는 데스크톱처럼 토스트 글자색을 쓴다. 새로운 HEX를 추가하지 않는다.
- 삭제 칸은 두 테마 모두 채움용 `#C4332C` + 흰색을 쓴다 (§1 위험 버튼 규칙). 다크의 `danger=#FF7A70`는 오류·삭제 글자용이며 흰 글자 채움에는 쓰지 않는다.
- 길게 누른 줄의 확대는 `scale(1.02)`, 시간은 기존 눌림 120ms. 문서의 "살짝 커짐"을 2%로 보완하며 레이아웃에는 영향을 주지 않는다. 모션 감소 시 확대하지 않는다. 실기기 느낌 확인 후 조정할 수 있다.
- 밀기 한 칸 너비는 기존 36pt 칩 높이의 2배인 72pt. 수평 12pt 이후 활성화, 활성화 전 수직 8pt 초과 시 실패, 전체 실행은 행 너비의 65%. 속도만으로 실행하지 않는다. 짧은 밀기는 닫고, 왼쪽 두 칸(144pt)을 드러내되 65% 미만이면 버튼을 누를 수 있게 유지한다.
