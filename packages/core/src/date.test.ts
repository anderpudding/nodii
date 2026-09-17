import { describe, expect, it } from 'vitest';
import {
  addDays,
  assertISODate,
  daysBetween,
  daysInMonth,
  fromEpochDay,
  isISODate,
  isLastDayOfMonth,
  isoDateInZone,
  monthGridRange,
  monthKeyOf,
  monthKeysContaining,
  monthsBetween,
  startOfWeek,
  todayISO,
  toEpochDay,
  weekdayOf,
} from './date';

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
    ['뒤에 줄바꿈', '2026-09-16\n'],
    ['빈 문자열', ''],
  ])('유효하지 않음: %s', (_label, value) => {
    expect(isISODate(value)).toBe(false);
  });
});

describe('UTC 달력 계산 (NFR-08)', () => {
  it.each(['0000-02-29', '0096-02-29', '1970-01-01', '1969-12-31', '2028-02-29', '9999-12-31'])(
    '왕복: %s',
    (date) => {
      expect(fromEpochDay(toEpochDay(date))).toBe(date);
    },
  );
  it('epoch 기준과 음수 날짜를 지원한다', () => {
    expect(toEpochDay('1970-01-01')).toBe(0);
    expect(toEpochDay('1969-12-31')).toBe(-1);
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2026-01-02', '2026-01-01')).toBe(-1);
  });
  it.each([
    [2028, 2, 29],
    [2100, 2, 28],
    [2000, 2, 29],
    [2026, 4, 30],
    [2026, 1, 31],
    [0, 2, 29],
  ])('월 길이 %i/%i', (year, month, expected) => {
    expect(daysInMonth(year, month)).toBe(expected);
  });
  it('말일, 요일, 월 차이는 달력 기준이다', () => {
    expect(isLastDayOfMonth('2026-04-30')).toBe(true);
    expect(isLastDayOfMonth('2026-04-29')).toBe(false);
    expect(weekdayOf('1970-01-01')).toBe(4);
    expect(weekdayOf('1969-12-28')).toBe(0);
    expect(startOfWeek('2026-03-08', 0)).toBe('2026-03-08');
    expect(startOfWeek('2026-03-08', 1)).toBe('2026-03-02');
    expect(monthsBetween('2025-12-31', '2026-02-01')).toBe(2);
    expect(monthsBetween('2026-02-01', '2025-12-31')).toBe(-2);
    expect(monthKeyOf('2026-02-28')).toBe('2026-02');
  });
  it.each(['2026-03-08', '2026-11-01'])('DST 전환 전후도 하루: %s', (date) => {
    expect(daysBetween(addDays(date, -1), addDays(date, 1))).toBe(2);
    expect(addDays(addDays(date, -1), 1)).toBe(date);
  });
  it('잘못된 입력과 네 자리 연도 밖의 계산을 거부한다', () => {
    expect(() => toEpochDay('2026-02-30')).toThrow(RangeError);
    for (const n of [NaN, Infinity, 1.5, -10000000, 10000000])
      expect(() => fromEpochDay(n)).toThrow(RangeError);
    expect(() => addDays('2026-01-01', 0.5)).toThrow(RangeError);
    for (const [year, month] of [
      [2026, 0],
      [2026, 13],
      [2026, 1.5],
      [-1, 1],
      [10000, 1],
      [NaN, 1],
    ]) {
      expect(() => daysInMonth(year!, month!)).toThrow(RangeError);
    }
  });
});

describe('42칸 월 그리드 (CAL-05)', () => {
  it.each([
    [0, '2026-03-01', '2026-04-11'],
    [1, '2026-02-23', '2026-04-05'],
  ] as const)('주 시작 %i', (weekStart, from, to) => {
    const grid = monthGridRange('2026-03', weekStart);
    expect(grid.from).toBe(from);
    expect(grid.to).toBe(to);
    expect(grid.days).toHaveLength(42);
    expect(grid.days).toEqual(Array.from({ length: 42 }, (_, i) => addDays(from, i)));
  });
  it('연도 경계를 넘긴다', () => {
    expect(monthGridRange('2026-01', 0).from).toBe('2025-12-28');
    expect(monthGridRange('2026-12', 0).to).toBe('2027-01-09');
    expect(() => monthGridRange('2026-1', 0)).toThrow(RangeError);
  });
  it('인접한 월 캐시를 빠뜨리지 않고 반환한다', () => {
    expect(monthKeysContaining('2026-03-01', 0)).toEqual(['2026-02', '2026-03']);
    expect(monthKeysContaining('2026-03-01', 1)).toEqual(['2026-02', '2026-03']);
    expect(monthKeysContaining('2026-03-31', 0)).toEqual(['2026-03', '2026-04']);
    expect(monthKeysContaining('2021-03-01', 0)).toEqual(['2021-02', '2021-03']);
    expect(monthKeysContaining('2026-01-01', 0)).toEqual(['2025-12', '2026-01']);
    expect(monthKeysContaining('2026-12-31', 1)).toEqual(['2026-12', '2027-01']);
    expect(monthKeysContaining('2026-03-15', 0)).toEqual(['2026-03']);
  });
});

describe('시간대 변환 (NFR-08)', () => {
  it.each([
    ['2026-03-08T07:30:00Z', '2026-03-07'],
    ['2026-03-08T09:30:00Z', '2026-03-08'],
    ['2026-03-08T10:30:00Z', '2026-03-08'],
    ['2026-11-01T06:30:00Z', '2026-10-31'],
    ['2026-11-01T08:30:00Z', '2026-11-01'],
    ['2026-11-01T09:30:00Z', '2026-11-01'],
  ])('밴쿠버 %s → %s', (instant, expected) => {
    expect(todayISO('America/Vancouver', new Date(instant))).toBe(expected);
    expect(isoDateInZone(instant, 'America/Vancouver')).toBe(expected);
  });
  it('동일 시각도 시간대에 따라 날짜가 다르다', () => {
    const now = new Date('2026-03-08T07:30:00Z');
    expect(todayISO('Asia/Seoul', now)).toBe('2026-03-08');
    expect(todayISO('America/Vancouver', now)).toBe('2026-03-07');
    expect(isoDateInZone(now, 'UTC')).toBe('2026-03-08');
    expect(isoDateInZone('2026-03-08T00:30:00-08:00', 'UTC')).toBe('2026-03-08');
  });
  it('유효하지 않은 시각과 시간대를 거부한다', () => {
    expect(() => isoDateInZone('invalid', 'UTC')).toThrow(RangeError);
    expect(() => todayISO('invalid', new Date(0))).toThrow(RangeError);
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
