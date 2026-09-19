import { addDays, monthKeysContaining } from '@nodii/core';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { RoutineLogRecord, RoutineRecord } from './mappers';
import { beginOptimistic, rollbackOptimistic, type RowSnapshot } from './optimistic';
import { queryKeys } from './query-keys';

/** 겹치는 42칸 중 이미 불러온 월만 패치한다. */
export function cachedLogKeys(cache: QueryClient, date: string, weekStart: 0 | 1) {
  return monthKeysContaining(date, weekStart)
    .map(queryKeys.routineLogs)
    .filter((key) => cache.getQueryData(key) !== undefined);
}
/** 삭제도 복합 키 하나만 바꿔 다른 루틴의 동시 저장을 보존한다. */
export function replaceLog(
  rows: RoutineLogRecord[],
  routineId: string,
  date: string,
  row?: RoutineLogRecord,
) {
  const next = rows.filter((log) => log.routineId !== routineId || log.date !== date);
  if (row) next.push(row);
  return next;
}
/** 로그는 id가 없으므로 복합 키용 스냅샷을 별도로 만든다. */
export async function snapshotLogs(
  cache: QueryClient,
  keys: QueryKey[],
): Promise<RowSnapshot<RoutineLogRecord>[]> {
  await Promise.all(keys.map((queryKey) => cache.cancelQueries({ queryKey, exact: true })));
  return keys.flatMap((key) => {
    const rows = cache.getQueryData<RoutineLogRecord[]>(key);
    const query = cache.getQueryCache().find({ queryKey: key, exact: true });
    return rows && query ? [{ key, rows, query }] : [];
  });
}
/** 로그아웃 후 같은 키가 다시 생겨도 이전 사용자의 응답은 쓰지 않는다. */
export function snapshotAlive(cache: QueryClient, snapshot: RowSnapshot<unknown>) {
  return cache.getQueryCache().find({ queryKey: snapshot.key, exact: true }) === snapshot.query;
}
export interface SplitSnapshot {
  routines: RowSnapshot<RoutineRecord>[];
  logs: RowSnapshot<RoutineLogRecord>[];
}
/** 어제까지의 루틴과 오늘부터의 루틴·기록을 한 낙관적 작업으로 분리한다. */
export async function beginRoutineSplit(
  cache: QueryClient,
  before: RoutineRecord,
  next: RoutineRecord,
  today: string,
): Promise<SplitSnapshot> {
  const logKeys = cache.getQueriesData({ queryKey: ['routineLogs'] }).map(([key]) => key);
  const logs = await snapshotLogs(cache, logKeys);
  const routines = await beginOptimistic(cache, [queryKeys.routines()], {
    ...before,
    endDate: addDays(today, -1),
  });
  cache.setQueryData<RoutineRecord[]>(
    queryKeys.routines(),
    (rows) => rows && [...rows.filter((r) => r.id !== next.id), next],
  );
  remapSplitLogs(cache, before.id, next.id, today);
  return { routines, logs };
}
/** 성공 중 새로 열린 월에도 오늘 이후 기록의 새 ID를 적용한다. */
export function remapSplitLogs(cache: QueryClient, oldId: string, newId: string, today: string) {
  cache.setQueriesData<RoutineLogRecord[]>({ queryKey: ['routineLogs'] }, (rows) =>
    rows?.map((log) =>
      log.routineId === oldId && log.date >= today ? { ...log, routineId: newId } : log,
    ),
  );
}
/** 분할에 관련된 두 ID만 복원해 다른 루틴·날짜의 쓰기를 지키고 로그아웃도 보호한다. */
export function rollbackRoutineSplit(
  cache: QueryClient,
  snapshot: SplitSnapshot,
  oldId: string,
  newId: string,
) {
  rollbackOptimistic(cache, snapshot.routines, oldId);
  rollbackOptimistic(cache, snapshot.routines, newId);
  for (const saved of snapshot.logs) {
    if (!snapshotAlive(cache, saved)) continue;
    cache.setQueryData<RoutineLogRecord[]>(
      saved.key,
      (rows) =>
        rows && [
          ...rows.filter((log) => log.routineId !== oldId && log.routineId !== newId),
          ...saved.rows.filter((log) => log.routineId === oldId || log.routineId === newId),
        ],
    );
  }
}
