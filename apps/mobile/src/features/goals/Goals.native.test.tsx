import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  archiveGoal,
  createGoal,
  deleteGoal,
  listGoals,
  unarchiveGoal,
  updateGoal,
  countAllGoalContents,
  type GoalRecord,
  type NodiiClient,
} from '@nodii/api';
import { compareSortKey } from '@nodii/core';
import { ToastProvider } from '../../components/Toast';
import { SwipeableRow } from '../../components/gestures/SwipeableRow';
import { Goals } from './Goals';

jest.mock('../../../../../packages/api/src/repositories/goals', () => ({
  listGoals: jest.fn(),
  archiveGoal: jest.fn(),
  unarchiveGoal: jest.fn(),
  updateGoal: jest.fn(),
  createGoal: jest.fn(),
  deleteGoal: jest.fn(),
}));
jest.mock('../../../../../packages/api/src/settings', () => ({ countAllGoalContents: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-goal' }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
const client = {} as NodiiClient;
const first: GoalRecord = {
  id: 'g1',
  name: '공부',
  color: '#4F7CFF',
  sortKey: 'a0',
  archivedAt: null,
  deletedAt: null,
  updatedAt: '',
};
const second: GoalRecord = { ...first, id: 'g2', name: '운동', sortKey: 'a1' };
let cache: QueryClient;
beforeEach(() => {
  jest.clearAllMocks();
  onlineManager.setOnline(true);
  cache = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  jest.mocked(listGoals).mockResolvedValue([first, second]);
  jest
    .mocked(countAllGoalContents)
    .mockResolvedValue({ g1: { todos: 42, routines: 1 }, g2: { todos: 6, routines: 2 } });
  jest.mocked(archiveGoal).mockResolvedValue({ ...first, archivedAt: '2026-10-12T10:00:00Z' });
  jest.mocked(unarchiveGoal).mockResolvedValue(first);
  jest.mocked(updateGoal).mockImplementation(async (_client, id, changes) => ({
    ...(id === first.id ? first : second),
    ...changes,
  }));
  jest
    .mocked(createGoal)
    .mockImplementation(async (_client, goal) => ({ ...goal, updatedAt: '', deletedAt: null }));
  jest.mocked(deleteGoal).mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  cache.clear();
  onlineManager.setOnline(true);
  jest.restoreAllMocks();
});
async function mount() {
  render(
    <QueryClientProvider client={cache}>
      <ToastProvider>
        <Goals client={client} onClose={jest.fn()} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole('button', { name: '공부, 할 일 42개, 루틴 1개' });
  await act(async () => {});
}
function gesture(id: string, distance: number, vertical = false) {
  act(() =>
    fireGestureHandler(getByGestureTestId(id), [
      { state: State.BEGAN, translationX: 0, translationY: 0 },
      {
        state: State.ACTIVE,
        translationX: vertical ? 0 : distance,
        translationY: vertical ? distance : 0,
      },
      {
        state: State.END,
        translationX: vertical ? 0 : distance,
        translationY: vertical ? distance : 0,
      },
    ]),
  );
}
it('마지막 활성 목표 밀기는 보관 칸 없이 토스트를 띄우고 서버 요청을 하지 않는다', async () => {
  jest.mocked(listGoals).mockResolvedValue([first]);
  await mount();
  const swipe = screen.UNSAFE_getAllByType(SwipeableRow)[0]!;
  expect(swipe.props.trailing).toEqual([]);
  fireEvent(screen.getByTestId('swipe-layout-goal-g1'), 'layout', {
    nativeEvent: { layout: { width: 360, height: 52 } },
  });
  gesture('swipe-goal-g1', -100);
  await screen.findByText('활성 목표가 하나는 있어야 해요');
  expect(screen.queryByRole('button', { name: '보관' })).toBeNull();
  expect(archiveGoal).not.toHaveBeenCalled();
});
it('목표 밀기·길게 누르기·VoiceOver가 같은 동작 선언을 제공한다', async () => {
  await mount();
  const row = screen.getByRole('button', { name: '공부, 할 일 42개, 루틴 1개' });
  expect(row.props.accessibilityActions.map((entry: { name: string }) => entry.name)).toEqual([
    'edit',
    'reorder',
    'archive',
    'delete',
  ]);
  const swipe = screen
    .UNSAFE_getAllByType(SwipeableRow)
    .find((item) => item.props.id === 'goal-g1')!;
  expect(swipe.props.leading).toBeUndefined();
  expect(swipe.props.trailing.map((entry: { id: string }) => entry.id)).toEqual(['archive']);
  fireEvent(row, 'longPress');
  const menu = await screen.findByTestId('goal-menu-sheet');
  for (const label of ['목표 편집', '순서 바꾸기', '보관', '목표 삭제'])
    expect(within(menu).getByRole('button', { name: label })).toBeTruthy();
});
it('보관과 보관 해제는 실행 취소로 복원할 수 있다', async () => {
  await mount();
  const row = screen.getByRole('button', { name: '공부, 할 일 42개, 루틴 1개' });
  fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'archive' } });
  await screen.findByText("'공부' 목표를 보관했어요");
  expect(archiveGoal).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: '실행 취소' }));
  await screen.findByRole('button', { name: '공부, 할 일 42개, 루틴 1개' });
  expect(unarchiveGoal).toHaveBeenCalledTimes(1);
  fireEvent(
    screen.getByRole('button', { name: '공부, 할 일 42개, 루틴 1개' }),
    'accessibilityAction',
    { nativeEvent: { actionName: 'archive' } },
  );
  await waitFor(() => expect(archiveGoal).toHaveBeenCalledTimes(2));
  fireEvent.press(screen.getByRole('button', { name: '보관한 목표' }));
  const archiveScreen = await screen.findByTestId('goals-screen');
  expect(
    (cache.getQueryData<GoalRecord[]>(['goals']) ?? []).filter((row) => row.archivedAt),
  ).toHaveLength(1);
  fireEvent.press(within(archiveScreen).getByRole('button', { name: '보관 해제' }));
  await screen.findByText("'공부' 목표의 보관을 해제했어요");
  expect(unarchiveGoal).toHaveBeenCalledTimes(2);
});
it('길게 눌러 옮긴 목표 한 행만 이웃 뒤의 정렬 키로 갱신한다', async () => {
  await mount();
  gesture('reorder-goal-g1', 80, true);
  await waitFor(() => expect(updateGoal).toHaveBeenCalledTimes(1));
  const [, id, changes] = jest.mocked(updateGoal).mock.calls[0]!;
  expect(id).toBe('g1');
  expect(compareSortKey(second.sortKey, changes.sortKey!)).toBeLessThan(0);
  expect(archiveGoal).not.toHaveBeenCalled();
});
it('HEX 오류는 저장을 막고 새 목표 저장은 기존 생성 훅을 사용한다', async () => {
  await mount();
  fireEvent.press(screen.getByRole('button', { name: '목표 추가' }));
  const editor = await screen.findByTestId('goal-editor-sheet');
  fireEvent.changeText(within(editor).getByLabelText('목표 이름'), '독서');
  fireEvent.changeText(within(editor).getByLabelText('HEX 색상'), '#bad');
  expect(
    within(editor).getByRole('button', { name: '목표 추가' }).props.accessibilityState.disabled,
  ).toBe(true);
  fireEvent.changeText(within(editor).getByLabelText('HEX 색상'), '#FFFFFF');
  fireEvent.press(within(editor).getByRole('button', { name: '목표 추가' }));
  await waitFor(() => expect(createGoal).toHaveBeenCalledTimes(1));
  expect(jest.mocked(createGoal).mock.calls[0]![1]).toMatchObject({
    id: 'new-goal',
    name: '독서',
    color: '#FFFFFF',
  });
});
it('완전 삭제 확인에는 개수를 표시하고 delete_goal 경로를 한 번만 호출한다', async () => {
  const confirm = jest.spyOn(Alert, 'alert');
  await mount();
  fireEvent.press(screen.getByRole('button', { name: '공부, 할 일 42개, 루틴 1개' }));
  const editor = await screen.findByTestId('goal-editor-sheet');
  fireEvent.press(within(editor).getByRole('button', { name: '목표 삭제' }));
  expect(confirm.mock.calls[0]![1]).toContain('할 일 42개와 루틴 1개');
  const remove = confirm.mock.calls[0]![2]!.find((button) => button.text === '삭제')!;
  act(() => {
    remove.onPress?.();
    remove.onPress?.();
  });
  await waitFor(() => expect(deleteGoal).toHaveBeenCalledTimes(1));
  expect(deleteGoal).toHaveBeenCalledWith(client, 'g1');
});
