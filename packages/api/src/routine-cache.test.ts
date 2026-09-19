import { QueryClient } from '@tanstack/react-query';
import { afterEach, expect, it } from 'vitest';
import { buildDay } from '@nodii/core';
import type { RoutineRecord, RoutineLogRecord } from './mappers';
import { queryKeys } from './query-keys';
import {
  beginRoutineSplit,
  cachedLogKeys,
  remapSplitLogs,
  rollbackRoutineSplit,
} from './routine-cache';
const cache = new QueryClient();
afterEach(() => cache.clear());
const before: RoutineRecord = {
  id: 'old',
  goalId: 'g',
  title: '운동',
  freq: 'daily',
  repeatEvery: 1,
  byWeekday: null,
  byMonthday: null,
  startDate: '2026-09-01',
  endDate: null,
  sortKey: 'a0',
  updatedAt: '',
  deletedAt: null,
};
const next: RoutineRecord = {
  ...before,
  id: 'new',
  freq: 'weekly',
  byWeekday: [4],
  startDate: '2026-10-01',
};
const logs: RoutineLogRecord[] = [
  { routineId: 'old', date: '2026-09-30', status: 'done', updatedAt: '' },
  { routineId: 'old', date: '2026-10-01', status: 'skipped', updatedAt: '' },
];
function seed() {
  cache.setQueryData(queryKeys.routines(), [before]);
  for (const month of ['2026-09', '2026-10'])
    cache.setQueryData(queryKeys.routineLogs(month), logs);
}
it('분할 직후 어제 규칙·기록을 보존하고 오늘 이후 로그만 모든 월에서 이동한다', async () => {
  seed();
  await beginRoutineSplit(cache, before, next, '2026-10-01');
  const routines = cache.getQueryData<RoutineRecord[]>(queryKeys.routines())!;
  expect(routines).toEqual([{ ...before, endDate: '2026-09-30' }, next]);
  for (const key of cachedLogKeys(cache, '2026-10-01', 0))
    expect(cache.getQueryData(key)).toEqual([logs[0], { ...logs[1], routineId: 'new' }]);
  const shared = {
    goals: [{ id: 'g', name: '운동', color: '#4F7CFF', sortKey: 'a0', archivedAt: null }],
    todos: [],
    routines,
    logs: cache.getQueryData<RoutineLogRecord[]>(queryKeys.routineLogs('2026-10'))!,
    timeZone: 'UTC',
  };
  expect(buildDay({ ...shared, date: '2026-09-30' })[0]!.items[0]).toMatchObject({
    routine: { id: 'old' },
    log: { status: 'done' },
  });
  expect(buildDay({ ...shared, date: '2026-10-01' })[0]!.items).toEqual([]);
});
it('분할 실패는 두 행과 모든 월 기록을 복원하고 다른 루틴 변경을 보존한다', async () => {
  seed();
  const snapshot = await beginRoutineSplit(cache, before, next, '2026-10-01');
  cache.setQueryData(queryKeys.routines(), [
    ...cache.getQueryData<RoutineRecord[]>(queryKeys.routines())!,
    { ...before, id: 'other' },
  ]);
  const otherLog = { ...logs[0]!, routineId: 'other' };
  cache.setQueryData(queryKeys.routineLogs('2026-10'), [otherLog]);
  rollbackRoutineSplit(cache, snapshot, 'old', 'new');
  expect(cache.getQueryData(queryKeys.routines())).toEqual(
    expect.arrayContaining([before, { ...before, id: 'other' }]),
  );
  expect(cache.getQueryData(queryKeys.routineLogs('2026-10'))).toEqual([otherLog, ...logs]);
  expect(cache.getQueryData(queryKeys.routineLogs('2026-09'))).toEqual(logs);
});
it('요청 중 열린 월에도 로그 ID를 바꾸고 로그아웃 뒤 실패가 캐시를 되살리지 않는다', async () => {
  seed();
  const snapshot = await beginRoutineSplit(cache, before, next, '2026-10-01');
  cache.setQueryData(queryKeys.routineLogs('2026-11'), [{ ...logs[0], date: '2026-11-01' }]);
  remapSplitLogs(cache, 'old', 'new', '2026-10-01');
  expect(cache.getQueryData(queryKeys.routineLogs('2026-11'))).toEqual([
    { ...logs[0], routineId: 'new', date: '2026-11-01' },
  ]);
  cache.clear();
  rollbackRoutineSplit(cache, snapshot, 'old', 'new');
  expect(cache.getQueryCache().getAll()).toHaveLength(0);
});
