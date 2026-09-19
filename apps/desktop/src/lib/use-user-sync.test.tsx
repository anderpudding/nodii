import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { subscribeUserChanges, type UserChange } from '@nodii/api';
import type * as NodiiApi from '@nodii/api';
import { useUserSync } from './use-user-sync';
import { createTestClient } from '../test/auth-fixtures';
import { todoRow } from '../test/data-fixtures';

vi.mock('@nodii/api', async (original) => ({
  ...(await original<typeof NodiiApi>()),
  subscribeUserChanges: vi.fn(() => vi.fn()),
}));
afterEach(() => {
  onlineManager.setOnline(true);
  vi.clearAllMocks();
});
it('같은 구독에서 최신 weekStart를 적용하고 재연결 때 모든 서버 쿼리를 무효화한다', async () => {
  const cache = new QueryClient();
  const client = createTestClient();
  cache.setQueryData(['todos', '2026-10'], []);
  cache.setQueryData(['profile', 'user'], {});
  cache.setQueryData(['routines'], []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  );
  const { rerender, unmount } = renderHook(
    ({ weekStart }: { weekStart: 0 | 1 }) => useUserSync(client, 'user', weekStart),
    { initialProps: { weekStart: 0 }, wrapper },
  );
  const subscribe = vi.mocked(subscribeUserChanges);
  const handlers = subscribe.mock.calls[0]![2];
  const event: UserChange = {
    table: 'todos',
    schema: 'public',
    commit_timestamp: '',
    errors: [],
    eventType: 'INSERT',
    old: {},
    new: { ...todoRow, date: '2026-11-08' },
  };
  act(() => handlers.onEvent(event));
  expect(cache.getQueryData(['todos', '2026-10'])).toEqual([]);
  rerender({ weekStart: 1 });
  act(() => handlers.onEvent(event));
  expect(cache.getQueryData(['todos', '2026-10'])).toHaveLength(1);
  expect(subscribe).toHaveBeenCalledOnce();
  act(() => {
    handlers.onStatus?.('CHANNEL_ERROR');
  });
  expect(onlineManager.isOnline()).toBe(true);
  act(() => {
    handlers.onStatus?.('SUBSCRIBED');
    handlers.onReconnect?.();
  });
  expect(onlineManager.isOnline()).toBe(true);
  expect(
    cache
      .getQueryCache()
      .getAll()
      .every((query) => query.state.isInvalidated),
  ).toBe(true);
  unmount();
  expect(subscribe.mock.results[0]!.value).toHaveBeenCalledOnce();
  cache.clear();
  await client.auth.dispose();
});
