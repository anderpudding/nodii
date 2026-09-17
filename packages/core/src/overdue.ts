import { OVERDUE_LOOKBACK_DAYS } from './constants';
import { addDays } from './date';
import { compareSortKey, keyBetween, lastSortKey } from './sort-key';
import type { Goal, ISODate, Todo } from './types';

export interface OverdueMoveInput {
  overdue: readonly Todo[];
  /** 오늘 날짜로 전개한 할 일·루틴 목록의 공통 정렬 정보. */
  todayItems: readonly { goalId: string; sortKey: string }[];
  goals: readonly Goal[];
  today: ISODate;
}

/** 오늘 항목을 제외하고 수동 가져오기 조회 범위를 정한다 (TODO-10). */
export function overdueRange(today: ISODate): { from: ISODate; to: ISODate } {
  return { from: addDays(today, -OVERDUE_LOOKBACK_DAYS), to: addDays(today, -1) };
}

/** 원본을 변경하지 않고 목표별 맨 아래에 붙일 RPC 인자만 만든다 (TODO-10). */
export function planOverdueMove({
  overdue,
  todayItems,
  goals,
  today,
}: OverdueMoveInput): { id: string; sort_key: string }[] {
  const { from, to } = overdueRange(today);
  const lastKeys = new Map(
    goals
      .filter((goal) => goal.archivedAt === null)
      .map((goal) => [goal.id, lastSortKey(todayItems.filter((item) => item.goalId === goal.id))]),
  );
  return overdue
    .filter(
      (todo) => !todo.isDone && from <= todo.date && todo.date <= to && lastKeys.has(todo.goalId),
    )
    .sort(
      (a, b) =>
        compareSortKey(a.date, b.date) ||
        compareSortKey(a.sortKey, b.sortKey) ||
        compareSortKey(a.id, b.id),
    )
    .map((todo) => {
      const key = keyBetween(lastKeys.get(todo.goalId) ?? null, null);
      lastKeys.set(todo.goalId, key);
      return { id: todo.id, sort_key: key };
    });
}
