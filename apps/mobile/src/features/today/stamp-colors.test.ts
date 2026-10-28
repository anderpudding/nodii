import { expect, it } from 'vitest';
import { summarizeMonth, type DayRangeInput } from '@nodii/core';
import { completedStampColors } from './stamp-colors';

function stampInput(): DayRangeInput {
  return {
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
}

it('완료 항목의 목표 정렬 순서만 쓰고 건너뛴 루틴과 완료 없는 날은 제외한다', () => {
  const input = stampInput();
  const summary = summarizeMonth(input);
  const result = completedStampColors(input, summary);
  expect(result.get('2026-09-17')).toEqual(['#12A66A', '#4F7CFF']);
  expect(result.has('2026-09-18')).toBe(false);
});

it('일부 끝낸 날은 완료한 할 일의 목표 색만 모은다', () => {
  const input = stampInput();
  input.todos = input.todos.map((todo) => (todo.id === 'g' ? { ...todo, isDone: false } : todo));
  const summary = summarizeMonth(input);
  expect(summary.get('2026-09-17')).toEqual({ total: 2, remaining: 1 });
  expect(completedStampColors(input, summary).get('2026-09-17')).toEqual(['#4F7CFF']);
});

it('할 일이 남아 있어도 완료한 루틴의 목표 색을 모은다', () => {
  const input = stampInput();
  input.logs = [...input.logs, { routineId: 'r', date: '2026-09-18', status: 'done' }];
  const summary = summarizeMonth(input);
  expect(summary.get('2026-09-18')).toEqual({ total: 2, remaining: 1 });
  expect(completedStampColors(input, summary).get('2026-09-18')).toEqual(['#9B5CFF']);
});

it('완료가 없거나 건너뛰기만 있으면 색 맵에 넣지 않는다', () => {
  const input = stampInput();
  input.todos = input.todos.map((todo) => ({ ...todo, isDone: false }));
  expect(completedStampColors(input, summarizeMonth(input)).size).toBe(0);
  input.todos = [];
  input.logs = [
    { routineId: 'r', date: '2026-09-17', status: 'skipped' },
    { routineId: 'r', date: '2026-09-18', status: 'skipped' },
  ];
  expect(completedStampColors(input, summarizeMonth(input)).size).toBe(0);
});

it('집계에만 날짜가 있어도 빈 목표 색 배열은 넣지 않는다', () => {
  const input = { ...stampInput(), todos: [], routines: [] };
  expect(
    completedStampColors(input, new Map([['2026-09-17', { total: 1, remaining: 0 }]])).size,
  ).toBe(0);
});
