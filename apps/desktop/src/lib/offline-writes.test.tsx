import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  OfflineWriteError,
  mapGoal,
  mapTodo,
  useToggleTodo,
  useSetRoutineLog,
  useImportOverdue,
} from '@nodii/api';
import { createTestClient } from '../test/auth-fixtures';
import { goalRow, todoRow } from '../test/data-fixtures';

afterEach(() => onlineManager.setOnline(true));
it('체크·루틴 완료·가져오기를 낙관적 변경과 HTTP 요청 전에 거부하고 큐를 남기지 않는다', async () => {
  const client = createTestClient();
  const cache = new QueryClient();
  const onError = vi.fn();
  const request = vi.spyOn(client, 'from');
  const rpc = vi.spyOn(client, 'rpc');
  const before = [mapTodo(todoRow)];
  cache.setQueryData(['todos', '2026-09'], before);
  cache.setQueryData(['goals'], [mapGoal(goalRow)]);
  cache.setQueryData(['routineLogs', '2026-09'], []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cache}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(
    () => ({
      todo: useToggleTodo(client, 0, todoRow.id, { onError }),
      log: useSetRoutineLog(client, 0, 'routine', todoRow.date, { onError }),
      overdue: useImportOverdue(client, 0, { onError }),
    }),
    { wrapper },
  );
  onlineManager.setOnline(false);
  await act(async () => {
    await expect(result.current.todo.mutateAsync(before[0]!)).rejects.toBeInstanceOf(
      OfflineWriteError,
    );
    await expect(
      result.current.log.mutateAsync({ routineId: 'routine', date: todoRow.date, status: 'done' }),
    ).rejects.toBeInstanceOf(OfflineWriteError);
    await expect(
      result.current.overdue.mutateAsync({
        overdue: before,
        moves: [{ id: todoRow.id, sort_key: 'a1' }],
        today: '2026-10-01',
      }),
    ).rejects.toBeInstanceOf(OfflineWriteError);
  });
  expect(cache.getQueryData(['todos', '2026-09'])).toEqual(before);
  expect(cache.getQueryData(['routineLogs', '2026-09'])).toEqual([]);
  expect(onError).toHaveBeenCalledTimes(3);
  expect(request).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
  await act(async () => {
    onlineManager.setOnline(true);
    await cache.resumePausedMutations();
  });
  expect(request).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
  unmount();
  cache.clear();
  await client.auth.dispose();
});
