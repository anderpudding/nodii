import { useRef, useState } from 'react';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import {
  monthTodosOptions,
  useBulkDeleteTodos,
  useBulkMoveTodos,
  useImportOverdue,
  type NodiiClient,
  type TodoRecord,
  type TodoMove,
} from '@nodii/api';
import { monthKeyOf, type ISODate } from '@nodii/core';
import { t } from '@nodii/i18n';
import { useToast } from '../../components/Toast';
import { formatMoveDate } from './calendar-model';
import { planDayMove } from './day-menu-model';

/** TODO-10~12: 쓰기/복원은 기존 훅에 맡기고 날짜별 준비 잠금과 실패한 복원 그룹만 관리한다. */
export function useDayActions(client: NodiiClient, weekStart: 0 | 1) {
  const cache = useQueryClient();
  const toast = useToast();
  const locks = useRef(new Set<ISODate>());
  const [lockedDates, setLockedDates] = useState<Set<ISODate>>(new Set());
  // 각 호출 경계가 일반 실패를 알리고, 복원 실패는 ToastProvider가 재시도를 유지한다.
  const options = { onError: () => {} };
  const move = useBulkMoveTodos(client, weekStart, options);
  const remove = useBulkDeleteTodos(client, weekStart, options);
  const imports = useImportOverdue(client, weekStart, options);
  // 행 쓰기 중 묶음이 시작해 오래된 완료/정렬 스냅샷을 덮지 않게 한다.
  useIsMutating({ mutationKey: ['write', 'todo'] });
  function rowWriting(date: ISODate) {
    return (
      cache.isMutating({
        mutationKey: ['write', 'todo'],
        predicate: (mutation) => {
          const value: unknown = mutation.state.variables;
          if (!value || typeof value !== 'object') return false;
          const row = 'todo' in value ? value.todo : value;
          return !!row && typeof row === 'object' && 'date' in row && row.date === date;
        },
      }) > 0
    );
  }
  function latest(id: string) {
    return cache
      .getQueriesData<TodoRecord[]>({ queryKey: ['todos'] })
      .flatMap(([, rows]) => rows ?? [])
      .find((row) => row.id === id && !row.deletedAt);
  }
  async function locked<T>(dates: ISODate[], request: () => Promise<T>): Promise<T> {
    if (dates.some((date) => locks.current.has(date) || rowWriting(date)))
      throw new Error('day_busy');
    for (const date of dates) locks.current.add(date);
    setLockedDates(new Set(locks.current));
    try {
      return await request();
    } finally {
      for (const date of dates) locks.current.delete(date);
      setLockedDates(new Set(locks.current));
    }
  }
  function originalsStillActive(originals: TodoRecord[]) {
    return originals.every((todo) => {
      const row = latest(todo.id);
      return row && !row.isDone && row.date === todo.date && row.sortKey === todo.sortKey;
    });
  }
  function undoMove(originals: TodoRecord[], destination: ISODate) {
    const restored = new Set<ISODate>();
    return () =>
      locked([...new Set([destination, ...originals.map((row) => row.date)])], async () => {
        // 기존 RPC는 목적 날짜 하나만 받는다. 성공한 원래 날짜 그룹은 재시도에서 제외한다.
        for (const date of new Set(originals.map((row) => row.date))) {
          if (restored.has(date)) continue;
          const group = originals.filter((row) => row.date === date);
          const current = group.map((row) => latest(row.id));
          if (current.some((row) => !row)) throw new Error('todo_no_longer_active');
          await move.mutateAsync({
            todos: current as TodoRecord[],
            moves: group.map((row) => ({ id: row.id, sort_key: row.sortKey })),
            date,
          });
          restored.add(date);
        }
      });
  }
  async function moveTo(originals: TodoRecord[], date: ISODate) {
    if (!originals.length || originals.every((row) => row.date === date)) return;
    try {
      await locked([...new Set(originals.map((row) => row.date))], async () => {
        await cache.ensureQueryData(monthTodosOptions(client, monthKeyOf(date), weekStart));
        const target = cache.getQueryData<TodoRecord[]>(['todos', monthKeyOf(date)]) ?? [];
        if (!originalsStillActive(originals)) throw new Error('todos_changed');
        const moves = planDayMove(originals, target, date);
        await move.mutateAsync({ todos: originals, moves, date });
        toast(
          t('day.menu.moved', { count: originals.length, date: formatMoveDate(date) }),
          undoMove(originals, date),
        );
      });
    } catch {
      toast(t('todo.save.failed'));
    }
  }
  async function importOverdue(originals: TodoRecord[], moves: TodoMove[], today: ISODate) {
    if (!moves.length) return;
    try {
      await locked([today], async () => {
        await imports.mutateAsync({ overdue: originals, moves, today });
        toast(t('day.menu.imported', { count: originals.length }), undoMove(originals, today));
      });
    } catch {
      toast(t('todo.save.failed'));
    }
  }
  async function deleteTodos(originals: TodoRecord[]) {
    if (!originals.length) return;
    const dates = [...new Set(originals.map((row) => row.date))];
    try {
      await locked(dates, async () => {
        if (!originalsStillActive(originals)) throw new Error('todos_changed');
        const saved = await remove.mutateAsync({ todos: originals });
        toast(t('day.menu.deleted', { count: originals.length }), () =>
          locked(dates, async () => {
            await remove.mutateAsync({ todos: saved, restore: true });
          }),
        );
      });
    } catch {
      toast(t('todo.save.failed'));
    }
  }
  return {
    moveTo,
    importOverdue,
    deleteTodos,
    isDateLocked: (date: ISODate) => locks.current.has(date),
    dateBusy: (date: ISODate) => lockedDates.has(date) || rowWriting(date),
  };
}
