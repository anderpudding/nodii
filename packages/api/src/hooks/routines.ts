import {
  addDays,
  monthGridRange,
  needsScopePrompt,
  type Routine,
  type RoutineLogStatus,
} from '@nodii/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NodiiClient } from '../client';
import type { RoutineLogRecord, RoutineRecord } from '../mappers';
import { beginOptimistic, commitOptimistic, rollbackOptimistic } from '../optimistic';
import {
  beginRoutineSplit,
  cachedLogKeys,
  remapSplitLogs,
  replaceLog,
  rollbackRoutineSplit,
  snapshotAlive,
  snapshotLogs,
} from '../routine-cache';
import { queryKeys } from '../query-keys';
import {
  createRoutine,
  endRoutine,
  listRoutines,
  softDeleteRoutine,
  splitRoutine,
  updateRoutine,
} from '../repositories/routines';
import { deleteLog, listLogsInRange, upsertLog } from '../repositories/routine-logs';
import { useRowMutation, type MutationOptions } from './mutations';

/** 루틴 전체를 날짜별 전개와 관리 화면이 함께 구독한다. */
export function useRoutines(client: NodiiClient) {
  return useQuery({
    queryKey: queryKeys.routines(),
    queryFn: ({ signal }) => listRoutines(client, signal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
/** 주 시작 설정과 같은 범위로 로그 조회·미리 불러오기를 공유한다. */
export function monthRoutineLogsOptions(client: NodiiClient, monthKey: string, weekStart: 0 | 1) {
  const { from, to } = monthGridRange(monthKey, weekStart);
  return {
    queryKey: queryKeys.routineLogs(monthKey),
    queryFn: ({ signal }: { signal: AbortSignal }) => listLogsInRange(client, from, to, signal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  };
}
/** 완료 기록도 화면의 42칸 캐시를 사용한다. */
export function useMonthRoutineLogs(client: NodiiClient, monthKey: string, weekStart: 0 | 1) {
  return useQuery(monthRoutineLogsOptions(client, monthKey, weekStart));
}
/** 분할 중 다른 화면에서 같은 루틴 기록을 변경하지 않도록 공통 키를 사용한다. */
export const routineWriteKey = ['write', 'routine'] as const;
export interface SetRoutineLog {
  routineId: string;
  date: string;
  status: RoutineLogStatus | null;
}
/** 완료·건너뛰기·취소를 모든 겹치는 월에 반영하고 실패한 복합 키만 복원한다. */
export function useSetRoutineLog(client: NodiiClient, weekStart: 0 | 1, options: MutationOptions) {
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationKey: routineWriteKey,
    networkMode: 'always',
    retry: false,
    mutationFn: async (value: SetRoutineLog) =>
      value.status === null
        ? (await deleteLog(client, value.routineId, value.date), undefined)
        : upsertLog(client, value.routineId, value.date, value.status),
    onMutate: async (value) => {
      const snapshots = await snapshotLogs(cache, cachedLogKeys(cache, value.date, weekStart));
      const row =
        value.status === null ? undefined : { ...value, status: value.status, updatedAt: '' };
      for (const saved of snapshots)
        cache.setQueryData(saved.key, replaceLog(saved.rows, value.routineId, value.date, row));
      return snapshots;
    },
    onSuccess: (row, value, snapshots) => {
      if (!snapshots?.some((s) => snapshotAlive(cache, s))) return;
      for (const key of cachedLogKeys(cache, value.date, weekStart))
        cache.setQueryData<RoutineLogRecord[]>(
          key,
          (rows) => rows && replaceLog(rows, value.routineId, value.date, row),
        );
    },
    onError: (error, value, snapshots) => {
      for (const saved of snapshots ?? []) {
        if (!snapshotAlive(cache, saved)) continue;
        const previous = saved.rows.find(
          (log) => log.routineId === value.routineId && log.date === value.date,
        );
        cache.setQueryData<RoutineLogRecord[]>(
          saved.key,
          (rows) => rows && replaceLog(rows, value.routineId, value.date, previous),
        );
      }
      options.onError(error, () => mutation.mutate(value));
    },
  });
  return mutation;
}
/** 클라이언트 ID로 규칙 한 행만 낙관적으로 생성한다. */
export function useCreateRoutine(client: NodiiClient, options: MutationOptions) {
  return useRowMutation(
    options,
    routineWriteKey,
    (_value: Routine) => [queryKeys.routines()],
    (value) => ({ ...value, deletedAt: null, updatedAt: '' }),
    (value) => createRoutine(client, value),
  );
}
export interface UpdateRoutineInput {
  before: RoutineRecord;
  after: Routine;
  today: string;
  scope: 'all' | 'today';
  newId?: string;
}
function shouldSplit(value: UpdateRoutineInput) {
  return value.scope === 'today' && needsScopePrompt(value.before, value.after, value.today);
}
/** 규칙 변경 범위에 따라 UPDATE 또는 원자적 분할을 선택한다 (ROUT-08). */
export function useUpdateRoutine(client: NodiiClient, options: MutationOptions) {
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationKey: routineWriteKey,
    networkMode: 'always',
    retry: false,
    mutationFn: async (value: UpdateRoutineInput) =>
      shouldSplit(value)
        ? splitRoutine(client, value.before, value.after, value.today, value.newId!)
        : { routine: await updateRoutine(client, value.before.id, value.after) },
    onMutate: async (value) => {
      if (shouldSplit(value)) {
        value.newId ??= crypto.randomUUID();
        const next = {
          ...value.after,
          id: value.newId,
          startDate: value.today,
          sortKey: value.before.sortKey,
          updatedAt: '',
          deletedAt: null,
        };
        return { split: await beginRoutineSplit(cache, value.before, next, value.today) };
      }
      return {
        rows: await beginOptimistic(cache, [queryKeys.routines()], {
          ...value.before,
          ...value.after,
        }),
      };
    },
    onSuccess: (result, value, context) => {
      const snapshots = context?.split?.routines ?? context?.rows ?? [];
      if (!snapshots.some((s) => snapshotAlive(cache, s))) return;
      commitOptimistic(cache, snapshots, [queryKeys.routines()], result.routine);
      if (context?.split) {
        commitOptimistic(cache, snapshots, [queryKeys.routines()], {
          ...value.before,
          endDate: addDays(value.today, -1),
        });
        remapSplitLogs(cache, value.before.id, result.routine.id, value.today);
        void cache.invalidateQueries({ queryKey: ['routineLogs'] });
        void cache.invalidateQueries({ queryKey: queryKeys.routines() });
      }
      if ('endDateError' in result)
        options.onError(result.endDateError, () =>
          mutation.mutate({
            before: result.routine,
            after: { ...result.routine, endDate: value.after.endDate },
            today: value.today,
            scope: 'all',
          }),
        );
    },
    onError: (error, value, context) => {
      if (context?.split) rollbackRoutineSplit(cache, context.split, value.before.id, value.newId!);
      else rollbackOptimistic(cache, context?.rows ?? [], value.before.id);
      options.onError(error, () => mutation.mutate(value));
    },
  });
  return mutation;
}
/** 종료와 실행 취소는 원래 종료일 및 삭제 상태를 복원한다 (ROUT-09). */
export function useEndRoutine(client: NodiiClient, options: MutationOptions) {
  return useRowMutation(
    options,
    routineWriteKey,
    (_value: { routine: RoutineRecord; today: string; restore?: boolean }) => [
      queryKeys.routines(),
    ],
    ({ routine, today, restore }) =>
      restore || (routine.endDate !== null && routine.endDate < today)
        ? routine
        : routine.startDate >= today
          ? { ...routine, deletedAt: new Date().toISOString() }
          : { ...routine, endDate: addDays(today, -1) },
    async ({ routine, today, restore }) =>
      restore
        ? updateRoutine(client, routine.id, {
            endDate: routine.endDate,
            deletedAt: routine.deletedAt,
          })
        : (await endRoutine(client, routine.id, today)).routine,
  );
}
/** 모든 날짜에서 숨기는 삭제도 5초 실행 취소를 지원한다. */
export function useDeleteRoutine(client: NodiiClient, options: MutationOptions) {
  return useRowMutation(
    options,
    routineWriteKey,
    (_value: { routine: RoutineRecord; restore?: boolean }) => [queryKeys.routines()],
    ({ routine, restore }) => ({
      ...routine,
      deletedAt: restore ? null : new Date().toISOString(),
    }),
    ({ routine, restore }) =>
      restore
        ? updateRoutine(client, routine.id, { deletedAt: null })
        : softDeleteRoutine(client, routine.id),
  );
}
