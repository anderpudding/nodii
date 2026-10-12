import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager, QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import {
  countAccountContents,
  deleteMyAccount,
  listGoals,
  listRoutines,
  updateWeekStart,
  type NodiiClient,
} from '@nodii/api';
import type { Profile } from '@nodii/core';
import { ToastProvider } from '../../components/Toast';
import { useThemePreference } from '../../../lib/theme-preference';
import { Settings } from './Settings';

jest.mock('../../../../../packages/api/src/settings', () => ({
  countAccountContents: jest.fn(),
  deleteMyAccount: jest.fn(),
  updateWeekStart: jest.fn(),
}));
jest.mock('../../../../../packages/api/src/repositories/goals', () => ({ listGoals: jest.fn() }));
jest.mock('../../../../../packages/api/src/repositories/routines', () => ({
  listRoutines: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
const client = {} as NodiiClient;
const initial: Profile = { id: 'alice', displayName: null, timezone: 'UTC', weekStart: 0 };
let cache: QueryClient;
const onDeleted = jest.fn(async () => {});
function Content() {
  const profile = useQuery({
    queryKey: ['profile', 'alice'],
    queryFn: async () => initial,
    initialData: initial,
    staleTime: Infinity,
  });
  return (
    <Settings
      client={client}
      profile={profile.data!}
      email="alice@example.com"
      onLogout={jest.fn()}
      loggingOut={false}
      onAccountDeleted={onDeleted}
      onClose={jest.fn()}
    />
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  onlineManager.setOnline(true);
  useThemePreference.setState({ preference: 'system' });
  cache = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  jest.mocked(listGoals).mockResolvedValue([]);
  jest.mocked(listRoutines).mockResolvedValue([]);
  jest.mocked(countAccountContents).mockResolvedValue({ goals: 3, todos: 42, routines: 4 });
  jest.mocked(deleteMyAccount).mockResolvedValue(undefined);
  jest.mocked(updateWeekStart).mockResolvedValue({ ...initial, weekStart: 1 });
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
        <Content />
      </ToastProvider>
    </QueryClientProvider>,
  );
  await screen.findByText('alice@example.com');
  await act(async () => {});
}
it('계정 삭제 개수와 이해 체크가 준비되면 기존 RPC와 로컬 정리를 호출한다', async () => {
  await mount();
  fireEvent.press(screen.getByRole('button', { name: '계정 삭제' }));
  const sheet = await screen.findByTestId('account-delete-sheet');
  await within(sheet).findByText('목표 3개, 할 일 42개, 루틴 4개가 삭제돼요.');
  const button = within(sheet).getByRole('button', { name: '계정 삭제' });
  expect(button.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(
    within(sheet).getByRole('checkbox', { name: '모든 기록이 사라지는 것을 이해했어요' }),
  );
  fireEvent.press(within(sheet).getByRole('button', { name: '계정 삭제' }));
  await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  expect(deleteMyAccount).toHaveBeenCalledTimes(1);
});
it('주 시작 변경은 프로필을 갱신하고 두 월 캐시를 무효화하며 실패하면 롤백한다', async () => {
  const invalidate = jest.spyOn(cache, 'invalidateQueries');
  await mount();
  fireEvent.press(screen.getByRole('radio', { name: '월요일' }));
  await waitFor(() => expect(updateWeekStart).toHaveBeenCalledWith(client, 'alice', 1));
  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['routineLogs'] }));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['todos'] });
  expect(cache.getQueryData<Profile>(['profile', 'alice'])?.weekStart).toBe(1);
  jest.mocked(updateWeekStart).mockRejectedValueOnce(new Error('network'));
  fireEvent.press(screen.getByRole('radio', { name: '일요일' }));
  await screen.findByText('저장하지 못했어요 · 다시 시도');
  expect(cache.getQueryData<Profile>(['profile', 'alice'])?.weekStart).toBe(1);
});
it('기기 테마는 오프라인에서도 로컬 저장하고 저장 실패 때 기존 선택을 유지한다', async () => {
  await mount();
  act(() => onlineManager.setOnline(false));
  expect(screen.getByRole('radio', { name: '월요일' }).props.accessibilityState.disabled).toBe(
    true,
  );
  expect(screen.getByRole('button', { name: '계정 삭제' }).props.accessibilityState.disabled).toBe(
    true,
  );
  fireEvent.press(screen.getByRole('radio', { name: '다크' }));
  await waitFor(() => expect(useThemePreference.getState().preference).toBe('dark'));
  expect(AsyncStorage.setItem).toHaveBeenCalledWith('nodii.theme', 'dark');
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk'));
  fireEvent.press(screen.getByRole('radio', { name: '라이트' }));
  await screen.findByText('테마 설정을 저장하거나 불러오지 못했어요. 다시 시도해 주세요.');
  expect(useThemePreference.getState().preference).toBe('dark');
});
it('계정 삭제 서버 실패는 로그인 상태를 정리하지 않고 오류를 알린다', async () => {
  jest.mocked(deleteMyAccount).mockRejectedValueOnce(new Error('network'));
  await mount();
  fireEvent.press(screen.getByRole('button', { name: '계정 삭제' }));
  const sheet = await screen.findByTestId('account-delete-sheet');
  await within(sheet).findByText('목표 3개, 할 일 42개, 루틴 4개가 삭제돼요.');
  fireEvent.press(
    within(sheet).getByRole('checkbox', { name: '모든 기록이 사라지는 것을 이해했어요' }),
  );
  fireEvent.press(within(sheet).getByRole('button', { name: '계정 삭제' }));
  await screen.findByText('계정을 삭제하지 못했어요. 다시 시도해 주세요.');
  expect(onDeleted).not.toHaveBeenCalled();
});
