import { expect, it } from 'vitest';
import { monthGridRange, monthKeysContaining, type Goal } from '@nodii/core';
import type { TodoRecord } from '@nodii/api';
import {
  daySections,
  mergeWeekTodos,
  newTodo,
  preferredGoal,
  submissionTitle,
  weekRange,
  weekSummary,
} from './model';
const goals: Goal[] = [
  { id: 'active', name: '공부', color: '#4F7CFF', sortKey: 'a0', archivedAt: null },
  {
    id: 'archived',
    name: '보관',
    color: '#F0715A',
    sortKey: 'a1',
    archivedAt: '2026-09-01T00:00:00Z',
  },
  {
    id: 'empty-archive',
    name: '빈 보관',
    color: '#33A9B8',
    sortKey: 'a2',
    archivedAt: '2026-09-01T00:00:00Z',
  },
];
function row(id: string, date = '2026-10-01', goalId = 'active', sortKey = 'a0'): TodoRecord {
  return {
    id,
    date,
    goalId,
    sortKey,
    title: id,
    isDone: false,
    doneAt: null,
    deletedAt: null,
    updatedAt: '',
  };
}
it('보관 목표는 항목이 있을 때만 남기고 화면에 표시되는 항목만 센다', () => {
  const sections = daySections(
    goals,
    [
      row('second', undefined, undefined, 'a1'),
      row('first'),
      row('archive', undefined, 'archived'),
      row('deleted-goal', undefined, 'missing'),
      row('other-date', '2026-10-02'),
    ],
    '2026-10-01',
    'America/Vancouver',
  );
  expect(
    sections.map((section) => [section.key, section.canAdd, section.data.map((todo) => todo.id)]),
  ).toEqual([
    ['active', true, ['first', 'second']],
    ['archived', false, ['archive']],
  ]);
});
it('일요일과 월요일 시작 주가 연도·달 경계를 넘어도 7칸을 유지한다', () => {
  expect(weekRange('2026-01-01', 0)).toMatchObject({ from: '2025-12-28', to: '2026-01-03' });
  expect(weekRange('2026-01-01', 1)).toMatchObject({ from: '2025-12-29', to: '2026-01-04' });
  expect(weekRange('2026-01-01', 1).dates).toHaveLength(7);
});
it('두 달의 42칸 범위에 겹치는 행을 중복 집계하지 않는다', () => {
  const { from, to } = weekRange('2026-10-01', 0);
  const first = row('september', '2026-09-30');
  const second = row('october');
  const merged = mergeWeekTodos(from, to, [first, second], [first, { ...second, isDone: true }]);
  expect(merged).toHaveLength(2);
  const summary = weekSummary(goals, merged, from, to, 'UTC');
  expect(summary.get('2026-09-30')).toEqual({ total: 1, remaining: 1 });
  expect(summary.get('2026-10-01')).toEqual({ total: 1, remaining: 0 });
  expect(monthKeysContaining('2026-10-01', 0)).toContain('2026-09');
  expect(monthGridRange('2026-09', 0).to >= '2026-10-01').toBe(true);
});
it('같은 달 주는 마지막 캐시를 다시 합치지 않는다', () => {
  expect(mergeWeekTodos('2026-10-04', '2026-10-10', [row('one')], [row('one')])).toHaveLength(1);
});
it('정렬 키는 같은 목표·날짜 맨 아래이며 연속 입력은 모두 다른 키다', () => {
  const rows = [
    row('previous'),
    row('other-goal', undefined, 'archived', 'a9'),
    row('other-date', '2026-10-02', undefined, 'a8'),
  ];
  const first = newTodo('1', 'active', '2026-10-01', ' 장보기 ', rows)!;
  const second = newTodo('2', 'active', '2026-10-01', 'OS 과제', [...rows, first])!;
  const third = newTodo('3', 'active', '2026-10-01', '영어', [...rows, first, second])!;
  expect(first.title).toBe('장보기');
  expect(first.sortKey).toBe('a1');
  expect(first.sortKey < second.sortKey && second.sortKey < third.sortKey).toBe(true);
});
it('빈 제목·200자 초과·IME 확인 Enter는 제출하지 않는다', () => {
  expect(newTodo('1', 'active', '2026-10-01', '  ', [])).toBeNull();
  expect(submissionTitle('가'.repeat(201))).toBeNull();
  expect(submissionTitle('가'.repeat(200))).toHaveLength(200);
  expect(submissionTitle('장보기', { isComposing: true })).toBeNull();
  expect(submissionTitle('장보기', { keyCode: 229 })).toBeNull();
  expect(submissionTitle(' 장보기 ', { isComposing: false })).toBe('장보기');
});
it('직전 추가 목표를 쓰되 보관되면 첫 활성 목표로 돌아간다', () => {
  expect(preferredGoal(goals, 'archived')?.id).toBe('active');
  expect(preferredGoal([...goals, { ...goals[0]!, id: 'last' }], 'last')?.id).toBe('last');
});

it('루틴 전개·건너뛰기·보관일은 core 규칙을 사용하고 할 일과 같은 순서로 집계한다', () => {
  const routine = {
    id: 'r',
    goalId: 'active',
    title: '운동',
    freq: 'daily' as const,
    repeatEvery: 1,
    byWeekday: null,
    byMonthday: null,
    startDate: '2026-08-01',
    endDate: null,
    sortKey: 'a0',
    deletedAt: null,
    updatedAt: '',
  };
  const archived = { ...routine, id: 'archived-r', goalId: 'archived' };
  const todos = [row('todo')];
  expect(
    daySections(goals, todos, '2026-10-01', 'UTC', [routine, archived], [])[0]?.data.map(
      ({ kind }) => kind,
    ),
  ).toEqual(['todo', 'routine']);
  const logs = [{ routineId: 'r', date: '2026-10-01', status: 'done' as const }];
  expect(
    weekSummary(goals, todos, '2026-10-01', '2026-10-01', 'UTC', [routine, archived], logs).get(
      '2026-10-01',
    ),
  ).toEqual({ total: 2, remaining: 1 });
  expect(
    daySections(goals, [], '2026-10-01', 'UTC', [routine], [{ ...logs[0]!, status: 'skipped' }])[0]
      ?.data,
  ).toEqual([]);
  expect(
    daySections(goals, [], '2026-09-01', 'UTC', [archived], []).find(
      ({ key }) => key === 'archived',
    )?.data,
  ).toHaveLength(1);
  expect(
    daySections(goals, [], '2026-09-02', 'UTC', [archived], []).find(
      ({ key }) => key === 'archived',
    ),
  ).toBeUndefined();
});
it('월 경계 로그도 날짜가 속한 캐시를 택해 한 번만 읽는다', () => {
  const old = { routineId: 'r', date: '2026-09-30', status: 'done' as const };
  const next = { routineId: 'r', date: '2026-10-01', status: 'skipped' as const };
  expect(mergeWeekTodos('2026-09-27', '2026-10-03', [old, next], [old, next])).toEqual([old, next]);
});
