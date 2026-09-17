import { describe, expect, it } from 'vitest';
import { assertISODate, isISODate } from './date';

describe('isISODate', () => {
  it.each(['2026-09-16', '2024-02-29', '2026-12-31', '2026-01-01'])('유효한 날짜: %s', (value) => {
    expect(isISODate(value)).toBe(true);
  });

  it.each([
    ['평년 2월 29일', '2026-02-29'],
    ['30일까지 있는 달의 31일', '2026-09-31'],
    ['13월', '2026-13-01'],
    ['0월', '2026-00-10'],
    ['0일', '2026-09-00'],
    ['자릿수 부족', '2026-9-16'],
    ['시각 포함', '2026-09-16T00:00:00Z'],
    ['빈 문자열', ''],
  ])('유효하지 않음: %s', (_label, value) => {
    expect(isISODate(value)).toBe(false);
  });
});

describe('assertISODate', () => {
  it('유효하면 그대로 돌려준다', () => {
    expect(assertISODate('2026-09-16')).toBe('2026-09-16');
  });

  it('유효하지 않으면 RangeError', () => {
    expect(() => assertISODate('2026-02-30')).toThrow(RangeError);
  });
});
