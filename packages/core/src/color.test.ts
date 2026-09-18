import { describe, expect, it } from 'vitest';
import { checkColor, goalInk, goalTint } from './color';

const colors = [
  '#F0715A',
  '#F59E3B',
  '#E9C23A',
  '#8CC152',
  '#3FB28A',
  '#33A9B8',
  '#4F7CFF',
  '#6C6FE0',
  '#A06CD5',
  '#E86BA6',
  '#8E8B84',
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
      ['#FFFFFF', false],
      ['#131417', true],
    ] as const) {
      expect(
        contrast(goalInk(color, bg, dark), goalTint(color, bg, dark ? 0.22 : 0.14)),
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(checkColor(color), color)).toBeGreaterThanOrEqual(3);
  });
  it('sRGB 채널을 지정한 비율로 섞고 경계값을 유지한다', () => {
    expect(goalTint('#000000', '#FFFFFF', 0.14)).toBe('#DBDBDB');
    expect(goalTint('#123456', '#FFFFFF', 0)).toBe('#FFFFFF');
    expect(goalTint('#123456', '#FFFFFF', 1)).toBe('#123456');
    expect(goalInk('#000000', '#FFFFFF', false)).toBe('#000000');
    expect(checkColor('#000000')).toBe('#FFFFFF');
    expect(checkColor('#FFFFFF')).toBe('#16181D');
  });
  it('잘못된 색과 비율을 거부한다', () => {
    expect(() => goalTint('red', '#FFFFFF', 0.14)).toThrow();
    for (const ratio of [-1, 2, NaN]) expect(() => goalTint('#000000', '#FFFFFF', ratio)).toThrow();
  });
});
