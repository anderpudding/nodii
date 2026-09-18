import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { mapTodo, queryKeys, type NodiiClient } from '@nodii/api';
import * as core from '@nodii/core';
import { Toaster } from 'sonner';
import { MainLayout } from '../../app/MainLayout';
import { server } from '../../test/server';
import { baseUrl, createTestClient, sessionResponse } from '../../test/auth-fixtures';
import { goalRow, todoRow } from '../../test/data-fixtures';
import { useUIStore } from '../../stores/ui';

const clients: NodiiClient[] = [];
const queries: QueryClient[] = [];
beforeEach(() => useUIStore.setState({ today: todoRow.date, selectedDate: todoRow.date }));
afterEach(async () => {
  toast.dismiss();
  vi.restoreAllMocks();
  queries.splice(0).forEach((cache) => cache.clear());
  await Promise.all(clients.splice(0).map((client) => client.auth.dispose()));
});
function setup(weekStart: 0 | 1 = 0, timezone = 'UTC') {
  const client = createTestClient();
  clients.push(client);
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  queries.push(cache);
  render(
    <QueryClientProvider client={cache}>
      <MainLayout
        client={client}
        session={{ ...sessionResponse, token_type: 'bearer' }}
        profile={{ id: sessionResponse.user.id, displayName: null, timezone, weekStart }}
      />
      <Toaster />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), cache };
}
it.each([false, true])(
  '헤더와 빈 상태는 삭제된 목표의 할 일을 제외한 표시 목록을 따른다 (숨겨진 항목만: %s)',
  async (hiddenOnly) => {
    server.use(
      // 삭제된 목표는 목표 쿼리에서 제외됐지만 월 캐시에는 그 할 일이 남은 상황이다.
      http.get(`${baseUrl}/rest/v1/goals`, () =>
        HttpResponse.json([
          goalRow,
          { ...goalRow, id: 'archived', name: '지난 목표', archived_at: '2026-09-29T00:00:00Z' },
        ]),
      ),
      http.get(`${baseUrl}/rest/v1/todos`, () =>
        HttpResponse.json([
          { ...todoRow, id: 'hidden-pending', goal_id: 'deleted', title: '숨겨진 미완료' },
          {
            ...todoRow,
            id: 'hidden-done',
            goal_id: 'deleted',
            title: '숨겨진 완료',
            is_done: true,
          },
          {
            ...todoRow,
            id: 'other-day',
            title: '다른 날 할 일',
            date: '2026-09-29',
            is_done: true,
          },
          ...(hiddenOnly
            ? []
            : [
                todoRow,
                {
                  ...todoRow,
                  id: 'archived-done',
                  goal_id: 'archived',
                  title: '지난 목표 기록',
                  is_done: true,
                },
              ]),
        ]),
      ),
    );
    setup();
    await screen.findByRole('button', { name: '할 일에 할 일 추가' });
    expect(screen.queryByRole('button', { name: '숨겨진 미완료 완료' })).toBeNull();
    expect(screen.queryByRole('button', { name: '숨겨진 완료 완료' })).toBeNull();
    expect(screen.queryByRole('button', { name: '다른 날 할 일 완료' })).toBeNull();
    const emptyMessage = '이날은 비어 있어요. 목표 이름을 누르면 할 일을 바로 추가할 수 있어요.';
    if (hiddenOnly) {
      expect(screen.getByText('할 일 없음')).toBeTruthy();
      expect(screen.getByText(emptyMessage)).toBeTruthy();
      expect(screen.queryAllByRole('button', { name: / 완료$/ })).toHaveLength(0);
    } else {
      expect(screen.getByText('오늘, 2개 중 1개 끝냄')).toBeTruthy();
      expect(screen.getAllByRole('button', { name: / 완료$/ })).toHaveLength(2);
      expect(
        screen.getByRole('button', { name: '지난 목표 기록 완료' }).getAttribute('aria-pressed'),
      ).toBe('true');
      expect(screen.queryByText(emptyMessage)).toBeNull();
    }
  },
);
it('추가 요청 완료 전에 표시하고 연속 입력·정렬 키·IME·Esc를 지원한다', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const inserts: Record<string, unknown>[] = [];
  server.use(
    http.post(`${baseUrl}/rest/v1/todos`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      inserts.push(body);
      await gate;
      return HttpResponse.json({ ...todoRow, ...body, updated_at: '2026-09-30T01:00:00Z' });
    }),
  );
  const { user } = setup();
  await user.click(await screen.findByRole('button', { name: '할 일에 할 일 추가' }));
  const input = screen.getByRole('textbox', { name: '할 일 새 할 일' });
  await user.type(input, '첫 번째');
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(inserts).toHaveLength(0);
  await user.keyboard('{Enter}');
  expect(await screen.findByRole('button', { name: '첫 번째 완료' })).toBeTruthy();
  expect((input as HTMLInputElement).value).toBe('');
  await user.type(input, '두 번째{Enter}');
  expect(await screen.findByRole('button', { name: '두 번째 완료' })).toBeTruthy();
  await waitFor(() => expect(inserts).toHaveLength(2));
  expect(String(inserts[0]!.sort_key) < String(inserts[1]!.sort_key)).toBe(true);
  expect(inserts[0]!.id).toMatch(/^[0-9a-f-]{36}$/);
  await act(async () => release());
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '할 일에 할 일 추가' }));
});
it('체크 실패 시 인접 월 모두 원상복구하고 토스트에서 재시도한다', async () => {
  server.use(http.get(`${baseUrl}/rest/v1/todos`, () => HttpResponse.json([todoRow])));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.patch(`${baseUrl}/rest/v1/todos`, async () => {
      await gate;
      return HttpResponse.json({ message: 'failure' }, { status: 403 });
    }),
  );
  const { user, cache } = setup();
  const checkbox = await screen.findByRole('button', { name: '책 읽기 완료' });
  cache.setQueryData(queryKeys.todos('2026-10'), [mapTodo(todoRow)]);
  await user.click(checkbox);
  await waitFor(() => expect(checkbox.getAttribute('aria-pressed')).toBe('true'));
  await act(async () => release());
  await waitFor(() => expect(checkbox.getAttribute('aria-pressed')).toBe('false'));
  expect(cache.getQueryData(queryKeys.todos('2026-10'))).toEqual([mapTodo(todoRow)]);
  expect(await screen.findByText('저장하지 못했어요')).toBeTruthy();
  server.use(
    http.patch(`${baseUrl}/rest/v1/todos`, () =>
      HttpResponse.json({
        ...todoRow,
        is_done: true,
        done_at: '2026-09-30T01:00:00Z',
        updated_at: '2026-09-30T01:00:00Z',
      }),
    ),
  );
  await user.click(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(checkbox.getAttribute('aria-pressed')).toBe('true'));
});
it('인라인 수정 Esc와 빈 제목은 취소하고 Enter는 저장한다', async () => {
  const patch = vi.fn(async ({ request }: { request: Request }) =>
    HttpResponse.json({ ...todoRow, ...((await request.json()) as object) }),
  );
  server.use(
    http.get(`${baseUrl}/rest/v1/todos`, () => HttpResponse.json([todoRow])),
    http.patch(`${baseUrl}/rest/v1/todos`, patch),
  );
  const { user } = setup();
  await user.dblClick(await screen.findByRole('button', { name: '책 읽기' }));
  await user.clear(screen.getByLabelText('할 일 제목 수정'));
  await user.type(screen.getByLabelText('할 일 제목 수정'), '취소할 수정{Escape}');
  expect(screen.getByRole('button', { name: '책 읽기' })).toBeTruthy();
  expect(patch).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '책 읽기' }));
  await user.keyboard('{Enter}');
  await user.clear(screen.getByLabelText('할 일 제목 수정'));
  await user.keyboard('{Enter}');
  expect(patch).not.toHaveBeenCalled();
  await user.dblClick(screen.getByRole('button', { name: '책 읽기' }));
  await user.clear(screen.getByLabelText('할 일 제목 수정'));
  await user.type(screen.getByLabelText('할 일 제목 수정'), '책 두 권 읽기{Enter}');
  expect(await screen.findByRole('button', { name: '책 두 권 읽기' })).toBeTruthy();
  await waitFor(() => expect(patch).toHaveBeenCalledOnce());
});
it('마지막 활성 목표의 보관 버튼은 이유와 함께 비활성이다', async () => {
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: '목표 관리' }));
  const dialog = await screen.findByRole('dialog', { name: '목표 관리' });
  const button = await within(dialog).findByRole('button', { name: '보관' });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(button.title).toBe('활성 목표는 하나 이상 있어야 해요');
  await user.click(within(dialog).getByRole('button', { name: '목표 관리 닫기' }));
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '목표 관리' }));
});
it('날짜 이동은 입력 중에는 무시하고 달 경계에서는 프로필의 42칸 범위로 조회한다', async () => {
  const ranges: string[] = [];
  server.use(
    http.get(`${baseUrl}/rest/v1/todos`, ({ request }) => {
      ranges.push(request.url);
      return HttpResponse.json([]);
    }),
  );
  const { user } = setup(1);
  await user.click(await screen.findByRole('button', { name: '할 일에 할 일 추가' }));
  await user.keyboard('{ArrowRight}');
  expect(useUIStore.getState().selectedDate).toBe('2026-09-30');
  await user.keyboard('{Escape}{ArrowRight}');
  expect(useUIStore.getState().selectedDate).toBe('2026-10-01');
  await waitFor(() =>
    expect(
      ranges.some(
        (url) => url.includes('date=gte.2026-09-28') && url.includes('date=lte.2026-11-08'),
      ),
    ).toBe(true),
  );
});
it('삭제 후 실행 취소는 서버 행과 목록을 복원한다', async () => {
  server.use(
    http.get(`${baseUrl}/rest/v1/todos`, () => HttpResponse.json([todoRow])),
    http.patch(`${baseUrl}/rest/v1/todos`, async ({ request }) =>
      HttpResponse.json({ ...todoRow, ...((await request.json()) as object) }),
    ),
  );
  const { user } = setup();
  await user.click(await screen.findByRole('button', { name: '책 읽기 메뉴' }));
  await user.click(screen.getByRole('menuitem', { name: '삭제' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '책 읽기 완료' })).toBeNull());
  await user.click(await screen.findByRole('button', { name: '실행 취소' }));
  expect(await screen.findByRole('button', { name: '책 읽기 완료' })).toBeTruthy();
});
it('보관 목표는 항목이 있는 날짜에만 표시하고 추가 버튼은 숨긴다', async () => {
  server.use(
    http.get(`${baseUrl}/rest/v1/goals`, () =>
      HttpResponse.json([
        goalRow,
        { ...goalRow, id: 'archived', name: '지난 목표', archived_at: '2026-09-30T00:00:00Z' },
      ]),
    ),
    http.get(`${baseUrl}/rest/v1/todos`, () =>
      HttpResponse.json([{ ...todoRow, goal_id: 'archived' }]),
    ),
  );
  const { user } = setup();
  expect(await screen.findByText('지난 목표')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '지난 목표에 할 일 추가' })).toBeNull();
  await user.click(screen.getByRole('button', { name: '다음 날' }));
  await waitFor(() => expect(screen.queryByText('지난 목표')).toBeNull());
});
it('목표 생성·이름과 프리셋 변경·보관·보관 해제를 화면과 서버에 반영한다', async () => {
  let created = { ...goalRow, id: 'new-goal', name: '공부' };
  server.use(
    http.post(`${baseUrl}/rest/v1/goals`, async ({ request }) => {
      created = { ...created, ...((await request.json()) as object) };
      return HttpResponse.json(created);
    }),
    http.patch(`${baseUrl}/rest/v1/goals`, async ({ request }) => {
      created = { ...created, ...((await request.json()) as object) };
      return HttpResponse.json(created);
    }),
  );
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: '목표 관리' }));
  const dialog = await screen.findByRole('dialog');
  await user.type(await within(dialog).findByLabelText('새 목표'), '공부');
  await user.click(within(dialog).getByRole('button', { name: '추가' }));
  const edit = await within(dialog).findByRole('button', { name: '공부 편집' });
  await waitFor(() => expect((edit as HTMLButtonElement).disabled).toBe(false));
  await user.click(edit);
  const name = within(dialog).getByLabelText('목표 이름');
  await user.clear(name);
  await user.type(name, '독서');
  await user.click(within(dialog).getByRole('button', { name: '퍼플' }));
  await user.click(within(dialog).getByRole('button', { name: '저장' }));
  const renamed = await within(dialog).findByRole('button', { name: '독서 편집' });
  await waitFor(() => expect((renamed as HTMLButtonElement).disabled).toBe(false));
  expect(created.color).toBe('#A06CD5');
  expect(created.name).toBe('독서');
  await user.click(within(renamed.parentElement!).getByRole('button', { name: '보관' }));
  const restore = await within(dialog).findByRole('button', { name: '보관 해제' });
  await waitFor(() => expect((restore as HTMLButtonElement).disabled).toBe(false));
  expect(created.archived_at).toBeTruthy();
  await user.click(restore);
  await waitFor(() => expect(created.archived_at).toBeNull());
  expect(within(dialog).queryByRole('button', { name: '보관 해제' })).toBeNull();
});
it('서버의 마지막 활성 목표 오류는 보관을 롤백하고 이유를 안내한다', async () => {
  server.use(
    http.get(`${baseUrl}/rest/v1/goals`, () =>
      HttpResponse.json([goalRow, { ...goalRow, id: 'other', name: '공부', sort_key: 'a1' }]),
    ),
    http.patch(`${baseUrl}/rest/v1/goals`, () =>
      HttpResponse.json(
        { code: 'P0001', message: 'at least one active goal is required' },
        { status: 400 },
      ),
    ),
  );
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: '목표 관리' }));
  const dialog = await screen.findByRole('dialog');
  const editor = await within(dialog).findByRole('button', { name: '공부 편집' });
  await user.click(within(editor.parentElement!).getByRole('button', { name: '보관' }));
  expect(await screen.findByText('활성 목표는 하나 이상 있어야 해요')).toBeTruthy();
  expect(within(dialog).queryByRole('button', { name: '보관 해제' })).toBeNull();
  expect(within(dialog).getAllByRole('button', { name: '보관' })).toHaveLength(2);
});

