/// <reference types="jest" />
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GUIDE_KEY } from './onboarding/FirstRunGuide';
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  type KeyboardEvent,
} from 'react-native';
import {
  notifyManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  fetchProfile,
  listGoals,
  listRoutines,
  listLogsInRange,
  upsertLog,
  deleteLog,
  type RoutineRecord,
  listTodosInRange,
  listOverdue,
  moveTodos,
  softDeleteTodos,
  restoreTodos,
  createTodo,
  updateTodo,
  softDeleteTodo,
  moveTodo,
  queryKeys,
  type NodiiClient,
  type TodoRecord,
  type GoalRecord,
} from '@nodii/api';
import { type Todo } from '@nodii/core';
import { t } from '@nodii/i18n';
import { ToastProvider } from '../components/Toast';
import { SwipeableRow } from '../components/gestures/SwipeableRow';
import { useUIStore } from '../stores/ui';
import { Today } from './Today';
import { useDayActions } from './today/useDayActions';

jest.mock('../../../../packages/api/src/profile', () => ({ fetchProfile: jest.fn() }));
jest.mock('../../../../packages/api/src/repositories/goals', () => ({ listGoals: jest.fn() }));
jest.mock('../../../../packages/api/src/repositories/todos', () => ({
  listTodosInRange: jest.fn(),
  listOverdue: jest.fn(),
  moveTodos: jest.fn(),
  softDeleteTodos: jest.fn(),
  restoreTodos: jest.fn(),
  createTodo: jest.fn(),
  updateTodo: jest.fn(),
  softDeleteTodo: jest.fn(),
  moveTodo: jest.fn(),
}));
jest.mock('../../../../packages/api/src/repositories/routines', () => ({
  listRoutines: jest.fn(),
}));
jest.mock('../../../../packages/api/src/repositories/routine-logs', () => ({
  listLogsInRange: jest.fn(),
  upsertLog: jest.fn(),
  deleteLog: jest.fn(),
}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => `uuid-${Math.random()}`) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
const client = {} as NodiiClient;
const goal: GoalRecord = {
  id: 'goal',
  name: '공부',
  color: '#4F7CFF',
  sortKey: 'a0',
  archivedAt: null,
  deletedAt: null,
  updatedAt: '',
};
function record(todo: Todo): TodoRecord {
  return {
    ...todo,
    deletedAt: null,
    updatedAt: '2026-10-10T12:00:00Z',
    doneAt: todo.isDone ? '2026-10-10T12:00:00Z' : null,
  };
}
function row(id: string, title: string): TodoRecord {
  return record({
    id,
    title,
    goalId: 'goal',
    date: '2026-10-10',
    sortKey: id === 'one' ? 'a0' : 'a1',
    isDone: false,
  });
}
let cache: QueryClient;
// 실제 Query 비동기 알림도 act 안에서 처리해 렌더가 끝나기 전에 단언하지 않는다.
beforeAll(() =>
  notifyManager.setNotifyFunction((notify) => {
    act(notify);
  }),
);
afterAll(() => notifyManager.setNotifyFunction((notify) => notify()));
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.setItem(GUIDE_KEY, 'seen');
  onlineManager.setOnline(true);
  for (const request of [
    fetchProfile,
    listGoals,
    listRoutines,
    listLogsInRange,
    upsertLog,
    deleteLog,
    listTodosInRange,
    listOverdue,
    moveTodos,
    softDeleteTodos,
    restoreTodos,
    createTodo,
    updateTodo,
    softDeleteTodo,
    moveTodo,
  ])
    jest.mocked(request).mockReset();
  cache = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  useUIStore.getState().reset();
  jest.mocked(fetchProfile).mockResolvedValue({
    id: 'user',
    displayName: null,
    timezone: 'America/Vancouver',
    weekStart: 0,
  });
  jest.mocked(listGoals).mockResolvedValue([goal]);
  jest.mocked(listRoutines).mockResolvedValue([]);
  jest.mocked(listLogsInRange).mockResolvedValue([]);
  jest.mocked(upsertLog).mockImplementation(async (_client, routineId, date, status) => ({
    routineId,
    date,
    status,
    updatedAt: 'server',
  }));
  jest.mocked(deleteLog).mockResolvedValue(undefined);
  jest.mocked(listOverdue).mockResolvedValue([]);
  jest.mocked(listTodosInRange).mockResolvedValue([row('one', '장보기'), row('two', 'OS 과제')]);
  jest.mocked(createTodo).mockImplementation(async (_client, todo) => record(todo));
  jest.mocked(softDeleteTodo).mockImplementation(async (_client, id) => ({
    ...row(id, id === 'one' ? '장보기' : 'OS 과제'),
    deletedAt: '2026-10-10T13:00:00Z',
  }));
  jest.mocked(moveTodo).mockImplementation(async (_client, id, date, sortKey) => ({
    ...row(id, id === 'one' ? '장보기' : 'OS 과제'),
    date,
    sortKey,
  }));
  jest.mocked(updateTodo).mockImplementation(async (_client, id, changes) => ({
    ...row(id, id === 'one' ? '장보기' : 'OS 과제'),
    ...changes,
  }));
});
afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  cache.clear();
  jest.restoreAllMocks();
});
async function mount() {
  render(
    <QueryClientProvider client={cache}>
      <ToastProvider>
        <Today client={client} userId="user" onLogout={() => {}} loggingOut={false} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole('button', { name: t('todo.add') });
  await waitFor(() => expect(screen.queryByText(t('mobile.today.loading'))).toBeNull());
  // 현재 실행 날짜와 무관한 선택 날짜. 오늘 시계 자체는 단위 테스트로 검증한다.
  act(() => {
    useUIStore.getState().updateToday('2026-10-10');
    useUIStore.getState().selectDate('2026-10-10');
  });
}
it('체크를 즉시 반영하고 그 행만 잠그며 실패를 롤백·토스트로 알린다', async () => {
  let reject: (error: Error) => void = () => {};
  jest.mocked(updateTodo).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  await mount();
  fireEvent.press(
    await screen.findByRole('checkbox', { name: t('todo.complete', { title: '장보기' }) }),
  );
  const checked = await screen.findByRole('checkbox', {
    name: t('todo.uncomplete', { title: '장보기' }),
  });
  expect(checked.props.accessibilityState).toMatchObject({ checked: true, disabled: true });
  expect(StyleSheet.flatten(checked.props.style)).toMatchObject({ width: 44, minHeight: 44 });
  expect(
    screen.getByRole('checkbox', { name: t('todo.complete', { title: 'OS 과제' }) }).props
      .accessibilityState.disabled,
  ).toBe(false);
  fireEvent.press(screen.getByRole('checkbox', { name: t('todo.complete', { title: 'OS 과제' }) }));
  await screen.findByRole('checkbox', { name: t('todo.uncomplete', { title: 'OS 과제' }) });
  await act(async () => reject(new Error('network')));
  await screen.findByRole('checkbox', { name: t('todo.complete', { title: '장보기' }) });
  await screen.findByText(t('todo.save.failed'));
  expect(
    screen.getByRole('checkbox', { name: t('todo.uncomplete', { title: 'OS 과제' }) }).props
      .accessibilityState.checked,
  ).toBe(true);
});
it('추가는 즉시 월 캐시에 나타나고 입력을 비운 채 시트를 유지하며 3개 키가 다르다', async () => {
  await mount();
  fireEvent.press(screen.getByRole('button', { name: t('todo.add') }));
  const input = await screen.findByLabelText(t('todo.title'));
  expect(input.props.submitBehavior).toBe('submit');
  expect(
    screen.getByRole('button', { name: t('mobile.add.action') }).props.accessibilityState.disabled,
  ).toBe(true);
  for (const title of ['영어', '수학', '독서']) {
    fireEvent.changeText(input, title);
    fireEvent.press(screen.getByRole('button', { name: t('mobile.add.action') }));
    await waitFor(() =>
      expect(jest.mocked(createTodo).mock.calls.some((call) => call[1].title === title)).toBe(true),
    );
    await waitFor(() => expect(input.props.value).toBe(''));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: t('mobile.add.action') }).props.accessibilityState.busy,
      ).toBe(false),
    );
  }
  const added = jest.mocked(createTodo).mock.calls.map((call) => call[1]);
  expect(new Set(added.map((todo) => todo.id)).size).toBe(3);
  expect(new Set(added.map((todo) => todo.sortKey)).size).toBe(3);
  expect(
    cache.getQueryData<TodoRecord[]>(queryKeys.todos('2026-10'))?.map((todo) => todo.title),
  ).toEqual(expect.arrayContaining(['영어', '수학', '독서']));
  fireEvent.press(screen.getByRole('button', { name: t('mobile.add.cancel') }));
  await screen.findByRole('checkbox', { name: t('todo.complete', { title: '독서' }) });
});
it('요청을 기다리지 않고 새 행을 표시하며 추가 실패 후 캐시와 입력을 복원한다', async () => {
  let reject: (error: Error) => void = () => {};
  jest.mocked(createTodo).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  await mount();
  fireEvent.press(screen.getByRole('button', { name: t('todo.add') }));
  const input = await screen.findByLabelText(t('todo.title'));
  fireEvent.changeText(input, '우유');
  fireEvent.press(screen.getByRole('button', { name: t('mobile.add.action') }));
  await waitFor(() =>
    expect(
      cache
        .getQueryData<TodoRecord[]>(queryKeys.todos('2026-10'))
        ?.some((todo) => todo.title === '우유'),
    ).toBe(true),
  );
  await act(async () => reject(new Error('network')));
  expect(
    cache
      .getQueryData<TodoRecord[]>(queryKeys.todos('2026-10'))
      ?.some((todo) => todo.title === '우유'),
  ).toBe(false);
  await waitFor(() => expect(input.props.value).toBe('우유'));
  await screen.findByText(t('todo.add.failed', { title: '우유', particle: '를' }));
});
it('IME 확인 Enter와 빈 제목은 무시하고 시트 닫기에 입력 폐기 확인을 붙인다', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await mount();
  fireEvent.press(screen.getByRole('button', { name: t('todo.add') }));
  const input = await screen.findByLabelText(t('todo.title'));
  fireEvent.changeText(input, '장보기');
  fireEvent(input, 'submitEditing', { nativeEvent: { text: '장보기', isComposing: true } });
  expect(createTodo).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: t('mobile.add.cancel') }));
  expect(alert).toHaveBeenCalledWith(
    t('mobile.add.discard.title'),
    t('mobile.add.discard.description'),
    expect.any(Array),
  );
  fireEvent.changeText(input, '   ');
  fireEvent(input, 'submitEditing', { nativeEvent: { text: '   ' } });
  expect(createTodo).not.toHaveBeenCalled();
  expect(screen.UNSAFE_getByType(TextInput).props.value).toBe('   ');
});
it('빈 날 문구와 고정 바 safe area 여백, 44pt 체크 영역을 제공한다', async () => {
  jest.mocked(listTodosInRange).mockResolvedValue([]);
  await mount();
  await screen.findByText(t('mobile.today.empty'));
  const list = screen.getByTestId('day-list');
  expect(StyleSheet.flatten(list.props.contentContainerStyle).paddingBottom).toBe(98);
  const bar = screen.getByTestId('quick-add');
  expect(StyleSheet.flatten(bar.props.style).minHeight).toBe(82);
  expect(
    screen.getByRole('button', { name: t('mobile.month.expand') }).props.accessibilityState
      .expanded,
  ).toBe(false);
});

