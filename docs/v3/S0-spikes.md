# S0 — 실기기 스파이크

> 기준: `docs/16-v3-social-plan.md` §6·§8(S0), SOC-04·05·54. 브랜치: `spike/s0-<이름>`(네 개를 따로). **스파이크 코드는 `main`에 머지하지 않습니다.** 결과는 이 파일 맨 아래 "결과"에 적고, 그 기록만 PR로 올립니다.

## 목적

v3에서 처음 쓰는 플랫폼 기능 네 가지가 **실제 기기와 실제 배포 형태에서** 되는지 먼저 확인합니다. 안 되는 것이 있으면 대안을 정해 S2 이후 지시서에 반영합니다. 기능을 완성하는 단계가 아닙니다. 화면은 버튼 하나로 충분합니다.

## 공통

- 실기기: macOS 앱은 **Mac App Store 서명 빌드(샌드박스)** 또는 TestFlight(macOS), iOS는 **TestFlight**. 개발 빌드에서만 되는 것은 "됨"으로 치지 않습니다.
- 새 의존성·Tauri 플러그인·capability·Entitlement를 추가할 수 있습니다(스파이크 브랜치 한정). 추가한 것과 이유를 결과에 적습니다. `main`에 들어갈 때는 S2·S6 지시서에서 다시 정합니다.
- 비밀 값(APNs 키, Expo 액세스 토큰, Resend 키)은 커밋하지 않습니다. EAS·Supabase secret으로만 둡니다.
- 사람 손이 필요한 일(Apple Developer 설정, 도메인 파일 배포, 기기 설치)은 "사람이 할 일"로 나눠 적고, 에이전트는 그 앞뒤 준비를 끝내 둡니다.

## 1. 유니버설 링크로 앱 열기 (SOC-05)

`https://nodii.app/u/<token>` 링크를 누르면 앱이 설치된 기기에서는 앱이 열리고 토큰을 받는지 확인합니다.

- **도메인 파일**: `site/.well-known/apple-app-site-association`(확장자 없음, JSON). `applinks.details`에 두 앱(`<TeamID>.com.sungjunlee.Nodii`, iOS와 macOS 번들 ID가 같음) + 경로 `/u/*`. GitHub Pages에서 `.well-known`이 그대로 서비스되는지(`.nojekyll` 필요 여부), `Content-Type`이 JSON인지 `curl -I`로 확인합니다.
- **iOS**: `app.json`의 `ios.associatedDomains: ["applinks:nodii.app"]`. `expo-linking`으로 받은 URL에서 토큰을 꺼내 화면에 표시.
- **macOS**: Entitlement `com.apple.developer.associated-domains` + Tauri 딥링크(`tauri-plugin-deep-link` 검토). 앱이 꺼져 있을 때와 켜져 있을 때 둘 다.
- **앱이 없을 때**: 같은 주소가 웹 페이지로 열려야 합니다. `site/u/index.html` 같은 안내 페이지(App Store 버튼 두 개)가 `/u/<token>`에서도 보이는지 확인합니다(정적 호스팅의 경로 처리 — 404 페이지 재활용 등).
- **완료 기준**: iPhone(메모·메시지에서 링크 탭)과 Mac(Safari·메시지에서 링크 클릭)에서 앱이 열리고 토큰이 보인다. 앱을 지운 iPhone에서는 안내 페이지가 열린다.
- **안 될 때 대안**: macOS는 사용자 지정 스킴(`nodii://u/<token>`)으로 안내 페이지의 [앱에서 열기] 버튼을 둡니다. 결과에 어느 쪽으로 갈지 적습니다.

## 2. macOS: Realtime → 로컬 알림 (SOC-54)

앱이 켜져 있는 동안(창을 닫고 Dock에 남은 상태 포함) Supabase Realtime으로 행을 받으면 macOS 알림 센터에 알림을 띄울 수 있는지 확인합니다.

