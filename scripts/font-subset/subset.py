"""정적 네 굵기의 상용 한글과 기존 비한글·앱 문자를 보존하고 실제 cmap/윤곽을 검증한다."""
import hashlib
import json
import sys
from pathlib import Path

from fontTools import subset
from fontTools import __version__ as fonttools_version
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont

request = json.load(sys.stdin)
root = Path(request['root'])
assets = root / 'apps/mobile/assets/fonts'
report_path = root / 'scripts/font-subset/report.json'
common = {ord(c) for c in (root / 'scripts/font-subset/pretendard-common-v1.3.9.txt').read_text()}
ui = set(request['uiCodepoints'])
weights = {'Regular': 400, 'Medium': 500, 'SemiBold': 600, 'Bold': 700}


def hangul(codepoint):
    return 0xAC00 <= codepoint <= 0xD7A3


def fingerprint(font, cmap, codepoints):
    glyphs = font.getGlyphSet()
    values = []
    for codepoint in sorted(codepoints):
        name = cmap[codepoint]
        pen = RecordingPen()
        glyphs[name].draw(pen)
        values.append([codepoint, font['hmtx'].metrics[name], pen.value])
    return hashlib.sha256(json.dumps(values, separators=(',', ':')).encode()).hexdigest()


def verify(font, expected, weight):
    cmap = font.getBestCmap()
    missing = expected - set(cmap)
    if missing:
        raise ValueError('missing codepoints: ' + ', '.join(f'U+{u:04X}' for u in sorted(missing)))
    if 'fvar' in font or font['OS/2'].usWeightClass != weight:
        raise ValueError('static weight changed')
    if any(cmap[u] == '.notdef' or font.getGlyphID(cmap[u]) == 0 for u in expected):
        raise ValueError('mapped to missing glyph')
    return cmap


if sys.argv[1] == '--check':
    report = json.loads(report_path.read_text())
    expected = set(report['retainedCodepoints'])
    previous_fallback = set(report['originalMissingUiCodepoints'])
    new_missing = ui - expected - previous_fallback
    if new_missing:
        raise ValueError('새 앱 문자가 필요합니다. 원본에서 다시 subset하세요: ' + ', '.join(f'U+{u:04X}' for u in sorted(new_missing)))
    for style, weight in weights.items():
        filename = f'Pretendard-{style}.otf'
        with TTFont(assets / filename) as font:
            cmap = verify(font, expected, weight)
            if fingerprint(font, cmap, expected) != report['fonts'][filename]['outlineAndMetricsSha256']:
                raise ValueError(f'{filename}: outlines or metrics changed')
    print(json.dumps({'fontsChecked': 4, 'retainedCodepoints': len(expected), 'sourceFiles': request['sourceFiles'], 'uiCodepoints': len(ui), 'newMissingUiCodepoints': 0, 'originalMissingUiCodepoints': sorted(ui & previous_fallback)}, ensure_ascii=False))
else:
    source_dir = Path(sys.argv[2]).resolve()
    fonts = {style: TTFont(source_dir / f'Pretendard-{style}.otf') for style in weights}
    cmaps = {style: font.getBestCmap() for style, font in fonts.items()}
    if any(set(cmap) != set(cmaps['Regular']) for cmap in cmaps.values()):
        raise ValueError('원본 네 벌의 문자 지원 범위가 다릅니다')
    original = set(cmaps['Regular'])
    if sum(hangul(u) for u in original) != 11172:
        raise ValueError('이미 subset된 파일이 아닌 원본 정적 OTF 네 벌을 지정하세요')
    non_hangul = {u for u in original if not hangul(u)}
    expected = non_hangul | (common & original) | (ui & original)
    original_missing = ui - original
    baseline = {style: fingerprint(font, cmaps[style], expected) for style, font in fonts.items()}
    output = {}
    for style, weight in weights.items():
        font = fonts[style]
        filename = f'Pretendard-{style}.otf'
        options = subset.Options()
        options.layout_features = ['*']  # tnum·분수·자모 조합 등 기존 OpenType 동작 보존
        options.name_IDs = ['*']
        options.name_languages = ['*']
        options.name_legacy = True
        options.recalc_timestamp = False
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(unicodes=sorted(expected))
        subsetter.subset(font)
        # OFL Reserved Font Name: 파생 바이너리의 내부 이름만 변경. Expo 로딩 별칭/파일은 유지.
        for record in font['name'].names:
            if record.nameID in (1, 2, 3, 4, 6, 16, 17, 18, 21, 22, 25):
                text = record.toUnicode().replace('Pretendard', 'NodiiUISubset')
                record.string = text.encode(record.getEncoding())
        if 'CFF ' in font:
            font['CFF '].cff.fontNames = [f'NodiiUISubset-{style}']
            top = font['CFF '].cff.topDictIndex[0]
            top.FamilyName = 'NodiiUISubset'
            top.FullName = f'NodiiUISubset {style}'
        # 파일로 다시 읽어 직렬화 결과 자체를 검사한 뒤에만 앱 자산을 교체한다.
        target = assets / f'{filename}.subset-tmp'
        font.save(target)
        with TTFont(target) as saved:
            cmap = verify(saved, expected, weight)
            digest = fingerprint(saved, cmap, expected)
            if digest != baseline[style]:
                raise ValueError(f'{filename}: 원본 윤곽/advance width 변경')
        output[filename] = {'beforeBytes': (source_dir / filename).stat().st_size, 'afterBytes': target.stat().st_size, 'sourceSha256': hashlib.sha256((source_dir / filename).read_bytes()).hexdigest(), 'weight': weight, 'outlineAndMetricsSha256': digest}
    for style in weights:
        filename = f'Pretendard-{style}.otf'
        (assets / f'{filename}.subset-tmp').replace(assets / filename)
    report = {'fontToolsVersion': fonttools_version, 'commonSource': 'https://github.com/orioncactus/pretendard/blob/v1.3.9/packages/pretendard/subset_glyphs.txt', 'commonHangulCount': sum(hangul(u) for u in common), 'retainedHangulCount': sum(hangul(u) for u in expected), 'retainedNonHangulCount': len(non_hangul), 'sourceFiles': request['sourceFiles'], 'uiCodepointCount': len(ui), 'originalMissingUiCodepoints': sorted(original_missing), 'retainedCodepoints': sorted(expected), 'fonts': output}
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k not in ('retainedCodepoints',)}, ensure_ascii=False, indent=2))
