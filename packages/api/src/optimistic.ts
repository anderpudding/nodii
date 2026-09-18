import { monthKeysContaining } from '@nodii/core';
import { type QueryClient, type QueryKey } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

interface CacheRow {
  id: string;
  deletedAt: string | null;
}
export interface RowSnapshot<T> {
  key: QueryKey;
  rows: T[];
  query: object;
}
/** 캐시에 실제 있는 인접 월만 골라 불필요한 빈 캐시 생성을 막는다. */
export function cachedTodoKeys(client: QueryClient, date: string, weekStart: 0 | 1): QueryKey[] {
  return monthKeysContaining(date, weekStart)
    .map(queryKeys.todos)
    .filter((key) => client.getQueryData(key) !== undefined);
}
function replace<T extends CacheRow>(rows: T[], id: string, row?: T): T[] {
  const next = rows.filter((item) => item.id !== id);
  if (row && row.deletedAt === null) next.push(row);
  return next;
}
/** 요청 전에 관련 쿼리를 취소하고 모든 스냅샷을 같은 작업에서 만든다. */
export async function beginOptimistic<T extends CacheRow>(
  client: QueryClient,
  keys: QueryKey[],
  row: T,
): Promise<RowSnapshot<T>[]> {
  await Promise.all(keys.map((queryKey) => client.cancelQueries({ queryKey, exact: true })));
  return keys.flatMap((key) => {
    const rows = client.getQueryData<T[]>(key);
    const query = client.getQueryCache().find({ queryKey: key, exact: true });
    if (!rows || !query) return [];
    client.setQueryData(key, replace(rows, row.id, row));
    return [{ key, rows, query }];
  });
}
/** 다른 행의 동시 쓰기는 보존하고 실패한 행만 모든 스냅샷에서 복원한다. */
export function rollbackOptimistic<T extends CacheRow>(
  client: QueryClient,
  snapshots: RowSnapshot<T>[],
  id: string,
): void {
  for (const { key, rows, query } of snapshots) {
    // 로그아웃으로 제거된 캐시를 늦은 응답이 다시 만들면 안 된다.
    if (client.getQueryCache().find({ queryKey: key, exact: true }) !== query) continue;
    client.setQueryData<T[]>(
      key,
      (current) =>
        current &&
        replace(
          current,
          id,
          rows.find((row) => row.id === id),
        ),
    );
  }
}
/** updated_at을 포함한 서버 행으로 바꾸며 요청 중 열린 인접 월도 갱신한다. */
export function commitOptimistic<T extends CacheRow>(
  client: QueryClient,
  snapshots: RowSnapshot<T>[],
  keys: QueryKey[],
  row: T,
): void {
  if (
    !snapshots.some(
      ({ key, query }) => client.getQueryCache().find({ queryKey: key, exact: true }) === query,
    )
  )
    return;
  for (const key of keys) {
    client.setQueryData<T[]>(key, (current) => current && replace(current, row.id, row));
  }
}
