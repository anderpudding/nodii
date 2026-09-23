import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assertOnline } from '../connectivity';
import type { NodiiClient } from '../client';
import type { GoalRecord, RoutineRecord, TodoRecord } from '../mappers';
import { deleteGoal } from '../repositories/goals';
import type { MutationOptions } from './mutations';

type Row = GoalRecord | RoutineRecord | TodoRecord;
/** GOAL-06: 관련 캐시 전체에서 제거하고 실패한 목표의 행만 복원한다. */
export function useDeleteGoal(client: NodiiClient, options: MutationOptions) {
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationKey: ['write', 'goal', 'delete'],
    networkMode: 'always',
    retry: false,
    mutationFn: (goal: GoalRecord) => {
      assertOnline();
      return deleteGoal(client, goal.id);
    },
    onMutate: async (goal: GoalRecord) => {
      assertOnline();
      const keys = ['goals', 'todos', 'routines', 'overdue'];
      await Promise.all(keys.map((key) => cache.cancelQueries({ queryKey: [key] })));
      return keys.flatMap((prefix) =>
        cache.getQueriesData<Row[]>({ queryKey: [prefix] }).flatMap(([key, rows]) => {
          if (!rows) return [];
          const removed = rows.filter((row) =>
            prefix === 'goals' ? row.id === goal.id : 'goalId' in row && row.goalId === goal.id,
          );
          const ids = new Set(removed.map((row) => row.id));
          const query = cache.getQueryCache().find({ queryKey: key, exact: true });
          cache.setQueryData(
            key,
            rows.filter((row) => !ids.has(row.id)),
          );
          return [{ key, removed, query }];
        }),
      );
    },
    onError: (error, goal, snapshots) => {
      for (const { key, removed, query } of snapshots ?? [])
        if (cache.getQueryCache().find({ queryKey: key, exact: true }) === query)
          cache.setQueryData<Row[]>(
            key,
            (rows) =>
              rows && [
                ...rows,
                ...removed.filter((row) => !rows.some((current) => current.id === row.id)),
              ],
          );
      options.onError(error, () => mutation.mutate(goal));
    },
    onSettled: () => {
      for (const key of ['goals', 'todos', 'routines', 'overdue', 'goalContents'])
        void cache.invalidateQueries({ queryKey: [key] });
    },
  });
  return mutation;
}
