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
