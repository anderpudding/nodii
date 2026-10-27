import { expect, it } from 'vitest';
import { summarizeMonth, type DayRangeInput } from '@nodii/core';
import { completedStampColors } from './stamp-colors';

it('완료 항목의 목표 정렬 순서만 쓰고 건너뛴 루틴과 미완료 날은 제외한다', () => {
  const input: DayRangeInput = {
    from: '2026-09-17',
    to: '2026-09-18',
    timeZone: 'UTC',
    goals: [
      { id: 'blue', name: '할 일', color: '#4F7CFF', sortKey: 'a1', archivedAt: null },
      { id: 'green', name: '운동', color: '#12A66A', sortKey: 'a0', archivedAt: null },
      { id: 'purple', name: '공부', color: '#9B5CFF', sortKey: 'a2', archivedAt: null },
    ],
    todos: [
      { id: 'b', goalId: 'blue', title: '장보기', date: '2026-09-17', isDone: true, sortKey: 'a0' },
      { id: 'g', goalId: 'green', title: '러닝', date: '2026-09-17', isDone: true, sortKey: 'a0' },
      {
        id: 'next',
        goalId: 'blue',
        title: '내일 할 일',
        date: '2026-09-18',
        isDone: false,
        sortKey: 'a0',
      },
    ],
    routines: [
      {
        id: 'r',
        goalId: 'purple',
        title: '단어',
        freq: 'daily',
        repeatEvery: 1,
        byWeekday: null,
        byMonthday: null,
        startDate: '2026-09-17',
        endDate: null,
        sortKey: 'a0',
      },
    ],
    logs: [{ routineId: 'r', date: '2026-09-17', status: 'skipped' }],
  };
  const summary = summarizeMonth(input);
  const result = completedStampColors(input, summary);
  expect(result.get('2026-09-17')).toEqual(['#12A66A', '#4F7CFF']);
  expect(result.has('2026-09-18')).toBe(false);
});
