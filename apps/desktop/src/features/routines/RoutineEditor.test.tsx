// 이 파일의 날짜별 UI fixture를 유지하고 실제 자정은 today.test.ts에서 검증한다.
vi.mock('../../lib/today', () => ({ useTodayClock: vi.fn() }));
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { toast, Toaster } from 'sonner';
import {
  mapGoal,
  mapRoutine,
  queryKeys,
  useSetRoutineLog,
  useSplitRoutine,
  useUpdateRoutine,
  useEndRoutine,
  useDeleteRoutine,
  useRoutineWritePending,
  type NodiiClient,
  type RoutineRecord,
  type RoutineLogRecord,
} from '@nodii/api';
import { RoutineEditor } from './RoutineEditor';
import { RoutineRow } from './RoutineRow';
import { RoutineStopDialog } from './RoutineStopDialog';
import { MainLayout } from '../../app/MainLayout';
import { baseUrl, createTestClient, sessionResponse } from '../../test/auth-fixtures';
import { goalRow } from '../../test/data-fixtures';
import { server } from '../../test/server';
import { useUIStore } from '../../stores/ui';

const row = {
  id: '44444444-4444-4444-8444-444444444444',
  user_id: goalRow.user_id,
  goal_id: goalRow.id,
  title: '운동',
  freq: 'weekly' as const,
  repeat_every: 1,
  by_weekday: [1, 3, 5],
  by_monthday: null,
  start_date: '2026-09-01',
  end_date: null,
  sort_key: 'a1',
  deleted_at: null,
  created_at: '',
  updated_at: 'server-time',
};
const routine = mapRoutine(row);
const profile = { id: goalRow.user_id, displayName: null, timezone: 'UTC', weekStart: 0 as const };
const clients: NodiiClient[] = [];
const caches: QueryClient[] = [];
beforeEach(() => useUIStore.setState({ today: '2026-09-18', selectedDate: '2026-09-18' }));
afterEach(async () => {
  toast.dismiss();
  caches.splice(0).forEach((c) => c.clear());
  await Promise.all(clients.splice(0).map((c) => c.auth.dispose()));
  vi.restoreAllMocks();
});
function setup() {
  const client = createTestClient();
  clients.push(client);
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
  });
  caches.push(cache);
  cache.setQueryData(queryKeys.goals(), [mapGoal(goalRow)]);
  cache.setQueryData(queryKeys.routines(), [routine]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cache}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
  return { client, cache, wrapper };
}
function editor(existing?: RoutineRecord) {
  const context = setup();
  const onClose = vi.fn();
  render(
    <RoutineEditor
      client={context.client}
      profile={profile}
      routine={existing}
      onClose={onClose}
    />,
    { wrapper: context.wrapper },
  );
  return { ...context, onClose, user: userEvent.setup() };
}
it('매주를 고르면 요일 필수 오류와 저장 비활성을 표시한다', async () => {
  const { user } = editor();
  await user.type(screen.getByLabelText('제목'), '운동');
  await user.click(screen.getByRole('radio', { name: '매주' }));
  expect(screen.getByRole('alert').textContent).toContain('요일을 하나 이상');
  expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole('button', { name: '월요일' }));
  expect(screen.queryByRole('alert')).toBeNull();
  expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(false);
});
it('매월 31일의 다음 5회는 9월·11월·2월 말일을 표시한다', async () => {
  const { user } = editor();
  await user.click(screen.getByRole('radio', { name: '매월' }));
  await user.click(screen.getByRole('button', { name: '31일' }));
  let preview = screen.getByRole('region', { name: '다음 5회 미리보기' });
  expect(preview.textContent).toContain('9월 30일');
  expect(preview.textContent).toContain('11월 30일');
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2027-02-01' } });
  preview = screen.getByRole('region', { name: '다음 5회 미리보기' });
  expect(preview.textContent).toContain('2월 28일');
  expect(screen.getByText('없는 달은 말일에 표시돼요.')).toBeTruthy();
});
it('제목만 수정하면 범위 창 없이 같은 행을 UPDATE한다', async () => {
  const patch = vi.fn();
  server.use(
    http.patch(`${baseUrl}/rest/v1/routines`, async ({ request }) => {
      patch(await request.json());
      return HttpResponse.json({ ...row, title: '산책' });
    }),
  );
  const { user, onClose } = editor(routine);
  await user.clear(screen.getByLabelText('제목'));
  await user.type(screen.getByLabelText('제목'), '산책');
  await user.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() =>
    expect(patch).toHaveBeenCalledWith(expect.objectContaining({ title: '산책' })),
  );
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(onClose).toHaveBeenCalled();
});
it('과거 루틴의 요일 변경은 범위 창을 열고 오늘부터를 고르면 클라이언트 UUID로 split한다', async () => {
  const split = vi.fn();
  server.use(
    http.post(`${baseUrl}/rest/v1/rpc/split_routine`, async ({ request }) => {
      const body = (await request.json()) as { p_new_id: string };
      split(body);
      return HttpResponse.json(body.p_new_id);
    }),
  );
  const { user, onClose } = editor(routine);
  await user.click(screen.getByRole('button', { name: '토요일' }));
  await user.click(screen.getByRole('button', { name: '저장' }));
  expect(screen.getByRole('alertdialog').textContent).toContain('어디부터 적용할까요?');
  expect(document.activeElement?.textContent).toBe('취소');
  expect(screen.getAllByLabelText(/2주 미리보기/)).toHaveLength(2);
  await user.click(screen.getByRole('button', { name: '오늘부터' }));
  await waitFor(() =>
    expect(split).toHaveBeenCalledWith(
      expect.objectContaining({
        p_new_id: expect.stringMatching(/^[a-f\d-]{36}$/),
        p_from: '2026-09-18',
        p_by_weekday: [1, 3, 5, 6],
        p_by_monthday: null,
      }),
    ),
  );
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});
it('시작일이 오늘이면 규칙 변경도 범위 창 없이 UPDATE한다', async () => {
  const patch = vi.fn();
  server.use(
    http.patch(`${baseUrl}/rest/v1/routines`, async ({ request }) => {
      patch(await request.json());
      return HttpResponse.json(row);
    }),
  );
  const { user } = editor({ ...routine, startDate: '2026-09-18' });
  await user.click(screen.getByRole('button', { name: '토요일' }));
  await user.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(patch).toHaveBeenCalled());
  expect(screen.queryByRole('alertdialog')).toBeNull();
});
it('모두 적용은 기존 로그를 보존하며 실패하면 초안과 오류 재시도를 남긴다', async () => {
  const patch = vi.fn();
  server.use(
    http.patch(`${baseUrl}/rest/v1/routines`, async ({ request }) => {
      patch(await request.json());
      return HttpResponse.json({ message: 'denied' }, { status: 403 });
    }),
  );
  const { user, cache, onClose } = editor(routine);
  const log = { routineId: routine.id, date: '2026-09-16', status: 'done', updatedAt: '' };
  cache.setQueryData(queryKeys.routineLogs('2026-09'), [log]);
  await user.click(screen.getByRole('button', { name: '토요일' }));
  await user.click(screen.getByRole('button', { name: '저장' }));
  await user.click(screen.getByRole('button', { name: '과거 날짜까지 모두' }));
  await screen.findByText('저장하지 못했어요');
  expect(patch).toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(cache.getQueryData(queryKeys.routineLogs('2026-09'))).toEqual([log]);
  expect(cache.getQueryData(queryKeys.routines())).toEqual([routine]);
});
it('로그 upsert·취소는 겹친 모든 월에 즉시 반영하고 실패하면 복합 키만 복원한다', async () => {
  const { client, cache, wrapper } = setup();
  const error = vi.fn();
  const keys = ['2026-09', '2026-10'].map(queryKeys.routineLogs);
  const other: RoutineLogRecord = {
    routineId: 'other',
    date: '2026-10-01',
    status: 'done',
    updatedAt: '',
  };
  keys.forEach((key) => cache.setQueryData(key, [other]));
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  server.use(
    http.post(`${baseUrl}/rest/v1/routine_logs`, async () => {
      await gate;
      return HttpResponse.json({
        routine_id: routine.id,
        date: '2026-10-01',
        status: 'done',
        updated_at: 'saved',
      });
    }),
  );
  const hook = renderHook(
    () => useSetRoutineLog(client, 0, routine.id, '2026-10-01', { onError: error }),
    { wrapper },
  );
  act(() =>
    hook.result.current.mutate({ routineId: routine.id, date: '2026-10-01', status: 'done' }),
  );
  await waitFor(() => {
    for (const key of keys)
      expect(cache.getQueryData(key)).toEqual([
        other,
        { routineId: routine.id, date: '2026-10-01', status: 'done', updatedAt: '' },
      ]);
  });
  await act(async () => {
    finish();
  });
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  let fail!: () => void;
  const failed = new Promise<void>((resolve) => {
    fail = resolve;
  });
  server.use(
    http.delete(`${baseUrl}/rest/v1/routine_logs`, async () => {
      await failed;
      return HttpResponse.json({ message: 'denied' }, { status: 403 });
    }),
  );
  act(() =>
    hook.result.current.mutate({ routineId: routine.id, date: '2026-10-01', status: null }),
  );
  await waitFor(() => {
    for (const key of keys) expect(cache.getQueryData(key)).toEqual([other]);
  });
  await act(async () => {
    fail();
  });
  await waitFor(() => expect(error).toHaveBeenCalled());
  for (const key of keys)
    expect(cache.getQueryData(key)).toEqual([
      other,
      { routineId: routine.id, date: '2026-10-01', status: 'done', updatedAt: 'saved' },
    ]);
});
it('분할 RPC 실패는 규칙 두 행과 로그를 롤백한다', async () => {
  const { client, cache, wrapper } = setup();
  const error = vi.fn();
  const log = { routineId: routine.id, date: '2026-10-01', status: 'done', updatedAt: '' };
  for (const month of ['2026-09', '2026-10'])
    cache.setQueryData(queryKeys.routineLogs(month), [log]);
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  server.use(
    http.post(`${baseUrl}/rest/v1/rpc/split_routine`, async () => {
      await gate;
      return HttpResponse.json({ message: 'denied' }, { status: 403 });
    }),
  );
  const hook = renderHook(() => useSplitRoutine(client, 'new-id', { onError: error }), { wrapper });
  render(
    <RoutineEditor
      client={client}
      profile={profile}
      routine={{ ...routine, id: 'other-routine' }}
      onClose={() => {}}
    />,
    { wrapper },
  );

  act(() =>
    hook.result.current.mutate({
      before: routine,
      after: { ...routine, byWeekday: [4] },
      today: '2026-10-01',
    }),
  );
  await waitFor(() =>
    expect(cache.getQueryData(queryKeys.routines())).toEqual([
      { ...routine, endDate: '2026-09-30' },
      { ...routine, id: 'new-id', startDate: '2026-10-01', byWeekday: [4], updatedAt: '' },
    ]),
  );
  expect(cache.isMutating({ mutationKey: ['write', 'routine'], exact: true })).toBe(1);
  await waitFor(() =>
    expect((screen.getByLabelText('제목') as HTMLInputElement).disabled).toBe(true),
  );
  await act(async () => {
    finish();
  });
  await waitFor(() => expect(error).toHaveBeenCalled());
  expect(cache.getQueryData(queryKeys.routines())).toEqual([routine]);
  await waitFor(() =>
    expect((screen.getByLabelText('제목') as HTMLInputElement).disabled).toBe(false),
  );
  for (const month of ['2026-09', '2026-10'])
    expect(cache.getQueryData(queryKeys.routineLogs(month))).toEqual([log]);
});
it('분할 후 종료일 실패 재시도는 두 번째 split 없이 새 행의 종료일만 저장한다', async () => {
  const { client, cache, wrapper } = setup();
  const error = vi.fn();
  const split = vi.fn();
  const patch = vi.fn();
  server.use(
    http.post(`${baseUrl}/rest/v1/rpc/split_routine`, async () => {
      split();
      return HttpResponse.json('new-id');
    }),
    http.patch(`${baseUrl}/rest/v1/routines`, async ({ request }) => {
      patch(await request.json());
      if (patch.mock.calls.length === 1)
        return HttpResponse.json({ message: 'denied' }, { status: 403 });
      return HttpResponse.json({
        ...row,
        id: 'new-id',
        start_date: '2026-09-18',
        end_date: '2026-11-01',
      });
    }),
  );
  const hook = renderHook(() => useSplitRoutine(client, 'new-id', { onError: error }), { wrapper });
  act(() =>
    hook.result.current.mutate({
      before: routine,
      after: { ...routine, byWeekday: [4], endDate: '2026-11-01' },
      today: '2026-09-18',
    }),
  );
  await waitFor(() => expect(error).toHaveBeenCalled());
  expect(
    cache.getQueryData<RoutineRecord[]>(queryKeys.routines())?.find((r) => r.id === 'new-id')
      ?.endDate,
  ).toBeNull();
  act(() => {
    (error.mock.calls[0]![1] as () => void)();
  });
  await waitFor(() => expect(patch).toHaveBeenCalledTimes(2));
  expect(split).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(
      cache.getQueryData<RoutineRecord[]>(queryKeys.routines())?.find((r) => r.id === 'new-id')
        ?.endDate,
    ).toBe('2026-11-01'),
  );
});
it('완료·건너뛰기·실행 취소가 하루 목록과 달력 집계에 함께 반영된다', async () => {
  const { client, cache, wrapper } = setup();
  server.use(
    http.get(`${baseUrl}/rest/v1/routines`, () => HttpResponse.json([row])),
    http.post(`${baseUrl}/rest/v1/routine_logs`, async ({ request }) =>
      HttpResponse.json({ ...((await request.json()) as object), updated_at: 'saved' }),
    ),
    http.delete(`${baseUrl}/rest/v1/routine_logs`, () => new HttpResponse(null, { status: 204 })),
  );
  render(
    <MainLayout
      client={client}
      profile={profile}
      session={{ ...sessionResponse, token_type: 'bearer' }}
    />,
    { wrapper },
  );
  const user = userEvent.setup();
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '운동 완료' }) as HTMLButtonElement).disabled).toBe(
      false,
    ),
  );
  await user.click(screen.getByRole('button', { name: '운동 완료' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '운동 완료' }).getAttribute('aria-pressed')).toBe(
      'true',
    ),
  );
  await user.click(screen.getByRole('button', { name: '운동 메뉴' }));
  await user.click(screen.getByRole('menuitem', { name: '이날은 건너뛰기' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '운동 완료' })).toBeNull());
  // jsdom의 제거된 메뉴 포커스는 Document로 이동하므로 클릭 이벤트만 보낸다.
  fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '운동 완료' }).getAttribute('aria-pressed')).toBe(
      'false',
    ),
  );
  expect(cache.getQueryData(queryKeys.routineLogs('2026-09'))).toEqual([]);
  expect(within(screen.getByRole('main')).getByText('오늘, 1개 중 0개 끝냄')).toBeTruthy();
});
it('오늘 시작 루틴 종료는 소프트 삭제하고 실행 취소가 원래 상태를 복원한다', async () => {
  const current = { ...routine, startDate: '2026-09-18' };
  const { client, cache, wrapper } = setup();
  cache.setQueryData(queryKeys.routines(), [current]);
  const patch = vi.fn();
  server.use(
    http.get(`${baseUrl}/rest/v1/routines`, () =>
      HttpResponse.json({ ...row, start_date: current.startDate }),
    ),
    http.patch(`${baseUrl}/rest/v1/routines`, async ({ request }) => {
      const body = (await request.json()) as object;
      patch(body);
      return HttpResponse.json({ ...row, start_date: current.startDate, ...body });
    }),
  );
  const close = vi.fn();
  render(<RoutineStopDialog routine={current} client={client} onClose={close} />, { wrapper });
  expect(document.activeElement?.textContent).toBe('취소');
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '오늘부터 그만하기' }));
  await waitFor(() => expect(patch).toHaveBeenCalledWith({ deleted_at: expect.any(String) }));
  expect(cache.getQueryData(queryKeys.routines())).toEqual([]);
  // jsdom의 제거된 메뉴 포커스는 Document로 이동하므로 클릭 이벤트만 보낸다.
  fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));
  await waitFor(() => expect(patch).toHaveBeenLastCalledWith({ deleted_at: null, end_date: null }));
  await waitFor(() =>
    expect(cache.getQueryData<RoutineRecord[]>(queryKeys.routines())?.[0]?.deletedAt).toBeNull(),
  );
});

