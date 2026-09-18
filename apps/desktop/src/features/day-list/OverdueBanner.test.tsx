import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { buildDay, type Routine } from '@nodii/core';
import { mapGoal, mapTodo, queryKeys } from '@nodii/api';
import { toast } from 'sonner';
import { server } from '../../test/server';
import { baseUrl, createTestClient } from '../../test/auth-fixtures';
import { goalRow, todoRow } from '../../test/data-fixtures';
import { useUIStore } from '../../stores/ui';
import { OverdueBanner } from './OverdueBanner';

afterEach(() => toast.dismiss());
it('buildDay의 마지막 루틴을 포함한 todayItems 뒤로 가져오기 RPC 키를 만든다', async () => {
  const today = '2026-10-01';
  useUIStore.setState({ today, selectedDate: today });
  const goal = mapGoal(goalRow);
  const todo = mapTodo(todoRow);
  const routine: Routine = {
    id: 'routine',
    goalId: goal.id,
    title: '운동',
    sortKey: 'a9',
    freq: 'daily',
    repeatEvery: 1,
    byWeekday: null,
    byMonthday: null,
    startDate: '2026-09-01',
    endDate: null,
  };
  const items = buildDay({
    goals: [goal],
    todos: [{ ...todo, date: today }],
    routines: [routine],
    logs: [],
    date: today,
    timeZone: 'UTC',
  }).flatMap((group) => group.items);
  let body: { p_date: string; p_moves: { id: string; sort_key: string }[] } | undefined;
  server.use(
    http.post(`${baseUrl}/rest/v1/rpc/move_todos`, async ({ request }) => {
      body = (await request.json()) as typeof body;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  const client = createTestClient();
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  cache.setQueryData(queryKeys.overdue(today), [todo]);
  cache.setQueryDefaults(queryKeys.overdue(today), { staleTime: Infinity });
  const view = render(
    <QueryClientProvider client={cache}>
      <OverdueBanner client={client} weekStart={0} goals={[goal]} todayItems={items} />
    </QueryClientProvider>,
  );
  try {
    await userEvent.setup().click(screen.getByRole('button', { name: '가져오기' }));
    await waitFor(() => expect(body?.p_moves).toHaveLength(1));
    expect(body!.p_moves[0]!.sort_key > routine.sortKey).toBe(true);
    expect(body!.p_date).toBe(today);
    expect(body!.p_moves[0]!.id).toBe(todo.id);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  } finally {
    view.unmount();
    cache.clear();
    await client.auth.dispose();
  }
});
