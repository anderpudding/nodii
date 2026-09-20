import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, dehydrate } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  type PersistedClient,
} from '@tanstack/react-query-persist-client';
import { CACHE_BUSTER, CACHE_MAX_AGE, createUserPersister, userCache } from './query-persister';
import { logout } from './logout';
import { createTestClient } from '../test/auth-fixtures';

const caches: QueryClient[] = [];
afterEach(() => {
  caches.splice(0).forEach((cache) => cache.clear());
  vi.restoreAllMocks();
});
function cache() {
  const value = new QueryClient();
  caches.push(value);
  return value;
}
function stored(): PersistedClient {
  const query = cache();
  query.setQueryData(['goals'], [{ id: 'private-goal' }]);
  return { timestamp: Date.now(), buster: CACHE_BUSTER, clientState: dehydrate(query) };
}
function memory() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
}
it('같은 사용자 캐시만 복원한다', async () => {
  const storage = memory();
  const saved = stored();
  await createUserPersister('alice', storage).persistClient(saved);
  expect(await createUserPersister('alice', storage).restoreClient()).toEqual(saved);
  expect(await createUserPersister('bob', storage).restoreClient()).toBeUndefined();
  storage.values.set('nodii.query-cache:bob', storage.values.get('nodii.query-cache:alice')!);
  expect(await createUserPersister('bob', storage).restoreClient()).toBeUndefined();
});
it.each(['expired', 'version'])(
  '7일 유효기간과 앱 버전이 다른 캐시는 폐기한다: %s',
  async (kind) => {
    const storage = memory();
    const saved = stored();
    if (kind === 'expired') saved.timestamp -= CACHE_MAX_AGE + 1;
    else saved.buster = 'old-version';
    const persister = createUserPersister('alice', storage);
    await persister.persistClient(saved);
    const target = cache();
    await persistQueryClientRestore({
      queryClient: target,
      persister,
      maxAge: CACHE_MAX_AGE,
      buster: CACHE_BUSTER,
    });
    expect(target.getQueryData(['goals'])).toBeUndefined();
    expect(storage.values.size).toBe(0);
  },
);
it('진행 중 저장 뒤 삭제를 직렬 실행하고 늦은 저장은 되살리지 않는다', async () => {
  const storage = memory();
  let release: (() => void) | undefined;
  const original = storage.setItem;
  storage.setItem = async (key, value) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await original(key, value);
  };
  const persister = createUserPersister('alice', storage);
  const writing = persister.persistClient(stored());
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  const deletion = persister.revoke();
  release!();
  await writing;
  await deletion;
  await persister.persistClient(stored());
  expect(storage.values.size).toBe(0);
});
it('로그아웃은 영속 캐시도 삭제하며 오래된 persister가 다시 쓸 수 없다', async () => {
  const client = createTestClient();
  vi.spyOn(client.auth, 'signOut').mockResolvedValue({ error: null });
  const query = cache();
  const entry = userCache(query, 'alice');
  await entry.persister.persistClient(stored());
  expect(localStorage.getItem('nodii.query-cache:alice')).not.toBeNull();
  await logout(client, query, vi.fn());
  await entry.persister.persistClient(stored());
  expect(localStorage.getItem('nodii.query-cache:alice')).toBeNull();
  await client.auth.dispose();
});
it('복원 중 로그아웃하면 늦게 읽힌 데이터도 반환하지 않는다', async () => {
  const saved = JSON.stringify({ userId: 'alice', client: stored() });
  let release: ((value: string) => void) | undefined;
  const storage = {
    getItem: () =>
      new Promise<string>((resolve) => {
        release = resolve;
      }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  const persister = createUserPersister('alice', storage);
  const restoring = persister.restoreClient();
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  const deletion = persister.revoke();
  release!(saved);
  expect(await restoring).toBeUndefined();
  await deletion;
});
