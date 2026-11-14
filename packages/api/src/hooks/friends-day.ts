import { keyBetween, orderTodayPeople, type DefaultVisibility, type ISODate } from '@nodii/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NodiiClient } from '../client';
import { assertOnline } from '../connectivity';
import { listGoals } from '../repositories/goals';
import { listTodosInRange } from '../repositories/todos';
import { listRoutines } from '../repositories/routines';
import { listLogsInRange } from '../repositories/routine-logs';
import {
  fetchTodayPeople,
  updateTodayPerson,
  type TodayPerson,
  type TodayPersonPatch,
} from '../repositories/today-people';
import type { GoalRecord } from '../mappers';
import { useUpdateGoal, type MutationOptions } from './mutations';

export interface FriendDayRange {
  from: ISODate;
  to: ISODate;
}

/** SOC-33: 같은 친구의 전체 범위를 한 응답으로 교체해 스탬프와 목록을 일치시킨다. */
export function friendDayOptions(
  client: NodiiClient,
  friendId: string | null,
  range: FriendDayRange,
) {
  const { from, to } = range;
  return {
    queryKey: ['friend', friendId, from, to] as const,
    enabled: friendId !== null,
    staleTime: 30_000,
    gcTime: 0,
    retry: false,
    refetchOnMount: 'always' as const,
    refetchOnWindowFocus: 'always' as const,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      if (friendId === null) throw new Error('friend_required');
      const [goals, todos, routines, logs] = await Promise.all([
        listGoals(client, friendId, signal),
        listTodosInRange(client, friendId, from, to, signal),
        listRoutines(client, friendId, signal),
        listLogsInRange(client, friendId, from, to, signal),
      ]);
      return { goals, todos, routines, logs };
    },
  };
}

/** SOC-32: 본인 캐시와 구독에서 격리한 읽기 전용 데이터다. */
export function useFriendDay(client: NodiiClient, friendId: string | null, range: FriendDayRange) {
  return useQuery(friendDayOptions(client, friendId, range));
}

/** SOC-20: 기존 목표 수정의 낙관적 업데이트와 롤백을 공유한다. */
export function useGoalVisibility(client: NodiiClient, id: string, options: MutationOptions) {
  const mutation = useUpdateGoal(client, id, options);
  return {
    ...mutation,
    setVisibility: (goal: GoalRecord, visibility: DefaultVisibility) =>
      mutation.mutate({ goal, changes: { visibility } }),
  };
}

const peopleKey = (me: string) => ['relationships', me, 'todayPeople'] as const;

/** SOC-36: 아바타 줄과 설정 화면이 표시 여부를 공유한다. */
export function useTodayPeople(client: NodiiClient, me: string, enabled = true) {
  return useQuery({
    queryKey: peopleKey(me),
    enabled,
    retry: false,
    refetchOnMount: 'always',
    queryFn: ({ signal }) => fetchTodayPeople(client, me, signal),
  });
}

/** SOC-36: 표시 설정만 낙관적으로 바꾸고 실패한 행을 복원한다. */
export function useUpdateTodayPerson(
  client: NodiiClient,
  me: string,
  onError: (error: unknown) => void,
) {
  const cache = useQueryClient();
  const queryKey = peopleKey(me);
  type Change = { followeeId: string; patch: TodayPersonPatch };
  const writeKey = ['relationships', me, 'write', 'todayPeople'] as const;
  const mutation = useMutation({
    mutationKey: writeKey,
    scope: { id: `relationships:${me}` },
    networkMode: 'always',
    retry: false,
    mutationFn: ({ followeeId, patch }: Change) => {
      assertOnline();
      return updateTodayPerson(client, me, followeeId, patch);
    },
    onMutate: async ({ followeeId, patch }) => {
      assertOnline();
      await cache.cancelQueries({ queryKey });
      const snapshot = cache.getQueryData<TodayPerson[]>(queryKey);
      cache.setQueryData<TodayPerson[]>(queryKey, (current) =>
        current?.map((person) =>
          person.followeeId === followeeId ? { ...person, ...patch } : person,
        ),
      );
      return snapshot?.find((person) => person.followeeId === followeeId);
    },
    onError: (error, { followeeId }, previous) => {
      if (previous)
        cache.setQueryData<TodayPerson[]>(queryKey, (current) =>
          current?.map((person) => (person.followeeId === followeeId ? previous : person)),
        );
      onError(error);
    },
    onSettled: () =>
      cache.isMutating({ mutationKey: writeKey }) === 1
        ? cache.invalidateQueries({ queryKey })
        : undefined,
  });
  return {
    ...mutation,
    toggle(person: TodayPerson) {
      const shown = orderTodayPeople(cache.getQueryData<TodayPerson[]>(queryKey) ?? []).shown;
      mutation.mutate({
        followeeId: person.followeeId,
        patch: person.showOnToday
          ? { showOnToday: false }
          : {
              showOnToday: true,
              todaySortKey: keyBetween(shown.at(-1)?.todaySortKey ?? null, null),
            },
      });
    },
  };
}
