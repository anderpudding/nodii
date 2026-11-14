import { useEffect, useState, useSyncExternalStore } from 'react';
import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  validateHandle,
  type DefaultVisibility,
  type Profile,
  type SocialProfile,
} from '@nodii/core';
import type { NodiiClient } from '../client';
import { assertOnline } from '../connectivity';
import { fetchSocialEnabled } from '../app-config';
import { fetchMyInvite, resolveInvite } from '../invites';
import { removeAvatar, uploadAvatar, type AvatarBytes } from '../avatars';
import type { SocialProfilePatch } from '../mappers';
import {
  checkHandle,
  checkProfileText,
  createSocialProfile,
  fetchMySocialProfile,
  fetchSocialProfile,
  updateDefaultVisibility,
  updateSocialProfile,
} from '../repositories/social-profiles';

const ownKey = ['socialProfile', 'me'] as const;
const flagKey = ['socialEnabled'] as const;

/** D13: 시작·전경에서 확인하고 실패 시 기존 화면으로 돌아간다. */
export function useSocialEnabled(
  client: NodiiClient | null,
  onForeground: (refresh: () => void) => () => void,
) {
  const online = useSyncExternalStore(
    onlineManager.subscribe,
    () => onlineManager.isOnline(),
    () => true,
  );
  const { data, refetch } = useQuery({
    queryKey: flagKey,
    queryFn: () => (client ? fetchSocialEnabled(client) : false),
    enabled: client !== null && online,
    staleTime: Infinity,
    networkMode: 'always',
    retry: false,
  });
  useEffect(
    () =>
      onForeground(() => {
        if (client && onlineManager.isOnline()) void refetch();
      }),
    [client, onForeground, refetch],
  );
  // 이미 켜진 검색 화면은 연결을 잃어도 안내와 입력을 유지한다.
  return data;
}

/** SOC-03: 없는 행만 시작 화면으로 연결한다. */
export function useMySocialProfile(client: NodiiClient, userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ownKey,
    queryFn: ({ signal }) => fetchMySocialProfile(client, userId, signal),
    enabled,
    staleTime: 0,
    retry: false,
    networkMode: 'always',
  });
}

/** SOC-38: 다시 열 때마다 권한을 확인하고 남의 프로필을 디스크에 남기지 않는다. */
export function useSocialProfile(client: NodiiClient, userId: string) {
  return useQuery({
    queryKey: ['socialProfile', userId],
    queryFn: ({ signal }) => fetchSocialProfile(client, userId, signal),
    gcTime: 0,
    retry: false,
    networkMode: 'always',
  });
}

/** SOC-05: 복사 버튼의 클릭 권한을 유지하도록 토큰을 먼저 준비한다. */
export function useMyInvite(client: NodiiClient, userId: string, enabled = true) {
  return useQuery({
    queryKey: ['myInvite', userId],
    enabled,
    retry: false,
    queryFn: ({ signal }) => fetchMyInvite(client, userId, signal),
    staleTime: Infinity,
    gcTime: 0,
    networkMode: 'always',
  });
}

/** SOC-05: 초대 토큰은 공유할 때에만 읽는다. */
export function useShareInvite(
  client: NodiiClient,
  userId: string,
  share: (token: string) => Promise<void>,
) {
  return useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: async () => {
      assertOnline();
      const token = await fetchMyInvite(client, userId);
      if (!token) throw new Error('missing_invite');
      await share(token);
    },
  });
}

/** SOC-05: 로그인과 내 프로필 생성이 끝난 뒤에만 메모리의 링크를 해석한다. */
export function usePendingInvite(
  client: NodiiClient,
  token: string | null,
  ready: boolean,
  onResult: (token: string, userId: string | null) => void,
) {
  useEffect(() => {
    if (!ready || !token) return;
    const controller = new AbortController();
    void resolveInvite(client, token, controller.signal).then(
      (userId) => {
        if (!controller.signal.aborted) onResult(token, userId);
      },
      () => {
        if (!controller.signal.aborted) onResult(token, null);
      },
    );
    return () => controller.abort();
  }, [client, token, ready, onResult]);
}

function useDebounced<T>(value: T, enabled: boolean) {
  const [current, setCurrent] = useState<T | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => setCurrent(value), 300);
    return () => clearTimeout(timer);
  }, [value, enabled]);
  return enabled && current === value;
}

type HandleMessage =
  | 'checking'
  | 'ok'
  | 'taken'
  | 'unavailable'
  | 'offline'
  | 'length'
  | 'start'
  | 'characters'
  | 'dots'
  | 'trailingDot';