it('시트를 요청 중 닫아도 추가 실패를 토스트로 알리고 행을 롤백한다', async () => {
  let reject: (error: Error) => void = () => {};
  jest.mocked(createTodo).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  await mount();
  fireEvent.press(screen.getByRole('button', { name: t('todo.add') }));
  fireEvent.changeText(await screen.findByLabelText(t('todo.title')), 'OS 과제 새 항목');
  fireEvent.press(screen.getByRole('button', { name: t('mobile.add.action') }));
  await waitFor(() => expect(createTodo).toHaveBeenCalled());
  fireEvent.press(screen.getByRole('button', { name: t('mobile.add.cancel') }));
  await act(async () => reject(new Error('network')));
  await screen.findByText(t('todo.add.failed', { title: 'OS 과제 새 항목', particle: '을' }));
  expect(
    cache
      .getQueryData<TodoRecord[]>(queryKeys.todos('2026-10'))
      ?.some((todo) => todo.title === 'OS 과제 새 항목'),
  ).toBe(false);
});
it('월 경계에서 두 기존 월 캐시를 구독하고 추가와 체크를 모두 패치한다', async () => {
  await mount();
  act(() => useUIStore.getState().selectDate('2026-10-01'));
  await waitFor(() => expect(cache.getQueryData(queryKeys.todos('2026-09'))).toBeDefined());
  fireEvent.press(screen.getByRole('button', { name: t('todo.add') }));
  fireEvent.changeText(await screen.findByLabelText(t('todo.title')), '월 경계');
  fireEvent.press(screen.getByRole('button', { name: t('mobile.add.action') }));
  await waitFor(() => expect(createTodo).toHaveBeenCalled());
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: t('mobile.add.action') }).props.accessibilityState.busy,
    ).toBe(false),
  );
  const todo = jest.mocked(createTodo).mock.calls[0]![1];
  expect(
    cache.getQueryData<TodoRecord[]>(queryKeys.todos('2026-09'))?.some((row) => row.id === todo.id),
  ).toBe(true);
  expect(
    cache.getQueryData<TodoRecord[]>(queryKeys.todos('2026-10'))?.some((row) => row.id === todo.id),
  ).toBe(true);
  jest
    .mocked(updateTodo)
    .mockImplementationOnce(async (_client, _id, changes) => record({ ...todo, ...changes }));
  fireEvent.press(screen.getByRole('button', { name: t('mobile.add.cancel') }));
  fireEvent.press(
    await screen.findByRole('checkbox', { name: t('todo.complete', { title: '월 경계' }) }),
  );
  await screen.findByRole('checkbox', { name: t('todo.uncomplete', { title: '월 경계' }) });
  for (const month of ['2026-09', '2026-10'])
    expect(
      cache.getQueryData<TodoRecord[]>(queryKeys.todos(month))?.find((row) => row.id === todo.id)
        ?.isDone,
    ).toBe(true);
});

