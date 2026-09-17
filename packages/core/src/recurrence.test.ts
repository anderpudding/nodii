import { describe, expect, it } from 'vitest';
import { monthGridRange } from './date';
import { nextOccurrences, occursOn } from './recurrence';
import type { Routine } from './types';

const base: Routine = {
  id: 'r',
  goalId: 'g',
  title: '운동',
  freq: 'daily',
  repeatEvery: 1,
  byWeekday: null,
  byMonthday: null,
  startDate: '2026-01-01',
  endDate: null,
  sortKey: 'a0',
};

describe('occursOn (ROUT-02~04)', () => {
  it('매 3일, 시작 전 제외, 종료일 포함', () => {
    const rule = { ...base, repeatEvery: 3, endDate: '2026-01-07' };
    for (const date of ['2026-01-01', '2026-01-04', '2026-01-07'])
      expect(occursOn(rule, date)).toBe(true);
    for (const date of ['2025-12-29', '2026-01-02', '2026-01-08', '2026-01-10'])
      expect(occursOn(rule, date)).toBe(false);
  });
  it('매 2주 월·수·금은 일요일 기준이며 시작 전 요일을 제외한다 (I1)', () => {
    const rule = {
      ...base,
      freq: 'weekly' as const,
      repeatEvery: 2,
      byWeekday: [1, 3, 5],
      startDate: '2026-03-04',
    };
    for (const date of ['2026-03-04', '2026-03-06', '2026-03-16', '2026-03-18', '2026-03-20'])
      expect(occursOn(rule, date)).toBe(true);
    for (const date of ['2026-03-02', '2026-03-05', '2026-03-09', '2026-03-13'])
      expect(occursOn(rule, date)).toBe(false);
    for (const weekStart of [0, 1] as const) {
      expect(
        monthGridRange('2026-03', weekStart).days.filter(
          (date) => occursOn(rule, date) && date <= '2026-03-20',
        ),
      ).toEqual(['2026-03-04', '2026-03-06', '2026-03-16', '2026-03-18', '2026-03-20']);
    }
    const sunday = { ...rule, startDate: '2026-03-07', byWeekday: [0] };
    expect(occursOn(sunday, '2026-03-08')).toBe(false);
    expect(occursOn(sunday, '2026-03-15')).toBe(true);
  });
  it.each([29, 30, 31])('매월 %i일의 2월 말일 대체', (day) => {
    const rule = { ...base, freq: 'monthly' as const, byMonthday: [day] };
    expect(occursOn(rule, '2026-02-28')).toBe(true);
    expect(occursOn(rule, '2026-02-27')).toBe(false);
    expect(occursOn(rule, '2028-02-29')).toBe(true);
    expect(occursOn(rule, '2028-02-28')).toBe(false);
  });
  it('31일과 중복 말일 규칙은 하루에 한 번만 표시한다', () => {
    const rule = { ...base, freq: 'monthly' as const, byMonthday: [31] };
    expect(occursOn(rule, '2026-04-30')).toBe(true);
    expect(occursOn(rule, '2026-04-29')).toBe(false);
    expect(nextOccurrences({ ...rule, byMonthday: [30, 31] }, '2026-04-01', 2)).toEqual([
      '2026-04-30',
      '2026-05-30',
    ]);
  });
  it('시작일 31일에서 매 2개월, 매 12개월 윤년 경계를 처리한다', () => {
    const rule = {
      ...base,
      freq: 'monthly' as const,
      startDate: '2026-01-31',
      byMonthday: [31],
      repeatEvery: 2,
    };
    expect(nextOccurrences(rule, '2026-01-01', 5)).toEqual([
      '2026-01-31',
      '2026-03-31',
      '2026-05-31',
      '2026-07-31',
      '2026-09-30',
    ]);
    const annual = { ...rule, startDate: '2024-02-29', repeatEvery: 12, byMonthday: [29] };
    expect(occursOn(annual, '2025-02-28')).toBe(true);
    expect(occursOn(annual, '2028-02-29')).toBe(true);
    expect(occursOn(annual, '2028-02-28')).toBe(false);
  });
  it('선택 요일·날짜가 없으면 발생하지 않는다', () => {
    expect(occursOn({ ...base, freq: 'weekly' }, base.startDate)).toBe(false);
    expect(occursOn({ ...base, freq: 'monthly' }, base.startDate)).toBe(false);
  });
});

describe('nextOccurrences', () => {
  it('from 당일 포함, 종료일 이후는 반환하지 않는다', () => {
    expect(nextOccurrences({ ...base, endDate: '2026-01-03' }, '2026-01-02', 5)).toEqual([
      '2026-01-02',
      '2026-01-03',
    ]);
    expect(nextOccurrences(base, '2026-01-01', 0)).toEqual([]);
    expect(nextOccurrences({ ...base, endDate: '2026-01-03' }, '2026-01-04', 5)).toEqual([]);
  });
  it('일치가 없거나 시작일이 멀어도 검색 상한에서 멈춘다', () => {
    expect(nextOccurrences({ ...base, freq: 'weekly', byWeekday: [] }, '2026-01-01', 5)).toEqual(
      [],
    );
    expect(nextOccurrences({ ...base, startDate: '2030-01-01' }, '2026-01-01', 5)).toEqual([]);
    expect(nextOccurrences(base, '2026-01-01', 2000)).toHaveLength(366 * 3);
  });
  it.each([-1, 0.5, NaN, Infinity])('잘못된 개수 %s를 거부한다', (count) => {
    expect(() => nextOccurrences(base, base.startDate, count)).toThrow(RangeError);
  });
});
