import { describe, expect, it } from 'vitest';
import { buildDay, expandRoutines, summarizeMonth } from './day';
import type { DayItem, Goal, Routine, Todo } from './types';

const goal: Goal = { id: 'g', name: '일상', color: '#FFFFFF', sortKey: 'a0', archivedAt: null };
const routine: Routine = {
  id: 'r',
  goalId: 'g',
  title: '운동',
  freq: 'daily',
  repeatEvery: 1,
  byWeekday: null,
  byMonthday: null,
  startDate: '2026-03-01',
  endDate: null,
  sortKey: 'a1',
};
const todo: Todo = {
  id: 't',
  goalId: 'g',
  title: '공부',
  date: '2026-03-08',
  isDone: false,
  sortKey: 'a0',
};
const input = {
  goals: [goal],
  routines: [routine],
  logs: [],
  from: '2026-03-07',
  to: '2026-03-09',
  timeZone: 'America/Vancouver',
};
const itemId = (item: DayItem) => (item.kind === 'todo' ? item.todo.id : item.routine.id);

describe('expandRoutines (ROUT-05~09)', () => {
  it('완료 로그를 붙이고 건너뛰기 및 규칙 밖 로그를 숨긴다', () => {
    const done = { routineId: 'r', date: '2026-03-07', status: 'done' as const };
    const skipped = { routineId: 'r', date: '2026-03-08', status: 'skipped' as const };
    const logs = [done, skipped, { ...done, routineId: 'deleted' }];
    const days = expandRoutines({ ...input, logs });
    expect(days.get('2026-03-07')).toEqual([
      { kind: 'routine', goalId: 'g', sortKey: 'a1', routine, log: done },
    ]);
    expect(days.get('2026-03-08')).toBeUndefined();
    expect(days.get('2026-03-09')).toEqual([
      { kind: 'routine', goalId: 'g', sortKey: 'a1', routine, log: null },
    ]);
    expect(
      expandRoutines({ ...input, logs, routines: [{ ...routine, startDate: '2026-03-09' }] }).has(
        '2026-03-07',
      ),
    ).toBe(false);
    expect(logs).toHaveLength(3);
  });
  it('목표가 없거나 범위가 비었으면 전개하지 않는다', () => {
    expect(expandRoutines({ ...input, goals: [] }).size).toBe(0);
    expect(expandRoutines({ ...input, from: '2026-03-10' }).size).toBe(0);
  });
  it('보관 시각은 사용자 시간대로 해석하며 보관 당일까지 포함한다 (I2)', () => {
    const archived = { ...goal, archivedAt: '2026-03-09T01:00:00Z' };
    const days = expandRoutines({ ...input, goals: [archived] });
    expect([...days.keys()]).toEqual(['2026-03-07', '2026-03-08']);
    expect([
      ...expandRoutines({ ...input, goals: [archived], timeZone: 'Asia/Seoul' }).keys(),
    ]).toEqual(['2026-03-07', '2026-03-08', '2026-03-09']);
  });
  it('분할 전날은 기존 루틴만, 당일은 새 루틴만 전개한다', () => {
    const routines = [
      { ...routine, endDate: '2026-03-07' },
      { ...routine, id: 'new', startDate: '2026-03-08' },
    ];
    const done = { routineId: 'new', date: '2026-03-08', status: 'done' as const };
    const days = expandRoutines({ ...input, routines, logs: [done] });
    expect(days.get('2026-03-07')?.map(itemId)).toEqual(['r']);
    expect(days.get('2026-03-08')?.map(itemId)).toEqual(['new']);
    expect(days.get('2026-03-08')?.[0]).toHaveProperty('log', done);
  });
  it('[30, 31] 규칙은 30일 달에 항목 하나만 만든다', () => {
    const days = expandRoutines({
      ...input,
      routines: [{ ...routine, freq: 'monthly', byMonthday: [30, 31] }],
      from: '2026-04-01',
      to: '2026-04-30',
    });
    expect([...days.keys()]).toEqual(['2026-04-30']);
    expect(days.get('2026-04-30')).toHaveLength(1);
  });
});