async function openMenu(id = 'one') {
  fireEvent.press(await screen.findByTestId(`todo-menu-${id}`));
  await screen.findByTestId('todo-menu-sheet');
}
it('메뉴와 접근성 로터가 밀기 동작을 모두 제공하고 완료 상태에 맞춰 바뀐다', async () => {
  await mount();
  const row = await screen.findByTestId('todo-menu-one');
  expect(row.props.accessibilityActions.map((action: { name: string }) => action.name)).toEqual([
    'toggle',
    'rename',
    'move',
    'delete',
  ]);
  await openMenu();
  for (const key of ['complete', 'rename', 'delete'] as const)
    expect(screen.getByRole('button', { name: t(`todo.action.${key}`) })).toBeTruthy();
  expect(screen.getByRole('button', { name: t('todo.action.move.menu') })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: t('todo.action.complete') }));
  await screen.findByRole('checkbox', { name: t('todo.uncomplete', { title: '장보기' }) });
  fireEvent.press(screen.getByRole('button', { name: t('todo.undo') }));
  await screen.findByRole('checkbox', { name: t('todo.complete', { title: '장보기' }) });
  fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'toggle' } });
  await screen.findByRole('checkbox', { name: t('todo.uncomplete', { title: '장보기' }) });
  await openMenu();
  expect(screen.getByRole('button', { name: t('todo.action.uncomplete') })).toBeTruthy();
});
it('이름 시트는 IME를 무시하고 제목을 낙관적으로 반영하며 실패 시 입력·캐시를 보존한다', async () => {
  const keyboard = jest.spyOn(Keyboard, 'addListener');
  let reject: (error: Error) => void = () => {};
  jest.mocked(updateTodo).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  await mount();
  await openMenu();
  fireEvent.press(screen.getByRole('button', { name: t('todo.action.rename') }));
  const input = await screen.findByLabelText(t('todo.title'));
  const keyboardShow = keyboard.mock.calls
    .filter(([name]) => name === 'keyboardDidShow')
    .at(-1)![1];
  act(() =>
    keyboardShow({
      duration: 0,
      easing: 'keyboard',
      endCoordinates: { height: 300, width: 390, screenX: 0, screenY: 544 },
    } as KeyboardEvent),
  );
  fireEvent.changeText(input, '우유 사기');
  fireEvent(input, 'submitEditing', { nativeEvent: { isComposing: true } });
  expect(updateTodo).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: t('mobile.rename.save') }));
  await waitFor(() =>
    expect(
      cache.getQueryData<TodoRecord[]>(queryKeys.todos('2026-10'))?.find((row) => row.id === 'one')
        ?.title,
    ).toBe('우유 사기'),
  );
  await act(async () => reject(new Error('network')));
  await screen.findByText(t('todo.save.failed'));
  expect(
    screen
      .UNSAFE_getAllByType(ScrollView)
      .some((view) => StyleSheet.flatten(view.props.style)?.bottom === 310),
  ).toBe(true);
  expect(input.props.value).toBe('우유 사기');
  expect(
    cache.getQueryData<TodoRecord[]>(queryKeys.todos('2026-10'))?.find((row) => row.id === 'one')
      ?.title,
  ).toBe('장보기');
  fireEvent.press(screen.getByRole('button', { name: t('mobile.rename.save') }));
  await screen.findByRole('checkbox', { name: t('todo.complete', { title: '우유 사기' }) });
});
it('옮기기 시트에서 날짜를 고르면 목표 맨 아래로 옮기며 실행 취소로 날짜와 키를 복원한다', async () => {
  jest
    .mocked(listTodosInRange)
    .mockResolvedValue([
      row('one', '장보기'),
      row('two', 'OS 과제'),
      { ...row('last', '내일 항목'), date: '2026-10-11', sortKey: 'a9' },
    ]);
  await mount();
  await openMenu();
  fireEvent.press(screen.getByRole('button', { name: t('todo.action.move.menu') }));
  fireEvent.press(await screen.findByRole('button', { name: t('date.tomorrow') }));
  await waitFor(() => expect(moveTodo).toHaveBeenCalled());
  expect(jest.mocked(moveTodo).mock.calls[0]![2]).toBe('2026-10-11');
  expect(jest.mocked(moveTodo).mock.calls[0]![3] > 'a9').toBe(true);
  await screen.findByText(t('todo.moved', { title: '장보기', particle: '를', date: '10월 11일' }));
  expect(
    screen.queryByRole('checkbox', { name: t('todo.complete', { title: '장보기' }) }),
  ).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: t('todo.undo') }));
  await screen.findByRole('checkbox', { name: t('todo.complete', { title: '장보기' }) });
  expect(jest.mocked(moveTodo).mock.calls[1]!.slice(2)).toEqual(['2026-10-10', 'a0']);
});
it.each(['move', 'delete'] as const)(
  '%s 실패는 사라진 행을 롤백하고 토스트로 알린다',
  async (action) => {
    let reject: (error: Error) => void = () => {};
    const request = action === 'move' ? jest.mocked(moveTodo) : jest.mocked(softDeleteTodo);
    request.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    await mount();
    await openMenu();
    fireEvent.press(
      screen.getByRole('button', {
        name: t(action === 'move' ? 'todo.action.move.menu' : 'todo.action.delete'),
      }),
    );
    if (action === 'move')
      fireEvent.press(await screen.findByRole('button', { name: t('date.tomorrow') }));
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(
      screen.queryByRole('checkbox', { name: t('todo.complete', { title: '장보기' }) }),
    ).toBeNull();
    expect(
      screen.getByRole('checkbox', { name: t('todo.complete', { title: 'OS 과제' }) }).props
        .accessibilityState.disabled,
    ).toBe(false);
    await act(async () => reject(new Error('network')));
    await screen.findByRole('checkbox', { name: t('todo.complete', { title: '장보기' }) });
    await screen.findByText(t('todo.save.failed'));
  },
);
it('연속 세 삭제 후 행이 언마운트되어도 각 실행 취소가 독립적으로 복원된다', async () => {
  // 실제 5초 만료는 큐 테스트로 검증한다. 이 통합 검사는 조회 비용과 무관하게 복원 세 경로를 검증한다.
  jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-10T20:00:00Z').getTime());
  jest
    .mocked(listTodosInRange)
    .mockResolvedValue([row('one', '장보기'), row('two', 'OS 과제'), row('three', '독서')]);
  jest.mocked(softDeleteTodo).mockImplementation(async (_client, id) => ({
    ...row(id, id === 'one' ? '장보기' : id === 'two' ? 'OS 과제' : '독서'),
    deletedAt: '2026-10-10T13:00:00Z',
  }));
  jest.mocked(updateTodo).mockImplementation(async (_client, id, changes) => ({
    ...row(id, id === 'one' ? '장보기' : id === 'two' ? 'OS 과제' : '독서'),
    ...changes,
  }));
  await mount();
  for (const id of ['one', 'two', 'three']) {
    await openMenu(id);
    fireEvent.press(
      within(screen.getByTestId('todo-menu-sheet')).getByRole('button', {
        name: t('todo.action.delete'),
      }),
    );
    await waitFor(() => {
      const rows = cache.getQueryData<TodoRecord[]>(queryKeys.todos('2026-10'));
      expect(rows?.some((row) => row.id === id)).toBe(false);
      expect(screen.queryByTestId(`todo-menu-${id}`)).toBeNull();
    });
  }
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: t('todo.undo') })).toHaveLength(3),
  );
  for (const title of ['장보기', 'OS 과제', '독서']) {
    fireEvent.press(screen.getAllByRole('button', { name: t('todo.undo') })[0]!);
    await screen.findByRole('checkbox', { name: t('todo.complete', { title }) });
  }
  expect(jest.mocked(updateTodo).mock.calls.map((call) => call[2])).toEqual([
    { deletedAt: null },
    { deletedAt: null },
    { deletedAt: null },
  ]);
}, 10000);
it('복원 실패는 삭제 상태로 롤백하고 복원 작업을 잃지 않아 재시도할 수 있다', async () => {
  await mount();
  await openMenu();
  fireEvent.press(
    within(screen.getByTestId('todo-menu-sheet')).getByRole('button', {
      name: t('todo.action.delete'),
    }),
  );
  fireEvent.press(await screen.findByRole('button', { name: t('todo.undo') }));
  await screen.findByRole('checkbox', { name: t('todo.complete', { title: '장보기' }) });
  await openMenu();
  fireEvent.press(
    within(screen.getByTestId('todo-menu-sheet')).getByRole('button', {
      name: t('todo.action.delete'),
    }),
  );
  jest.mocked(updateTodo).mockRejectedValueOnce(new Error('network'));
  fireEvent.press(await screen.findByRole('button', { name: t('todo.undo') }));
  await screen.findByText(t('todo.undo.failed'));
  expect(screen.queryByTestId('todo-menu-one')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: t('todo.undo') }));
  await screen.findByTestId('todo-menu-one');
});
it('완료 후 삭제한 행은 이전 완료 실행 취소로 되살리거나 서버에 쓰지 않는다', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-10T20:00:00Z').getTime());
  await mount();
  fireEvent.press(screen.getByRole('checkbox', { name: t('todo.complete', { title: '장보기' }) }));
  await screen.findByText(t('todo.toggled', { title: '장보기', particle: '를' }));
  await openMenu();
  fireEvent.press(
    within(screen.getByTestId('todo-menu-sheet')).getByRole('button', {
      name: t('todo.action.delete'),
    }),
  );
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: t('todo.undo') })).toHaveLength(2),
  );
  // 잘못된 구현은 지연 응답을 기다리는 동안 삭제한 행을 캐시에 다시 넣는다.
  jest.mocked(updateTodo).mockImplementationOnce(() => new Promise(() => {}));
  fireEvent.press(screen.getAllByRole('button', { name: t('todo.undo') })[0]!);
  await screen.findByText(t('todo.undo.failed'));
  expect(updateTodo).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('todo-menu-one')).toBeNull();
  expect(
    cache.getQueryData<TodoRecord[]>(queryKeys.todos('2026-10'))?.some((row) => row.id === 'one'),
  ).toBe(false);
});

