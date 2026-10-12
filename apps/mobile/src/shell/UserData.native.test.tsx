import { act, cleanup, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { AppState, Text, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  dehydrate,
  onlineManager,
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query';
import { subscribeUserChanges, syncProfileTimezone, type NodiiClient } from '@nodii/api';
import { UserData } from './UserData';
import { ToastProvider } from '../components/Toast';
import { CACHE_BUSTER } from '../../lib/query-cache';
import { logout } from '../../lib/logout';

jest.mock('../../../../packages/api/src/realtime', () => ({
  subscribeUserChanges: jest.fn(),
  applyRealtimeEvent: jest.fn(),
}));
jest.mock('../../../../packages/api/src/profile', () => ({ syncProfileTimezone: jest.fn() }));
jest.mock('../../../../packages/api/src/auth', () => ({ signOut: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('expo-secure-store', () => ({}));
let change: (state: AppStateStatus) => void;
let parent: QueryClient;
let child: QueryClient;
function Probe() {
  const cache = useQueryClient();
  useEffect(() => {
    child = cache;
  }, [cache]);
  return <Text>복원 완료</Text>;
}
const stop = jest.fn();
const remove = jest.fn();
const client = { auth: { stopAutoRefresh: jest.fn() } } as unknown as NodiiClient;
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  onlineManager.setOnline(true);
  parent = new QueryClient();
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    change = callback;
    return { remove };
  });
  jest.mocked(subscribeUserChanges).mockReturnValue(stop);
  jest
    .mocked(syncProfileTimezone)
    .mockResolvedValue({ id: 'alice', timezone: 'UTC', weekStart: 1, displayName: null });
});
afterEach(() => {
  cleanup();
  parent.clear();
  child?.clear();
  jest.restoreAllMocks();
  onlineManager.setOnline(true);
});
function mount() {
  return render(
    <QueryClientProvider client={parent}>
      <ToastProvider>
        <UserData client={client} userId="alice">
          <Probe />
        </UserData>
      </ToastProvider>
    </QueryClientProvider>,
  );
}
it('복원 뒤 구독하고 포그라운드 복귀 때 재구독과 캐시 무효화를 한 번 수행한다', async () => {
  const invalidate = jest.spyOn(QueryClient.prototype, 'invalidateQueries');
  mount();
  await screen.findByText('복원 완료');
  await waitFor(() => expect(subscribeUserChanges).toHaveBeenCalledTimes(1));
  const initial = invalidate.mock.calls.length;
  act(() => change('background'));
  expect(stop).toHaveBeenCalledTimes(1);
  act(() => change('active'));
  expect(subscribeUserChanges).toHaveBeenCalledTimes(2);
  expect(invalidate.mock.calls.length).toBe(initial + 1);
  act(() => change('active'));
  expect(subscribeUserChanges).toHaveBeenCalledTimes(2);
});
it('오프라인 복원 뒤 로그아웃은 영속 캐시와 인증 저장소를 함께 비운다', async () => {
  onlineManager.setOnline(false);
  const saved = new QueryClient();
  saved.setQueryData(['goals'], [{ id: 'private' }]);
  await AsyncStorage.setItem(
    'nodii.query-cache:alice',
    JSON.stringify({
      userId: 'alice',
      client: {
        buster: CACHE_BUSTER,
        timestamp: Date.now(),
        clientState: dehydrate(saved),
      },
    }),
  );
  mount();
  await screen.findByText('복원 완료');
  expect(child.getQueryData(['goals'])).toEqual([{ id: 'private' }]);
  const removeItem = jest.fn(async () => {});
  await act(async () => {
    await logout(client, parent, { getItem: () => null, setItem: () => {}, removeItem });
  });
  expect(await AsyncStorage.getItem('nodii.query-cache:alice')).toBeNull();
  expect(removeItem).toHaveBeenCalledTimes(3);
  expect(syncProfileTimezone).not.toHaveBeenCalled();
  saved.clear();
});
