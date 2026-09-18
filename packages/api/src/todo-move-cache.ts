import { monthGridRange, overdueRange } from '@nodii/core';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { TodoRecord } from './mappers';
import { cachedTodoKeys, rollbackOptimistic, type RowSnapshot } from './optimistic';

function keysForMove(
  cache: QueryClient,
  before: TodoRecord[],
  after: TodoRecord[],
  weekStart: 0 | 1,
): QueryKey[] {
  const months = [...before, ...after].flatMap((row) => cachedTodoKeys(cache, row.date, weekStart));
  const overdue = cache.getQueriesData({ queryKey: ['overdue'] }).map(([key]) => key);
  return [...new Map([...months, ...overdue].map((key) => [JSON.stringify(key), key])).values()];
}
function belongs(row: TodoRecord, key: QueryKey, weekStart: 0 | 1) {
  const range =
    key[0] === 'todos' ? monthGridRange(String(key[1]), weekStart) : overdueRange(String(key[1]));
  return (
    row.deletedAt === null &&
    row.date >= range.from &&
    row.date <= range.to &&
    (key[0] !== 'overdue' || !row.isDone)
  );
}
function patch(
  cache: QueryClient,
  keys: QueryKey[],
  after: TodoRecord[],
  weekStart: 0 | 1,
  clearOverdue?: string,
) {
  const ids = new Set(after.map((row) => row.id));
  for (const key of keys) {
    cache.setQueryData<TodoRecord[]>(key, (current) => {
      if (!current) return current;
      if (key[0] === 'overdue' && key[1] === clearOverdue) return [];
      return [
        ...current.filter((row) => !ids.has(row.id)),
        ...after.filter((row) => belongs(row, key, weekStart)),
      ];
    });
  }
}
/** 이동 전후의 모든 월과 지난 목록을 같은 스냅샷으로 관리한다. */
export async function beginTodoMove(
  cache: QueryClient,
  before: TodoRecord[],
  after: TodoRecord[],
  weekStart: 0 | 1,
  clearOverdue?: string,
) {
  const keys = keysForMove(cache, before, after, weekStart);
  await Promise.all(keys.map((queryKey) => cache.cancelQueries({ queryKey, exact: true })));
  const snapshots: RowSnapshot<TodoRecord>[] = keys.flatMap((key) => {
    const rows = cache.getQueryData<TodoRecord[]>(key);
    const query = cache.getQueryCache().find({ queryKey: key, exact: true });
    return rows && query ? [{ key, rows, query }] : [];
  });
  patch(cache, keys, after, weekStart, clearOverdue);
  return snapshots;
}
/** 요청 중 열린 월도 갱신하되 로그아웃으로 지워진 캐시는 되살리지 않는다. */
export function commitTodoMove(
  cache: QueryClient,
  snapshots: RowSnapshot<TodoRecord>[],
  before: TodoRecord[],
  after: TodoRecord[],
  weekStart: 0 | 1,
) {
  if (
    !snapshots.some(
      ({ key, query }) => cache.getQueryCache().find({ queryKey: key, exact: true }) === query,
    )
  )
    return;
  patch(cache, keysForMove(cache, before, after, weekStart), after, weekStart);
}
/** 다른 행의 동시 변경은 보존하면서 이동한 행만 원래 날짜로 돌린다. */
export function rollbackTodoMove(
  cache: QueryClient,
  snapshots: RowSnapshot<TodoRecord>[],
  before: TodoRecord[],
) {
  for (const row of before) rollbackOptimistic(cache, snapshots, row.id);
  // 가져오기 때 빈 배열로 숨긴 보관 목표도 실패하면 복원한다.
  for (const snapshot of snapshots.filter(({ key }) => key[0] === 'overdue')) {
    if (cache.getQueryCache().find({ queryKey: snapshot.key, exact: true }) !== snapshot.query)
      continue;
    cache.setQueryData<TodoRecord[]>(snapshot.key, (current) => {
      if (!current) return current;
      const ids = new Set(current.map((row) => row.id));
      return [...current, ...snapshot.rows.filter((row) => !ids.has(row.id))];
    });
  }
}