it('월 제목으로 42칸을 펼치고 이전·다음 달과 VoiceOver로 이동한 뒤 선택하면 접힌다', async () => {
  await mount();
  fireEvent.press(screen.getByRole('button', { name: t('mobile.month.expand') }));
  const grid = await screen.findByTestId('month-grid');
  expect(within(grid).getAllByRole('button')).toHaveLength(42);
  fireEvent.press(screen.getByRole('button', { name: t('calendar.nextMonth') }));
  expect(useUIStore.getState().calendarMonth).toBe('2026-11');
  act(() =>
    screen.getByTestId('month-grid').props.onAccessibilityAction({
      nativeEvent: { actionName: 'decrement' },
    }),
  );
  expect(useUIStore.getState().calendarMonth).toBe('2026-10');
  const day = within(screen.getByTestId('month-grid')).getAllByRole('button')[0]!;
  expect(StyleSheet.flatten(day.props.style).height).toBe(64);
  expect(StyleSheet.flatten(day.props.style).opacity).toBe(0.4);
  fireEvent.press(day);
  expect(useUIStore.getState().selectedDate).toBe('2026-09-27');
  expect(screen.queryByTestId('month-grid')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: t('day.today') }));
  expect(useUIStore.getState().selectedDate).toBe(useUIStore.getState().today);
});

it('VoiceOver 옮기기에서 다음 달을 고르면 겹치는 모든 캐시를 패치하고 원래 키로 복원한다', async () => {
  const original = { ...row('one', '장보기'), date: '2026-10-01' };
  jest
    .mocked(listTodosInRange)
    .mockResolvedValue([
      original,
      { ...row('tail', '앞날 항목'), date: '2026-11-01', sortKey: 'a9' },
    ]);
  await mount();
  act(() => useUIStore.getState().selectDate('2026-10-01'));
  const rowButton = await screen.findByTestId('todo-menu-one');
  fireEvent(rowButton, 'accessibilityAction', { nativeEvent: { actionName: 'move' } });
  const sheet = await screen.findByTestId('date-pick-sheet');
  expect(moveTodo).not.toHaveBeenCalled();
  fireEvent.press(within(sheet).getByRole('button', { name: t('calendar.nextMonth') }));
  await within(sheet).findByText('2026년 11월');
  const grid = within(sheet).getByTestId('month-grid');
  fireEvent.press(within(grid).getAllByRole('button')[0]!);
  await waitFor(() => expect(moveTodo).toHaveBeenCalled());
  expect(jest.mocked(moveTodo).mock.calls[0]!.slice(2)[0]).toBe('2026-11-01');
  expect(jest.mocked(moveTodo).mock.calls[0]![3] > 'a9').toBe(true);
  await screen.findByText(t('todo.moved', { title: '장보기', particle: '를', date: '11월 1일' }));
  for (const month of ['2026-10', '2026-11'])
    expect(
      cache.getQueryData<TodoRecord[]>(queryKeys.todos(month))?.find((row) => row.id === 'one')
        ?.date,
    ).toBe('2026-11-01');
  expect(
    cache.getQueryData<TodoRecord[]>(queryKeys.todos('2026-09'))?.some((row) => row.id === 'one'),
  ).toBe(false);
  fireEvent.press(screen.getByRole('button', { name: t('todo.undo') }));
  await screen.findByTestId('todo-menu-one');
  expect(jest.mocked(moveTodo).mock.calls[1]!.slice(2)).toEqual(['2026-10-01', 'a0']);
  for (const month of ['2026-09', '2026-10'])
    expect(
      cache.getQueryData<TodoRecord[]>(queryKeys.todos(month))?.find((row) => row.id === 'one'),
    ).toMatchObject({ date: '2026-10-01', sortKey: 'a0' });
  expect(
    cache.getQueryData<TodoRecord[]>(queryKeys.todos('2026-11'))?.some((row) => row.id === 'one'),
  ).toBe(false);
});
it('같은 날짜는 쓰지 않고 닫으며 추가 시트도 같은 날짜 시트로 다음 달에 추가한다', async () => {
  await mount();
  await openMenu();
  fireEvent.press(screen.getByRole('button', { name: t('todo.action.move.menu') }));
  fireEvent.press(
    within(await screen.findByTestId('date-pick-sheet')).getByRole('button', {
      name: t('day.today'),
    }),
  );
  expect(moveTodo).not.toHaveBeenCalled();
  expect(screen.queryByTestId('date-pick-sheet')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: t('todo.add') }));
  fireEvent.changeText(await screen.findByLabelText(t('todo.title')), '다음 달 준비');
  fireEvent.press(screen.getByRole('button', { name: t('mobile.add.date.pick') }));
  const sheet = await screen.findByTestId('date-pick-sheet');
  fireEvent.press(within(sheet).getByRole('button', { name: t('calendar.nextMonth') }));
  fireEvent.press(within(within(sheet).getByTestId('month-grid')).getAllByRole('button')[0]!);
  fireEvent.press(screen.getByRole('button', { name: t('mobile.add.action') }));
  await waitFor(() => expect(createTodo).toHaveBeenCalled());
  expect(jest.mocked(createTodo).mock.calls[0]![1]).toMatchObject({
    title: '다음 달 준비',
    date: '2026-11-01',
  });
  await waitFor(() =>
    expect(
      cache
        .getQueryData<TodoRecord[]>(queryKeys.todos('2026-11'))
        ?.some((row) => row.title === '다음 달 준비'),
    ).toBe(true),
  );
});

