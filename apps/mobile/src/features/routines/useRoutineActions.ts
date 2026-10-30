import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  routineLogWriteKey,
  routineRowWriteKey,
  routineWriteKey,
  useRoutineWritePending,
  useSetRoutineLog,
  type NodiiClient,
  type RoutineLogRecord,
} from '@nodii/api';
import type { ISODate, Routine, RoutineLogStatus } from '@nodii/core';
import { t } from '@nodii/i18n';
import { useToast } from '../../components/Toast';
import { routineToastMessage } from './messages';

/** ROUT-06~07: 사라진 행의 복원도 Provider에 남고 다른 루틴의 체크를 막지 않는다. */
export function useRoutineActions(
  client: NodiiClient,
  weekStart: 0 | 1,
  routine: Routine,
  date: ISODate,
) {
  const cache = useQueryClient();
  const toast = useToast();
  const busy = useRef(false);
  const undoing = useRef(false);
  const pending = useRoutineWritePending(routine.id, date);
  const log = useSetRoutineLog(client, weekStart, routine.id, date, {
    onError: () => {
      if (!undoing.current) toast(() => t('todo.save.failed'));
    },
  });
  function currentStatus() {
    return (
      cache
        .getQueriesData<RoutineLogRecord[]>({ queryKey: ['routineLogs'] })
        .flatMap(([, rows]) => rows ?? [])
        .find((row) => row.routineId === routine.id && row.date === date)?.status ?? null
    );
  }
  function writing() {
    return (
      cache.isMutating({ mutationKey: routineWriteKey, exact: true }) ||
      cache.isMutating({ mutationKey: routineRowWriteKey(routine.id), exact: true }) ||
      cache.isMutating({ mutationKey: routineLogWriteKey(routine.id, date), exact: true })
    );
  }
  async function write(status: RoutineLogStatus | null, undo = false) {
    if (busy.current || writing()) throw new Error('routine_busy');
    busy.current = true;
    undoing.current = undo;
    try {
      await log.mutateAsync({ routineId: routine.id, date, status });
    } finally {
      busy.current = false;
      undoing.current = false;
    }
  }
  async function run(action: 'toggle' | 'skip') {
    if (busy.current || writing()) return;
    const before = currentStatus();
    const after =
      action === 'toggle'
        ? before === 'done'
          ? null
          : 'done'
        : before === 'skipped'
          ? null
          : 'skipped';
    try {
      await write(after);
      toast(
        () =>
          routineToastMessage(
            action === 'skip'
              ? after === 'skipped'
                ? 'routine.skipped'
                : 'routine.unskipped'
              : after === 'done'
                ? 'todo.toggled'
                : 'todo.untoggled',
            routine.title,
          ),
        async () => {
          // 이후의 편집·삭제·체크를 이전 실행 취소로 덮지 않는다.
          const active = cache
            .getQueryData<Routine[]>(['routines'])
            ?.some((row) => row.id === routine.id);
          if (!active) throw new Error('routine_no_longer_active');
          if (currentStatus() === after) await write(before, true);
        },
      );
    } catch {
      /* API 훅이 롤백과 오류 토스트를 처리한다. */
    }
  }
  return { run, pending, locallyBusy: () => busy.current };
}