it('반복 종류는 방향키로 선택하고 탭 진입점은 하나만 유지한다', async () => {
  const { user } = editor();
  const daily = screen.getByRole('radio', { name: '매일' });
  daily.focus();
  await user.keyboard('{ArrowRight}');
  const weekly = screen.getByRole('radio', { name: '매주' });
  expect(document.activeElement).toBe(weekly);
  expect(weekly.getAttribute('aria-checked')).toBe('true');
  expect(daily.tabIndex).toBe(-1);
  await user.keyboard('{ArrowLeft}{ArrowLeft}');
  expect(screen.getByRole('radio', { name: '매월' }).getAttribute('aria-checked')).toBe('true');
  expect(screen.getAllByRole('radio').filter((radio) => radio.tabIndex === 0)).toHaveLength(1);
});
it('과거에 끝난 루틴의 종료 확인은 기간 연장을 허용하지 않는다', () => {
  const { client, wrapper } = setup();
  render(
    <RoutineStopDialog
      client={client}
      routine={{ ...routine, endDate: '2026-09-10' }}
      onClose={() => {}}
    />,
    { wrapper },
  );
  expect(
    (screen.getByRole('button', { name: '오늘부터 그만하기' }) as HTMLButtonElement).disabled,
  ).toBe(true);
});

