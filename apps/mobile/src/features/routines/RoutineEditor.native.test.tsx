/// <reference types="jest" />
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createRoutine,
  updateRoutine,
  splitRoutine,
  endRoutine,
  softDeleteRoutine,
  listGoals,
  listRoutines,
  listLogsInRange,
  listTodosInRange,
  type NodiiClient,
  type RoutineRecord,
} from '@nodii/api';
import type { Goal, Routine } from '@nodii/core';
import { t } from '@nodii/i18n';
import { ToastProvider } from '../../components/Toast';
import { RoutineEditor } from './RoutineEditor';
import { RoutineStop } from './RoutineStop';
jest.mock('../../../../../packages/api/src/repositories/routines', () => ({
  createRoutine: jest.fn(),
  updateRoutine: jest.fn(),
  splitRoutine: jest.fn(),
  endRoutine: jest.fn(),
  softDeleteRoutine: jest.fn(),
  listRoutines: jest.fn(),
}));
jest.mock('../../../../../packages/api/src/repositories/goals', () => ({ listGoals: jest.fn() }));
jest.mock('../../../../../packages/api/src/repositories/todos', () => ({
  listTodosInRange: jest.fn(),
}));
jest.mock('../../../../../packages/api/src/repositories/routine-logs', () => ({
  listLogsInRange: jest.fn(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-id' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
const client = {} as NodiiClient;
const goal: Goal = { id: 'g', name: '공부', color: '#4F7CFF', sortKey: 'a0', archivedAt: null };
const routine: RoutineRecord = {
  id: 'r',
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
function record(value: Routine): RoutineRecord {
  return { ...value, deletedAt: null, updatedAt: 'server' };
}
let cache: QueryClient;
let onClose: jest.Mock;
beforeAll(() => notifyManager.setNotifyFunction((notify) => act(notify)));
afterAll(() => notifyManager.setNotifyFunction((notify) => notify()));
beforeEach(() => {
  jest.clearAllMocks();
  onClose = jest.fn();
  cache = new QueryClient({
    defaultOptions: {
      queries: { staleTime: Infinity, gcTime: Infinity, retry: false },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  cache.setQueryData(['routines'], [routine]);
  cache.setQueryData(
    ['routineLogs', '2026-10'],
    [{ routineId: 'r', date: '2026-10-11', status: 'done', updatedAt: '' }],
  );
  jest.mocked(createRoutine).mockImplementation(async (_client, value) => record(value));
  jest
    .mocked(updateRoutine)
    .mockImplementation(async (_client, id, value) => ({ ...routine, id, ...value }));
  jest.mocked(splitRoutine).mockImplementation(async (_client, _before, after, today, newId) => ({
    routine: record({ ...after, id: newId, startDate: today }),
  }));
  jest
    .mocked(endRoutine)
    .mockResolvedValue({ routine: { ...routine, endDate: '2026-10-11' }, softDeleted: false });
  jest.mocked(softDeleteRoutine).mockResolvedValue({ ...routine, deletedAt: 'server' });
  jest.mocked(listGoals).mockResolvedValue([recordGoal()]);
  jest.mocked(listTodosInRange).mockResolvedValue([]);
  jest.mocked(listRoutines).mockResolvedValue([routine]);
  jest.mocked(listLogsInRange).mockResolvedValue([]);
});
function recordGoal() {
  return { ...goal, updatedAt: '', deletedAt: null };
}
afterEach(() => {
  cleanup();
  cache.clear();
  jest.restoreAllMocks();
});
function mount(before: RoutineRecord | null = routine) {
  render(
    <QueryClientProvider client={cache}>
      <ToastProvider>
        <RoutineEditor
          client={client}
          routine={before}
          routines={[routine]}
          goals={[goal]}
          date="2026-10-12"
          today="2026-10-12"
          weekStart={0}
          onClose={onClose}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
}
it('요일과 날짜 선택을 모두 지우면 바로 아래 오류가 뜨고 저장할 수 없다', () => {
  mount(null);
  fireEvent.changeText(screen.getByLabelText(t('routine.title')), '운동');
  fireEvent.press(screen.getByRole('radio', { name: t('routine.weekly') }));
  fireEvent.press(screen.getByRole('checkbox', { name: '월요일 고르기' }));
  expect(screen.getByText(t('routine.invalid.weekday_required'))).toBeTruthy();
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  fireEvent.press(screen.getByRole('radio', { name: t('routine.monthly') }));
  fireEvent.press(screen.getByRole('checkbox', { name: '12일 고르기' }));
  expect(screen.getByText(t('routine.invalid.monthday_required'))).toBeTruthy();
  expect(screen.getByText(t('routine.monthEnd'))).toBeTruthy();
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
});
it('클라이언트 UUID·선택 날짜·정규화 제목으로 새 규칙만 생성한다', async () => {
  mount(null);
  fireEvent.changeText(screen.getByLabelText(t('routine.title')), ' 운동 ');
  fireEvent.press(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(createRoutine).toHaveBeenCalledWith(
    client,
    expect.objectContaining({
      id: 'new-id',
      title: '운동',
      startDate: '2026-10-12',
      freq: 'daily',
      byWeekday: null,
      byMonthday: null,
    }),
  );
  expect(splitRoutine).not.toHaveBeenCalled();
});
it('제목만 바꾼 저장은 범위를 묻지 않고 직접 업데이트한다', async () => {
  mount();
  fireEvent.changeText(screen.getByLabelText(t('routine.title')), '단어');
  fireEvent.press(screen.getByRole('button', { name: '저장' }));
  await waitFor(() =>
    expect(updateRoutine).toHaveBeenCalledWith(
      client,
      'r',
      expect.objectContaining({ title: '단어' }),
    ),
  );
  expect(screen.queryByTestId('routine-scope-sheet')).toBeNull();
  expect(splitRoutine).not.toHaveBeenCalled();
});
it('과거 규칙 변경은 14칸 두 미리보기와 오늘부터 기본 선택 후 기존 RPC를 쓴다', async () => {
  mount();
  fireEvent.press(screen.getByRole('radio', { name: '매주' }));
  fireEvent.press(screen.getByRole('button', { name: '저장' }));
  expect(screen.getByTestId('routine-scope-sheet')).toBeTruthy();
  expect(screen.getAllByLabelText(/10월 \d+일, /)).toHaveLength(28);
  expect(screen.getByRole('radio', { name: '오늘부터' }).props.accessibilityState.selected).toBe(
    true,
  );
  fireEvent.press(screen.getByRole('button', { name: '오늘부터 적용' }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(splitRoutine).toHaveBeenCalledWith(
    client,
    routine,
    expect.objectContaining({ freq: 'weekly', byWeekday: [2] }),
    '2026-10-12',
    'new-id',
  );
  expect(updateRoutine).not.toHaveBeenCalled();
});
it('과거 날짜까지 모두는 같은 행을 바꾸며 과거 로그를 삭제하지 않는다', async () => {
  mount();
  fireEvent.press(screen.getByRole('radio', { name: '매주' }));
  fireEvent.press(screen.getByRole('button', { name: '저장' }));
  fireEvent.press(screen.getByRole('radio', { name: '과거 날짜까지 모두' }));
  fireEvent.press(screen.getByRole('button', { name: '모두 적용' }));
  await waitFor(() => expect(updateRoutine).toHaveBeenCalled());
  expect(splitRoutine).not.toHaveBeenCalled();
  expect(cache.getQueryData(['routineLogs', '2026-10'])).toEqual([
    expect.objectContaining({ date: '2026-10-11', status: 'done' }),
  ]);
});
it('오늘 시작한 루틴은 규칙이 바뀌어도 범위를 묻지 않는다', async () => {
  mount({ ...routine, startDate: '2026-10-12' });
  fireEvent.press(screen.getByRole('radio', { name: '매주' }));
  fireEvent.press(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(updateRoutine).toHaveBeenCalled());
  expect(screen.queryByTestId('routine-scope-sheet')).toBeNull();
});
it('종료일 없음에서 날짜 시트의 오늘을 고르면 오늘 종료일이 실제로 채워진다', async () => {
  mount();
  fireEvent.press(screen.getByRole('button', { name: '종료일' }));
  expect(screen.getByTestId('date-pick-sheet')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: '오늘' }));
  fireEvent.press(screen.getByRole('button', { name: '저장' }));
  await waitFor(() =>
    expect(updateRoutine).toHaveBeenCalledWith(
      client,
      'r',
      expect.objectContaining({ endDate: '2026-10-12' }),
    ),
  );
});
it('분할 실패는 두 규칙 캐시를 롤백하고 시트와 초안을 유지한다', async () => {
  jest.mocked(splitRoutine).mockRejectedValueOnce(new Error('failed'));
  mount();
  fireEvent.press(screen.getByRole('radio', { name: '매주' }));
  fireEvent.press(screen.getByRole('button', { name: '저장' }));
  fireEvent.press(screen.getByRole('button', { name: '오늘부터 적용' }));
  await screen.findByText(t('todo.save.failed'));
  expect(cache.getQueryData(['routines'])).toEqual([routine]);
  expect(screen.getByTestId('routine-scope-sheet')).toBeTruthy();
  expect(onClose).not.toHaveBeenCalled();
});
it('분할 후 종료일만 실패하면 재분할 없이 새 행의 종료일만 다시 저장한다', async () => {
  const next = record({
    ...routine,
    id: 'new-id',
    freq: 'weekly',
    byWeekday: [1],
    startDate: '2026-10-12',
  });
  jest
    .mocked(splitRoutine)
    .mockResolvedValueOnce({ routine: next, endDateError: new Error('end failed') });
  mount();
  fireEvent.press(screen.getByRole('button', { name: '종료일' }));
  fireEvent.press(screen.getByRole('button', { name: '내일' }));
  fireEvent.press(screen.getByRole('radio', { name: '매주' }));
  fireEvent.press(screen.getByRole('button', { name: '저장' }));
  fireEvent.press(screen.getByRole('button', { name: '오늘부터 적용' }));
  await screen.findByTestId('routine-partial-sheet');
  fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() =>
    expect(updateRoutine).toHaveBeenCalledWith(
      client,
      'new-id',
      expect.objectContaining({ endDate: '2026-10-13' }),
    ),
  );
  expect(splitRoutine).toHaveBeenCalledTimes(1);
});
it.each(['end', 'delete'])(
  '그만두기 %s 선택은 결과 설명 후 기존 훅으로 쓰며 실행 취소가 없다',
  async (action) => {
    render(
      <QueryClientProvider client={cache}>
        <ToastProvider>
          <RoutineStop client={client} routine={routine} today="2026-10-12" onClose={onClose} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText(t('routine.endDescription'))).toBeTruthy();
    expect(screen.getByText(t('routine.deleteDescription'))).toBeTruthy();
    fireEvent.press(
      screen.getByRole('button', {
        name: t(action === 'end' ? 'routine.endToday' : 'routine.delete'),
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    if (action === 'end') expect(endRoutine).toHaveBeenCalledWith(client, 'r', '2026-10-12');
    else expect(softDeleteRoutine).toHaveBeenCalledWith(client, 'r');
    expect(screen.queryByRole('button', { name: t('todo.undo') })).toBeNull();
    expect(cache.getQueryData(['routineLogs', '2026-10'])).toEqual([
      expect.objectContaining({ date: '2026-10-11' }),
    ]);
  },
);