function installServer(rows: TodoRecord[]) {
  const server = new Map(rows.map((row) => [row.id, row]));
  const active = () => [...server.values()].filter((row) => !row.deletedAt);
  jest
    .mocked(listTodosInRange)
    .mockImplementation(async (_client, from, to) =>
      active().filter((row) => row.date >= from && row.date <= to),
    );
  jest
    .mocked(listOverdue)
    .mockImplementation(async () =>
      active().filter((row) => !row.isDone && row.date >= '2026-10-03' && row.date < '2026-10-10'),
    );
  jest.mocked(moveTodos).mockImplementation(async (_client, moves, date) => {
    for (const move of moves)
      server.set(move.id, { ...server.get(move.id)!, date, sortKey: move.sort_key });
  });
  jest.mocked(softDeleteTodos).mockImplementation(async (_client, ids) =>
    ids.map((id) => {
      const deleted = { ...server.get(id)!, deletedAt: '2026-10-10T13:00:00Z' };
      server.set(id, deleted);
      return deleted;
    }),
  );
  jest.mocked(restoreTodos).mockImplementation(async (_client, ids) =>
    ids.map((id) => {
      const restored = { ...server.get(id)!, deletedAt: null };
      server.set(id, restored);
      return restored;
    }),
  );
  jest.mocked(updateTodo).mockImplementation(async (_client, id, changes) => {
    const next = { ...server.get(id)!, ...changes };
    server.set(id, next);
    return next;
  });
  return server;
}
async function openDayMenu() {
  fireEvent.press(screen.getByRole('button', { name: t('day.menu.open') }));
  return screen.findByTestId('day-menu-sheet');
}
it('지난 날짜에도 하루 메뉴 세 항목을 유지하고 가져오기 비활성 이유를 보여준다', async () => {
  await mount();
  act(() => useUIStore.getState().selectDate('2026-10-09'));
  const sheet = await openDayMenu();
  expect(
    within(sheet).getByRole('button', { name: t('day.menu.import', { count: 0 }) }).props
      .accessibilityState.disabled,
  ).toBe(true);
  expect(within(sheet).getByText(t('day.menu.todayOnly'))).toBeTruthy();
  expect(
    within(sheet).getByRole('button', { name: t('day.menu.move') }).props.accessibilityState
      .disabled,
  ).toBe(true);
  expect(
    within(sheet).getByRole('button', { name: t('day.menu.delete') }).props.accessibilityState
      .disabled,
  ).toBe(true);
});
it('가져오기는 최근 7일 활성 목표 미완료만 각 목표 맨 아래에 붙이고 원래 날짜별로 모두 복원한다', async () => {
  const secondGoal = { ...goal, id: 'second', name: '운동', sortKey: 'a1' };
  const archivedGoal = { ...goal, id: 'archive', archivedAt: '2026-10-01T00:00:00Z' };
  jest.mocked(listGoals).mockResolvedValue([goal, secondGoal, archivedGoal]);
  const first = { ...row('old-one', '어제 공부'), date: '2026-10-09' };
  const second = { ...row('old-two', '지난 운동'), date: '2026-10-03', goalId: 'second' };
  const server = installServer([
    row('one', '오늘 공부'),
    { ...row('two', '오늘 운동'), goalId: 'second', sortKey: 'a8' },
    first,
    second,
    { ...row('done', '끝낸 것'), date: '2026-10-09', isDone: true },
    { ...row('archived', '보관 것'), date: '2026-10-09', goalId: 'archive' },
    { ...row('too-old', '오래된 것'), date: '2026-10-02' },
  ]);
  await mount();
  const sheet = await openDayMenu();
  fireEvent.press(
    await within(sheet).findByRole('button', { name: t('day.menu.import', { count: 2 }) }),
  );
  await screen.findByText(t('day.menu.imported', { count: 2 }));
  expect(server.get(first.id)).toMatchObject({ date: '2026-10-10' });
  expect(server.get(first.id)!.sortKey > 'a0').toBe(true);
  expect(server.get(second.id)!.sortKey > 'a8').toBe(true);
  expect(server.get('done')!.date).toBe('2026-10-09');
  expect(server.get('archived')!.date).toBe('2026-10-09');
  expect(server.get('too-old')!.date).toBe('2026-10-02');
  fireEvent.press(screen.getByRole('button', { name: t('todo.undo') }));
  await waitFor(() =>
    expect(server.get(first.id)).toMatchObject({ date: first.date, sortKey: first.sortKey }),
  );
  await waitFor(() =>
    expect(server.get(second.id)).toMatchObject({ date: second.date, sortKey: second.sortKey }),
  );
  expect(moveTodos).toHaveBeenCalledTimes(3);
});
it('묶음 옮기기는 두 달 캐시를 낙관적으로 패치하고 원래 날짜만 잠그며 실행 취소한다', async () => {
  const server = installServer([
    row('one', '장보기'),
    row('two', 'OS 과제'),
    { ...row('done', '완료'), isDone: true },
    { ...row('elsewhere', '다른 날'), date: '2026-10-11' },
    { ...row('tail', '다음 달'), date: '2026-11-01', sortKey: 'a9' },
  ]);
  let finish: () => void = () => {};
  const actualMove = jest.mocked(moveTodos).getMockImplementation()!;
  jest.mocked(moveTodos).mockImplementationOnce(
    (...args) =>
      new Promise((resolve) => {
        finish = () => {
          void actualMove(...args).then(resolve);
        };
      }),
  );
  await mount();
  const sheet = await openDayMenu();
  fireEvent.press(within(sheet).getByRole('button', { name: t('day.menu.move') }));
  const picker = await screen.findByTestId('date-pick-sheet');
  expect(within(picker).getByText(t('day.menu.targets', { count: 2 }))).toBeTruthy();
  fireEvent.press(within(picker).getByRole('button', { name: t('calendar.nextMonth') }));
  await within(picker).findByText('2026년 11월');
  fireEvent.press(within(within(picker).getByTestId('month-grid')).getAllByRole('button')[0]!);
  await waitFor(() => expect(moveTodos).toHaveBeenCalled());
  for (const month of ['2026-10', '2026-11'])
    expect(
      cache.getQueryData<TodoRecord[]>(queryKeys.todos(month))?.find((row) => row.id === 'one')
        ?.date,
    ).toBe('2026-11-01');
  expect(
    screen.getByRole('checkbox', { name: t('todo.uncomplete', { title: '완료' }) }).props
      .accessibilityState.disabled,
  ).toBe(true);
  expect(screen.getByTestId('quick-add').props.accessibilityState.disabled).toBe(true);
  act(() => useUIStore.getState().selectDate('2026-11-01'));
  const moved = await screen.findByRole('checkbox', {
    name: t('todo.complete', { title: '장보기' }),
  });
  expect(moved.props.accessibilityState.disabled).toBe(true);
  expect(
    screen.getByRole('checkbox', { name: t('todo.complete', { title: '다음 달' }) }).props
      .accessibilityState.disabled,
  ).toBe(false);
  fireEvent.press(moved);
  expect(updateTodo).not.toHaveBeenCalled();
  act(() => useUIStore.getState().selectDate('2026-10-11'));
  const other = await screen.findByRole('checkbox', {
    name: t('todo.complete', { title: '다른 날' }),
  });
  expect(other.props.accessibilityState.disabled).toBe(false);
  fireEvent.press(other);
  await screen.findByRole('checkbox', { name: t('todo.uncomplete', { title: '다른 날' }) });
  await act(async () => finish());
  await screen.findByText(t('day.menu.moved', { count: 2, date: '11월 1일' }));
  expect(server.get('one')!.sortKey > 'a9').toBe(true);
  expect(server.get('two')!.sortKey > server.get('one')!.sortKey).toBe(true);
  fireEvent.press(screen.getAllByRole('button', { name: t('todo.undo') }).at(-1)!);
  await waitFor(() =>
    expect(server.get('one')).toMatchObject({ date: '2026-10-10', sortKey: 'a0' }),
  );
  expect(server.get('two')).toMatchObject({ date: '2026-10-10', sortKey: 'a1' });
  expect(server.get('done')!.date).toBe('2026-10-10');
  expect(server.get('elsewhere')!.isDone).toBe(true);
});
it('전체 삭제는 개수 확인을 거쳐 미완료만 지우고 완료·루틴 캐시는 남기며 모두 복원한다', async () => {
  const server = installServer([
    row('one', '장보기'),
    row('two', 'OS 과제'),
    { ...row('done', '완료'), isDone: true },
  ]);
  const routine = routineRow('routine', '루틴');
  cache.setQueryData(['routines'], [routine]);
  const alert = jest.spyOn(Alert, 'alert');
  await mount();
  const sheet = await openDayMenu();
  fireEvent.press(within(sheet).getByRole('button', { name: t('day.menu.delete') }));
  expect(alert).toHaveBeenCalledWith(
    t('day.menu.delete.confirm', { count: 2 }),
    t('day.menu.delete.description'),
    expect.any(Array),
  );
  expect(softDeleteTodos).not.toHaveBeenCalled();
  await act(async () => alert.mock.calls[0]![2]![1]!.onPress?.());
  await screen.findByText(t('day.menu.deleted', { count: 2 }));
  expect(server.get('one')!.deletedAt).not.toBeNull();
  expect(server.get('two')!.deletedAt).not.toBeNull();
  expect(server.get('done')!.deletedAt).toBeNull();
  expect(cache.getQueryData(['routines'])).toEqual([routine]);
  fireEvent.press(screen.getByRole('button', { name: t('todo.undo') }));
  await screen.findByTestId('todo-menu-one');
  await screen.findByTestId('todo-menu-two');
  expect(restoreTodos).toHaveBeenCalledWith(client, ['one', 'two']);
});
it('가져오기 복원 일부가 실패하면 성공한 날짜 그룹을 반복하지 않고 실패한 그룹만 재시도한다', async () => {
  const original1 = { ...row('one', '어제'), date: '2026-10-09' };
  const original2 = { ...row('two', '지난주'), date: '2026-10-03' };
  const server = installServer([original1, original2]);
  await mount();
  const sheet = await openDayMenu();
  fireEvent.press(
    await within(sheet).findByRole('button', { name: t('day.menu.import', { count: 2 }) }),
  );
  await screen.findByText(t('day.menu.imported', { count: 2 }));
  const implementation = jest.mocked(moveTodos).getMockImplementation()!;
  jest
    .mocked(moveTodos)
    .mockImplementationOnce(implementation)
    .mockRejectedValueOnce(new Error('network'));
  fireEvent.press(screen.getByRole('button', { name: t('todo.undo') }));
  await screen.findByText(t('todo.undo.failed'));
  expect(server.get('one')!.date).toBe('2026-10-09');
  expect(server.get('two')!.date).toBe('2026-10-10');
  fireEvent.press(screen.getByRole('button', { name: t('todo.undo') }));
  await waitFor(() => expect(server.get('two')!.date).toBe('2026-10-03'));
  expect(jest.mocked(moveTodos).mock.calls.map((call) => call[2])).toEqual([
    '2026-10-10',
    '2026-10-09',
    '2026-10-03',
    '2026-10-03',
  ]);
});

