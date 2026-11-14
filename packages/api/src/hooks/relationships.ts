import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  onlineManager,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { normalizeSearchQuery, type FollowRelation } from '@nodii/core';
import type { NodiiClient } from '../client';
import { assertOnline, OfflineWriteError } from '../connectivity';
import { socialErrorCode } from '../errors';
import {
  block,
  fetchBlockedProfiles,
  fetchFollowCounts,
  fetchFollowers,
  fetchFollowing,
  fetchRelations,
  follow,
  removeFollower,
  reportProfile,
  searchProfiles,
  unblock,
  unfollow,
  type FollowList,
  type ReportProfileInput,
  type ReportTodoInput,
} from '../repositories/relationships';

const scope = (me: string) => ['relationships', me] as const;
const relationsKey = (me: string) => [...scope(me), 'relations'] as const;
const writeKey = (me: string) => [...scope(me), 'write'] as const;
const noRelation: FollowRelation = { iFollow: false, followsMe: false };

/** SOC-12·60: 서로 다른 진입점에 남은 관계와 공개 프로필을 같이 갱신한다. */
export async function refreshRelationships(cache: QueryClient, me: string) {
  await Promise.all([
    cache.invalidateQueries({ queryKey: scope(me) }),
    cache.invalidateQueries({ queryKey: ['socialProfile'] }),
  ]);
}

/** S1: 팔로우 Realtime 없이 전경으로 돌아왔을 때 서버 값을 다시 읽는다. */
export function useRefreshRelationships(
  me: string,
  enabled: boolean,
  onForeground: (refresh: () => void) => () => void,
) {
  const cache = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    return onForeground(() => {
      if (onlineManager.isOnline() && !cache.isMutating({ mutationKey: writeKey(me) }))
        void refreshRelationships(cache, me);
    });
  }, [cache, me, enabled, onForeground]);
}

/** SOC-10: 목록의 버튼이 하나의 배치 요청 결과를 공유한다. */
export function useRelations(client: NodiiClient, me: string, userIds: readonly string[]) {
  const ids = [...new Set(userIds)].sort();
  return useQuery({
    queryKey: [...relationsKey(me), ids],
    enabled: ids.length > 0,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const groups = Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) =>
        ids.slice(i * 100, (i + 1) * 100),
      );
      const batches = await Promise.all(
        groups.map((group) => fetchRelations(client, me, group, signal)),
      );
      return new Map(batches.flatMap((relations) => [...relations]));
    },
  });
}

/** SOC-08: 프로필 머리와 목록의 세그먼트가 같은 숫자를 공유한다. */
export function useFollowCounts(client: NodiiClient, me: string, enabled = true) {
  return useQuery({
    queryKey: [...scope(me), 'counts'],
    enabled,
    retry: false,
    queryFn: ({ signal }) => fetchFollowCounts(client, me, signal),
  });
}

function useFollowList(client: NodiiClient, me: string, kind: FollowList, enabled: boolean) {
  return useQuery({
    queryKey: [...scope(me), kind],
    enabled,
    retry: false,
    gcTime: 0,
    queryFn: ({ signal }) =>
      (kind === 'following' ? fetchFollowing : fetchFollowers)(client, me, signal),
  });
}

/** SOC-12: 목록이 열려 있을 때만 팔로잉 프로필을 읽는다. */
export const useFollowing = (client: NodiiClient, me: string, enabled = true) =>
  useFollowList(client, me, 'following', enabled);
/** SOC-12: 목록이 열려 있을 때만 팔로워 프로필을 읽는다. */
export const useFollowers = (client: NodiiClient, me: string, enabled = true) =>
  useFollowList(client, me, 'followers', enabled);

/** SOC-08: 키가 바뀌면 이전 요청을 중단하고 300ms 뒤 새 검색을 시작한다. */
export function useProfileSearch(client: NodiiClient, me: string, raw: string) {
  const normalized = normalizeSearchQuery(raw);
  const [ready, setReady] = useState<{ term: string; input: string } | null>(null);
  const online = useSyncExternalStore(
    onlineManager.subscribe,
    () => onlineManager.isOnline(),
    () => true,
  );
  useEffect(() => {
    if (!normalized) return;
    const timer = setTimeout(() => setReady({ term: normalized, input: raw }), 300);
    return () => clearTimeout(timer);
  }, [normalized, raw, online]);
  const enabled =
    online && normalized !== null && normalized === ready?.term && raw === ready.input;
  const query = useQuery({
    queryKey: [...scope(me), 'search', enabled ? normalized : null],
    enabled,
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) =>
      (await searchProfiles(client, raw, signal)).filter((person) => person.userId !== me),
  });
  return { ...query, data: enabled ? query.data : undefined, online, ready: enabled };
}