it('우클릭 내일로는 할 일 날짜 +1에 옮기고 두 월 및 실행 취소를 갱신한다', async () => {
  let current = { ...todoRow };
  const patches: Record<string, unknown>[] = [];
  server.use(
    http.get(`${baseUrl}/rest/v1/todos`, () => HttpResponse.json([current])),
    http.patch(`${baseUrl}/rest/v1/todos`, async ({ request }) => {
      const patch = (await request.json()) as Record<string, unknown>;
      patches.push(patch);
      current = { ...current, ...patch };
      return HttpResponse.json(current);
    }),
  );
  const { user, cache } = setup(1);
  const title = await screen.findByRole('button', { name: '책 읽기' });
  fireEvent.contextMenu(title, { clientX: 500, clientY: 200 });
  await user.click(await screen.findByRole('menuitem', { name: /내일로/ }));
  await waitFor(() => expect(patches[0]).toMatchObject({ date: '2026-10-01' }));
  for (const month of ['2026-09', '2026-10'])
    expect(cache.getQueryData(queryKeys.todos(month))).toEqual([mapTodo(current)]);
  expect(await screen.findByText('10월 1일로 옮겼어요')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: '실행 취소' }));
  expect(await screen.findByRole('button', { name: '책 읽기 완료' })).toBeTruthy();
  await waitFor(() => expect(patches[1]).toMatchObject({ date: '2026-09-30', sort_key: 'a0' }));
});
it('날짜 선택 팝오버는 캘린더를 공유하고 오늘인 항목의 오늘로 메뉴는 숨긴다', async () => {
  server.use(http.get(`${baseUrl}/rest/v1/todos`, () => HttpResponse.json([todoRow])));
  const { user } = setup();
  await user.click(await screen.findByRole('button', { name: '책 읽기 메뉴' }));
  expect(screen.queryByRole('menuitem', { name: /오늘로/ })).toBeNull();
  await user.click(screen.getByRole('menuitem', { name: '날짜 선택' }));
  const picker = await screen.findByRole('dialog', { name: '옮길 날짜 선택' });
  expect(within(picker).getAllByRole('gridcell')).toHaveLength(42);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '책 읽기 메뉴' }));
});
it('지난 배너 개수는 보관·완료·8일 전을 제외하고 가져오기 실패 시 목록과 배너를 복원한다', async () => {
  const today = '2026-10-04';
  useUIStore.setState({ today, selectedDate: today });
  const overdueRow = { ...todoRow, date: '2026-09-27' };
  const rows = [
    overdueRow,
    { ...overdueRow, id: 'archived', goal_id: 'archived-goal' },
    { ...overdueRow, id: 'too-old', date: '2026-09-26' },
    { ...overdueRow, id: 'done', is_done: true },
  ];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const rpc = vi.fn(async () => {
    await gate;
    return HttpResponse.json({ message: 'failure' }, { status: 403 });
  });
  server.use(
    http.get(`${baseUrl}/rest/v1/goals`, () =>
      HttpResponse.json([
        goalRow,
        { ...goalRow, id: 'archived-goal', archived_at: '2026-09-28T00:00:00Z' },
      ]),
    ),
    http.get(`${baseUrl}/rest/v1/todos`, ({ request }) => {
      const filters = new URL(request.url).searchParams.getAll('date');
      const from = filters.find((value) => value.startsWith('gte.'))!.slice(4);
      const to = filters.find((value) => value.startsWith('lte.'))!.slice(4);
      return HttpResponse.json(rows.filter((row) => row.date >= from && row.date <= to));
    }),
    http.post(`${baseUrl}/rest/v1/rpc/move_todos`, rpc),
  );
  const { user, cache } = setup(1);
  expect(await screen.findByText('지난 미완료 할 일 1개')).toBeTruthy();
  const oldMonth = cache.getQueryData(queryKeys.todos('2026-09'));
  const todayMonth = cache.getQueryData(queryKeys.todos('2026-10'));
  const oldOverdue = cache.getQueryData(queryKeys.overdue(today));
  await user.click(screen.getByRole('button', { name: '가져오기' }));
  await waitFor(() => expect(screen.queryByText('지난 미완료 할 일 1개')).toBeNull());
  expect(await screen.findByRole('button', { name: '책 읽기 완료' })).toBeTruthy();
  await act(async () => release());
  expect(await screen.findByText('저장하지 못했어요')).toBeTruthy();
  expect(await screen.findByText('지난 미완료 할 일 1개')).toBeTruthy();
  expect(cache.getQueryData(queryKeys.todos('2026-09'))).toEqual(
    expect.arrayContaining(oldMonth as unknown[]),
  );
  expect(cache.getQueryData(queryKeys.todos('2026-10'))).toEqual(todayMonth);
  expect(cache.getQueryData(queryKeys.overdue(today))).toEqual(oldOverdue);
  await user.click(screen.getByRole('button', { name: '이전 날' }));
  expect(screen.queryByText('지난 미완료 할 일 1개')).toBeNull();
});
it('가져올 항목이 없으면 배너를 숨기고 오늘이 아니면 overdue를 조회하지 않는다', async () => {
  useUIStore.setState({ selectedDate: '2026-10-01' });
  const overdueRequests = vi.fn();
  server.use(
    http.get(`${baseUrl}/rest/v1/todos`, ({ request }) => {
      if (new URL(request.url).searchParams.has('is_done')) overdueRequests();
      return HttpResponse.json([]);
    }),
  );
  const { user } = setup();
  await screen.findByRole('button', { name: '할 일에 할 일 추가' });
  expect(overdueRequests).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '가져오기' })).toBeNull();
  await user.click(screen.getByRole('button', { name: '오늘' }));
  await waitFor(() => expect(overdueRequests).toHaveBeenCalledOnce());
  expect(screen.queryByRole('button', { name: '가져오기' })).toBeNull();
});

