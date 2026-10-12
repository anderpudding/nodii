import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthStorage } from '@nodii/api';
import type { Query, QueryClient } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { version } from '../package.json';

export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
export const CACHE_BUSTER = `nodii-mobile:${version}:1`;
const activeCaches = new WeakMap<QueryClient, ReturnType<typeof createUserCache>>();
const deleting = new Map<string, Promise<void>>();
const prefixes = ['profile', 'goals', 'todos', 'routines', 'routineLogs', 'overdue'];

/** SYNC-04: 재조회 실패 뒤에도 마지막 성공 데이터를 보관하고 인증 쿼리는 제외한다. */
export function shouldPersistQuery(query: Query): boolean {
  return query.state.data !== undefined && prefixes.includes(String(query.queryKey[0]));
}

/** AUTH-03/SYNC-04: 사용자별로 분리하고 로그아웃과 늦은 저장의 경합을 직렬화한다. */
export function createUserCache(
  cache: QueryClient,
  userId: string,
  onError: () => void,
  storage: AuthStorage = AsyncStorage,
) {
  const key = `nodii.query-cache:${userId}`;
  let live = true;
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(run: () => Promise<T>) => {
    const result = queue.catch(() => {}).then(run);
    queue = result;
    return result;
  };
  const persister: Persister = {
    persistClient: (value) => {
      if (!live || cache.isMutating({ mutationKey: ['write'] })) return Promise.resolve();
      return enqueue(async () => {
        if (!live || cache.isMutating({ mutationKey: ['write'] })) return;
        await deleting.get(userId);
        // 인증/임의 쿼리와 mutation은 저장하지 않는다.
        const client: PersistedClient = {
          ...value,
          clientState: {
            mutations: [],
            queries: value.clientState.queries.filter((query) =>
              prefixes.includes(String(query.queryKey[0])),
            ),
          },
        };
        try {
          await storage.setItem(key, JSON.stringify({ userId, client }));
        } catch {
          onError();
        }
      });
    },
    restoreClient: () =>
      enqueue(async () => {
        await deleting.get(userId);
        const value = await storage.getItem(key);
        if (!live || !value) return undefined;
        const saved = JSON.parse(value) as { userId?: string; client?: PersistedClient };
        return saved.userId === userId ? saved.client : undefined;
      }),
    removeClient: () =>
      enqueue(async () => {
        await storage.removeItem(key);
      }),
  };
  return {
    cache,
    userId,
    persister,
    revoke() {
      live = false;
      const removal = enqueue(async () => {
        await storage.removeItem(key);
      });
      deleting.set(userId, removal);
      void removal.then(() => {
        if (deleting.get(userId) === removal) deleting.delete(userId);
      }, onError);
      return removal;
    },
  };
}
/** 게이트의 로그아웃도 사용자 전용 QueryClient를 함께 정리한다. */
export function attachUserCache(parent: QueryClient, entry: ReturnType<typeof createUserCache>) {
  activeCaches.set(parent, entry);
}
/** 로컬 세션을 지우기 전에 영속 캐시와 진행 중인 저장을 폐기한다. */
export async function clearPersistedCache(parent: QueryClient) {
  const entry = activeCaches.get(parent);
  if (!entry) return;
  const removal = entry.revoke();
  await entry.cache.cancelQueries();
  entry.cache.clear();
  await removal;
  activeCaches.delete(parent);
}
