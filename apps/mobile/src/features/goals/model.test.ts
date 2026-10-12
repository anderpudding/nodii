import { expect, it } from 'vitest';
import { compareSortKey, type Goal } from '@nodii/core';
import { splitSwipeActions } from '../today/actions';
import { droppedGoalIndex, goalActions, isLastActiveGoal, reorderedGoalKey } from './model';
const goals: Goal[] = [
  { id: 'a', name: '공부', color: '#4F7CFF', sortKey: 'a0', archivedAt: null },
  { id: 'b', name: '운동', color: '#33A9B8', sortKey: 'a1', archivedAt: null },
  { id: 'c', name: '할 일', color: '#F0715A', sortKey: 'a2', archivedAt: null },
];
it('목표 밀기 동작 모두 메뉴 선언에 있고 관리 줄은 leading이 없다', () => {
  const swipe = splitSwipeActions(goalActions, 'none');
  expect(swipe.leading).toBeUndefined();
  expect(swipe.trailing.map((entry) => entry.id)).toEqual(['archive']);
  expect(goalActions.map((entry) => entry.id)).toEqual(['edit', 'reorder', 'archive', 'delete']);
});
it('보관·삭제 목표를 빼고 마지막 활성 목표만 보호한다', () => {
  expect(isLastActiveGoal(goals, 'a')).toBe(false);
  expect(
    isLastActiveGoal(
      [goals[0]!, { ...goals[1]!, archivedAt: 'date' }, { ...goals[2]!, deletedAt: 'date' }],
      'a',
    ),
  ).toBe(true);
  expect(isLastActiveGoal([{ ...goals[0]!, archivedAt: 'date' }], 'a')).toBe(false);
});
it('이동한 한 행의 키가 앞·뒤 이웃의 바이트 순서 사이에 있다', () => {
  const middle = reorderedGoalKey(goals, 'a', 1);
  expect(compareSortKey(goals[1]!.sortKey, middle)).toBeLessThan(0);
  expect(compareSortKey(middle, goals[2]!.sortKey)).toBeLessThan(0);
  expect(compareSortKey(reorderedGoalKey(goals, 'c', 0), goals[0]!.sortKey)).toBeLessThan(0);
});
it('글자 크기로 달라진 실측 행 높이에서 길게 눌러 이동한 위치를 판정한다', () => {
  expect(droppedGoalIndex([52, 80, 52], 0, 110)).toBe(1);
  expect(droppedGoalIndex([52, 80, 52], 2, -160)).toBe(0);
  expect(droppedGoalIndex([52, 80, 52], 1, 10)).toBe(1);
});