/** SOC-61: 설정과 차단 목록이 같은 응답을 사용한다. */
export function useBlockedProfiles(client: NodiiClient, me: string, enabled = true) {
  return useQuery({
    queryKey: [...scope(me), 'blocked'],
    enabled,
    retry: false,
    gcTime: 0,
    queryFn: ({ signal }) => fetchBlockedProfiles(client, signal),
  });
}

/** 같은 대상의 쓰기 중에는 화면의 다른 버튼도 잠근다. */
export function useRelationshipPending(me: string, target: string) {
  return useIsMutating({ mutationKey: [...writeKey(me), target], exact: true }) > 0;
}

function useRelationshipWrite<T>(
  me: string,
  target: string,
  request: (value: T) => Promise<unknown>,
  patch?: (value: T, previous: FollowRelation) => FollowRelation,
) {
  const cache = useQueryClient();
  const key = writeKey(me);
  return useMutation({
    mutationKey: [...key, target],
    scope: { id: `relationships:${me}` },
    networkMode: 'always',
    retry: false,
    mutationFn: (value: T) => {
      assertOnline();
      return request(value);
    },
    onMutate: async (value) => {
      assertOnline();
      await cache.cancelQueries({ queryKey: scope(me) });
      if (!patch) return;
      const snapshots = cache.getQueriesData<Map<string, FollowRelation>>({
        queryKey: relationsKey(me),
      });
      for (const [queryKey, relations] of snapshots) {
        const previous = relations?.get(target);
        if (relations && previous)
          cache.setQueryData(queryKey, new Map(relations).set(target, patch(value, previous)));
      }
      return snapshots;
    },
    onError: (_error, _value, snapshots) => {
      for (const [queryKey, snapshot] of snapshots ?? []) {
        const previous = snapshot?.get(target);
        if (previous)
          cache.setQueryData<Map<string, FollowRelation>>(
            queryKey,
            (current) => current && new Map(current).set(target, previous),
          );
      }
    },
    onSettled: async () => {
      await cache.invalidateQueries({ queryKey: scope(me), refetchType: 'none' });
      if (cache.isMutating({ mutationKey: key }) === 1 && onlineManager.isOnline()) {
        await refreshRelationships(cache, me);
      }
    },
  });
}

/** SOC-10·11: 같은 프로필의 모든 버튼을 즉시 바꾸고 실패하면 그 사람만 되돌린다. */
export function useFollowMutation(client: NodiiClient, me: string, target: string) {
  return useRelationshipWrite(
    me,
    target,
    (next: boolean) => (next ? follow : unfollow)(client, me, target),
    (iFollow, relation) => ({ ...relation, iFollow }),
  );
}

/** SOC-12: 상대 방향의 관계만 낙관적으로 갱신한다. */
export function useRemoveFollower(client: NodiiClient, me: string, target: string) {
  return useRelationshipWrite(
    me,
    target,
    () => removeFollower(client, me, target),
    (_, relation) => ({ ...relation, followsMe: false }),
  );
}

/** SOC-60: 차단 요청 중 양방향 팔로우를 끊고 실패 시 복원한다. */
export function useBlock(client: NodiiClient, me: string, target: string) {
  return useRelationshipWrite(
    me,
    target,
    () => block(client, me, target),
    () => noRelation,
  );
}

/** SOC-61: 차단 해제는 이전에 삭제한 팔로우를 복원하지 않는다. */
export function useUnblock(client: NodiiClient, me: string, target: string) {
  return useRelationshipWrite(me, target, () => unblock(client, me, target));
}

/** SOC-62: 신고 저장과 선택한 차단의 부분 성공을 표시할 수 있게 한다. */
function useReport<T extends ReportProfileInput>(client: NodiiClient, me: string) {
  const cache = useQueryClient();
  return useMutation({
    networkMode: 'always',
    retry: false,
    mutationFn: (input: T) => {
      assertOnline();
      return reportProfile(client, me, input);
    },
    onSuccess: () => refreshRelationships(cache, me),
  });
}

export const useReportProfile = (client: NodiiClient, me: string) =>
  useReport<ReportProfileInput>(client, me);

/** SOC-62: 할 일 공개 범위 검사는 Edge Function에 맡긴다. */
export const useReportTodo = (client: NodiiClient, me: string) =>
  useReport<ReportTodoInput>(client, me);

/** SOC-13·60: 차단과 정지 여부를 구분하는 안내를 노출하지 않는다. */
export function relationshipErrorKey(error: unknown, followAction = false) {
  if (error instanceof OfflineWriteError) return 'sync.writeDisabled';
  const code = socialErrorCode(error, followAction ? 'follow' : undefined);
  if (code === 'rate_limited') return 'social.follow.rateLimited';
  if (followAction && (code === 'blocked' || code === 'not_found'))
    return 'social.follow.unavailable';
  return 'common.saveFailed';
}