it('서로 다른 루틴은 연달아 체크할 수 있고 첫 요청 실패가 두 번째 완료를 되돌리지 않는다', async () => {
  const { client, cache, wrapper } = setup();
  const second = {
    ...routine,
    id: '55555555-5555-4555-8555-555555555555',
    title: '독서',
    sortKey: 'a2',
  };
  cache.setQueryData(queryKeys.routines(), [routine, second]);
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const requests = vi.fn();
  server.use(
    http.post(`${baseUrl}/rest/v1/routine_logs`, async ({ request }) => {
      const body = (await request.json()) as { routine_id: string; date: string; status: string };
      requests(body.routine_id);
      if (body.routine_id === routine.id) {
        await gate;
        return HttpResponse.json({ message: 'denied' }, { status: 403 });
      }
      return HttpResponse.json({ ...body, updated_at: 'saved' });
    }),
  );
  render(
    <MainLayout
      client={client}
      profile={profile}
      session={{ ...sessionResponse, token_type: 'bearer' }}
    />,
    { wrapper },
  );
  const firstCheck = () => screen.getByRole('button', { name: '운동 완료' }) as HTMLButtonElement;
  const secondCheck = () => screen.getByRole('button', { name: '독서 완료' }) as HTMLButtonElement;
  const user = userEvent.setup();
  try {
    await waitFor(() => expect(firstCheck().disabled).toBe(false));
    await user.click(firstCheck());
    await waitFor(() => expect(requests).toHaveBeenCalledWith(routine.id));
    expect(firstCheck().disabled).toBe(true);
    expect(secondCheck().disabled).toBe(false);
    expect(
      cache.isMutating({
        mutationKey: ['write', 'routineLog', routine.id, '2026-09-18'],
        exact: true,
      }),
    ).toBe(1);
    await user.click(secondCheck());
    await waitFor(() => expect(requests).toHaveBeenCalledWith(second.id));
    await waitFor(() => expect(secondCheck().disabled).toBe(false));
    expect(secondCheck().getAttribute('aria-pressed')).toBe('true');
    expect(firstCheck().disabled).toBe(true);
  } finally {
    await act(async () => {
      finish();
    });
  }
  await waitFor(() => expect(firstCheck().disabled).toBe(false));
  expect(firstCheck().getAttribute('aria-pressed')).toBe('false');
  expect(cache.getQueryData(queryKeys.routineLogs('2026-09'))).toEqual([
    { routineId: second.id, date: '2026-09-18', status: 'done', updatedAt: 'saved' },
  ]);
});

