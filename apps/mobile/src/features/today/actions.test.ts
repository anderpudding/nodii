import { expect, it } from 'vitest';
import {
  actionLabel,
  mutationTouchesTodo,
  splitSwipeActions,
  todoActions,
  routineActions,
  routineManagementActions,
  routineActionLabel,
} from './actions';

type DeclaredAction =
  | (typeof todoActions)[number]
  | (typeof routineActions)[number]
  | (typeof routineManagementActions)[number];

it.each([
  {
    name: '할 일',
    actions: todoActions,
    menu: ['toggle', 'rename', 'move', 'delete'],
    swipes: ['toggle', 'move', 'delete'],
    noLeading: false,
  },
  {
    name: '하루 루틴',
    actions: routineActions,
    menu: ['toggle', 'skip', 'edit', 'stop'],
    swipes: ['toggle', 'skip', 'stop'],
    noLeading: false,
  },
  {
    name: '관리 루틴',
    actions: routineManagementActions,
    menu: ['edit', 'stop'],
    swipes: ['stop'],
    noLeading: true,
  },
])(
  '$name의 밀기·메뉴·접근성 목록은 같은 선언의 계약을 따른다 (MOB-01)',
  ({ actions, menu, swipes, noLeading }) => {
    expect(actions.map(({ id }) => id)).toEqual(menu);
    const swipeIds = actions.filter(({ swipe }) => swipe).map(({ id }) => id);
    expect(swipeIds).toEqual(swipes);
    for (const id of swipeIds) expect(menu).toContain(id);
    const parts = noLeading
      ? splitSwipeActions<DeclaredAction>(actions, 'none')
      : splitSwipeActions<DeclaredAction>(actions);
    expect(parts.leading?.id).toBe(noLeading ? undefined : 'toggle');
    expect(parts.trailing.map(({ id }) => id)).toEqual(swipes.filter((id) => id !== 'toggle'));
  },
);
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

it('관리 선언은 순서를 바꿔도 편집은 메뉴 전용이고 종료만 trailing으로 남는다', () => {
  const [edit, stop] = routineManagementActions;
  const result = splitSwipeActions([stop, edit], 'none');
  expect(result.leading).toBeUndefined();
  expect(result.trailing).toEqual([stop]);
  expect(() => splitSwipeActions(routineManagementActions)).toThrow(
    'requires exactly one leading action',
  );
});
it.each([
  { count: 1, actions: [routineActions[0]] },
  { count: 2, actions: [routineActions[0], routineActions[0]] },
])('none 모드는 $count개 leading 선언을 조용히 숨기지 않고 거부한다', ({ actions }) => {
  expect(() => splitSwipeActions(actions, 'none')).toThrow('does not allow a leading action');
});
