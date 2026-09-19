import type { AuthStorage } from '@nodii/api';
import type { QueryClient } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { toast } from 'sonner';
import { version } from '../../package.json';
import { queryStorage } from './query-storage';

export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
export const CACHE_BUSTER = `nodii:${version}:1`;

/** 사용자별 키와 직렬 저장으로 계정 전환 및 저장/삭제 경합을 차단한다 (AUTH-03). */
export function createUserPersister(
  userId: string,
  storage: AuthStorage,
): Persister & { revoke: () => Promise<void> } {
  const key = `nodii.query-cache:${userId}`;
  let active = true;
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.catch(() => {}).then(operation);
    queue = result;
    return result;
  };
  return {
    persistClient: (client) =>
      enqueue(async () => {
        if (active) await storage.setItem(key, JSON.stringify({ userId, client }));
      }),
    restoreClient: () =>
      enqueue(async () => {
        const value = await storage.getItem(key);
        if (!active || !value) return undefined;
        const saved = JSON.parse(value) as { userId?: string; client?: PersistedClient };
        return saved.userId === userId ? saved.client : undefined;
      }),
    removeClient: () =>
      enqueue(async () => {
        await storage.removeItem(key);
      }),
    revoke: () => {
      active = false;
      return enqueue(async () => {
        await storage.removeItem(key);
      });
    },
  };
}

type ActiveCache = {
  userId: string;
  cache: QueryClient;
  persister: Persister;
  revoke: () => Promise<void>;
};
const activeCaches = new WeakMap<QueryClient, ActiveCache>();
const deletions = new WeakMap<QueryClient, Promise<void>>();
const userDeletions = new Map<string, Promise<void>>();

/** 쓰기 중인 낙관적 값은 디스크에 확정하지 않고 마지막 서버 상태를 유지한다. */
export function userCache(cache: QueryClient, userId: string): ActiveCache {
  const current = activeCaches.get(cache);
  if (current?.userId === userId) return current;
  const base = createUserPersister(userId, queryStorage);
  const entry = {
    userId,
    cache,
    revoke: base.revoke,
    persister: {
      ...base,
      async restoreClient() {
        await userDeletions.get(userId);
        return base.restoreClient();
      },
      async persistClient(client: PersistedClient) {
        if (cache.isMutating({ mutationKey: ['write'] })) return;
        try {
          await userDeletions.get(userId);
          await base.persistClient(client);
        } catch {
          toast.error('이 기기에 데이터를 보관하지 못했어요', { id: 'cache-storage-error' });
        }
      },
    },
  };
  activeCaches.set(cache, entry);
  return entry;
}

/** 로그아웃 콜백에서 동기적으로 쓰기를 폐기하고 디스크 삭제까지 기다린다. */
export async function clearPersistedCache(cache: QueryClient): Promise<void> {
  const active = activeCaches.get(cache);
  if (!active) {
    await deletions.get(cache);
    return;
  }
  const deletion = active.revoke();
  deletions.set(cache, deletion);
  userDeletions.set(active.userId, deletion);
  await deletion;
  if (userDeletions.get(active.userId) === deletion) userDeletions.delete(active.userId);
}

/** 인증 이벤트가 바뀔 때 다음 사용자가 이전 persister를 재사용하지 않게 한다. */
export function detachPersistedCache(cache: QueryClient): Promise<void> {
  const active = activeCaches.get(cache);
  const deletion = clearPersistedCache(cache);
  active?.cache.clear();
  activeCaches.delete(cache);
  return deletion;
}

/** 인증 게이트가 사용자 전용 QueryClient의 저장 작업도 즉시 폐기하게 한다. */
export function attachUserCache(parent: QueryClient, entry: ActiveCache): void {
  activeCaches.set(parent, entry);
}