it('가져오기 성공 뒤 실행 취소는 원래 날짜와 정렬 키를 복원한다', async () => {
  useUIStore.setState({ today: '2026-10-01', selectedDate: '2026-10-01' });
  let row = { ...todoRow };
  const restore = vi.fn(async ({ request }: { request: Request }) => {
    row = { ...row, ...((await request.json()) as object) };
    return HttpResponse.json(row);
  });
  server.use(
    http.get(`${baseUrl}/rest/v1/todos`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const from = params
        .getAll('date')
        .find((value) => value.startsWith('gte.'))!
        .slice(4);
      const to = params
        .getAll('date')
        .find((value) => value.startsWith('lte.'))!
        .slice(4);
      return HttpResponse.json(row.date >= from && row.date <= to ? [row] : []);
    }),
    http.post(`${baseUrl}/rest/v1/rpc/move_todos`, async ({ request }) => {
      const body = (await request.json()) as { p_date: string; p_moves: { sort_key: string }[] };
      row = { ...row, date: body.p_date, sort_key: body.p_moves[0]!.sort_key };
      return new HttpResponse(null, { status: 204 });
    }),
    http.patch(`${baseUrl}/rest/v1/todos`, restore),
  );
  const { user } = setup();
  await user.click(await screen.findByRole('button', { name: '가져오기' }));
  expect(await screen.findByRole('button', { name: '책 읽기 완료' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '가져오기' })).toBeNull();
  await user.click(await screen.findByRole('button', { name: '실행 취소' }));
  await waitFor(() => expect(restore).toHaveBeenCalledOnce());
  expect(row.date).toBe(todoRow.date);
  expect(row.sort_key).toBe(todoRow.sort_key);
  expect(await screen.findByRole('button', { name: '가져오기' })).toBeTruthy();
});
it('월 탐색과 오늘 복귀 후 하루 목록 이동이 캘린더 월을 따라 바꾼다', async () => {
  const { user, cache } = setup();
  await screen.findByRole('button', { name: '할 일에 할 일 추가' });
  await waitFor(() => expect(cache.getQueryData(queryKeys.todos('2026-08'))).toEqual([]));
  expect(cache.getQueryData(queryKeys.todos('2026-10'))).toEqual([]);
  await user.click(screen.getByRole('button', { name: '다음 달' }));
  expect(screen.getByRole('heading', { name: '2026년 10월' })).toBeTruthy();
  expect(useUIStore.getState().selectedDate).toBe('2026-09-30');
  await user.click(screen.getByRole('button', { name: '오늘' }));
  expect(screen.getByRole('heading', { name: '2026년 9월' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: '다음 날' }));
  expect(screen.getByRole('heading', { name: '2026년 10월' })).toBeTruthy();
});

