import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Profile } from '@nodii/core';
import type { NodiiClient } from '../client';
import { assertOnline } from '../connectivity';
import { countAllGoalContents, updateWeekStart } from '../settings';
import type { MutationOptions } from './mutations';

/** 목표별 요청을 만들지 않고 시트 전체에서 같은 집계 결과를 사용한다. */
export function useGoalContents(client: NodiiClient) {
  return useQuery({
    queryKey: ['goalContents'],
    queryFn: ({ signal }) => countAllGoalContents(client, signal),
    staleTime: 0,
  });
}
/** CAL-05: 표시를 바로 바꾸고 성공·롤백 모두 새 그리드 범위로 다시 조회한다. */
export function useUpdateWeekStart(client: NodiiClient, userId: string, options: MutationOptions) {
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationKey: ['write', 'profile', userId],
    networkMode: 'always',
    retry: false,
    mutationFn: (value: 0 | 1) => {
      assertOnline();
      return updateWeekStart(client, userId, value);
    },
    onMutate: async (weekStart) => {
      assertOnline();
      await cache.cancelQueries({ queryKey: ['profile', userId] });
      await Promise.all(
        ['todos', 'routineLogs'].map((key) => cache.cancelQueries({ queryKey: [key] })),
      );
      const snapshots = cache
        .getQueriesData<Profile>({ queryKey: ['profile', userId] })
        .map(([key, profile]) => ({
          key,
          profile,
          query: cache.getQueryCache().find({ queryKey: key, exact: true }),
        }));
      cache.setQueriesData<Profile>(
        { queryKey: ['profile', userId] },
        (profile) => profile && { ...profile, weekStart },
      );
      return snapshots;
    },
    onError: (error, value, snapshots) => {
      for (const { key, profile, query } of snapshots ?? [])
        if (cache.getQueryCache().find({ queryKey: key, exact: true }) === query)
          cache.setQueryData(key, profile);
      options.onError(error, () => mutation.mutate(value));
    },
    onSettled: () => {
      for (const key of ['todos', 'routineLogs']) void cache.invalidateQueries({ queryKey: [key] });
    },
  });
  return mutation;
}
