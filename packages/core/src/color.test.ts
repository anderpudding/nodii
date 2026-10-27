import { describe, expect, it } from 'vitest';
import { checkColor, goalInk, goalTint, stampFill } from './color';

const colors = [
  '#F2553F',
  '#E67300',
  '#FFC329',
  '#8BD444',
  '#12A66A',
  '#0FA3B1',
  '#4F7CFF',
  '#5B5CF6',
  '#9B5CFF',
  '#FF3D8B',
  '#8A8F99',
  '#FFFFFF',
  '#000000',
];
function luminance(hex: string) {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
function contrast(a: string, b: string) {
  return (
    (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
  );
}
describe('목표 색 대비 (GOAL-03)', () => {
  it.each(colors)('%s 이름표는 두 테마에서 4.5:1, 체크는 3:1', (color) => {
    for (const [bg, dark] of [
      ['#F2F3F6', false],
      ['#1E2026', true],
    ] as const) {
      expect(contrast(goalInk(color, bg, dark), bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(checkColor(color), color)).toBeGreaterThanOrEqual(3);
  });
  it('sRGB 채널을 지정한 비율로 섞고 경계값을 유지한다', () => {
    expect(goalTint('#000000', '#FFFFFF', 0.14)).toBe('#DBDBDB');
    expect(goalTint('#123456', '#FFFFFF', 0)).toBe('#FFFFFF');
    expect(goalTint('#123456', '#FFFFFF', 1)).toBe('#123456');
    expect(goalInk('#000000', '#FFFFFF', false)).toBe('#000000');
    expect(checkColor('#000000')).toBe('#FFFFFF');
    expect(checkColor('#FFFFFF')).toBe('#111318');
  });
  it('잘못된 색과 비율을 거부한다', () => {
    expect(() => goalTint('red', '#FFFFFF', 0.14)).toThrow();
    for (const ratio of [-1, 2, NaN]) expect(() => goalTint('#000000', '#FFFFFF', ratio)).toThrow();
  });
});

// CAL-02: 완료 도장은 목표 정렬 순서를 유지한 최대 네 색으로 나눈다.
describe('stampFill', () => {
  const palette = ['#F2553F', '#FFC329', '#12A66A', '#4F7CFF', '#9B5CFF'];
  it('한 색은 그대로 반환하고 빈 배열은 거부한다', () => {
    expect(stampFill([palette[0]!])).toBe(palette[0]);
    expect(() => stampFill([])).toThrow(RangeError);
  });
  it.each([2, 3, 4, 5])('%i색을 같은 너비의 하드 스톱으로 나눈다', (count) => {
    const selected = palette.slice(0, Math.min(count, 4));
    expect(stampFill(palette.slice(0, count))).toBe(
      `linear-gradient(135deg, ${selected.map((color, i) => `${color} ${(i * 100) / selected.length}% ${((i + 1) * 100) / selected.length}%`).join(', ')})`,
    );
  });
  it('중복을 빼고 처음 나타난 순서를 유지한다', () => {
    expect(stampFill(['#4F7CFF', '#4F7CFF', '#F2553F', '#4F7CFF'])).toBe(
      'linear-gradient(135deg, #4F7CFF 0% 50%, #F2553F 50% 100%)',
    );
  });
});