it.each(['import', 'move', 'delete'] as const)(
  '묶음 %s 실패는 대상만 롤백하고 다른 날짜의 완료 변경을 보존한다',
  async (action) => {
    const original = {
      ...row('one', '장보기'),
      date: action === 'import' ? '2026-10-09' : '2026-10-10',
    };
    const server = installServer([
      original,
      { ...row('elsewhere', '다른 날'), date: '2026-10-12' },
    ]);
    let reject: (error: Error) => void = () => {};
    const request = action === 'delete' ? jest.mocked(softDeleteTodos) : jest.mocked(moveTodos);
    request.mockImplementationOnce(
      () =>
        new Promise<never>((_resolve, fail) => {
          reject = fail;
        }),
    );
    const alert = jest.spyOn(Alert, 'alert');
    await mount();
    const sheet = await openDayMenu();
    if (action === 'import')
      fireEvent.press(
        await within(sheet).findByRole('button', { name: t('day.menu.import', { count: 1 }) }),
      );
    else if (action === 'move') {
      fireEvent.press(within(sheet).getByRole('button', { name: t('day.menu.move') }));
      fireEvent.press(
        within(await screen.findByTestId('date-pick-sheet')).getByRole('button', {
          name: t('date.tomorrow'),
        }),
      );
    } else {
      fireEvent.press(within(sheet).getByRole('button', { name: t('day.menu.delete') }));
      await act(async () => alert.mock.calls[0]![2]![1]!.onPress?.());
    }
    await waitFor(() => expect(request).toHaveBeenCalled());
    const optimistic = cache
      .getQueryData<TodoRecord[]>(queryKeys.todos('2026-10'))
      ?.find((row) => row.id === 'one');
    if (action === 'delete') expect(optimistic).toBeUndefined();
    else expect(optimistic?.date).toBe(action === 'import' ? '2026-10-10' : '2026-10-11');
    act(() => useUIStore.getState().selectDate('2026-10-12'));
    fireEvent.press(
      await screen.findByRole('checkbox', { name: t('todo.complete', { title: '다른 날' }) }),
    );
    await screen.findByRole('checkbox', { name: t('todo.uncomplete', { title: '다른 날' }) });
    await act(async () => reject(new Error('network')));
    await screen.findByText(t('todo.save.failed'));
    await waitFor(() =>
      expect(
        cache
          .getQueryData<TodoRecord[]>(queryKeys.todos('2026-10'))
          ?.find((row) => row.id === 'one'),
      ).toMatchObject({ date: original.date, sortKey: original.sortKey, deletedAt: null }),
    );
    expect(server.get('elsewhere')!.isDone).toBe(true);
    expect(
      screen.getByRole('checkbox', { name: t('todo.uncomplete', { title: '다른 날' }) }).props
        .accessibilityState.checked,
    ).toBe(true);
  },
);
it('묶음 삭제 복원 실패도 전부 롤백하고 같은 실행 취소를 재시도할 수 있다', async () => {
  const server = installServer([row('one', '장보기'), row('two', 'OS 과제')]);
  const alert = jest.spyOn(Alert, 'alert');
  await mount();
  const sheet = await openDayMenu();
  fireEvent.press(within(sheet).getByRole('button', { name: t('day.menu.delete') }));
  await act(async () => alert.mock.calls[0]![2]![1]!.onPress?.());
  await screen.findByText(t('day.menu.deleted', { count: 2 }));
  jest.mocked(restoreTodos).mockRejectedValueOnce(new Error('network'));
  fireEvent.press(screen.getByRole('button', { name: t('todo.undo') }));
  await screen.findByText(t('todo.undo.failed'));
  expect(screen.queryByTestId('todo-menu-one')).toBeNull();
  expect(screen.queryByTestId('todo-menu-two')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: t('todo.undo') }));
  await screen.findByTestId('todo-menu-one');
  await screen.findByTestId('todo-menu-two');
  expect(server.get('one')!.deletedAt).toBeNull();
  expect(server.get('two')!.deletedAt).toBeNull();
});

it('월간에서 다른 달을 둘러봐도 선택한 날짜의 목록은 유지한다', async () => {
  await mount();
  fireEvent.press(screen.getByRole('button', { name: t('mobile.month.expand') }));
  fireEvent.press(screen.getByRole('button', { name: t('calendar.nextMonth') }));
  expect(useUIStore.getState().selectedDate).toBe('2026-10-10');
  expect(useUIStore.getState().calendarMonth).toBe('2026-11');
  expect(screen.getByTestId('todo-menu-one')).toBeTruthy();
  expect(screen.getByTestId('day-list').props.ListHeaderComponent).toBeUndefined();
  const month = screen.getByRole('button', { name: t('mobile.month.collapse') });
  fireEvent(month, 'focus');
  expect(StyleSheet.flatten(month.props.style).borderColor).toBe('#2A63C9');
});