describe('buildDay (TODO-09, GOAL-05)', () => {
  it('목표와 혼합 항목을 바이트 순서로 정렬하고 동률은 kind → id로 정한다', () => {
    const goals = [
      { ...goal, id: 'g2', sortKey: 'a0' },
      { ...goal, sortKey: 'Zz' },
    ];
    const todos = [
      todo,
      { ...todo, id: 'A' },
      { ...todo, id: 'other', goalId: 'g2' },
      { ...todo, id: 'earlier', sortKey: 'Zz' },
      { ...todo, id: 'wrong-day', date: '2026-03-09' },
      { ...todo, id: 'deleted-goal', goalId: 'missing' },
    ];
    const routines = [
      { ...routine, sortKey: 'a0' },
      { ...routine, id: 'R', sortKey: 'a0' },
    ];
    const original = structuredClone({ goals, todos, routines });
    const groups = buildDay({ ...input, goals, todos, routines, date: '2026-03-08' });
    expect(groups.map((g) => g.goal.id)).toEqual(['g', 'g2']);
    expect(groups[0]?.items.map(itemId)).toEqual(['earlier', 'A', 't', 'R', 'r']);
    expect(groups[1]?.items.map(itemId)).toEqual(['other']);
    expect({ goals, todos, routines }).toEqual(original);
  });
  it('비어 있는 활성 목표는 포함, 보관 목표는 항목이 있을 때만 포함한다 (I3)', () => {
    const archived = { ...goal, archivedAt: '2026-03-07T20:00:00Z' };
    const active = { ...goal, id: 'active' };
    const empty = { ...archived, id: 'empty' };
    const groups = buildDay({
      ...input,
      goals: [archived, active, empty],
      todos: [todo],
      date: todo.date,
    });
    expect(groups.find((g) => g.goal.id === 'g')).toMatchObject({
      canAdd: false,
      items: [{ kind: 'todo', todo }],
    });
    expect(groups.find((g) => g.goal.id === 'active')).toMatchObject({ canAdd: true, items: [] });
    expect(groups.some((g) => g.goal.id === 'empty')).toBe(false);
    expect(
      buildDay({
        ...input,
        goals: [archived],
        todos: [{ ...todo, date: '2026-03-06' }],
        date: '2026-03-06',
      })[0]?.items.map(itemId),
    ).toEqual(['t', 'r']);
  });
});

describe('summarizeMonth (CAL-02)', () => {
  it('할 일과 루틴을 합치고 완료·건너뛰기·삭제 목표를 반영한다', () => {
    const summary = summarizeMonth({
      ...input,
      todos: [
        todo,
        { ...todo, id: 'done', isDone: true },
        { ...todo, id: 'outside', date: '2026-03-10' },
        { ...todo, id: 'missing', goalId: 'missing' },
      ],
      logs: [
        { routineId: 'r', date: '2026-03-08', status: 'done' },
        { routineId: 'r', date: '2026-03-09', status: 'skipped' },
      ],
    });
    expect(summary.get('2026-03-07')).toEqual({ total: 1, remaining: 1 });
    expect(summary.get('2026-03-08')).toEqual({ total: 3, remaining: 1 });
    expect(summary.has('2026-03-09')).toBe(false);
    expect(summary.has('2026-03-10')).toBe(false);
  });
  it('전부 완료한 날과 빈 기간을 구분하고 보관 기준을 공유한다', () => {
    expect(
      summarizeMonth({ ...input, routines: [], todos: [{ ...todo, isDone: true }] }).get(todo.date),
    ).toEqual({ total: 1, remaining: 0 });
    expect(summarizeMonth({ ...input, routines: [], todos: [] }).size).toBe(0);
    expect([
      ...summarizeMonth({
        ...input,
        goals: [{ ...goal, archivedAt: '2026-03-09T01:00:00Z' }],
        todos: [],
      }).keys(),
    ]).toEqual(['2026-03-07', '2026-03-08']);
  });
});