it.each([
  { timezone: 'America/Vancouver', archivedAt: '2026-10-02T00:30:00Z' },
  { timezone: 'Asia/Seoul', archivedAt: '2026-09-30T16:30:00Z' },
])(
  '보관 목표 날짜 이동은 $timezone 시간대를 전달하고 기존 마지막 항목 뒤에 붙인다',
  async ({ timezone, archivedAt }) => {
    const targetDate = '2026-10-01';
    // 두 보관 시각 모두 프로필에서는 10월 1일이며 UTC에서는 앞뒤 날짜다.
    expect(core.isoDateInZone(archivedAt, timezone)).toBe(targetDate);
    expect(core.isoDateInZone(archivedAt, 'UTC')).not.toBe(targetDate);
    // 계산은 대체하지 않는다. 현재 할 일 전용 경로에서는 시간대 전달도 별도로 관찰한다.
    const buildDay = vi.spyOn(core, 'buildDay');
    const archivedGoal = { ...goalRow, archived_at: archivedAt };
    const targetRows = [
      {
        ...todoRow,
        id: 'last-in-target',
        title: '기존 마지막 항목',
        date: targetDate,
        sort_key: 'a9',
      },
      {
        ...todoRow,
        id: 'first-in-target',
        title: '기존 첫 항목',
        date: targetDate,
        sort_key: 'a2',
      },
      { ...todoRow, id: 'other-goal', goal_id: 'active', date: targetDate, sort_key: 'aZ' },
      { ...todoRow, id: 'other-date', date: '2026-10-02', sort_key: 'aZ' },
    ];
    let moved = { ...todoRow };
    const patches: Record<string, unknown>[] = [];
    server.use(
      http.get(`${baseUrl}/rest/v1/goals`, () =>
        HttpResponse.json([
          archivedGoal,
          { ...goalRow, id: 'active', name: '활성 목표', sort_key: 'a1' },
        ]),
      ),
      http.get(`${baseUrl}/rest/v1/todos`, () => HttpResponse.json([moved, ...targetRows])),
      http.patch(`${baseUrl}/rest/v1/todos`, async ({ request }) => {
        const patch = (await request.json()) as Record<string, unknown>;
        patches.push(patch);
        moved = { ...moved, ...patch };
        return HttpResponse.json(moved);
      }),
    );
    const { user } = setup(1, timezone);
    await user.click(await screen.findByRole('button', { name: '책 읽기 메뉴' }));
    await user.click(screen.getByRole('menuitem', { name: /내일로/ }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(buildDay).toHaveBeenCalledWith(
      expect.objectContaining({ date: targetDate, timeZone: timezone }),
    );
    expect(patches[0]).toEqual({ date: targetDate, sort_key: core.keyBetween('a9', null) });
    await user.click(screen.getByRole('button', { name: '다음 날' }));
    const group = await screen.findByRole('region', { name: '할 일' });
    expect(
      within(group)
        .getAllByRole('button', { name: / 완료$/ })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['기존 첫 항목 완료', '기존 마지막 항목 완료', '책 읽기 완료']);
    expect(within(group).queryByRole('button', { name: '할 일에 할 일 추가' })).toBeNull();
  },
);
