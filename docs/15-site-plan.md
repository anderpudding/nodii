# 웹사이트(nodii.app) 개편 계획 — v2 디자인 + 한영 전환

> 버전 0.1 · 2026-11-06 · 근거: `DESIGN.md` v2, `docs/design/tokens.md`·`components.md`, `14-i18n-plan.md` §4 용어집, `store-assets/screenshots-v2/store-text*.md`
> 상태: **W1~W5 구현 완료 (2026-11-06, 브랜치 `feat/site-v2`).** 남은 일: PR 머지 → 실제 nodii.app 확인. i18n 계획(I1~I5) 밖에서 따로 진행한다(2026-10 결정).

## 1. 왜

- 랜딩(`site/index.html`)만 한국어이고 support·privacy·terms는 영어라, 한 사이트 안에서 언어가 섞여 있다. 앱은 이미 영어를 지원한다(I5 완료).
- 사이트는 아직 v1 토큰을 쓴다. 회색 `side` 카드 + 테두리, 파란 `focus` 링크, 테두리 체크, 끝낸 일 취소선이 남아 있다. Pretendard도 번들하지 않아 시스템 폰트로 보인다.
- 내용이 오래됐다. Mac만 소개하고, 스토어 버튼이 `aria-disabled`이고, URL이 본문에 그대로 노출돼 있다. support에는 "The App's interface is currently in Korean"과 한국어 UI 라벨만 있다.

## 2. 확정한 결정 (2026-11-06)

| 항목 | 결정 |
| --- | --- |
| 플랫폼 | iPhone 앱이 출시됨 → **Mac + iPhone** 둘 다 소개. 같은 App Store 레코드(ID `6812983213`, 유니버설 구매)라 링크 하나 |
| URL | **`/` 영어(기본), `/ko/` 한국어.** 언어별 정적 HTML. JS 없이도 동작 |
| 번역 범위 | **랜딩 + 지원은 두 언어, privacy·terms는 영어 원본만**(캐나다 운영 기준) |
| 비주얼 | **둘 다**: 히어로는 실제 스크린샷, 기능 섹션은 HTML/SVG로 작게 재현 |

## 3. 파일 구조

빌드 단계 없이 유지한다(Pages 워크플로가 `site/`를 그대로 올림).

```
site/
  index.html          EN 랜딩
  support.html        EN 지원
  privacy.html        EN only
  terms.html          EN only
  ko/index.html       KO 랜딩
  ko/support.html     KO 지원
  style.css           v2로 새로 씀 (경로 유지 → 기존 링크 안 깨짐)
  lang.js             언어 기억 + 첫 방문 안내 (아주 작게)
  fonts/              Pretendard Variable dynamic subset (self-host)
  img/                스크린샷(webp), 파비콘, OG 이미지 (en/ko)
```

- 헤더·푸터는 6개 파일에 복제한다. 템플릿 빌드를 도입할 만큼 페이지가 많지 않다. 문구를 고칠 때 en/ko 짝을 함께 고친다(§8 체크).

## 4. 한영 전환

- **토글**: 헤더 오른쪽 `EN | 한국어` 세그먼트(앱 설정 세그먼트와 같은 `chip` 트랙 + 알약). 각 항목은 **짝 페이지로 가는 `<a>`**이고, 현재 언어에 `aria-current="true"`.
  - `/` ↔ `/ko/`, `/support.html` ↔ `/ko/support.html`
  - privacy·terms에는 한국어 짝이 없다 → `한국어`는 `/ko/`(랜딩)로 연결. 문서 위에 한 줄 안내: "이 문서는 영어로만 제공됩니다."
  - 한국어 페이지의 privacy·terms 링크는 영어 원본으로 가고 라벨에 `(English)`를 붙인다.
- **언어 기억**: 토글을 누르면 `localStorage['nodii.lang']`에 저장(try/catch로 감쌈).
- **첫 방문 안내**: `/`의 `<head>` 인라인 스크립트. 저장값이 없고 `navigator.languages[0]`이 `ko`로 시작하면 `/ko/`로 `location.replace`. 저장값 `en`이면 그대로 둔다. 크롤러·JS 꺼짐은 영어 그대로.
- **SEO**: 각 짝 페이지에 `hreflang="en"`·`hreflang="ko"`·`x-default`(= `/`), `canonical`, `<html lang>`.
- privacy §10은 "쿠키·분석을 쓰지 않는다"고 적혀 있다. `localStorage`의 언어 값은 기기를 떠나지 않으므로 사실과 어긋나지 않지만, §10에 "언어 선택은 브라우저에만 저장된다"는 한 줄을 추가하고 *Last updated* 날짜를 바꾼다.

## 5. 디자인 (v2 반영)

`DESIGN.md` 원칙을 사이트에 그대로 적용한다.

