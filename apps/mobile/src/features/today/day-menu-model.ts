import { keyBetween, lastSortKey, type ISODate } from '@nodii/core';
import type { TodoRecord } from '@nodii/api';
import type { MessageKey } from '@nodii/i18n';

/** TODO-10~12: 비활성 항목을 숨기지 않고 같은 이유를 시각·접근성 경로에 제공한다. */
export function dayMenuReasons({
  date,
  today,
  ready,
  busy,
  count,
  importCount,
  overdueStatus,
}: {
  date: ISODate;
  today: ISODate;
  ready: boolean;
  busy: boolean;
  count: number;
  importCount: number;
  overdueStatus: 'pending' | 'error' | 'success';
}): { import: MessageKey | null; targets: MessageKey | null } {
  const common = busy ? 'day.menu.busy' : !ready ? 'day.menu.loading' : null;
  return {
    import:
      date !== today
        ? 'day.menu.todayOnly'
        : (common ??
          (overdueStatus === 'error'
            ? 'day.menu.overdueFailed'
            : overdueStatus === 'pending'
              ? 'day.menu.overdueLoading'
              : !importCount
                ? 'day.menu.noOverdue'
                : null)),
    targets: common ?? (!count ? 'day.menu.noIncomplete' : null),
  };
}
/** TODO-11: 대상 날짜의 각 목표 맨 아래에 원래 바이트 순서대로 이어 붙인다. */
export function planDayMove(originals: TodoRecord[], target: TodoRecord[], date: ISODate) {
  const tails = new Map<string, string | null>();
  const ids = new Set(originals.map((todo) => todo.id));
  return [...originals]
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
    .map((todo) => {
      const last = tails.has(todo.goalId)
        ? tails.get(todo.goalId)!
        : lastSortKey(
            target.filter(
              (row) =>
                !row.deletedAt &&
                row.date === date &&
                row.goalId === todo.goalId &&
                !ids.has(row.id),
            ),
          );
      const sort_key = keyBetween(last, null);
      tails.set(todo.goalId, sort_key);
      return { id: todo.id, sort_key };
    });
}