it.each(['update', 'end', 'delete'] as const)(
  '%s는 해당 루틴만 잠그고 분할 공유 키를 사용하지 않는다',
  async (operation) => {
    const { client, cache, wrapper } = setup();
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    server.use(
      http.get(`${baseUrl}/rest/v1/routines`, () => HttpResponse.json(row)),
      http.patch(`${baseUrl}/rest/v1/routines`, async ({ request }) => {
        const body = (await request.json()) as object;
        await gate;
        return HttpResponse.json({ ...row, ...body });
      }),
    );
    const { result } = renderHook(
      () => ({
        update: useUpdateRoutine(client, routine.id, { onError: vi.fn() }),
        end: useEndRoutine(client, routine.id, { onError: vi.fn() }),
        delete: useDeleteRoutine(client, routine.id, { onError: vi.fn() }),
        ownBusy: useRoutineWritePending(routine.id),
        otherBusy: useRoutineWritePending('other'),
      }),
      { wrapper },
    );
    try {
      act(() => {
        if (operation === 'update')
          result.current.update.mutate({
            before: routine,
            after: { ...routine, title: '바꾼 제목' },
          });
        else if (operation === 'end') result.current.end.mutate({ routine, today: '2026-09-18' });
        else result.current.delete.mutate({ routine });
      });
      await waitFor(() => expect(result.current.ownBusy).toBe(true));
      expect(result.current.otherBusy).toBe(false);
      expect(cache.isMutating({ mutationKey: ['write', 'routine', routine.id], exact: true })).toBe(
        1,
      );
      expect(cache.isMutating({ mutationKey: ['write', 'routine'], exact: true })).toBe(0);
    } finally {
      await act(async () => {
        finish();
      });
    }
    await waitFor(() => expect(result.current[operation].isSuccess).toBe(true));
  },
);
it('같은 루틴의 다른 날짜 로그는 독립적으로 체크할 수 있다', async () => {
  const { client, cache, wrapper } = setup();
  cache.setQueryData(queryKeys.routineLogs('2026-09'), []);
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  server.use(
    http.post(`${baseUrl}/rest/v1/routine_logs`, async ({ request }) => {
      const body = (await request.json()) as object;
      await gate;
      return HttpResponse.json({ ...body, updated_at: 'saved' });
    }),
  );
  render(
    <>
      <RoutineRow
        client={client}
        routine={routine}
        date="2026-09-18"
        log={null}
        weekStart={0}
        onEdit={() => {}}
        onStop={() => {}}
      />
      <RoutineRow
        client={client}
        routine={{ ...routine, title: '다른 날짜 운동' }}
        date="2026-09-16"
        log={null}
        weekStart={0}
        onEdit={() => {}}
        onStop={() => {}}
      />
    </>,
    { wrapper },
  );
  const user = userEvent.setup();
  try {
    await user.click(screen.getByRole('button', { name: '운동 완료' }));
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: '운동 완료' }) as HTMLButtonElement).disabled,
      ).toBe(true),
    );
    expect(
      (screen.getByRole('button', { name: '다른 날짜 운동 완료' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    await user.click(screen.getByRole('button', { name: '다른 날짜 운동 완료' }));
    await waitFor(() =>
      expect(cache.isMutating({ mutationKey: ['write', 'routineLog', routine.id] })).toBe(2),
    );
    expect(
      cache.isMutating({
        mutationKey: ['write', 'routineLog', routine.id, '2026-09-16'],
        exact: true,
      }),
    ).toBe(1);
    expect(
      cache.isMutating({
        mutationKey: ['write', 'routineLog', routine.id, '2026-09-18'],
        exact: true,
      }),
    ).toBe(1);
  } finally {
    await act(async () => {
      finish();
    });
  }
  await waitFor(() => expect(cache.isMutating()).toBe(0));
});
