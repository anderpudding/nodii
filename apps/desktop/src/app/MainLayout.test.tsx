import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { mapGoal, mapTodo } from '@nodii/api';
import { MainLayout } from './MainLayout';
import { reportChannelStatus, startConnectivity } from '../lib/connectivity';
import { useUIStore } from '../stores/ui';
import { baseUrl, createTestClient, sessionResponse } from '../test/auth-fixtures';
import { goalRow, todoRow } from '../test/data-fixtures';
import { server } from '../test/server';

vi.mock('../lib/today', () => ({ useTodayClock: vi.fn() }));

it('채널만 끊겨도 체크를 HTTP로 저장하고 배지는 오프라인과 구분한다', async () => {
  const navigatorOnline = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const stop = startConnectivity();
  const client = createTestClient();
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
  useUIStore.setState({ today: todoRow.date, selectedDate: todoRow.date });
  cache.setQueryData(['goals'], [mapGoal(goalRow)]);
  cache.setQueryData(['todos', '2026-09'], [mapTodo(todoRow)]);
  cache.setQueryData(['routines'], []);
  cache.setQueryData(['routineLogs', '2026-09'], []);
  cache.setQueryData(['overdue', todoRow.date], []);
  const savedRow = {
    ...todoRow,
    is_done: true,
    done_at: '2026-09-30T12:00:00Z',
    updated_at: '2026-09-30T12:00:00Z',
  };
  const save = vi.fn(async ({ request }: { request: Request }) => {
    expect(await request.json()).toMatchObject({ is_done: true });
    return HttpResponse.json(savedRow);
  });
  server.use(http.patch(`${baseUrl}/rest/v1/todos`, save));
  const { unmount } = render(
    <QueryClientProvider client={cache}>
      <MainLayout
        client={client}
        session={{ ...sessionResponse, token_type: 'bearer' }}
        profile={{ id: sessionResponse.user.id, displayName: null, timezone: 'UTC', weekStart: 0 }}
      />
    </QueryClientProvider>,
  );
  try {
    act(() => reportChannelStatus('CHANNEL_ERROR'));
    const badge = screen.getByRole('status', { name: '연결 상태' });
    expect(badge.textContent).toBe('동기화가 잠시 끊겼어요');
    expect(onlineManager.isOnline()).toBe(true);
    const check = screen.getByRole('button', { name: '책 읽기 완료' });
    expect(check.getAttribute('aria-disabled')).toBeNull();
    await userEvent.setup().click(check);
    // 낙관적 체크뿐 아니라 서버 응답의 메타데이터까지 캐시에 반영됐는지 확인한다.
    await waitFor(() => {
      expect(cache.getQueryData(['todos', '2026-09'])).toEqual([mapTodo(savedRow)]);
    });
    expect(save).toHaveBeenCalledOnce();
    expect(check.getAttribute('aria-pressed')).toBe('true');
    expect(badge.textContent).toBe('동기화가 잠시 끊겼어요');
    navigatorOnline.mockReturnValue(false);
    act(() => window.dispatchEvent(new Event('offline')));
    expect(badge.textContent).toBe('오프라인이라 보기만 할 수 있어요');
    act(() => reportChannelStatus('SUBSCRIBED'));
    expect(badge.textContent).toBe('오프라인이라 보기만 할 수 있어요');
    navigatorOnline.mockReturnValue(true);
    act(() => window.dispatchEvent(new Event('online')));
    expect(badge.textContent).toBe('');
  } finally {
    unmount();
    stop();
    reportChannelStatus();
    onlineManager.setOnline(true);
    vi.restoreAllMocks();
    cache.clear();
    await client.auth.dispose();
  }
});
