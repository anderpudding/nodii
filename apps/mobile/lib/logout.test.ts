import type * as Api from '@nodii/api';
import { beforeEach, expect, it, vi } from 'vitest';
import { AUTH_STORAGE_KEY, signOut, type NodiiClient } from '@nodii/api';
import { QueryClient } from '@tanstack/react-query';
vi.mock('@nodii/api', async (original) => ({
  ...(await original<typeof Api>()),
  signOut: vi.fn(),
}));
vi.mock('expo-secure-store', () => ({}));
import { logout } from './logout';
beforeEach(() => vi.clearAllMocks());
it.each([false, true])(
  '정상/네트워크 실패(%s) 모두 서버 → 캐시 → 인증 키 순서로 지운다',
  async (network) => {
    const order: string[] = [];
    vi.mocked(signOut).mockImplementation(async () => {
      order.push('server');
      if (network) throw { code: 'network' };
    });
    const query = new QueryClient();
    query.setQueryData(['private'], 'secret');
    const clear = vi.spyOn(query, 'clear').mockImplementation(() => {
      order.push('cache');
      QueryClient.prototype.clear.call(query);
    });
    const removeItem = vi.fn(async (key: string) => {
      order.push(key);
    });
    const stop = vi.fn();
    expect(
      await logout({ auth: { stopAutoRefresh: stop } } as unknown as NodiiClient, query, {
        getItem: () => null,
        setItem: () => {},
        removeItem,
      }),
    ).toEqual({ localOnly: network });
    expect(order.slice(0, 3)).toEqual(['server', 'cache', AUTH_STORAGE_KEY]);
    expect(clear).toHaveBeenCalledOnce();
    expect(query.getQueryCache().getAll()).toHaveLength(0);
    expect(removeItem.mock.calls.map(([key]) => key)).toEqual([
      AUTH_STORAGE_KEY,
      `${AUTH_STORAGE_KEY}-code-verifier`,
      `${AUTH_STORAGE_KEY}-user`,
    ]);
    expect(stop).toHaveBeenCalledOnce();
  },
);
it('네트워크 이외 오류와 저장소 삭제 실패는 성공으로 처리하지 않는다', async () => {
  const query = new QueryClient();
  query.setQueryData(['private'], 'secret');
  const storage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: vi.fn().mockRejectedValue(new Error('keychain')),
  };
  const client = { auth: { stopAutoRefresh: vi.fn() } } as unknown as NodiiClient;
  vi.mocked(signOut).mockRejectedValueOnce({ code: 'unknown' });
  await expect(logout(client, query, storage)).rejects.toEqual({ code: 'unknown' });
  expect(query.getQueryData(['private'])).toBe('secret');
  expect(storage.removeItem).not.toHaveBeenCalled();
  vi.mocked(signOut).mockResolvedValueOnce();
  await expect(logout(client, query, storage)).rejects.toThrow('keychain');
});
