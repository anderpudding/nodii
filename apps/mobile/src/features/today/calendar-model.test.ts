import { expect, it } from 'vitest';
import { monthGridRange } from '@nodii/core';
import { formatMoveDate, mobileMonthWeeks, quickDates } from './calendar-model';
import { weekRange, weekSummary } from './model';

it.each([
  ['2026-02', 0, 4, '2026-02-01', '2026-02-28', 28],
  ['2026-02', 1, 5, '2026-01-26', '2026-03-01', 28],
  ['2027-02', 1, 4, '2027-02-01', '2027-02-28', 28],
  ['2026-09', 0, 5, '2026-08-30', '2026-10-03', 30],
  ['2026-09', 1, 5, '2026-08-31', '2026-10-04', 30],
  ['2026-08', 0, 6, '2026-07-26', '2026-09-05', 31],
  ['2026-03', 0, 5, '2026-03-01', '2026-04-04', 31],
  ['2026-03', 1, 6, '2026-02-23', '2026-04-05', 31],
  ['2024-02', 0, 5, '2024-01-28', '2024-03-02', 29],
  ['2025-12', 0, 5, '2025-11-30', '2026-01-03', 31],
] as const)(
  '%s·주 시작 %s는 필요한 %s주만 표시하고 월의 모든 날짜를 포함한다',
  (month, weekStart, count, from, to, monthDays) => {
    const weeks = mobileMonthWeeks(month, weekStart);
    const dates = weeks.flat();
    expect(weeks).toHaveLength(count);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(dates[0]).toBe(from);
    expect(dates.at(-1)).toBe(to);
    expect(dates.filter((date) => date.startsWith(`${month}-`))).toHaveLength(monthDays);
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates).toEqual(monthGridRange(month, weekStart).days.slice(0, count * 7));
  },
);

it('오늘·내일·다음 주를 연도 경계와 DST와 무관하게 계산한다', () => {
  expect(quickDates('2026-12-31')).toEqual(['2026-12-31', '2027-01-01', '2027-01-07']);
  expect(quickDates('2025-03-08')).toEqual(['2025-03-08', '2025-03-09', '2025-03-15']);
  expect(formatMoveDate('2026-09-20')).toBe('9월 20일');
});
it.each([0, 1] as const)(
  '42칸의 같은 날짜는 주간 스트립과 같은 집계다 (주 시작 %s)',
  (weekStart) => {
    const month = monthGridRange('2026-10', weekStart);
    const week = weekRange('2026-10-01', weekStart);
    const goals = [{ id: 'g', name: '할 일', color: '#4F7CFF', sortKey: 'a0', archivedAt: null }];
    const todos = [false, true].map((isDone, i) => ({
      id: String(i),
      title: '할 일',
      goalId: 'g',
      date: '2026-10-01',
      sortKey: `a${i}`,
      isDone,
      doneAt: null,
      deletedAt: null,
      updatedAt: '',
    }));
    const monthly = weekSummary(goals, todos, month.from, month.to, 'UTC');
    const weekly = weekSummary(goals, todos, week.from, week.to, 'UTC');
    expect(month.from).toBe(week.from);
    for (const date of week.dates) expect(monthly.get(date)).toEqual(weekly.get(date));
    expect(monthly.get('2026-10-01')).toEqual({ total: 2, remaining: 1 });
  },
);
