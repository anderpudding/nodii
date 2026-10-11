import { t } from '@nodii/i18n';

// MOB-01: 세 경로 모두 같은 선언을 읽어 밀기만 가능한 동작이 생기지 않게 한다.
export const todoActions = [
  { id: 'toggle', swipe: 'leading' },
  { id: 'rename', swipe: null },
  { id: 'tomorrow', swipe: 'trailing' },
  { id: 'delete', swipe: 'trailing' },
] as const;
export type TodoAction = (typeof todoActions)[number]['id'];
/** 완료 상태에 따라 메뉴·밀기·VoiceOver의 말이 함께 바뀐다. */
export function actionLabel(action: TodoAction, isDone: boolean) {
  if (action === 'toggle') return t(isDone ? 'todo.action.uncomplete' : 'todo.action.complete');
  return t(`todo.action.${action}`);
}
