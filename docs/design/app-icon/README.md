# 앱 아이콘 원본 · 새싹 잎

디자인 캔버스 "Nodii 디자인"의 **앱 아이콘** 탭, 추천안 F(2026-10-27 확정)의 원본입니다. 모두 1024×1024이고 SVG가 기준이며, PNG는 SVG를 그대로 래스터화한 것입니다.

| 파일 | 쓰는 곳 | 형식 |
| --- | --- | --- |
| `nodii-icon-ios-light` | iOS 기본 아이콘 (`apps/mobile/assets/icon.png`) | 흰 바탕, 불투명 RGB, 모서리 없음 |
| `nodii-icon-ios-dark` | iOS 18 다크 아이콘 (`icon-dark.png`) | 먹색 `#111318` 바탕, 밝은 씨앗 `#F3F4F6`, 먹색 체크 |
| `nodii-icon-ios-tinted` | iOS 18 틴트 아이콘 (`icon-tinted.png`) | 회색조. 검은 바탕 + 흰 실루엣 |
| `nodii-icon-macos` | Tauri 아이콘 생성 원본 (`tauri icon`) | 824 둥근 사각 판 + 그림자, 바깥 투명 |

## 모양

- 싹이 path(`components.md` 체크 · 모양 정의)를 그대로 씁니다. 실루엣 높이는 판의 62%이고, 경계 상자의 중심을 판 가운데에 둡니다.
- 색: 씨앗은 먹색 `#111318`, 잎은 그린 `#12A66A`(목표 프리셋), 바탕과 체크는 흰색입니다.
- 체크는 앱 체크 path를 **78%**로 줄여 씨앗 원 중심(12, 14.2)에 둡니다. 선 굵기는 24 기준 2.45로 보정합니다.
- 스플래시(`apps/mobile/assets/splash*.png`)는 같은 실루엣을 512 투명 캔버스의 80% 높이로 그린 것입니다. 다크는 다크 아이콘과 같은 색입니다.

## 다시 만들기

1. SVG를 고친 뒤 1024 크기로 래스터화합니다. iOS 세 장은 알파를 빼고(RGB, 틴트는 회색조) 저장합니다.
2. 데스크톱: `pnpm --filter @nodii/desktop tauri icon ../../docs/design/app-icon/nodii-icon-macos.png -o /tmp/nodii-icons`를 실행한 뒤, `tauri.conf.json`이 쓰는 다섯 파일(`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.png`)만 `apps/desktop/src-tauri/icons/`로 옮깁니다.
