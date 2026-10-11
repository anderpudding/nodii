/// <reference types="jest" />
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  type KeyboardEvent,
} from 'react-native';
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fetchProfile,
  listGoals,
  listTodosInRange,
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
import { useUIStore } from '../stores/ui';
import { Today } from './Today';

jest.mock('../../../../packages/api/src/profile', () => ({ fetchProfile: jest.fn() }));
jest.mock('../../../../packages/api/src/repositories/goals', () => ({ listGoals: jest.fn() }));
jest.mock('../../../../packages/api/src/repositories/todos', () => ({
  listTodosInRange: jest.fn(),
  createTodo: jest.fn(),
  updateTodo: jest.fn(),
  softDeleteTodo: jest.fn(),
  moveTodo: jest.fn(),
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
beforeEach(() => {
  jest.clearAllMocks();
  for (const request of [
    fetchProfile,
    listGoals,
    listTodosInRange,
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
  act(() => useUIStore.getState().selectDate('2026-10-10'));
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
    screen.getByRole('button', { name: t('mobile.month.unavailable') }).props.accessibilityState
      .disabled,
  ).toBe(true);
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
    'tomorrow',
    'delete',
  ]);
  await openMenu();
  for (const key of ['complete', 'rename', 'tomorrow', 'delete'] as const)
    expect(screen.getByRole('button', { name: t(`todo.action.${key}`) })).toBeTruthy();
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
it('내일로는 선택 날짜의 다음 날·목표 맨 아래로 옮기며 실행 취소로 날짜와 키를 복원한다', async () => {
  jest
    .mocked(listTodosInRange)
    .mockResolvedValue([
      row('one', '장보기'),
      row('two', 'OS 과제'),
      { ...row('last', '내일 항목'), date: '2026-10-11', sortKey: 'a9' },
    ]);
  await mount();
  await openMenu();
  fireEvent.press(screen.getByRole('button', { name: t('todo.action.tomorrow') }));
  await waitFor(() => expect(moveTodo).toHaveBeenCalled());
  expect(jest.mocked(moveTodo).mock.calls[0]![2]).toBe('2026-10-11');
  expect(jest.mocked(moveTodo).mock.calls[0]![3] > 'a9').toBe(true);
  await screen.findByText(t('todo.moved', { title: '장보기', particle: '를' }));
  expect(
    screen.queryByRole('checkbox', { name: t('todo.complete', { title: '장보기' }) }),
  ).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: t('todo.undo') }));
  await screen.findByRole('checkbox', { name: t('todo.complete', { title: '장보기' }) });
  expect(jest.mocked(moveTodo).mock.calls[1]!.slice(2)).toEqual(['2026-10-10', 'a0']);
});
it.each(['tomorrow', 'delete'] as const)(
  '%s 실패는 사라진 행을 롤백하고 토스트로 알린다',
  async (action) => {
    let reject: (error: Error) => void = () => {};
    const request = action === 'tomorrow' ? jest.mocked(moveTodo) : jest.mocked(softDeleteTodo);
    request.mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    );
    await mount();
    await openMenu();
    fireEvent.press(screen.getByRole('button', { name: t(`todo.action.${action}`) }));
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
