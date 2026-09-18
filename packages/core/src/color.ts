import { isHexColor } from './validation';

const INK = '#16181D';
const WHITE = '#FFFFFF';
function channels(hex: string): number[] {
  if (!isHexColor(hex)) throw new RangeError('Invalid hex color');
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
function mix(color: string, background: string, ratio: number): string {
  const bg = channels(background);
  return (
    '#' +
    channels(color)
      .map((c, i) =>
        Math.round(c * ratio + bg[i]! * (1 - ratio))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  );
}
function luminance(color: string): number {
  const [r, g, b] = channels(color)
    .map((c) => c / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return r! * 0.2126 + g! * 0.7152 + b! * 0.0722;
}
function contrast(a: string, b: string): number {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** 이름표 바탕에 목표 색을 지정 비율로 섞는다 (DESIGN §4). */
export function goalTint(goalColor: string, bg: string, ratio: number): string {
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) throw new RangeError('Invalid tint ratio');
  return mix(goalColor, bg, ratio);
}
/** 5%씩 잉크 쪽으로 섞어 이름표의 4.5:1 대비를 보장한다 (GOAL-03). */
export function goalInk(goalColor: string, bg: string, isDark: boolean): string {
  const tint = goalTint(goalColor, bg, isDark ? 0.22 : 0.14);
  const ink = isDark ? WHITE : INK;
  for (let step = 0; step <= 20; step++) {
    const color = mix(ink, goalColor, step / 20);
    if (contrast(color, tint) >= 4.5) return color;
  }
  return ink;
}
/** 목표색 위 체크가 3:1 이상이 되도록 흰색 또는 잉크를 고른다 (GOAL-03). */
export function checkColor(goalColor: string): string {
  return contrast(WHITE, goalColor) >= 3 ? WHITE : INK;
}
