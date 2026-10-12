/// <reference types="jest" />
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  upsertLog,
  deleteLog,
  type NodiiClient,
  type RoutineRecord,
  type RoutineLogRecord,
} from '@nodii/api';
import type { Goal } from '@nodii/core';
import { t } from '@nodii/i18n';
import { ToastProvider } from '../../components/Toast';
import { RoutineRow } from './RoutineRow';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
jest.mock('../../../../../packages/api/src/repositories/routine-logs', () => ({
  upsertLog: jest.fn(),
  deleteLog: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
const client = {} as NodiiClient;
const goal: Goal = { id: 'g', name: '공부', color: '#4F7CFF', sortKey: 'a0', archivedAt: null };
const routine: RoutineRecord = {
  id: 'r1',
  goalId: 'g',
  title: '영어',
  freq: 'daily',
  repeatEvery: 1,
  byWeekday: null,
  byMonthday: null,
  startDate: '2026-09-01',
  endDate: null,
  sortKey: 'a0',
  deletedAt: null,
  updatedAt: '',
};
let cache: QueryClient;
beforeAll(() => notifyManager.setNotifyFunction((notify) => act(notify)));
afterAll(() => notifyManager.setNotifyFunction((notify) => notify()));
beforeEach(() => {
  jest.clearAllMocks();
  cache = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  cache.setQueryData(['routines'], [routine, { ...routine, id: 'r2' }]);
  cache.setQueryData(['routineLogs', '2026-09'], []);
  cache.setQueryData(['routineLogs', '2026-10'], []);
  jest.mocked(upsertLog).mockImplementation(async (_client, routineId, date, status) => ({
    routineId,
    date,
    status,
    updatedAt: 'server',
  }));
  jest.mocked(deleteLog).mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  cache.clear();
  jest.restoreAllMocks();
});
function Rows() {
  const { data = [] } = useQuery<RoutineLogRecord[]>({
    queryKey: ['routineLogs', '2026-10'],
    queryFn: async () => [],
    staleTime: Infinity,
  });
  return (
    <View>
      {[routine, { ...routine, id: 'r2', title: '수학' }].map((row) => {
        const log = data.find((log) => log.routineId === row.id) ?? null;
        return log?.status === 'skipped' ? null : (
          <RoutineRow
            key={row.id}
            routine={row}
            log={log}
            goal={goal}
            date="2026-10-01"
            client={client}
            weekStart={0}
            onEdit={() => {}}
            onStop={() => {}}
          />
        );
      })}
    </View>
  );
}
function mount() {
  render(
    <QueryClientProvider client={cache}>
      <ToastProvider>
        <Rows />
      </ToastProvider>
    </QueryClientProvider>,
  );
}
it('하나의 루틴만 잠그고 겹치는 월 모두 낙관적으로 반영한 뒤 실패를 롤백한다', async () => {
  let reject: (error: Error) => void = () => {};
  jest.mocked(upsertLog).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  mount();
  fireEvent.press(screen.getByRole('checkbox', { name: '영어 완료하기' }));
  await waitFor(() =>
    expect(
      screen.getByRole('checkbox', { name: '영어 완료 취소하기' }).props.accessibilityState,
    ).toMatchObject({
      checked: true,
      disabled: true,
    }),
  );
  expect(
    screen.getByRole('checkbox', { name: '수학 완료하기' }).props.accessibilityState,
  ).toMatchObject({
    disabled: false,
  });
  expect(cache.getQueryData(['routineLogs', '2026-09'])).toEqual([
    expect.objectContaining({ routineId: 'r1', status: 'done' }),
  ]);
  await act(async () => reject(new Error('failed')));
  await screen.findByText(t('todo.save.failed'));
  expect(
    screen.getByRole('checkbox', { name: '영어 완료하기' }).props.accessibilityState,
  ).toMatchObject({
    checked: false,
    disabled: false,
  });
  expect(cache.getQueryData(['routineLogs', '2026-09'])).toEqual([]);
});
it('건너뛰기로 사라진 줄도 토스트에서 실행 취소하고 완료 기록을 복원한다', async () => {
  for (const month of ['2026-09', '2026-10'])
    cache.setQueryData(
      ['routineLogs', month],
      [{ routineId: 'r1', date: '2026-10-01', status: 'done', updatedAt: '' }],
    );
  mount();
  fireEvent.press(screen.getByTestId('routine-menu-r1'));
  fireEvent.press(await screen.findByRole('button', { name: t('routine.skip') }));
  await screen.findByText("'영어'를 오늘은 건너뛰었어요");
  expect(screen.queryByTestId('routine-menu-r1')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: t('todo.undo') }));
  await screen.findByRole('checkbox', { name: '영어 완료 취소하기' });
  expect(upsertLog).toHaveBeenLastCalledWith(client, 'r1', '2026-10-01', 'done');
});
it('완료 취소는 날짜 하나의 로그 삭제 경로를 쓴다', async () => {
  mount();
  fireEvent.press(screen.getByRole('checkbox', { name: '영어 완료하기' }));
  await screen.findByText("'영어'를 완료했어요");
  fireEvent.press(screen.getByRole('checkbox', { name: '영어 완료 취소하기' }));
  await waitFor(() => expect(deleteLog).toHaveBeenCalledWith(client, 'r1', '2026-10-01'));
});
