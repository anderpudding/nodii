# 모바일 정적 폰트 서브셋

`node scripts/subset.js`는 앱 실행 의존성이 아닌 **개발 도구**입니다. Node/기존 TypeScript와 Python FontTools 4.61.1을 사용합니다. 원본 네 정적 OTF는 별도 폴더에 두고 실행합니다. 저장소에는 원본을 중복 보관하지 않습니다.

```bash
python3 -m venv /tmp/nodii-font-tools
/tmp/nodii-font-tools/bin/python -m pip install fonttools==4.61.1
FONT_SUBSET_PYTHON=/tmp/nodii-font-tools/bin/python node scripts/subset.js --source-dir /path/to/original-otfs
FONT_SUBSET_PYTHON=/tmp/nodii-font-tools/bin/python node scripts/subset.js --check
```

현재 원본은 변경 전 Git 커밋 `2bb486d`의 `apps/mobile/assets/fonts/*.otf`입니다. `git show 2bb486d:apps/mobile/assets/fonts/Pretendard-Regular.otf > /tmp/original-otfs/Pretendard-Regular.otf`처럼 네 파일을 복원하거나 동일한 upstream 파일을 사용합니다. `report.json`에 네 원본 SHA-256과 처리 전후 바이트를 기록했습니다. 앱 자산 폴더 자체/이미 서브셋된 파일을 원본으로 지정하면 거부합니다.

기준 목록 `pretendard-common-v1.3.9.txt`는 [Pretendard v1.3.9의 subset_glyphs.txt](https://github.com/orioncactus/pretendard/blob/v1.3.9/packages/pretendard/subset_glyphs.txt)를 그대로 보관한 것입니다. Adobe-KR-9 기반 상용 한글 **2,780자**를 포함합니다([upstream 설명](https://github.com/orioncactus/pretendard/issues/164)). 원본에 있는 **비한글 3,164자 전체**와 현재 앱/공유 소스·Intl 출력 문자도 합칩니다. 한글 자모·숫자·라틴/영문·기호의 기존 지원 범위를 줄이지 않습니다.

Node 단계는 mobile app/src/lib와 core/api/i18n src의 **168개 TS/TSX 파일**을 읽습니다. 테스트·주석도 포함한 원문, TypeScript AST가 해석한 문자열/템플릿 escape, JSX 텍스트를 합쳐 필요한 문자의 보수적 상위집합을 만듭니다. `Intl.DateTimeFormat('ko-KR')`의 7요일 × narrow/short/long, 12개월 × full/long/medium/short와 숫자/음수/소수 출력도 수집합니다. 현재 검증 문자 **615자**입니다.

Python 단계는 네 벌을 실제 직렬화한 뒤 다시 열어 다음을 검사합니다.

- 보존할 **5,944 codepoints** 모두 cmap에 있으며 `.notdef`/glyph ID 0으로 연결되지 않음
- 원본과 출력의 전체 보존 글리프에 대해 draw 명령(윤곽)·advance width/side bearing 해시가 같음
- 정적 OTF·400/500/600/700 weight 유지, `fvar` 없음
- 모든 OpenType layout feature를 보존하도록 subset 설정(`tnum` 등 숫자 특성 포함)
- `--check`에서 현재 앱 문자의 추가 누락이 0개이고, 커밋한 보존 글리프 윤곽/폭 해시도 일치

`⌄`(U+2304)·`☰`(U+2630)는 **원본에도 없던** 앱 문자입니다. 새로운 누락으로 처리하지 않고 기록하며 기존 iOS 시스템 폰트 fallback을 유지합니다. 사용자 입력은 제한하지 않습니다. 상용 한글 목록 밖 음절은 시스템 fallback으로 표시되며, 새 UI 문구에 그런 음절이 추가되면 `--check`가 실패하므로 원본에서 다시 생성합니다. 자모 조합을 포함한 실제 native fallback 렌더링은 TestFlight에서 확인합니다.

저작권/원래 OFL은 `apps/mobile/assets/fonts/LICENSE.txt`에 그대로 둡니다. [OFL Reserved Font Name 조건](https://openfontlicense.org/webfonts-and-reserved-font-names/)에 따라 파생 바이너리의 내부 family/PostScript 이름만 **NodiiUISubset**으로 바꿨습니다. 파일명·Expo 등록 별칭 `Pretendard-*`·정적 네 벌 로딩·앱의 타이포그래피 값은 유지합니다. 이 별칭은 앱의 로딩 키이며 폰트 자체의 배포 이름은 아닙니다.

## M8 · ExtraBold (800) 추가

기존 네 굵기에 `Pretendard-ExtraBold.otf`를 추가합니다. 원본 다섯 벌은 설치된 Pretendard v1.3.9의 `dist/public/static/`에서도 얻을 수 있습니다. 위 절차는 400/500/600/700/800 다섯 벌의 cmap·정적 weight·윤곽·글자 폭을 모두 검증하며, `--check`도 다섯 벌을 확인합니다. 앱 별칭은 `Pretendard-ExtraBold`, 내부 파생 이름은 기존과 같은 `NodiiUISubset`입니다.
