import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assertOnline } from '../connectivity';
import type { NodiiClient } from '../client';
import type { TodoRecord } from '../mappers';
import { moveTodos, restoreTodos, softDeleteTodos, type TodoMove } from '../repositories/todos';
import { beginTodoMove, commitTodoMove, rollbackTodoMove } from '../todo-move-cache';
import type { MutationOptions } from './mutations';

export interface BulkMoveTodosInput {
  todos: TodoRecord[];
  moves: TodoMove[];
  date: string;
}

/** 하루 단위 이동과 원래 순서 복원에 기존 원자적 RPC를 사용한다 (TODO-11). */
export function useBulkMoveTodos(client: NodiiClient, weekStart: 0 | 1, options: MutationOptions) {
  const cache = useQueryClient();
  const rows = (input: BulkMoveTodosInput) =>
    input.moves.map((move) => {
      const todo = input.todos.find((row) => row.id === move.id);
      if (!todo) throw new Error('missing_bulk_todo');
      return { ...todo, date: input.date, sortKey: move.sort_key };
    });
  const mutation = useMutation({
    mutationKey: ['write', 'bulkMoveTodos'],
    networkMode: 'always',
    retry: false,
    mutationFn: (input: BulkMoveTodosInput) => {
      assertOnline();
      return moveTodos(client, input.moves, input.date);
    },
    onMutate: (input: BulkMoveTodosInput) => {
      assertOnline();
      return beginTodoMove(cache, input.todos, rows(input), weekStart);
    },
    onSuccess: (_, input, snapshots) => {
      commitTodoMove(cache, snapshots ?? [], input.todos, rows(input), weekStart);
      void cache.invalidateQueries({ queryKey: ['todos'] });
      void cache.invalidateQueries({ queryKey: ['overdue'] });
    },
    onError: (error, input, snapshots) => {
      rollbackTodoMove(cache, snapshots ?? [], input.todos);
      options.onError(error, () => mutation.mutate(input));
    },
  });
  return mutation;
}

export interface BulkDeleteTodosInput {
  todos: TodoRecord[];
  restore?: boolean;
}

/** 삭제·복원을 겹치는 월과 지난 목록에 반영하고 실패한 행만 되돌린다 (TODO-12). */
export function useBulkDeleteTodos(
  client: NodiiClient,
  weekStart: 0 | 1,
  options: MutationOptions,
) {
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationKey: ['write', 'bulkDeleteTodos'],
    networkMode: 'always',
    retry: false,
    mutationFn: (input: BulkDeleteTodosInput) => {
      assertOnline();
      const ids = input.todos.map((todo) => todo.id);
      return input.restore ? restoreTodos(client, ids) : softDeleteTodos(client, ids);
    },
    onMutate: (input: BulkDeleteTodosInput) => {
      assertOnline();
      const deletedAt = input.restore ? null : new Date().toISOString();
      return beginTodoMove(
        cache,
        input.todos,
        input.todos.map((todo) => ({ ...todo, deletedAt })),
        weekStart,
      );
    },
    onSuccess: (saved, input, snapshots) => {
      commitTodoMove(cache, snapshots ?? [], input.todos, saved, weekStart);
      void cache.invalidateQueries({ queryKey: ['overdue'] });
      void cache.invalidateQueries({ queryKey: ['goalContents'] });
    },
    onError: (error, input, snapshots) => {
      rollbackTodoMove(cache, snapshots ?? [], input.todos);
      // 200개 단위 요청 중 일부만 성공한 경우 서버의 실제 상태도 다시 확인한다.
      void cache.invalidateQueries({ queryKey: ['todos'] });
      void cache.invalidateQueries({ queryKey: ['overdue'] });
      options.onError(error, () => mutation.mutate(input));
    },
  });
  return mutation;
}
