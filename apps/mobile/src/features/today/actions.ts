import { t } from '@nodii/i18n';

// MOB-01: 세 경로 모두 같은 선언을 읽어 밀기만 가능한 동작이 생기지 않게 한다.
export const todoActions = [
  { id: 'toggle', swipe: 'leading' },
  { id: 'rename', swipe: null },
  { id: 'tomorrow', swipe: 'trailing' },
  { id: 'delete', swipe: 'trailing' },
] as const;
export type TodoAction = (typeof todoActions)[number]['id'];

/** MOB-01: 선언 순서와 방향을 분리하고 단일 leading 계약 위반은 개발 오류로 드러낸다. */
export function splitSwipeActions<T extends { swipe: 'leading' | 'trailing' | null }>(
  actions: readonly T[],
) {
  const leading = actions.filter((action) => action.swipe === 'leading');
  // SwipeableRow는 오른쪽 동작 하나만 지원한다. 여러 개를 임의로 고르지 않는다.
  if (leading.length !== 1) throw new Error('SwipeableRow requires exactly one leading action');
  return {
    leading: leading[0]!,
    trailing: actions.filter((action) => action.swipe === 'trailing'),
  };
}

/** 완료 상태에 따라 메뉴·밀기·VoiceOver의 말이 함께 바뀐다. */
export function actionLabel(action: TodoAction, isDone: boolean) {
  if (action === 'toggle') return t(isDone ? 'todo.action.uncomplete' : 'todo.action.complete');
  return t(`todo.action.${action}`);
}
