import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { buildDay, type Routine } from '@nodii/core';
import { mapGoal, mapTodo, queryKeys } from '@nodii/api';
import { toast, Toaster } from 'sonner';
import { server } from '../../test/server';
import { baseUrl, createTestClient } from '../../test/auth-fixtures';
import { goalRow, todoRow } from '../../test/data-fixtures';
import { useUIStore } from '../../stores/ui';
import { DayMenu } from './DayMenu';
import { DayView } from './DayView';

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
      <DayMenu
        client={client}
        profile={{ id: 'u', displayName: null, timezone: 'UTC', weekStart: 0 }}
        goals={[goal]}
        items={items}
        todos={[]}
        ready
      />
    </QueryClientProvider>,
  );
  try {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '하루 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: /지난 미완료 할 일 1개 가져오기/ }));
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

async function setupDay(rows = [todoRow], date = todoRow.date) {
  useUIStore.setState({ today: todoRow.date, selectedDate: date });
  const client = createTestClient();
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let saved = rows.map((row) => ({ ...row }));
  const rpc = vi.fn(async ({ request }: { request: Request }) => {
    const body = (await request.json()) as {
      p_date: string;
      p_moves: { id: string; sort_key: string }[];
    };
    saved = saved.map((row) => {
      const move = body.p_moves.find((m) => m.id === row.id);
      return move ? { ...row, date: body.p_date, sort_key: move.sort_key } : row;
    });
    return new HttpResponse(null, { status: 204 });
  });
  const patch = vi.fn(async ({ request }: { request: Request }) => {
    const ids = new URL(request.url).searchParams.get('id')!.slice(4, -1).split(',');
    const body = (await request.json()) as object;
    saved = saved.map((row) => (ids.includes(row.id) ? { ...row, ...body } : row));
    return HttpResponse.json(saved.filter((row) => ids.includes(row.id)));
  });
  server.use(
    http.get(`${baseUrl}/rest/v1/todos`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const from = params
        .getAll('date')
        .find((d) => d.startsWith('gte.'))!
        .slice(4);
      const to = params
        .getAll('date')
        .find((d) => d.startsWith('lte.'))!
        .slice(4);
      return HttpResponse.json(
        saved.filter(
          (row) =>
            !row.deleted_at &&
            row.date >= from &&
            row.date <= to &&
            (!params.has('is_done') || !row.is_done),
        ),
      );
    }),
    http.patch(`${baseUrl}/rest/v1/todos`, patch),
    http.post(`${baseUrl}/rest/v1/rpc/move_todos`, rpc),
  );
  const view = render(
    <QueryClientProvider client={cache}>
      <DayView
        client={client}
        profile={{ id: 'user', displayName: null, timezone: 'America/Vancouver', weekStart: 0 }}
      />
      <Toaster />
    </QueryClientProvider>,
  );
  await screen.findByRole('button', { name: '할 일에 할 일 추가' });
  await waitFor(() => expect(cache.getQueryData(['routines'])).toBeDefined());
  const user = userEvent.setup();
  return {
    user,
    cache,
    rpc,
    patch,
    rows: () => saved,
    close: async () => {
      view.unmount();
      cache.clear();
      await client.auth.dispose();
    },
  };
}

it('오늘이 아니면 가져오기 이유를 표시하고 미완료 0개면 이동·삭제를 비활성화한다', async () => {
  const ctx = await setupDay([], '2026-10-01');
  try {
    await ctx.user.click(screen.getByRole('button', { name: '하루 메뉴' }));
    expect(screen.getByText('오늘 화면에서만 쓸 수 있어요')).toBeTruthy();
    for (const item of screen.getAllByRole('menuitem'))
      expect(item.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getAllByText('미완료 할 일이 없어요')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /루틴 추가/ })).toBeNull();
  } finally {
    await ctx.close();
  }
});

