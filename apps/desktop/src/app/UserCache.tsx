import { useState, useLayoutEffect, type ReactNode } from 'react';
import { QueryClient, useQueryClient, useIsRestoring, type Query } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { attachUserCache, CACHE_BUSTER, CACHE_MAX_AGE, userCache } from '../lib/query-persister';
import { DaySkeleton } from '../features/day-list/DayView';
import { toast } from 'sonner';

function Restored({ children }: { children: ReactNode }) {
  const restoring = useIsRestoring();
  // prefetch/Realtime 같은 명령형 요청도 복원이 끝난 뒤에만 시작한다.
  return restoring ? (
    <main className="center-screen">
      <DaySkeleton />
    </main>
  ) : (
    children
  );
}
function shouldPersist(query: Query) {
  return (
    query.state.data !== undefined &&
    ['profile', 'goals', 'todos', 'routines', 'routineLogs', 'overdue'].includes(
      String(query.queryKey[0]),
    )
  );
}

/** SYNC-04/NFR-01: 현재 인증 사용자의 캐시만 복원한 뒤 즉시 화면을 연다. */
export function UserCache({ userId, children }: { userId: string; children: ReactNode }) {
  const parent = useQueryClient();
  const [entry] = useState(() => {
    // 늦게 끝난 이전 사용자의 복원/요청이 새 계정 캐시를 오염시키지 않게 분리한다.
    const cache = new QueryClient({
      defaultOptions: {
        ...parent.getDefaultOptions(),
        queries: { ...parent.getDefaultOptions().queries, gcTime: CACHE_MAX_AGE },
      },
    });
    const entry = userCache(cache, userId);
    return entry;
  });
  const cache = entry.cache;
  useLayoutEffect(() => {
    attachUserCache(parent, entry);
  }, [parent, entry]);
  return (
    <PersistQueryClientProvider
      client={cache}
      persistOptions={{
        persister: entry.persister,
        buster: CACHE_BUSTER,
        maxAge: CACHE_MAX_AGE,
        dehydrateOptions: {
          shouldDehydrateMutation: () => false,
          shouldDehydrateQuery: shouldPersist,
        },
      }}
      onSuccess={() => {
        void cache.invalidateQueries();
      }}
      onError={() => {
        toast.error('보관된 데이터를 불러오지 못했어요. 연결되면 다시 불러올게요.');
      }}
    >
      <Restored>{children}</Restored>
    </PersistQueryClientProvider>
  );
}
