import { expect, it, vi } from 'vitest';
import { dehydrate, QueryClient } from '@tanstack/react-query';
import { persistQueryClientRestore } from '@tanstack/react-query-persist-client';
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
import {
  attachUserCache,
  CACHE_BUSTER,
  CACHE_MAX_AGE,
  clearPersistedCache,
  createUserCache,
  shouldPersistQuery,
} from './query-cache';

function setup() {
  const values = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: vi.fn(async (key: string) => {
      values.delete(key);
    }),
  };
  const cache = new QueryClient();
  cache.setQueryData(['goals'], [{ id: 'mine' }]);
  cache.setQueryData(['auth'], { access_token: 'never-save' });
  const saved = { timestamp: Date.now(), buster: CACHE_BUSTER, clientState: dehydrate(cache) };
  return { values, storage, cache, saved };
}
it('허용한 서버 데이터만 저장하고 오프라인 재실행에서 사용자별로 복원한다', async () => {
  const { values, storage, cache, saved } = setup();
  const alice = createUserCache(cache, 'alice', vi.fn(), storage);
  await alice.persister.persistClient(saved);
  expect([...values.values()].join()).not.toContain('never-save');
  const restored = new QueryClient();
  await persistQueryClientRestore({
    queryClient: restored,
    persister: createUserCache(restored, 'alice', vi.fn(), storage).persister,
    buster: CACHE_BUSTER,
    maxAge: CACHE_MAX_AGE,
  });
  expect(restored.getQueryData(['goals'])).toEqual([{ id: 'mine' }]);
  expect(
    await createUserCache(cache, 'bob', vi.fn(), storage).persister.restoreClient(),
  ).toBeUndefined();
});
it('로그아웃은 진행 중 저장도 폐기하여 디스크 캐시가 다시 생기지 않는다', async () => {
  const { values, storage, cache, saved } = setup();
  const entry = createUserCache(cache, 'alice', vi.fn(), storage);
  const parent = new QueryClient();
  attachUserCache(parent, entry);
  const writing = entry.persister.persistClient(saved);
  await clearPersistedCache(parent);
  await writing;
  await entry.persister.persistClient(saved);
  expect(values.size).toBe(0);
  expect(cache.getQueryCache().getAll()).toHaveLength(0);
});
it('다른 사용자와 오래된 앱 버전 캐시는 복원하지 않는다', async () => {
  const { storage, cache, saved } = setup();
  await storage.setItem(
    'nodii.query-cache:alice',
    JSON.stringify({ userId: 'bob', client: saved }),
  );
  const entry = createUserCache(cache, 'alice', vi.fn(), storage);
  expect(await entry.persister.restoreClient()).toBeUndefined();
  await entry.persister.persistClient({ ...saved, buster: 'old' });
  const restored = new QueryClient();
  await persistQueryClientRestore({
    queryClient: restored,
    persister: entry.persister,
    buster: CACHE_BUSTER,
  });
  expect(restored.getQueryCache().getAll()).toHaveLength(0);
});

it('재조회 실패가 마지막 성공 데이터를 디스크에서 지우지 않는다', async () => {
  const { cache, storage } = setup();
  await expect(
    cache.fetchQuery({
      queryKey: ['goals'],
      retry: false,
      queryFn: async () => {
        throw new Error('network');
      },
    }),
  ).rejects.toThrow('network');
  const entry = createUserCache(cache, 'alice', vi.fn(), storage);
  await entry.persister.persistClient({
    timestamp: Date.now(),
    buster: CACHE_BUSTER,
    clientState: dehydrate(cache, { shouldDehydrateQuery: shouldPersistQuery }),
  });
  const restored = new QueryClient();
  await persistQueryClientRestore({
    queryClient: restored,
    persister: entry.persister,
    buster: CACHE_BUSTER,
  });
  expect(restored.getQueryData(['goals'])).toEqual([{ id: 'mine' }]);
  cache.clear();
  restored.clear();
});

it('손상된 캐시 오류에서 개인정보 원문을 제거하고 복원 실패로 알린다', async () => {
  const { storage, cache } = setup();
  await storage.setItem('nodii.query-cache:alice', 'private@example.com malformed');
  const entry = createUserCache(cache, 'alice', vi.fn(), storage);
  await expect(entry.persister.restoreClient()).rejects.toThrow(/^cache_restore_failed$/);
  await entry.persister.removeClient();
  expect(await storage.getItem('nodii.query-cache:alice')).toBeNull();
});
it('객체 구조가 잘못된 캐시도 정상 데이터로 복원하지 않는다', async () => {
  const { storage, cache } = setup();
  await storage.setItem('nodii.query-cache:alice', JSON.stringify({ userId: 'alice', client: {} }));
  await expect(
    createUserCache(cache, 'alice', vi.fn(), storage).persister.restoreClient(),
  ).rejects.toThrow(/^cache_restore_failed$/);
});