function mountDayActions() {
  return renderHook(() => useDayActions(client, 0), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={cache}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    ),
  });
}
async function runDayAction(
  actions: ReturnType<typeof useDayActions>,
  action: 'move' | 'import' | 'delete',
  original: TodoRecord,
) {
  if (action === 'move') await actions.moveTo([original], '2026-10-11');
  else if (action === 'import')
    await actions.importOverdue([original], [{ id: original.id, sort_key: 'a9' }], '2026-10-10');
  else await actions.deleteTodos([original]);
}
it.each(['move', 'import', 'delete'] as const)(
  '묶음 %s의 다른 쓰기 진행 중은 저장 실패로 안내하거나 요청하지 않는다',
  async (action) => {
    const original = {
      ...row('one', '장보기'),
      date: action === 'import' ? '2026-10-09' : '2026-10-10',
    };
    cache.setQueryData(queryKeys.todos('2026-10'), [original]);
    const { result } = mountDayActions();
    let finish: () => void = () => {};
    const pending = cache.getMutationCache().build(cache, {
      mutationKey: ['write', 'todo', original.id],
      mutationFn: () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    });
    let request: Promise<void>;
    await act(async () => {
      request = pending.execute(original);
    });
    await act(async () => runDayAction(result.current, action, original));
    await screen.findByText(t('day.action.busy'));
    expect(screen.queryByText(t('todo.save.failed'))).toBeNull();
    expect(moveTodos).not.toHaveBeenCalled();
    expect(softDeleteTodos).not.toHaveBeenCalled();
    expect(result.current.isDateLocked('2026-10-10')).toBe(false);
    await act(async () => {
      finish();
      await request!;
    });
  },
);
it.each(['move', 'import', 'delete'] as const)(
  '묶음 %s의 변경된 스냅샷은 다시 시도 대신 목록 확인을 안내하고 요청하지 않는다',
  async (action) => {
    const original = {
      ...row('one', '장보기'),
      date: action === 'import' ? '2026-10-09' : '2026-10-10',
    };
    cache.setQueryData(queryKeys.todos('2026-10'), [{ ...original, sortKey: 'a8' }]);
    const { result } = mountDayActions();
    await act(async () => runDayAction(result.current, action, original));
    const notice = await screen.findByText(t('day.action.changed'));
    expect(notice.props.children).not.toContain('다시 시도');
    expect(screen.queryByText(t('todo.save.failed'))).toBeNull();
    expect(moveTodos).not.toHaveBeenCalled();
    expect(softDeleteTodos).not.toHaveBeenCalled();
    expect(result.current.isDateLocked(original.date)).toBe(false);
    expect(cache.getQueryData<TodoRecord[]>(queryKeys.todos('2026-10'))).toEqual([
      { ...original, sortKey: 'a8' },
    ]);
  },
);
it('묶음 이동의 목적 월 조회 실패는 저장 실패와 구별하고 요청 없이 준비 잠금을 푼다', async () => {
  const original = row('one', '장보기');
  cache.setQueryData(queryKeys.todos('2026-10'), [original]);
  jest.mocked(listTodosInRange).mockRejectedValueOnce(new Error('network'));
  const { result } = mountDayActions();
  await act(async () => result.current.moveTo([original], '2026-11-20'));
  await screen.findByText(t('day.action.prepareFailed'));
  expect(screen.queryByText(t('todo.save.failed'))).toBeNull();
  expect(moveTodos).not.toHaveBeenCalled();
  expect(result.current.isDateLocked(original.date)).toBe(false);
  expect(cache.getQueryData<TodoRecord[]>(queryKeys.todos('2026-10'))).toEqual([original]);
});
it('목적 월을 준비하는 동안 완료된 항목은 저장하지 않고 새 목록 확인을 안내한다', async () => {
  const original = row('one', '장보기');
  cache.setQueryData(queryKeys.todos('2026-10'), [original]);
  let finish: (rows: TodoRecord[]) => void = () => {};
  jest.mocked(listTodosInRange).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = mountDayActions();
  let request: Promise<void>;
  await act(async () => {
    request = result.current.moveTo([original], '2026-11-20');
  });
  expect(result.current.isDateLocked(original.date)).toBe(true);
  await act(async () => {
    cache.setQueryData(queryKeys.todos('2026-10'), [{ ...original, isDone: true }]);
    finish([]);
    await request!;
  });
  await screen.findByText(t('day.action.changed'));
  expect(moveTodos).not.toHaveBeenCalled();
  expect(result.current.isDateLocked(original.date)).toBe(false);
  expect(cache.getQueryData<TodoRecord[]>(queryKeys.todos('2026-10'))?.[0]?.isDone).toBe(true);
});

function routineRow(id = 'r', title = '영어 루틴'): RoutineRecord {
  return {
    id,
    title,
    goalId: 'goal',
    sortKey: 'a2',
    freq: 'daily',
    repeatEvery: 1,
    byWeekday: null,
    byMonthday: null,
    startDate: '2026-09-01',
    endDate: null,
    deletedAt: null,
    updatedAt: '',
  };
}
it('루틴을 같은 날짜에 전개하고 주·월 도장과 완료·실패 롤백을 함께 반영한다', async () => {
  jest.mocked(listRoutines).mockResolvedValue([routineRow(), routineRow('r2', '수학 루틴')]);
  let reject: (error: Error) => void = () => {};
  jest.mocked(upsertLog).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  await mount();
  expect(await screen.findByRole('checkbox', { name: '영어 루틴 완료하기' })).toBeTruthy();
  expect(screen.getByText('오늘, 4개 중 0개 끝냄')).toBeTruthy();
  fireEvent.press(screen.getByRole('checkbox', { name: '영어 루틴 완료하기' }));
  await screen.findByRole('checkbox', { name: '영어 루틴 완료 취소하기' });
  expect(
    screen.getByRole('checkbox', { name: '수학 루틴 완료하기' }).props.accessibilityState.disabled,
  ).toBe(false);
  expect(screen.getByText('오늘, 4개 중 1개 끝냄')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: t('mobile.month.expand') }));
  expect(
    within(screen.getByTestId('month-grid')).getByRole('button', { name: /10월 10일.*3개 남음/ }),
  ).toBeTruthy();
  await act(async () => reject(new Error('failed')));
  await screen.findByText(t('todo.save.failed'));
  expect(
    screen.getByRole('checkbox', { name: '영어 루틴 완료하기' }).props.accessibilityState.checked,
  ).toBe(false);
  expect(
    within(screen.getByTestId('month-grid')).getByRole('button', { name: /10월 10일.*4개 남음/ }),
  ).toBeTruthy();
});
it.each(['import', 'move', 'delete'])(
  '루틴이 실제 보이는 하루 메뉴 %s는 할 일만 처리하고 루틴·로그를 유지한다',
  async (action) => {
    const routine = routineRow();
    const log = {
      routineId: routine.id,
      date: '2026-10-10',
      status: 'done' as const,
      updatedAt: '',
    };
    jest.mocked(listRoutines).mockResolvedValue([routine]);
    jest.mocked(listLogsInRange).mockResolvedValue([log]);
    installServer([row('one', '장보기'), { ...row('old', '지난 할 일'), date: '2026-10-09' }]);
    const confirm = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await mount();
    expect(screen.getByRole('checkbox', { name: '영어 루틴 완료 취소하기' })).toBeTruthy();
    const sheet = await openDayMenu();
    if (action === 'import') {
      fireEvent.press(
        await within(sheet).findByRole('button', { name: t('day.menu.import', { count: 1 }) }),
      );
      await screen.findByText(t('day.menu.imported', { count: 1 }));
    } else if (action === 'move') {
      fireEvent.press(within(sheet).getByRole('button', { name: t('day.menu.move') }));
      fireEvent.press(await screen.findByRole('button', { name: '내일' }));
      await screen.findByText(t('day.menu.moved', { count: 1, date: '10월 11일' }));
    } else {
      fireEvent.press(within(sheet).getByRole('button', { name: t('day.menu.delete') }));
      expect(confirm).toHaveBeenCalledWith(
        t('day.menu.delete.confirm', { count: 1 }),
        t('day.menu.delete.description'),
        expect.any(Array),
      );
      act(() =>
        confirm.mock.calls[0]![2]!.find((button) => button.style === 'destructive')!.onPress!(),
      );
      await screen.findByText(t('day.menu.deleted', { count: 1 }));
    }
    expect(cache.getQueryData(['routines'])).toEqual([routine]);
    expect(cache.getQueryData(['routineLogs', '2026-10'])).toEqual([log]);
    expect(screen.getByRole('checkbox', { name: '영어 루틴 완료 취소하기' })).toBeTruthy();
    expect(upsertLog).not.toHaveBeenCalled();
    expect(deleteLog).not.toHaveBeenCalled();
  },
);
it('설정 화면에서 루틴 관리와 만들기 시트로 들어간다', async () => {
  jest
    .mocked(listRoutines)
    .mockResolvedValue([
      routineRow(),
      { ...routineRow('ended', '끝난 운동'), endDate: '2026-10-09' },
    ]);
  await mount();
  fireEvent.press(screen.getByRole('button', { name: t('settings.title') }));
  fireEvent.press(screen.getByRole('button', { name: t('routine.manage') }));
  await screen.findByText('돌고 있는 루틴 1개');
  expect(screen.getByText('끝난 루틴 1개')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: t('routine.create') }));
  expect(screen.getByTestId('routine-edit-sheet')).toBeTruthy();
});

