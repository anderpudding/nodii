import { t } from '@nodii/i18n';

// MOB-01: 세 경로 모두 같은 선언을 읽어 밀기만 가능한 동작이 생기지 않게 한다.
export const todoActions = [
  { id: 'toggle', swipe: 'leading' },
  { id: 'rename', swipe: null },
  { id: 'move', swipe: 'trailing' },
  { id: 'delete', swipe: 'trailing' },
] as const;
export type TodoAction = (typeof todoActions)[number]['id'];

type SwipeDeclaration = { swipe: 'leading' | 'trailing' | null };

/** MOB-01: 하루 줄은 leading 1개, 관리 줄은 명시적인 none 모드에서만 0개를 허용한다. */
export function splitSwipeActions<T extends SwipeDeclaration>(
  actions: readonly T[],
): {
  leading: T;
  trailing: T[];
};
export function splitSwipeActions<T extends SwipeDeclaration>(
  actions: readonly T[],
  leadingMode: 'none',
): { leading: undefined; trailing: T[] };
export function splitSwipeActions<T extends SwipeDeclaration>(
  actions: readonly T[],
  leadingMode: 'required' | 'none' = 'required',
) {
  const leading = actions.filter((action) => action.swipe === 'leading');
  // 관리 줄의 누락과 하루 줄의 선언 실수를 혼동하지 않도록 모드를 명시한다.
  if (leadingMode === 'none') {
    if (leading.length !== 0) throw new Error('SwipeableRow does not allow a leading action');
  } else if (leading.length !== 1) {
    throw new Error('SwipeableRow requires exactly one leading action');
  }
  return {
    leading: leadingMode === 'none' ? undefined : leading[0]!,
    trailing: actions.filter((action) => action.swipe === 'trailing'),
  };
}

/** 완료 상태에 따라 메뉴·밀기·VoiceOver의 말이 함께 바뀐다. */
export function actionLabel(action: TodoAction, isDone: boolean) {
  if (action === 'toggle') return t(isDone ? 'todo.action.uncomplete' : 'todo.action.complete');
  return t(`todo.action.${action}`);
}

/** 묶음 이동 중 목적 날짜에서 다시 만난 행도 해당 요청이 끝날 때까지 보호한다 (TODO-11). */
export function mutationTouchesTodo(value: unknown, id: string): boolean {
  if (!value || typeof value !== 'object') return false;
  if ('id' in value && value.id === id) return true;
  if ('todo' in value && mutationTouchesTodo(value.todo, id)) return true;
  const groups = ['todos' in value ? value.todos : null, 'overdue' in value ? value.overdue : null];
  return groups.some(
    (rows) => Array.isArray(rows) && rows.some((row: unknown) => mutationTouchesTodo(row, id)),
  );
}

// ROUT-07/MOB-01: 루틴에는 날짜 이동·삭제 대신 건너뛰기·종료 선택을 제공한다.
export const routineActions = [
  { id: 'toggle', swipe: 'leading' },
  { id: 'skip', swipe: 'trailing' },
  { id: 'edit', swipe: null },
  { id: 'stop', swipe: 'trailing' },
] as const;
export type RoutineAction = (typeof routineActions)[number]['id'];
/** 밀기·메뉴·VoiceOver가 같은 상태별 루틴 문구를 사용한다. */
export function routineActionLabel(action: RoutineAction, isDone: boolean, skipped = false) {
  if (action === 'toggle') return actionLabel('toggle', isDone);
  if (action === 'skip') return t(skipped ? 'routine.unskip' : 'routine.skip');
  return t(action === 'edit' ? 'routine.edit' : 'routine.stop');
}

// ROUT-10/MOB-01: 관리 줄은 날짜별 완료 없이 편집과 왼쪽 종료만 제공한다.
export const routineManagementActions = [
  { id: 'edit', swipe: null },
  { id: 'stop', swipe: 'trailing' },
] as const;
export type RoutineManagementAction = (typeof routineManagementActions)[number]['id'];
