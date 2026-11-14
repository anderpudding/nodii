import { useEffect } from 'react';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_NOTIFICATION_PREFS,
  effectiveFriendDone,
  reactionTargetKey,
  type NotificationMute,
  type NotificationPrefs,
  type ReactionTarget,
} from '@nodii/core';
import type { NodiiClient } from '../client';
import { assertOnline } from '../connectivity';
import { subscribeNotifications } from '../notification-realtime';
import { useTodayPeople } from './friends-day';
import {
  clearNotificationMute,
  fetchMyReactions,
  fetchNotificationMutes,
  fetchNotificationPrefs,
  fetchNotifications,
  react,
  setNotificationMute,
  unreact,
  updateNotificationPrefs,
  type MyReactions,
  type Notification,
  type ReactionTargets,
} from '../repositories/notifications';

export const notificationsKey = (me: string) => ['notifications', me] as const;
const prefsKey = (me: string) => ['notificationPrefs', me] as const;
const mutesKey = (me: string) => ['notificationMutes', me] as const;
const reactionsKey = (me: string) => ['myReactions', me] as const;
const settingsWriteKey = (me: string) => ['writeNotificationSettings', me] as const;
const pendingReaction = 'pending';

type Foreground = (refresh: () => void) => () => void;
type OnError = (error: unknown) => void;

/** SOC-50: 실제 표시 중인 목록만 구독하고 연결 복구와 전경 복귀에도 새로 읽는다. */
export function useNotifications(client: NodiiClient, me: string, onForeground: Foreground) {
  const cache = useQueryClient();
  const result = useQuery({
    queryKey: notificationsKey(me),
    queryFn: ({ signal }) => fetchNotifications(client, me, signal),
    gcTime: 0,
    retry: false,
  });
  useEffect(() => {
    const key = notificationsKey(me);
    const refresh = () => {
      void cache.invalidateQueries({ queryKey: key }, { cancelRefetch: false });
    };
    const detach = subscribeNotifications(client, me, (deletedId) => {
      if (deletedId && !cache.getQueryData<Notification[]>(key)?.some(({ id }) => id === deletedId))
        return;
      // 이벤트가 진행 중 요청에 묻히지 않도록 마지막 변경 뒤 목록을 다시 읽는다.
      void cache.invalidateQueries({ queryKey: key });
    });
    const foreground = onForeground(refresh);
    return () => {
      detach();
      foreground();
    };
  }, [cache, client, me, onForeground]);
  return result;
}

/** SOC-40: 렌더 중인 여러 하트의 상태를 화면당 일괄 조회한다. */
export function useMyReactions(client: NodiiClient, me: string, targets: ReactionTargets) {
  const keys = [
    ...targets.todoIds.map((todoId) => reactionTargetKey({ todoId })),
    ...targets.routineDates.map(reactionTargetKey),
  ].sort();
  return useQuery({
    queryKey: [...reactionsKey(me), keys] as const,
    queryFn: ({ signal }) => fetchMyReactions(client, me, targets, signal),
    enabled: keys.length > 0,
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: 'always',
  });
}

/** SOC-40: 같은 항목의 모든 화면을 함께 바꾸고 실패한 하트만 되돌린다. */
export function useReactionToggle(
  client: NodiiClient,
  me: string,
  target: ReactionTarget,
  onError: OnError,
) {
  const cache = useQueryClient();
  const itemKey = reactionTargetKey(target);
  const mutationKey = ['writeReaction', me, itemKey] as const;
  const isPending = useIsMutating({ mutationKey }) > 0;
  const filters = {
    queryKey: reactionsKey(me),
    predicate: ({ queryKey }: { queryKey: readonly unknown[] }) =>
      Array.isArray(queryKey[2]) && queryKey[2].includes(itemKey),
  };
  const patch = (previous: MyReactions | undefined, id?: string) => {
    if (!previous) return previous;
    const next = { ...previous };
    if (id) next[itemKey] = id;
    else delete next[itemKey];
    return next;
  };
  const { mutate } = useMutation({
    mutationKey,
    networkMode: 'always',
    retry: false,
    mutationFn: async (id?: string) => {
      assertOnline();
      if (!id) return react(client, target);
      await unreact(client, me, id);
      return undefined;
    },
    onMutate: async (id) => {
      assertOnline();
      await cache.cancelQueries(filters);
      const queries = cache.getQueryCache().findAll(filters);
      const previous = queries.map((query) => ({
        query,
        id: cache.getQueryData<MyReactions>(query.queryKey)?.[itemKey],
      }));
      cache.setQueriesData<MyReactions>(filters, (rows) =>
        patch(rows, id ? undefined : pendingReaction),
      );
      return previous;
    },
    onError: (error, _id, previous) => {
      for (const entry of previous ?? []) {
        if (cache.getQueryCache().find({ queryKey: entry.query.queryKey }) === entry.query)
          cache.setQueryData<MyReactions>(entry.query.queryKey, (rows) => patch(rows, entry.id));
      }
      onError(error);
    },
    onSuccess: (id) => cache.setQueriesData<MyReactions>(filters, (rows) => patch(rows, id)),
  });
  return {
    isPending,
    toggle: (id?: string) => {
      if (id !== pendingReaction && !cache.isMutating({ mutationKey })) mutate(id);
    },
  };
}