- **토큰**: `tokens.md` §1의 `bg`·`surface`·`chip`·`box`·`ink`·`ink-2`·`muted`·`line`·`danger`를 라이트/다크 둘 다. 없앤 토큰(`side`·`banner`·`focus`)은 쓰지 않는다.
- **색은 목표에서만**: 강조색 없음. 버튼·링크 강조·포커스는 `ink`. 화면 색은 목표 색 프리셋(`tokens.md` §2)으로만 낸다.
- **선 대신 여백, 테두리 대신 채움**: 카드 테두리 제거, 묶음은 `chip` 채움. 그림자는 떠 있는 것(재현한 토스트)에만.
- **타이포**: Pretendard Variable. 제목 800 + 좁은 자간, 본문 400, 버튼 800, 숫자 `tabular-nums`. 크기는 사이트용으로 히어로만 키우고(48~56 / 모바일 34~36) 나머지는 `tokens.md` §3 단계를 따른다.
- **폰트 로딩**: `node_modules/.pnpm/pretendard@1.3.9`의 **dynamic subset**(unicode-range로 쪼갠 woff2)을 `site/fonts/`에 복사해 self-host. 외부 CDN을 쓰지 않는다(privacy §10 유지). 전체 woff2(2MB)는 쓰지 않는다. `font-display: swap`.
- **모양**: 버튼·토글·이름표는 알약(999), 체크와 도장은 **싹이** path(`components.md`, `@nodii/core`의 `SPROUT_*` 상수와 같은 값)를 인라인 SVG로.
- **접근성**: 키보드 포커스 링 2px `ink` offset 2px, 본문 4.5:1, `prefers-reduced-motion`이면 애니메이션 끔, `prefers-contrast: more`면 빈 체크·도장에 `muted` 1.5px 테두리.
- **하지 않는 것**: 그라데이션 배경, 유리 효과, 이모지 아이콘, 크림/베이지, 투두메이트 브랜드 요소.

## 6. 랜딩 구성 (en/ko 같은 구조)

문구는 App Store 원고(`store-text.en.md`·`store-text.md`)와 용어집(todo·goal·routine·Bring Over·Undo…)을 따른다. 한국어 랜딩은 번역문이 아니라 같은 구조의 한국어 원고로 쓴다.

1. **헤더**: 앱 아이콘 + Nodii · Support · 언어 토글
2. **히어로**: 제목 + 한 줄 설명(목표별 할 일·루틴, Mac과 iPhone 동기화) · App Store 버튼(Apple 공식 배지, 언어별) · 메타 줄 "Free · iPhone (iOS 16.4+) · Mac (macOS 12+)"
   - 비주얼: Mac 오늘 화면 + 그 앞에 겹친 iPhone 오늘 화면. **언어에 맞는 스크린샷**(`macos-en`/`macos`, `ios-en`/`ios`). 다크 모드에서는 `<picture>`로 다크 스크린샷이 있으면 교체, 없으면 라이트 그대로.
3. **기능 섹션** (HTML/SVG 재현, 섹션마다 짧은 제목 + 2줄 설명 + 작은 그림)
   - **끝낸 만큼 물드는 체크**: 목표 이름표(회색 알약 + 색 점 + 목표 색 글자)와 할 일 3줄. 싹이 체크를 눌러 볼 수 있다(장식용 인터랙션, 0.28s 등장).
   - **캘린더가 색으로 차오름**: 2주 도장 그리드. 끝낸 목표 색 블록 분할, 다 끝낸 날만 잎 + 체크.
   - **루틴**: "Every Mon·Wed·Fri", "Every 2 weeks", "Skip Today" 칩.
   - **실수해도 되돌리기**: 실행 취소 토스트 한 장(`toast-action` 색).
   - **Mac과 iPhone이 함께**: 실시간 동기화, 오프라인에서는 보기만 가능.
4. **신뢰 줄**: 무료 · 광고·추적 없음 · 이메일 6자리 코드 로그인(비밀번호 없음)
5. **마지막 CTA** + **푸터**: Support · Privacy · Terms · © 2026 Sungjun Lee

## 7. 지원·약관 페이지

- **support (en/ko)**: "interface is currently in Korean" 삭제. UI 라벨을 각 언어 카탈로그 값으로(`packages/i18n/src/catalog.en.ts`·`catalog.ko.ts`. 예: `auth.resend` = Resend Code / 코드 다시 받기). FAQ에 **"앱 언어 바꾸기"**(Settings → Language, 기기별 저장) 추가. 버전 확인 경로도 언어별로.
- **privacy·terms**: 내용은 그대로, 새 CSS·헤더·토글만 적용. §4의 §10 한 줄 추가와 날짜 갱신만.

