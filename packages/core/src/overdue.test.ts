import { describe, expect, it } from 'vitest';
import { buildDay } from './day';
import { overdueRange, planOverdueMove } from './overdue';
import type { Goal, Routine, Todo } from './types';

const goal: Goal = { id: 'g', name: '일상', color: '#FFFFFF', sortKey: 'a0', archivedAt: null };
const todo: Todo = {
  id: 't',
  goalId: 'g',
  title: '공부',
  date: '2026-03-07',
  isDone: false,
  sortKey: 'a0',
};

describe('지난 미완료 가져오기 (TODO-10)', () => {
  it('오늘을 제외한 최근 7일 범위는 DST·연도 경계를 넘는다', () => {
    expect(overdueRange('2026-03-09')).toEqual({ from: '2026-03-02', to: '2026-03-08' });
    expect(overdueRange('2026-01-03')).toEqual({ from: '2025-12-27', to: '2026-01-02' });
  });
  it('목표별 마지막에 날짜 → 원래 키 순으로 붙이고 부적격 항목은 제외한다', () => {
    const input = {
      today: '2026-03-09',
      goals: [
        goal,
        { ...goal, id: 'empty' },
        { ...goal, id: 'archive', archivedAt: '2026-03-09T00:00:00Z' },
      ],
      todayItems: [{ goalId: goal.id, sortKey: 'a9' }],
      overdue: [
        todo,
        { ...todo, id: 'first', date: '2026-03-02', sortKey: 'a9' },
        { ...todo, id: 'upper', sortKey: 'Zz' },
        { ...todo, id: 'empty-goal', goalId: 'empty', date: '2026-03-08' },
        { ...todo, id: 'done', isDone: true },
        { ...todo, id: 'old', date: '2026-03-01' },
        { ...todo, id: 'future', date: '2026-03-10' },
        { ...todo, id: 'today', date: '2026-03-09' },
        { ...todo, id: 'archived', goalId: 'archive' },
        { ...todo, id: 'deleted', goalId: 'missing' },
      ],
    };
    const original = structuredClone(input);
    const moves = planOverdueMove(input);
    expect(moves).toEqual([
      { id: 'first', sort_key: 'aA' },
      { id: 'upper', sort_key: 'aB' },
      { id: 't', sort_key: 'aC' },
      { id: 'empty-goal', sort_key: 'a0' },
    ]);
    expect(input).toEqual(original);
  });
  it('할 일보다 아래에 있는 루틴과 루틴만 있는 목표에서도 마지막 뒤에 붙인다', () => {
    const today = '2026-03-09';
    const goals = [goal, { ...goal, id: 'routine-only' }];
    const routine: Routine = {
      id: 'r',
      goalId: goal.id,
      title: '운동',
      freq: 'daily',
      repeatEvery: 1,
      byWeekday: null,
      byMonthday: null,
      startDate: today,
      endDate: null,
      sortKey: 'a9',
    };
    const todayItems = buildDay({
      goals,
      todos: [
        { ...todo, date: today, sortKey: 'a0' },
        { ...todo, id: 'done', date: today, sortKey: 'a2', isDone: true },
      ],
      routines: [routine, { ...routine, id: 'r2', goalId: 'routine-only', sortKey: 'b00' }],
      logs: [],
      date: today,
      timeZone: 'America/Vancouver',
    })
      .flatMap((group) => group.items)
      .reverse();
    const original = structuredClone(todayItems);
    expect(
      planOverdueMove({
        overdue: [todo, { ...todo, id: 'second-goal', goalId: 'routine-only' }],
        todayItems,
        goals,
        today,
      }),
    ).toEqual([
      { id: 'second-goal', sort_key: 'b01' },
      { id: 't', sort_key: 'aA' },
    ]);
    expect(todayItems).toEqual(original);
  });
  it('가져올 것이 없으면 빈 계획을 반환한다', () => {
    expect(
      planOverdueMove({ overdue: [], todayItems: [], goals: [goal], today: '2026-03-09' }),
    ).toEqual([]);
  });
});
