import { expect, it } from 'vitest';
import { actionLabel, todoActions } from './actions';

it('밀기로 할 수 있는 모든 일이 메뉴와 접근성 목록에도 있다 (MOB-01)', () => {
  const menu = todoActions.map((action) => action.id);
  const swipe = todoActions.filter((action) => action.swipe).map((action) => action.id);
  expect(menu).toEqual(['toggle', 'rename', 'tomorrow', 'delete']);
  expect(swipe).toEqual(['toggle', 'tomorrow', 'delete']);
  for (const action of swipe) expect(menu).toContain(action);
});
it('완료와 미완료의 메뉴 라벨을 구별한다', () => {
  expect(actionLabel('toggle', false)).toBe('완료');
  expect(actionLabel('toggle', true)).toBe('완료 취소');
  expect(actionLabel('tomorrow', true)).toBe('내일로');
});