## 8. 메타·자산

- 언어별 `<title>`·`description`, OG/Twitter 카드 이미지 1200×630 (en/ko, `creative-assets` 헤더 이미지에서 잘라 만듦).
- 파비콘: `store-assets/app-icon/nodii-icon-macos.svg` → `favicon.svg` + 180px `apple-touch-icon.png`. `theme-color` 라이트/다크.
- 스크린샷: 표시 폭의 2배로 줄여 **WebP**(장당 ~200KB 목표), `width`/`height` 명시, 히어로 외에는 `loading="lazy"`.

## 9. 단계

브랜치 `feat/site-v2` 하나, 단계마다 커밋, PR 하나. main에 머지되는 순간 배포되므로 **머지 전에 로컬에서 전부 확인**한다.

| 단계 | 내용 | 완료 기준 |
| --- | --- | --- |
| **W1** 기반 | `style.css` v2 재작성, 폰트 self-host, 헤더·푸터·토글, `lang.js`. 기존 4페이지에 적용(내용 변경 없음) | 4페이지가 v2 모양, 라이트/다크, 375px에서 가로 스크롤 없음 |
| **W2** EN 랜딩 | §6 전체 영어판, 스크린샷 최적화, 싹이·도장 재현 | 1280/768/375 폭 확인, 이미지 합계 1MB 이하 |
| **W3** KO 랜딩 | `/ko/index.html`, 한국어 스크린샷, hreflang 짝 연결 | 토글 왕복, 첫 방문 안내(ko 브라우저 → `/ko/`, 저장값 en → 유지) |
| **W4** 지원·약관 | support en/ko, privacy·terms 헤더·안내 줄·§10 갱신 | 모든 내부 링크가 짝 페이지로 감, 깨진 링크 0 |
| **W5** 메타·검증 | OG·파비콘·title/description, 최종 점검 | §10 체크리스트 통과 → PR → 머지 → 실제 nodii.app 확인 |

## 10. 검증 체크리스트

- [ ] `python3 -m http.server -d site`로 띄워 `/`, `/ko/`, `/ko/support.html` 같은 디렉터리 경로가 열림 (Pages와 같은 동작)
- [ ] Playwright 스크린샷: {en, ko} × {light, dark} × {375, 768, 1280}
- [ ] 키보드만으로 토글·버튼·FAQ 이동, 포커스 링 보임
- [ ] 대비: 본문 4.5:1, 목표 이름표 글자 `chip` 위 4.5:1
- [ ] `prefers-reduced-motion`에서 애니메이션 없음
- [ ] JS 끈 상태에서도 두 언어 모두 열람 가능
- [ ] Lighthouse 모바일 Performance·Accessibility·SEO 각 95 이상
- [ ] App Store 링크가 iPhone에서는 App Store 앱, Mac에서는 Mac App Store로 열림
- [ ] en/ko 짝 페이지의 섹션 수·링크 수가 같음

## 11. 구현하면서 바뀐 것 (2026-11-06)

- **스크린샷은 라이트만** 쓴다. iPhone 다크 스크린샷이 없어 Mac만 다크로 바꾸면 둘이 어긋나서, 다크 모드에서도 라이트 스크린샷을 그대로 둔다.
- 스크린샷은 스토어 합성 이미지(`store-assets/screenshots-v2/macos{,-en}`, `ios{,-en}`의 `01-today`)에서 앱 화면만 잘라 WebP로 만들었다(Mac 1820×1220, iPhone 660×1199, 4장 합계 약 150KB). 창 제목 막대와 iPhone 테두리는 CSS로 그린다. 한국어 iPhone 원본 캡처(`generator-ios/ko-after`)는 목표 이름이 영어라 쓰지 않았다.
- 헤더·파비콘 아이콘은 여백이 있는 macOS 아이콘 대신 **iOS 라이트 아이콘**(`nodii-icon-ios-light.svg`, C2PA 메타데이터 제거)을 쓴다.
- App Store 버튼은 Apple 공식 배지 대신 **먹색 알약 버튼**("Download on the App Store" / "App Store에서 받기")으로 둔다. 링크는 유니버설 구매라 하나다.
- `.prettierignore`에 `site/fonts/`를 추가했다(Pretendard 원본 CSS 유지).
- 검증 결과: axe(wcag2a/aa + best-practice) 6페이지 × 라이트/다크 위반 0, 내부 링크 깨짐 0, 375px 가로 스크롤 없음, JS 끔 상태 열람 가능, 언어 안내·토글 왕복 확인. Lighthouse는 아직 돌리지 않았다.

## 12. 범위 밖

- privacy·terms 한국어 번역, 블로그·변경 기록 페이지, 분석 도구, 정적 사이트 생성기 도입, 커뮤니티(v3) 소개.
