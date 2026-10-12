import { expect, it } from 'vitest';
import {
  actionLabel,
  mutationTouchesTodo,
  splitSwipeActions,
  todoActions,
  routineActions,
  routineActionLabel,
} from './actions';

it('밀기로 할 수 있는 모든 일이 메뉴와 접근성 목록에도 있다 (MOB-01)', () => {
  const menu = todoActions.map((action) => action.id);
  const swipe = todoActions.filter((action) => action.swipe).map((action) => action.id);
  expect(menu).toEqual(['toggle', 'rename', 'move', 'delete']);
  expect(swipe).toEqual(['toggle', 'move', 'delete']);
  for (const action of swipe) expect(menu).toContain(action);
});
it('완료와 미완료의 메뉴 라벨을 구별한다', () => {
  expect(actionLabel('toggle', false)).toBe('완료');
  expect(actionLabel('toggle', true)).toBe('완료 취소');
  expect(actionLabel('move', true)).toBe('옮기기');
});
it('선언 순서를 바꿔도 swipe 값으로 방향을 나누고 메뉴 전용 동작을 제외한다', () => {
  const [toggle, rename, move, remove] = todoActions;
  const result = splitSwipeActions([move, rename, toggle, remove]);
  expect(result.leading).toBe(toggle);
  expect(result.trailing).toEqual([move, remove]);
});
it.each([
  { label: '없는', actions: todoActions.filter((action) => action.swipe !== 'leading') },
  { label: '여러 개인', actions: [...todoActions, todoActions[0]] },
])('leading이 $label 구성은 임의 선택하지 않고 오류로 드러낸다', ({ actions }) => {
  expect(() => splitSwipeActions(actions)).toThrow('requires exactly one leading action');
});

it('해당 행만 단건·묶음·가져오기 요청 진행 상태를 공유한다', () => {
  for (const variables of [
    { id: 'a' },
    { todo: { id: 'a' } },
    { todos: [{ id: 'a' }, { id: 'b' }] },
    { overdue: [{ id: 'a' }] },
  ]) {
    expect(mutationTouchesTodo(variables, 'a')).toBe(true);
    expect(mutationTouchesTodo(variables, 'other')).toBe(false);
  }
  for (const variables of [undefined, null, 1, {}, { todos: false }, { overdue: [null] }])
    expect(mutationTouchesTodo(variables, 'a')).toBe(false);
});

it('루틴 밀기·메뉴·접근성 계약은 할 일과 별개이고 날짜 이동·삭제가 없다', () => {
  const menu = routineActions.map(({ id }) => id);
  expect(menu).toEqual(['toggle', 'skip', 'edit', 'stop']);
  const swipe = splitSwipeActions(routineActions);
  expect(swipe.leading.id).toBe('toggle');
  expect(swipe.trailing.map(({ id }) => id)).toEqual(['skip', 'stop']);
  for (const action of routineActions.filter(({ swipe }) => swipe))
    expect(menu).toContain(action.id);
  expect(routineActionLabel('skip', false)).toBe('오늘만 건너뛰기');
  expect(routineActionLabel('skip', false, true)).toBe('건너뛰기 취소');
  expect(routineActionLabel('toggle', true)).toBe('완료 취소');
  expect(() => splitSwipeActions(routineActions.slice(1))).toThrow();
  expect(() => splitSwipeActions([...routineActions, routineActions[0]])).toThrow();
});
