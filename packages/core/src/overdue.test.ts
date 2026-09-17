import { describe, expect, it } from 'vitest';
import { overdueRange, planOverdueMove } from './overdue';
import type { Goal, Todo } from './types';

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
      todayTodos: [
        { ...todo, id: 'today', date: '2026-03-09', sortKey: 'a9', isDone: true },
        { ...todo, id: 'wrong-date', sortKey: 'b00' },
      ],
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
  it('가져올 것이 없으면 빈 계획을 반환한다', () => {
    expect(
      planOverdueMove({ overdue: [], todayTodos: [], goals: [goal], today: '2026-03-09' }),
    ).toEqual([]);
  });
});
