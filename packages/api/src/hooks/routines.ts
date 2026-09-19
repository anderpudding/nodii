import { addDays, monthGridRange, type Routine, type RoutineLogStatus } from '@nodii/core';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NodiiClient } from '../client';
import type { RoutineLogRecord, RoutineRecord } from '../mappers';
import { commitOptimistic } from '../optimistic';
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
/** 분할만 공유 키를 사용하며 구독할 때는 exact로 행별 쓰기와 구분한다. */
export const routineWriteKey = ['write', 'routine'] as const;
/** 서로 다른 루틴의 규칙 저장이 각자의 화면만 잠그도록 분리한다. */
export const routineRowWriteKey = (id: string) => [...routineWriteKey, id] as const;
/** 같은 날짜의 완료·건너뛰기·취소만 중복 요청을 막는다. */
export const routineLogWriteKey = (id: string, date: string) =>
  ['write', 'routineLog', id, date] as const;
/** 행은 그날 로그만, 편집기는 해당 루틴의 모든 날짜 로그가 끝나기를 기다린다. */
export function useRoutineWritePending(id: string, date?: string) {
  const splitting = useIsMutating({
    mutationKey: routineWriteKey,
    exact: true,
  });
  const writing = useIsMutating({ mutationKey: routineRowWriteKey(id), exact: true });
  const logging = useIsMutating({
    mutationKey: date ? routineLogWriteKey(id, date) : ['write', 'routineLog', id],
    exact: !!date,
  });
  return splitting + writing + logging > 0;
}

export interface SetRoutineLog {
  routineId: string;
  date: string;
  status: RoutineLogStatus | null;
}
/** 완료·건너뛰기·취소를 모든 겹치는 월에 반영하고 실패한 복합 키만 복원한다. */
export function useSetRoutineLog(
  client: NodiiClient,
  weekStart: 0 | 1,
  routineId: string,
  date: string,
  options: MutationOptions,
) {
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationKey: routineLogWriteKey(routineId, date),
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
export function useCreateRoutine(client: NodiiClient, id: string, options: MutationOptions) {
  return useRowMutation(
    options,
    routineRowWriteKey(id),
    (_value: Routine) => [queryKeys.routines()],
    (value) => ({ ...value, deletedAt: null, updatedAt: '' }),
    (value) => createRoutine(client, value),
  );
}
export interface UpdateRoutineInput {
  before: RoutineRecord;
  after: Routine;
}
/** 제목·목표·종료일과 전체 범위 규칙 변경은 해당 루틴만 잠근다 (ROUT-08). */
export function useUpdateRoutine(client: NodiiClient, id: string, options: MutationOptions) {
  return useRowMutation(
    options,
    routineRowWriteKey(id),
    (_value: UpdateRoutineInput) => [queryKeys.routines()],
    ({ before, after }) => ({ ...before, ...after }),
    ({ before, after }) => updateRoutine(client, before.id, after),
  );
}
interface SplitRoutineInput extends UpdateRoutineInput {
  today: string;
}
/** 분할은 규칙 두 행과 여러 날짜의 로그를 함께 바꾸므로 공유 키로 보호한다. */
export function useSplitRoutine(client: NodiiClient, newId: string, options: MutationOptions) {
  const cache = useQueryClient();
  // 분할 후 종료일만 재시도할 때에는 새 행의 키를 사용하고 재분할하지 않는다.
  const update = useUpdateRoutine(client, newId, options);
  const mutation = useMutation({
    mutationKey: routineWriteKey,
    networkMode: 'always',
    retry: false,
    mutationFn: (value: SplitRoutineInput) =>
      splitRoutine(client, value.before, value.after, value.today, newId),
    onMutate: (value) =>
      beginRoutineSplit(
        cache,
        value.before,
        {
          ...value.after,
          id: newId,
          startDate: value.today,
          sortKey: value.before.sortKey,
          updatedAt: '',
          deletedAt: null,
        },
        value.today,
      ),
    onSuccess: (result, value, snapshot) => {
      const snapshots = snapshot?.routines ?? [];
      if (!snapshots.some((s) => snapshotAlive(cache, s))) return;
      commitOptimistic(cache, snapshots, [queryKeys.routines()], result.routine);
      commitOptimistic(cache, snapshots, [queryKeys.routines()], {
        ...value.before,
        endDate: addDays(value.today, -1),
      });
      remapSplitLogs(cache, value.before.id, result.routine.id, value.today);
      void cache.invalidateQueries({ queryKey: ['routineLogs'] });
      void cache.invalidateQueries({ queryKey: queryKeys.routines() });
      if ('endDateError' in result)
        options.onError(result.endDateError, () =>
          update.mutate({
            before: result.routine,
            after: { ...result.routine, endDate: value.after.endDate },
          }),
        );
    },
    onError: (error, value, snapshot) => {
      if (snapshot) rollbackRoutineSplit(cache, snapshot, value.before.id, newId);
      options.onError(error, () => mutation.mutate(value));
    },
  });
  return mutation;
}
/** 종료와 실행 취소는 원래 종료일 및 삭제 상태를 복원한다 (ROUT-09). */
export function useEndRoutine(client: NodiiClient, id: string, options: MutationOptions) {
  return useRowMutation(
    options,
    routineRowWriteKey(id),
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
export function useDeleteRoutine(client: NodiiClient, id: string, options: MutationOptions) {
  return useRowMutation(
    options,
    routineRowWriteKey(id),
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
