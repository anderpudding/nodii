import { describe, expect, it } from 'vitest';
import { TITLE_MAX_LENGTH } from './constants';
import { isHexColor, normalizeHexColor, normalizeTitle } from './validation';

describe('제목 검증 (TODO-01)', () => {
  it('양끝 공백을 없애고 1~200자를 허용한다', () => {
    expect(normalizeTitle('  할 일 \n')).toBe('할 일');
    expect(normalizeTitle('가')).toBe('가');
    expect(normalizeTitle('가'.repeat(TITLE_MAX_LENGTH))).toBe('가'.repeat(TITLE_MAX_LENGTH));
    expect(normalizeTitle('가'.repeat(TITLE_MAX_LENGTH + 1))).toBeNull();
    expect(normalizeTitle(' \n\t ')).toBeNull();
  });
});

describe('HEX 색상 검증 (GOAL-03)', () => {
  it.each(['#123456', '#aBcDeF', '#000000'])('유효한 색 %s', (value) => {
    expect(isHexColor(value)).toBe(true);
    expect(normalizeHexColor(value)).toBe(value.toUpperCase());
  });
  it.each(['', '#abc', '#12345678', '123456', '#gggggg', ' #123456', '#123456\n'])(
    '잘못된 색 %s',
    (value) => {
      expect(isHexColor(value)).toBe(false);
      expect(normalizeHexColor(value)).toBeNull();
    },
  );
});