it('관리 줄의 밀기·메뉴·VoiceOver는 편집·그만두기 선언을 따르고 오른쪽 동작은 없다', async () => {
  jest.mocked(listRoutines).mockResolvedValue([routineRow()]);
  await mount();
  fireEvent.press(screen.getByRole('button', { name: t('settings.title') }));
  fireEvent.press(screen.getByRole('button', { name: t('routine.manage') }));
  const management = await screen.findByRole('button', { name: /^영어 루틴 · 매일/ });
  // 모션 감소 확인 effect가 끝난 뒤 네이티브 레이아웃/제스처 이벤트를 전달한다.
  await act(async () => {});
  expect(management.props.accessibilityActions).toEqual([
    { name: 'edit', label: '루틴 편집' },
    { name: 'stop', label: '그만두기' },
  ]);
  // 네이티브 거리 판정은 SwipeableRow 스위트에서 검사하고 여기서는 실제 전달된 동작의 연결을 검증한다.
  const swipeRow = screen
    .UNSAFE_getAllByType(SwipeableRow)
    .find((row) => row.props.id === 'manage-r')!;
  expect(swipeRow.props.leading).toBeUndefined();
  expect(swipeRow.props.trailing.map((action: { id: string }) => action.id)).toEqual(['stop']);
  act(() => swipeRow.props.trailing[0].run());
  await screen.findByTestId('routine-stop-sheet');
  fireEvent.press(screen.getByRole('button', { name: '취소' }));
  fireEvent(management, 'longPress');
  const menu = await screen.findByTestId('routine-menu-sheet');
  expect(
    within(menu)
      .getAllByRole('button')
      .map((button) => button.props.accessibilityLabel),
  ).toEqual(['루틴 편집', '그만두기', '취소']);
  fireEvent.press(within(menu).getByRole('button', { name: '취소' }));
  fireEvent(management, 'accessibilityAction', { nativeEvent: { actionName: 'stop' } });
  await screen.findByTestId('routine-stop-sheet');
  fireEvent.press(screen.getByRole('button', { name: '취소' }));
  fireEvent(management, 'accessibilityAction', { nativeEvent: { actionName: 'edit' } });
  expect(screen.getByTestId('routine-edit-sheet')).toBeTruthy();
});

it('기기 오프라인 띠와 쓰기 비활성이 재연결 때 해제되고 메뉴에는 이유가 남는다', async () => {
  await mount();
  act(() => onlineManager.setOnline(false));
  expect(screen.getByText(t('sync.offline'))).toBeTruthy();
  expect(screen.getByTestId('quick-add').props.accessibilityState.disabled).toBe(true);
  const check = screen.getByRole('checkbox', { name: '장보기 완료하기' });
  expect(check.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getByTestId('todo-menu-one'));
  const menu = await screen.findByTestId('todo-menu-sheet');
  expect(within(menu).getByText(t('sync.writeDisabled'))).toBeTruthy();
  expect(within(menu).getByRole('button', { name: '완료' }).props.accessibilityState.disabled).toBe(
    true,
  );
  fireEvent.press(screen.getByRole('button', { name: t('mobile.add.cancel') }));
  act(() => onlineManager.setOnline(true));
  expect(screen.queryByText(t('sync.offline'))).toBeNull();
  expect(screen.getByTestId('quick-add').props.accessibilityState.disabled).toBe(false);
  expect(
    screen.getByRole('checkbox', { name: '장보기 완료하기' }).props.accessibilityState.disabled,
  ).toBe(false);
});

it('빈 하루는 첫 할 일 추가를 안내하고 활성 목표가 없어도 설정으로 진입한다', async () => {
  jest.mocked(listTodosInRange).mockResolvedValue([]);
  jest.mocked(listGoals).mockResolvedValue([]);
  await mount();
  expect(screen.getByText(t('mobile.today.noGoals'))).toBeTruthy();
  expect(screen.getByTestId('quick-add').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(screen.getAllByRole('button', { name: t('settings.title') })[1]!);
  expect(screen.getByRole('button', { name: t('goal.manage') })).toBeTruthy();
});
it('기본 목표만 있는 첫 하루에서도 할 일을 추가할 수 있다', async () => {
  jest.mocked(listTodosInRange).mockResolvedValue([]);
  await mount();
  expect(screen.getByText(t('mobile.today.empty'))).toBeTruthy();
  expect(screen.getByTestId('quick-add').props.accessibilityState.disabled).toBe(false);
  fireEvent.press(screen.getByTestId('quick-add'));
  expect(screen.getByLabelText(t('todo.title'))).toBeTruthy();
});
it('첫 안내를 건너뛴 뒤에도 줄 메뉴에 밀기와 같은 동작이 모두 있다', async () => {
  await AsyncStorage.removeItem(GUIDE_KEY);
  await mount();
  await screen.findByTestId('first-run-guide');
  fireEvent.press(screen.getByRole('button', { name: t('mobile.guide.skip') }));
  fireEvent.press(screen.getByTestId('todo-menu-one'));
  const menu = await screen.findByTestId('todo-menu-sheet');
  for (const name of ['완료', /날짜 옮기기/, '삭제'])
    expect(within(menu).getByRole('button', { name })).toBeTruthy();
});

it('오프라인에 캐시도 없으면 로딩 대신 인터넷 연결과 로그아웃을 안내한다', async () => {
  onlineManager.setOnline(false);
  render(
    <QueryClientProvider client={cache}>
      <ToastProvider>
        <Today client={client} userId="user" onLogout={() => {}} loggingOut={false} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  expect(screen.getByText(t('mobile.offline.noCache'))).toBeTruthy();
  expect(screen.getByRole('button', { name: t('auth.logout') })).toBeTruthy();
  expect(screen.queryByText(t('mobile.today.loading'))).toBeNull();
  expect(fetchProfile).not.toHaveBeenCalled();
});
