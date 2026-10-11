import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  monthTodosOptions,
  todoWriteKey,
  useDeleteTodo,
  useMoveTodo,
  useRenameTodo,
  useToggleTodo,
  type NodiiClient,
  type TodoRecord,
} from '@nodii/api';
import { addDays, keyBetween, lastSortKey, monthKeyOf } from '@nodii/core';
import { t, withParticle, type MessageKey } from '@nodii/i18n';
import { useToast } from '../../components/Toast';
import type { TodoAction } from './actions';

/** TODO-02~05: 네 경로는 기존 API 훅을 사용하고 실행 취소도 같은 낙관적 경로로 쓴다. */
export function useTodoActions(client: NodiiClient, weekStart: 0 | 1, todo: TodoRecord) {
  const cache = useQueryClient();
  const toast = useToast();
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const undoing = useRef(false);
  const options = {
    onError: () => {
      if (!undoing.current) toast(t('todo.save.failed'));
    },
  };
  const toggle = useToggleTodo(client, weekStart, todo.id, options);
  const remove = useDeleteTodo(client, weekStart, todo.id, options);
  const move = useMoveTodo(client, weekStart, todo.id, options);
  const rename = useRenameTodo(client, weekStart, todo.id, options);
  function active() {
    return cache
      .getQueriesData<TodoRecord[]>({ queryKey: ['todos'] })
      .flatMap(([, rows]) => rows ?? [])
      .find((row) => row.id === todo.id && !row.deletedAt);
  }
  function current(fallback: TodoRecord) {
    return active() ?? fallback;
  }
  function currentForUndo() {
    const row = active();
    // 나중에 삭제한 행은 이전 완료/이동 실행 취소로 되살리지 않는다. 삭제 복원만 tombstone을 쓴다.
    if (!row) throw new Error('todo_no_longer_active');
    return row;
  }
  function message(key: MessageKey, row: TodoRecord) {
    return t(key, {
      title: row.title,
      particle: withParticle(row.title, '을/를').slice(row.title.length),
    });
  }
  async function locked<T>(request: () => Promise<T>, undo = false): Promise<T> {
    if (busy.current || cache.isMutating({ mutationKey: todoWriteKey(todo.id) }))
      throw new Error('todo_busy');
    busy.current = true;
    setPending(true);
    undoing.current = undo;
    try {
      return await request();
    } finally {
      busy.current = false;
      setPending(false);
      undoing.current = false;
    }
  }
  async function run(action: Exclude<TodoAction, 'rename'>) {
    if (busy.current || cache.isMutating({ mutationKey: todoWriteKey(todo.id) })) return;
    const before = current(todo);
    let preparationFailed = false;
    try {
      await locked(async () => {
        if (action === 'toggle') {
          await toggle.mutateAsync(before);
          toast(message(before.isDone ? 'todo.untoggled' : 'todo.toggled', before), () =>
            locked(async () => {
              const latest = currentForUndo();
              if (latest.isDone !== before.isDone) await toggle.mutateAsync(latest);
            }, true),
          );
        } else if (action === 'delete') {
          const saved = await remove.mutateAsync({ todo: before });
          toast(message('todo.deleted', before), () =>
            locked(async () => {
              await remove.mutateAsync({ todo: current(saved), restore: true });
            }, true),
          );
        } else {
          const date = addDays(before.date, 1);
          // 다음 달이 아직 캐시되지 않았으면 그 달을 먼저 읽어 목적 목표의 맨 아래 키를 만든다.
          const rows = await cache
            .ensureQueryData(monthTodosOptions(client, monthKeyOf(date), weekStart))
            .catch((error: unknown) => {
              preparationFailed = true;
              throw error;
            });
          const sortKey = keyBetween(
            lastSortKey(
              rows.filter(
                (row) =>
                  !row.deletedAt &&
                  row.date === date &&
                  row.goalId === before.goalId &&
                  row.id !== before.id,
              ),
            ),
            null,
          );
          await move.mutateAsync({ todo: before, date, sortKey });
          toast(message('todo.moved', before), () =>
            locked(async () => {
              await move.mutateAsync({
                todo: currentForUndo(),
                date: before.date,
                sortKey: before.sortKey,
              });
            }, true),
          );
        }
      });
    } catch {
      // 조회 실패도 쓰기 실패와 같은 안내를 갖고 훅이 맡은 롤백은 중복하지 않는다.
      if (preparationFailed) toast(t('todo.save.failed'));
    }
  }
  async function saveTitle(title: string) {
    await locked(async () => {
      await rename.mutateAsync({ todo: current(todo), title });
    });
  }
  return { run, saveTitle, pending, locallyBusy: () => busy.current };
}
