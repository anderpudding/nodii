import type * as Api from '@nodii/api';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fetchMinAppVersion,
  syncProfileTimezone,
  type NodiiClient,
  type Session,
} from '@nodii/api';
import { t } from '@nodii/i18n';
import { Text, View } from 'react-native';
vi.mock('@nodii/api', async (original) => ({
  ...(await original<typeof Api>()),
  fetchMinAppVersion: vi.fn(),
  syncProfileTimezone: vi.fn(),
}));
vi.mock('../../lib/supabase', () => ({
  mobileClient: null,
  mobileEnv: { appStoreId: '123', reviewAccountEmail: '' },
}));
vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '0.1.0' } } }));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));
vi.mock('expo-splash-screen', () => ({ hideAsync: vi.fn().mockResolvedValue(undefined) }));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: View,
  useSafeAreaInsets: () => ({ top: 0 }),
}));
vi.mock('../features/Today', () => ({
  Today: ({ onLogout }: { onLogout(): void }) => (
    <View>
      <Text>{t('mobile.today.preparing')}</Text>
      <button onClick={onLogout}>{t('auth.logout')}</button>
    </View>
  ),
}));
vi.mock('../../lib/logout', () => ({ logout: vi.fn() }));
import { hideAsync } from 'expo-splash-screen';
import { logout } from '../../lib/logout';
import { ToastProvider } from '../components/Toast';
import { AppGate } from './AppGate';

let listener: (event: string, session: Session | null) => void;
let client: NodiiClient;
let query: QueryClient;
const session = { user: { id: 'user-id' } } as Session;
const getSession = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchMinAppVersion).mockResolvedValue(null);
  vi.mocked(syncProfileTimezone).mockResolvedValue(
    {} as Awaited<ReturnType<typeof syncProfileTimezone>>,
  );
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  client = {
    auth: {
      getSession,
      onAuthStateChange: vi.fn((callback) => {
        listener = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      startAutoRefresh: vi.fn(),
      stopAutoRefresh: vi.fn(),
    },
  } as unknown as NodiiClient;
  query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  query.clear();
});
function mount() {
  return render(
    <QueryClientProvider client={query}>
      <ToastProvider>
        <AppGate client={client} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

it('버전이 낮으면 세션 조회 전에 업데이트 안내를 띄운다', async () => {
  vi.mocked(fetchMinAppVersion).mockResolvedValueOnce('0.2.0');
  mount();
  await screen.findByRole('heading', { name: t('mobile.update.title') });
  expect(getSession).not.toHaveBeenCalled();
  expect(hideAsync).toHaveBeenCalled();
});
it('버전 조회 실패는 통과하며 세션 복원을 마칠 때까지 스플래시를 유지한다', async () => {
  vi.mocked(fetchMinAppVersion).mockRejectedValueOnce(new Error('offline'));
  let restore: (value: unknown) => void = () => {};
  getSession.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        restore = resolve;
      }),
  );
  mount();
  await waitFor(() => expect(getSession).toHaveBeenCalled());
  expect(hideAsync).not.toHaveBeenCalled();
  await act(async () => restore({ data: { session }, error: null }));
  await screen.findByText(t('mobile.today.preparing'));
  expect(hideAsync).toHaveBeenCalled();
  expect(syncProfileTimezone).toHaveBeenCalled();
});
it('로그인 이벤트로 오늘 화면을 열고 시간대 실패도 진입을 막지 않는다', async () => {
  vi.mocked(syncProfileTimezone).mockRejectedValueOnce(new Error('network'));
  mount();
  await screen.findByLabelText(t('auth.email'));
  await act(async () => listener('SIGNED_IN', session));
  await screen.findByText(t('mobile.today.preparing'));
  await screen.findByText(t('mobile.profile.failed'));
});
it('오프라인 로그아웃 완료 후 로그인 화면과 로컬 안내를 표시한다', async () => {
  getSession.mockResolvedValueOnce({ data: { session }, error: null });
  vi.mocked(logout).mockImplementationOnce(async () => {
    listener('SIGNED_OUT', null);
    query.clear();
    return { localOnly: true };
  });
  mount();
  await screen.findByText(t('mobile.today.preparing'));
  fireEvent.click(screen.getByRole('button', { name: t('auth.logout') }));
  await screen.findByLabelText(t('auth.email'));
  await screen.findByText(t('auth.logout.local'));
});
it('세션 저장소 실패는 빈 화면 대신 재시도 화면을 보여준다', async () => {
  getSession.mockRejectedValueOnce(new Error('keychain'));
  mount();
  await screen.findByText(t('mobile.session.failed'));
  fireEvent.click(screen.getByRole('button', { name: t('common.tryAgain') }));
  await screen.findByLabelText(t('auth.email'));
});