- 임시 테이블(`spike_events`, 본인 행만 RLS) INSERT를 Realtime으로 구독해서 `tauri-plugin-notification`으로 알림을 띄웁니다. 테이블은 스파이크 브랜치 로컬 Supabase에만 만들고 마이그레이션으로 커밋하지 않습니다(원격 프로젝트에는 쓰지 않음).
- 확인할 것: 첫 실행의 알림 권한 요청, 샌드박스에서의 동작, 창을 닫은 상태·다른 앱이 앞에 있는 상태, 앱 아이콘 배지를 켜고 끌 수 있는지(v3는 배지를 쓰지 않음, SOC-50 — 쓰지 않을 수 있는지만 확인), 알림을 눌렀을 때 앱이 앞으로 오는지.
- 완전히 종료된 앱에서는 알림이 오지 않는 것이 정상입니다(계획 §6). 그 사실만 결과에 적습니다.
- **완료 기준**: 서명 빌드에서 창을 닫은 상태로 다른 계정이 INSERT하면 2초 안에 알림이 뜬다.

## 3. iOS: Expo push가 TestFlight 기기에 도착 (SOC-54, S6 위험 확인)

- `expo-notifications`로 권한 요청 → Expo push token 얻기 → 화면에 표시(복사 가능하게).
- EAS 자격 증명에 APNs 키 연결(사람이 할 일). TestFlight 빌드 설치.
- 서버 쪽은 Supabase Edge Function 하나(`spike-push`)에서 Expo Push API(`https://exp.host/--/api/v2/push/send`)를 호출합니다. 함수는 로컬(`supabase functions serve`)에서 실행해도 됩니다.
- 확인할 것: 앱을 완전히 종료한 상태에서 도착, 알림을 눌렀을 때 앱이 열리고 payload를 읽는지, 잘못된 토큰의 오류 응답 모양(나중에 토큰 정리에 씀).
- **완료 기준**: 앱을 종료한 TestFlight iPhone에 10초 안에 도착하고, 누르면 payload가 화면에 보인다.
- **안 될 때**: S6을 v3.1로 넘기는 계획(§8 마지막 줄)을 쓸지 결과에 적습니다.

## 4. Storage 사진 업로드와 EXIF 제거 (SOC-04)

- 로컬 Supabase에 `avatars` 버킷(공개 읽기)을 만들고, 정책은 S1 지시서 §6과 같게 둡니다(본인 폴더 `{user_id}/`만 쓰기).
- **iOS**: 사진 보관함에서 위치 정보가 있는 사진(HEIC 포함)을 고르고 `expo-image-manipulator`로 정사각형 자르기 → 160·480px JPEG(품질 0.8)로 저장 → 업로드.
- **macOS**: 파일 선택 → `<canvas>`에서 자르고 `toBlob('image/jpeg', 0.8)` → 업로드. HEIC를 WebView가 읽는지 확인합니다(못 읽으면 대안 기록).
- 올라간 파일을 내려받아 `exiftool`로 **GPS·촬영 기기 정보가 없는지** 확인합니다.
- 다른 계정 폴더에 쓰기·지우기가 거부되는지 확인합니다.
- 움직이는 이미지(GIF)·10MB 넘는 원본을 고르면 업로드 전에 막히는지.
- **완료 기준**: 두 앱 모두 160·480 파일이 올라가고, EXIF 위치가 없고, 남의 폴더 쓰기가 거부된다.

## 하지 말 것

- 실제 화면 디자인, i18n 문구, 소셜 테이블 마이그레이션(S1), 원격 Supabase 프로젝트 변경.
- `main` 브랜치에 스파이크 코드 머지.

## 최종 보고

AGENTS.md §8 형식에 더해 네 항목마다: 됨/안 됨, 확인한 기기·OS·빌드 종류, 추가한 의존성·Entitlement, 사람이 한 일, 안 되면 대안. 아래 "결과"에도 같은 내용을 짧게 적습니다.

## 결과

(스파이크 후 작성)

| # | 항목 | 결과 | 기기 / 빌드 | 메모·대안 |
| --- | --- | --- | --- | --- |
| 1 | 유니버설 링크 | | | |
| 2 | macOS 로컬 알림 | | | |
| 3 | iOS 푸시 | | | |
| 4 | 사진 업로드·EXIF | | | |
