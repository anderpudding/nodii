import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assertOnline } from '../connectivity';
import type { NodiiClient } from '../client';
import type { TodoRecord } from '../mappers';
import { moveTodo, moveTodos, type TodoMove } from '../repositories/todos';
import { beginTodoMove, commitTodoMove, rollbackTodoMove } from '../todo-move-cache';
import { todoWriteKey, type MutationOptions } from './mutations';

export interface MoveTodoInput {
  todo: TodoRecord;
  date: string;
  sortKey: string;
}
/** 단건 이동과 실행 취소는 원래 날짜·새 날짜의 겹치는 캐시를 모두 갱신한다. */
export function useMoveTodo(
  client: NodiiClient,
  weekStart: 0 | 1,
  id: string,
  options: MutationOptions,
) {
  const cache = useQueryClient();
  const after = ({ todo, date, sortKey }: MoveTodoInput) => ({ ...todo, date, sortKey });
  const mutation = useMutation({
    mutationKey: todoWriteKey(id),
    networkMode: 'always',
    retry: false,
    mutationFn: ({ todo, date, sortKey }: MoveTodoInput) => {
      assertOnline();
      return moveTodo(client, todo.id, date, sortKey);
    },
    onMutate: (input: MoveTodoInput) => {
      assertOnline();
      return beginTodoMove(cache, [input.todo], [after(input)], weekStart);
    },
    onSuccess: (saved, input, snapshots) => {
      commitTodoMove(cache, snapshots ?? [], [input.todo], [saved], weekStart);
      void cache.invalidateQueries({ queryKey: ['overdue'] });
    },
    onError: (error, input, snapshots) => {
      rollbackTodoMove(cache, snapshots ?? [], [input.todo]);
      options.onError(error, () => mutation.mutate(input));
    },
  });
  return mutation;
}
export interface ImportOverdueInput {
  overdue: TodoRecord[];
  moves: TodoMove[];
  today: string;
}
/** 배너에 표시한 계획을 그대로 받아 RPC와 낙관적 화면의 대상이 일치하게 한다. */
export function useImportOverdue(client: NodiiClient, weekStart: 0 | 1, options: MutationOptions) {
  const cache = useQueryClient();
  const rows = (input: ImportOverdueInput) =>
    input.moves.map((move) => {
      const todo = input.overdue.find((row) => row.id === move.id);
      if (!todo) throw new Error('missing_overdue_todo');
      return { ...todo, date: input.today, sortKey: move.sort_key };
    });
  const mutation = useMutation({
    mutationKey: ['write', 'import'],
    networkMode: 'always',
    retry: false,
    mutationFn: (input: ImportOverdueInput) => {
      assertOnline();
      return moveTodos(client, input.moves, input.today);
    },
    onMutate: (input: ImportOverdueInput) => {
      assertOnline();
      return beginTodoMove(cache, input.overdue, rows(input), weekStart, input.today);
    },
    onSuccess: (_result, input, snapshots) => {
      commitTodoMove(cache, snapshots ?? [], input.overdue, rows(input), weekStart);
      // RPC는 void이므로 서버 updated_at과 동시 변경은 재조회로 받는다.
      void cache.invalidateQueries({ queryKey: ['todos'] });
      void cache.invalidateQueries({ queryKey: ['overdue'] });
    },
    onError: (error, input, snapshots) => {
      rollbackTodoMove(cache, snapshots ?? [], input.overdue);
      options.onError(error, () => mutation.mutate(input));
    },
  });
  return mutation;
}
