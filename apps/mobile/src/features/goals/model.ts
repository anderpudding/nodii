import { compareSortKey, keyBetween, type Goal } from '@nodii/core';

export const goalActions = [
  { id: 'edit', swipe: null },
  { id: 'reorder', swipe: null },
  { id: 'archive', swipe: 'trailing' },
  { id: 'delete', swipe: null },
] as const;
export type GoalAction = (typeof goalActions)[number]['id'];
/** GOAL-07: 보관·삭제 목표를 제외하고 마지막 활성 목표를 판정한다. */
export function isLastActiveGoal(
  goals: readonly (Goal & { deletedAt?: string | null })[],
  id: string,
) {
  const active = goals.filter(
    (goal) => !goal.archivedAt && !('deletedAt' in goal && goal.deletedAt),
  );
  return active.length === 1 && active[0]?.id === id;
}
/** GOAL-04: 이동한 한 행만 기존 바이트 순서 정렬 키 공간에서 갱신한다. */
export function reorderedGoalKey(
  goals: readonly (Goal & { deletedAt?: string | null })[],
  id: string,
  target: number,
) {
  const ordered = [...goals].sort((a, b) => compareSortKey(a.sortKey, b.sortKey));
  const others = ordered.filter((goal) => goal.id !== id);
  const index = Math.max(0, Math.min(target, others.length));
  return keyBetween(others[index - 1]?.sortKey ?? null, others[index]?.sortKey ?? null);
}
/** Dynamic Type에서도 실측한 행 중심으로 이동할 위치를 고른다. */
export function droppedGoalIndex(heights: readonly number[], source: number, distance: number) {
  let top = 0;
  const centers = heights.map((height) => {
    const center = top + height / 2;
    top += height;
    return center;
  });
  const destination = (centers[source] ?? 0) + distance;
  let target = source;
  for (let i = 0; i < centers.length; i++) {
    if (i < source && destination <= centers[i]!) return i;
    if (i > source && destination >= centers[i]!) target = i;
  }
  return target;
}