/** SOC-53: 목록 안내와 설정 화면이 동일한 사용자 캐시를 쓴다. */
export function useNotificationPrefs(client: NodiiClient, me: string) {
  return useQuery({
    queryKey: prefsKey(me),
    retry: false,
    queryFn: ({ signal }) => fetchNotificationPrefs(client, me, signal),
  });
}

/** SOC-51: 기본값과 별개로 명시적인 사람별 예외를 보존한다. */
export function useNotificationMutes(client: NodiiClient, me: string) {
  return useQuery({
    queryKey: mutesKey(me),
    retry: false,
    queryFn: ({ signal }) => fetchNotificationMutes(client, me, signal),
  });
}

type SettingsChange =
  { prefs: Partial<NotificationPrefs> } | { actorId: string; friendDone: boolean; global: boolean };

/** SOC-51·53: 수신 설정의 스냅샷과 쓰기를 한 계정 단위로 직렬화한다. */
export function useUpdateNotificationSettings(client: NodiiClient, me: string, onError: OnError) {
  const cache = useQueryClient();
  const mutationKey = settingsWriteKey(me);
  const prefs = prefsKey(me);
  const mutes = mutesKey(me);
  const isPending = useIsMutating({ mutationKey }) > 0;
  const mutation = useMutation({
    mutationKey,
    networkMode: 'always',
    retry: false,
    mutationFn: async (change: SettingsChange) => {
      assertOnline();
      if ('prefs' in change) return updateNotificationPrefs(client, me, change.prefs);
      if (change.friendDone === change.global)
        await clearNotificationMute(client, me, change.actorId);
      else await setNotificationMute(client, me, change.actorId, change.friendDone);
    },
    onMutate: async (change) => {
      assertOnline();
      await cache.cancelQueries({ queryKey: 'prefs' in change ? prefs : mutes });
      const previousPrefs =
        cache.getQueryData<NotificationPrefs>(prefs) ?? DEFAULT_NOTIFICATION_PREFS;
      const previousMutes = cache.getQueryData<NotificationMute[]>(mutes) ?? [];
      if ('prefs' in change) {
        cache.setQueryData<NotificationPrefs>(
          prefs,
          (value) => value && { ...value, ...change.prefs },
        );
      } else {
        cache.setQueryData<NotificationMute[]>(mutes, (values) => {
          const rest = (values ?? []).filter((value) => value.actorId !== change.actorId);
          return change.friendDone === change.global
            ? rest
            : [...rest, { actorId: change.actorId, friendDone: change.friendDone }];
        });
      }
      return { previousPrefs, previousMutes };
    },
    onError: (error, change, previous) => {
      if (previous) {
        if ('prefs' in change) cache.setQueryData(prefs, previous.previousPrefs);
        else cache.setQueryData(mutes, previous.previousMutes);
      }
      onError(error);
    },
    onSuccess: (values) => {
      if (values) cache.setQueryData(prefs, values);
    },
    onSettled: (_data, _error, change) =>
      cache.invalidateQueries({ queryKey: 'prefs' in change ? prefs : mutes }),
  });
  return {
    isPending,
    update: (change: SettingsChange) => {
      if (!cache.isMutating({ mutationKey })) mutation.mutate(change);
    },
  };
}

/** SOC-51: 화면에 있는 팔로잉에만 예외를 적용해 요약과 사람별 값이 일치한다. */
export function useFriendDoneSettings(client: NodiiClient, me: string) {
  const prefs = useNotificationPrefs(client, me);
  const mutes = useNotificationMutes(client, me);
  const following = useTodayPeople(client, me);
  const overrides = new Map(mutes.data?.map((mute) => [mute.actorId, mute.friendDone]));
  const people = following.data?.map(({ profile }) => ({
    profile,
    overridden: overrides.has(profile.userId),
    checked: effectiveFriendDone(prefs.data, mutes.data ?? [], profile.userId),
  }));
  return {
    global: prefs.data?.friendDone,
    people,
    count: people?.filter(({ checked }) => checked).length ?? 0,
    hasOverrides: people?.some(({ overridden }) => overridden) ?? false,
    ready: prefs.isSuccess && mutes.isSuccess && following.isSuccess,
    failed: prefs.isError || mutes.isError || following.isError,
    reload() {
      void prefs.refetch();
      void mutes.refetch();
      void following.refetch();
    },
  };
}
