import { expect, it } from 'vitest';
import { monthGridRange } from '@nodii/core';
import { formatMoveDate, quickDates } from './calendar-model';
import { weekRange, weekSummary } from './model';

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
