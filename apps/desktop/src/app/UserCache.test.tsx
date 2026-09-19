import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider, dehydrate, onlineManager } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { AUTH_STORAGE_KEY, mapGoal, mapTodo } from '@nodii/api';
import { AppGate } from './AppGate';
import { CACHE_BUSTER, createUserPersister } from '../lib/query-persister';
import { queryStorage } from '../lib/query-storage';
import { baseUrl, createTestClient, sessionResponse } from '../test/auth-fixtures';
import { goalRow, todoRow } from '../test/data-fixtures';
import { useUIStore } from '../stores/ui';
import { server } from '../test/server';

vi.mock('../lib/today', () => ({ useTodayClock: vi.fn() }));
afterEach(() => {
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});
it('만료 세션 갱신과 버전 조회를 기다리지 않고 오프라인 시작 시 저장된 하루를 복원한다', async () => {
  const userId = sessionResponse.user.id;
  const stored = new QueryClient();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  stored.setQueryData(['profile', userId, timezone], {
    id: userId,
    displayName: null,
    timezone,
    weekStart: 0,
  });
  stored.setQueryData(['goals'], [mapGoal(goalRow)]);
  stored.setQueryData(['todos', '2026-09'], [mapTodo(todoRow)]);
  stored.setQueryData(['routines'], []);
  stored.setQueryData(['routineLogs', '2026-09'], []);
  await createUserPersister(userId, queryStorage).persistClient({
    buster: CACHE_BUSTER,
    timestamp: Date.now(),
    clientState: dehydrate(stored),
  });
  stored.clear();
  const value = JSON.stringify({ ...sessionResponse, expires_at: 1 });
  const client = createTestClient({
    getItem: (key) => (key === AUTH_STORAGE_KEY ? value : null),
    setItem: () => {},
    removeItem: () => {},
  });
  // 실제 SDK 갱신은 네트워크 오류, 게이트의 getSession은 완료하지 않는 최악의 시작 상태.
  server.use(
    http.post(`${baseUrl}/auth/v1/token`, () => HttpResponse.error()),
    http.get(`${baseUrl}/rest/v1/app_config`, async () => {
      await delay(1500);
      return HttpResponse.json({ value: '0.1.0' });
    }),
  );
  vi.spyOn(client.auth, 'getSession').mockImplementation(() => new Promise(() => {}));
  vi.spyOn(client.auth, 'onAuthStateChange').mockReturnValue({
    data: { subscription: { id: 'test', callback: vi.fn(), unsubscribe: vi.fn() } },
  });
  onlineManager.setOnline(false);
  useUIStore.setState({ today: todoRow.date, selectedDate: todoRow.date });
  const parent = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={parent}>
      <AppGate client={client} />
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole('button', { name: '책 읽기 완료' }, { timeout: 900 }),
  ).toBeTruthy();
  expect(screen.getByText('오프라인이라 보기만 할 수 있어요')).toBeTruthy();
  expect(screen.getByRole('button', { name: '책 읽기 완료' }).getAttribute('aria-disabled')).toBe(
    'true',
  );
  // 온라인 재조회 실패 후에도 캐시 데이터가 계속 보인다.
  server.use(http.get(`${baseUrl}/rest/v1/todos`, () => HttpResponse.error()));
  await act(async () => onlineManager.setOnline(true));
  await waitFor(() => expect(screen.getByRole('button', { name: '책 읽기 완료' })).toBeTruthy());
  view.unmount();
  parent.clear();
  await client.auth.dispose();
});