it('오프라인과 다른 쓰기가 진행 중일 때 하루 메뉴를 비활성화한다', async () => {
  const ctx = await setupDay();
  try {
    act(() => onlineManager.setOnline(false));
    await ctx.user.click(screen.getByRole('button', { name: '하루 메뉴' }));
    expect(screen.getAllByText('오프라인이라 보기만 할 수 있어요')).toHaveLength(3);
    for (const item of screen.getAllByRole('menuitem'))
      expect(item.getAttribute('aria-disabled')).toBe('true');
    act(() => onlineManager.setOnline(true));
    let release!: () => void;
    const mutation = ctx.cache.getMutationCache().build(ctx.cache, {
      mutationKey: ['write', 'other'],
      mutationFn: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    });
    let pending!: Promise<void>;
    await act(async () => {
      pending = mutation.execute(undefined);
    });
    await waitFor(() => expect(screen.getAllByText('저장이 끝나면 쓸 수 있어요')).toHaveLength(3));
    await act(async () => {
      release();
      await pending;
    });
  } finally {
    onlineManager.setOnline(true);
    await ctx.close();
  }
});

it('삭제 확인 개수는 미완료만 세고 실행 취소로 모두 복원한다', async () => {
  const ctx = await setupDay([
    todoRow,
    { ...todoRow, id: 'second', title: '두 번째' },
    { ...todoRow, id: 'done', title: '완료한 일', is_done: true },
  ]);
  try {
    await ctx.user.click(screen.getByRole('button', { name: '하루 메뉴' }));
    await ctx.user.click(screen.getByRole('menuitem', { name: '미완료 할 일 전체 삭제' }));
    expect(
      screen.getByRole('alertdialog', { name: '미완료 할 일 2개를 삭제할까요?' }),
    ).toBeTruthy();
    await waitFor(() => expect(document.activeElement?.textContent).toBe('취소'));
    expect(screen.getByText('완료한 할 일과 루틴은 남아요.')).toBeTruthy();
    await ctx.user.click(screen.getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(ctx.patch).toHaveBeenCalledOnce());
    expect(screen.queryByRole('button', { name: '책 읽기 완료' })).toBeNull();
    expect(screen.getByRole('button', { name: '완료한 일 완료' })).toBeTruthy();
    await ctx.user.click(screen.getByRole('button', { name: '실행 취소' }));
    expect(await screen.findByRole('button', { name: '책 읽기 완료' })).toBeTruthy();
    await waitFor(() => expect(ctx.patch).toHaveBeenCalledTimes(2));
    expect(ctx.rows().every((row) => row.deleted_at === null)).toBe(true);
  } finally {
    await ctx.close();
  }
});

it('선택 날짜의 미완료만 대상 날짜의 마지막 루틴 뒤로 옮기고 실행 취소한다', async () => {
  const routine = {
    id: 'routine',
    user_id: goalRow.user_id,
    goal_id: goalRow.id,
    title: '마지막 루틴',
    sort_key: 'a9',
    freq: 'daily',
    repeat_every: 1,
    by_weekday: null,
    by_monthday: null,
    start_date: '2026-09-01',
    end_date: null,
    deleted_at: null,
    created_at: '',
    updated_at: '',
  };
  server.use(http.get(`${baseUrl}/rest/v1/routines`, () => HttpResponse.json([routine])));
  const ctx = await setupDay([
    todoRow,
    { ...todoRow, id: 'done', title: '완료한 일', is_done: true },
    { ...todoRow, id: 'target', date: '2026-10-01', sort_key: 'a5' },
  ]);
  try {
    await ctx.user.click(screen.getByRole('button', { name: '하루 메뉴' }));
    await ctx.user.click(screen.getByRole('menuitem', { name: '미완료 할 일 다른 날로 옮기기' }));
    await ctx.user.click(screen.getByRole('button', { name: '2026년 10월 1일' }));
    await waitFor(() => expect(ctx.rpc).toHaveBeenCalledOnce());
    const moved = ctx.rows().find((row) => row.id === todoRow.id)!;
    expect(moved.date).toBe('2026-10-01');
    expect(moved.sort_key > routine.sort_key).toBe(true);
    expect(ctx.rows().find((row) => row.id === 'done')!.date).toBe(todoRow.date);
    expect(screen.getByRole('button', { name: '마지막 루틴 완료' })).toBeTruthy();
    await ctx.user.click(screen.getByRole('button', { name: '실행 취소' }));
    await waitFor(() => expect(ctx.rpc).toHaveBeenCalledTimes(2));
    expect(ctx.rows().find((row) => row.id === todoRow.id)).toMatchObject({
      date: todoRow.date,
      sort_key: todoRow.sort_key,
    });
  } finally {
    await ctx.close();
  }
});