/** SOC-02: 입력이 바뀌면 이전 ID의 응답으로 저장 버튼을 켜지 않는다. */
export function useHandleAvailability(
  client: NodiiClient,
  raw: string,
  enabled = true,
): HandleMessage | null {
  const parsed = validateHandle(raw);
  const canCheck = enabled && parsed.status === 'ok';
  const debounced = useDebounced(parsed.value, canCheck);
  const result = useQuery({
    queryKey: ['handleAvailable', parsed.value],
    enabled: debounced,
    retry: false,
    gcTime: 0,
    queryFn: ({ signal }) => checkHandle(client, parsed.value, signal),
    refetchOnMount: 'always',
  });
  if (!enabled) return null;
  if (parsed.status === 'invalid') return parsed.reason;
  if (result.fetchStatus === 'paused' || !onlineManager.isOnline() || result.isError)
    return 'offline';
  if (!debounced || result.isFetching || !result.data) return 'checking';
  if (result.data === 'ok' || result.data === 'taken') return result.data;
  if (result.data === 'invalid') return 'characters';
  return 'unavailable';
}

/** SOC-64: 서버와 같은 목록으로 편집 중에도 막힌 입력을 안내한다. */
export function useProfileTextCheck(
  client: NodiiClient,
  value: string,
  nickname: boolean,
  enabled: boolean,
) {
  const ready = useDebounced(value, enabled && value.length > 0);
  const result = useQuery({
    queryKey: ['profileText', nickname, value],
    enabled: ready,
    queryFn: ({ signal }) => checkProfileText(client, value, nickname, signal),
    gcTime: 0,
    retry: false,
  });
  return ready ? result.data : undefined;
}

/** SOC-03: 초대 링크는 서버 트리거가 끝난 뒤에 처리한다. */
export function useCreateSocialProfile(client: NodiiClient, userId: string) {
  const cache = useQueryClient();
  return useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: (input: { handle: string; nickname: string }) => {
      assertOnline();
      return createSocialProfile(client, userId, input);
    },
    onSuccess: (value) => cache.setQueryData(ownKey, value),
  });
}

function useOwnWrite<V>(
  userId: string,
  request: (value: V) => Promise<SocialProfile>,
  patch: (value: V) => SocialProfilePatch,
) {
  const cache = useQueryClient();
  return useMutation({
    networkMode: 'always',
    retry: false,
    scope: { id: `social-profile-${userId}` },
    mutationFn: (value: V) => {
      assertOnline();
      return request(value);
    },
    onMutate: async (value) => {
      assertOnline();
      await cache.cancelQueries({ queryKey: ownKey });
      const previous = cache.getQueryData<SocialProfile | null>(ownKey);
      const query = cache.getQueryCache().find({ queryKey: ownKey });
      if (previous) cache.setQueryData(ownKey, { ...previous, ...patch(value) });
      return { previous, query };
    },
    onError: (_error, _value, context) => {
      if (context?.query && cache.getQueryCache().find({ queryKey: ownKey }) === context.query)
        cache.setQueryData(ownKey, context.previous);
    },
    onSuccess: (value, _input, context) => {
      if (context?.query && cache.getQueryCache().find({ queryKey: ownKey }) === context.query)
        cache.setQueryData(ownKey, value);
    },
  });
}

/** SOC-01·02·06·07: 두 화면에서 같은 낙관적 프로필과 롤백을 사용한다. */
export function useUpdateSocialProfile(client: NodiiClient, userId: string) {
  return useOwnWrite(
    userId,
    (patch: SocialProfilePatch) => updateSocialProfile(client, userId, patch),
    (patch) => patch,
  );
}

/** SOC-04: 두 JPEG와 행이 저장되기까지 이전 사진을 유지한다. */
export function useAvatarMutation(client: NodiiClient, userId: string) {
  return useOwnWrite(
    userId,
    (value: { bytes: AvatarBytes; uuid: string } | null) =>
      value ? uploadAvatar(client, userId, value.bytes, value.uuid) : removeAvatar(client, userId),
    (value) => (value ? {} : { avatarPath: null }),
  );
}

/** SOC-28: 새 기본 범위를 바로 표시하고 저장 실패 시 설정을 복원한다. */
export function useUpdateDefaultVisibility(client: NodiiClient, userId: string) {
  const cache = useQueryClient();
  const key = ['profile', userId];
  return useMutation({
    retry: false,
    networkMode: 'always',
    mutationFn: (value: DefaultVisibility) => {
      assertOnline();
      return updateDefaultVisibility(client, userId, value);
    },
    onMutate: async (value) => {
      assertOnline();
      await cache.cancelQueries({ queryKey: key });
      const snapshots = cache
        .getQueriesData<Profile>({ queryKey: key })
        .map(([queryKey, profile]) => ({
          queryKey,
          profile,
          query: cache.getQueryCache().find({ queryKey, exact: true }),
        }));
      cache.setQueriesData<Profile>(
        { queryKey: key },
        (profile) => profile && { ...profile, defaultVisibility: value },
      );
      return snapshots;
    },
    onError: (_error, _value, snapshots) => {
      for (const { queryKey, profile, query } of snapshots ?? [])
        if (query && cache.getQueryCache().find({ queryKey, exact: true }) === query)
          cache.setQueryData(queryKey, profile);
    },
  });
}
