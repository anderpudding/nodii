import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { Goal, Todo } from '@nodii/core';
import type { NodiiClient } from '../client';
import type { GoalChanges, GoalRecord, TodoRecord } from '../mappers';
import {
  beginOptimistic,
  cachedTodoKeys,
  commitOptimistic,
  rollbackOptimistic,
} from '../optimistic';
import { assertOnline } from '../connectivity';
import { queryKeys } from '../query-keys';
import { archiveGoal, createGoal, unarchiveGoal, updateGoal } from '../repositories/goals';
import { createTodo, softDeleteTodo, updateTodo } from '../repositories/todos';

export interface MutationOptions {
  onError: (error: unknown, retry: () => void) => void;
}
interface MutationRow {
  id: string;
  deletedAt: string | null;
}
export function useRowMutation<V, T extends MutationRow>(
  options: MutationOptions,
  key: QueryKey,
  keys: (value: V) => QueryKey[],
  optimistic: (value: V) => T,
  request: (value: V) => Promise<T>,
) {
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationKey: key,
    // 오프라인 큐를 만들지 않고 즉시 실패·롤백한다 (MVP: 오프라인 쓰기 제외).
    networkMode: 'always',
    retry: false,
    mutationFn: (value: V) => {
      assertOnline();
      return request(value);
    },
    onMutate: (value: V) => {
      assertOnline();
      return beginOptimistic(cache, keys(value), optimistic(value));
    },
    onSuccess: (row, value, snapshots) => {
      commitOptimistic(cache, snapshots ?? [], keys(value), row);
      void cache.invalidateQueries({ queryKey: ['goalContents'] });
      if (key[1] === 'todo' || key[1] === 'goal')
        void cache.invalidateQueries({ queryKey: ['overdue'] });
    },
    onError: (error, value, snapshots) => {
      rollbackOptimistic(cache, snapshots ?? [], optimistic(value).id);
      options.onError(error, () => mutation.mutate(value));
    },
  });
  return mutation;
}
const todoRecord = (todo: Todo): TodoRecord => ({
  ...todo,
  updatedAt: '',
  doneAt: null,
  deletedAt: null,
});
const goalRecord = (goal: Goal): GoalRecord => ({ ...goal, updatedAt: '', deletedAt: null });

/** 새 할 일을 모든 겹치는 월에 바로 표시한다 (TODO-01). */
export function useCreateTodo(client: NodiiClient, weekStart: 0 | 1, options: MutationOptions) {
  const cache = useQueryClient();
  return useRowMutation(
    options,
    ['write', 'todo', 'create'],
    (todo: Todo) => cachedTodoKeys(cache, todo.date, weekStart),
    todoRecord,
    (todo) => createTodo(client, todo),
  );
}
/** 한 행의 체크·제목·삭제 요청이 겹치지 않도록 UI에서 공통 키를 관찰한다. */
export const todoWriteKey = (id: string) => ['write', 'todo', id] as const;

/** 체크와 완료 시각을 함께 낙관적으로 변경한다 (TODO-02). */
export function useToggleTodo(
  client: NodiiClient,
  weekStart: 0 | 1,
  id: string,
  options: MutationOptions,
) {
  const cache = useQueryClient();
  return useRowMutation(
    options,
    todoWriteKey(id),
    (todo: TodoRecord) => cachedTodoKeys(cache, todo.date, weekStart),
    (todo) => ({
      ...todo,
      isDone: !todo.isDone,
      doneAt: todo.isDone ? null : new Date().toISOString(),
    }),
    (todo) => updateTodo(client, todo.id, { isDone: !todo.isDone }),
  );
}
/** 수정한 제목을 서버 응답 전에 표시한다 (TODO-03). */
export function useRenameTodo(
  client: NodiiClient,
  weekStart: 0 | 1,
  id: string,
  options: MutationOptions,
) {
  const cache = useQueryClient();
  return useRowMutation(
    options,
    todoWriteKey(id),
    ({ todo }: { todo: TodoRecord; title: string }) => cachedTodoKeys(cache, todo.date, weekStart),
    ({ todo, title }) => ({ ...todo, title }),
    ({ todo, title }) => updateTodo(client, todo.id, { title }),
  );
}
/** 삭제와 실행 취소를 같은 캐시 경로로 처리한다 (TODO-04). */
export function useDeleteTodo(
  client: NodiiClient,
  weekStart: 0 | 1,
  id: string,
  options: MutationOptions,
) {
  const cache = useQueryClient();
  return useRowMutation(
    options,
    todoWriteKey(id),
    ({ todo }: { todo: TodoRecord; restore?: boolean }) =>
      cachedTodoKeys(cache, todo.date, weekStart),
    ({ todo, restore }) => ({ ...todo, deletedAt: restore ? null : new Date().toISOString() }),
    ({ todo, restore }) =>
      restore ? updateTodo(client, todo.id, { deletedAt: null }) : softDeleteTodo(client, todo.id),
  );
}
/** 새 목표를 목표 목록 전체에 즉시 표시한다 (GOAL-01). */
export function useCreateGoal(client: NodiiClient, options: MutationOptions) {
  return useRowMutation(
    options,
    ['write', 'goal', 'create'],
    (_goal: Goal) => [queryKeys.goals()],
    goalRecord,
    (goal) => createGoal(client, goal),
  );
}
/** 이름과 프리셋 색을 낙관적으로 갱신한다 (GOAL-02). */
export function useUpdateGoal(client: NodiiClient, id: string, options: MutationOptions) {
  return useRowMutation(
    options,
    ['write', 'goal', id],
    (_value: { goal: GoalRecord; changes: GoalChanges }) => [queryKeys.goals()],
    ({ goal, changes }) => ({ ...goal, ...changes }),
    ({ goal, changes }) => updateGoal(client, goal.id, changes),
  );
}
/** 마지막 목표 제약의 서버 오류도 공통 롤백 경로로 알린다 (GOAL-07). */
export function useArchiveGoal(client: NodiiClient, id: string, options: MutationOptions) {
  return useRowMutation(
    options,
    ['write', 'goal', id],
    (_goal: GoalRecord) => [queryKeys.goals()],
    (goal) => ({ ...goal, archivedAt: goal.archivedAt ? null : new Date().toISOString() }),
    (goal) => (goal.archivedAt ? unarchiveGoal(client, goal.id) : archiveGoal(client, goal.id)),
  );
}

/** TODO-06: 루틴을 포함한 이웃 사이에 이동한 할 일 한 행만 갱신한다. */
export function useReorderTodo(client: NodiiClient, weekStart: 0 | 1, options: MutationOptions) {
  const cache = useQueryClient();
  return useRowMutation(
    options,
    ['write', 'todo', 'reorder'],
    ({ todo }: { todo: TodoRecord; sortKey: string }) =>
      cachedTodoKeys(cache, todo.date, weekStart),
    ({ todo, sortKey }) => ({ ...todo, sortKey }),
    ({ todo, sortKey }) => updateTodo(client, todo.id, { sortKey }),
  );
}
