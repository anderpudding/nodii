import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { AppState, Text } from 'react-native';
import { QueryClient, useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { syncProfileTimezone, type NodiiClient } from '@nodii/api';
import { useOnline } from '../../lib/connectivity';
import type { Profile } from '@nodii/core';
import { t } from '@nodii/i18n';
import {
  attachUserCache,
  CACHE_BUSTER,
  CACHE_MAX_AGE,
  createUserCache,
} from '../../lib/query-cache';
import { bindUserSync } from '../../lib/user-sync';
import { useTheme } from '../../lib/theme';
import { useToast } from '../components/Toast';

function Restored({
  client,
  userId,
  children,
}: {
  client: NodiiClient;
  userId: string;
  children: ReactNode;
}) {
  const restoring = useIsRestoring();
  const cache = useQueryClient();
  const { colors } = useTheme();
  const online = useOnline();
  const toast = useToast();
  useEffect(() => {
    if (restoring || !online) return;
    const controller = new AbortController();
    void syncProfileTimezone(
      client,
      userId,
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      controller.signal,
    )
      .then(async (profile) => {
        await cache.cancelQueries({ queryKey: ['profile', userId], exact: true });
        if (!controller.signal.aborted) cache.setQueryData(['profile', userId], profile);
      })
      .catch(() => {
        if (!controller.signal.aborted) toast(t('mobile.profile.failed'));
      });
    return () => controller.abort();
  }, [client, userId, cache, restoring, online, toast]);
  useEffect(() => {
    if (restoring) return;
    return bindUserSync(
      client,
      userId,
      cache,
      AppState,
      () => cache.getQueryData<Profile>(['profile', userId])?.weekStart ?? 0,
    );
  }, [client, userId, cache, restoring]);
  return restoring ? (
    <Text style={{ color: colors.muted }}>{t('mobile.today.loading')}</Text>
  ) : (
    children
  );
}
/** SYNC-04: 사용자 전용 캐시가 복원된 뒤 요청·실시간 구독을 시작한다. */
export function UserData({
  client,
  userId,
  children,
}: {
  client: NodiiClient;
  userId: string;
  children: ReactNode;
}) {
  const parent = useQueryClient();
  const toast = useToast();
  const [entry] = useState(() =>
    createUserCache(
      new QueryClient({
        defaultOptions: {
          ...parent.getDefaultOptions(),
          queries: { ...parent.getDefaultOptions().queries, gcTime: CACHE_MAX_AGE },
        },
      }),
      userId,
      () => toast(t('sync.cache.saveFailed')),
    ),
  );
  useLayoutEffect(() => {
    attachUserCache(parent, entry);
  }, [parent, entry]);
  return (
    <PersistQueryClientProvider
      client={entry.cache}
      persistOptions={{
        persister: entry.persister,
        buster: CACHE_BUSTER,
        maxAge: CACHE_MAX_AGE,
        dehydrateOptions: { shouldDehydrateMutation: () => false },
      }}
      onSuccess={() => {
        void entry.cache.invalidateQueries();
      }}
      onError={() => toast(t('sync.cache.restoreFailed'))}
    >
      <Restored client={client} userId={userId}>
        {children}
      </Restored>
    </PersistQueryClientProvider>
  );
}
