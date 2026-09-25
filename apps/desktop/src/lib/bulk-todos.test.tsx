import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mapTodo, useBulkDeleteTodos, useBulkMoveTodos, type TodoRecord } from '@nodii/api';
import { baseUrl, createTestClient } from '../test/auth-fixtures';
import { todoRow } from '../test/data-fixtures';
import { server } from '../test/server';

it.each([false, true])(
  '일괄 삭제 훅은 겹치는 월·overdue를 갱신하고 실패=%s일 때 롤백한다',
  async (fail) => {
    const client = createTestClient();
    const cache = new QueryClient();
    const rows = [mapTodo(todoRow), mapTodo({ ...todoRow, id: 'second' })];
    const keys = [
      ['todos', '2026-09'],
      ['todos', '2026-10'],
      ['overdue', '2026-10-01'],
    ];
    for (const key of keys) cache.setQueryData(key, rows);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.patch(`${baseUrl}/rest/v1/todos`, async ({ request }) => {
        const changes = (await request.json()) as { deleted_at: string | null };
        await gate;
        return fail
          ? HttpResponse.json({ message: 'failed' }, { status: 403 })
          : HttpResponse.json(rows.map((row) => ({ ...todoRow, id: row.id, ...changes })));
      }),
    );
    const onError = vi.fn();
    const hook = renderHook(() => useBulkDeleteTodos(client, 0, { onError }), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={cache}>{children}</QueryClientProvider>
      ),
    });
    try {
      let request!: Promise<TodoRecord[]>;
      act(() => {
        request = hook.result.current.mutateAsync({ todos: rows });
      });
      // 실패 요청도 즉시 처리기를 연결해 미처리 rejection을 남기지 않는다.
      const settled = request.catch(() => undefined);
      await waitFor(() => {
        for (const key of keys) expect(cache.getQueryData(key)).toEqual([]);
      });
      await act(async () => {
        release();
        await settled;
      });
      if (fail) {
        expect(onError).toHaveBeenCalledOnce();
        for (const key of keys) expect(cache.getQueryData(key)).toEqual(rows);
      } else {
        const deleted = (await settled)!;
        await act(async () => {
          await hook.result.current.mutateAsync({ todos: deleted, restore: true });
        });
        for (const key of keys) expect(cache.getQueryData(key)).toEqual(rows);
        // 복원 실패도 삭제 전 캐시를 새로 만들어내지 않는다.
        await act(async () => {
          await hook.result.current.mutateAsync({ todos: rows });
        });
        server.use(
          http.patch(`${baseUrl}/rest/v1/todos`, () =>
            HttpResponse.json({ message: 'failed' }, { status: 403 }),
          ),
        );
        await act(async () => {
          await hook.result.current.mutateAsync({ todos: deleted, restore: true }).catch(() => {});
        });
        for (const key of keys) expect(cache.getQueryData(key)).toEqual([]);
        expect(onError).toHaveBeenCalledOnce();
      }
    } finally {
      hook.unmount();
      cache.clear();
      await client.auth.dispose();
    }
  },
);
it('일괄 이동 훅은 이전·대상 월을 낙관적으로 바꾸고 RPC 실패 시 양쪽을 복원한다', async () => {
  const client = createTestClient();
  const cache = new QueryClient();
  const rows = [mapTodo(todoRow), mapTodo({ ...todoRow, id: 'second' })];
  cache.setQueryData(['todos', '2026-09'], rows);
  cache.setQueryData(['todos', '2026-12'], []);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.post(`${baseUrl}/rest/v1/rpc/move_todos`, async () => {
      await gate;
      return HttpResponse.json({ message: 'failed' }, { status: 403 });
    }),
  );
  const onError = vi.fn();
  const hook = renderHook(() => useBulkMoveTodos(client, 0, { onError }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={cache}>{children}</QueryClientProvider>
    ),
  });
  try {
    let request!: Promise<void | undefined>;
    act(() => {
      request = hook.result.current
        .mutateAsync({
          todos: rows,
          moves: rows.map((row) => ({ id: row.id, sort_key: row.sortKey })),
          date: '2026-12-15',
        })
        .catch(() => undefined);
    });
    await waitFor(() => expect(cache.getQueryData(['todos', '2026-09'])).toEqual([]));
    expect(cache.getQueryData<TodoRecord[]>(['todos', '2026-12'])?.map((row) => row.date)).toEqual([
      '2026-12-15',
      '2026-12-15',
    ]);
    await act(async () => {
      release();
      await request;
    });
    expect(onError).toHaveBeenCalledOnce();
    expect(cache.getQueryData(['todos', '2026-09'])).toEqual(rows);
    expect(cache.getQueryData(['todos', '2026-12'])).toEqual([]);
  } finally {
    hook.unmount();
    cache.clear();
    await client.auth.dispose();
  }
});
